// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectView } from '../views/ProjectView';
import type { RecordingApiClient, RecordingProject, TestCaseItem } from '../../../recording/apiClient';

describe('ProjectView & Test Case Spreadsheet Management', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const mockProjects: RecordingProject[] = [
		{ id_project: 1, name: 'Knitto Portal', code: 'knitto-portal', is_active: true, base_url: 'https://portal.knitto.co.id' },
		{ id_project: 2, name: 'Mobile App', code: 'mobile-app', is_active: true, base_url: 'https://m.knitto.co.id' }
	];

	const mockTestCases: TestCaseItem[] = [
		{
			id_test_case: 101,
			id_project: 1,
			group_no: '1.0',
			feature: 'Authentication',
			process_no: 'FC-01',
			test_type: '+',
			test_case_id: 'TC-AUTH-01',
			test_variable: 'Valid Login',
			title: 'Login dengan kredensial benar',
			pre_condition: 'User sudah terdaftar',
			test_data: 'tester / pass',
			test_steps: '1. Buka URL\n2. Input data\n3. Klik Login',
			expected_result: 'Redirect ke dashboard',
			actual_result: null,
			status: 'Passed',
			evidence: null
		},
		{
			id_test_case: 102,
			id_project: 1,
			group_no: '1.0',
			feature: 'Authentication',
			process_no: 'FC-02',
			test_type: '-',
			test_case_id: 'TC-AUTH-02',
			test_variable: 'Wrong Password',
			title: 'Login dengan password salah',
			pre_condition: 'User terdaftar',
			test_data: 'tester / wrong',
			test_steps: '1. Buka URL\n2. Input pass salah\n3. Klik Login',
			expected_result: 'Muncul pesan error Password Salah',
			actual_result: 'Pesan error muncul',
			status: 'Failed',
			evidence: 'Session #10',
			last_session_id: 88
		}
	];

	const mockSummary = {
		total: 2,
		passed: 1,
		failed: 1,
		re_test: 0,
		progress: 0,
		skip: 0
	};

	const createMockApi = () =>
		({
			listTestCases: vi.fn().mockResolvedValue({
				items: mockTestCases,
				total: 2,
				page: 1,
				limit: 50,
				summary: mockSummary
			}),
			createTestCase: vi.fn().mockResolvedValue(mockTestCases[0]),
			updateTestCase: vi.fn().mockResolvedValue(mockTestCases[0]),
			deleteTestCase: vi.fn().mockResolvedValue({ success: true }),
			importTestCases: vi.fn().mockResolvedValue({
				result: { total: 2, inserted: 2, updated: 0 },
				summary: mockSummary
			}),
			listSessions: vi.fn().mockResolvedValue({
				items: [
					{
						id_session: 88,
						id_project: 1,
						id_test_case: 102,
						test_case_no: 'TC-AUTH-02',
						title: 'Login dengan password salah',
						status: 'completed',
						result: 'FAIL',
						actual_result: 'Pesan error muncul',
						last_sequence: 5
					}
				]
			}),
			getSession: vi.fn().mockResolvedValue({
				id_session: 88,
				id_project: 1,
				id_test_case: 102,
				test_case_no: 'TC-AUTH-02',
				title: 'Login dengan password salah',
				status: 'completed',
				result: 'FAIL',
				actual_result: 'Pesan error muncul',
				last_sequence: 5,
				checkpoints: [{ id_checkpoint: 1, note: 'Buka form login', sequence: 1 }]
			}),
			listGenerations: vi.fn().mockResolvedValue({
				items: [{ id_generation: 1, kind: 'playwright', status: 'completed', output: "test('fail', async () => {});", error_message: null }]
			})
		}) as unknown as RecordingApiClient;

	it('menampilkan daftar project di catalog view dan memfilter berdasarkan pencarian', () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		expect(screen.getByText('Knitto Portal')).toBeTruthy();
		expect(screen.getByText('Mobile App')).toBeTruthy();

		// Cari "Portal"
		const searchInput = screen.getByPlaceholderText('Cari nama atau kode project...');
		fireEvent.change(searchInput, { target: { value: 'Portal' } });

		expect(screen.getByText('Knitto Portal')).toBeTruthy();
		expect(screen.queryByText('Mobile App')).toBeNull();
	});

	it('klik project card membuka spreadsheet-style test case view dan memuat summary KPI', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		// Klik project card "Knitto Portal"
		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(mockApi.listTestCases).toHaveBeenCalledWith(1, expect.any(Object));
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
			expect(screen.getByText('Login dengan kredensial benar')).toBeTruthy();
			expect(screen.getByText('TC-AUTH-02')).toBeTruthy();
		});

		// Verifikasi KPI chips muncul
		expect(screen.getByText('Total: 2')).toBeTruthy();
		expect(screen.getByText('Passed: 1')).toBeTruthy();
		expect(screen.getByText('Failed: 1')).toBeTruthy();
	});

	it('klik tombol Rekam pada baris test case memanggil callback onSelectTestCaseForRecording', async () => {
		const mockApi = createMockApi();
		const onSelectTestCaseForRecording = vi.fn();

		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={onSelectTestCaseForRecording}
				onShowToast={vi.fn()}
			/>
		);

		// Pilih project
		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		// Klik tombol Rekam untuk TC-AUTH-01
		const rekamButtons = screen.getAllByTitle(/Rekam Skenario Ini/i);
		expect(rekamButtons.length).toBe(2);

		fireEvent.click(rekamButtons[0]);

		expect(onSelectTestCaseForRecording).toHaveBeenCalledWith(
			mockProjects[0],
			mockTestCases[0]
		);
	});

	it('membuka modal Import Test Case saat tombol Import Excel/CSV diklik (single-mode: link only)', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		// Pilih project
		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		// Klik tombol Import Excel/CSV
		fireEvent.click(screen.getByRole('button', { name: /Import Excel/i }));

		// Modal Import muncul dalam mode single (Link Google Spreadsheet)
		expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
		expect(screen.getByText('URL Google Spreadsheet')).toBeTruthy();
		expect(screen.getByText(/Persyaratan Akses Publik/i)).toBeTruthy();

		// Tab "Upload File" tidak ada lagi
		expect(screen.queryByRole('button', { name: /Upload File/i })).toBeNull();
		expect(screen.queryByText('Klik atau seret file spreadsheet ke sini')).toBeNull();
	});

	it('filter status menyaring daftar test case yang direquest ke API', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		// Pilih project
		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		// Ganti status dropdown ke Passed
		const statusSelect = screen.getByRole('combobox') as HTMLSelectElement;
		fireEvent.change(statusSelect, { target: { value: 'Passed' } });

		await waitFor(() => {
			expect(mockApi.listTestCases).toHaveBeenCalledWith(
				1,
				expect.objectContaining({ status: 'Passed' })
			);
		});
	});

	it('modal import mendeteksi GID dari link Google Spreadsheet dan dapat menarik data', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));
		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		// Buka modal import
		fireEvent.click(screen.getByRole('button', { name: /Import Excel/i }));

		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i);
		expect(urlInput).toBeTruthy();

		// Tempel URL Google Sheets dengan GID
		fireEvent.change(urlInput, {
			target: {
				value:
					'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=1730053292#gid=1730053292'
			}
		});

		// Indikator GID terdeteksi muncul
		expect(screen.getByText(/Sheet GID terdeteksi: 1730053292/i)).toBeTruthy();

		// Tombol Tarik Data Spreadsheet aktif
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i });
		expect(fetchBtn).toBeTruthy();
		expect((fetchBtn as HTMLButtonElement).disabled).toBe(false);
	});

	// -----------------------------------------------------------------------
	// C-01 to C-06 — EmptyStateTestCase integration in ProjectView
	// -----------------------------------------------------------------------

	const createEmptyMockApi = () =>
		({
			listTestCases: vi.fn().mockResolvedValue({
				items: [],
				total: 0,
				page: 1,
				limit: 50,
				summary: { total: 0, passed: 0, failed: 0, re_test: 0, progress: 0, skip: 0 }
			}),
			createTestCase: vi.fn().mockResolvedValue({}),
			updateTestCase: vi.fn().mockResolvedValue({}),
			deleteTestCase: vi.fn().mockResolvedValue({ success: true }),
			importTestCases: vi.fn().mockResolvedValue({
				result: { total: 0, inserted: 0, updated: 0 },
				summary: { total: 0, passed: 0, failed: 0, re_test: 0, progress: 0, skip: 0 }
			})
		}) as unknown as RecordingApiClient;

	// C-01: EmptyStateTestCase shown when 0 test cases
	it('C-01: EmptyStateTestCase ditampilkan saat project tidak punya test case', async () => {
		const mockApi = createEmptyMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('Belum ada test case di project ini')).toBeTruthy();
			expect(screen.getByText('Template Sistem')).toBeTruthy();
			expect(screen.getByText('Struktur Sendiri')).toBeTruthy();
		});
	});

	// C-02: EmptyStateTestCase NOT shown when test cases exist
	it('C-02: EmptyStateTestCase tidak muncul saat test case tersedia', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		expect(screen.queryByText('Belum ada test case di project ini')).toBeNull();
		expect(screen.queryByText('Template Sistem')).toBeNull();
	});

	// C-03: Template Sistem CTA opens modal with prefillUrl
	it('C-03: klik "Template Sistem" membuka modal dengan prefillUrl terisi dan GID terdeteksi', async () => {
		const mockApi = createEmptyMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('Template Sistem')).toBeTruthy();
		});

		fireEvent.click(screen.getByText('Template Sistem'));

		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
			// URL input should be filled with the system template URL
			const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
			expect(urlInput.value).toContain('docs.google.com/spreadsheets');
			// GID detection should be active
			expect(screen.getByText(/Sheet GID terdeteksi/i)).toBeTruthy();
		});
	});

	// C-04: Struktur Sendiri CTA opens modal with empty URL
	it('C-04: klik "Struktur Sendiri" membuka modal dengan URL kosong', async () => {
		const mockApi = createEmptyMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('Struktur Sendiri')).toBeTruthy();
		});

		fireEvent.click(screen.getByText('Struktur Sendiri'));

		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
		});

		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(urlInput.value).toBe('');
		expect(screen.queryByText(/Sheet GID terdeteksi/i)).toBeNull();
	});

	// C-05: Header Import button opens modal with empty URL (no prefill)
	it('C-05: tombol "Import Excel / CSV" di header membuka modal dengan URL kosong', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Import Excel/i }));

		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
		});

		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(urlInput.value).toBe('');
		expect(screen.queryByText(/Sheet GID terdeteksi/i)).toBeNull();
	});

	// C-06: Modal close resets importPrefillUrl, next open via header has empty URL
	it('C-06: menutup modal mereset prefillUrl sehingga pembukaan berikutnya via header tetap kosong', async () => {
		const mockApi = createEmptyMockApi();
		const { rerender } = render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('Template Sistem')).toBeTruthy();
		});

		// Open via Template (sets prefillUrl)
		fireEvent.click(screen.getByText('Template Sistem'));

		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
			expect(screen.getByText(/Sheet GID terdeteksi/i)).toBeTruthy();
		});

		// Close via Batal button
		fireEvent.click(screen.getByRole('button', { name: /Batal/i }));

		await waitFor(() => {
			expect(screen.queryByRole('dialog', { name: /Import Test Case/i })).toBeNull();
		});

		// Re-render with non-empty test cases so header Import button appears and is accessible
		rerender(
			<ProjectView
				projects={mockProjects}
				api={createMockApi()}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		// Now open via header Import button
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Import Excel/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Import Excel/i }));

		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
		});

		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(urlInput.value).toBe('');
	});

	it('klik tombol Hasil pada baris test case membuka TestCaseResultModal', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Knitto Portal')).toBeTruthy();
		});

		// Klik project untuk membuka daftar test case
		fireEvent.click(screen.getByText('Knitto Portal'));

		// Tunggu sampai test case muncul dan periksa tombol Hasil
		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-02')).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Hasil TC-AUTH-02' })).toBeTruthy();
		});

		// Klik tombol Hasil
		fireEvent.click(screen.getByRole('button', { name: 'Hasil TC-AUTH-02' }));

		// Modal detail hasil rekaman terbuka
		await waitFor(() => {
			expect(screen.getByRole('dialog', { name: /Hasil Rekaman: TC-AUTH-02/i })).toBeTruthy();
			expect(mockApi.getSession).toHaveBeenCalledWith(88);
		});
	});

	it('tab switcher Project: berpindah ke tab Riwayat Sesi Project dan memuat sesi project', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Knitto Portal')).toBeTruthy();
		});

		// Klik project
		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByRole('tab', { name: /Riwayat Sesi Project/i })).toBeTruthy();
		});

		// Klik tab Riwayat Sesi Project
		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Sesi Project/i }));

		await waitFor(() => {
			expect(mockApi.listSessions).toHaveBeenCalledWith({ id_project: 1, perPage: 100 });
			expect(screen.getByText('#Session 88')).toBeTruthy();
			expect(screen.getByText('Login dengan password salah')).toBeTruthy();
		});
	});

	it('tombol Hasil tidak muncul pada baris test case tanpa last_session_id', async () => {
		const mockApi = createMockApi();
		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		});

		// TC-AUTH-01 tidak punya last_session_id
		expect(screen.queryByRole('button', { name: 'Hasil TC-AUTH-01' })).toBeNull();
		// TC-AUTH-02 punya last_session_id
		expect(screen.getByRole('button', { name: 'Hasil TC-AUTH-02' })).toBeTruthy();
	});

	it('input pencarian pada tab Riwayat Sesi Project menyaring sesi berdasarkan judul / nomor test case', async () => {
		const mockApi = createMockApi();
		(mockApi.listSessions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
			items: [
				{
					id_session: 88,
					id_project: 1,
					id_test_case: 102,
					test_case_no: 'TC-AUTH-02',
					title: 'Login dengan password salah',
					status: 'completed',
					result: 'FAIL',
					last_sequence: 5
				},
				{
					id_session: 89,
					id_project: 1,
					id_test_case: 103,
					test_case_no: 'TC-CHECKOUT-01',
					title: 'Checkout order barang',
					status: 'completed',
					result: 'PASS',
					last_sequence: 8
				}
			]
		});

		render(
			<ProjectView
				projects={mockProjects}
				api={mockApi}
				canCreateProject={true}
				onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
				onCreateProject={vi.fn().mockResolvedValue(1)}
				onSelectTestCaseForRecording={vi.fn()}
				onShowToast={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByText('Knitto Portal'));

		await waitFor(() => {
			expect(screen.getByRole('tab', { name: /Riwayat Sesi Project/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('tab', { name: /Riwayat Sesi Project/i }));

		await waitFor(() => {
			expect(screen.getByText('#Session 88')).toBeTruthy();
			expect(screen.getByText('#Session 89')).toBeTruthy();
		});

		// Cari "Checkout"
		const searchInput = screen.getByPlaceholderText('Cari judul rekaman atau ID skenario...');
		fireEvent.change(searchInput, { target: { value: 'Checkout' } });

		expect(screen.queryByText('#Session 88')).toBeNull();
		expect(screen.getByText('#Session 89')).toBeTruthy();
	});
});
