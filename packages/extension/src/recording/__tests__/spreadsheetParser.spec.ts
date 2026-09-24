import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
	parseSpreadsheetFile,
	findHeaderRow,
	extractGoogleSpreadsheetInfo,
	parseSpreadsheetCsv
} from '../spreadsheetParser';

describe('spreadsheetParser', () => {
	it('extractGoogleSpreadsheetInfo mengekstrak spreadsheetId dan gid dari berbagai format URL Google Sheets', () => {
		// URL dengan parameter query dan hash gid
		const url1 =
			'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=1730053292#gid=1730053292';
		const info1 = extractGoogleSpreadsheetInfo(url1);
		expect(info1).not.toBeNull();
		expect(info1?.spreadsheetId).toBe('1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI');
		expect(info1?.gid).toBe('1730053292');
		expect(info1?.exportUrl).toBe(
			'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/export?format=csv&gid=1730053292'
		);

		// URL hanya dengan hash #gid=...
		const url2 = 'https://docs.google.com/spreadsheets/d/abc-123_XYZ/edit#gid=98765';
		const info2 = extractGoogleSpreadsheetInfo(url2);
		expect(info2?.spreadsheetId).toBe('abc-123_XYZ');
		expect(info2?.gid).toBe('98765');

		// URL tanpa gid (default ke '0')
		const url3 = 'https://docs.google.com/spreadsheets/d/abc-123_XYZ/edit';
		const info3 = extractGoogleSpreadsheetInfo(url3);
		expect(info3?.spreadsheetId).toBe('abc-123_XYZ');
		expect(info3?.gid).toBe('0');

		// URL bukan Google Sheets
		expect(extractGoogleSpreadsheetInfo('https://example.com/sheet.xlsx')).toBeNull();
		expect(extractGoogleSpreadsheetInfo('')).toBeNull();
	});

	it('mendeteksi baris header Knitto dengan skor tertinggi dan mengabaikan baris sub-header parsial di atasnya', () => {
		// Mensimulasikan struktur asli spreadsheet Knitto di mana baris 11 memiliki "TEST CASE" & "TEST CASE ID"
		// tetapi baris 17 memiliki 15 kolom lengkap
		const rawRows = [
			['PROGRAM VERSION RELEASE', 'NAMA PROGRAM', '', 'TESTER'],
			['Summary', '', '', ''],
			['Total Test Case', '3', 'Passed', '1'],
			['', '', '', ''],
			['PB - 1', 'NO', 'PROGRAM SPECIFICATIONS', '', '', '', '', '', '', 'TEST CASE', 'TEST CASE ID', '', '', '', '', ''],
			['', '', '', '', '', '', '', '', '', false, '', '', '', '', '', ''],
			['Group No', 'Feature', 'Process No (FC)', 'TYPE', 'Test Case ID', 'Test Variable', 'Test Case', 'Pre-Condition', 'Test Data', 'Test Steps ', 'Expected Result', 'Status', 'Evidence', 'Remarks', 'Automation Tools', 'Date'],
			['', '', '', '+', 'TC1-1', '', '', '', '', '', '', 'Progress', '', '', 'Masuk Test Step', '']
		];

		const result = findHeaderRow(rawRows);
		expect(result).not.toBeNull();
		// Harus memilih baris ke-6 (yang berisi 15 kolom cocok) bukan baris ke-4 yang hanya cocok 2 kolom
		expect(result?.rowIndex).toBe(6);
		expect(result?.columnMap.test_case_id).toBe(4);
		expect(result?.columnMap.title).toBe(6);
		expect(result?.columnMap.test_type).toBe(3);
		expect(result?.columnMap.status).toBe(11);
		expect(result?.score).toBeGreaterThanOrEqual(10);
	});

	it('mengurai data teks CSV Google Sheets langsung dengan benar', () => {
		const csvData = [
			'PROGRAM VERSION RELEASE,NAMA PROGRAM,,,TESTER',
			'Summary,,,,',
			'Total Test Case,2,Passed,1,Failed,1',
			',,,,',
			'Group No,Feature,Process No (FC),TYPE,Test Case ID,Test Variable,Test Case,Pre-Condition,Test Data,Test Steps ,Expected Result,Status,Evidence,Remarks,Automation Tools',
			',Auth,,+,TC1-1,Valid,Login Sukses,User aktif,user/pass,Input form,Dashboard terbuka,Passed,,Catatan,Masuk Test Step',
			',Auth,,-,TC1-2,Invalid,Login Gagal,User nonaktif,bad/pass,Input form,Error muncul,Failed,,Catatan,Test Data'
		].join('\n');

		const parsed = parseSpreadsheetCsv(csvData);
		expect(parsed.items).toHaveLength(2);
		expect(parsed.items[0].test_case_id).toBe('TC1-1');
		expect(parsed.items[0].title).toBe('Login Sukses');
		expect(parsed.items[0].test_type).toBe('+');
		expect(parsed.items[0].status).toBe('Passed');
		expect(parsed.items[0].expected_result).toBe('Dashboard terbuka');

		expect(parsed.items[1].test_case_id).toBe('TC1-2');
		expect(parsed.items[1].title).toBe('Login Gagal');
		expect(parsed.items[1].test_type).toBe('-');
		expect(parsed.items[1].status).toBe('Failed');
	});

	it('pada file Excel multi-sheet, otomatis memindai dan memilih sheet yang berisi kolom test case', async () => {
		const coverSheetData = [
			['Dokumen Pengujian QA Knitto'],
			['Versi', '1.0'],
			['Tanggal', '2026-09-24']
		];

		const testCaseSheetData = [
			['Group No', 'Feature', 'Process No (FC)', 'TYPE', 'Test Case ID', 'Test Variable', 'Test Case', 'Expected Result', 'Status'],
			['G1', 'Order', 'FC-01', '+', 'TC-ORDER-1', 'Combed 30s', 'Order Kain', 'Order dibuat', 'Passed']
		];

		const wb = XLSX.utils.book_new();
		// Sheet pertama sengaja bukan sheet test case (misal: Cover / Overview)
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coverSheetData), 'Cover');
		// Sheet kedua adalah sheet yang berisi tabel test case
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(testCaseSheetData), 'TestCases');

		const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
		const parsed = await parseSpreadsheetFile(buffer);

		expect(parsed.sheetName).toBe('TestCases');
		expect(parsed.items).toHaveLength(1);
		expect(parsed.items[0].test_case_id).toBe('TC-ORDER-1');
		expect(parsed.items[0].title).toBe('Order Kain');
	});

	it('melempar error jika spreadsheet tidak memiliki kolom header yang valid', async () => {
		const sheetData = [
			['Baris 1', 'Baris 2'],
			['Data 1', 'Data 2']
		];

		const ws = XLSX.utils.aoa_to_sheet(sheetData);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
		const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

		await expect(parseSpreadsheetFile(buffer)).rejects.toThrow(/Format header spreadsheet Knitto tidak ditemukan/);
	});
});
