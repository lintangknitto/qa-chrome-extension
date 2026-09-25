// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CleanerView } from '../views/CleanerView';
import * as cleanerService from '../../../recording/cleanerService';

vi.mock('../../../recording/cleanerService', async () => {
	const actual = await vi.importActual<typeof cleanerService>('../../../recording/cleanerService');
	return {
		...actual,
		requestHardReload: vi.fn(),
		requestClearCookies: vi.fn(),
		requestClearStorageAndCache: vi.fn(),
		requestCleanAll: vi.fn()
	};
});

describe('CleanerView', () => {
	const mockShowToast = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('merender target domain aktif secara normal dengan badge Domain Aktif', () => {
		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/orders"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		expect(screen.getByText('portal.knitto.co.id')).toBeTruthy();
		expect(screen.getByText('Domain Aktif')).toBeTruthy();
		expect(screen.getByText('https://portal.knitto.co.id/orders')).toBeTruthy();

		// Tombol aktif tidak disabled
		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		expect((cleanAllBtn as HTMLButtonElement).disabled).toBe(false);
	});

	it('menampilkan guard peringatan dan mendisable semua tombol pada halaman sistem browser', () => {
		render(
			<CleanerView
				activeTabUrl="chrome://extensions/"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		expect(screen.getByText(/Halaman sistem browser tidak dapat dibersihkan/i)).toBeTruthy();
		expect(screen.getByText('Sistem')).toBeTruthy();

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		const hardReloadBtn = screen.getByRole('button', { name: /Hard Reload/i });
		const clearCookiesBtn = screen.getByRole('button', { name: /Reset Cookies & Storage/i });
		const clearSwBtn = screen.getByRole('button', { name: /Hapus SW & Cache/i });

		expect((cleanAllBtn as HTMLButtonElement).disabled).toBe(true);
		expect((hardReloadBtn as HTMLButtonElement).disabled).toBe(true);
		expect((clearCookiesBtn as HTMLButtonElement).disabled).toBe(true);
		expect((clearSwBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('menampilkan guard peringatan dan mendisable tombol saat sesi recording sedang aktif', () => {
		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/dashboard"
				isRecordingActive={true}
				onShowToast={mockShowToast}
			/>
		);

		expect(screen.getByText(/Sesi recording sedang berjalan/i)).toBeTruthy();

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		expect((cleanAllBtn as HTMLButtonElement).disabled).toBe(true);
	});

	it('menjalankan Quick Action "Bersihkan Semua Sekaligus" dan memicu toast sukses', async () => {
		vi.mocked(cleanerService.requestCleanAll).mockResolvedValueOnce({ success: true });

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		fireEvent.click(cleanAllBtn);

		expect(cleanerService.requestCleanAll).toHaveBeenCalledWith('https://portal.knitto.co.id/checkout');
		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining('berhasil dibersihkan'),
				'success'
			);
		});
	});

	it('menjalankan aksi Kartu 1 "Empty Cache & Hard Reload" dan memicu toast sukses', async () => {
		vi.mocked(cleanerService.requestHardReload).mockResolvedValueOnce({ success: true });

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const hardReloadBtn = screen.getByRole('button', { name: /Hard Reload/i });
		fireEvent.click(hardReloadBtn);

		expect(cleanerService.requestHardReload).toHaveBeenCalled();
		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining('Halaman berhasil dimuat ulang tanpa cache'),
				'success'
			);
		});
	});

	it('menjalankan aksi Kartu 2 "Clear Cookies & LocalStorage" dan memicu toast sukses', async () => {
		vi.mocked(cleanerService.requestClearCookies).mockResolvedValueOnce({ success: true, count: 5 });
		vi.mocked(cleanerService.requestClearStorageAndCache).mockResolvedValueOnce({ success: true });

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const clearCookiesBtn = screen.getByRole('button', { name: /Reset Cookies & Storage/i });
		fireEvent.click(clearCookiesBtn);

		expect(cleanerService.requestClearCookies).toHaveBeenCalledWith('https://portal.knitto.co.id/checkout');
		expect(cleanerService.requestClearStorageAndCache).toHaveBeenCalledWith('https://portal.knitto.co.id');
		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining('5 cookies'),
				'success'
			);
		});
	});

	it('menjalankan aksi Kartu 3 "Unregister Service Worker & PWA Cache" dan memicu toast sukses', async () => {
		vi.mocked(cleanerService.requestClearStorageAndCache).mockResolvedValueOnce({ success: true });

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const clearSwBtn = screen.getByRole('button', { name: /Hapus SW & Cache/i });
		fireEvent.click(clearSwBtn);

		expect(cleanerService.requestClearStorageAndCache).toHaveBeenCalledWith('https://portal.knitto.co.id');
		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining('Service Worker dan CacheStorage PWA berhasil dicabut'),
				'success'
			);
		});
	});

	it('menampilkan toast error jika aksi cleaner gagal di background worker', async () => {
		vi.mocked(cleanerService.requestHardReload).mockResolvedValueOnce({
			success: false,
			error: 'Tab aktif tidak ditemukan.'
		});

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const hardReloadBtn = screen.getByRole('button', { name: /Hard Reload/i });
		fireEvent.click(hardReloadBtn);

		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith('Tab aktif tidak ditemukan.', 'error');
		});
	});

	it('menampilkan toast error jika cleanerService melempar synchronous/asynchronous exception', async () => {
		vi.mocked(cleanerService.requestCleanAll).mockRejectedValueOnce(new Error('Koneksi terputus ke service worker.'));

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		fireEvent.click(cleanAllBtn);

		await waitFor(() => {
			expect(mockShowToast).toHaveBeenCalledWith('Koneksi terputus ke service worker.', 'error');
		});
	});

	it('mencegah pemanggilan aksi kedua ketika aksi pertama sedang dalam proses (busyAction state)', async () => {
		let resolveFirstAction: (val: { success: boolean }) => void = () => {};
		const pendingPromise = new Promise<{ success: boolean }>((resolve) => {
			resolveFirstAction = resolve;
		});

		vi.mocked(cleanerService.requestCleanAll).mockReturnValueOnce(pendingPromise);

		render(
			<CleanerView
				activeTabUrl="https://portal.knitto.co.id/checkout"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		const hardReloadBtn = screen.getByRole('button', { name: /Hard Reload/i });

		// Trigger aksi pertama
		fireEvent.click(cleanAllBtn);
		expect(cleanerService.requestCleanAll).toHaveBeenCalledTimes(1);

		// Tombol lain menjadi disabled saat proses berlangsung
		expect((hardReloadBtn as HTMLButtonElement).disabled).toBe(true);

		// Mencoba klik tombol kedua tidak boleh memicu requestHardReload
		fireEvent.click(hardReloadBtn);
		expect(cleanerService.requestHardReload).not.toHaveBeenCalled();

		// Selesaikan promise aksi pertama
		resolveFirstAction({ success: true });
		await waitFor(() => {
			expect((hardReloadBtn as HTMLButtonElement).disabled).toBe(false);
		});
	});

	it('tidak memicu cleanerService jika tombol diklik saat disabled (guard halaman sistem)', () => {
		render(
			<CleanerView
				activeTabUrl="chrome://extensions/"
				isRecordingActive={false}
				onShowToast={mockShowToast}
			/>
		);

		const cleanAllBtn = screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i });
		fireEvent.click(cleanAllBtn);

		expect(cleanerService.requestCleanAll).not.toHaveBeenCalled();
		expect(mockShowToast).not.toHaveBeenCalled();
	});
});

