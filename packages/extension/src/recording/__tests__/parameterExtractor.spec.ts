import { describe, expect, it } from 'vitest';
import {
	extractParametersFromPlaywrightScript,
	extractParametersFromUserActions,
	extractReRunParameters,
	generateRandomValue,
	inferParameterType
} from '../parameterExtractor';

describe('parameterExtractor', () => {
	it('mendeteksi tipe parameter secara tepat berdasarkan selector atau nilai', () => {
		expect(inferParameterType('#email', 'tester@knitto.com')).toBe('email');
		expect(inferParameterType('input[name="user_email"]', '')).toBe('email');
		expect(inferParameterType('#qty', '15')).toBe('number');
		expect(inferParameterType('#total_amount', '50000')).toBe('number');
		expect(inferParameterType('#dob', '2026-09-25')).toBe('date');
		expect(inferParameterType('#tanggal_kirim', '')).toBe('date');
		expect(inferParameterType('#customer_name', 'Budi Santoso')).toBe('text');
	});

	it('menghasilkan nilai acak yang valid sesuai tipe data', () => {
		const emailParam = {
			id: '1',
			label: 'Email',
			selector: '#email',
			originalValue: 'old@knitto.com',
			currentValue: 'old@knitto.com',
			type: 'email' as const
		};
		const rndEmail = generateRandomValue(emailParam);
		expect(rndEmail).toContain('@knitto.test');

		const numParam = {
			id: '2',
			label: 'Qty',
			selector: '#qty',
			originalValue: '10',
			currentValue: '10',
			type: 'number' as const
		};
		const rndNum = generateRandomValue(numParam);
		expect(Number(rndNum)).toBeGreaterThan(0);

		const dateParam = {
			id: '3',
			label: 'Tanggal',
			selector: '#date',
			originalValue: '2026-01-01',
			currentValue: '2026-01-01',
			type: 'date' as const
		};
		const rndDate = generateRandomValue(dateParam);
		expect(/^\d{4}-\d{2}-\d{2}$/.test(rndDate)).toBe(true);
	});

	it('mengekstrak parameter dari script Playwright berbagai variasi syntax', () => {
		const script = `
			await page.goto('https://app.knitto.co.id/login');
			await page.fill('#email', 'admin@knitto.com');
			await page.locator('#password').fill('secret123');
			await page.getByLabel('Jumlah').fill('50');
			await page.click('button[type="submit"]');
		`;

		const params = extractParametersFromPlaywrightScript(script);
		expect(params).toHaveLength(3);

		expect(params[0].selector).toBe('#email');
		expect(params[0].originalValue).toBe('admin@knitto.com');
		expect(params[0].type).toBe('email');

		expect(params[1].selector).toBe('#password');
		expect(params[1].originalValue).toBe('secret123');

		expect(params[2].selector).toBe('Jumlah');
		expect(params[2].originalValue).toBe('50');
		expect(params[2].type).toBe('number');
	});

	it('mengekstrak parameter dari user action events jika script belum ada', () => {
		const actions = [
			{ action_type: 'input', target_selector: '#user_id', value: 'tester_01' },
			{ action_type: 'fill', target_selector: '#qty_roll', value: '12' },
			{ action_type: 'click', target_selector: '#btn_submit' }
		];

		const params = extractParametersFromUserActions(actions);
		expect(params).toHaveLength(2);
		expect(params[0].selector).toBe('#user_id');
		expect(params[0].currentValue).toBe('tester_01');
		expect(params[1].selector).toBe('#qty_roll');
		expect(params[1].type).toBe('number');
	});

	it('extractReRunParameters memprioritaskan script jika tersedia', () => {
		const script = `await page.fill('#code', 'ABC-99');`;
		const actions = [{ action_type: 'input', target_selector: '#other', value: '123' }];

		const params = extractReRunParameters({ script, actions });
		expect(params).toHaveLength(1);
		expect(params[0].selector).toBe('#code');
	});

	it('mengembalikan array kosong jika script kosong atau hanya whitespace', () => {
		expect(extractParametersFromPlaywrightScript('')).toEqual([]);
		expect(extractParametersFromPlaywrightScript('   \n\t  ')).toEqual([]);
	});

	it('mengembalikan array kosong jika actions kosong atau tidak berisi input/fill', () => {
		expect(extractParametersFromUserActions([])).toEqual([]);
		expect(
			extractParametersFromUserActions([
				{ action_type: 'click', target_selector: '#btn' },
				{ action_type: 'scroll', target_selector: 'window' }
			])
		).toEqual([]);
	});

	it('extractReRunParameters mengembalikan array kosong jika script dan actions keduanya tidak ada', () => {
		expect(extractReRunParameters({})).toEqual([]);
		expect(extractReRunParameters({ script: null, actions: undefined })).toEqual([]);
	});

	it('inferParameterType mengenali nomor telepon dan fallback ke text jika tidak cocok pola apapun', () => {
		expect(inferParameterType('#nomor_telepon', '08123456789')).toBe('number');
		expect(inferParameterType('#keterangan_catatan', 'Catatan pengiriman cepat')).toBe('text');
	});

	it('generateRandomValue menghasilkan string acak unik untuk tipe text', () => {
		const textParam = {
			id: '4',
			label: 'Catatan',
			selector: '#note',
			originalValue: 'InvoiceTest_01',
			currentValue: 'InvoiceTest_01',
			type: 'text' as const
		};
		const rndText = generateRandomValue(textParam);
		expect(rndText).toMatch(/^InvoiceTest_\d{4}$/);
	});
});
