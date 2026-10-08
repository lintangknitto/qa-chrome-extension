import {
	FAB_SETTINGS_DEFAULTS,
	parseFabSettings,
	type FabSettings
} from './fab-state';

export const FAB_SETTINGS_KEY = 'qa_fab_settings';

export const loadFabSettings = async (): Promise<FabSettings> => {
	try {
		if (typeof chrome !== 'undefined' && chrome.storage?.local) {
			const stored = await chrome.storage.local.get([FAB_SETTINGS_KEY, 'qa_recording_base_url']);
			const parsed = parseFabSettings(stored[FAB_SETTINGS_KEY] ?? FAB_SETTINGS_DEFAULTS);
			if (typeof stored.qa_recording_base_url === 'string') {
				parsed.initialBaseUrl = stored.qa_recording_base_url;
			}
			return parsed;
		}
	} catch (err) {
		console.warn('loadFabSettings failed:', err);
	}
	return FAB_SETTINGS_DEFAULTS;
};

export const saveFabSettings = async (settings: FabSettings): Promise<void> => {
	try {
		if (typeof chrome !== 'undefined' && chrome.storage?.local) {
			await chrome.storage.local.set({ [FAB_SETTINGS_KEY]: settings });
		}
	} catch (err) {
		console.warn('saveFabSettings failed:', err);
	}
};