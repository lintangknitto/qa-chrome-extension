// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { base64ToBytes, bytesToBase64, extensionFetch, isBinaryContentType, isExtensionContextValid } from '../extensionFetch';

describe('extensionFetch', () => {
	const originalChrome = (globalThis as any).chrome;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		(globalThis as any).chrome = originalChrome;
		globalThis.fetch = originalFetch;
	});

	it('isExtensionContextValid returns false when chrome.runtime is missing', () => {
		(globalThis as any).chrome = undefined;
		expect(isExtensionContextValid()).toBe(false);
	});

	it('isExtensionContextValid returns true when chrome.runtime has valid id and sendMessage', () => {
		(globalThis as any).chrome = {
			runtime: {
				id: 'mock-extension-id',
				sendMessage: vi.fn()
			}
		};
		expect(isExtensionContextValid()).toBe(true);
	});

	it('calls globalThis.fetch directly for blob: and data: URLs', async () => {
		const mockFetch = vi.fn().mockResolvedValue(new Response('data content'));
		globalThis.fetch = mockFetch;

		(globalThis as any).chrome = {
			runtime: {
				id: 'mock-id',
				sendMessage: vi.fn()
			}
		};

		const res = await extensionFetch('data:text/plain;base64,SGVsbG8=');
		expect(mockFetch).toHaveBeenCalledWith('data:text/plain;base64,SGVsbG8=', undefined);
		expect(await res.text()).toBe('data content');
	});

	it('proxies HTTP request via chrome.runtime.sendMessage when running in content script context', async () => {
		// Mock content script window.location
		const originalLocation = window.location;
		delete (window as any).location;
		(window as any).location = { protocol: 'https:', href: 'https://portal.knitto.org/dashboard' };

		const mockSendMessage = vi.fn((message, callback) => {
			if (message.type === 'api:request') {
				callback({
					success: true,
					status: 200,
					statusText: 'OK',
					headers: [['content-type', 'application/json']],
					body: JSON.stringify({ result: { items: [{ id_project: 1, name: 'Knitto Portal' }] } })
				});
			}
		});

		(globalThis as any).chrome = {
			runtime: {
				id: 'mock-id',
				sendMessage: mockSendMessage
			}
		};

		try {
			const res = await extensionFetch('http://192.168.21.38:8010/projects/active', {
				method: 'GET',
				headers: { Accept: 'application/json', Authorization: 'Bearer token-123' }
			});

			expect(mockSendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'api:request',
					url: 'http://192.168.21.38:8010/projects/active',
					method: 'GET',
					headers: {
						Accept: 'application/json',
						Authorization: 'Bearer token-123'
					}
				}),
				expect.any(Function)
			);

			expect(res.status).toBe(200);
			expect(res.ok).toBe(true);
			const data = await res.json();
			expect(data.result.items[0].name).toBe('Knitto Portal');
		} finally {
			(window as any).location = originalLocation;
		}
	});

	it('throws error when background proxy returns success: false', async () => {
		const originalLocation = window.location;
		delete (window as any).location;
		(window as any).location = { protocol: 'https:', href: 'https://portal.knitto.org/dashboard' };

		const mockSendMessage = vi.fn((_message, callback) => {
			callback({
				success: false,
				error: 'Network connection refused'
			});
		});

		(globalThis as any).chrome = {
			runtime: {
				id: 'mock-id',
				sendMessage: mockSendMessage
			}
		};

		// Also mock fallback fetch to fail
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

		try {
			await expect(
				extensionFetch('http://192.168.21.38:8010/sessions')
			).rejects.toThrow(/Network connection refused/);
		} finally {
			(window as any).location = originalLocation;
		}
	});
	it('isBinaryContentType: xlsx/pdf/octet-stream biner, JSON/teks bukan', () => {
		expect(isBinaryContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
		expect(isBinaryContentType('application/octet-stream')).toBe(true);
		expect(isBinaryContentType('application/json; charset=utf-8')).toBe(false);
		expect(isBinaryContentType('text/html')).toBe(false);
		expect(isBinaryContentType('application/problem+json')).toBe(false);
		expect(isBinaryContentType(null)).toBe(false);
	});

	it('respons biner dari background (bodyBase64) dikembalikan byte-per-byte utuh', async () => {
		const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x7f]);
		expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));

		const originalLocation = window.location;
		delete (window as any).location;
		(window as any).location = { protocol: 'https:', href: 'https://portal.knitto.org/dashboard' };
		(globalThis as any).chrome = {
			runtime: {
				id: 'mock-id',
				sendMessage: vi.fn((_message: unknown, callback: (res: unknown) => void) => {
					callback({
						success: true,
						status: 200,
						headers: [['content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
						bodyBase64: bytesToBase64(bytes)
					});
				})
			}
		};
		try {
			const response = await extensionFetch('http://10.0.0.5:8010/projects/1/test-cases/export');
			expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(bytes));
		} finally {
			(window as any).location = originalLocation;
		}
	});
});
