// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestCaseResultModal } from '../views/TestCaseResultModal';
import type { RecordingApiClient, TestCaseItem } from '../../../recording/apiClient';

describe('TestCaseResultModal', () => {
	const originalCreateObjectURL = window.URL.createObjectURL;
	const originalRevokeObjectURL = window.URL.revokeObjectURL;

	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		window.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:mock-blob-url');
		window.URL.revokeObjectURL = vi.fn();
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
		window.URL.createObjectURL = originalCreateObjectURL;
		window.URL.revokeObjectURL = originalRevokeObjectURL;
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

	it('otomatis memuat status background generation dan menampilkan kode saat selesai', async () => {
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
			expect(mockApi.listGenerations).toHaveBeenCalled();
			expect(screen.getByText('Script Siap')).toBeTruthy();
		}, { timeout: 3500 });

		fireEvent.click(screen.getByRole('tab', { name: /Script Playwright/i }));

		await waitFor(() => {
			expect(screen.getByText(/login flow/)).toBeTruthy();
		}, { timeout: 3500 });
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

	it('menutup modal saat area luar modal (backdrop overlay) diklik', async () => {
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
			expect(screen.getByRole('dialog')).toBeTruthy();
		});

		const overlay = screen.getByRole('dialog');
		fireEvent.click(overlay);
		expect(onClose).toHaveBeenCalledTimes(1);
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
			expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0);
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
			expect(screen.getAllByText('BLOCKED').length).toBeGreaterThan(0);
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
			expect(rerunBtn.getAttribute('title')).toContain('Script');
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

	it('Historical Runs: eksekusi re-run menambahkan Run #2, memungkinkan switching antar run dan memperbarui video playback URL', async () => {
		const mockApi = createMockApi();
		(mockApi.listGenerations as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
			items: [
				{
					id_generation: 1,
					kind: 'playwright',
					status: 'completed',
					output: "test('login flow', async ({ page }) => { await page.goto('/login'); await page.fill('#email', 'admin@knitto.com'); });",
					error_message: null
				}
			]
		});
		const onShowToast = vi.fn();

		const originalChrome = globalThis.chrome;
		const originalCreateObjectURL = window.URL.createObjectURL;
		const originalRevokeObjectURL = window.URL.revokeObjectURL;
		window.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:mock-video-url');
		window.URL.revokeObjectURL = vi.fn();

		const sendMessageMock = vi.fn((message, callback) => {
			if (message.type === 'replay:run') {
				callback?.({
					success: true,
					result: { success: true, totalSteps: 3, executedSteps: 3 },
					videoUrl: 'http://localhost:9000/videos/session-77-rerun.webm'
				});
			} else if (message.type === 'media:fetchBlobUrl') {
				callback?.({
					success: true,
					dataUrl: 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAA'
				});
			}
		});

		globalThis.chrome = {
			...originalChrome,
			runtime: {
				sendMessage: sendMessageMock
			}
		} as unknown as typeof chrome;

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
				expect(screen.getByText('Riwayat Eksekusi (Historical Runs): 1 Run')).toBeTruthy();
				expect(screen.getByText('Run #1 (Asli)')).toBeTruthy();
			});

			// Buka ReRunModal
			const rerunHeaderBtn = screen.getByRole('button', { name: /^Re-run$/i });
			fireEvent.click(rerunHeaderBtn);

			await waitFor(() => {
				expect(screen.getByText(/Re-run Dinamis: TC-AUTH-01/i)).toBeTruthy();
			});

			// Pilih opsi kecepatan Cepat & ganti parameter
			const fastBtn = screen.getByRole('button', { name: /Cepat/i });
			fireEvent.click(fastBtn);

			const emailInput = screen.getByLabelText(/Override nilai untuk Email/i);
			fireEvent.change(emailInput, { target: { value: 'rerun-user@knitto.com' } });

			// Klik Mulai Re-run di modal
			const startReRunBtn = screen.getAllByRole('button', { name: /Mulai Re-run/i })[0];
			fireEvent.click(startReRunBtn);

			// Verifikasi Run #2 (Re-run) muncul di riwayat eksekusi
			await waitFor(() => {
				expect(screen.getByText('Riwayat Eksekusi (Historical Runs): 2 Run')).toBeTruthy();
				expect(screen.getByText('Run #2 (Re-run)')).toBeTruthy();
				expect(screen.getByText(/Pacing: FAST/i)).toBeTruthy();
				expect(screen.getByText(/Parameter Overrides:/i)).toBeTruthy();
				expect(screen.getByText(/#email = "rerun-user@knitto.com"/i)).toBeTruthy();
			});

			// Verifikasi video player dan link eksternal menampilkan URL video re-run
			await waitFor(() => {
				const externalLink = screen.getByRole('link', { name: /Buka di Tab Baru/i });
				expect(externalLink.getAttribute('href')).toBe('http://localhost:9000/videos/session-77-rerun.webm');
				const currentVideo = document.querySelector('video');
				expect(currentVideo).toBeTruthy();
				expect(currentVideo?.getAttribute('src')).toBe('blob:mock-video-url');
			});

			// Klik kembali ke Run #1 (Asli)
			const run1Btn = screen.getByRole('button', { name: /Run #1 \(Asli\)/i });
			fireEvent.click(run1Btn);

			// Video kembali ke URL asli dan parameter overrides tidak tampil
			await waitFor(() => {
				const externalLink = screen.getByRole('link', { name: /Buka di Tab Baru/i });
				expect(externalLink.getAttribute('href')).toBe('http://localhost:9000/videos/session-77.webm');
				expect(screen.queryByText(/Parameter Overrides:/i)).toBeNull();
			});

			// Klik lagi ke Run #2 (Re-run)
			const run2Btn = screen.getByRole('button', { name: /Run #2 \(Re-run\)/i });
			fireEvent.click(run2Btn);

			await waitFor(() => {
				const externalLink = screen.getByRole('link', { name: /Buka di Tab Baru/i });
				expect(externalLink.getAttribute('href')).toBe('http://localhost:9000/videos/session-77-rerun.webm');
				expect(screen.getByText(/Parameter Overrides:/i)).toBeTruthy();
			});
		} finally {
			globalThis.chrome = originalChrome;
			window.URL.createObjectURL = originalCreateObjectURL;
			window.URL.revokeObjectURL = originalRevokeObjectURL;
		}
	});

	it('Storage & Cookies Tab: memuat dan menampilkan snapshot cookies dan localStorage', async () => {
		const mockStorageState = {
			cookies: [
				{
					name: 'session_token',
					value: 'jwt-xyz-789',
					domain: 'knitto.test',
					path: '/',
					expires: 1735689600,
					httpOnly: true,
					secure: true,
					sameSite: 'Lax' as const
				}
			],
			origins: [
				{
					origin: 'https://knitto.test',
					localStorage: [{ name: 'auth_user', value: 'tester_01' }],
					sessionStorage: [{ name: 'tab_flow', value: 'checkout' }]
				}
			]
		};

		const mockApi = {
			...createMockApi(),
			listArtifacts: vi.fn().mockResolvedValue({
				items: [{ id_artifact: 501, kind: 'storage_state' }]
			}),
			getArtifactDownloadUrl: vi.fn().mockResolvedValue({
				download_url: 'http://localhost:9000/artifacts/storage_state.json'
			})
		} as unknown as RecordingApiClient;

		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockStorageState
		}) as unknown as typeof fetch;

		try {
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
			});

			// Klik Tab Storage & Cookies
			const storageTabBtn = screen.getByRole('tab', { name: /Storage & Cookies/i });
			fireEvent.click(storageTabBtn);

			// Verifikasi Cookies ditampilkan
			await waitFor(() => {
				expect(screen.getByText('Browser Context State Snapshot')).toBeTruthy();
				expect(screen.getByText('session_token')).toBeTruthy();
				expect(screen.getByText('knitto.test')).toBeTruthy();
				expect(screen.getByText('HttpOnly')).toBeTruthy();
				expect(screen.getByText('Secure')).toBeTruthy();
			});

			// Pindah sub-tab ke LocalStorage
			const localSubTabBtn = screen.getByRole('button', { name: /LocalStorage/i });
			fireEvent.click(localSubTabBtn);

			await waitFor(() => {
				expect(screen.getByText('auth_user')).toBeTruthy();
				expect(screen.getByText('tester_01')).toBeTruthy();
			});

			// Pindah sub-tab ke SessionStorage
			const sessionSubTabBtn = screen.getByRole('button', { name: /SessionStorage/i });
			fireEvent.click(sessionSubTabBtn);

			await waitFor(() => {
				expect(screen.getByText('tab_flow')).toBeTruthy();
				expect(screen.getByText('checkout')).toBeTruthy();
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('sinkronisasi background generation: saat sesi sedang diproses di background, menampilkan Sedang Diproses dan mendisable Re-run', async () => {
		const mockApi = createMockApi();
		(mockApi.listGenerations as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [] });

		const activeGens = new Map([
			[
				77,
				{
					id_session: 77,
					title: 'Login Test',
					status: 'processing',
					startTime: Date.now()
				}
			]
		]);

		render(
			<TestCaseResultModal
				open={true}
				sessionId={77}
				testCase={mockTestCase}
				api={mockApi}
				activeGenerations={activeGens}
				onClose={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(mockApi.getSession).toHaveBeenCalledWith(77);
		});

		// Banner harus menampilkan status sedang diproses
		expect(screen.getByText(/Script Playwright & Laporan Debugging sedang diproses bersamaan/i)).toBeTruthy();
		expect(screen.getByText('Sedang Diproses...')).toBeTruthy();
		// Tidak boleh ada teks Script Siap atau tombol Generate Script manual
		expect(screen.queryByText('Script Siap')).toBeNull();
		expect(screen.queryByRole('button', { name: /Generate Script/i })).toBeNull();

		// Tombol Re-run di footer harus disabled
		const rerunBtn = screen.getByRole('button', { name: /Re-run/i }) as HTMLButtonElement;
		expect(rerunBtn.disabled).toBe(true);

		// Script Tab juga menampilkan loading box
		const scriptTabBtn = screen.getByRole('tab', { name: /Script Playwright/i });
		fireEvent.click(scriptTabBtn);

		await waitFor(() => {
			expect(screen.getByText(/Sedang Menyusun Script Playwright & Laporan Pengujian.../i)).toBeTruthy();
			expect(screen.queryByRole('button', { name: /Generate Script/i })).toBeNull();
		});
	});

	it('sinkronisasi background generation: polling otomatis memperbarui status ke Script Siap saat script selesai', async () => {
		const mockApi = createMockApi();
		// Pertama kali loadData dipanggil mengembalikan status processing
		(mockApi.listGenerations as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({
				items: [{ id_generation: 10, kind: 'playwright', status: 'processing', output: null }]
			})
			.mockResolvedValueOnce({
				items: [
					{
						id_generation: 10,
						kind: 'playwright',
						status: 'completed',
						output: "test('auto script', async ({ page }) => { await page.goto('/dashboard'); });"
					}
				]
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

		// Awalnya processing
		await waitFor(() => {
			expect(screen.getByText('Sedang Diproses...')).toBeTruthy();
		});

		// Setelah polling berjalan dan generasi selesai
		await waitFor(
			() => {
				expect(screen.getByText('Script Siap')).toBeTruthy();
				expect(screen.getByText(/Script Playwright dan Laporan Debugging siap/i)).toBeTruthy();
			},
			{ timeout: 5000 }
		);

		// Tombol Re-run menjadi aktif
		const rerunBtn = screen.getByRole('button', { name: /Re-run/i }) as HTMLButtonElement;
		expect(rerunBtn.disabled).toBe(false);
	});

	it('video player: memuat stream video via media:fetchBlobUrl dan mengonversi ke Blob URL', async () => {
		const mockApi = createMockApi();
		const originalChrome = globalThis.chrome;
		const originalCreateObjectURL = window.URL.createObjectURL;
		const originalRevokeObjectURL = window.URL.revokeObjectURL;
		const mockRevoke = vi.fn();
		window.URL.createObjectURL = vi.fn().mockImplementation(() => 'blob:https://portal.knitto.org/mock-video-blob');
		window.URL.revokeObjectURL = mockRevoke;

		const sendMessageMock = vi.fn((message, callback) => {
			if (message.type === 'media:fetchBlobUrl') {
				callback?.({
					success: true,
					dataUrl: 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAA'
				});
			}
		});

		globalThis.chrome = {
			...originalChrome,
			runtime: {
				sendMessage: sendMessageMock
			}
		} as unknown as typeof chrome;

		try {
			const { unmount } = render(
				<TestCaseResultModal
					open={true}
					sessionId={77}
					testCase={mockTestCase}
					api={mockApi}
					onClose={vi.fn()}
				/>
			);

			await waitFor(() => {
				expect(sendMessageMock).toHaveBeenCalledWith(
					expect.objectContaining({
						type: 'media:fetchBlobUrl',
						url: 'http://localhost:9000/videos/session-77.webm'
					}),
					expect.any(Function)
				);
				const videoEl = document.querySelector('video');
				expect(videoEl).toBeTruthy();
				expect(videoEl?.getAttribute('src')).toBe('blob:https://portal.knitto.org/mock-video-blob');
			});

			unmount();
			expect(mockRevoke).toHaveBeenCalledWith('blob:https://portal.knitto.org/mock-video-blob');
		} finally {
			globalThis.chrome = originalChrome;
			window.URL.createObjectURL = originalCreateObjectURL;
			window.URL.revokeObjectURL = originalRevokeObjectURL;
		}
	});

	it('video player: menampilkan error state jika media:fetchBlobUrl gagal dan tombol Coba Lagi melakukan re-fetch', async () => {
		const mockApi = createMockApi();
		const originalChrome = globalThis.chrome;
		let attempt = 0;

		const sendMessageMock = vi.fn((message, callback) => {
			if (message.type === 'media:fetchBlobUrl') {
				attempt++;
				if (attempt === 1) {
					callback?.({
						success: false,
						error: 'HTTP 404 Video Not Found'
					});
				} else {
					callback?.({
						success: true,
						dataUrl: 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAA'
					});
				}
			}
		});

		globalThis.chrome = {
			...originalChrome,
			runtime: {
				sendMessage: sendMessageMock
			}
		} as unknown as typeof chrome;

		try {
			render(
				<TestCaseResultModal
					open={true}
					sessionId={77}
					testCase={mockTestCase}
					api={mockApi}
					onClose={vi.fn()}
				/>
			);

			// Percobaan pertama gagal
			await waitFor(() => {
				expect(screen.getByText('Gagal Memuat Video')).toBeTruthy();
				expect(screen.getByText(/HTTP 404 Video Not Found/i)).toBeTruthy();
				expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeTruthy();
			});

			// Klik Coba Lagi
			const retryBtn = screen.getByRole('button', { name: /Coba Lagi/i });
			fireEvent.click(retryBtn);

			// Percobaan kedua sukses
			await waitFor(() => {
				expect(screen.queryByText('Gagal Memuat Video')).toBeNull();
				const videoEl = document.querySelector('video');
				expect(videoEl).toBeTruthy();
			});
		} finally {
			globalThis.chrome = originalChrome;
		}
	});
});
