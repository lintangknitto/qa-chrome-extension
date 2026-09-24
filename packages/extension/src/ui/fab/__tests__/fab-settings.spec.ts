// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	FAB_SETTINGS_KEY,
	loadFabSettings,
	saveFabSettings
} from '../fab-settings';

const store = new Map<string, unknown>();

beforeAll(() => {
	(globalThis as unknown as { chrome: unknown }).chrome = {
		storage: {
			local: {
				get: vi.fn(async (key: string | string[]) => {
					const keys = Array.isArray(key) ? key : [key];
					const out: Record<string, unknown> = {};
					for (const k of keys) if (store.has(k)) out[k] = store.get(k);
					return out;
				}),
				set: vi.fn(async (obj: Record<string, unknown>) => {
					for (const [k, v] of Object.entries(obj)) store.set(k, v);
				}),
				remove: vi.fn(async (key: string | string[]) => {
					for (const k of Array.isArray(key) ? key : [key]) store.delete(k);
				})
			}
		}
	};
});

describe('fab-settings', () => {
	it('menulis dan membaca setting', async () => {
		await saveFabSettings({ enabled: false, side: 'left' });
		expect(await loadFabSettings()).toEqual({ enabled: false, side: 'left' });
	});

	it('mengembalikan default saat setting belum ada', async () => {
		store.clear();
		expect(await loadFabSettings()).toEqual({ enabled: true, side: 'right' });
	});
});