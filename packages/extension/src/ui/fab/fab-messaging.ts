import type { FabState } from './fab-state';

export type FabMessageToBackground =
	| { type: 'fab:getState' };

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