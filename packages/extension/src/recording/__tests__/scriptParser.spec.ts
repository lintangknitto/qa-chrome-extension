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
			{ action: 'press', locator: { kind: 'text', value: 'Simpan; lalu tutup', exact: true }, selector: "getByText('Simpan; lalu tutup', { exact: true })", key: 'Enter' },
			// Assertion akhir script juga dijalankan replay.
			{ action: 'expect', assertion: 'toHaveURL', url: 'https://app.example.test/customer' }
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
		expect(steps.map((s) => s.action)).toEqual(['goto', 'hover', 'dblclick', 'rightclick', 'drag', 'setInputFiles', 'click', 'expect']);
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

	it('scroll: mouse.wheel → scrollBy, evaluate(scrollTo) → scrollTo (termasuk di iframe)', () => {
		const steps = parseScript(`
	await page.mouse.wheel(0, 1000);
	await page.getByTestId('chat-list').evaluate((el) => el.scrollTo(0, 700));
	await page.getByTitle('Live Chat', { exact: true }).contentFrame().locator('html').evaluate((el) => el.scrollTo(0, 50));`);
		expect(strip(steps)).toEqual([
			{ action: 'scrollBy', x: 0, y: 1000 },
			{ action: 'scrollTo', locator: { kind: 'testId', value: 'chat-list' }, selector: "getByTestId('chat-list')", x: 0, y: 700 },
			{
				action: 'scrollTo',
				locator: { kind: 'css', value: 'html' },
				frames: [{ kind: 'title', value: 'Live Chat', exact: true }],
				selector: "getByTitle('Live Chat', { exact: true }).contentFrame().locator('html')",
				x: 0,
				y: 50
			}
		]);
	});

	it('navigasi: reload, goBack, goForward, waitForURL glob dan RegExp', () => {
		const steps = parseScript(`
	await page.reload();
	await page.goBack();
	await page.goForward();
	await page.waitForURL('**/chat/*');
	await page.waitForURL(/\\/chat\\/[^/]+$/);`);
		expect(strip(steps)).toEqual([
			{ action: 'reload' },
			{ action: 'goBack' },
			{ action: 'goForward' },
			{ action: 'waitForUrl', url: '**/chat/*' },
			{ action: 'waitForUrl', url: '\\/chat\\/[^/]+$', urlRegex: { regex: '\\/chat\\/[^/]+$', flags: '' } }
		]);
	});

	it('multi-tab: popup Promise.all, context.newPage, langkah di page2, bringToFront', () => {
		const steps = parseScript(`test('x', async ({ page, context }) => {
	const [page2] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Invoice', exact: true }).click()]);
	await page2.waitForURL('**/invoice/*');
	await page2.getByRole('button', { name: 'Cetak', exact: true }).click();
	await page.bringToFront();
	const page3 = await context.newPage();
	await page3.goto('https://docs.example.test/');
	await page3.mouse.wheel(0, 300);
	await expect(page2).toHaveURL(/x/);
});`);
		expect(strip(steps)).toEqual([
			{ action: 'click', locator: { kind: 'role', role: 'link', name: 'Invoice', exact: true }, selector: "getByRole('link', { name: 'Invoice', exact: true })", opensPage: 'page2' },
			{ action: 'waitForUrl', url: '**/invoice/*', page: 'page2' },
			{ action: 'click', locator: { kind: 'role', role: 'button', name: 'Cetak', exact: true }, selector: "getByRole('button', { name: 'Cetak', exact: true })", page: 'page2' },
			{ action: 'bringToFront' },
			{ action: 'newPage', page: 'page3' },
			{ action: 'goto', url: 'https://docs.example.test/', page: 'page3' },
			{ action: 'scrollBy', x: 0, y: 300, page: 'page3' },
			{ action: 'expect', assertion: 'toHaveURL', url: 'x', urlRegex: { regex: 'x', flags: '' }, page: 'page2' }
		]);
	});

	it('assertion checkpoint: toContainText/toBeVisible pada locator (termasuk iframe & page2), toHaveURL RegExp; matcher lain dilewati', () => {
		const steps = parseScript(`
	await expect(page.getByRole('status')).toContainText('Pesan \\'terkirim\\'');
	await expect(page2.getByTestId('centang')).toBeVisible();
	await expect(page.getByTitle('Chat').contentFrame().getByText('Halo')).toHaveText('Halo');
	await expect(page).toHaveURL(/^[a-z][\\w+.-]*:\\/\\/[^/]+\\/chat\\/[^/]+(?:[?#].*)?$/);
	await expect(page.getByText('x')).not.toBeVisible();
	await expect(page.getByText('y')).toHaveCount(2);`);
		expect(strip(steps)).toEqual([
			{ action: 'expect', assertion: 'toContainText', locator: { kind: 'role', role: 'status' }, selector: "getByRole('status')", value: "Pesan 'terkirim'" },
			{ action: 'expect', assertion: 'toBeVisible', locator: { kind: 'testId', value: 'centang' }, selector: "getByTestId('centang')", page: 'page2' },
			{
				action: 'expect',
				assertion: 'toHaveText',
				locator: { kind: 'text', value: 'Halo' },
				frames: [{ kind: 'title', value: 'Chat' }],
				selector: "getByTitle('Chat').contentFrame().getByText('Halo')",
				value: 'Halo'
			},
			{
				action: 'expect',
				assertion: 'toHaveURL',
				url: '^[a-z][\\w+.-]*:\\/\\/[^/]+\\/chat\\/[^/]+(?:[?#].*)?$',
				urlRegex: { regex: '^[a-z][\\w+.-]*:\\/\\/[^/]+\\/chat\\/[^/]+(?:[?#].*)?$', flags: '' }
			}
		]);
	});

	it('frameLocator legacy juga dikenali sebagai frame', () => {
		const [step] = parseScript(`await page.frameLocator('#chat').getByText('Halo').click();`);
		expect(step).toMatchObject({ action: 'click', frames: [{ kind: 'css', value: '#chat' }], locator: { kind: 'text', value: 'Halo' } });
	});
});
