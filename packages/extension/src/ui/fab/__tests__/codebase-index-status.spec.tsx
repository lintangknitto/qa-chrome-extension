// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CodebaseIndexStatus } from '../views/CodebaseIndexStatus';
import type { CodebaseRepoStatus, CodebaseStatus } from '../../../recording/apiClient';

afterEach(cleanup);

const NOW = Date.parse('2026-10-12T05:10:00Z');

const repo = (extra: Partial<CodebaseRepoStatus>): CodebaseRepoStatus => ({
	repo: 'knittotextile/knitto-widget-chat',
	repo_url: 'https://github.com/knittotextile/knitto-widget-chat',
	branch: 'main',
	tracks_default_branch: true,
	program: 'Widget',
	status: 'idle',
	last_indexed_sha: 'abc1234def',
	last_synced_at: '2026-10-12T05:00:00Z',
	last_checked_at: '2026-10-12T05:00:00Z',
	last_error: null,
	files_indexed: 42,
	...extra
});

const makeApi = (...statuses: CodebaseStatus[]) => {
	const getCodebaseStatus = vi.fn();
	for (const s of statuses) getCodebaseStatus.mockResolvedValueOnce(s);
	if (statuses.length > 0) getCodebaseStatus.mockResolvedValue(statuses[statuses.length - 1]);
	return { getCodebaseStatus, syncCodebase: vi.fn().mockResolvedValue({ completed: false, repos: [] }) };
};

describe('CodebaseIndexStatus', () => {
	it('menampilkan status per repo: terbaru @sha · waktu · jumlah file, belum ter-index, gagal dengan alasan', async () => {
		const api = makeApi({
			id_project: 1,
			can_sync: false,
			repos: [
				repo({}),
				repo({ repo: 'knittotextile/knitto-api-chat', branch: 'develop', program: 'API', status: 'not_indexed', last_indexed_sha: null, last_synced_at: null, files_indexed: 0 }),
				repo({ repo: 'knittotextile/legacy', branch: null, program: null, status: 'failed', last_error: 'Token GitHub tidak valid atau kedaluwarsa (401)' })
			]
		});
		render(<CodebaseIndexStatus api={api} idProject={1} now={() => NOW} />);

		const rows = await screen.findAllByTestId('codebase-repo-status');
		expect(rows.map((r) => r.textContent)).toEqual([
			'knittotextile/knitto-widget-chat@main (Widget): terbaru @abc1234 · 10 menit lalu · 42 file',
			'knittotextile/knitto-api-chat@develop (API): belum ter-index',
			'knittotextile/legacy: gagal: Token GitHub tidak valid atau kedaluwarsa (401)'
		]);
		// Tanpa hak kelola project tidak ada tombol sync.
		expect(screen.queryByRole('button', { name: /sync sekarang/i })).toBeNull();
	});

	it('tombol Sync sekarang memicu sync lalu polling sampai tidak ada repo yang sync', async () => {
		const api = makeApi(
			{ id_project: 1, can_sync: true, repos: [repo({ status: 'not_indexed', last_synced_at: null })] },
			{ id_project: 1, can_sync: true, repos: [repo({ status: 'syncing' })] },
			{ id_project: 1, can_sync: true, repos: [repo({})] }
		);
		render(<CodebaseIndexStatus api={api} idProject={7} pollMs={10} now={() => NOW} />);

		fireEvent.click(await screen.findByRole('button', { name: /sync sekarang/i }));
		await waitFor(() => expect(api.syncCodebase).toHaveBeenCalledWith(7));
		expect(await screen.findByText(/sedang sync/)).toBeTruthy();
		expect(await screen.findByText(/terbaru @abc1234/)).toBeTruthy();
		expect(api.getCodebaseStatus).toHaveBeenCalledTimes(3);
	});

	it('polling dibatasi: sync macet tidak dipantau selamanya dan tombol sync dibuka lagi', async () => {
		const api = makeApi();
		api.getCodebaseStatus.mockImplementation(async () => ({ id_project: 1, can_sync: true, repos: [repo({ status: 'syncing' })] }));
		let clock = NOW;
		const now = () => {
			clock += 40;
			return clock;
		};
		render(<CodebaseIndexStatus api={api} idProject={7} pollMs={10} maxPollMs={100} now={now} />);

		expect(await screen.findByTestId('codebase-poll-expired')).toBeTruthy();
		const calls = api.getCodebaseStatus.mock.calls.length;
		await new Promise((r) => setTimeout(r, 50));
		expect(api.getCodebaseStatus.mock.calls.length).toBe(calls);
		expect((screen.getByRole('button', { name: /sync sekarang/i }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('sync basi dilaporkan API sebagai gagal → alasan tampil dan tombol sync aktif', async () => {
		const api = makeApi({
			id_project: 1,
			can_sync: true,
			repos: [repo({ status: 'failed', last_error: 'Sync terputus (tidak ada kemajuan)' })]
		});
		render(<CodebaseIndexStatus api={api} idProject={7} now={() => NOW} />);
		expect(await screen.findByText(/gagal: Sync terputus/)).toBeTruthy();
		expect((screen.getByRole('button', { name: /sync sekarang/i }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('project tanpa repo → arahan mengisi repo; error API ditampilkan', async () => {
		render(<CodebaseIndexStatus api={makeApi({ id_project: 1, can_sync: true, repos: [] })} idProject={1} />);
		expect(await screen.findByText(/Belum ada repo/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: /sync sekarang/i })).toBeNull();
		cleanup();

		const failing = { getCodebaseStatus: vi.fn().mockRejectedValue(new Error('Server mati')), syncCodebase: vi.fn() };
		render(<CodebaseIndexStatus api={failing} idProject={1} />);
		expect(await screen.findByText('Server mati')).toBeTruthy();
	});
});
