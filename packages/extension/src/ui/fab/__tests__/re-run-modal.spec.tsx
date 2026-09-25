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
});
