import { describe, expect, it } from 'vitest';
import {
	FAB_SETTINGS_DEFAULTS,
	fabMenuForState,
	isRestrictedFabUrl,
	parseFabSettings
} from '../fab-state';

describe('fab-state', () => {
	describe('isRestrictedFabUrl', () => {
		it('menolak halaman internal browser/extension', () => {
			expect(isRestrictedFabUrl('chrome://extensions/')).toBe(true);
			expect(isRestrictedFabUrl('chrome-extension://abc/panel.html')).toBe(true);
			expect(isRestrictedFabUrl('about:blank')).toBe(true);
			expect(isRestrictedFabUrl('edge://settings')).toBe(true);
			expect(isRestrictedFabUrl('view-source:https://x.test')).toBe(true);
		});

		it('menerima halaman web biasa (termasuk PDF viewer dikecualikan)', () => {
			expect(isRestrictedFabUrl('https://contoh.test/beranda')).toBe(false);
			expect(isRestrictedFabUrl('http://localhost:8123/index.html')).toBe(false);
			expect(isRestrictedFabUrl('file:///C:/x.html')).toBe(true); // file: dianggap terlarang
			expect(isRestrictedFabUrl('https://x.test/dokumen.pdf')).toBe(true);
		});
	});

	describe('fabMenuForState', () => {
		it('menu idle berisi Mulai/Generate/Panel/Setting', () => {
			expect(fabMenuForState('idle').map((item) => item.id)).toEqual(['start', 'generate', 'panel', 'setting']);
		});

		it('menu recording berisi Checkpoint/End/Panel/Setting', () => {
			expect(fabMenuForState('recording').map((item) => item.id)).toEqual(['checkpoint', 'end', 'panel', 'setting']);
		});
	});

	describe('parseFabSettings', () => {
		it('default bila kosong / bukan object', () => {
			expect(parseFabSettings(undefined)).toEqual(FAB_SETTINGS_DEFAULTS);
			expect(parseFabSettings('bukan-object')).toEqual(FAB_SETTINGS_DEFAULTS);
		});

		it('membaca enabled dan side', () => {
			expect(parseFabSettings({ enabled: false, side: 'left' })).toEqual({
				enabled: false,
				side: 'left'
			});
		});

		it('memahami key lama position untuk kompatibilitas', () => {
			expect(parseFabSettings({ enabled: true, position: 'left' })).toEqual({
				enabled: true,
				side: 'left'
			});
		});

		it('mengabaikan side tidak dikenal', () => {
			expect(parseFabSettings({ enabled: true, side: 'top' })).toEqual({
				enabled: true,
				side: 'right'
			});
		});
	});
});