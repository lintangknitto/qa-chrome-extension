// @vitest-environment jsdom
import React, { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FabApp } from '../fab';
import { FAB_SETTINGS_KEY } from '../fab-settings';

type RuntimeListener = (message: unknown) => void;
const runtimeListeners: RuntimeListener[] = [];

const storageStore = new Map<string, unknown>();

let openPanelResult = true;

beforeEach(() => {
	runtimeListeners.length = 0;
	storageStore.clear();
	openPanelResult = true;
	(globalThis as unknown as { chrome: unknown }).chrome = {
		runtime: {
			lastError: null as unknown,
			sendMessage: vi.fn((message: unknown, callback?: (response?: unknown) => void) => {
				const type = (message as { type?: string }).type;
				if (type === 'fab:openPanel') callback?.({ success: openPanelResult });
				else callback?.({ recording: false, pendingEvents: 0 });
			}),
			onMessage: {
				addListener: vi.fn((listener: RuntimeListener) => runtimeListeners.push(listener)),
				removeListener: vi.fn((listener: RuntimeListener) => {
					const index = runtimeListeners.indexOf(listener);
					if (index >= 0) runtimeListeners.splice(index, 1);
				})
			}
		},
		storage: {
			local: {
				get: vi.fn(async (key: string) => (storageStore.has(key) ? { [key]: storageStore.get(key) } : {})),
				set: vi.fn(async (obj: Record<string, unknown>) => {
					for (const [k, v] of Object.entries(obj)) storageStore.set(k, v);
				}),
				remove: vi.fn(async (key: string) => storageStore.delete(key))
			}
		}
	};
});

afterEach(() => {
	cleanup();
});

const sidebar = (): HTMLElement | null =>
	screen.queryByRole('dialog', { name: 'Knitto QA Extension' });

const openFab = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Extension' }));
};

describe('FabApp — Knitto QA Extension (root menu)', () => {
	it('menampilkan header QA Extension dan root menu Recorder/Setting saat sidebar dibuka', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);

		expect(screen.getByRole('button', { name: 'QA Knitto Extension' })).toBeTruthy();
		expect(sidebar()).toBeTruthy();
		expect(sidebar()?.dataset.open).toBe('false');

		openFab();
		expect(sidebar()?.dataset.open).toBe('true');
		expect(screen.getByText('Knitto QA Extension')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Recorder' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Setting' })).toBeTruthy();
	});

	it('navigasi root → Recorder → kembali', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();

		fireEvent.click(screen.getByRole('button', { name: 'Recorder' }));
		expect(screen.getByRole('button', { name: 'Mulai Recording' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Generate Hasil' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Recorder' })).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
		expect(screen.getByRole('button', { name: 'Recorder' })).toBeTruthy();
	});

	it('navigasi root → Setting: pilih sisi disimpan, lalu kembali', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();

		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
		expect(screen.getByText('Sisi sidebar')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Tampilkan FAB' })).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Kiri' }));
		expect((storageStore.get(FAB_SETTINGS_KEY) as { side: string }).side).toBe('left');

		fireEvent.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
		expect(screen.getByRole('button', { name: 'Recorder' })).toBeTruthy();
	});

	it('saat recording aktif, buka sidebar langsung ke sub-menu Recorder (bukan root)', () => {
		render(<FabApp settings={{ enabled: true, side: 'left' }} />);
		runtimeListeners.forEach((listener) =>
			listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 1 } })
		);
		openFab();
		// Langsung ke Recorder: tanpa harus klik root menu.
		expect(screen.queryByRole('button', { name: 'Recorder' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Tambah Checkpoint' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'End Recording' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Buka Panel' })).toBeTruthy();
	});

	it('menampilkan indicator recording kecil pada tombol FAB saat recording', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		expect(document.querySelector('.fab-rec-dot')).toBeNull();

		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 3 } })
			);
		});
		const dot = document.querySelector('.fab-rec-dot');
		expect(dot).toBeTruthy();
		// Indikator kecil tanpa teks angka.
		expect(dot?.textContent ?? '').toBe('');
		expect(dot?.getAttribute('aria-label')).toContain('3');
	});

	it('klik Mulai Recording sukses → sidebar tertutup (panel dibuka)', async () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Recorder' }));
		await waitFor(() => expect(screen.getByRole('button', { name: 'Mulai Recording' })).toBeTruthy());

		fireEvent.click(screen.getByRole('button', { name: 'Mulai Recording' }));
		await waitFor(() => expect(sidebar()?.dataset.open).toBe('false'));
		expect(screen.queryByText(/Gagal membuka/i)).toBeNull();
	});

	it('klik Mulai Recording gagal → sidebar tetap terbuka + notice jelas', async () => {
		openPanelResult = false;
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Recorder' }));
		await waitFor(() => expect(screen.getByRole('button', { name: 'Mulai Recording' })).toBeTruthy());

		fireEvent.click(screen.getByRole('button', { name: 'Mulai Recording' }));
		await waitFor(() => expect(sidebar()?.dataset.open).toBe('true'));
		expect(screen.getByText(/Gagal membuka Side Panel/i)).toBeTruthy();
	});

	it('backdrop dan Esc menutup sidebar', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();
		expect(sidebar()?.dataset.open).toBe('true');

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(sidebar()?.dataset.open).toBe('false');

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tutup sidebar' }));
		expect(sidebar()?.dataset.open).toBe('false');
	});
});