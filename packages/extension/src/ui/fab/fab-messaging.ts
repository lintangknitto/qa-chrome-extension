import type { FabIntent, FabState } from './fab-state';

export type FabMessageToBackground =
	| { type: 'fab:getState' }
	| { type: 'fab:openPanel'; intent: FabIntent };

export interface FabStateChanged {
	type: 'fab:stateChanged';
	state: FabState;
}

export const requestFabState = (): Promise<FabState> =>
	new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{ type: 'fab:getState' } satisfies FabMessageToBackground,
			(response: { recording?: boolean; pendingEvents?: number } | undefined) => {
				if (chrome.runtime.lastError) return resolve({ recording: false, pendingEvents: 0 });
				resolve({
					recording: response?.recording === true,
					pendingEvents: Number(response?.pendingEvents ?? 0)
				});
			}
		);
	});

export const openPanelWithIntent = (intent: FabIntent): Promise<boolean> =>
	new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{ type: 'fab:openPanel', intent } satisfies FabMessageToBackground,
			(response: { success?: boolean } | undefined) => {
				if (chrome.runtime.lastError) return resolve(false);
				resolve(response?.success === true);
			}
		);
	});

export const isFabStateChanged = (message: unknown): message is FabStateChanged =>
	!!message &&
	typeof message === 'object' &&
	(message as { type?: string }).type === 'fab:stateChanged';