import {
	FAB_SETTINGS_DEFAULTS,
	parseFabSettings,
	type FabSettings
} from './fab-state';

export const FAB_SETTINGS_KEY = 'qa_fab_settings';
export const FAB_INTENT_KEY = 'qa_fab_intent';

export const loadFabSettings = async (): Promise<FabSettings> => {
	const stored = await chrome.storage.local.get(FAB_SETTINGS_KEY);
	return parseFabSettings(stored[FAB_SETTINGS_KEY] ?? FAB_SETTINGS_DEFAULTS);
};

export const saveFabSettings = async (settings: FabSettings): Promise<void> => {
	await chrome.storage.local.set({ [FAB_SETTINGS_KEY]: settings });
};

export const setFabOpenIntent = async (intent: string): Promise<void> => {
	await chrome.storage.local.set({ [FAB_INTENT_KEY]: intent });
};

export const readAndClearFabIntent = async (): Promise<string | null> => {
	const stored = await chrome.storage.local.get(FAB_INTENT_KEY);
	const intent = (stored[FAB_INTENT_KEY] as string | undefined) ?? null;
	if (intent) await chrome.storage.local.remove(FAB_INTENT_KEY);
	return intent;
};