// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestCaseResultModal } from '../views/TestCaseResultModal';
import type { RecordingApiClient, TestCaseItem } from '../../../recording/apiClient';

describe('TestCaseResultModal', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const mockTestCase: TestCaseItem = {
		id_test_case: 101,
		id_project: 1,
		test_type: '+',
		test_case_id: 'TC-AUTH-01',
		title: 'Login dengan kredensial benar',
		status: 'Passed',
		actual_result: 'Redirect dashboard berhasil'
	};

	const mockSessionDetail = {
		id_session: 77,
		id_project: 1,
		id_test_case: 101,
		test_case_no: 'TC-AUTH-01',
		title: 'Login dengan kredensial benar',
		status: 'completed',
		result: 'PASS',
		actual_result: 'Redirect dashboard berhasil',
		last_sequence: 3,
		checkpoints: [
			{ id_checkpoint: 1, sequence: 1, note: 'Buka URL login portal' },
			{ id_checkpoint: 2, sequence: 2, note: 'Ketik username dan password' },
			{ id_checkpoint: 3, sequence: 3, note: 'Klik tombol login' }
		]
	};

	const mockGenerations = {
		items: [
			{
				id_generation: 1,
				kind: 'playwright',
				status: 'completed',
				output: "test('login flow', async ({ page }) => { await page.goto('/login'); });",
				error_message: null
			}
		]
	};

	const createMockApi = () =>
		({
			getSession: vi.fn().mockResolvedValue(mockSessionDetail),
			getSessionVideo: vi.fn().mockResolvedValue({ video_url: 'http://localhost:9000/videos/session-77.webm' }),
			listGenerations: vi.fn().mockResolvedValue(mockGenerations),
			generateOutputs: vi.fn().mockResolvedValue({ success: true }),
			generateShareUrl: vi.fn().mockResolvedValue({
				share_token: 'token-abc-123',
				share_url: 'http://localhost:8010/share/token-abc-123'
			})
		}) as unknown as RecordingApiClient;

	it('tidak me-render apapun jika open bernilai false', () => {
		const mockApi = createMockApi();
		render(
			<TestCaseResultModal
				open={false}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		expect(screen.queryByRole('dialog')).toBeNull();
		expect(mockApi.getSession).not.toHaveBeenCalled();
	});

	it('memuat data sesi, checkpoints, dan kode Playwright saat modal terbuka', async () => {
		const mockApi = createMockApi();
		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(mockApi.getSession).toHaveBeenCalledWith(77);
			expect(mockApi.listGenerations).toHaveBeenCalledWith(77);
		});

		// Header & info sesi
		expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		expect(screen.getByText('PASSED')).toBeTruthy();
		expect(screen.getByText('Redirect dashboard berhasil')).toBeTruthy();

		// Tab Navigation
		expect(screen.getByRole('tab', { name: /Ikhtisar & Video/i })).toBeTruthy();
		expect(screen.getByRole('tab', { name: /Checkpoints/i })).toBeTruthy();
		expect(screen.getByRole('tab', { name: /Script Playwright/i })).toBeTruthy();

		// Checkpoints Tab
		fireEvent.click(screen.getByRole('tab', { name: /Checkpoints/i }));
		expect(screen.getByText(/Daftar Checkpoint Interaksi \(3\)/i)).toBeTruthy();
		expect(screen.getByText('Buka URL login portal')).toBeTruthy();
		expect(screen.getByText('Klik tombol login')).toBeTruthy();

		// Script Tab
		fireEvent.click(screen.getByRole('tab', { name: /Script Playwright/i }));
		expect(screen.getByText(/login flow/)).toBeTruthy();
		expect(screen.getByRole('button', { name: /Salin/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /Unduh/i })).toBeTruthy();
	});

	it('klik Salin Kode menyalin output ke clipboard', async () => {
		const mockApi = createMockApi();
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock
			}
		});

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('tab', { name: /Script Playwright/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('tab', { name: /Script Playwright/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Salin/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Salin/i }));

		await waitFor(() => {
			expect(writeTextMock).toHaveBeenCalledWith(mockGenerations.items[0].output);
			expect(screen.getByText('Tersalin!')).toBeTruthy();
		});
	});

	it('klik Generate Script memanggil generateOutputs dan me-refresh daftar kode', async () => {
		const mockApi = createMockApi();
		(mockApi.listGenerations as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ items: [] })
			.mockResolvedValueOnce(mockGenerations);

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Generate Script/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Generate Script/i }));

		await waitFor(() => {
			expect(mockApi.generateOutputs).toHaveBeenCalledWith(77);
			expect(mockApi.listGenerations).toHaveBeenCalledTimes(2);
			expect(screen.getByText(/login flow/)).toBeTruthy();
		});
	});

	it('menutup modal saat tombol Tutup atau tombol X diklik', async () => {
		const mockApi = createMockApi();
		const onClose = vi.fn();

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={onClose}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Tutup' })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
		expect(onClose).toHaveBeenCalled();
	});

	it('me-render badge status FAILED dan BLOCKED sesuai hasil pengujian', async () => {
		const mockApi = createMockApi();
		(mockApi.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...mockSessionDetail,
			result: 'FAIL'
		});

		const { rerender } = render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('FAILED')).toBeTruthy();
		});

		(mockApi.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...mockSessionDetail,
			result: 'BLOCKED'
		});

		rerender(
			<TestCaseResultModal
				open={true}
				sessionId={78}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('BLOCKED')).toBeTruthy();
		});
	});

	it('menampilkan pesan placeholder saat sesi tidak memiliki checkpoint interaksi', async () => {
		const mockApi = createMockApi();
		(mockApi.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...mockSessionDetail,
			checkpoints: []
		});

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('tab', { name: /Checkpoints/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('tab', { name: /Checkpoints/i }));

		await waitFor(() => {
			expect(
				screen.getByText('Tidak ada checkpoint manual dicatat selama perekaman ini.')
			).toBeTruthy();
			expect(screen.getByText(/Daftar Checkpoint Interaksi \(0\)/i)).toBeTruthy();
		});
	});

	it('klik Download memicu pembuatan blob dan unduhan file .ts', async () => {
		const mockApi = createMockApi();
		const onShowToast = vi.fn();

		const originalCreateObjectURL = window.URL.createObjectURL;
		const originalRevokeObjectURL = window.URL.revokeObjectURL;
		window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
				onShowToast={onShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('tab', { name: /Script Playwright/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('tab', { name: /Script Playwright/i }));

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Unduh/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Unduh/i }));

		expect(window.URL.createObjectURL).toHaveBeenCalled();
		expect(onShowToast).toHaveBeenCalledWith(
			expect.stringContaining('TC-AUTH-01-playwright.ts'),
			'success'
		);

		await waitFor(
			() => {
				expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
			},
			{ timeout: 1500 }
		);

		window.URL.createObjectURL = originalCreateObjectURL;
		window.URL.revokeObjectURL = originalRevokeObjectURL;
	});

	it('menampilkan pesan error jika getSession gagal dan tombol Coba Lagi memicu pemanggilan ulang', async () => {
		const mockApi = createMockApi();
		(mockApi.getSession as unknown as ReturnType<typeof vi.fn>)
			.mockRejectedValueOnce(new Error('Koneksi server terputus'))
			.mockResolvedValueOnce(mockSessionDetail);

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText('Koneksi server terputus')).toBeTruthy();
			expect(screen.getByRole('button', { name: 'Coba Muat Ulang' })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Coba Muat Ulang' }));

		await waitFor(() => {
			expect(mockApi.getSession).toHaveBeenCalledTimes(2);
			expect(screen.getByText('PASSED')).toBeTruthy();
		});
	});

	it('klik tombol Bagikan memanggil api.generateShareUrl dan menyalin link debug ke clipboard', async () => {
		const mockApi = createMockApi();
		const onShowToast = vi.fn();
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock
			}
		});

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
				onShowToast={onShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Bagikan/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Bagikan/i }));

		await waitFor(() => {
			expect(mockApi.generateShareUrl).toHaveBeenCalledWith(77);
			expect(writeTextMock).toHaveBeenCalledWith('http://localhost:8010/share/token-abc-123');
			expect(onShowToast).toHaveBeenCalledWith(
				expect.stringContaining('Link debug berhasil disalin'),
				'success'
			);
		});
	});

	it('me-render video player jika sesi memiliki video_url rekaman WebM', async () => {
		const mockApi = createMockApi();
		(mockApi.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			...mockSessionDetail,
			video_url: 'http://localhost:9000/qa-recording-artifacts/sessions/1/video.webm'
		});

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText(/Rekaman Video Pengujian \(WebM\)/i)).toBeTruthy();
			const videoEl = document.querySelector('video');
			expect(videoEl).toBeTruthy();
			expect(videoEl?.getAttribute('src')).toBe(
				'http://localhost:9000/qa-recording-artifacts/sessions/1/video.webm'
			);
		});
	});

	it('klik tombol Re-run membuka ReRunModal dengan parameter yang diekstrak', async () => {
		const mockApi = createMockApi();

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			const rerunBtn = screen.getByRole('button', { name: /^Re-run$/i }) as HTMLButtonElement;
			expect(rerunBtn).toBeTruthy();
			expect(rerunBtn.disabled).toBe(false);
		});

		fireEvent.click(screen.getByRole('button', { name: /^Re-run$/i }));

		await waitFor(() => {
			expect(screen.getByText(/Re-run Dinamis: TC-AUTH-01/i)).toBeTruthy();
			expect(screen.getAllByRole('button', { name: /Mulai Re-run/i }).length).toBeGreaterThan(0);
		});
	});

	it('tombol Re-run berstatus disabled saat script Playwright belum terbuat', async () => {
		const mockApi = createMockApi();
		(mockApi.listGenerations as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [] });

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			const rerunBtn = screen.getByRole('button', { name: /^Re-run$/i }) as HTMLButtonElement;
			expect(rerunBtn).toBeTruthy();
			expect(rerunBtn.disabled).toBe(true);
			expect(rerunBtn.getAttribute('title')).toContain('Script otomasi belum terbuat');
		});
	});

	it('klik tombol Bagikan menggunakan fallback execCommand copy jika clipboard.writeText error', async () => {
		const mockApi = createMockApi();
		const onShowToast = vi.fn();
		const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard permission denied'));
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock
			}
		});

		const originalExecCommand = document.execCommand;
		document.execCommand = vi.fn().mockReturnValue(true);

		try {
			render(
				<TestCaseResultModal
					open={true}
					sessionId={77}
					testCase={mockTestCase}
					api={mockApi}
					onClose={vi.fn()}
					onShowToast={onShowToast}
				/>
			);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /Bagikan/i })).toBeTruthy();
			});

			fireEvent.click(screen.getByRole('button', { name: /Bagikan/i }));

			await waitFor(() => {
				expect(mockApi.generateShareUrl).toHaveBeenCalledWith(77);
				expect(document.execCommand).toHaveBeenCalledWith('copy');
				expect(onShowToast).toHaveBeenCalledWith(
					expect.stringContaining('Link debug berhasil disalin'),
					'success'
				);
			});
		} finally {
			document.execCommand = originalExecCommand;
		}
	});

	it('menampilkan toast error jika generateShareUrl gagal', async () => {
		const mockApi = createMockApi();
		(mockApi.generateShareUrl as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error('Gagal menghubungi backend')
		);
		const onShowToast = vi.fn();

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				onClose={vi.fn()}
				onShowToast={onShowToast}
			/>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Bagikan/i })).toBeTruthy();
		});

		fireEvent.click(screen.getByRole('button', { name: /Bagikan/i }));

		await waitFor(() => {
			expect(onShowToast).toHaveBeenCalledWith('Gagal menghubungi backend', 'error');
		});
	});
});
