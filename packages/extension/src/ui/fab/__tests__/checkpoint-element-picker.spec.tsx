// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isExtensionUiElement, startElementPicker, type PickedTarget } from '../elementPicker';
import { ActiveView, defaultCheckpointNote } from '../views/ActiveView';
import type { StoredActiveSession } from '../../../recording/tokenStore';

describe('startElementPicker', () => {
	let pageClicks: string[];
	const recordClick = (event: Event) => pageClicks.push((event.target as Element).id || (event.target as Element).tagName);

	beforeEach(() => {
		pageClicks = [];
		document.body.innerHTML = `
			<div id="toast" role="status">  Data   berhasil disimpan </div>
			<button id="simpan">Simpan</button>
			<div id="qa-knitto-fab-host"></div>`;
		delete (window as any).__knittoLocator;
		// Listener capture recorder di document (seperti capture script).
		document.addEventListener('click', recordClick, true);
	});

	afterEach(() => {
		document.removeEventListener('click', recordClick, true);
	});

	it('klik memilih elemen (locator + teks) tanpa diteruskan ke halaman/recorder; overlay dibersihkan', async () => {
		const handle = startElementPicker();
		const toast = document.getElementById('toast')!;
		toast.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
		const overlay = document.querySelector('[data-qa-knitto-ext="picker"]') as HTMLElement;
		expect(overlay.style.display).toBe('block');
		toast.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		toast.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		const picked = await handle.promise;
		expect(picked).toEqual({ locators: expect.arrayContaining(["getByRole('status')"]), text: 'Data berhasil disimpan', tagName: 'div' });
		expect(pageClicks).toEqual([]);
		expect(document.querySelector('[data-qa-knitto-ext="picker"]')).toBeNull();

		// Setelah selesai, klik halaman kembali normal.
		document.getElementById('simpan')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(pageClicks).toEqual(['simpan']);
	});

	it('Esc membatalkan dan tidak sampai ke halaman', async () => {
		const keys: string[] = [];
		const onKey = (e: KeyboardEvent) => keys.push(e.key);
		document.addEventListener('keydown', onKey, true);
		const handle = startElementPicker();
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await expect(handle.promise).resolves.toBeNull();
		expect(keys).toEqual([]);
		document.removeEventListener('keydown', onKey, true);
	});

	it('klik di UI extension (shadow root FAB) diteruskan, bukan dipilih', async () => {
		const root = document.getElementById('qa-knitto-fab-host')!.attachShadow({ mode: 'open' });
		root.innerHTML = '<button id="batal">Batal</button>';
		const batal = root.getElementById('batal')!;
		expect(isExtensionUiElement(batal)).toBe(true);
		const handle = startElementPicker();
		const fabClicks = vi.fn();
		batal.addEventListener('click', fabClicks);
		batal.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
		expect(fabClicks).toHaveBeenCalledTimes(1);
		handle.cancel();
		await expect(handle.promise).resolves.toBeNull();
	});
});

describe('ActiveView mode Pilih elemen', () => {
	const session: StoredActiveSession = {
		id_session: 1,
		id_project: 1,
		id_test_case: null,
		test_case_no: 'TC-1',
		title: 'Sesi',
		expected_result: null,
		group_id: 3,
		last_sequence: 0,
		started_at: Date.now(),
		record_video: true
	};
	const target: PickedTarget = { locators: ["getByRole('status')"], text: 'Data berhasil disimpan', tagName: 'div' };

	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	afterEach(() => cleanup());

	it('memilih elemen lalu Add Checkpoint tanpa catatan memakai catatan otomatis + target', async () => {
		const onCheckpoint = vi.fn();
		let resolvePick!: (value: PickedTarget | null) => void;
		const onPickElement = vi.fn(() => new Promise<PickedTarget | null>((resolve) => (resolvePick = resolve)));
		render(<ActiveView session={session} pendingEvents={0} busy={false} error={null} onCheckpoint={onCheckpoint} onPickElement={onPickElement} onNavigateEnd={() => {}} />);

		expect((screen.getByRole('button', { name: 'Add Checkpoint' }) as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(screen.getByRole('button', { name: /Pilih elemen/ }));
		expect(screen.getByText(/Esc untuk batal/)).toBeTruthy();
		await act(async () => resolvePick(target));
		await waitFor(() => expect(screen.getByTestId('checkpoint-target').textContent).toContain('Data berhasil disimpan'));

		fireEvent.click(screen.getByRole('button', { name: 'Add Checkpoint' }));
		expect(onCheckpoint).toHaveBeenCalledWith(defaultCheckpointNote(target), target);
		expect(defaultCheckpointNote(target)).toBe('Verifikasi elemen: "Data berhasil disimpan"');
		expect(screen.queryByTestId('checkpoint-target')).toBeNull();
	});

	it('pilihan dibatalkan (null) tidak menyetel target; catatan biasa tetap terkirim tanpa target', async () => {
		const onCheckpoint = vi.fn();
		render(<ActiveView session={session} pendingEvents={0} busy={false} error={null} onCheckpoint={onCheckpoint} onPickElement={async () => null} onNavigateEnd={() => {}} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Pilih elemen/ }));
		});
		expect(screen.queryByTestId('checkpoint-target')).toBeNull();
		fireEvent.change(screen.getByPlaceholderText('Tulis catatan langkah atau checkpoint...'), { target: { value: 'Halaman tampil' } });
		fireEvent.click(screen.getByRole('button', { name: 'Add Checkpoint' }));
		expect(onCheckpoint).toHaveBeenCalledWith('Halaman tampil');
	});
});
