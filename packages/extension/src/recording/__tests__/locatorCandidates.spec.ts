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

	it('memakai placeholder untuk input', () => {
		const candidates = buildLocatorCandidates({ tagName: 'INPUT', placeholder: 'Email address' });
		expect(candidates).toContain("getByPlaceholder('Email address')");
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
