// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderReplayHud, type ReplayHudOptions } from '../replayEngine';

const HIDE = { error: 10_000, finished: 4_000 };
const base: ReplayHudOptions = { stepNo: 1, totalSteps: 3, title: 'TC', actionDesc: 'CLICK #kirim' };
const hud = () => document.getElementById('knitto-replay-hud');

describe('HUD replay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (window as any).__knittoReplayHudTimer;
	});

	it('punya tombol ✕ (aria-label Tutup) yang menghapus HUD dan spotlight', () => {
		renderReplayHud(base, HIDE);
		const spotlight = document.createElement('div');
		spotlight.className = 'knitto-spotlight-box';
		document.body.append(spotlight);

		const close = hud()!.querySelector('button[aria-label="Tutup"]') as HTMLButtonElement;
		expect(close.textContent).toBe('✕');
		expect(close.style.pointerEvents).toBe('auto');
		close.click();

		expect(hud()).toBeNull();
		expect(document.querySelector('.knitto-spotlight-box')).toBeNull();
	});

	it('HUD error hilang otomatis setelah 10 detik, pesan error tidak dirender sebagai HTML', () => {
		renderReplayHud({ ...base, isError: true, errorMessage: '<img src=x onerror=alert(1)>' }, HIDE);
		expect(hud()!.querySelector('img')).toBeNull();
		expect(hud()!.textContent).toContain('<img src=x onerror=alert(1)>');

		vi.advanceTimersByTime(9_999);
		expect(hud()).not.toBeNull();
		vi.advanceTimersByTime(1);
		expect(hud()).toBeNull();
	});

	it('replay baru (reset) menghapus HUD lama dan membatalkan timer auto-hide sebelumnya', () => {
		renderReplayHud({ ...base, isError: true, errorMessage: 'gagal' }, HIDE);
		const old = hud();
		renderReplayHud({ ...base, reset: true }, HIDE);

		expect(hud()).not.toBe(old);
		expect(hud()!.textContent).toContain('Langkah 1 dari 3');
		vi.advanceTimersByTime(20_000);
		expect(hud()).not.toBeNull();
	});

	it('HUD selesai hilang setelah 4 detik', () => {
		renderReplayHud({ ...base, stepNo: 3, isFinished: true }, HIDE);
		vi.advanceTimersByTime(4_000);
		expect(hud()).toBeNull();
	});
});
