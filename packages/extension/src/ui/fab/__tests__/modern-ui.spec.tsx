// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { ActiveView } from '../views/ActiveView';
import { HistoryView, type GenerationItem } from '../views/HistoryView';
import { ResultView } from '../views/ResultView';
import { LoginView } from '../views/LoginView';
import { StartView } from '../views/StartView';
import type { StoredActiveSession } from '../../../recording/tokenStore';
import type { RecordingSession } from '../../../recording/apiClient';

describe('Modern UI Components & Overhaul Scenarios', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	describe('PB-1: UI Primitives (Button, Badge, Modal, Toast)', () => {
		it('Button: menampilkan loading spinner saat loading=true dan disabled', () => {
			render(
				<Button loading={true} variant="primary">
					Kirim Data
				</Button>
			);
			const btn = screen.getByRole('button') as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
			expect(document.querySelector('.k-spin')).toBeTruthy();
		});

		it('Badge: varian recording memiliki indikator pulse', () => {
			render(<Badge variant="recording">Recording Aktif</Badge>);
			expect(screen.getByText('Recording Aktif')).toBeTruthy();
			expect(document.querySelector('.k-badge-danger')).toBeTruthy();
			expect(document.querySelector('.k-pulse-dot')).toBeTruthy();
		});

		it('Modal: overlay dialog tertutup saat tombol X atau Escape ditekan', () => {
			const onClose = vi.fn();
			const { rerender } = render(
				<Modal open={true} onClose={onClose} title="Code Preview">
					<div>Konten Kode</div>
				</Modal>
			);

			expect(screen.getByRole('dialog', { name: 'Code Preview' })).toBeTruthy();
			expect(screen.getByText('Konten Kode')).toBeTruthy();

			// Klik tombol tutup (X)
			fireEvent.click(screen.getByRole('button', { name: 'Tutup modal' }));
			expect(onClose).toHaveBeenCalledTimes(1);

			// Tekan Escape
			fireEvent.keyDown(document, { key: 'Escape' });
			expect(onClose).toHaveBeenCalledTimes(2);

			// Jika open=false, modal tidak dirender
			rerender(
				<Modal open={false} onClose={onClose} title="Code Preview">
					<div>Konten Kode</div>
				</Modal>
			);
			expect(screen.queryByRole('dialog', { name: 'Code Preview' })).toBeNull();
		});

		it('Toast: floating alert auto-dismiss setelah timeout dan mendukung manual close', () => {
			vi.useFakeTimers();
			const onClose = vi.fn();
			render(<Toast message="Login berhasil." type="success" onClose={onClose} duration={2000} />);

			expect(screen.getByRole('alert')).toBeTruthy();
			expect(screen.getByText('Login berhasil.')).toBeTruthy();

			// Auto-dismiss setelah 2000ms
			act(() => {
				vi.advanceTimersByTime(2000);
			});
			expect(onClose).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});
	});

	describe('PB-3: LoginView Keyboard Submission', () => {
		it('menekan Enter pada password field men-trigger onSubmit', () => {
			const onSubmit = vi.fn();
			render(<LoginView busy={false} error={null} onSubmit={onSubmit} />);

			fireEvent.change(screen.getByPlaceholderText('Masukkan username'), { target: { value: 'qa_user' } });
			const passwordInput = screen.getByPlaceholderText('Masukkan password');
			fireEvent.change(passwordInput, { target: { value: 'my_pass' } });

			fireEvent.keyDown(passwordInput, { key: 'Enter' });
			expect(onSubmit).toHaveBeenCalledWith({ username: 'qa_user', password: 'my_pass' });
		});
	});

	describe('PB-4: ActiveView (Live Stopwatch & Metric Cards)', () => {
		const mockSession: StoredActiveSession = {
			id_session: 789,
			id_project: 1,
			test_case_no: 'TC-TIMER-01',
			title: 'Stopwatch Test',
			group_id: 42,
			last_sequence: 3
		};

		it('stopwatch timer berjalan dan menambah durasi tiap detik', () => {
			vi.useFakeTimers();
			render(
				<ActiveView
					session={mockSession}
					pendingEvents={4}
					busy={false}
					error={null}
					onCheckpoint={vi.fn()}
					onNavigateEnd={vi.fn()}
				/>
			);

			const timerEl = document.querySelector('.k-stopwatch-time');
			expect(timerEl?.textContent).toBe('00:00');

			act(() => {
				vi.advanceTimersByTime(3000);
			});
			expect(timerEl?.textContent).toBe('00:03');

			act(() => {
				vi.advanceTimersByTime(62000);
			});
			// 3 + 62 = 65s -> 01:05
			expect(timerEl?.textContent).toBe('01:05');

			vi.useRealTimers();
		});

		it('menampilkan metric cards: pending event counter dan ID Tab Group', () => {
			render(
				<ActiveView
					session={mockSession}
					pendingEvents={8}
					busy={false}
					error={null}
					onCheckpoint={vi.fn()}
					onNavigateEnd={vi.fn()}
				/>
			);

			expect(screen.getByText('8')).toBeTruthy();
			expect(screen.getByText('Event menunggu kirim')).toBeTruthy();
			expect(screen.getByText('42')).toBeTruthy();
			expect(screen.getByText('ID Tab Group')).toBeTruthy();
		});

		it('menekan Enter pada input checkpoint memanggil onCheckpoint dan mengosongkan input', () => {
			const onCheckpoint = vi.fn();
			render(
				<ActiveView
					session={mockSession}
					pendingEvents={0}
					busy={false}
					error={null}
					onCheckpoint={onCheckpoint}
					onNavigateEnd={vi.fn()}
				/>
			);

			const checkpointInput = screen.getByPlaceholderText('Tulis catatan langkah atau checkpoint...');
			fireEvent.change(checkpointInput, { target: { value: 'Verifikasi modal muncul' } });
			fireEvent.keyDown(checkpointInput, { key: 'Enter' });

			expect(onCheckpoint).toHaveBeenCalledWith('Verifikasi modal muncul');
			expect((checkpointInput as HTMLInputElement).value).toBe('');
		});
	});

	describe('PB-4: ResultView (Segmented Status Selection)', () => {
		const mockSession: StoredActiveSession = {
			id_session: 790,
			id_project: 1,
			test_case_no: 'TC-RES-01',
			title: 'Result Status Test',
			group_id: 10,
			last_sequence: 1
		};

		it('dapat memilih hasil FAIL atau BLOCKED via segmented pill buttons', () => {
			const onConfirmEnd = vi.fn();
			render(
				<ResultView
					session={mockSession}
					busy={false}
					error={null}
					onConfirmEnd={onConfirmEnd}
					onCancel={vi.fn()}
				/>
			);

			// Default PASS
			expect(document.querySelector('.active-pass')).toBeTruthy();

			// Pilih FAIL
			const failBtn = screen.getByRole('button', { name: /FAIL/i });
			fireEvent.click(failBtn);
			expect(document.querySelector('.active-fail')).toBeTruthy();

			// Isi actual result dan submit
			fireEvent.change(screen.getByPlaceholderText('Tuliskan hasil aktual pengujian yang didapatkan...'), {
				target: { value: 'Bug pada tombol checkout' }
			});
			fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi End Session' }));

			expect(onConfirmEnd).toHaveBeenCalledWith({
				result: 'FAIL',
				actual_result: 'Bug pada tombol checkout'
			});
		});
	});

	describe('PB-5: HistoryView (Search, Project Filter, & Code Modal)', () => {
		const mockSessions: RecordingSession[] = [
			{
				id_session: 10,
				id_project: 1,
				test_case_no: 'TC-AUTH-01',
				title: 'Login Sukses User Admin',
				status: 'completed',
				result: 'PASS',
				last_sequence: 4
			},
			{
				id_session: 20,
				id_project: 2,
				test_case_no: 'TC-CHECK-02',
				title: 'Checkout Keranjang Belanja',
				status: 'completed',
				result: 'FAIL',
				last_sequence: 7
			}
		];

		const mockGenerations: GenerationItem[] = [
			{
				id_generation: 55,
				kind: 'playwright',
				status: 'completed',
				output: "test('login flow', async () => {});",
				error_message: null
			}
		];

		it('search filter: menyaring daftar sesi berdasarkan query test case no atau judul', () => {
			render(
				<HistoryView
					sessions={mockSessions}
					generations={[]}
					activeSessionId={null}
					busy={false}
					error={null}
					onRefresh={vi.fn()}
					onGenerate={vi.fn()}
					onViewGenerations={vi.fn()}
					onDownload={vi.fn()}
				/>
			);

			expect(screen.getByText('Login Sukses User Admin')).toBeTruthy();
			expect(screen.getByText('Checkout Keranjang Belanja')).toBeTruthy();

			const searchInput = screen.getByPlaceholderText('Cari test case atau judul...');
			fireEvent.change(searchInput, { target: { value: 'Keranjang' } });

			expect(screen.queryByText('Login Sukses User Admin')).toBeNull();
			expect(screen.getByText('Checkout Keranjang Belanja')).toBeTruthy();

			// Empty state jika query tidak ditemukan
			fireEvent.change(searchInput, { target: { value: 'TidakAdaData' } });
			expect(screen.getByText(/Tidak ada sesi yang cocok dengan "TidakAdaData"/)).toBeTruthy();
		});

		it('project filter: menyaring sesi berdasarkan project dropdown', () => {
			render(
				<HistoryView
					sessions={mockSessions}
					generations={[]}
					activeSessionId={null}
					busy={false}
					error={null}
					onRefresh={vi.fn()}
					onGenerate={vi.fn()}
					onViewGenerations={vi.fn()}
					onDownload={vi.fn()}
				/>
			);

			const selectEl = screen.getByRole('combobox', { name: 'Filter berdasarkan project' });
			fireEvent.change(selectEl, { target: { value: '1' } });

			expect(screen.getByText('Login Sukses User Admin')).toBeTruthy();
			expect(screen.queryByText('Checkout Keranjang Belanja')).toBeNull();
		});

		it('code preview modal: membuka dialog preview dan tombol salin/unduh berfungsi', () => {
			const onDownload = vi.fn();
			const writeTextSpy = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: {
					writeText: writeTextSpy
				}
			});

			render(
				<HistoryView
					sessions={mockSessions}
					generations={mockGenerations}
					activeSessionId={10}
					busy={false}
					error={null}
					onRefresh={vi.fn()}
					onGenerate={vi.fn()}
					onViewGenerations={vi.fn()}
					onDownload={onDownload}
				/>
			);

			// Klik preview untuk membuka Modal
			fireEvent.click(screen.getByTitle('Lihat di modal besar'));

			expect(screen.getByRole('dialog', { name: /Preview: PLAYWRIGHT/ })).toBeTruthy();
			const codeBlock = document.querySelector('.k-modal-overlay .k-code-block');
			expect(codeBlock?.textContent).toBe("test('login flow', async () => {});");

			// Klik tombol Salin Kode di dalam modal
			const copyBtn = screen.getByRole('button', { name: 'Salin Kode' });
			fireEvent.click(copyBtn);
			expect(writeTextSpy).toHaveBeenCalledWith("test('login flow', async () => {});");

			// Klik download di dalam modal
			const downloadBtn = screen.getAllByRole('button', { name: 'download' })[0];
			fireEvent.click(downloadBtn);
			expect(onDownload).toHaveBeenCalledWith(mockGenerations[0]);
		});
	});

	describe('PB-7: StartView Project Creation & Auto-Prefill URL Scenarios', () => {
		const mockProjects = [
			{ id_project: 1, name: 'Project Satu', code: 'PROJ-1', is_active: true },
			{ id_project: 2, name: 'Project Dua', code: 'PROJ-2', is_active: true }
		];

		it('RBAC: menampilkan tombol (+) hanya untuk level QA/ADMIN/SUPERADMIN, dan tersembunyi untuk level IMPLEMENTOR atau tanpa level', () => {
			// Kasus 1: User level QA
			const { rerender } = render(
				<StartView
					user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Kasus 2: User level ADMIN
			rerender(
				<StartView
					user={{ id_user: 2, username: 'admin1', nama: 'Admin One', level: 'ADMIN' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Kasus 3: User level SUPERADMIN
			rerender(
				<StartView
					user={{ id_user: 4, username: 'super1', nama: 'Super Admin', level: 'SUPERADMIN' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Kasus 4: User level IMPLEMENTOR (termasuk qatester)
			rerender(
				<StartView
					user={{ id_user: 3, username: 'imp1', nama: 'Implementor', level: 'IMPLEMENTOR' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Kasus 5: User dengan username qatester
			rerender(
				<StartView
					user={{ id_user: 5, username: 'qatester', nama: 'QA Tester' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.getByRole('button', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Kasus 6: User null (belum login)
			rerender(
				<StartView
					user={null}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);
			expect(screen.queryByRole('button', { name: 'Tambah Project Baru' })).toBeNull();
		});

		it('auto-prefill target URL dari chrome.tabs.query saat tersedia', async () => {
			const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;
			(globalThis as unknown as { chrome?: unknown }).chrome = {
				tabs: {
					query: vi.fn().mockResolvedValue([{ id: 88, url: 'https://orders.knitto.id/dashboard' }])
				}
			};

			render(
				<StartView
					user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);

			await waitFor(() => {
				const targetUrlInput = screen.getByPlaceholderText('Contoh: https://app.knitto.co.id/login') as HTMLInputElement;
				expect(targetUrlInput.value).toBe('https://orders.knitto.id/dashboard');
			});

			(globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
		});

		it('auto-prefill target URL dari window.location.href saat mount dan mengisi default base URL saat modal dibuka', async () => {
			const originalLocation = window.location;
			const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;
			delete (globalThis as unknown as { chrome?: unknown }).chrome;

			Object.defineProperty(window, 'location', {
				configurable: true,
				value: { ...originalLocation, href: 'https://erp.knitto.id/orders' }
			});

			try {
				render(
					<StartView
						user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
						projects={mockProjects}
						busy={false}
						error={null}
						onSubmit={vi.fn()}
						onNavigateHistory={vi.fn()}
						onLogout={vi.fn()}
					/>
				);

				// Target URL ter-prefill otomatis
				const targetUrlInput = screen.getByPlaceholderText('Contoh: https://app.knitto.co.id/login') as HTMLInputElement;
				await waitFor(() => {
					expect(targetUrlInput.value).toBe('https://erp.knitto.id/orders');
				});

				// Buka modal
				fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));
				expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();

				// Base URL di dalam modal ter-prefill dengan origin
				const baseUrlInput = screen.getByPlaceholderText('Contoh: https://erp.knitto.id') as HTMLInputElement;
				expect(baseUrlInput.value).toBe('https://erp.knitto.id');

				// Base URL dapat diedit oleh pengguna
				fireEvent.change(baseUrlInput, { target: { value: 'https://staging.knitto.id' } });
				expect(baseUrlInput.value).toBe('https://staging.knitto.id');
			} finally {
				Object.defineProperty(window, 'location', {
					configurable: true,
					value: originalLocation
				});
				(globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
			}
		});

		it('modal tambah project dapat ditutup via tombol Batal dan tombol Escape', () => {
			render(
				<StartView
					user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);

			// Buka modal
			fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));
			expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Tutup via Batal
			fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
			expect(screen.queryByRole('dialog', { name: 'Tambah Project Baru' })).toBeNull();

			// Buka modal kembali
			fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));
			expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();

			// Tutup via Escape key
			fireEvent.keyDown(document, { key: 'Escape' });
			expect(screen.queryByRole('dialog', { name: 'Tambah Project Baru' })).toBeNull();
		});

		it('modal tambah project: validasi min 3 karakter, submit memanggil onCreateProject dan auto-select ID project baru', async () => {
			const onCreateProject = vi.fn().mockResolvedValue(99);
			const onSubmit = vi.fn();

			render(
				<StartView
					user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
					projects={[...mockProjects, { id_project: 99, name: 'Project 99', code: 'PROJ-99', is_active: true }]}
					busy={false}
					error={null}
					onSubmit={onSubmit}
					onCreateProject={onCreateProject}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);

			// Buka modal
			fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));

			const simpanBtn = screen.getByRole('button', { name: 'Simpan Project' }) as HTMLButtonElement;
			// Nama belum diisi (< 3 karakter) -> disabled
			expect(simpanBtn.disabled).toBe(true);

			const nameInput = screen.getByPlaceholderText('Contoh: Knitto ERP Portal');
			fireEvent.change(nameInput, { target: { value: 'Project 99' } });
			expect(simpanBtn.disabled).toBe(false);

			// Klik Simpan
			await act(async () => {
				fireEvent.click(simpanBtn);
			});

			expect(onCreateProject).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Project 99'
				})
			);

			// Modal tertutup
			expect(screen.queryByRole('dialog', { name: 'Tambah Project Baru' })).toBeNull();

			// Select dropdown sekarang memilih ID 99
			const selectEl = screen.getByRole('combobox', { name: /Project/ }) as HTMLSelectElement;
			expect(selectEl.value).toBe('99');
		});

		it('modal tambah project: menampilkan pesan error inline jika pembuatan project gagal dan modal tetap terbuka', async () => {
			const onCreateProject = vi.fn().mockRejectedValue(new Error('Project code already exists'));

			render(
				<StartView
					user={{ id_user: 1, username: 'qa1', nama: 'QA One', level: 'QA' }}
					projects={mockProjects}
					busy={false}
					error={null}
					onSubmit={vi.fn()}
					onCreateProject={onCreateProject}
					onNavigateHistory={vi.fn()}
					onLogout={vi.fn()}
				/>
			);

			// Buka modal
			fireEvent.click(screen.getByRole('button', { name: 'Tambah Project Baru' }));

			const nameInput = screen.getByPlaceholderText('Contoh: Knitto ERP Portal');
			fireEvent.change(nameInput, { target: { value: 'Duplicated Project' } });

			const simpanBtn = screen.getByRole('button', { name: 'Simpan Project' }) as HTMLButtonElement;
			await act(async () => {
				fireEvent.click(simpanBtn);
			});

			expect(screen.getByText('Project code already exists')).toBeTruthy();
			// Modal tetap terbuka agar user dapat memperbaiki input
			expect(screen.getByRole('dialog', { name: 'Tambah Project Baru' })).toBeTruthy();
		});
	});
});
