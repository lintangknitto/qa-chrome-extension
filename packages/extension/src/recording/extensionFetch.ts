/**
 * Extension Fetch Bridge
 *
 * Automatically proxies HTTP/HTTPS requests from content scripts (FAB UI)
 * through the background service worker to completely bypass browser Mixed Content
 * restrictions (e.g. accessing http:// backend API from https:// host web pages)
 * and CORS boundaries.
 */

export const isExtensionContextValid = (): boolean => {
	try {
		if (typeof chrome === 'undefined' || !chrome.runtime) return false;
		const id = chrome.runtime.id;
		if (typeof id === 'string' && id.length > 0) return true;
		return typeof chrome.runtime.sendMessage === 'function';
	} catch {
		return false;
	}
};

const isContentScriptContext = (): boolean => {
	try {
		if (typeof window === 'undefined') return false;
		const protocol = window.location?.protocol;
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
};

export async function extensionFetch(
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<Response> {
	// If not in a content script (e.g. in background service worker, extension page, or node/vitest tests),
	// use native globalThis.fetch directly.
	if (!isContentScriptContext() || !isExtensionContextValid() || typeof chrome.runtime?.sendMessage !== 'function') {
		return globalThis.fetch.call(globalThis, input, init);
	}

	const urlStr =
		typeof input === 'string'
			? input
			: input instanceof URL
				? input.href
				: typeof (input as Request).url === 'string'
					? (input as Request).url
					: String(input);

	// Data URLs, Blob URLs, and chrome-extension:// URLs can be loaded natively without mixed-content issues.
	if (
		urlStr.startsWith('data:') ||
		urlStr.startsWith('blob:') ||
		urlStr.startsWith('chrome-extension:')
	) {
		return globalThis.fetch.call(globalThis, input, init);
	}

	const method =
		init?.method ||
		(typeof input === 'object' && 'method' in input && (input as Request).method
			? (input as Request).method
			: 'GET');

	// Normalize headers into a plain record
	const headers: Record<string, string> = {};
	if (init?.headers) {
		if (init.headers instanceof Headers) {
			init.headers.forEach((value, key) => {
				headers[key] = value;
			});
		} else if (Array.isArray(init.headers)) {
			for (const [key, value] of init.headers) {
				headers[key] = value;
			}
		} else if (typeof init.headers === 'object') {
			Object.assign(headers, init.headers);
		}
	}

	let body: string | undefined;
	let bodyBase64: string | undefined;

	if (init?.body !== undefined && init?.body !== null) {
		if (typeof init.body === 'string') {
			body = init.body;
		} else if (init.body instanceof URLSearchParams) {
			body = init.body.toString();
		} else if (init.body instanceof Blob) {
			const arrayBuffer = await init.body.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			let binaryStr = '';
			for (let i = 0; i < uint8Array.length; i++) {
				binaryStr += String.fromCharCode(uint8Array[i]);
			}
			bodyBase64 = btoa(binaryStr);
		} else if (init.body instanceof ArrayBuffer) {
			const uint8Array = new Uint8Array(init.body);
			let binaryStr = '';
			for (let i = 0; i < uint8Array.length; i++) {
				binaryStr += String.fromCharCode(uint8Array[i]);
			}
			bodyBase64 = btoa(binaryStr);
		}
	}

	try {
		const response = await new Promise<{
			success: boolean;
			status?: number;
			statusText?: string;
			ok?: boolean;
			headers?: [string, string][];
			body?: string;
			error?: string;
		}>((resolve, reject) => {
			try {
				chrome.runtime.sendMessage(
					{
						type: 'api:request',
						url: urlStr,
						method,
						headers,
						body,
						bodyBase64
					},
					(res) => {
						if (chrome.runtime.lastError) {
							return reject(new Error(chrome.runtime.lastError.message));
						}
						resolve(res);
					}
				);
			} catch (sendErr) {
				reject(sendErr);
			}
		});

		if (!response || response.success === false) {
			throw new TypeError(response?.error || `Request failed via background proxy: ${urlStr}`);
		}

		const responseHeaders = new Headers();
		if (response.headers) {
			for (const [key, value] of response.headers) {
				responseHeaders.append(key, value);
			}
		}

		return new Response(response.body ?? '', {
			status: response.status ?? 200,
			statusText: response.statusText ?? 'OK',
			headers: responseHeaders
		});
	} catch (err) {
		// Fallback to direct fetch if message proxying encountered an error
		try {
			return await globalThis.fetch.call(globalThis, input, init);
		} catch {
			throw err;
		}
	}
}
