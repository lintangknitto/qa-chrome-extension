// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordingApiClient, TestCaseTemplate } from '../../../recording/apiClient';

vi.mock('../../../recording/spreadsheetParser', async () => {
	const actual = await vi.importActual<typeof import('../../../recording/spreadsheetParser')>('../../../recording/spreadsheetParser');
	return { ...actual, fetchGoogleSpreadsheetCsv: vi.fn() };
});

import { checkTemplateMapping, fetchGoogleSpreadsheetCsv } from '../../../recording/spreadsheetParser';
import { TestCaseTemplateSettings, buildColumnMapping, canManageTestCaseTemplates } from '../views/TestCaseTemplateSettings';

const V4: TestCaseTemplate = {
	id_template: 1,
	version_label: 'V4',
	name: 'FORMAT TEST CASE V4',
	spreadsheet_url: 'https://docs.google.com/spreadsheets/d/abc/edit',
	gid: '1730053292',
	column_mapping: { test_case_id: { header: 'Test Case ID' }, title: { header: 'Test Case' } },
	export_anchors: { header_row: 18 },
	is_default: true,
	is_active: true
};
const V3: TestCaseTemplate = { ...V4, id_template: 2, version_label: 'V3', name: 'FORMAT TEST CASE V3', is_default: false };

const createApi = () =>
	({
		listTestCaseTemplates: vi.fn().mockResolvedValue([V4, V3]),
		createTestCaseTemplate: vi.fn().mockResolvedValue(V3),
		updateTestCaseTemplate: vi.fn().mockResolvedValue(V4),
		setDefaultTestCaseTemplate: vi.fn().mockResolvedValue(V3),
		deactivateTestCaseTemplate: vi.fn().mockResolvedValue(V3)
	}) as unknown as RecordingApiClient & Record<string, ReturnType<typeof vi.fn>>;

const renderSettings = async (api = createApi(), showNotice = vi.fn()) => {
	await act(async () => {
		render(<TestCaseTemplateSettings api={api} showNotice={showNotice} />);
	});
	return { api, showNotice };
};

describe('TestCaseTemplateSettings', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});
	afterEach(() => cleanup());

	it('hanya ADMIN/SUPERADMIN yang boleh melihat pengaturan template', () => {
		expect(canManageTestCaseTemplates('ADMIN')).toBe(true);
		expect(canManageTestCaseTemplates('superadmin')).toBe(true);
		expect(canManageTestCaseTemplates('QA')).toBe(false);
		expect(canManageTestCaseTemplates(undefined)).toBe(false);
	});

	it('menampilkan daftar template termasuk nonaktif, dengan badge default', async () => {
		const { api } = await renderSettings();
		expect(api.listTestCaseTemplates).toHaveBeenCalledWith(true);
		const items = screen.getAllByRole('listitem');
		expect(items).toHaveLength(2);
		expect(within(items[0]).getByText('Default')).toBeTruthy();
		// Template default tidak bisa dijadikan default lagi / dinonaktifkan
		expect(within(items[0]).queryByText('Nonaktifkan')).toBeNull();
	});

	it('Jadikan Default & Nonaktifkan memanggil API lalu memuat ulang daftar', async () => {
		const { api, showNotice } = await renderSettings();
		const v3Row = screen.getAllByRole('listitem')[1];
		await act(async () => {
			fireEvent.click(within(v3Row).getByText('Jadikan Default'));
		});
		expect(api.setDefaultTestCaseTemplate).toHaveBeenCalledWith(2);
		expect(showNotice).toHaveBeenCalledWith('V3 menjadi template default.', 'success');

		await act(async () => {
			fireEvent.click(within(screen.getAllByRole('listitem')[1]).getByText('Nonaktifkan'));
		});
		expect(api.deactivateTestCaseTemplate).toHaveBeenCalledWith(2);
		expect(api.listTestCaseTemplates).toHaveBeenCalledTimes(3);
	});

	it('mendaftarkan template V5 tiruan dengan header berbeda lewat form', async () => {
		const { api } = await renderSettings();
		fireEvent.click(screen.getByText('Tambah'));
		const dialog = screen.getByRole('dialog', { name: /Tambah Template Test Case/i });
		fireEvent.change(within(dialog).getByLabelText('Versi'), { target: { value: 'V5' } });
		fireEvent.change(within(dialog).getByLabelText('Nama'), { target: { value: 'FORMAT TEST CASE V5' } });
		fireEvent.change(within(dialog).getByLabelText('URL Google Spreadsheet'), { target: { value: 'https://docs.google.com/spreadsheets/d/v5/edit' } });
		fireEvent.change(within(dialog).getByLabelText('GID tab'), { target: { value: '42' } });
		fireEvent.change(within(dialog).getByLabelText('Header Test Case ID'), { target: { value: 'Kode TC' } });
		fireEvent.change(within(dialog).getByLabelText('Alias Test Case ID'), { target: { value: 'ID, No TC' } });
		fireEvent.change(within(dialog).getByLabelText('Header Test Case'), { target: { value: 'Kasus Uji' } });
		fireEvent.change(within(dialog).getByLabelText('Header Evidence'), { target: { value: '' } });

		await act(async () => {
			fireEvent.click(within(dialog).getByText('Simpan'));
		});

		const input = (api.createTestCaseTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(input).toMatchObject({ version_label: 'V5', name: 'FORMAT TEST CASE V5', gid: '42', is_default: false, export_anchors: {} });
		expect(input.column_mapping.test_case_id).toEqual({ header: 'Kode TC', aliases: ['ID', 'No TC'] });
		expect(input.column_mapping.title).toEqual({ header: 'Kasus Uji' });
		expect(input.column_mapping.scenario).toEqual({ header: 'Scenario' });
		expect(input.column_mapping.evidence).toBeUndefined();
	});

	it('validasi form: header wajib dan anchor JSON', async () => {
		const { api } = await renderSettings();
		fireEvent.click(screen.getByText('Tambah'));
		const dialog = screen.getByRole('dialog');
		fireEvent.change(within(dialog).getByLabelText('Header Test Case ID'), { target: { value: ' ' } });
		await act(async () => {
			fireEvent.click(within(dialog).getByText('Simpan'));
		});
		expect(within(dialog).getByRole('alert').textContent).toContain('Test Case ID dan Test Case wajib diisi');

		fireEvent.change(within(dialog).getByLabelText('Header Test Case ID'), { target: { value: 'Test Case ID' } });
		fireEvent.change(within(dialog).getByLabelText('Anchor ekspor (JSON)'), { target: { value: '{bukan json' } });
		await act(async () => {
			fireEvent.click(within(dialog).getByText('Simpan'));
		});
		expect(within(dialog).getByRole('alert').textContent).toContain('bukan JSON yang valid');
		expect(api.createTestCaseTemplate).not.toHaveBeenCalled();
	});

	it('edit memuat pemetaan template lalu menyimpan lewat update', async () => {
		const { api } = await renderSettings();
		fireEvent.click(screen.getByLabelText('Edit V4'));
		const dialog = screen.getByRole('dialog', { name: /Edit Template V4/i });
		expect((within(dialog).getByLabelText('Header Test Case') as HTMLInputElement).value).toBe('Test Case');
		await act(async () => {
			fireEvent.click(within(dialog).getByText('Simpan'));
		});
		expect(api.updateTestCaseTemplate).toHaveBeenCalledWith(1, expect.objectContaining({ version_label: 'V4', gid: '1730053292' }));
	});

	it('"Uji template" memuat header sheet dan menandai kolom terpetakan / tidak', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue(
			['PROGRAM VERSION RELEASE,x', 'Group No,Feature,Kode TC,Kasus Uji,Status', ',,TC1,Login,Passed'].join('\n')
		);
		await renderSettings();
		fireEvent.click(screen.getByText('Tambah'));
		const dialog = screen.getByRole('dialog');
		fireEvent.change(within(dialog).getByLabelText('URL Google Spreadsheet'), { target: { value: 'https://docs.google.com/spreadsheets/d/v5/edit' } });
		fireEvent.change(within(dialog).getByLabelText('GID tab'), { target: { value: '42' } });
		fireEvent.change(within(dialog).getByLabelText('Header Test Case ID'), { target: { value: 'Kode TC' } });
		fireEvent.change(within(dialog).getByLabelText('Header Test Case'), { target: { value: 'Kasus Uji' } });

		await act(async () => {
			fireEvent.click(within(dialog).getByText('Uji template'));
		});

		expect(fetchGoogleSpreadsheetCsv).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/v5/export?format=csv&gid=42');
		await waitFor(() => expect(within(dialog).getByRole('status').textContent).toContain('Header di baris 2: 5 kolom terpetakan'));
		expect(within(dialog).getByTestId('check-test_case_id').querySelector('[aria-label="terpetakan"]')).toBeTruthy();
		expect(within(dialog).getByTestId('check-scenario').querySelector('[aria-label="tidak ditemukan"]')).toBeTruthy();
	});
});

describe('helper pemetaan template', () => {
	it('buildColumnMapping membuang header kosong dan memecah alias', () => {
		expect(buildColumnMapping({ title: { header: ' Kasus ', aliases: 'a, ,b' }, scenario: { header: '', aliases: 'x' } })).toEqual({
			title: { header: 'Kasus', aliases: ['a', 'b'] }
		});
	});

	it('checkTemplateMapping hanya memakai header template (tanpa alias bawaan)', () => {
		const result = checkTemplateMapping('Test Case ID,Judul\nTC1,Login', { test_case_id: { header: 'Test Case ID' }, title: { header: 'Test Case' } });
		expect(result).toEqual({ headerRowIndex: 0, mapped: [{ field: 'test_case_id', header: 'Test Case ID' }], unmapped: ['title'] });
	});
});
