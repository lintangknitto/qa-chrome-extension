/**
 * Membuat kandidat locator Playwright dari deskripsi elemen, diurutkan dari
 * yang paling stabil (test id, role+name) ke yang paling rapuh (CSS path/tag).
 */
import type { LocatorCandidate } from './locatorEngine';

export interface ElementDescriptor {
	tagName: string;
	accessibleName?: string;
	/** Kandidat dari locator engine di halaman, lengkap dengan jumlah match. */
	candidates?: LocatorCandidate[];
	id?: string;
	testId?: string;
	role?: string;
	ariaLabel?: string;
	labelText?: string;
	placeholder?: string;
	name?: string;
	type?: string;
	checked?: boolean;
	selectedText?: string;
	title?: string;
	alt?: string;
	text?: string;
	cssPath?: string;
	xpath?: string;
	classes?: string[];
}

const escapeQuotes = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const quote = (value: string): string => `'${escapeQuotes(value)}'`;

const normalizeText = (value: string | undefined): string =>
	(value ?? '').replace(/\s+/g, ' ').trim();

const validCssIdentifier = (value: string): boolean => /^[A-Za-z][\w-]*$/.test(value);

export const buildLocatorCandidates = (element: ElementDescriptor): string[] => {
	const candidates: string[] = [];
	const tag = (element.tagName || '').toLowerCase();
	const text = normalizeText(element.text);
	const label = normalizeText(element.labelText || element.ariaLabel);

	// 1. Data Test ID (paling stabil)
	if (element.testId) candidates.push(`getByTestId(${quote(element.testId)})`);

	// 2. Role + Accessible Name
	if (element.role && label) {
		candidates.push(`getByRole(${quote(element.role)}, { name: ${quote(label)} })`);
	} else if (element.role && text && text.length <= 60 && ['button', 'link', 'heading', 'tab', 'menuitem'].includes(element.role)) {
		candidates.push(`getByRole(${quote(element.role)}, { name: ${quote(text)} })`);
	} else if (element.role) {
		candidates.push(`getByRole(${quote(element.role)})`);
	} else if (tag === 'button' && (text || label)) {
		candidates.push(`getByRole('button', { name: ${quote(label || text)} })`);
	} else if (tag === 'a' && (text || label)) {
		candidates.push(`getByRole('link', { name: ${quote(label || text)} })`);
	}

	// 3. Label Text (untuk input formulir)
	if (label) {
		candidates.push(`getByLabel(${quote(label)})`);
	}

	// 4. Placeholder
	if (element.placeholder) {
		candidates.push(`getByPlaceholder(${quote(normalizeText(element.placeholder))})`);
	}

	// 5. Input Name Attribute
	if (element.name) {
		candidates.push(`locator(${quote(`[name="${element.name}"]`)})`);
	}

	// 6. Title attribute
	if (element.title) {
		candidates.push(`getByTitle(${quote(normalizeText(element.title))})`);
	}

	// 7. Alt Text (image/icon)
	if (element.alt) {
		candidates.push(`getByAltText(${quote(normalizeText(element.alt))})`);
	}

	// 8. Visible Text Content
	if (text && text.length <= 80 && !candidates.some((c) => c.includes(`{ name: ${quote(text)} }`))) {
		candidates.push(`getByText(${quote(text)})`);
	}

	// 9. ID
	if (element.id && validCssIdentifier(element.id)) {
		candidates.push(`locator(${quote(`#${element.id}`)})`);
	}

	// 10. CSS Path (Hirarki)
	if (element.cssPath && element.cssPath !== tag) {
		candidates.push(`locator(${quote(element.cssPath)})`);
	}

	// 11. Class or Tag Fallback
	const firstClass = (element.classes ?? []).find(validCssIdentifier);
	if (tag && firstClass) candidates.push(`locator(${quote(`${tag}.${firstClass}`)})`);
	else if (tag) candidates.push(`locator(${quote(tag)})`);

	return candidates;
};
