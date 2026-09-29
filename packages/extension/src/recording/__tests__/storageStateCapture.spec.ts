import { describe, expect, it, vi } from 'vitest';
import {
	captureBrowserStorageState,
	captureCookiesForUrl,
	captureStorageForTab,
	normalizeSameSite
} from '../storageStateCapture';

describe('storageStateCapture', () => {
	it('normalizeSameSite returns Strict, Lax, or None properly', () => {
		expect(normalizeSameSite('strict')).toBe('Strict');
		expect(normalizeSameSite('STRICT')).toBe('Strict');
		expect(normalizeSameSite('lax')).toBe('Lax');
		expect(normalizeSameSite('no_restriction')).toBe('None');
		expect(normalizeSameSite(undefined)).toBe('None');
	});

	it('captureCookiesForUrl maps Chrome cookies to Playwright cookie format', async () => {
		const mockCookies = [
			{
				name: 'auth_token',
				value: 'secret123',
				domain: 'example.com',
				path: '/',
				expirationDate: 1735689600,
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				storeId: '0'
			}
		];

		(globalThis as any).chrome = {
			cookies: {
				getAll: vi.fn().mockResolvedValue(mockCookies)
			}
		};

		const cookies = await captureCookiesForUrl('https://example.com/dashboard');
		expect(cookies.length).toBe(1);
		expect(cookies[0].name).toBe('auth_token');
		expect(cookies[0].value).toBe('secret123');
		expect(cookies[0].httpOnly).toBe(true);
		expect(cookies[0].secure).toBe(true);
		expect(cookies[0].sameSite).toBe('Lax');
	});

	it('captureStorageForTab extracts localStorage and sessionStorage using sendCommand', async () => {
		const mockSendCommand = vi.fn().mockResolvedValue({
			result: {
				value: JSON.stringify({
					localStorage: [{ name: 'user_theme', value: 'dark' }],
					sessionStorage: [{ name: 'current_step', value: '2' }]
				})
			}
		});

		const storage = await captureStorageForTab(123, 'https://example.com', mockSendCommand);
		expect(storage.origin).toBe('https://example.com');
		expect(storage.localStorage).toEqual([{ name: 'user_theme', value: 'dark' }]);
		expect(storage.sessionStorage).toEqual([{ name: 'current_step', value: '2' }]);
	});

	it('captureBrowserStorageState combines cookies and origin storage', async () => {
		(globalThis as any).chrome = {
			cookies: {
				getAll: vi.fn().mockResolvedValue([
					{
						name: 'session_id',
						value: 'abc999',
						domain: 'knitto.test',
						path: '/',
						expirationDate: 1735689600,
						httpOnly: false,
						secure: true,
						sameSite: 'strict',
						storeId: '0'
					}
				])
			}
		};

		const mockSendCommand = vi.fn().mockResolvedValue({
			result: {
				value: JSON.stringify({
					localStorage: [{ name: 'cart_count', value: '5' }],
					sessionStorage: []
				})
			}
		});

		const state = await captureBrowserStorageState({
			targetUrl: 'https://knitto.test/shop',
			tabId: 10,
			phase: 'initial',
			sendCommand: mockSendCommand
		});

		expect(state.phase).toBe('initial');
		expect(state.cookies.length).toBe(1);
		expect(state.cookies[0].name).toBe('session_id');
		expect(state.origins.length).toBe(1);
		expect(state.origins[0].origin).toBe('https://knitto.test');
		expect(state.origins[0].localStorage).toEqual([{ name: 'cart_count', value: '5' }]);
	});
});
