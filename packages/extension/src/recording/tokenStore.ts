export interface StoredUser {
	id_user: number;
	username: string;
	nama: string;
}

export interface StoredActiveSession {
	id_session: number;
	id_project: number;
	test_case_no: string;
	title: string;
	group_id: number | null;
	last_sequence: number;
}

const TOKEN_KEY = 'qa_recording_token';
const USER_KEY = 'qa_recording_user';
const BASE_URL_KEY = 'qa_recording_base_url';
const ACTIVE_SESSION_KEY = 'qa_recording_active_session';

const area = (): chrome.storage.StorageArea => chrome.storage.local;

export const saveAuth = async (token: string, user: StoredUser): Promise<void> => {
	await area().set({ [TOKEN_KEY]: token, [USER_KEY]: user });
};

export const getToken = async (): Promise<string | null> => {
	const stored = await area().get(TOKEN_KEY);
	return (stored[TOKEN_KEY] as string | undefined) ?? null;
};

export const getUser = async (): Promise<StoredUser | null> => {
	const stored = await area().get(USER_KEY);
	return (stored[USER_KEY] as StoredUser | undefined) ?? null;
};

export const clearAuth = async (): Promise<void> => {
	await area().remove([TOKEN_KEY, USER_KEY]);
};

export const setBaseUrl = async (baseUrl: string): Promise<void> => {
	await area().set({ [BASE_URL_KEY]: baseUrl });
};

export const getBaseUrl = async (): Promise<string | null> => {
	const stored = await area().get(BASE_URL_KEY);
	return (stored[BASE_URL_KEY] as string | undefined) ?? null;
};

export const setActiveSession = async (session: StoredActiveSession): Promise<void> => {
	await area().set({ [ACTIVE_SESSION_KEY]: session });
};

export const getActiveSession = async (): Promise<StoredActiveSession | null> => {
	const stored = await area().get(ACTIVE_SESSION_KEY);
	return (stored[ACTIVE_SESSION_KEY] as StoredActiveSession | undefined) ?? null;
};

export const clearActiveSession = async (): Promise<void> => {
	await area().remove(ACTIVE_SESSION_KEY);
};
