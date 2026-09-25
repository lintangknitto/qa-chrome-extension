// @vitest-environment jsdom
import React, { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
	login: vi.fn(),
	listActiveProjects: vi.fn(),
	createProject: vi.fn(),
	listSessions: vi.fn(),
	createSession: vi.fn(),
	createCheckpoint: vi.fn(),
	endSession: vi.fn(),
	generateOutputs: vi.fn(),
	listGenerations: vi.fn(),
	getSession: vi.fn(),
	getSessionVideo: vi.fn(),
	generateShareUrl: vi.fn()
}));

vi.mock('../../../recording/apiClient', () => ({
	ApiError: class ApiError extends Error {},
	RecordingApiClient: class {
		login = apiMocks.login;
		listActiveProjects = apiMocks.listActiveProjects;
		createProject = apiMocks.createProject;
		listSessions = apiMocks.listSessions;
		createSession = apiMocks.createSession;
		createCheckpoint = apiMocks.createCheckpoint;
		endSession = apiMocks.endSession;
		generateOutputs = apiMocks.generateOutputs;
		listGenerations = apiMocks.listGenerations;
		getSession = apiMocks.getSession;
		getSessionVideo = apiMocks.getSessionVideo;
		generateShareUrl = apiMocks.generateShareUrl;
	}
}));

import { FabApp } from '../fab';
import { FAB_SETTINGS_KEY } from '../fab-settings';

type RuntimeListener = (message: unknown) => void;
const runtimeListeners: RuntimeListener[] = [];

type StorageListener = (changes: Record<string, unknown>, areaName: string) => void;
const storageListeners: StorageListener[] = [];

const storageStore = new Map<string, unknown>();

beforeEach(() => {
	(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	runtimeListeners.length = 0;
	storageListeners.length = 0;
	storageStore.clear();
	vi.clearAllMocks();

	apiMocks.listActiveProjects.mockResolvedValue({
		items: [
			{ id_project: 1, name: 'Project Alpha', code: 'ALPHA', is_active: true },
			{ id_project: 2, name: 'Project Beta', code: 'BETA', is_active: true }
		]
	});
	apiMocks.listSessions.mockResolvedValue({
		items: [
			{
				id_session: 101,
				id_project: 1,
				test_case_no: 'TC-01',
				title: 'Test Order Flow',
				status: 'completed',
				result: 'PASS',
				last_sequence: 5
			}
		]
	});
	apiMocks.listGenerations.mockResolvedValue({
		items: [
			{
				id_generation: 1,
				kind: 'playwright',
				status: 'completed',
				output: "test('example', async ({ page }) => {});",
				error_message: null
			}
		]
	});
	apiMocks.getSession.mockResolvedValue({
		id_session: 101,
		id_project: 1,
		test_case_no: 'TC-01',
		title: 'Test Order Flow',
		status: 'completed',
		result: 'PASS',
		last_sequence: 5,
		checkpoints: []
	});
	apiMocks.getSessionVideo.mockResolvedValue({
		id_session: 101,
		video_url: null
	});

	(globalThis as unknown as { chrome: unknown }).chrome = {
		runtime: {
			id: 'knitto-test-ext',
			lastError: null as unknown,
			sendMessage: vi.fn((message: unknown, callback?: (response?: unknown) => void) => {
				const type = (message as { type?: string }).type;
				if (type === 'recordingStart') callback?.({ success: true, groupId: 77 });
				else if (type === 'recordingStop') callback?.({ success: true });
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
		tabs: {
			query: vi.fn().mockResolvedValue([{ id: 123 }])
		},
		storage: {
			local: {
				get: vi.fn(async (key: string) => (storageStore.has(key) ? { [key]: storageStore.get(key) } : {})),
				set: vi.fn(async (obj: Record<string, unknown>) => {
					for (const [k, v] of Object.entries(obj)) storageStore.set(k, v);
				}),
				remove: vi.fn(async (key: string | string[]) => {
					if (Array.isArray(key)) for (const k of key) storageStore.delete(k);
					else storageStore.delete(key);
				})
			},
			onChanged: {
				addListener: vi.fn((listener: StorageListener) => storageListeners.push(listener)),
				removeListener: vi.fn((listener: StorageListener) => {
					const index = storageListeners.indexOf(listener);
					if (index >= 0) storageListeners.splice(index, 1);
				})
			}
		}
	};
});

afterEach(() => {
	cleanup();
});

const sidebar = (): HTMLElement | null =>
	screen.queryByRole('dialog', { name: 'Knitto QA Tools' });

const openFab = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'Knitto QA Tools' }));
};

describe('FabApp — Knitto QA Tools (Sidebar Navigation & Flow)', () => {
	it('menampilkan layar Login saat sidebar dibuka dalam kondisi belum login', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);

		expect(screen.getByRole('button', { name: 'Knitto QA Tools' })).toBeTruthy();
		expect(sidebar()).toBeTruthy();
		expect(sidebar()?.dataset.open).toBe('false');

		openFab();
		expect(sidebar()?.dataset.open).toBe('true');
		expect(screen.getByText('Login ke QA Server')).toBeTruthy();
		expect(screen.getByPlaceholderText('Masukkan username')).toBeTruthy();
		expect(screen.getByPlaceholderText('Masukkan password')).toBeTruthy();
		expect(screen.queryByPlaceholderText('http://localhost:8000')).toBeNull();
	});

	it('navigasi root → Setting: pilih sisi disimpan, lalu kembali ke root', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
		expect(screen.getByText('Sisi sidebar')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Kiri' }));
		expect((storageStore.get(FAB_SETTINGS_KEY) as { side: string }).side).toBe('left');

		fireEvent.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
		expect(screen.getByRole('button', { name: 'Tools' })).toBeTruthy();
	});

	it('klik FAB saat belum login langsung ke Login, dan tombol Kembali TIDAK muncul (strict auth guard)', async () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();

		expect(screen.getByText('Login ke QA Server')).toBeTruthy();
		expect(screen.getByPlaceholderText('Masukkan username')).toBeTruthy();
		expect(screen.getByPlaceholderText('Masukkan password')).toBeTruthy();
		expect(screen.queryByPlaceholderText('http://localhost:8000')).toBeNull();

		// Tombol kembali tidak ada di layar login saat belum terotentikasi
		expect(screen.queryByRole('button', { name: 'Kembali ke menu utama' })).toBeNull();
		// Menu utama (Tools / Setting) juga tidak dapat diakses
		expect(screen.queryByRole('button', { name: 'Tools' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Setting' })).toBeNull();
	});

	it('alur login sukses: berpindah ke Layar Start (Mulai Rekaman)', async () => {
		apiMocks.login.mockResolvedValueOnce({
			token: 'jwt-token-xyz',
			user: { id_user: 1, username: 'tester', nama: 'QA Tester' }
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();

		fireEvent.change(screen.getByPlaceholderText('Masukkan username'), { target: { value: 'tester' } });
		fireEvent.change(screen.getByPlaceholderText('Masukkan password'), { target: { value: 'secret' } });
		fireEvent.click(screen.getByRole('button', { name: 'Login' }));

		await waitFor(() => {
			expect(apiMocks.login).toHaveBeenCalledWith('tester', 'secret');
			expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy();
			expect(screen.getByLabelText('User: QA Tester')).toBeTruthy();
		});
	});

	it('alur start recording → layar Active: membuat session dan mengirim recordingStart', async () => {
		// Mock token sudah ada di storage
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		apiMocks.createSession.mockResolvedValueOnce({
			id_session: 200,
			id_project: 1,
			test_case_no: 'TC-NEW-01',
			title: 'Checkout E2E',
			status: 'in_progress',
			last_sequence: 0
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy());

		fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
		fireEvent.change(screen.getByPlaceholderText('Contoh: TC-AUTH-01'), { target: { value: 'TC-NEW-01' } });
		fireEvent.change(screen.getByPlaceholderText('Contoh: Test Login Sukses User Standar'), {
			target: { value: 'Checkout E2E' }
		});

		fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

		await waitFor(() => {
			expect(apiMocks.createSession).toHaveBeenCalled();
			expect(screen.getAllByText('Recording Aktif').length).toBeGreaterThan(0);
			expect(screen.getByText('Checkout E2E')).toBeTruthy();
		});
	});

	it('layar Active: dapat menambah checkpoint dan membuka layar Result untuk End', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_active_session', {
			id_session: 300,
			id_project: 1,
			test_case_no: 'TC-CHECK-01',
			title: 'Active Session Test',
			group_id: 12,
			last_sequence: 1
		});
		apiMocks.createCheckpoint.mockResolvedValueOnce({ success: true });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Buka Tools -> langsung ke Active karena ada session
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
		await waitFor(() => expect(screen.getByText('Active Session Test')).toBeTruthy());

		// Tambah Checkpoint
		fireEvent.change(screen.getByPlaceholderText('Tulis catatan langkah atau checkpoint...'), {
			target: { value: 'Step 1 berhasil dimuat' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Add Checkpoint' }));

		await waitFor(() => {
			expect(apiMocks.createCheckpoint).toHaveBeenCalledWith(300, { note: 'Step 1 berhasil dimuat' });
		});

		// Klik End Recording -> masuk ke layar Result
		fireEvent.click(screen.getByRole('button', { name: 'End Recording' }));
		expect(screen.getByText('Konfirmasi Selesai Recording')).toBeTruthy();
	});

	it('layar Result: konfirmasi End Session → berpindah ke Riwayat Session', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_active_session', {
			id_session: 400,
			id_project: 1,
			test_case_no: 'TC-END-01',
			title: 'Session To End',
			group_id: 15,
			last_sequence: 2
		});
		apiMocks.endSession.mockResolvedValueOnce({
			id_session: 400,
			status: 'completed',
			result: 'PASS'
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByText('Session To End')).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'End Recording' }));

		expect(screen.getByText('Konfirmasi Selesai Recording')).toBeTruthy();
		fireEvent.change(screen.getByPlaceholderText('Tuliskan hasil aktual pengujian yang didapatkan...'), {
			target: { value: 'Semua test pass sesuai ekspektasi.' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi End Session' }));

		await waitFor(() => {
			expect(apiMocks.endSession).toHaveBeenCalledWith(400, {
				result: 'PASS',
				actual_result: 'Semua test pass sesuai ekspektasi.'
			});
			expect(screen.getAllByText('Riwayat Session').length).toBeGreaterThan(0);
		});
	});

	it('layar Riwayat: klik generate memanggil generateOutputs', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		apiMocks.generateOutputs.mockResolvedValueOnce({ success: true });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByRole('tab', { name: /Riwayat Rekaman/i })).toBeTruthy());
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Rekaman/i }));

		await waitFor(() => expect(screen.getByText('Test Order Flow')).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'generate' }));

		await waitFor(() => {
			expect(apiMocks.generateOutputs).toHaveBeenCalledWith(101);
		});
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
		expect(dot?.getAttribute('aria-label')).toContain('3');
	});

	it('backdrop dan Esc menutup sidebar', () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();
		expect(sidebar()?.dataset.open).toBe('true');

		act(() => {
			fireEvent.keyDown(document, { key: 'Escape' });
		});
		expect(sidebar()?.dataset.open).toBe('false');

		openFab();
		act(() => {
			fireEvent.click(screen.getByRole('button', { name: 'Tutup sidebar' }));
		});
		expect(sidebar()?.dataset.open).toBe('false');
	});

	it('alur login gagal: menampilkan pesan error ketika ditolak API', async () => {
		apiMocks.login.mockRejectedValueOnce(new Error('Kredensial tidak valid'));

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		openFab();

		fireEvent.change(screen.getByPlaceholderText('Masukkan username'), { target: { value: 'wrong_user' } });
		fireEvent.change(screen.getByPlaceholderText('Masukkan password'), { target: { value: 'wrong_pass' } });
		fireEvent.click(screen.getByRole('button', { name: 'Login' }));

		await waitFor(() => {
			expect(apiMocks.login).toHaveBeenCalledWith('wrong_user', 'wrong_pass');
			expect(screen.getByText('Kredensial tidak valid')).toBeTruthy();
		});
	});

	it('layar Start: tombol Start Recording dinonaktifkan jika field mandatory belum lengkap', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy());

		const startBtn = screen.getByRole('button', { name: 'Start Recording' }) as HTMLButtonElement;
		expect(startBtn.disabled).toBe(true);

		// Isi project saja, belum lengkap
		fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
		expect(startBtn.disabled).toBe(true);

		// Isi test case no saja, belum lengkap
		fireEvent.change(screen.getByPlaceholderText('Contoh: TC-AUTH-01'), { target: { value: 'TC-01' } });
		expect(startBtn.disabled).toBe(true);

		// Isi title -> sekarang lengkap
		fireEvent.change(screen.getByPlaceholderText('Contoh: Test Login Sukses User Standar'), {
			target: { value: 'Judul Pengujian' }
		});
		expect(startBtn.disabled).toBe(false);
	});

	it('layar Start: aksi Logout menghapus token dan mengembalikan ke layar Login', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

		await waitFor(() => {
			expect(screen.getByText('Login ke QA Server')).toBeTruthy();
			expect(storageStore.has('qa_recording_token')).toBe(false);
		});
	});

	it('layar Start: aksi Logout tetap berhasil dan kembali ke Login saat extension context invalidated', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy());

		// Simulasi extension context invalidated: storage.local.remove throws Error dan runtime.id hilang
		const chromeObj = (globalThis as unknown as { chrome: { runtime: { id?: string }; storage: { local: { remove: ReturnType<typeof vi.fn> } } } }).chrome;
		chromeObj.storage.local.remove.mockImplementationOnce(() => {
			throw new Error('Extension context invalidated.');
		});
		delete chromeObj.runtime.id;

		fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

		await waitFor(() => {
			expect(screen.getByText('Login ke QA Server')).toBeTruthy();
			expect(screen.queryByText('Login sebagai')).toBeNull();
		});
	});

	it('layar Start: Start recording menampilkan pesan error ramah jika extension context invalidated tanpa crash', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		apiMocks.createSession.mockResolvedValueOnce({
			id_session: 205,
			id_project: 1,
			test_case_no: 'TC-INVALID-01',
			title: 'Test Invalidation',
			status: 'in_progress',
			last_sequence: 0
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy());

		fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
		fireEvent.change(screen.getByPlaceholderText('Contoh: TC-AUTH-01'), { target: { value: 'TC-INVALID-01' } });
		fireEvent.change(screen.getByPlaceholderText('Contoh: Test Login Sukses User Standar'), {
			target: { value: 'Test Invalidation' }
		});

		// Simulasi extension context invalidated saat runtime.sendMessage dipanggil
		const chromeObj = (globalThis as unknown as { chrome: { runtime: { id?: string; sendMessage: ReturnType<typeof vi.fn> } } }).chrome;
		chromeObj.runtime.sendMessage.mockImplementationOnce(() => {
			throw new Error('Extension context invalidated.');
		});

		fireEvent.click(screen.getByRole('button', { name: 'Start Recording' }));

		await waitFor(() => {
			expect(screen.getByText(/Koneksi extension terputus/)).toBeTruthy();
		});
	});

	it('layar Result: tombol Batal mengembalikan navigasi ke layar Active tanpa submit', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_active_session', {
			id_session: 500,
			id_project: 1,
			test_case_no: 'TC-CANCEL-01',
			title: 'Session To Cancel',
			group_id: 20,
			last_sequence: 1
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByText('Session To Cancel')).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'End Recording' }));

		expect(screen.getByText('Konfirmasi Selesai Recording')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

		expect(screen.getByText('Session To Cancel')).toBeTruthy();
		expect(apiMocks.endSession).not.toHaveBeenCalled();
	});

	it('layar Riwayat: klik hasil membuka TestCaseResultModal dan memuat rincian sesi', async () => {
		storageStore.set('qa_recording_token', 'mock-token');

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => expect(screen.getByRole('tab', { name: /Riwayat Rekaman/i })).toBeTruthy());
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Rekaman/i }));

		await waitFor(() => expect(screen.getByText('Test Order Flow')).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'hasil' }));

		await waitFor(() => {
			expect(apiMocks.getSession).toHaveBeenCalledWith(101);
			expect(apiMocks.listGenerations).toHaveBeenCalledWith(101);
			expect(screen.getByText('Hasil Rekaman: TC-01')).toBeTruthy();
			expect(screen.getByRole('button', { name: /^Re-run$/i })).toBeTruthy();
		});
	});

	it('multi-tab sync: merespon perubahan storage dari tab lain via storage.onChanged', async () => {
		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		// Simulasi login di tab lain yang mengupdate storage
		storageStore.set('qa_recording_token', 'token-from-other-tab');
		storageStore.set('qa_recording_user', { id_user: 99, username: 'other_user', nama: 'Tab Other' });

		await act(async () => {
			for (const l of storageListeners) l({}, 'local');
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => {
			expect(screen.getByLabelText(/Tab Other/)).toBeTruthy();
		});
	});

	it('menambah project baru via tombol (+) di StartView, memanggil api.createProject, reload project, dan menampilkan toast sukses', async () => {
		apiMocks.createProject.mockResolvedValue({
			id_project: 999,
			name: 'New Knitto Project',
			code: 'new-knitto-project',
			base_url: 'https://test.knitto.id',
			is_active: true
		});

		storageStore.set('qa_recording_token', 'token-qa');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'qaadmin', nama: 'QA Admin', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();
		});

		// Buka modal
		fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));
		expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();

		// Isi form modal
		await act(async () => {
			fireEvent.change(screen.getByPlaceholderText('Contoh: Knitto ERP Portal'), {
				target: { value: 'New Knitto Project' }
			});
		});

		const simpanBtn = screen.getByRole('button', { name: 'Simpan Project' }) as HTMLButtonElement;
		expect(simpanBtn.disabled).toBe(false);

		// Simpan
		await act(async () => {
			fireEvent.click(simpanBtn);
		});

		await waitFor(() => {
			expect(apiMocks.createProject).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'New Knitto Project'
				})
			);
			expect(apiMocks.listActiveProjects).toHaveBeenCalled();
			expect(screen.getAllByText('Project berhasil dibuat.').length).toBeGreaterThanOrEqual(1);
		});
	});

	it('navigasi 1-klik via Navigation Rail: berpindah antara Tools, Riwayat, dan Setting', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Awalnya di StartView (Form Mulai Rekaman)
		await waitFor(() => {
			expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy();
			expect(screen.getByRole('navigation', { name: 'Navigasi Utama' })).toBeTruthy();
		});

		// Klik tab Riwayat Rekaman di Recorder
		await waitFor(() => expect(screen.getByRole('tab', { name: /Riwayat Rekaman/i })).toBeTruthy());
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Rekaman/i }));
		await waitFor(() => {
			expect(screen.getAllByText('Riwayat Session').length).toBeGreaterThanOrEqual(1);
		});

		// Klik Setting di rail
		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
		await waitFor(() => {
			expect(screen.getByText('Pengaturan Sidebar')).toBeTruthy();
		});

		// Klik Tools di rail untuk kembali ke form rekaman
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
		await waitFor(() => {
			expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy();
		});
	});

	it('logout instan langsung dari layar Setting melalui footer Navigation Rail', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Navigasi ke Setting
		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
		await waitFor(() => {
			expect(screen.getByText('Pengaturan Sidebar')).toBeTruthy();
		});

		// Logout langsung dari footer rail saat berada di layar Setting
		fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
		await waitFor(() => {
			expect(screen.getByText('Login ke QA Server')).toBeTruthy();
			expect(storageStore.has('qa_recording_token')).toBe(false);
			expect(screen.queryByRole('navigation', { name: 'Navigasi Utama' })).toBeNull();
		});
	});

	it('struktur Navigation Rail: render brand logo di atas, icon menu di tengah, avatar dan tombol logout di bottom', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			const nav = screen.getByRole('navigation', { name: 'Navigasi Utama' });
			expect(nav).toBeTruthy();

			// Logo brand di rail top
			const railLogo = nav.querySelector('.fab-rail-logo');
			expect(railLogo).toBeTruthy();

			// Menu items tengah
			const toolsBtn = screen.getByRole('button', { name: 'Tools' });
			const projectBtn = screen.getByRole('button', { name: 'Project' });
			const settingBtn = screen.getByRole('button', { name: 'Setting' });
			expect(toolsBtn).toBeTruthy();
			expect(projectBtn).toBeTruthy();
			expect(settingBtn).toBeTruthy();
			expect(screen.queryByRole('button', { name: 'Riwayat' })).toBeNull();
			expect(toolsBtn.classList.contains('group-active')).toBe(true);

			// User avatar & logout di rail bottom
			const avatar = screen.getByLabelText('User: QA Tester');
			expect(avatar).toBeTruthy();
			expect(avatar.textContent).toBe('Q');
			expect(avatar.getAttribute('title')).toBe('QA Tester (QA)');

			const logoutBtn = screen.getByRole('button', { name: 'Logout' });
			expect(logoutBtn).toBeTruthy();
		});
	});

	it('modern hover-expandable rail: render spacer, brand title, label teks navigasi, badge rekaman, dan kartu detail user', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			const layout = document.querySelector('.fab-layout');
			expect(layout).toBeTruthy();
			expect(layout?.querySelector('.fab-rail-spacer')).toBeTruthy();

			const nav = screen.getByRole('navigation', { name: 'Navigasi Utama' });
			expect(nav).toBeTruthy();

			// Header Brand
			expect(nav.querySelector('.fab-rail-brand-name')?.textContent).toBe('Knitto QA');
			expect(nav.querySelector('.fab-rail-brand-sub')?.textContent).toBe('Test Automation');

			// Labels teks navigasi
			expect(screen.getByText('Tools')).toBeTruthy();
			expect(screen.getByText('Project')).toBeTruthy();
			expect(screen.getByText('Pengaturan')).toBeTruthy();

			// Detail User & Logout
			expect(nav.querySelector('.fab-rail-user-name')?.textContent).toBe('QA Tester');
			expect(nav.querySelector('.fab-rail-user-level')?.textContent).toBe('QA');
			expect(screen.getByRole('button', { name: 'Logout' }).textContent).toContain('Logout');
		});

		// Simulasi recording aktif -> badge LIVE muncul
		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 1 } })
			);
		});

		await waitFor(() => {
			const nav = screen.getByRole('navigation', { name: 'Navigasi Utama' });
			expect(nav.querySelector('.fab-rail-badge')?.textContent).toBe('LIVE');
		});
	});

	it('klik menu navigasi langsung menutup (collapse) rail ke 56px seketika', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			expect(screen.getByRole('navigation', { name: 'Navigasi Utama' })).toBeTruthy();
		});

		const nav = screen.getByRole('navigation', { name: 'Navigasi Utama' });
		expect(nav.getAttribute('data-collapsed')).toBe('false');

		// Klik menu Setting
		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));

		// Rail seketika tertutup (data-collapsed="true")
		expect(nav.getAttribute('data-collapsed')).toBe('true');
		expect(nav.classList.contains('fab-rail-collapsed')).toBe(true);

		// Saat mouse leave, status collapse di-reset untuk hover berikutnya
		fireEvent.mouseLeave(nav);
		expect(nav.getAttribute('data-collapsed')).toBe('false');
		expect(nav.classList.contains('fab-rail-collapsed')).toBe(false);
	});

	it('pulsing red dot recording indicator (.fab-rail-dot) muncul pada icon Tools di rail saat recording aktif dan hilang saat idle', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			const toolsBtn = screen.getByRole('button', { name: 'Tools' });
			expect(toolsBtn.querySelector('.fab-rail-dot')).toBeNull();
		});

		// Simulasi state recording aktif
		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 2 } })
			);
		});

		await waitFor(() => {
			const toolsBtn = screen.getByRole('button', { name: 'Tools' });
			expect(toolsBtn.querySelector('.fab-rail-dot')).toBeTruthy();
		});

		// Simulasi kembali ke idle
		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: false, pendingEvents: 0 } })
			);
		});

		await waitFor(() => {
			const toolsBtn = screen.getByRole('button', { name: 'Tools' });
			expect(toolsBtn.querySelector('.fab-rail-dot')).toBeNull();
		});
	});

	it('logout instan langsung dari layar Riwayat melalui footer Navigation Rail', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Navigasi ke Riwayat via tab di Recorder
		await waitFor(() => expect(screen.getByRole('tab', { name: /Riwayat Rekaman/i })).toBeTruthy());
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Rekaman/i }));
		await waitFor(() => {
			expect(screen.getAllByText('Riwayat Session').length).toBeGreaterThanOrEqual(1);
		});

		// Logout langsung dari footer rail saat berada di layar Riwayat
		fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
		await waitFor(() => {
			expect(screen.getByText('Login ke QA Server')).toBeTruthy();
			expect(storageStore.has('qa_recording_token')).toBe(false);
			expect(screen.queryByRole('navigation', { name: 'Navigasi Utama' })).toBeNull();
		});
	});

	it('proteksi logout: menampilkan pesan error jika user mencoba logout saat recording aktif', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });
		storageStore.set('qa_recording_active_session', {
			id_session: 300,
			id_project: 1,
			test_case_no: 'TC-CHECK-01',
			title: 'Active Session Test',
			group_id: 12,
			last_sequence: 1
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Set recording aktif
		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 1 } })
			);
		});

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

		await waitFor(() => {
			expect(screen.getByText('Akhiri recording sebelum logout.')).toBeTruthy();
			// User tetap login
			expect(storageStore.has('qa_recording_token')).toBe(true);
			expect(screen.getByRole('navigation', { name: 'Navigasi Utama' })).toBeTruthy();
		});
	});

	it('StartView bersih tanpa card profil user, teks Login sebagai, atau tombol duplikat Riwayat dan Logout', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			expect(screen.getByText('Form Mulai Rekaman')).toBeTruthy();
			// Tidak ada teks 'Login sebagai'
			expect(screen.queryByText(/Login sebagai/i)).toBeNull();
			// Tombol Logout hanya ada 1 di dalam Navigation Rail, bukan di dalam StartView form card
			const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
			expect(logoutButtons.length).toBe(1);
			expect(logoutButtons[0].closest('.fab-rail')).toBeTruthy();
		});
	});

	it('Escape key pada sidebar tidak menutup sidebar jika modal internal sedang terbuka', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();
		});

		// Buka modal internal
		fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));
		expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();

		// Tekan Escape saat modal terbuka
		fireEvent.keyDown(document, { key: 'Escape' });

		// Sidebar tetap terbuka karena modal yang meng-handle / memblokir penutupan sidebar
		expect(sidebar()?.dataset.open).toBe('true');
	});

	it('sidebar dapat di-resize lebarnya secara dinamis dan menampilkan resizer handle saat terbuka', async () => {
		render(<FabApp settings={{ enabled: true, side: 'right', width: 600 }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();

		const resizer = screen.getByRole('separator', { name: 'Ubah ukuran sidebar' });
		expect(resizer).toBeTruthy();
		expect(sidebar()?.style.width).toBe('600px');

		// Geser pointer pada resizer
		fireEvent.pointerDown(resizer, { clientX: 800 });
		fireEvent(window, new MouseEvent('pointermove', { clientX: 700 }));
		fireEvent(window, new MouseEvent('pointerup'));

		// Width harus bertambah saat digeser ke kiri pada dock kanan (800 - 700 = +100px -> 700px)
		expect(sidebar()?.style.width).toBe('700px');
	});

	it('footer status sidebar bersifat dinamis & kontekstual sesuai fitur yang sedang dibuka', async () => {
		storageStore.set('qa_recording_token', 'valid-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();

		// Default view adalah Start: footer menampilkan status siap merekam
		await waitFor(() => {
			expect(screen.getByText('Siap merekam — tentukan project & klik Start Recording')).toBeTruthy();
			expect(screen.getByText('Ready')).toBeTruthy();
		});

		// Pindah ke tab Pengaturan: footer menyesuaikan ke fitur Pengaturan
		fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
		await waitFor(() => {
			expect(screen.getByText('Pengaturan Sidebar & Ekstensi')).toBeTruthy();
			expect(screen.getByText('Dock: Kanan')).toBeTruthy();
		});

		// Pindah ke tab Manajemen Project: footer menyesuaikan ke Manajemen Project
		fireEvent.click(screen.getByRole('button', { name: 'Project' }));
		await waitFor(() => {
			const footer = sidebar()?.querySelector('.fab-sidebar-footer');
			expect(footer?.textContent).toContain('Manajemen Project & Test Case');
			expect(footer?.textContent).toContain('2 Project');
		});
	});

	it('navigasi Tools: hover membuka sub-menu dropdown (Recorder & Cleaner), mouse leave menutup dropdown', async () => {
		storageStore.set('qa_recording_token', 'valid-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' });

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});

		openFab();

		// Default state: sub-menu tertutup, root Tools aktif karena berada di view Recorder
		const toolsBtn = screen.getByRole('button', { name: 'Tools' });
		const toolsGroup = sidebar()?.querySelector('.fab-rail-tools-group');
		expect(toolsGroup).toBeTruthy();
		expect(toolsBtn.getAttribute('aria-expanded')).toBe('false');
		expect(toolsBtn.classList.contains('active')).toBe(true);
		expect(toolsBtn.classList.contains('group-active')).toBe(true);
		expect(screen.queryByRole('button', { name: 'Recorder' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Cleaner' })).toBeNull();

		// Hover (mouseEnter) pada tools group -> sub-menu terbuka, subitem Recorder aktif
		fireEvent.mouseEnter(toolsGroup!);
		expect(toolsBtn.getAttribute('aria-expanded')).toBe('true');
		expect(toolsBtn.classList.contains('active')).toBe(false);
		expect(toolsBtn.classList.contains('group-active')).toBe(true);
		const recorderSubitem = screen.getByRole('button', { name: 'Recorder' });
		const cleanerSubitem = screen.getByRole('button', { name: 'Cleaner' });
		expect(recorderSubitem).toBeTruthy();
		expect(cleanerSubitem).toBeTruthy();
		expect(recorderSubitem.classList.contains('active')).toBe(true);

		// Mouse leave pada tools group -> sub-menu menutup, root Tools kembali aktif
		fireEvent.mouseLeave(toolsGroup!);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 200));
		});
		expect(toolsBtn.getAttribute('aria-expanded')).toBe('false');
		expect(toolsBtn.classList.contains('active')).toBe(true);
		expect(screen.queryByRole('button', { name: 'Recorder' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Cleaner' })).toBeNull();

		// Hover lagi dan klik Cleaner sub-item
		fireEvent.mouseEnter(toolsGroup!);
		expect(screen.getByRole('button', { name: 'Cleaner' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Cleaner' }));

		// Header & CleanerView
		await waitFor(() => {
			expect(screen.getByText('QA Cleaner & Cache')).toBeTruthy();
			expect(screen.getByText(/Quick Cleaner/i)).toBeTruthy();
			expect(screen.getByRole('button', { name: /Bersihkan Semua Sekaligus/i })).toBeTruthy();
		});

		// Dropdown tertutup setelah navigasi, root Tools tetap berstatus active + indikator Cleaner
		expect(toolsBtn.getAttribute('aria-expanded')).toBe('false');
		expect(toolsBtn.classList.contains('active')).toBe(true);
		expect(toolsBtn.querySelector('.fab-rail-subbadge')?.textContent).toBe('Cleaner');

		// Footer cleaner status
		const footer = sidebar()?.querySelector('.fab-sidebar-footer');
		expect(footer?.textContent).toContain('QA Cleaner & Reset Cache Domain');
		expect(footer?.textContent).toContain('Cleaner');

		// Klik tombol back (←) kembali ke Start view
		const backBtn = screen.getByRole('button', { name: 'Kembali ke menu utama' });
		fireEvent.click(backBtn);

		await waitFor(() => {
			expect(screen.getByText('Mulai Recording')).toBeTruthy();
		});
	});

	it('recorder segmented tabs: menampilkan indikator Sedang Merekam dengan pulsing dot saat recording dan dapat beralih ke Riwayat tanpa membatalkan rekaman', async () => {
		storageStore.set('qa_recording_token', 'mock-token');
		storageStore.set('qa_recording_user', { id_user: 1, username: 'tester', nama: 'QA Tester' });
		storageStore.set('qa_recording_active_session', {
			id_session: 600,
			id_project: 1,
			test_case_no: 'TC-TAB-01',
			title: 'Tab Switching Active Session',
			group_id: 30,
			last_sequence: 1
		});

		render(<FabApp settings={{ enabled: true, side: 'right' }} />);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 20));
		});
		openFab();

		// Buka Tools -> langsung ke Active karena ada session
		fireEvent.click(screen.getByRole('button', { name: 'Tools' }));

		// Simulasi recording aktif
		act(() => {
			runtimeListeners.forEach((listener) =>
				listener({ type: 'fab:stateChanged', state: { recording: true, pendingEvents: 1 } })
			);
		});

		await waitFor(() => {
			expect(screen.getByText('Tab Switching Active Session')).toBeTruthy();
			// Tab 1 harus berlabel "Sedang Merekam" dengan pulsing dot
			expect(screen.getByText('Sedang Merekam')).toBeTruthy();
			expect(document.querySelector('.fab-recorder-pulse-dot')).toBeTruthy();
			// Tab 2 berlabel "Riwayat Rekaman"
			expect(screen.getByRole('tab', { name: /Riwayat Rekaman/i })).toBeTruthy();
		});

		// Beralih ke tab Riwayat Rekaman
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Rekaman/i }));

		await waitFor(() => {
			// Layar berpindah ke HistoryView
			expect(screen.getAllByText('Riwayat Session').length).toBeGreaterThanOrEqual(1);
			// Recording tetap aktif (badge LIVE di rail tetap ada)
			const nav = screen.getByRole('navigation', { name: 'Navigasi Utama' });
			expect(nav.querySelector('.fab-rail-badge')?.textContent).toBe('LIVE');
		});

		// Klik tab "Sedang Merekam" kembali ke ActiveView
		fireEvent.click(screen.getByRole('tab', { name: /Sedang Merekam/i }));

		await waitFor(() => {
			expect(screen.getByText('Tab Switching Active Session')).toBeTruthy();
			expect(screen.getByRole('button', { name: 'End Recording' })).toBeTruthy();
		});
	});
});