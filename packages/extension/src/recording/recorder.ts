import { debugLog } from '../relayConnection';
import { ACTION_BINDING_NAME, actionCaptureScript } from './actionCaptureScript';
import { RecordingApiClient } from './apiClient';
import { EventBuffer } from './eventBuffer';
import { createEventDraft, type RecordingEventType } from './eventTypes';
import { ListenerRegistry } from './listenerRegistry';
import { buildLocatorCandidates, type ElementDescriptor } from './locatorCandidates';
import { prepareNetworkBody } from './networkBody';
import { redactPayload, redactUrl } from './redaction';
import { RecordingSocketClient } from './socketClient';
import { diffRecordingTabs, filterRecordableTabs } from './tabGroupRecorder';

export interface RecordingStartOptions {
	idSession: number;
	apiBaseUrl: string;
	getToken: () => Promise<string | null>;
	recordingGroupId: number;
	maxNetworkBodyBytes?: number;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	captureScreenshots?: boolean;
}

interface PendingRequest {
	method: string;
	url: string;
	contentType: string | null;
	postData: string | null;
	status?: number;
	responseContentType?: string | null;
	failed?: boolean;
	tabId: number;
}

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_FLUSH_INTERVAL_MS = 2000;
const DEFAULT_MAX_BATCH_SIZE = 50;

/**
 * Mengendalikan satu session recording: attach debugger ke tab dalam group,
 * menangkap action/console/network/navigation, lalu mengalirkan event ke
 * backend melalui Socket.IO dengan acknowledgement.
 */
export class RecordingController {
	private readonly _buffer = new EventBuffer();
	private readonly _listeners = new ListenerRegistry();
	private readonly _attachedTabs = new Set<number>();
	private readonly _pendingRequests = new Map<string, PendingRequest>();
	private _options: RecordingStartOptions | null = null;
	private _socket: RecordingSocketClient | null = null;
	private _api: RecordingApiClient | null = null;
	private _flushTimer: ReturnType<typeof setInterval> | null = null;
	private _flushPromise: Promise<void> | null = null;

	get isRecording(): boolean {
		return this._options !== null;
	}

	get pendingEventCount(): number {
		return this._buffer.pendingCount;
	}

	async start(options: RecordingStartOptions): Promise<void> {
		if (this._options) throw new Error('Recording sudah berjalan.');

		this._options = options;
		const token = await options.getToken();

		this._api = new RecordingApiClient({
			baseUrl: options.apiBaseUrl,
			getToken: options.getToken
		});

		this._socket = new RecordingSocketClient({
			baseUrl: options.apiBaseUrl,
			getToken: options.getToken
		});
		void token;

		const joined = await this._socket.connect(options.idSession);
		this._buffer.resumeFrom(joined.resume.next_sequence);

		this._installTabListeners();

		const tabs = await chrome.tabs.query({});
		const recordable = filterRecordableTabs(tabs, options.recordingGroupId);
		for (const tab of recordable)
			if (typeof tab.id === 'number') await this.attachTab(tab.id).catch(() => {});

		this._flushTimer = setInterval(() => void this.flush(), options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS);
	}

	async stop(): Promise<void> {
		if (this._flushTimer) {
			clearInterval(this._flushTimer);
			this._flushTimer = null;
		}

		// Tunggu flush yang sedang berjalan lalu kuras sisa buffer supaya tidak
		// ada event yang hilang saat recording dihentikan.
		if (this._flushPromise) await this._flushPromise.catch(() => {});
		let guard = 0;
		while (this._socket && this._buffer.pendingCount > 0 && guard < 100) {
			const before = this._buffer.pendingCount;
			await this.flush();
			if (this._buffer.pendingCount >= before) break;
			guard += 1;
		}

		this._listeners.removeAll();
		for (const tabId of [...this._attachedTabs]) await this.detachTab(tabId).catch(() => {});

		this._socket?.disconnect();
		this._socket = null;
		this._api = null;
		this._pendingRequests.clear();
		this._buffer.clear();
		this._options = null;
	}

	async attachTab(tabId: number): Promise<void> {
		if (this._attachedTabs.has(tabId)) return;

		await this._attach(tabId);
		this._attachedTabs.add(tabId);

		await this._sendCommand(tabId, 'Runtime.enable').catch(() => {});
		await this._sendCommand(tabId, 'Log.enable').catch(() => {});
		await this._sendCommand(tabId, 'Network.enable').catch(() => {});
		await this._sendCommand(tabId, 'Page.enable').catch(() => {});
		await this._sendCommand(tabId, 'Runtime.addBinding', { name: ACTION_BINDING_NAME }).catch(() => {});

		const script = actionCaptureScript();
		await this._sendCommand(tabId, 'Page.addScriptToEvaluateOnNewDocument', { source: script }).catch(() => {});
		await this._sendCommand(tabId, 'Runtime.evaluate', { expression: script }).catch(() => {});
	}

	async detachTab(tabId: number): Promise<void> {
		if (!this._attachedTabs.has(tabId)) return;
		this._attachedTabs.delete(tabId);
		await new Promise<void>((resolve) => {
			chrome.debugger.detach({ tabId }, () => {
				void chrome.runtime.lastError;
				resolve();
			});
		});
	}

	async flush(): Promise<void> {
		if (!this._socket || this._buffer.pendingCount === 0) return;
		// Ikut menunggu flush yang sedang berjalan alih-alih langsung kembali,
		// supaya pemanggil (mis. stop) bisa memastikan buffer benar-benar kosong.
		if (this._flushPromise) return this._flushPromise;

		this._flushPromise = (async () => {
			try {
				const socket = this._socket;
				if (!socket) return;
				const batch = this._buffer.takeBatch(this._options?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
				const result = await socket.sendEvents(batch);
				this._buffer.acknowledge(result.last_sequence);
				if (result.resume) this._buffer.resumeFrom(result.resume.next_sequence);
			} catch (error) {
				debugLog('Gagal flush event recording:', error);
			} finally {
				this._flushPromise = null;
			}
		})();

		return this._flushPromise;
	}

	private _installTabListeners(): void {
		const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
			if (changeInfo.groupId === undefined) return;
			void this._reconcileGroup();
			void tabId;
		};
		const onRemoved = (tabId: number) => {
			void this.detachTab(tabId);
		};
		const onDebuggerEvent = (source: chrome.debugger.Debuggee, method: string, params?: object) => {
			if (typeof source.tabId !== 'number' || !this._attachedTabs.has(source.tabId)) return;
			void this._onDebuggerEvent(source.tabId, method, (params ?? {}) as Record<string, unknown>);
		};
		const onDebuggerDetach = (source: chrome.debugger.Debuggee) => {
			if (typeof source.tabId === 'number') this._attachedTabs.delete(source.tabId);
		};

		chrome.tabs.onUpdated.addListener(onUpdated);
		chrome.tabs.onRemoved.addListener(onRemoved);
		chrome.debugger.onEvent.addListener(onDebuggerEvent);
		chrome.debugger.onDetach.addListener(onDebuggerDetach);

		this._listeners.add(() => chrome.tabs.onUpdated.removeListener(onUpdated));
		this._listeners.add(() => chrome.tabs.onRemoved.removeListener(onRemoved));
		this._listeners.add(() => chrome.debugger.onEvent.removeListener(onDebuggerEvent));
		this._listeners.add(() => chrome.debugger.onDetach.removeListener(onDebuggerDetach));
	}

	private async _reconcileGroup(): Promise<void> {
		if (!this._options) return;
		const tabs = await chrome.tabs.query({});
		const { added, removed } = diffRecordingTabs(
			[...this._attachedTabs],
			tabs,
			this._options.recordingGroupId
		);
		for (const tabId of added) await this.attachTab(tabId).catch(() => {});
		for (const tabId of removed) await this.detachTab(tabId);
	}

	private async _onDebuggerEvent(
		tabId: number,
		method: string,
		params: Record<string, unknown>
	): Promise<void> {
		switch (method) {
			case 'Runtime.bindingCalled':
				this._onBindingCalled(tabId, params);
				break;
			case 'Runtime.consoleAPICalled':
				this._onConsoleCalled(tabId, params);
				break;
			case 'Runtime.exceptionThrown':
				this._onExceptionThrown(tabId, params);
				break;
			case 'Log.entryAdded':
				this._onLogEntry(tabId, params);
				break;
			case 'Network.requestWillBeSent':
				this._onRequestWillBeSent(tabId, params);
				break;
			case 'Network.responseReceived':
				this._onResponseReceived(params);
				break;
			case 'Network.loadingFinished':
				await this._onLoadingFinished(params);
				break;
			case 'Network.loadingFailed':
				this._onLoadingFailed(params);
				break;
			case 'Page.frameNavigated':
				this._onFrameNavigated(tabId, params);
				break;
			default:
				break;
		}
	}

	private _enqueue(type: RecordingEventType, payload: Record<string, unknown>, extra: { tabId?: number; url?: string } = {}) {
		this._buffer.enqueue(createEventDraft(type, redactPayload(payload), {
			tabId: extra.tabId ?? null,
			url: extra.url ? redactUrl(extra.url) : null
		}));
	}

	private _onBindingCalled(tabId: number, params: Record<string, unknown>): void {
		if (params.name !== ACTION_BINDING_NAME || typeof params.payload !== 'string') return;
		let parsed: { action?: string; element?: ElementDescriptor; value?: string | null; value_redacted?: boolean };
		try {
			parsed = JSON.parse(params.payload);
		} catch {
			return;
		}

		const locators = parsed.element ? buildLocatorCandidates(parsed.element) : [];
		this._enqueue(
			'action',
			{
				action: parsed.action ?? 'unknown',
				locators,
				element: parsed.element ?? null,
				value: parsed.value ?? null,
				value_redacted: parsed.value_redacted === true
			},
			{ tabId }
		);

		void this._captureScreenshot(tabId);
	}

	private _onConsoleCalled(tabId: number, params: Record<string, unknown>): void {
		const type = String(params.type ?? 'log');
		const args = Array.isArray(params.args) ? params.args : [];
		const text = args
			.map((arg) => (arg as { value?: unknown; description?: unknown }).value ?? (arg as { description?: unknown }).description ?? '')
			.join(' ')
			.slice(0, 2000);

		this._enqueue('console', { level: type, text, source: 'console' }, { tabId });
	}

	private _onExceptionThrown(tabId: number, params: Record<string, unknown>): void {
		const details = (params.exceptionDetails ?? {}) as Record<string, unknown>;
		const exception = (details.exception ?? {}) as Record<string, unknown>;
		this._enqueue(
			'exception',
			{
				level: 'error',
				text: String(exception.description ?? details.text ?? 'Uncaught exception'),
				url: details.url ?? null,
				line: details.lineNumber ?? null,
				column: details.columnNumber ?? null
			},
			{ tabId }
		);
	}

	private _onLogEntry(tabId: number, params: Record<string, unknown>): void {
		const entry = (params.entry ?? {}) as Record<string, unknown>;
		const level = String(entry.level ?? 'log');
		this._enqueue(
			'console',
			{ level: level === 'warning' ? 'warning' : level, text: String(entry.text ?? '').slice(0, 2000), source: 'log', url: entry.url ?? null },
			{ tabId }
		);
	}

	private _onRequestWillBeSent(tabId: number, params: Record<string, unknown>): void {
		const request = (params.request ?? {}) as Record<string, unknown>;
		const headers = (request.headers ?? {}) as Record<string, string>;
		const url = String(request.url ?? '');
		const requestId = String(params.requestId ?? '');
		if (!requestId) return;

		this._pendingRequests.set(requestId, {
			method: String(request.method ?? 'GET'),
			url,
			contentType: headers['Content-Type'] ?? headers['content-type'] ?? null,
			postData: typeof request.postData === 'string' ? request.postData : null,
			tabId
		});
	}

	private _onResponseReceived(params: Record<string, unknown>): void {
		const requestId = String(params.requestId ?? '');
		const response = (params.response ?? {}) as Record<string, unknown>;
		const pending = this._pendingRequests.get(requestId);
		if (!pending) return;
		pending.status = Number(response.status ?? 0);
		pending.responseContentType = (response.headers as Record<string, string> | undefined)?.['Content-Type'] ?? null;
	}

	private async _onLoadingFinished(params: Record<string, unknown>): Promise<void> {
		const requestId = String(params.requestId ?? '');
		const pending = this._pendingRequests.get(requestId);
		if (!pending) return;
		this._pendingRequests.delete(requestId);
		this._emitNetworkEvent(pending);
	}

	private _onLoadingFailed(params: Record<string, unknown>): void {
		const requestId = String(params.requestId ?? '');
		const pending = this._pendingRequests.get(requestId);
		if (!pending) return;
		this._pendingRequests.delete(requestId);
		pending.failed = true;
		this._emitNetworkEvent(pending);
	}

	private _emitNetworkEvent(pending: PendingRequest): void {
		const maxBytes = this._options?.maxNetworkBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
		const requestBody = prepareNetworkBody(pending.contentType, pending.postData, maxBytes);
		const responseBodyNote = prepareNetworkBody(pending.responseContentType, null, maxBytes);

		this._enqueue(
			'network',
			{
				method: pending.method,
				status: pending.status ?? 0,
				failed: pending.failed === true,
				request: {
					content_type: pending.contentType,
					body: requestBody.body,
					body_stored: requestBody.stored,
					body_truncated: requestBody.truncated,
					body_reason: requestBody.reason,
					body_bytes: requestBody.original_bytes
				},
				response: {
					content_type: pending.responseContentType ?? null,
					body: responseBodyNote.body,
					body_stored: responseBodyNote.stored,
					body_truncated: responseBodyNote.truncated,
					body_reason: responseBodyNote.reason
				}
			},
			{ tabId: pending.tabId, url: pending.url }
		);
	}

	private _onFrameNavigated(tabId: number, params: Record<string, unknown>): void {
		const frame = (params.frame ?? {}) as Record<string, unknown>;
		this._enqueue(
			'action',
			{ action: 'navigation', locators: [], url: frame.url ?? null },
			{ tabId, url: String(frame.url ?? '') }
		);
	}

	private async _captureScreenshot(tabId: number): Promise<void> {
		const options = this._options;
		const api = this._api;
		if (!options || !api || options.captureScreenshots === false) return;

		try {
			const result = await this._sendCommand<{ data: string }>(tabId, 'Page.captureScreenshot', {
				format: 'png'
			});
			if (!result?.data) return;

			const bytes = base64ToBytes(result.data);
			const buffer = new ArrayBuffer(bytes.byteLength);
			new Uint8Array(buffer).set(bytes);

			const presign = await api.presignArtifactUpload(options.idSession, {
				kind: 'screenshot',
				content_type: 'image/png',
				size_bytes: buffer.byteLength
			});

			await api.uploadToPresignedUrl(presign.upload_url, new Blob([buffer], { type: 'image/png' }), 'image/png');
			await api.completeArtifactUpload(options.idSession, presign.artifact.id_artifact, {
				size_bytes: buffer.byteLength
			});
		} catch (error) {
			debugLog('Gagal mengambil/mengunggah screenshot:', error);
		}
	}

	private _attach(tabId: number): Promise<void> {
		return new Promise((resolve, reject) => {
			chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
				if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
				else resolve();
			});
		});
	}

	private _sendCommand<T = unknown>(
		tabId: number,
		method: string,
		params: Record<string, unknown> = {}
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
				if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
				else resolve(result as T);
			});
		});
	}
}

const base64ToBytes = (base64: string): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};
