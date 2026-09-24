export interface StoredUser {
	id_user: number;
	username: string;
	nama: string;
	level?: string;
}

export interface StoredActiveSession {
	id_session: number;
	id_project?: number | null;
	id_test_case?: number | null;
	test_case_no: string;
	title: string;
	group_id: number | null;
	last_sequence: number;
	started_at?: number;
	expected_result?: string | null;
}

const TOKEN_KEY = 'qa_recording_token';
const USER_KEY = 'qa_recording_user';
const BASE_URL_KEY = 'qa_recording_base_url';
const ACTIVE_SESSION_KEY = 'qa_recording_active_session';

const area = (): chrome.storage.StorageArea | null => {
	try {
		if (typeof chrome !== 'undefined' && chrome.storage?.local) {
			return chrome.storage.local;
		}
	} catch {
		// Extension context invalidated
	}
	return null;
};

export const saveAuth = async (token: string, user: StoredUser): Promise<void> => {
	try {
		const storage = area();
		if (storage) {
			await storage.set({ [TOKEN_KEY]: token, [USER_KEY]: user });
		}
	} catch (err) {
		console.warn('tokenStore: saveAuth failed', err);
	}
};

export const getToken = async (): Promise<string | null> => {
	try {
		const storage = area();
		if (storage) {
			const stored = await storage.get(TOKEN_KEY);
			return (stored[TOKEN_KEY] as string | undefined) ?? null;
		}
	} catch (err) {
		console.warn('tokenStore: getToken failed', err);
	}
	return null;
};

export const getUser = async (): Promise<StoredUser | null> => {
	try {
		const storage = area();
		if (storage) {
			const stored = await storage.get(USER_KEY);
			return (stored[USER_KEY] as StoredUser | undefined) ?? null;
		}
	} catch (err) {
		console.warn('tokenStore: getUser failed', err);
	}
	return null;
};

export const clearAuth = async (): Promise<void> => {
	try {
		const storage = area();
		if (storage) {
			await storage.remove([TOKEN_KEY, USER_KEY]);
		}
	} catch (err) {
		console.warn('tokenStore: clearAuth failed', err);
	}
};

export const setBaseUrl = async (baseUrl: string): Promise<void> => {
	try {
		const storage = area();
		if (storage) {
			await storage.set({ [BASE_URL_KEY]: baseUrl });
		}
	} catch (err) {
		console.warn('tokenStore: setBaseUrl failed', err);
	}
};

export const getBaseUrl = async (): Promise<string | null> => {
	try {
		const storage = area();
		if (storage) {
			const stored = await storage.get(BASE_URL_KEY);
			return (stored[BASE_URL_KEY] as string | undefined) ?? null;
		}
	} catch (err) {
		console.warn('tokenStore: getBaseUrl failed', err);
	}
	return null;
};

export const setActiveSession = async (session: StoredActiveSession): Promise<void> => {
	try {
		const storage = area();
		if (storage) {
			await storage.set({ [ACTIVE_SESSION_KEY]: session });
		}
	} catch (err) {
		console.warn('tokenStore: setActiveSession failed', err);
	}
};

export const getActiveSession = async (): Promise<StoredActiveSession | null> => {
	try {
		const storage = area();
		if (storage) {
			const stored = await storage.get(ACTIVE_SESSION_KEY);
			return (stored[ACTIVE_SESSION_KEY] as StoredActiveSession | undefined) ?? null;
		}
	} catch (err) {
		console.warn('tokenStore: getActiveSession failed', err);
	}
	return null;
};

export const clearActiveSession = async (): Promise<void> => {
	try {
		const storage = area();
		if (storage) {
			await storage.remove(ACTIVE_SESSION_KEY);
		}
	} catch (err) {
		console.warn('tokenStore: clearActiveSession failed', err);
	}
};
