import { debugLog } from '../relayConnection';
import { ACTION_BINDING_NAME, actionCaptureScript } from './actionCaptureScript';
import { RecordingApiClient } from './apiClient';
import { EventBuffer } from './eventBuffer';
import { createEventDraft, type RecordingEventType } from './eventTypes';
import { ListenerRegistry } from './listenerRegistry';
import { buildLocatorCandidates, type ElementDescriptor } from './locatorCandidates';
import { rankCandidates, type LocatorCandidate } from './locatorEngine';
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
	recordVideo?: boolean;
}

interface UploadFileData {
	name: string;
	type?: string;
	size?: number;
	data?: string;
	stored?: boolean;
}

interface PendingRequest {
	method: string;
	url: string;
	contentType: string | null;
	postData: string | null;
	status?: number;
	responseContentType?: string | null;
	requestId?: string | null;
	failed?: boolean;
	tabId: number;
}

/** Header response yang biasa dipakai backend untuk korelasi log (dicek case-insensitive). */
const REQUEST_ID_HEADERS = ['x-request-id', 'request-id', 'x-correlation-id', 'x-trace-id', 'traceparent'];

export const extractRequestId = (headers: Record<string, unknown> | undefined): string | null => {
	if (!headers) return null;
	const lower = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
	for (const name of REQUEST_ID_HEADERS) {
		const value = lower.get(name);
		if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200);
	}
	return null;
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
	/** Locator <iframe> pemilik per child session CDP (iframe cross-origin / OOPIF). */
	private readonly _frameOwnerLocators = new Map<string, string[]>();
	private _options: RecordingStartOptions | null = null;
	private _socket: RecordingSocketClient | null = null;
	private _api: RecordingApiClient | null = null;
	private _flushTimer: ReturnType<typeof setInterval> | null = null;
	private _flushPromise: Promise<void> | null = null;
	/** `upload_ref` dari capture script → sequence event upload, untuk menautkan file test data. */
	private readonly _uploadSequences = new Map<string, number>();
	/** Tab group yang sedang aktif: hanya frame tab ini yang digambar ke video (offscreen). */
	private _activeTabId: number | null = null;

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

		const initialActive = recordable.find((tab) => tab.active) ?? recordable[0];
		if (typeof initialActive?.id === 'number') this.setActiveTab(initialActive.id, initialActive);

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
		this._activeTabId = null;
	}

	get activeTabId(): number | null {
		return this._activeTabId;
	}

	/**
	 * Ganti tab aktif yang direkam ke video. Perpindahan (bukan penetapan awal) dicatat sebagai event `tab`
	 * agar timeline share dan konteks AI tahu urutan tab.
	 */
	setActiveTab(tabId: number, tab?: Pick<chrome.tabs.Tab, 'title' | 'url' | 'pendingUrl'>): void {
		if (!this._attachedTabs.has(tabId)) return;
		const title = tab?.title ?? '';
		// Tab baru masih loading: URL tujuan baru ada di pendingUrl, judul belum tersedia.
		const url = tab?.url || tab?.pendingUrl || '';
		const from = this._activeTabId;
		this._postToOffscreen({ type: 'OFFSCREEN_SET_ACTIVE_TAB', tabId, title, url });
		if (from === tabId) return;
		this._activeTabId = tabId;
		if (from !== null) {
			this._enqueue(
				'tab',
				{ kind: 'switch', from_tab_id: from, to_tab_id: tabId, title: title || null, url: url ? redactUrl(url) : null },
				{ tabId, url: url || undefined }
			);
		}
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
		// Iframe cross-origin berjalan di target terpisah: attach otomatis agar aksinya ikut terekam.
		await this._sendCommand(tabId, 'Target.setAutoAttach', {
			autoAttach: true,
			waitForDebuggerOnStart: false,
			flatten: true,
			filter: [{ type: 'iframe' }]
		}).catch(() => {});

		if (this._options?.recordVideo !== false) {
			await this._sendCommand(tabId, 'Page.startScreencast', {
				format: 'jpeg',
				quality: 75,
				maxWidth: 1280,
				maxHeight: 720,
				everyNthFrame: 1
			}).catch(() => {});
		}
	}

	async detachTab(tabId: number): Promise<void> {
		if (!this._attachedTabs.has(tabId)) return;
		this._attachedTabs.delete(tabId);
		await this._sendCommand(tabId, 'Page.stopScreencast').catch(() => {});
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
		const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab?: chrome.tabs.Tab) => {
			// Judul/URL tab aktif berubah: perbarui label overlay video (bukan perpindahan tab).
			if (tabId === this._activeTabId && (changeInfo.title !== undefined || changeInfo.url !== undefined) && tab)
				this.setActiveTab(tabId, tab);
			if (changeInfo.groupId === undefined) return;
			void this._reconcileGroup().then(() => {
				if (tab?.active && this._attachedTabs.has(tabId)) this.setActiveTab(tabId, tab);
			});
		};
		const onRemoved = (tabId: number) => {
			void this.detachTab(tabId);
			if (tabId === this._activeTabId) void this._pickActiveTab();
		};
		const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
			// Tab baru (mis. target=_blank) bisa aktif sebelum sempat di-attach: reconcile dulu.
			const ready = this._attachedTabs.has(info.tabId) ? Promise.resolve() : this._reconcileGroup();
			void ready.then(() => {
				if (!this._attachedTabs.has(info.tabId)) return;
				chrome.tabs.get(info.tabId, (tab) => {
					void chrome.runtime.lastError;
					this.setActiveTab(info.tabId, tab);
				});
			});
		};
		// Tab yang dibuka dari tab group lahir langsung di group (tanpa onUpdated groupId).
		const onCreated = (tab: chrome.tabs.Tab) => {
			if (tab.groupId !== this._options?.recordingGroupId || typeof tab.id !== 'number') return;
			const tabId = tab.id;
			void this._reconcileGroup().then(() => {
				if (tab.active && this._attachedTabs.has(tabId)) this.setActiveTab(tabId, tab);
			});
		};
		const onDebuggerEvent = (source: chrome.debugger.DebuggerSession, method: string, params?: object) => {
			if (typeof source.tabId !== 'number' || !this._attachedTabs.has(source.tabId)) return;
			void this._onDebuggerEvent(source.tabId, method, (params ?? {}) as Record<string, unknown>, source.sessionId);
		};
		const onDebuggerDetach = (source: chrome.debugger.Debuggee) => {
			if (typeof source.tabId === 'number') this._attachedTabs.delete(source.tabId);
		};

		chrome.tabs.onUpdated.addListener(onUpdated);
		chrome.tabs.onRemoved.addListener(onRemoved);
		chrome.tabs.onActivated.addListener(onActivated);
		chrome.tabs.onCreated.addListener(onCreated);
		chrome.debugger.onEvent.addListener(onDebuggerEvent);
		chrome.debugger.onDetach.addListener(onDebuggerDetach);

		this._listeners.add(() => chrome.tabs.onUpdated.removeListener(onUpdated));
		this._listeners.add(() => chrome.tabs.onRemoved.removeListener(onRemoved));
		this._listeners.add(() => chrome.tabs.onActivated.removeListener(onActivated));
		this._listeners.add(() => chrome.tabs.onCreated.removeListener(onCreated));
		this._listeners.add(() => chrome.debugger.onEvent.removeListener(onDebuggerEvent));
		this._listeners.add(() => chrome.debugger.onDetach.removeListener(onDebuggerDetach));
	}

	/** Tab aktif tertutup/keluar group: pilih tab group lain (utamakan yang aktif di jendelanya). */
	private async _pickActiveTab(): Promise<void> {
		if (!this._options) return;
		const tabs = filterRecordableTabs(await chrome.tabs.query({}), this._options.recordingGroupId)
			.filter((tab) => typeof tab.id === 'number' && this._attachedTabs.has(tab.id));
		const next = tabs.find((tab) => tab.active) ?? tabs[0];
		if (typeof next?.id === 'number') this.setActiveTab(next.id, next);
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
		if (this._activeTabId !== null && removed.includes(this._activeTabId)) await this._pickActiveTab();
	}

	private async _onDebuggerEvent(
		tabId: number,
		method: string,
		params: Record<string, unknown>,
		sessionId?: string
	): Promise<void> {
		// requestId hanya unik per target: beri namespace untuk event jaringan dari iframe (child session).
		if (sessionId && method.startsWith('Network.') && typeof params.requestId === 'string') {
			params = { ...params, requestId: `${sessionId}:${params.requestId}` };
		}
		switch (method) {
			case 'Target.attachedToTarget':
				await this._onAttachedToTarget(tabId, params, sessionId);
				break;
			case 'Target.detachedFromTarget':
				if (typeof params.sessionId === 'string') this._frameOwnerLocators.delete(params.sessionId);
				break;
			case 'Runtime.bindingCalled':
				this._onBindingCalled(tabId, params, sessionId);
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
				// Navigasi di dalam iframe (child session) bukan langkah tester.
				if (!sessionId) this._onFrameNavigated(tabId, params);
				break;
			case 'Page.screencastFrame':
				this._onScreencastFrame(tabId, params);
				break;
			default:
				break;
		}
	}

	/** Pasang capture script & binding di iframe cross-origin, lalu cari locator <iframe> pemiliknya. */
	private async _onAttachedToTarget(tabId: number, params: Record<string, unknown>, parentSessionId?: string): Promise<void> {
		const childSessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
		const targetInfo = (params.targetInfo ?? {}) as { type?: string; targetId?: string };
		if (!childSessionId || targetInfo.type !== 'iframe') return;

		const send = (method: string, args: Record<string, unknown> = {}) => this._sendCommand(tabId, method, args, childSessionId).catch(() => undefined);
		const script = actionCaptureScript();
		await send('Runtime.enable');
		await send('Network.enable');
		await send('Runtime.addBinding', { name: ACTION_BINDING_NAME });
		await send('Page.addScriptToEvaluateOnNewDocument', { source: script });
		await send('Runtime.evaluate', { expression: script });
		await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true, filter: [{ type: 'iframe' }] });

		const ownerLocators = targetInfo.targetId ? await this._resolveFrameOwner(tabId, targetInfo.targetId, parentSessionId) : null;
		if (ownerLocators) {
			const parentChain = parentSessionId ? this._frameOwnerLocators.get(parentSessionId) ?? [] : [];
			this._frameOwnerLocators.set(childSessionId, [...parentChain, ownerLocators]);
		}
	}

	/** Locator terbaik elemen <iframe> pemilik frame, dihitung engine di dokumen induk. */
	private async _resolveFrameOwner(tabId: number, frameId: string, parentSessionId?: string): Promise<string | null> {
		try {
			await this._sendCommand(tabId, 'DOM.enable', {}, parentSessionId).catch(() => undefined);
			const owner = await this._sendCommand<{ backendNodeId?: number }>(tabId, 'DOM.getFrameOwner', { frameId }, parentSessionId);
			if (!owner?.backendNodeId) return null;
			const resolved = await this._sendCommand<{ object?: { objectId?: string } }>(
				tabId,
				'DOM.resolveNode',
				{ backendNodeId: owner.backendNodeId },
				parentSessionId
			);
			const objectId = resolved?.object?.objectId;
			if (!objectId) return null;
			const described = await this._sendCommand<{ result?: { value?: LocatorCandidate[] } }>(
				tabId,
				'Runtime.callFunctionOn',
				{
					objectId,
					functionDeclaration: 'function () { return window.__knittoLocator ? window.__knittoLocator.describeCandidates(this) : []; }',
					returnByValue: true
				},
				parentSessionId
			);
			const candidates = described?.result?.value ?? [];
			return candidates.length > 0 ? rankCandidates(candidates).locators[0] : null;
		} catch {
			return null;
		}
	}

	private _onScreencastFrame(tabId: number, params: Record<string, unknown>): void {
		const sessionId = params.sessionId as number;
		if (typeof sessionId === 'number') {
			this._sendCommand(tabId, 'Page.screencastFrameAck', { sessionId }).catch(() => {});
		}
		if (typeof params.data === 'string') this._postToOffscreen({ type: 'OFFSCREEN_ADD_FRAME', tabId, data: params.data });
	}

	private _postToOffscreen(message: Record<string, unknown>): void {
		try {
			chrome.runtime.sendMessage({ target: 'offscreen', ...message }, () => {
				void chrome.runtime.lastError;
			});
		} catch {
			// Offscreen belum/tidak ada (rekaman tanpa video).
		}
	}

	private _enqueue(type: RecordingEventType, payload: Record<string, unknown>, extra: { tabId?: number; url?: string } = {}): number {
		return this._buffer.enqueue(createEventDraft(type, redactPayload(payload), {
			tabId: extra.tabId ?? null,
			url: extra.url ? redactUrl(extra.url) : null
		})).sequence;
	}

	private _onBindingCalled(tabId: number, params: Record<string, unknown>, sessionId?: string): void {
		if (params.name !== ACTION_BINDING_NAME || typeof params.payload !== 'string') return;
		let parsed: {
			action?: string;
			element?: ElementDescriptor;
			value?: string | null;
			checked?: boolean;
			selectedText?: string;
			key?: string;
			value_redacted?: boolean;
			pageUrl?: string;
			target?: ElementDescriptor;
			frames?: LocatorCandidate[][];
			crossOriginFrame?: boolean;
			files?: unknown[];
			upload_ref?: string;
			last?: boolean;
		};
		try {
			parsed = JSON.parse(params.payload);
		} catch {
			return;
		}

		// Isi file upload: bukan langkah tester, diunggah sebagai artifact (base64 tidak masuk event).
		if (parsed.action === 'upload_data') {
			const sequence = parsed.upload_ref ? this._uploadSequences.get(parsed.upload_ref) : undefined;
			// Isi file datang satu per pesan; `last` menandai file terakhir langkah ini.
			if (parsed.upload_ref && parsed.last !== false) this._uploadSequences.delete(parsed.upload_ref);
			if (sequence !== undefined && Array.isArray(parsed.files)) void this._storeUploadFiles(sequence, parsed.files as UploadFileData[]);
			return;
		}

		if (
			parsed.element?.id === 'qa-knitto-fab-host' ||
			parsed.element?.cssPath?.includes('qa-knitto-fab-host') ||
			parsed.element?.testId?.startsWith('qa-knitto-')
		) {
			return;
		}

		const ranked = parsed.element?.candidates?.length ? rankCandidates(parsed.element.candidates) : null;
		const locators = ranked ? ranked.locators : parsed.element ? buildLocatorCandidates(parsed.element) : [];
		const sequence = this._enqueue(
			'action',
			{
				action: parsed.action ?? 'unknown',
				locators,
				locator_specs: ranked?.specs ?? null,
				unique_locator: ranked?.uniqueLocator ?? null,
				ambiguous: ranked ? ranked.ambiguous : null,
				element: parsed.element ?? null,
				value: parsed.value ?? null,
				checked: parsed.checked,
				selectedText: parsed.selectedText,
				key: parsed.key,
				value_redacted: parsed.value_redacted === true,
				...this._extraActionFields(parsed, sessionId)
			},
			// URL halaman saat aksi terjadi → codegen bisa membuat goto awal walau rekaman dimulai di halaman terbuka.
			{ tabId, url: typeof parsed.pageUrl === 'string' ? parsed.pageUrl : undefined }
		);
		if (parsed.action === 'upload' && typeof parsed.upload_ref === 'string') this._uploadSequences.set(parsed.upload_ref, sequence);

		void this._captureScreenshot(tabId);
	}

	/** Field tambahan aksi: rantai locator iframe, target drag, dan nama file upload. */
	private _extraActionFields(
		parsed: { target?: ElementDescriptor; frames?: LocatorCandidate[][]; files?: unknown[] },
		sessionId?: string
	): Record<string, unknown> {
		const extra: Record<string, unknown> = {};
		const sameOriginFrames = parsed.frames?.map((candidates) => rankCandidates(candidates).locators[0]).filter(Boolean) ?? [];
		const ownerChain = sessionId ? this._frameOwnerLocators.get(sessionId) ?? [] : [];
		const frameLocators = [...ownerChain, ...sameOriginFrames];
		if (frameLocators.length > 0) extra.frame_locators = frameLocators;
		if (parsed.target) {
			const rankedTarget = parsed.target.candidates?.length ? rankCandidates(parsed.target.candidates) : null;
			extra.target_locators = rankedTarget ? rankedTarget.locators : buildLocatorCandidates(parsed.target);
			extra.target_unique_locator = rankedTarget?.uniqueLocator ?? null;
		}
		if (Array.isArray(parsed.files)) extra.files = parsed.files.filter((name): name is string => typeof name === 'string').slice(0, 20);
		return extra;
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
		const responseHeaders = response.headers as Record<string, string> | undefined;
		pending.responseContentType = responseHeaders?.['Content-Type'] ?? responseHeaders?.['content-type'] ?? null;
		pending.requestId = extractRequestId(responseHeaders);
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
				request_id: pending.requestId ?? null,
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
		// Navigasi iframe (iklan, analytics, about:blank) bukan langkah tester.
		if (frame.parentId) return;
		this._enqueue(
			'action',
			{ action: 'navigation', locators: [], url: frame.url ?? null },
			{ tabId, url: String(frame.url ?? '') }
		);
	}

	/**
	 * Unggah file yang dipilih tester sebagai artifact `test_data_file` (presign → PUT → complete) dengan
	 * `sequence` event upload, sehingga re-run bisa memasang file yang sama. File `stored: false` dilewati.
	 */
	private async _storeUploadFiles(sequence: number, files: UploadFileData[]): Promise<void> {
		const options = this._options;
		const api = this._api;
		if (!options || !api) return;
		for (const file of files) {
			if (typeof file?.data !== 'string' || file.stored === false) continue;
			try {
				const contentType = file.type || 'application/octet-stream';
				const blob = new Blob([base64ToBytes(file.data) as BlobPart], { type: contentType });
				const presign = await api.presignArtifactUpload(options.idSession, {
					kind: 'test_data_file',
					content_type: contentType,
					size_bytes: blob.size,
					sequence,
					file_name: file.name
				});
				await api.uploadToPresignedUrl(presign.upload_url, blob, contentType);
				await api.completeArtifactUpload(options.idSession, presign.artifact.id_artifact, { size_bytes: blob.size });
			} catch (error) {
				// Re-run akan meminta file pengganti untuk langkah ini.
				debugLog(`Gagal menyimpan file test data ${file.name}:`, error);
			}
		}
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
			const msg = (error as Error).message || '';
			if (!msg.includes('Detached') && !msg.includes('not attached')) {
				debugLog('Gagal mengambil/mengunggah screenshot:', error);
			}
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
		params: Record<string, unknown> = {},
		sessionId?: string
	): Promise<T> {
		const debuggee: chrome.debugger.DebuggerSession = sessionId ? { tabId, sessionId } : { tabId };
		return new Promise<T>((resolve, reject) => {
			chrome.debugger.sendCommand(debuggee, method, params, (result) => {
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
