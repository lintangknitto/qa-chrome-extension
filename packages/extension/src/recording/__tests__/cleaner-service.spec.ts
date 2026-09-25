import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	parseTabDomain,
	sendCleanerMessage,
	requestHardReload,
	requestClearCookies,
	requestClearStorageAndCache,
	requestCleanAll
} from '../cleanerService';

describe('cleanerService — parseTabDomain', () => {
	it('menolak URL yang tidak terdefinisi, kosong, atau hanya spasi', () => {
		const resUndefined = parseTabDomain(undefined);
		expect(resUndefined).toEqual({
			rawUrl: '',
			origin: '',
			hostname: '',
			isRestricted: true,
			restrictedReason: 'Tidak ada URL tab yang terdeteksi'
		});

		const resEmpty = parseTabDomain('');
		expect(resEmpty.isRestricted).toBe(true);
		expect(resEmpty.restrictedReason).toBe('Tidak ada URL tab yang terdeteksi');

		const resWhitespace = parseTabDomain('   ');
		expect(resWhitespace.isRestricted).toBe(true);
		expect(resWhitespace.restrictedReason).toBe('Tidak ada URL tab yang terdeteksi');

		// @ts-expect-error test non-string type safety
		const resNonString = parseTabDomain(12345);
		expect(resNonString.isRestricted).toBe(true);
	});

	it('mendeteksi dan memblokir protokol sistem internal browser', () => {
		const restrictedUrls = [
			{ url: 'chrome://settings', expectedHost: 'chrome:' },
			{ url: 'chrome-extension://abcdef123456/popup.html', expectedHost: 'chrome-extension:' },
			{ url: 'chrome-untrusted://terminal', expectedHost: 'chrome-untrusted:' },
			{ url: 'devtools://devtools/bundled/inspector.html', expectedHost: 'devtools:' },
			{ url: 'edge://settings/profiles', expectedHost: 'edge:' },
			{ url: 'about:blank', expectedHost: 'about:blank' },
			{ url: 'view-source:https://portal.knitto.co.id', expectedHost: 'view-source:https:' },
			{ url: 'data:text/html,<h1>Test</h1>', expectedHost: 'data:text' }
		];

		for (const item of restrictedUrls) {
			const res = parseTabDomain(item.url);
			expect(res.isRestricted).toBe(true);
			expect(res.restrictedReason).toBe('Halaman sistem browser tidak dapat dibersihkan');
			expect(res.rawUrl).toBe(item.url);
		}
	});

	it('memparsing URL standar HTTP/HTTPS dengan domain dan subdomain secara valid', () => {
		const res = parseTabDomain('https://portal.knitto.co.id/orders/123?filter=all#summary');
		expect(res).toEqual({
			rawUrl: 'https://portal.knitto.co.id/orders/123?filter=all#summary',
			origin: 'https://portal.knitto.co.id',
			hostname: 'portal.knitto.co.id',
			isRestricted: false
		});
	});

	it('memparsing URL dengan port non-standar dan localhost', () => {
		const res = parseTabDomain('http://localhost:3000/app/dashboard');
		expect(res).toEqual({
			rawUrl: 'http://localhost:3000/app/dashboard',
			origin: 'http://localhost:3000',
			hostname: 'localhost',
			isRestricted: false
		});
	});

	it('memparsing URL dengan IP address lokal dan port', () => {
		const res = parseTabDomain('http://192.168.1.50:8080/portal');
		expect(res).toEqual({
			rawUrl: 'http://192.168.1.50:8080/portal',
			origin: 'http://192.168.1.50:8080',
			hostname: '192.168.1.50',
			isRestricted: false
		});
	});

	it('menangani string URL malformed secara aman tanpa melempar uncaught exception', () => {
		const res = parseTabDomain('://invalid-domain-string');
		expect(res.isRestricted).toBe(true);
		expect(res.restrictedReason).toBe('Format URL tidak valid');
		expect(res.origin).toBe('');
		expect(res.hostname).toBe('://invalid-domain-string');
	});
});

describe('cleanerService — sendCleanerMessage & request functions', () => {
	let originalChrome: unknown;

	beforeEach(() => {
		originalChrome = (globalThis as unknown as { chrome: unknown }).chrome;
		vi.restoreAllMocks();
	});

	afterEach(() => {
		(globalThis as unknown as { chrome: unknown }).chrome = originalChrome;
	});

	it('mengembalikan error jika chrome.runtime tidak tersedia', async () => {
		(globalThis as unknown as { chrome: unknown }).chrome = undefined;
		const res = await sendCleanerMessage({ type: 'test' });
		expect(res).toEqual({
			success: false,
			error: 'Chrome extension runtime tidak tersedia.'
		});
	});

	it('mengembalikan error jika chrome.runtime.lastError terjadi', async () => {
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: {
				lastError: { message: 'Port closed before response received.' },
				sendMessage: vi.fn((_msg, cb) => {
					cb(undefined);
				})
			}
		};

		const res = await sendCleanerMessage({ type: 'cleaner:hardReload' });
		expect(res).toEqual({
			success: false,
			error: 'Port closed before response received.'
		});
	});

	it('mengembalikan error jika tidak ada respon dari background service worker', async () => {
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: {
				lastError: undefined,
				sendMessage: vi.fn((_msg, cb) => {
					cb(undefined);
				})
			}
		};

		const res = await sendCleanerMessage({ type: 'cleaner:hardReload' });
		expect(res).toEqual({
			success: false,
			error: 'Tidak ada respon dari background service worker.'
		});
	});

	it('mengembalikan hasil sukses saat service worker membalas respon valid', async () => {
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: {
				lastError: undefined,
				sendMessage: vi.fn((_msg, cb) => {
					cb({ success: true, count: 7 });
				})
			}
		};

		const res = await sendCleanerMessage<{ count: number }>({ type: 'cleaner:clearCookies' });
		expect(res).toEqual({
			success: true,
			count: 7
		});
	});

	it('menangkap error synchronous saat memanggil chrome.runtime.sendMessage', async () => {
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: {
				sendMessage: vi.fn(() => {
					throw new Error('Extension context invalidated.');
				})
			}
		};

		const res = await sendCleanerMessage({ type: 'cleaner:hardReload' });
		expect(res).toEqual({
			success: false,
			error: 'Extension context invalidated.'
		});
	});

	it('requestHardReload mengirim pesan cleaner:hardReload dengan tabId yang benar', async () => {
		const mockSendMessage = vi.fn((msg, cb) => {
			cb({ success: true });
		});
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: { sendMessage: mockSendMessage }
		};

		const res = await requestHardReload(42);
		expect(res.success).toBe(true);
		expect(mockSendMessage).toHaveBeenCalledWith(
			{ type: 'cleaner:hardReload', tabId: 42 },
			expect.any(Function)
		);
	});

	it('requestClearCookies mengirim pesan cleaner:clearCookies dengan url yang sesuai', async () => {
		const mockSendMessage = vi.fn((msg, cb) => {
			cb({ success: true, count: 3 });
		});
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: { sendMessage: mockSendMessage }
		};

		const res = await requestClearCookies('https://portal.knitto.co.id/checkout');
		expect(res.success).toBe(true);
		expect(mockSendMessage).toHaveBeenCalledWith(
			{ type: 'cleaner:clearCookies', url: 'https://portal.knitto.co.id/checkout' },
			expect.any(Function)
		);
	});

	it('requestClearStorageAndCache mengirim pesan cleaner:clearStorageAndCache dengan origin', async () => {
		const mockSendMessage = vi.fn((msg, cb) => {
			cb({ success: true });
		});
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: { sendMessage: mockSendMessage }
		};

		const res = await requestClearStorageAndCache('https://portal.knitto.co.id');
		expect(res.success).toBe(true);
		expect(mockSendMessage).toHaveBeenCalledWith(
			{ type: 'cleaner:clearStorageAndCache', origin: 'https://portal.knitto.co.id' },
			expect.any(Function)
		);
	});

	it('requestCleanAll mengirim pesan cleaner:cleanAll dengan url dan tabId', async () => {
		const mockSendMessage = vi.fn((msg, cb) => {
			cb({ success: true });
		});
		(globalThis as unknown as { chrome: unknown }).chrome = {
			runtime: { sendMessage: mockSendMessage }
		};

		const res = await requestCleanAll('https://portal.knitto.co.id/checkout', 99);
		expect(res.success).toBe(true);
		expect(mockSendMessage).toHaveBeenCalledWith(
			{ type: 'cleaner:cleanAll', url: 'https://portal.knitto.co.id/checkout', tabId: 99 },
			expect.any(Function)
		);
	});
});
