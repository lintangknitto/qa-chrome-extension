import { describe, expect, it } from 'vitest';
import { parseScript, splitStatements } from '../scriptParser';

const strip = (steps: ReturnType<typeof parseScript>) => steps.map(({ description: _d, ...rest }) => rest);

describe('scriptParser', () => {
	it('mengurai script codegen lengkap di dalam blok test()', () => {
		const script = `import { test, expect } from '@playwright/test';

test('TC1-1 Tambah customer', async ({ page }) => {
	await page.goto('https://app.example.test/login');
	await page.getByPlaceholder('Username', { exact: true }).fill('qa.tester');
	await page.getByLabel('Password', { exact: true }).fill(process.env.QA_SECRET_1 ?? '');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();
	await page.waitForURL('https://app.example.test/dashboard');
	await page.getByLabel('Kota', { exact: true }).selectOption({ label: 'Bandung' });
	await page.getByRole('checkbox', { name: 'Aktif', exact: true }).check();
	await page.getByRole('checkbox').nth(1).uncheck();
	await page.getByText('Simpan; lalu tutup', { exact: true }).press('Enter');
	// checkpoint: toast muncul
	await expect(page).toHaveURL('https://app.example.test/customer');
});`;
		expect(strip(parseScript(script))).toEqual([
			{ action: 'goto', url: 'https://app.example.test/login' },
			{ action: 'fill', locator: { kind: 'placeholder', value: 'Username', exact: true }, selector: "getByPlaceholder('Username', { exact: true })", value: 'qa.tester' },
			{ action: 'fill', locator: { kind: 'label', value: 'Password', exact: true }, selector: "getByLabel('Password', { exact: true })", value: '' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'Masuk', exact: true }, selector: "getByRole('button', { name: 'Masuk', exact: true })" },
			{ action: 'waitForUrl', url: 'https://app.example.test/dashboard' },
			{ action: 'select', locator: { kind: 'label', value: 'Kota', exact: true }, selector: "getByLabel('Kota', { exact: true })", value: 'Bandung', optionBy: 'label' },
			{ action: 'check', locator: { kind: 'role', role: 'checkbox', name: 'Aktif', exact: true }, selector: "getByRole('checkbox', { name: 'Aktif', exact: true })", value: 'true' },
			{ action: 'check', locator: { kind: 'role', role: 'checkbox', nth: 1 }, selector: "getByRole('checkbox').nth(1)", value: 'false' },
			{ action: 'press', locator: { kind: 'text', value: 'Simpan; lalu tutup', exact: true }, selector: "getByText('Simpan; lalu tutup', { exact: true })", key: 'Enter' }
		]);
	});

	it('mendukung regex locator, variabel, chained multiline, dan keyboard', () => {
		const script = `
			const kolom = page.getByPlaceholder(/ketik pesan/i);
			await kolom.fill('Halo');
			await page
				.getByRole('button', { name: /kirim|send/i })
				.click();
			await page.keyboard.press('Escape');
		`;
		expect(strip(parseScript(script))).toEqual([
			{ action: 'fill', locator: { kind: 'placeholder', value: 'ketik pesan', regexFlags: 'i' }, selector: 'getByPlaceholder(/ketik pesan/i)', value: 'Halo' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'kirim|send', regexFlags: 'i' }, selector: "getByRole('button', { name: /kirim|send/i })" },
			{ action: 'press', key: 'Escape' }
		]);
	});

	it('meng-unescape string dan mengabaikan statement non-page', () => {
		const script = `
			const x = 1;
			await page.getByText('It\\'s "ok"').click();
			console.log('page.goto("nope")');
		`;
		expect(strip(parseScript(script))).toEqual([
			{ action: 'click', locator: { kind: 'text', value: `It's "ok"` }, selector: `getByText('It\\'s "ok"')` }
		]);
	});

	it('splitStatements tidak memecah ; di dalam string', () => {
		expect(splitStatements(`a('x;y'); b();`)).toEqual([`a('x;y');`, 'b();']);
	});
});

describe('scriptParser kontrak output codegen API (aksi lanjutan)', () => {
	// Baris-baris ini identik dengan keluaran `playwright-codegen.ts` di qa-extension-api.
	const script = `test('TC-ADV Aksi lanjutan', async ({ page }) => {
	await page.goto('https://app.example.test/');
	await page.getByRole('button', { name: 'Laporan', exact: true }).hover();
	await page.getByText('Baris 1', { exact: true }).dblclick();
	await page.getByRole('row', { name: 'Baris 2', exact: true }).click({ button: 'right' });
	await page.getByTestId('card-1').dragTo(page.getByTestId('kolom-selesai'));
	await page.getByLabel('Lampiran', { exact: true }).setInputFiles(['fixtures/invoice 1.pdf']);
	// sediakan file uji di fixtures/: invoice 1.pdf
	await page.getByTitle('Live Chat', { exact: true }).contentFrame().getByRole('button', { name: 'Kirim', exact: true }).click();
	await expect(page).toHaveURL('https://app.example.test/');
});`;

	it('mengurai setiap baris aksi menjadi satu langkah replay', () => {
		const steps = parseScript(script);
		expect(steps.map((s) => s.action)).toEqual(['goto', 'hover', 'dblclick', 'rightclick', 'drag', 'setInputFiles', 'click']);
		expect(steps[4]).toMatchObject({
			locator: { kind: 'testId', value: 'card-1' },
			target: { kind: 'testId', value: 'kolom-selesai' }
		});
		expect(steps[6]).toMatchObject({
			frames: [{ kind: 'title', value: 'Live Chat', exact: true }],
			locator: { kind: 'role', role: 'button', name: 'Kirim', exact: true },
			selector: "getByTitle('Live Chat', { exact: true }).contentFrame().getByRole('button', { name: 'Kirim', exact: true })"
		});
	});

	it('frameLocator legacy juga dikenali sebagai frame', () => {
		const [step] = parseScript(`await page.frameLocator('#chat').getByText('Halo').click();`);
		expect(step).toMatchObject({ action: 'click', frames: [{ kind: 'css', value: '#chat' }], locator: { kind: 'text', value: 'Halo' } });
	});
});
