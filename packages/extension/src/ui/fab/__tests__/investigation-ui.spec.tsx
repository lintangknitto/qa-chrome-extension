// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestCaseResultModal } from '../views/TestCaseResultModal';
import { SimpleMarkdown } from '../components/SimpleMarkdown';
import { ScriptView, countAmbiguousSteps } from '../components/ScriptView';
import type { RecordingApiClient } from '../../../recording/apiClient';

const SCRIPT = [
	"import { test, expect } from '@playwright/test';",
	"test('TC', async ({ page }) => {",
	'\t// ⚠ locator tidak unik saat direkam',
	"\tawait page.getByRole('checkbox').nth(1).check();",
	'});'
].join('\n');

describe('SimpleMarkdown', () => {
	afterEach(cleanup);

	it('merender heading, list, kode, tautan http tanpa HTML mentah', () => {
		const { container } = render(
			<SimpleMarkdown source={'## Ringkasan\n- **500** di `POST /api`\n[buka dashboard](https://grafana.test/d/x)\n<img src=x onerror=alert(1)>'} />
		);
		expect(screen.getByText('Ringkasan')).toBeTruthy();
		expect(container.querySelector('strong')?.textContent).toBe('500');
		expect(container.querySelector('code')?.textContent).toBe('POST /api');
		expect(container.querySelector('a')?.getAttribute('href')).toBe('https://grafana.test/d/x');
		expect(container.querySelector('img')).toBeNull();
	});

	it('tidak membuat tautan untuk skema non-http', () => {
		const { container } = render(<SimpleMarkdown source={'[klik](javascript:alert(1))'} />);
		expect(container.querySelector('a')).toBeNull();
	});
});

describe('ScriptView', () => {
	afterEach(cleanup);

	it('menyorot baris locator ambigu dan menghitungnya', () => {
		const { container } = render(<ScriptView script={SCRIPT} />);
		expect(container.querySelectorAll('[data-ambiguous="true"]')).toHaveLength(1);
		expect(countAmbiguousSteps(SCRIPT)).toBe(1);
	});
});

describe('TestCaseResultModal tab Investigasi', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});
	afterEach(cleanup);

	const makeApi = (items: unknown[]) =>
		({
			getSession: vi.fn().mockResolvedValue({ id_session: 9, test_case_no: 'TC-9', title: 'x', status: 'completed', result: 'FAIL', checkpoints: [] }),
			getSessionVideo: vi.fn().mockResolvedValue({ video_url: null }),
			listGenerations: vi.fn().mockResolvedValue({ items }),
			generateOutputs: vi.fn().mockResolvedValue({}),
			investigateSession: vi.fn().mockResolvedValue({ status: 'completed', output: '## Hasil' }),
			generateShareUrl: vi.fn()
		}) as unknown as RecordingApiClient;

	it('menampilkan laporan investigasi & tidak mencampurnya ke tab script', async () => {
		const api = makeApi([
			{ id_generation: 1, kind: 'playwright', status: 'completed', output: SCRIPT, error_message: null },
			{ id_generation: 2, kind: 'investigation', status: 'completed', output: '## Dugaan Akar Masalah\nDuplikasi key', error_message: null }
		]);
		render(<TestCaseResultModal open sessionId={9} testCase={null} api={api} onClose={vi.fn()} />);
		await waitFor(() => expect(api.listGenerations).toHaveBeenCalled());

		fireEvent.click(await screen.findByRole('tab', { name: /Investigasi/ }));
		expect(await screen.findByText('Dugaan Akar Masalah')).toBeTruthy();

		fireEvent.click(screen.getByRole('tab', { name: /Script Playwright/ }));
		expect(await screen.findByText(/1 locator tidak unik/)).toBeTruthy();
		expect(screen.queryByText('INVESTIGATION')).toBeNull();
	});

	it('tombol Investigasi memanggil API lalu memuat ulang generation', async () => {
		const api = makeApi([{ id_generation: 1, kind: 'playwright', status: 'completed', output: SCRIPT, error_message: null }]);
		render(<TestCaseResultModal open sessionId={9} testCase={null} api={api} onClose={vi.fn()} />);
		await waitFor(() => expect(api.listGenerations).toHaveBeenCalled());
		fireEvent.click(await screen.findByRole('tab', { name: /Investigasi/ }));
		fireEvent.click(screen.getByRole('button', { name: /^Investigasi$/ }));
		await waitFor(() => expect(api.investigateSession).toHaveBeenCalledWith(9));
	});

	it('toggle versi script asli vs patch AI', async () => {
		const api = makeApi([
			{ id_generation: 1, kind: 'playwright', status: 'completed', output: SCRIPT, error_message: null },
			{ id_generation: 3, kind: 'playwright_ai', status: 'completed', output: '// Patch AI: 1 diterapkan, 0 ditolak', error_message: null }
		]);
		render(<TestCaseResultModal open sessionId={9} testCase={null} api={api} onClose={vi.fn()} />);
		await waitFor(() => expect(api.listGenerations).toHaveBeenCalled());
		fireEvent.click(await screen.findByRole('tab', { name: /Script Playwright/ }));
		expect(await screen.findByText('PLAYWRIGHT')).toBeTruthy();
		expect(screen.queryByText('PLAYWRIGHT_AI')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Patch AI' }));
		expect(await screen.findByText('PLAYWRIGHT_AI')).toBeTruthy();
		expect(screen.queryByText('PLAYWRIGHT')).toBeNull();
	});
});

describe('TestCaseResultModal video: Perbesar & Buka di Tab Baru', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		// jsdom tidak mengimplementasikan media playback.
		vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	const MINIO_URL = 'http://127.0.0.1:9000/qa-recording-artifacts/sessions/1/9-video-1.webm?X-Amz-Signature=abc';
	const makeApi = () =>
		({
			baseUrl: 'http://192.168.20.2:8010',
			getSession: vi.fn().mockResolvedValue({ id_session: 9, test_case_no: 'TC-9', title: 'Kirim pesan', status: 'completed', result: 'PASS', video_url: MINIO_URL, checkpoints: [] }),
			getSessionVideo: vi.fn().mockResolvedValue({ video_url: MINIO_URL }),
			listGenerations: vi.fn().mockResolvedValue({ items: [] }),
			generateOutputs: vi.fn().mockResolvedValue({}),
			generateShareUrl: vi.fn()
		}) as unknown as RecordingApiClient;

	it('"Buka di Tab Baru" memakai endpoint stream API, bukan URL MinIO 127.0.0.1', async () => {
		render(<TestCaseResultModal open sessionId={9} testCase={null} api={makeApi()} onClose={vi.fn()} />);
		const link = await screen.findByRole('link', { name: /Buka di Tab Baru/ });
		expect(link.getAttribute('href')).toBe('http://192.168.20.2:8010/sessions/9/video/stream');
	});

	it('"Perbesar" membuka overlay layar penuh tanpa Fullscreen API dan Esc menutupnya', async () => {
		render(<TestCaseResultModal open sessionId={9} testCase={null} api={makeApi()} onClose={vi.fn()} />);
		fireEvent.click(await screen.findByRole('button', { name: /Perbesar/ }));

		const overlay = await screen.findByTestId('expanded-video-overlay');
		expect(overlay.style.position).toBe('fixed');
		expect(overlay.querySelector('video')?.getAttribute('src')).toBe(MINIO_URL);
		expect(within(overlay).getByRole('link', { name: /Buka di Tab Baru/ }).getAttribute('href')).toBe('http://192.168.20.2:8010/sessions/9/video/stream');

		fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByTestId('expanded-video-overlay')).toBeNull());
	});
});
