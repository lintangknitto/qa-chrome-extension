// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FabApp } from '../fab';
import { FAB_SETTINGS_KEY } from '../fab-settings';

type RuntimeListener = (message: unknown) => void;
const runtimeListeners: RuntimeListener[] = [];

const storageStore = new Map<string, unknown>();

beforeEach(() => {
	runtimeListeners.length = 0;
	storageStore.clear();
	(globalThis as unknown as { chrome: unknown }).chrome = {
		runtime: {
			lastError: null as unknown,
			sendMessage: vi.fn((_message: unknown, callback?: (response?: unknown) => void) => {
				callback?.({ recording: false, pendingEvents: 0 });
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
	screen.queryByRole('dialog', { name: 'Sidebar QA Knitto Recorder' });

describe('FabApp (sidebar geser)', () => {
	it('tombol FAB (logo + badge QA) ada; klik membuka sidebar', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);

		expect(screen.getByRole('button', { name: 'QA Knitto Recorder' })).toBeTruthy();
		expect(sidebar()).toBeTruthy(); // selalu ter-mount, tersembunyi via offset
		expect(sidebar()?.dataset.open).toBe('false');

		fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Recorder' }));
		expect(sidebar()?.dataset.open).toBe('true');
		expect(screen.getByRole('button', { name: 'Mulai Recording' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Generate Hasil' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Setting' })).toBeTruthy();
	});

	it('buka tutup via backdrop', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Recorder' }));
		expect(sidebar()?.dataset.open).toBe('true');

		fireEvent.click(screen.getByRole('button', { name: 'Tutup sidebar' }));
		expect(sidebar()?.dataset.open).toBe('false');
	});

	it('menu berubah saat state recording via fab:stateChanged', () => {
		render(<FabApp settings={{ enabled: true, side: 'left' }} />);
		runtimeListeners.forEach((listener) =>
			listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 1 } })
		);
		fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Recorder' }));
		expect(screen.getByRole('button', { name: 'Tambah Checkpoint' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'End Recording' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Setting' })).toBeTruthy();
	});

	it('Setting: toggle tampil FAB & ganti sisi disimpan ke storage', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Recorder' }));
		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));

		expect(screen.getByRole('button', { name: 'Tampilkan FAB' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Tampilkan FAB' }));
		expect((storageStore.get(FAB_SETTINGS_KEY) as { enabled: boolean }).enabled).toBe(false);

		fireEvent.click(screen.getByRole('button', { name: 'Kiri' }));
		expect((storageStore.get(FAB_SETTINGS_KEY) as { side: string }).side).toBe('left');
	});

	it('Esc menutup sidebar', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		fireEvent.click(screen.getByRole('button', { name: 'QA Knitto Recorder' }));
		expect(sidebar()?.dataset.open).toBe('true');
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(sidebar()?.dataset.open).toBe('false');
	});
});