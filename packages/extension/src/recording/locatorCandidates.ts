/**
 * Membuat kandidat locator Playwright dari deskripsi elemen, diurutkan dari
 * yang paling stabil (test id, role+name) ke yang paling rapuh (CSS path).
 */
export interface ElementDescriptor {
	tagName: string;
	id?: string;
	testId?: string;
	role?: string;
	ariaLabel?: string;
	placeholder?: string;
	name?: string;
	text?: string;
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
	const label = normalizeText(element.ariaLabel);

	if (element.testId) candidates.push(`getByTestId(${quote(element.testId)})`);

	if (element.role && label) candidates.push(`getByRole(${quote(element.role)}, { name: ${quote(label)} })`);
	else if (element.role) candidates.push(`getByRole(${quote(element.role)})`);
	else if (label) candidates.push(`getByLabel(${quote(label)})`);

	if (element.placeholder)
		candidates.push(`getByPlaceholder(${quote(normalizeText(element.placeholder))})`);
	if (element.name) candidates.push(`locator(${quote(`[name="${element.name}"]`)})`);

	if (text && text.length <= 80) candidates.push(`getByText(${quote(text)})`);

	if (element.id && validCssIdentifier(element.id)) candidates.push(`locator(${quote(`#${element.id}`)})`);

	const firstClass = (element.classes ?? []).find(validCssIdentifier);
	if (tag && firstClass) candidates.push(`locator(${quote(`${tag}.${firstClass}`)})`);
	else if (tag) candidates.push(`locator(${quote(tag)})`);

	return candidates;
};
