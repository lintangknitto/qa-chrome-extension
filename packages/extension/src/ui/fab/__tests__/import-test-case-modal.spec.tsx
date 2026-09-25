// @vitest-environment jsdom
// Matrix: B-01 to B-19
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportTestCaseModal } from '../views/ImportTestCaseModal';
import type { ParseSpreadsheetResult } from '../../../recording/spreadsheetParser';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports by Vitest
// ---------------------------------------------------------------------------
vi.mock('../../../recording/spreadsheetParser', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../recording/spreadsheetParser')>();
	return {
		...actual,
		// Keep the pure extractGoogleSpreadsheetInfo (no network)
		extractGoogleSpreadsheetInfo: actual.extractGoogleSpreadsheetInfo,
		// Mock the network-dependent functions
		fetchGoogleSpreadsheetCsv: vi.fn(),
		parseSpreadsheetCsv: vi.fn()
	};
});

// We import AFTER vi.mock so we get the mocked versions
import {
	fetchGoogleSpreadsheetCsv,
	parseSpreadsheetCsv
} from '../../../recording/spreadsheetParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_URL =
	'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=1730053292#gid=1730053292';

const SYSTEM_TEMPLATE_URL =
	'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=603972469#gid=603972469';

const makeParseResult = (
	itemCount: number,
	detectedColumnCount: number
): ParseSpreadsheetResult => {
	const cols: Record<string, number> = {};
	const colNames = [
		'test_case_id',
		'title',
		'feature',
		'status',
		'test_type',
		'process_no',
		'group_no',
		'test_variable',
		'pre_condition',
		'test_data',
		'test_steps',
		'expected_result',
		'actual_result',
		'evidence',
		'module',
		'priority'
	];
	colNames.slice(0, detectedColumnCount).forEach((c, i) => {
		cols[c] = i;
	});

	const items = Array.from({ length: itemCount }, (_, i) => ({
		test_case_id: `TC-${i + 1}`,
		title: `Test case ${i + 1}`,
		test_type: '+' as const,
		status: 'Progress' as const
	}));

	return {
		items,
		headerRowIndex: 0,
		detectedColumns: cols,
		totalRowsFound: itemCount
	};
};

const defaultProps = {
	isOpen: true,
	projectName: 'Knitto Portal',
	onClose: vi.fn(),
	onImport: vi.fn().mockResolvedValue(undefined)
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ImportTestCaseModal', () => {
	beforeEach(() => {
		(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	// B-01: single-mode — link only, no tab/segmented control
	it('B-01: modal tidak menampilkan tab Upload File (single-mode: link only)', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		expect(screen.getByText('URL Google Spreadsheet')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Upload File/i })).toBeNull();
		expect(screen.queryByText(/Klik atau seret file spreadsheet ke sini/i)).toBeNull();
		expect(screen.queryByText(/Link Google Spreadsheet/i)).toBeNull();
	});

	// B-02: title includes project name
	it('B-02: judul modal menyertakan nama project', () => {
		render(<ImportTestCaseModal {...defaultProps} projectName="My Project" />);
		expect(screen.getByRole('dialog', { name: /My Project/i })).toBeTruthy();
	});

	// B-03: no prefill → empty input + instruction helper text
	it('B-03: tanpa prefillUrl, input URL kosong dan helper text berupa instruksi', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		const input = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(input.value).toBe('');
		expect(screen.getByText(/Salin dan tempel URL/i)).toBeTruthy();
	});

	// B-04: with prefillUrl → auto-filled + GID detected
	it('B-04: dengan prefillUrl, input terisi otomatis dan GID terdeteksi', () => {
		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		const input = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(input.value).toBe(VALID_URL);
		expect(screen.getByText(/Sheet GID terdeteksi/i)).toBeTruthy();
	});

	// B-05: GID number shown correctly
	it('B-05: nomor GID yang tepat ditampilkan di helper text', () => {
		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		expect(screen.getByText(/1730053292/)).toBeTruthy();
	});

	// B-06: fetch button disabled when no valid URL
	it('B-06: tombol Tarik Data dinonaktifkan saat URL tidak valid / kosong', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }) as HTMLButtonElement;
		expect(fetchBtn.disabled).toBe(true);
	});

	// B-07: fetch button enabled when GID detected
	it('B-07: tombol Tarik Data aktif setelah GID terdeteksi dari URL', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i);
		fireEvent.change(urlInput, { target: { value: VALID_URL } });
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }) as HTMLButtonElement;
		expect(fetchBtn.disabled).toBe(false);
	});

	// B-08: column detection preview chips after successful parse
	it('B-08: chip kolom terdeteksi dan confidence badge muncul setelah parse berhasil', async () => {
		const parseResult = makeParseResult(3, 10);
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv-content');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(parseResult);

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i });
		await act(async () => {
			fireEvent.click(fetchBtn);
		});

		await waitFor(() => {
			expect(screen.getByText(/Kolom Terdeteksi/i)).toBeTruthy();
			expect(screen.getByText(/10 \/ 16 kolom dikenali/i)).toBeTruthy();
			expect(screen.getByText(/✓ test_case_id/i)).toBeTruthy();
			expect(screen.getByText(/✓ title/i)).toBeTruthy();
		});
	});

	// B-09: confidence badge green (>=8 cols)
	it('B-09: confidence badge hijau saat ≥8 kolom dikenali', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(makeParseResult(2, 8));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			const badge = screen.getByText(/8 \/ 16 kolom dikenali/i);
			// Green text color for >=8
			expect(badge).toBeTruthy();
			expect(badge.style.color).toBe('rgb(21, 128, 61)'); // #15803d
		});
	});

	// B-10: confidence badge yellow (4-7 cols)
	it('B-10: confidence badge kuning saat 4–7 kolom dikenali', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(makeParseResult(2, 5));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			const badge = screen.getByText(/5 \/ 16 kolom dikenali/i);
			expect(badge).toBeTruthy();
			expect(badge.style.color).toBe('rgb(146, 64, 14)'); // #92400e (amber)
		});
	});

	// B-11: confidence badge red (<4 cols)
	it('B-11: confidence badge merah saat <4 kolom dikenali', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(makeParseResult(2, 2));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			const badge = screen.getByText(/2 \/ 16 kolom dikenali/i);
			expect(badge).toBeTruthy();
			expect(badge.style.color).toBe('rgb(185, 28, 28)'); // #b91c1c (red)
		});
	});

	// B-12: fetch button disabled / error path for invalid URL
	it('B-12: tombol fetch tetap disabled saat URL tidak mengandung pola Google Spreadsheet', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		const urlInput = screen.getByPlaceholderText(/docs\.google\.com/i);
		// Enter a non-GSheets URL — GID extraction returns null → button must stay disabled
		fireEvent.change(urlInput, { target: { value: 'https://example.com/notaspreadsheet' } });
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }) as HTMLButtonElement;
		// The disabled state IS the error protection: user cannot proceed with an invalid URL
		expect(fetchBtn.disabled).toBe(true);
		// Helper text stays as instruction (no GID detected text)
		expect(screen.queryByText(/Sheet GID terdeteksi/i)).toBeNull();
	});

	// B-13: error shown when fetch throws
	it('B-13: pesan error ditampilkan saat fetch gagal (network error)', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockRejectedValue(new Error('Gagal terhubung ke server'));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		const fetchBtn = screen.getByRole('button', { name: /Tarik Data Spreadsheet/i });
		await act(async () => {
			fireEvent.click(fetchBtn);
		});

		await waitFor(() => {
			expect(screen.getByText(/Gagal terhubung ke server/i)).toBeTruthy();
		});
	});

	// B-14: error when 0 valid rows
	it('B-14: pesan error muncul saat spreadsheet tidak mengandung baris valid', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(makeParseResult(0, 0));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			expect(screen.getByText(/Tidak ada baris test case valid/i)).toBeTruthy();
		});
	});

	// B-15: import button disabled before parse
	it('B-15: tombol Import dinonaktifkan sebelum parse dilakukan', () => {
		render(<ImportTestCaseModal {...defaultProps} />);
		// Look for the Import button (which may say "Import  Test Case" with empty count)
		const importBtns = screen.getAllByRole('button');
		const importBtn = importBtns.find((b) => b.textContent?.includes('Import')) as HTMLButtonElement;
		expect(importBtn).toBeTruthy();
		expect(importBtn.disabled).toBe(true);
	});

	// B-16: import button enabled after parse
	it('B-16: tombol Import aktif dan menampilkan jumlah item setelah parse berhasil', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(makeParseResult(5, 8));

		render(<ImportTestCaseModal {...defaultProps} prefillUrl={VALID_URL} />);
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			const importBtns = screen.getAllByRole('button');
			const importBtn = importBtns.find((b) =>
				b.textContent?.includes('Import')
			) as HTMLButtonElement;
			expect(importBtn.disabled).toBe(false);
			expect(importBtn.textContent).toContain('5');
		});
	});

	// B-17: import calls onImport and closes
	it('B-17: klik Import memanggil onImport dengan items dan menutup modal', async () => {
		const onImport = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();
		const parseResult = makeParseResult(3, 8);
		vi.mocked(fetchGoogleSpreadsheetCsv).mockResolvedValue('csv');
		vi.mocked(parseSpreadsheetCsv).mockReturnValue(parseResult);

		render(
			<ImportTestCaseModal
				isOpen={true}
				projectName="Portal"
				prefillUrl={VALID_URL}
				onClose={onClose}
				onImport={onImport}
			/>
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});

		await waitFor(() => {
			const importBtns = screen.getAllByRole('button');
			return importBtns.some((b) => !((b as HTMLButtonElement).disabled) && b.textContent?.includes('Import'));
		});

		const importBtns = screen.getAllByRole('button');
		const importBtn = importBtns.find(
			(b) => !(b as HTMLButtonElement).disabled && b.textContent?.includes('Import')
		) as HTMLButtonElement;

		await act(async () => {
			fireEvent.click(importBtn);
		});

		await waitFor(() => {
			expect(onImport).toHaveBeenCalledWith(parseResult.items);
			expect(onClose).toHaveBeenCalled();
		});
	});

	// B-18: handleClose resets all state
	it('B-18: menutup modal mereset URL input, error, dan parse result', async () => {
		vi.mocked(fetchGoogleSpreadsheetCsv).mockRejectedValue(new Error('Network error'));
		const onClose = vi.fn();

		const { rerender } = render(
			<ImportTestCaseModal
				isOpen={true}
				projectName="Portal"
				prefillUrl={VALID_URL}
				onClose={onClose}
				onImport={vi.fn()}
			/>
		);

		// Trigger fetch to cause error
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Tarik Data Spreadsheet/i }));
		});
		await waitFor(() => {
			expect(screen.getByText(/Network error/i)).toBeTruthy();
		});

		// Close modal (Batal button)
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Batal/i }));
		});
		expect(onClose).toHaveBeenCalled();

		// Reopen modal without prefillUrl
		rerender(
			<ImportTestCaseModal
				isOpen={true}
				projectName="Portal"
				onClose={onClose}
				onImport={vi.fn()}
			/>
		);

		const input = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(input.value).toBe('');
		expect(screen.queryByText(/Network error/i)).toBeNull();
	});

	// B-19: prefillUrl resets between opens when modal is properly closed via handleClose
	it('B-19: setelah ditutup via Batal, membuka ulang tanpa prefillUrl menghasilkan input kosong', async () => {
		const onClose = vi.fn();

		const { rerender } = render(
			<ImportTestCaseModal
				isOpen={true}
				projectName="Portal"
				prefillUrl={SYSTEM_TEMPLATE_URL}
				onClose={onClose}
				onImport={vi.fn()}
			/>
		);

		// First open: URL is prefilled
		const inputFirst = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(inputFirst.value).toBe(SYSTEM_TEMPLATE_URL);

		// Close via Batal — this calls handleClose which resets local state AND calls onClose
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Batal/i }));
		});
		expect(onClose).toHaveBeenCalled();

		// The parent (simulated here) re-opens modal with isOpen=true but no prefillUrl
		rerender(
			<ImportTestCaseModal
				isOpen={true}
				projectName="Portal"
				onClose={onClose}
				onImport={vi.fn()}
			/>
		);

		const inputSecond = screen.getByPlaceholderText(/docs\.google\.com/i) as HTMLInputElement;
		expect(inputSecond.value).toBe('');
		expect(screen.queryByText(/Sheet GID terdeteksi/i)).toBeNull();
	});
});
