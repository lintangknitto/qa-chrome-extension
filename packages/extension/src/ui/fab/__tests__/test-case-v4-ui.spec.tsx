// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectView } from '../views/ProjectView';
import { CreateEditTestCaseModal } from '../views/CreateEditTestCaseModal';
import type { RecordingApiClient, RecordingProject, TestCaseItem } from '../../../recording/apiClient';

const project: RecordingProject = { id_project: 1, name: 'Chat Widget', code: 'chat-widget', is_active: true };
const testCase: TestCaseItem = {
	id_test_case: 10,
	id_project: 1,
	test_type: '+',
	test_case_id: 'TC1-1',
	scenario: 'Kirim pesan teks',
	title: 'Pesan terkirim ke agent',
	test_date: '8 Oktober 2026',
	status: 'Passed'
};

const createApi = () =>
	({
		getDefaultTestCaseTemplate: vi.fn().mockResolvedValue({ id_template: 3, version_label: 'V4', name: 'FORMAT TEST CASE V4', spreadsheet_url: 'https://docs.google.com/spreadsheets/d/x/edit', gid: '1', column_mapping: {}, export_anchors: {}, is_default: true, is_active: true }),
		listTestCases: vi.fn().mockResolvedValue({ items: [testCase], total: 1, page: 1, limit: 50, summary: { total: 1, passed: 1, failed: 0, re_test: 0, progress: 0, skip: 0 } }),
		listSessions: vi.fn().mockResolvedValue({ items: [] }),
		exportTestCases: vi.fn().mockResolvedValue({ blob: new Blob(['x']), filename: 'chat-widget-test-case-v4.xlsx' })
	}) as unknown as RecordingApiClient & Record<string, ReturnType<typeof vi.fn>>;

const renderProject = async (api: RecordingApiClient, onShowToast = vi.fn()) => {
	render(
		<ProjectView
			projects={[project]}
			api={api}
			canCreateProject={true}
			onRefreshProjects={vi.fn().mockResolvedValue(undefined)}
			onCreateProject={vi.fn().mockResolvedValue(1)}
			onSelectTestCaseForRecording={vi.fn()}
			onShowToast={onShowToast}
		/>
	);
	fireEvent.click(screen.getByText('Chat Widget'));
	await waitFor(() => expect(screen.getByText('Pesan terkirim ke agent')).toBeTruthy());
	return onShowToast;
};

describe('Test case format V4 di UI', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
		URL.createObjectURL = vi.fn(() => 'blob:mock');
		URL.revokeObjectURL = vi.fn();
	});
	afterEach(() => cleanup());

	it('tabel test case menampilkan Scenario dan Date', async () => {
		await renderProject(createApi());
		expect(screen.getByText('Kirim pesan teks')).toBeTruthy();
		expect(screen.getByText('Date: 8 Oktober 2026')).toBeTruthy();
	});

	it('tombol "Ekspor V4 (.xlsx)" mengunduh file lewat API memakai template default', async () => {
		const api = createApi();
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		const onShowToast = await renderProject(api);
		await waitFor(() => expect(screen.getByRole('button', { name: /Ekspor V4 \(\.xlsx\)/ })).toBeTruthy());

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Ekspor V4 \(\.xlsx\)/ }));
		});

		expect(api.exportTestCases).toHaveBeenCalledWith(1, 3);
		expect(clickSpy).toHaveBeenCalled();
		expect(onShowToast).toHaveBeenCalledWith('File chat-widget-test-case-v4.xlsx berhasil diunduh.', 'success');
	});

	it('error ekspor ditampilkan sebagai toast', async () => {
		const api = createApi();
		vi.mocked(api.exportTestCases).mockRejectedValue(new Error('Spreadsheet template tidak bisa diunduh sebagai xlsx.'));
		const onShowToast = await renderProject(api);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Ekspor V4/ }));
		});
		expect(onShowToast).toHaveBeenCalledWith('Spreadsheet template tidak bisa diunduh sebagai xlsx.', 'error');
	});

	it('form test case mengedit Scenario dan Date', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(<CreateEditTestCaseModal isOpen initialData={testCase} projectName="Chat Widget" onClose={vi.fn()} onSave={onSave} />);

		expect((screen.getByLabelText('Scenario') as HTMLInputElement).value).toBe('Kirim pesan teks');
		expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('8 Oktober 2026');
		fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: 'Kirim lampiran' } });
		fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
		await act(async () => {
			fireEvent.submit(screen.getByLabelText('Scenario').closest('form')!);
		});

		expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scenario: 'Kirim lampiran', test_date: '', title: 'Pesan terkirim ke agent' }));
	});

	it('form test case baru: Scenario/Date kosong tidak dikirim', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(<CreateEditTestCaseModal isOpen projectName="Chat Widget" onClose={vi.fn()} onSave={onSave} />);
		fireEvent.change(screen.getByLabelText(/Test Case ID/), { target: { value: 'TC9' } });
		fireEvent.change(screen.getByLabelText(/Test Case \(Judul\)/), { target: { value: 'Judul' } });
		await act(async () => {
			fireEvent.submit(screen.getByLabelText('Scenario').closest('form')!);
		});
		const data = onSave.mock.calls[0][0];
		expect(data.scenario).toBeUndefined();
		expect(data.test_date).toBeUndefined();
	});
});
