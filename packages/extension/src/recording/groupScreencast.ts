import { ListenerRegistry } from './listenerRegistry';

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const NO_GROUP = -1;

export const SCREENCAST_PARAMS = {
	format: 'jpeg',
	quality: 75,
	maxWidth: 1280,
	maxHeight: 720,
	everyNthFrame: 1
} as const;

export type OffscreenPoster = (message: Record<string, unknown>) => void;

export const postToOffscreen: OffscreenPoster = (message) => {
	try {
		chrome.runtime.sendMessage({ target: 'offscreen', ...message }, () => {
			void chrome.runtime.lastError;
		});
	} catch {
		// Offscreen belum ada.
	}
};

/**
 * Screencast CDP untuk video replay: semua tab di group tab replay (termasuk tab baru yang dibuka
 * replay, yang otomatis masuk group pembukanya) mengirim frame ke offscreen bersama `tabId`,
 * dan tab aktif dalam group menentukan frame yang digambar. Rekaman sesi memakai `RecordingController`.
 */
export class GroupScreencaster {
	private readonly _tabs = new Set<number>();
	private readonly _listeners = new ListenerRegistry();
	private _groupId = NO_GROUP;
	private _activeTabId: number | null = null;

	constructor(private readonly _post: OffscreenPoster = postToOffscreen) {}

	get activeTabId(): number | null {
		return this._activeTabId;
	}

	get attachedTabIds(): number[] {
		return [...this._tabs];
	}

	async start(tabId: number): Promise<void> {
		await this.stop();
		const tab = await chrome.tabs.get(tabId);
		this._groupId = typeof tab.groupId === 'number' ? tab.groupId : NO_GROUP;
		this._installListeners();
		await this._attach(tabId);
		this._setActive(tabId, tab);
		if (this._groupId !== NO_GROUP) {
			const groupTabs = await chrome.tabs.query({ groupId: this._groupId });
			for (const other of groupTabs) if (typeof other.id === 'number') await this._attach(other.id);
		}
	}

	async stop(): Promise<void> {
		this._listeners.removeAll();
		for (const tabId of [...this._tabs]) await this._detach(tabId);
		this._groupId = NO_GROUP;
		this._activeTabId = null;
	}

	private _setActive(tabId: number, tab?: Pick<chrome.tabs.Tab, 'title' | 'url'>): void {
		if (!this._tabs.has(tabId)) return;
		this._activeTabId = tabId;
		this._post({ type: 'OFFSCREEN_SET_ACTIVE_TAB', tabId, title: tab?.title ?? '', url: tab?.url ?? '' });
	}

	private _installListeners(): void {
		const onEvent = (source: chrome.debugger.DebuggerSession, method: string, params?: object) => {
			if (method !== 'Page.screencastFrame' || typeof source.tabId !== 'number' || !this._tabs.has(source.tabId)) return;
			const frame = (params ?? {}) as { sessionId?: number; data?: string };
			if (typeof frame.sessionId === 'number')
				chrome.debugger.sendCommand({ tabId: source.tabId }, 'Page.screencastFrameAck', { sessionId: frame.sessionId }, () => {
					void chrome.runtime.lastError;
				});
			if (typeof frame.data === 'string') this._post({ type: 'OFFSCREEN_ADD_FRAME', tabId: source.tabId, data: frame.data });
		};
		const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
			chrome.tabs.get(info.tabId, (tab) => {
				void chrome.runtime.lastError;
				if (!tab) return;
				// Tab baru di group replay bisa aktif sebelum di-attach.
				const inGroup = this._groupId !== NO_GROUP && tab.groupId === this._groupId;
				if (!this._tabs.has(info.tabId) && !inGroup) return;
				void this._attach(info.tabId).then(() => this._setActive(info.tabId, tab));
			});
		};
		const onCreated = (tab: chrome.tabs.Tab) => {
			if (this._groupId === NO_GROUP || tab.groupId !== this._groupId || typeof tab.id !== 'number') return;
			const tabId = tab.id;
			void this._attach(tabId).then(() => {
				if (tab.active) this._setActive(tabId, tab);
			});
		};
		const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
			if (this._groupId !== NO_GROUP && changeInfo.groupId !== undefined) {
				if (changeInfo.groupId === this._groupId) {
					void this._attach(tabId).then(() => {
						if (tab.active) this._setActive(tabId, tab);
					});
				} else if (this._tabs.has(tabId)) {
					void this._detach(tabId);
				}
				return;
			}
			if (tabId === this._activeTabId && (changeInfo.title !== undefined || changeInfo.url !== undefined)) this._setActive(tabId, tab);
		};
		const onRemoved = (tabId: number) => {
			this._tabs.delete(tabId);
		};
		const onDetach = (source: chrome.debugger.Debuggee) => {
			if (typeof source.tabId === 'number') this._tabs.delete(source.tabId);
		};

		chrome.debugger.onEvent.addListener(onEvent);
		chrome.debugger.onDetach.addListener(onDetach);
		chrome.tabs.onActivated.addListener(onActivated);
		chrome.tabs.onCreated.addListener(onCreated);
		chrome.tabs.onUpdated.addListener(onUpdated);
		chrome.tabs.onRemoved.addListener(onRemoved);
		this._listeners.add(() => chrome.debugger.onEvent.removeListener(onEvent));
		this._listeners.add(() => chrome.debugger.onDetach.removeListener(onDetach));
		this._listeners.add(() => chrome.tabs.onActivated.removeListener(onActivated));
		this._listeners.add(() => chrome.tabs.onCreated.removeListener(onCreated));
		this._listeners.add(() => chrome.tabs.onUpdated.removeListener(onUpdated));
		this._listeners.add(() => chrome.tabs.onRemoved.removeListener(onRemoved));
	}

	private async _attach(tabId: number): Promise<void> {
		if (this._tabs.has(tabId)) return;
		const attached = await new Promise<boolean>((resolve) => {
			chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => resolve(!chrome.runtime.lastError));
		});
		if (!attached) return;
		this._tabs.add(tabId);
		await new Promise<void>((resolve) => {
			chrome.debugger.sendCommand({ tabId }, 'Page.startScreencast', { ...SCREENCAST_PARAMS }, () => {
				void chrome.runtime.lastError;
				resolve();
			});
		});
	}

	private async _detach(tabId: number): Promise<void> {
		this._tabs.delete(tabId);
		await new Promise<void>((resolve) => {
			chrome.debugger.sendCommand({ tabId }, 'Page.stopScreencast', {}, () => {
				void chrome.runtime.lastError;
				chrome.debugger.detach({ tabId }, () => {
					void chrome.runtime.lastError;
					resolve();
				});
			});
		});
	}
}
