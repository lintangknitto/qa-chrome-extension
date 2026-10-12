/**
 * Pencocokan URL untuk replay `waitForURL`/`toHaveURL`, mengikuti semantik Playwright:
 * string = glob (`**` apa saja, `*` apa saja kecuali `/`, `{a,b}` alternatif, `\x` literal),
 * string tanpa wildcard = cocok persis; RegExp = `test()` terhadap URL lengkap.
 */

export type UrlExpectation = { glob: string } | { regex: string; flags: string };

export const globToRegExp = (glob: string): RegExp => {
	let source = '';
	let inGroup = false;
	for (let i = 0; i < glob.length; i++) {
		const ch = glob[i];
		if (ch === '\\' && i + 1 < glob.length) {
			source += escapeRegex(glob[++i]);
		} else if (ch === '*') {
			if (glob[i + 1] === '*') {
				source += '.*';
				i++;
			} else {
				source += '[^/]*';
			}
		} else if (ch === '{') {
			inGroup = true;
			source += '(?:';
		} else if (ch === '}' && inGroup) {
			inGroup = false;
			source += ')';
		} else if (ch === ',' && inGroup) {
			source += '|';
		} else {
			source += escapeRegex(ch);
		}
	}
	return new RegExp(`^${source}$`);
};

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, (ch) => `\\${ch}`);

export const matchesUrl = (url: string, expected: UrlExpectation): boolean => {
	try {
		if ('regex' in expected) return new RegExp(expected.regex, expected.flags).test(url);
		return globToRegExp(expected.glob).test(url);
	} catch {
		return false;
	}
};

export const describeUrlExpectation = (expected: UrlExpectation): string =>
	'regex' in expected ? `/${expected.regex}/${expected.flags}` : expected.glob;
