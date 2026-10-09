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
	/** Test Case ID yang muncul lebih dari sekali (mis. TC1-1 di dua blok PB); saat import baris terakhir menimpa. */
	duplicateTestCaseIds?: string[];
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

/** Pemetaan kolom dari template terdaftar: field sistem → header + alias. */
export type TemplateColumnMapping = Record<string, { header: string; aliases?: string[] }>;

/**
 * Alias bawaan (fallback bila template tidak memetakan field). `title` = kolom "Test Case";
 * "Scenario" punya field sendiri supaya tidak lagi dipakai sebagai judul.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
	test_case_id: ['test case id', 'tc id', 'case id', 'tc_id', 'no test case', 'test case no', 'id test case'],
	title: ['test case', 'title', 'judul', 'nama test case', 'deskripsi test case'],
	scenario: ['scenario', 'skenario'],
	group_no: ['group no', 'group', 'grup', 'no grup', 'group_no'],
	feature: ['feature', 'fitur', 'modul', 'module'],
	process_no: ['process no (fc)', 'prosess no (fc)', 'process no', 'no proses', 'process_no'],
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
	automation_tools: ['automation tools', 'tools', 'alat otomasi', 'automation'],
	test_date: ['date', 'tanggal', 'test date']
};

export const TOTAL_KNOWN_COLUMNS = Object.keys(COLUMN_ALIASES).length;

/** Kolom yang di spreadsheet di-merge per grup: hanya baris pertama berisi nilai, baris berikutnya mewarisi. */
const FORWARD_FILL_FIELDS = ['group_no', 'feature', 'process_no', 'scenario'] as const;

/** Baris dianggap header tabel bila memuat Test Case ID + Test Case dan cukup banyak kolom lain (bukan baris blok PB). */
const MIN_TABLE_HEADER_SCORE = 4;

const VALID_STATUSES = ['Progress', 'Passed', 'Failed', 'Re-Test', 'Skip'];

export const normalizeHeaderCell = (cell: unknown): string =>
	String(cell ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();

/** Daftar kandidat header per field: header & alias template (prioritas), lalu alias bawaan. */
const buildAliasPasses = (mapping?: TemplateColumnMapping): Array<Record<string, string[]>> => {
	const templatePass: Record<string, string[]> = {};
	for (const [field, column] of Object.entries(mapping ?? {})) {
		templatePass[field] = [column.header, ...(column.aliases ?? [])].map(normalizeHeaderCell).filter(Boolean);
	}
	return [templatePass, COLUMN_ALIASES];
};

const matchColumns = (row: unknown[], mapping?: TemplateColumnMapping): Record<string, number> => {
	const cells = row.map(normalizeHeaderCell);
	const matched: Record<string, number> = {};
	const claimed = new Set<number>();
	for (const pass of buildAliasPasses(mapping)) {
		for (const [field, aliases] of Object.entries(pass)) {
			if (matched[field] !== undefined) continue;
			const idx = cells.findIndex((cell, i) => !claimed.has(i) && cell !== '' && aliases.includes(cell));
			if (idx === -1) continue;
			matched[field] = idx;
			claimed.add(idx);
		}
	}
	return matched;
};

const isTableHeader = (columnMap: Record<string, number>): boolean =>
	columnMap.test_case_id !== undefined && columnMap.title !== undefined && Object.keys(columnMap).length >= MIN_TABLE_HEADER_SCORE;

export const findHeaderRow = (
	rows: unknown[][],
	mapping?: TemplateColumnMapping
): { rowIndex: number; columnMap: Record<string, number>; score: number } | null => {
	let bestCandidate: { rowIndex: number; columnMap: Record<string, number>; score: number } | null = null;

	for (let r = 0; r < Math.min(rows.length, 50); r++) {
		const row = rows[r];
		if (!Array.isArray(row)) continue;

		const matchedColumns = matchColumns(row, mapping);
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

const normalizeTestType = (raw: string): string => (raw === '-' || raw.toLowerCase() === 'negative' ? '-' : '+');

const normalizeStatus = (raw: string): string =>
	VALID_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase()) ?? 'Progress';

export const parseSpreadsheetRows = (
	rows: unknown[][],
	sheetName?: string,
	mapping?: TemplateColumnMapping
): ParseSpreadsheetResult => {
	if (!rows || rows.length === 0) {
		throw new Error(sheetName ? `Sheet "${sheetName}" kosong.` : 'Data spreadsheet kosong.');
	}

	const headerMatch = findHeaderRow(rows, mapping);
	if (!headerMatch) {
		throw new Error(
			sheetName
				? `Format header spreadsheet Knitto tidak ditemukan pada sheet "${sheetName}". Pastikan ada kolom "Test Case ID" atau "Test Case".`
				: 'Format header spreadsheet Knitto tidak ditemukan. Pastikan ada kolom "Test Case ID" atau "Test Case".'
		);
	}

	const { rowIndex: headerRowIndex } = headerMatch;
	let columnMap = headerMatch.columnMap;
	const detectedColumns = { ...columnMap };
	const items: ParsedImportTestCase[] = [];
	const seenIds = new Set<string>();
	const duplicateTestCaseIds = new Set<string>();
	let carried: Partial<Record<(typeof FORWARD_FILL_FIELDS)[number], string>> = {};

	for (let r = headerRowIndex + 1; r < rows.length; r++) {
		const row = rows[r];
		if (!Array.isArray(row)) continue;

		// Spreadsheet bisa berisi beberapa tabel (satu per PB): header baru → pemetaan & nilai warisan direset.
		const rowColumns = matchColumns(row, mapping);
		if (isTableHeader(rowColumns)) {
			columnMap = rowColumns;
			Object.assign(detectedColumns, rowColumns);
			carried = {};
			continue;
		}

		const getCell = (colName: string): string => {
			const idx = columnMap[colName];
			if (idx === undefined || idx < 0 || idx >= row.length) return '';
			return String(row[idx] ?? '').trim();
		};

		const testCaseId = getCell('test_case_id');
		const title = getCell('title');
		const testVar = getCell('test_variable');
		const ownScenario = getCell('scenario');

		// Abaikan baris kosong / baris non-data (mis. baris BRD di antara tabel) — dicek sebelum forward-fill.
		if (!testCaseId && !title && !testVar && !ownScenario) continue;

		// Group No baru = grup merge baru; feature/FC/scenario grup sebelumnya tidak boleh terbawa.
		if (getCell('group_no')) carried = {};
		for (const field of FORWARD_FILL_FIELDS) {
			const own = getCell(field);
			if (own) carried[field] = own;
		}
		const scenario = carried.scenario ?? '';

		const finalId = testCaseId || `TC-ROW-${r + 1}`;
		if (seenIds.has(finalId)) duplicateTestCaseIds.add(finalId);
		seenIds.add(finalId);

		items.push({
			test_case_id: finalId,
			title: title || scenario || testVar || testCaseId || `Skenario Baris ${r + 1}`,
			scenario: scenario || undefined,
			group_no: carried.group_no || undefined,
			feature: carried.feature || undefined,
			process_no: carried.process_no || undefined,
			test_type: normalizeTestType(getCell('test_type')),
			test_variable: testVar || undefined,
			pre_condition: getCell('pre_condition') || undefined,
			test_data: getCell('test_data') || undefined,
			test_steps: getCell('test_steps') || undefined,
			expected_result: getCell('expected_result') || undefined,
			actual_result: getCell('actual_result') || undefined,
			status: normalizeStatus(getCell('status') || 'Progress'),
			evidence: getCell('evidence') || undefined,
			remarks: getCell('remarks') || undefined,
			automation_tools: getCell('automation_tools') || undefined,
			test_date: getCell('test_date') || undefined
		});
	}

	return {
		items,
		headerRowIndex,
		detectedColumns,
		totalRowsFound: items.length,
		sheetName,
		duplicateTestCaseIds: [...duplicateTestCaseIds]
	};
};

/** Nilai sel sebagai teks yang tampil (tanggal tetap "7 November 2025", bukan serial number). */
const sheetRows = (worksheet: XLSX.WorkSheet): unknown[][] =>
	XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

export const parseSpreadsheetCsv = (csvText: string, mapping?: TemplateColumnMapping): ParseSpreadsheetResult => {
	// raw: CSV dibaca apa adanya; tanggal seperti "19/09/24" tidak diubah jadi serial tanggal.
	const workbook = XLSX.read(csvText, { type: 'string', raw: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error('Data spreadsheet kosong.');

	return parseSpreadsheetRows(sheetRows(workbook.Sheets[sheetName]), undefined, mapping);
};

export const parseSpreadsheetFile = async (
	fileData: ArrayBuffer | Uint8Array,
	preferredSheetName?: string,
	mapping?: TemplateColumnMapping
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
			const match = findHeaderRow(sheetRows(ws), mapping);
			if (match && match.score > highestScore) {
				highestScore = match.score;
				chosenSheetName = name;
			}
		}
	}

	if (!chosenSheetName) {
		chosenSheetName = workbook.SheetNames[0];
	}

	return parseSpreadsheetRows(sheetRows(workbook.Sheets[chosenSheetName]), chosenSheetName, mapping);
};

/** Label field sistem (urutan kolom V4) untuk UI pemetaan template. */
export const TEMPLATE_FIELD_LABELS: Array<{ field: string; label: string; required?: boolean }> = [
	{ field: 'group_no', label: 'Group No' },
	{ field: 'feature', label: 'Feature' },
	{ field: 'process_no', label: 'Process No (FC)' },
	{ field: 'test_type', label: 'TYPE' },
	{ field: 'test_case_id', label: 'Test Case ID', required: true },
	{ field: 'test_variable', label: 'Test Variable' },
	{ field: 'scenario', label: 'Scenario' },
	{ field: 'title', label: 'Test Case', required: true },
	{ field: 'pre_condition', label: 'Pre-Condition' },
	{ field: 'test_data', label: 'Test Data' },
	{ field: 'test_steps', label: 'Test Steps' },
	{ field: 'expected_result', label: 'Expected Result' },
	{ field: 'status', label: 'Status' },
	{ field: 'evidence', label: 'Evidence' },
	{ field: 'remarks', label: 'Remarks' },
	{ field: 'automation_tools', label: 'Automation Tools' },
	{ field: 'test_date', label: 'Date' }
];

export interface TemplateMappingCheck {
	headerRowIndex: number | null;
	mapped: Array<{ field: string; header: string }>;
	unmapped: string[];
}

/**
 * "Uji template": cari baris header tab memakai pemetaan template SAJA (tanpa alias bawaan),
 * lalu laporkan field mana yang ketemu kolomnya dan mana yang tidak.
 */
export const checkTemplateMapping = (csvText: string, mapping: TemplateColumnMapping): TemplateMappingCheck => {
	const workbook = XLSX.read(csvText, { type: 'string', raw: true });
	const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
	const rows = sheet ? sheetRows(sheet) : [];
	const fields = Object.keys(mapping);

	let best: { rowIndex: number; matched: Record<string, number> } | null = null;
	for (let r = 0; r < Math.min(rows.length, 50); r++) {
		const row = rows[r];
		if (!Array.isArray(row)) continue;
		const cells = row.map(normalizeHeaderCell);
		const matched: Record<string, number> = {};
		for (const field of fields) {
			const candidates = [mapping[field].header, ...(mapping[field].aliases ?? [])].map(normalizeHeaderCell).filter(Boolean);
			const idx = cells.findIndex((cell) => cell !== '' && candidates.includes(cell));
			if (idx !== -1) matched[field] = idx;
		}
		if (!best || Object.keys(matched).length > Object.keys(best.matched).length) best = { rowIndex: r, matched };
	}

	if (!best || Object.keys(best.matched).length === 0) return { headerRowIndex: null, mapped: [], unmapped: fields };
	const headerRow = rows[best.rowIndex];
	return {
		headerRowIndex: best.rowIndex,
		mapped: Object.entries(best.matched).map(([field, idx]) => ({ field, header: String(headerRow[idx] ?? '').trim() })),
		unmapped: fields.filter((field) => best!.matched[field] === undefined)
	};
};
