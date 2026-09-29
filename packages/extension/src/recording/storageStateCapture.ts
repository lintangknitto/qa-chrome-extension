/**
 * Modul untuk menangkap snapshot browser state (Cookies, LocalStorage, SessionStorage)
 * dalam format standar Playwright StorageState.
 */

export interface PlaywrightCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	expires: number;
	httpOnly: boolean;
	secure: boolean;
	sameSite: 'Strict' | 'Lax' | 'None';
}

export interface StorageEntry {
	name: string;
	value: string;
}

export interface StorageOrigin {
	origin: string;
	localStorage: StorageEntry[];
	sessionStorage?: StorageEntry[];
}

export interface PlaywrightStorageState {
	cookies: PlaywrightCookie[];
	origins: StorageOrigin[];
	capturedAt?: string;
	phase?: 'initial' | 'final' | 'checkpoint';
}

/**
 * Mengonversi sameSite dari Chrome Cookie ke format Playwright.
 */
export const normalizeSameSite = (sameSite?: string): 'Strict' | 'Lax' | 'None' => {
	const lower = (sameSite || '').toLowerCase();
	if (lower === 'strict') return 'Strict';
	if (lower === 'lax') return 'Lax';
	return 'None';
};

/**
 * Menangkap cookies untuk target URL atau domain.
 */
export const captureCookiesForUrl = async (targetUrl: string): Promise<PlaywrightCookie[]> => {
	if (typeof chrome === 'undefined' || !chrome.cookies?.getAll) return [];
	try {
		const urlObj = new URL(targetUrl);
		const domain = urlObj.hostname;

		const [byUrl, byDomain] = await Promise.all([
			chrome.cookies.getAll({ url: targetUrl }).catch(() => [] as chrome.cookies.Cookie[]),
			chrome.cookies.getAll({ domain }).catch(() => [] as chrome.cookies.Cookie[])
		]);

		const cookieMap = new Map<string, chrome.cookies.Cookie>();
		for (const c of [...byUrl, ...byDomain]) {
			cookieMap.set(`${c.domain}:${c.path}:${c.name}:${c.storeId}`, c);
		}

		return Array.from(cookieMap.values()).map((c) => ({
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: c.path,
			expires: typeof c.expirationDate === 'number' ? Math.round(c.expirationDate) : -1,
			httpOnly: Boolean(c.httpOnly),
			secure: Boolean(c.secure),
			sameSite: normalizeSameSite(c.sameSite)
		}));
	} catch {
		return [];
	}
};

/**
 * Script in-page untuk mengekstrak localStorage & sessionStorage.
 */
export const extractStorageScript = (): string => `
(() => {
  try {
    const ls = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) ls.push({ name: key, value: localStorage.getItem(key) || '' });
    }
    const ss = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key !== null) ss.push({ name: key, value: sessionStorage.getItem(key) || '' });
    }
    return JSON.stringify({ localStorage: ls, sessionStorage: ss });
  } catch (err) {
    return JSON.stringify({ localStorage: [], sessionStorage: [] });
  }
})();
`;

/**
 * Menangkap storage dari tab via debugger Protocol atau scripting.
 */
export const captureStorageForTab = async (
	tabId: number,
	origin: string,
	sendCommand?: (tabId: number, method: string, params?: any) => Promise<any>
): Promise<StorageOrigin> => {
	const defaultResult: StorageOrigin = {
		origin,
		localStorage: [],
		sessionStorage: []
	};

	try {
		if (sendCommand) {
			const res = await sendCommand(tabId, 'Runtime.evaluate', {
				expression: extractStorageScript(),
				returnByValue: true
			});
			if (res?.result?.value) {
				const parsed = JSON.parse(res.result.value);
				return {
					origin,
					localStorage: Array.isArray(parsed.localStorage) ? parsed.localStorage : [],
					sessionStorage: Array.isArray(parsed.sessionStorage) ? parsed.sessionStorage : []
				};
			}
		} else if (typeof chrome !== 'undefined' && chrome.scripting?.executeScript) {
			const results = await chrome.scripting.executeScript({
				target: { tabId },
				func: () => {
					try {
						const ls: Array<{ name: string; value: string }> = [];
						for (let i = 0; i < localStorage.length; i++) {
							const key = localStorage.key(i);
							if (key !== null) ls.push({ name: key, value: localStorage.getItem(key) || '' });
						}
						const ss: Array<{ name: string; value: string }> = [];
						for (let i = 0; i < sessionStorage.length; i++) {
							const key = sessionStorage.key(i);
							if (key !== null) ss.push({ name: key, value: sessionStorage.getItem(key) || '' });
						}
						return { localStorage: ls, sessionStorage: ss };
					} catch {
						return { localStorage: [], sessionStorage: [] };
					}
				}
			});
			if (results?.[0]?.result) {
				const r = results[0].result;
				return {
					origin,
					localStorage: r.localStorage || [],
					sessionStorage: r.sessionStorage || []
				};
			}
		}
	} catch {
		// Fallback safe
	}

	return defaultResult;
};

/**
 * Menangkap full Browser Storage State (Cookies + LocalStorage + SessionStorage).
 */
export const captureBrowserStorageState = async (options: {
	targetUrl: string;
	tabId?: number;
	phase?: 'initial' | 'final' | 'checkpoint';
	sendCommand?: (tabId: number, method: string, params?: any) => Promise<any>;
}): Promise<PlaywrightStorageState> => {
	const { targetUrl, tabId, phase = 'final', sendCommand } = options;
	let cookies: PlaywrightCookie[] = [];
	let origins: StorageOrigin[] = [];

	if (targetUrl) {
		try {
			const urlObj = new URL(targetUrl);
			cookies = await captureCookiesForUrl(targetUrl);

			if (tabId && tabId > 0) {
				const originData = await captureStorageForTab(tabId, urlObj.origin, sendCommand);
				origins = [originData];
			} else {
				origins = [{ origin: urlObj.origin, localStorage: [], sessionStorage: [] }];
			}
		} catch {
			// Ignore URL parse error
		}
	}

	return {
		cookies,
		origins,
		capturedAt: new Date().toISOString(),
		phase
	};
};
