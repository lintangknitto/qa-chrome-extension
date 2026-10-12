import type { FabState } from './fab-state';

export type FabMessageToBackground =
	| { type: 'fab:getState' }
	| { type: 'checkpoint:context' };

export interface CheckpointContext {
	/** Sequence event terakhir saat checkpoint dibuat (null bila recorder tidak aktif). */
	sequence: number | null;
	tabId: number | null;
}

export const requestCheckpointContext = (): Promise<CheckpointContext> =>
	new Promise((resolve) => {
		const empty: CheckpointContext = { sequence: null, tabId: null };
		try {
			if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve(empty);
			chrome.runtime.sendMessage(
				{ type: 'checkpoint:context' } satisfies FabMessageToBackground,
				(response: Partial<CheckpointContext> | undefined) => {
					if (chrome.runtime?.lastError) return resolve(empty);
					resolve({
						sequence: typeof response?.sequence === 'number' ? response.sequence : null,
						tabId: typeof response?.tabId === 'number' ? response.tabId : null
					});
				}
			);
		} catch {
			resolve(empty);
		}
	});

export interface FabStateChanged {
	type: 'fab:stateChanged';
	state: FabState;
}

export const requestFabState = (): Promise<FabState> =>
	new Promise((resolve) => {
		try {
			if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
				return resolve({ recording: false, pendingEvents: 0 });
			}
			chrome.runtime.sendMessage(
				{ type: 'fab:getState' } satisfies FabMessageToBackground,
				(response: { recording?: boolean; pendingEvents?: number } | undefined) => {
					try {
						if (chrome.runtime?.lastError) return resolve({ recording: false, pendingEvents: 0 });
						resolve({
							recording: response?.recording === true,
							pendingEvents: Number(response?.pendingEvents ?? 0)
						});
					} catch {
						resolve({ recording: false, pendingEvents: 0 });
					}
				}
			);
		} catch {
			// Menangkap Extension context invalidated saat ekstensi di-reload
			resolve({ recording: false, pendingEvents: 0 });
		}
	});

export const isFabStateChanged = (message: unknown): message is FabStateChanged =>
	!!message &&
	typeof message === 'object' &&
	(message as { type?: string }).type === 'fab:stateChanged';