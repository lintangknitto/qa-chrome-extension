import * as XLSX from 'xlsx';
import type { TestCaseItem } from './apiClient';

export type ParsedImportTestCase = Partial<TestCaseItem> & {
	test_case_id: string;
	title: string;
};

export interface ParseSpreadsheetResult {
	items: ParsedImportTestCase[];
	headerRowIndex: number;
	detectedColumns: Record<string, number>;
	totalRowsFound: number;
	sheetName?: string;
}

export interface GoogleSpreadsheetInfo {
	spreadsheetId: string;
	gid: string;
	exportUrl: string;
	originalUrl: string;
}

export const extractGoogleSpreadsheetInfo = (rawUrl: string): GoogleSpreadsheetInfo | null => {
	const trimmed = rawUrl.trim();
	if (!trimmed) return null;

	// Cocokkan spreadsheet ID: docs.google.com/spreadsheets/d/<id>
	const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (!idMatch || !idMatch[1]) return null;
	const spreadsheetId = idMatch[1];

	// Ekstrak gid dari hash (#gid=...) atau search param (?gid=... atau &gid=...)
	let gid = '0';
	const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
	if (gidMatch && gidMatch[1]) {
		gid = gidMatch[1];
	}

	const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
	return {
		spreadsheetId,
		gid,
		exportUrl,
		originalUrl: trimmed
	};
};

export const fetchGoogleSpreadsheetCsv = async (exportUrl: string): Promise<string> => {
	// Jika berada di environment extension, gunakan background service worker (bebas batasan CSP halaman)
	if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
		try {
			const res = await new Promise<{ success: boolean; csv?: string; error?: string }>((resolve, reject) => {
				chrome.runtime.sendMessage({ type: 'fetchSpreadsheetCsv', url: exportUrl }, (response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
					} else if (!response) {
						reject(new Error('Tidak ada respon dari background service worker.'));
					} else {
						resolve(response);
					}
				});
			});
			if (res.success && res.csv !== undefined) {
				return res.csv;
			}
			if (res.error) {
				throw new Error(res.error);
			}
		} catch (err) {
			// Jika error spesifik permission / login, teruskan langsung
			const msg = (err as Error).message || '';
			if (msg.includes('Spreadsheet tidak dapat diakses') || msg.includes('login Google')) {
				throw err;
			}
		}
	}

	// Direct fetch fallback
	const response = await fetch(exportUrl);
	if (response.status === 401 || response.status === 403 || (response.redirected && response.url.includes('accounts.google.com'))) {
		throw new Error(
			'Spreadsheet tidak dapat diakses. Pastikan spreadsheet disetel ke "Anyone with the link can view" (Siapa saja yang memiliki link dapat melihat / Public Read-Only).'
		);
	}
	if (!response.ok) {
		throw new Error(`Gagal mengunduh spreadsheet (HTTP ${response.status}). Pastikan link benar dan dapat diakses.`);
	}

	const text = await response.text();
	if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
		throw new Error(
			'Spreadsheet meminta login Google. Pastikan izin akses disetel ke "Anyone with the link can view" (Public Read-Only).'
		);
	}

	return text;
};

const COLUMN_ALIASES: Record<string, string[]> = {
	test_case_id: ['test case id', 'tc id', 'case id', 'tc_id', 'no test case', 'test case no', 'id test case'],
	title: ['test case', 'skenario', 'scenario', 'title', 'judul', 'nama test case', 'deskripsi test case'],
	group_no: ['group no', 'group', 'grup', 'no grup', 'group_no'],
	feature: ['feature', 'fitur', 'modul', 'module'],
	process_no: ['process no (fc)', 'process no', 'no proses', 'process_no'],
	test_type: ['type', 'tipe', 'test type', 'jenis'],
	test_variable: ['test variable', 'variabel', 'variable'],
	pre_condition: ['pre-condition', 'precondition', 'pre condition', 'prekondisi', 'prasyarat'],
	test_data: ['test data', 'data uji', 'input data', 'data'],
	test_steps: ['test steps', 'steps', 'langkah', 'langkah pengujian'],
	expected_result: ['expected result', 'ekspektasi', 'hasil yang diharapkan', 'expected'],
	actual_result: ['actual result', 'hasil aktual', 'realita'],
	status: ['status', 'hasil', 'result'],
	evidence: ['evidence', 'bukti', 'lampiran'],
	remarks: ['remarks', 'catatan', 'keterangan'],
	automation_tools: ['automation tools', 'tools', 'alat otomasi', 'automation']
};

export const findHeaderRow = (
	rows: unknown[][]
): { rowIndex: number; columnMap: Record<string, number>; score: number } | null => {
	let bestCandidate: { rowIndex: number; columnMap: Record<string, number>; score: number } | null = null;

	for (let r = 0; r < Math.min(rows.length, 50); r++) {
		const row = rows[r];
		if (!Array.isArray(row)) continue;

		const normalizedCells = row.map((cell) => String(cell ?? '').trim().toLowerCase());
		const matchedColumns: Record<string, number> = {};

		for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
			const idx = normalizedCells.findIndex((cell) => aliases.includes(cell));
			if (idx !== -1) {
				matchedColumns[field] = idx;
			}
		}

		const matchCount = Object.keys(matchedColumns).length;

		// Header harus memiliki setidaknya test_case_id atau title
		if (matchedColumns.test_case_id !== undefined || matchedColumns.title !== undefined) {
			if (!bestCandidate || matchCount > bestCandidate.score) {
				bestCandidate = { rowIndex: r, columnMap: matchedColumns, score: matchCount };
			}
		}
	}

	return bestCandidate;
};

export const parseSpreadsheetRows = (
	rows: unknown[][],
	sheetName?: string
): ParseSpreadsheetResult => {
	if (!rows || rows.length === 0) {
		throw new Error(sheetName ? `Sheet "${sheetName}" kosong.` : 'Data spreadsheet kosong.');
	}

	const headerMatch = findHeaderRow(rows);
	if (!headerMatch) {
		throw new Error(
			sheetName
				? `Format header spreadsheet Knitto tidak ditemukan pada sheet "${sheetName}". Pastikan ada kolom "Test Case ID" atau "Test Case".`
				: 'Format header spreadsheet Knitto tidak ditemukan. Pastikan ada kolom "Test Case ID" atau "Test Case".'
		);
	}

	const { rowIndex: headerRowIndex, columnMap } = headerMatch;
	const items: ParsedImportTestCase[] = [];

	for (let r = headerRowIndex + 1; r < rows.length; r++) {
		const row = rows[r];
		if (!Array.isArray(row)) continue;

		const getCell = (colName: string): string => {
			const idx = columnMap[colName];
			if (idx === undefined || idx < 0 || idx >= row.length) return '';
			return String(row[idx] ?? '').trim();
		};

		const testCaseId = getCell('test_case_id');
		const title = getCell('title');
		const testVar = getCell('test_variable');

		// Abaikan baris kosong
		if (!testCaseId && !title && !testVar) continue;

		let testType = getCell('test_type');
		if (testType === '-' || testType.toLowerCase() === 'negative') testType = '-';
		else testType = '+';

		let status = getCell('status') || 'Progress';
		const validStatuses = ['Progress', 'Passed', 'Failed', 'Re-Test', 'Skip'];
		const matchedStatus = validStatuses.find((s) => s.toLowerCase() === status.toLowerCase());
		status = matchedStatus ?? 'Progress';

		items.push({
			test_case_id: testCaseId || `TC-ROW-${r + 1}`,
			title: title || testVar || testCaseId || `Skenario Baris ${r + 1}`,
			group_no: getCell('group_no') || undefined,
			feature: getCell('feature') || undefined,
			process_no: getCell('process_no') || undefined,
			test_type: testType,
			test_variable: testVar || undefined,
			pre_condition: getCell('pre_condition') || undefined,
			test_data: getCell('test_data') || undefined,
			test_steps: getCell('test_steps') || undefined,
			expected_result: getCell('expected_result') || undefined,
			actual_result: getCell('actual_result') || undefined,
			status,
			evidence: getCell('evidence') || undefined,
			remarks: getCell('remarks') || undefined,
			automation_tools: getCell('automation_tools') || undefined
		});
	}

	return {
		items,
		headerRowIndex,
		detectedColumns: columnMap,
		totalRowsFound: items.length,
		sheetName
	};
};

export const parseSpreadsheetCsv = (csvText: string): ParseSpreadsheetResult => {
	const workbook = XLSX.read(csvText, { type: 'string' });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error('Data spreadsheet kosong.');

	const worksheet = workbook.Sheets[sheetName];
	const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
		header: 1,
		defval: ''
	});

	return parseSpreadsheetRows(rows);
};

export const parseSpreadsheetFile = async (
	fileData: ArrayBuffer | Uint8Array,
	preferredSheetName?: string
): Promise<ParseSpreadsheetResult> => {
	const workbook = XLSX.read(fileData, { type: 'array' });
	if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
		throw new Error('File spreadsheet tidak memiliki sheet.');
	}

	// Jika ada preferredSheetName, utamakan itu
	let chosenSheetName = preferredSheetName && workbook.Sheets[preferredSheetName] ? preferredSheetName : '';
	let highestScore = -1;

	// Jika tidak ada preferredSheetName, pindai semua sheet dan pilih yang paling cocok
	if (!chosenSheetName) {
		for (const name of workbook.SheetNames) {
			const ws = workbook.Sheets[name];
			if (!ws) continue;
			const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
			const match = findHeaderRow(rows);
			if (match && match.score > highestScore) {
				highestScore = match.score;
				chosenSheetName = name;
			}
		}
	}

	if (!chosenSheetName) {
		chosenSheetName = workbook.SheetNames[0];
	}

	const worksheet = workbook.Sheets[chosenSheetName];
	const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
		header: 1,
		defval: ''
	});

	return parseSpreadsheetRows(rows, chosenSheetName);
};
