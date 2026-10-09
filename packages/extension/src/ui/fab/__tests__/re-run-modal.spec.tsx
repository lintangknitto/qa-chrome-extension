// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReRunModal } from '../views/ReRunModal';

describe('ReRunModal', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const sampleScript = `
		await page.goto('https://app.knitto.co.id/login');
		await page.fill('#email', 'admin@knitto.com');
		await page.fill('#qty', '10');
		await page.click('#submit-btn');
	`;

	it('tidak me-render apapun jika open bernilai false', () => {
		render(
			<ReRunModal
				open={false}
				sessionId={1}
				testCaseNo="TC-01"
				title="Test Skenario"
				onClose={vi.fn()}
				onStartReRun={vi.fn()}
			/>
		);

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('mengekstrak dan menampilkan tabel parameter dari script saat modal terbuka', () => {
		render(
			<ReRunModal
				open={true}
				sessionId={1}
				testCaseNo="TC-AUTH-01"
				title="Login Skenario"
				targetUrl="https://app.knitto.co.id/login"
				script={sampleScript}
				onClose={vi.fn()}
				onStartReRun={vi.fn()}
			/>
		);

		expect(screen.getByText('TC-AUTH-01')).toBeTruthy();
		expect(screen.getByText('Login Skenario')).toBeTruthy();
		expect(screen.getByText('Parameter Input (2)')).toBeTruthy();

		expect(screen.getByText('#email')).toBeTruthy();
		expect(screen.getByText('admin@knitto.com')).toBeTruthy();
		expect(screen.getByText('#qty')).toBeTruthy();
		expect(screen.getByText('10')).toBeTruthy();
	});

	it('tombol Acak Data mengubah nilai parameter dan Reset mengembalikan nilai asli', () => {
		render(
			<ReRunModal
				open={true}
				sessionId={1}
				testCaseNo="TC-AUTH-01"
				title="Login Skenario"
				script={sampleScript}
				onClose={vi.fn()}
				onStartReRun={vi.fn()}
			/>
		);

		const emailInput = screen.getByLabelText(/Override nilai untuk Email/i) as HTMLInputElement;
		expect(emailInput.value).toBe('admin@knitto.com');

		// Acak Data
		fireEvent.click(screen.getByRole('button', { name: /Acak Data/i }));
		expect(emailInput.value).not.toBe('admin@knitto.com');
		expect(emailInput.value).toContain('@knitto.test');

		// Reset
		fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
		expect(emailInput.value).toBe('admin@knitto.com');
	});

	it('dapat memilih mode eksekusi browser dan memanggil onStartReRun saat disubmit', async () => {
		const onStartReRun = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<ReRunModal
				open={true}
				sessionId={99}
				testCaseNo="TC-AUTH-01"
				title="Login Skenario"
				targetUrl="https://app.knitto.co.id/login"
				script={sampleScript}
				onClose={onClose}
				onStartReRun={onStartReRun}
			/>
		);

		// Ubah nilai input manual
		const emailInput = screen.getByLabelText(/Override nilai untuk Email/i);
		fireEvent.change(emailInput, { target: { value: 'custom@knitto.com' } });

		// Ubah mode ke Tab Aktif
		const activeTabRadio = screen.getByLabelText(/Tab Browser yang Sedang Aktif/i);
		fireEvent.click(activeTabRadio);

		// Submit
		fireEvent.click(screen.getByRole('button', { name: /Mulai Re-run/i }));

		await waitFor(() => {
			expect(onStartReRun).toHaveBeenCalledWith({
				sessionId: 99,
				testCaseNo: 'TC-AUTH-01',
				targetUrl: 'https://app.knitto.co.id/login',
				parameterOverrides: {
					'#email': 'custom@knitto.com',
					'#qty': '10'
				},
				mode: 'activeTab',
				speedMode: 'normal',
				stepDelayMs: 800,
				script: sampleScript
			});
			expect(onClose).toHaveBeenCalled();
		});
	});

	it('tombol Mulai Re-run berstatus disabled dan menampilkan pesan jika script belum tersedia', () => {
		render(
			<ReRunModal
				open={true}
				sessionId={1}
				testCaseNo="TC-NO-SCRIPT"
				title="Skenario Tanpa Script"
				script={null}
				onClose={vi.fn()}
				onStartReRun={vi.fn()}
			/>
		);

		expect(
			screen.getByText(/Script otomasi Playwright belum terbuat/i)
		).toBeTruthy();

		const startBtn = screen.getByRole('button', { name: /Mulai Re-run/i }) as HTMLButtonElement;
		expect(startBtn.disabled).toBe(true);
	});

	it('dapat memilih opsi kecepatan Cepat (300ms) dan mengirimkan payload yang sesuai', async () => {
		const onStartReRun = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<ReRunModal
				open={true}
				sessionId={50}
				testCaseNo="TC-SPEED-01"
				title="Speed Test Cepat"
				script={sampleScript}
				onClose={onClose}
				onStartReRun={onStartReRun}
			/>
		);

		// Klik opsi kecepatan Cepat
		const fastBtn = screen.getByRole('button', { name: /Cepat/i });
		fireEvent.click(fastBtn);

		// Submit
		fireEvent.click(screen.getByRole('button', { name: /Mulai Re-run/i }));

		await waitFor(() => {
			expect(onStartReRun).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionId: 50,
					speedMode: 'fast',
					stepDelayMs: 300
				})
			);
			expect(onClose).toHaveBeenCalled();
		});
	});

	it('dapat memilih opsi kecepatan Lambat / Debug (1500ms) dan mengirimkan payload yang sesuai', async () => {
		const onStartReRun = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<ReRunModal
				open={true}
				sessionId={51}
				testCaseNo="TC-SPEED-02"
				title="Speed Test Lambat"
				script={sampleScript}
				onClose={onClose}
				onStartReRun={onStartReRun}
			/>
		);

		// Klik opsi kecepatan Lambat / Debug
		const slowBtn = screen.getByRole('button', { name: /Lambat \/ Debug/i });
		fireEvent.click(slowBtn);

		// Submit
		fireEvent.click(screen.getByRole('button', { name: /Mulai Re-run/i }));

		await waitFor(() => {
			expect(onStartReRun).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionId: 51,
					speedMode: 'slow',
					stepDelayMs: 1500
				})
			);
			expect(onClose).toHaveBeenCalled();
		});
	});

	describe('file test data pengganti (langkah upload)', () => {
		const uploadScript = `
			await page.goto('https://app.knitto.co.id/form');
			await page.getByLabel('Lampiran').setInputFiles(['test-data/invoice.pdf', 'test-data/foto.png']);
		`;
		const file = (id: number, file_name: string) => ({
			id_artifact: id, file_name, content_type: 'application/pdf', size_bytes: 1, sequence: null, download_url: `http://minio/${id}`
		});

		it('requiredUploadFileNames membaca nama file langkah upload tanpa duplikat', async () => {
			const { requiredUploadFileNames } = await import('../views/ReRunModal');
			expect(requiredUploadFileNames(uploadScript)).toEqual(['invoice.pdf', 'foto.png']);
			expect(requiredUploadFileNames(null)).toEqual([]);
		});

		it('menampilkan file yang hilang, Mulai Re-run nonaktif sampai file pengganti diunggah', async () => {
			const api = {
				listTestDataFiles: vi.fn().mockResolvedValue([file(1, 'invoice.pdf')]),
				uploadReplacementTestData: vi.fn().mockResolvedValue([file(1, 'invoice.pdf'), file(2, 'foto.png')])
			};
			const onStartReRun = vi.fn().mockResolvedValue(undefined);
			render(
				<ReRunModal open={true} sessionId={5} testCaseNo="TC-UP" title="Upload" script={uploadScript} api={api} onClose={vi.fn()} onStartReRun={onStartReRun} />
			);

			const picker = await screen.findByLabelText('Pilih file pengganti untuk foto.png');
			expect(screen.queryByLabelText('Pilih file pengganti untuk invoice.pdf')).toBeNull();
			const startBtn = screen.getAllByRole('button', { name: /Mulai Re-run/i })[0] as HTMLButtonElement;
			expect(startBtn.disabled).toBe(true);

			const replacement = new File(['x'], 'foto-baru.png', { type: 'image/png' });
			fireEvent.change(picker, { target: { files: [replacement] } });

			await waitFor(() => expect(api.uploadReplacementTestData).toHaveBeenCalledWith(5, 'foto.png', replacement));
			await waitFor(() => expect(screen.queryByTestId('rerun-missing-files')).toBeNull());
			expect(startBtn.disabled).toBe(false);
		});

		it('tanpa langkah upload tidak memuat daftar file dan tombol tetap aktif', () => {
			const api = { listTestDataFiles: vi.fn(), uploadReplacementTestData: vi.fn() };
			render(
				<ReRunModal open={true} sessionId={5} testCaseNo="TC-01" title="T" script={sampleScript} api={api} onClose={vi.fn()} onStartReRun={vi.fn()} />
			);
			expect(api.listTestDataFiles).not.toHaveBeenCalled();
			expect((screen.getAllByRole('button', { name: /Mulai Re-run/i })[0] as HTMLButtonElement).disabled).toBe(false);
		});
	});
});
