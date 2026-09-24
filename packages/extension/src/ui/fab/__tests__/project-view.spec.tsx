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
			evidence: 'Session #10'
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

	it('membuka modal Import Test Case saat tombol Import Excel/CSV diklik', async () => {
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

		// Modal Import muncul dengan tab Link Google Spreadsheet aktif secara default
		expect(screen.getByRole('dialog', { name: /Import Test Case/i })).toBeTruthy();
		expect(screen.getByText('URL Google Spreadsheet')).toBeTruthy();
		expect(screen.getByText(/Persyaratan Akses Publik/i)).toBeTruthy();

		// Pindah ke tab Upload File
		fireEvent.click(screen.getByRole('button', { name: /Upload File/i }));
		expect(screen.getByText('Klik atau seret file spreadsheet ke sini')).toBeTruthy();
		expect(screen.getByText(/Mendukung \.xlsx/i)).toBeTruthy();
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
});
