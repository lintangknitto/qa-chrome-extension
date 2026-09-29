import { describe, expect, it } from 'vitest';
import { buildLocatorCandidates } from '../locatorCandidates';

describe('buildLocatorCandidates', () => {
	it('memprioritaskan test id', () => {
		const candidates = buildLocatorCandidates({ tagName: 'BUTTON', testId: 'submit-order' });
		expect(candidates[0]).toBe("getByTestId('submit-order')");
	});

	it('membuat role + name bila tersedia', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'BUTTON',
			role: 'button',
			ariaLabel: 'Login'
		});
		expect(candidates[0]).toBe("getByRole('button', { name: 'Login' })");
	});

	it('membuat button role otomatis dari tag dan text', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'BUTTON',
			text: 'Simpan Perubahan'
		});
		expect(candidates).toContain("getByRole('button', { name: 'Simpan Perubahan' })");
	});

	it('membuat link role otomatis dari tag <a> dan text', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'A',
			text: 'Lihat Detail'
		});
		expect(candidates).toContain("getByRole('link', { name: 'Lihat Detail' })");
	});

	it('memakai labelText untuk input yang memiliki label terhubung', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'INPUT',
			labelText: 'Nama Lengkap'
		});
		expect(candidates).toContain("getByLabel('Nama Lengkap')");
	});

	it('memakai placeholder untuk input', () => {
		const candidates = buildLocatorCandidates({ tagName: 'INPUT', placeholder: 'Email address' });
		expect(candidates).toContain("getByPlaceholder('Email address')");
	});

	it('memakai name atribut untuk input formulir', () => {
		const candidates = buildLocatorCandidates({ tagName: 'INPUT', name: 'user_phone' });
		expect(candidates).toContain("locator('[name=\"user_phone\"]')");
	});

	it('memakai title dan alt text bila tersedia', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'IMG',
			alt: 'Logo Knitto',
			title: 'Knitto QA Tools'
		});
		expect(candidates).toContain("getByAltText('Logo Knitto')");
		expect(candidates).toContain("getByTitle('Knitto QA Tools')");
	});

	it('memakai cssPath bila tersedia', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'INPUT',
			cssPath: 'form#login-form > div:nth-of-type(2) > input'
		});
		expect(candidates).toContain("locator('form#login-form > div:nth-of-type(2) > input')");
	});

	it('memakai id dan kelas sebagai kandidat terakhir', () => {
		const candidates = buildLocatorCandidates({
			tagName: 'DIV',
			id: 'main',
			classes: ['card', 'rounded']
		});
		expect(candidates).toContain("locator('#main')");
		expect(candidates).toContain("locator('div.card')");
	});

	it('meng-escape tanda kutip pada teks', () => {
		const candidates = buildLocatorCandidates({ tagName: 'A', text: "It's here" });
		expect(candidates.some((candidate) => candidate.includes("\\'"))).toBe(true);
	});

	it('tetap mengembalikan kandidat tag dasar walau tanpa atribut', () => {
		expect(buildLocatorCandidates({ tagName: 'SECTION' })).toEqual(["locator('section')"]);
	});
});
