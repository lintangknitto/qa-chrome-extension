import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSpreadsheetCsv, parseSpreadsheetFile } from '../spreadsheetParser';
// CSV asli dari spreadsheet "FORMAT TEST CASE" (diunduh 2026-10-08): tab V4 (gid 1730053292) & CONTOH TEST CASE (gid 603972469).
import v4Csv from './fixtures/format-test-case-v4.csv?raw';
import contohCsv from './fixtures/contoh-test-case.csv?raw';

const pick = (item: Record<string, unknown>) => ({
	id: item.test_case_id,
	title: item.title,
	scenario: item.scenario,
	group: item.group_no,
	feature: item.feature,
	fc: item.process_no,
	type: item.test_type,
	status: item.status,
	automation: item.automation_tools,
	date: item.test_date
});

describe('spreadsheetParser — format V4', () => {
	it('tab V4: setiap baris punya TYPE, Status, Automation Tools yang benar; header metadata & blok PB diabaikan', () => {
		const result = parseSpreadsheetCsv(v4Csv);
		expect(result.headerRowIndex).toBe(17);
		expect(result.detectedColumns).toMatchObject({ scenario: 6, title: 7, test_date: 16, automation_tools: 15 });
		expect(result.items.map(pick)).toEqual([
			{ id: 'TC1-1', title: 'TC1-1', scenario: undefined, group: undefined, feature: undefined, fc: undefined, type: '+', status: 'Progress', automation: 'Masuk Test Step', date: undefined },
			{ id: 'TC1-2', title: 'TC1-2', scenario: undefined, group: undefined, feature: undefined, fc: undefined, type: '-', status: 'Passed', automation: 'Test Data', date: undefined },
			{ id: 'TC1-3', title: 'TC1-3', scenario: undefined, group: undefined, feature: undefined, fc: undefined, type: '+', status: 'Re-Test', automation: 'Tanpa Automation', date: undefined }
		]);
	});

	it('CONTOH TEST CASE: Scenario & Test Case dipisah, sel merge diwariskan, Date terimpor, dua tabel PB terbaca', () => {
		const result = parseSpreadsheetCsv(contohCsv);
		const rows = result.items.map(pick);
		const proses2 = 'FC 2C.18.9.21 - Proses 2';
		const qty = 'MENGUJI EDIT ORDER PERUBAHAN QTY';
		const bayar = 'MEMASTIKAN BUTTON KONFIRMASI PEMBAYARAN ENABLE UNTUK ORDER YANG BERHASIL EDIT';

		expect(rows.slice(0, 8)).toEqual([
			{ id: 'TC1-1', title: 'Test Tambah item kain pada Order Kain', scenario: qty, group: '1', feature: 'Pengecekan Perubahan Qty Order', fc: proses2, type: '+', status: 'Passed', automation: undefined, date: '19/09/24' },
			{ id: 'TC1-2', title: 'Test Tambah item Katalog pada Order Kain', scenario: qty, group: '1', feature: 'Pengecekan Perubahan Qty Order', fc: proses2, type: '+', status: 'Progress', automation: undefined, date: '19/09/24' },
			{ id: 'TC1-3', title: 'Test Tambah item Katalog pada Order Katalog', scenario: qty, group: '1', feature: 'Pengecekan Perubahan Qty Order', fc: proses2, type: '+', status: 'Failed', automation: undefined, date: '20/09/24' },
			{ id: 'TC1-4', title: 'Test Tambah dan Kurangi Qty - pada Semua Item', scenario: qty, group: '1', feature: 'Pengecekan Perubahan Qty Order', fc: 'FC 2C.18.9.21 - Proses 4', type: '+', status: 'Progress', automation: undefined, date: undefined },
			{ id: 'TC2-1', title: 'Test Button Konfirmasi Pembayaran via Rincian Order pada Order yg belum diedit', scenario: bayar, group: '2', feature: 'Konfirmasi Pembayaran', fc: 'FC 2C.6.2 - Proses 11', type: '+', status: 'Progress', automation: undefined, date: undefined },
			{ id: 'TC2-2', title: "Test Button Konfirmasi Pembayaran via Rincian Order pada Order yg statusnya 'gagal-edit'", scenario: bayar, group: '2', feature: 'Konfirmasi Pembayaran', fc: 'FC 2C.6.2 - Proses 11', type: '+', status: 'Progress', automation: undefined, date: undefined },
			{ id: 'TC2-3', title: "Test Order status 'gagal-edit' - klik Konfirmasi Pembayaran", scenario: bayar, group: '2', feature: 'Konfirmasi Pembayaran', fc: 'FC 2C.6.2 - Proses 21', type: '+', status: 'Progress', automation: undefined, date: undefined },
			// Grup baru: scenario grup 2 tidak boleh terbawa
			{ id: 'TC3-3', title: 'Test penambahakan button Edit Order pada halaman Status Order', scenario: undefined, group: '3', feature: 'Page Status Order', fc: 'KN UI 942.2 - UI Hal 20', type: '+', status: 'Progress', automation: undefined, date: undefined }
		]);

		// Tabel PB kedua (header berulang, "Prosess No (FC)", tanpa kolom Scenario): forward-fill direset
		expect(rows[8]).toMatchObject({
			id: 'TC1-1',
			title: '[DESKTOP]\nTest di Keranjang sudah ada item Kain, 1 Sample, lalu ditambahkan 1 sample yg sama',
			scenario: undefined,
			group: '1',
			feature: "Penjagaan Button 'Beli' atau 'Minta Sample'",
			fc: '(FC: 2C.5.4 - Proses 8)',
			status: 'Passed',
			date: '19/09/24'
		});
		expect(result.duplicateTestCaseIds).toEqual(['TC1-1']);
		// Baris BRD di antara tabel tidak ikut terimpor
		expect(rows.some((row) => String(row.group).startsWith('BRD'))).toBe(false);
	});

	it('pemetaan template (V5 tiruan dengan header berbeda) dipakai lebih dulu, alias bawaan tetap jadi fallback', () => {
		const csv = [
			'Grup,Kode TC,Skenario Uji,Kasus Uji,Hasil,Tgl Uji',
			'A,X-1,Login,Login sukses,passed,1/10/26',
			',X-2,,Login gagal,Failed,2/10/26'
		].join('\n');
		const mapping = {
			test_case_id: { header: 'Kode TC' },
			title: { header: 'Kasus Uji' },
			scenario: { header: 'Skenario Uji' },
			status: { header: 'Hasil' },
			test_date: { header: 'Tgl Uji' }
		};
		const result = parseSpreadsheetCsv(csv, mapping);
		expect(result.items.map(pick)).toEqual([
			{ id: 'X-1', title: 'Login sukses', scenario: 'Login', group: 'A', feature: undefined, fc: undefined, type: '+', status: 'Passed', automation: undefined, date: '1/10/26' },
			{ id: 'X-2', title: 'Login gagal', scenario: 'Login', group: 'A', feature: undefined, fc: undefined, type: '+', status: 'Failed', automation: undefined, date: '2/10/26' }
		]);
	});

	it('template memetakan "Test Case" ke field lain: header template menang atas alias bawaan', () => {
		const csv = ['Test Case,Judul Kasus,Status', 'TC-9,Cek menu,Passed'].join('\n');
		const result = parseSpreadsheetCsv(csv, { test_case_id: { header: 'Test Case' }, title: { header: 'Judul Kasus' } });
		expect(result.items[0]).toMatchObject({ test_case_id: 'TC-9', title: 'Cek menu' });
	});

	it('file xlsx: sel tanggal diimpor sebagai teks yang tampil, bukan serial number', async () => {
		const ws = XLSX.utils.aoa_to_sheet([
			['Group No', 'Feature', 'Test Case ID', 'Scenario', 'Test Case', 'Status', 'Date'],
			['1', 'Login', 'TC1-1', 'Login', 'Login sukses', 'Passed', new Date(Date.UTC(2025, 10, 7))]
		], { cellDates: true, dateNF: 'd mmmm yyyy' });
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'FORMAT TEST CASE V4');
		const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

		const result = await parseSpreadsheetFile(buffer);
		expect(result.items[0].test_date).toBe('7 November 2025');
		expect(result.items[0].scenario).toBe('Login');
	});
});
