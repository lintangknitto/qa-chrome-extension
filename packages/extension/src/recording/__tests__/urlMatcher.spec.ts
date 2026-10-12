import { describe, expect, it } from 'vitest';
import { globToRegExp, matchesUrl } from '../urlMatcher';

describe('urlMatcher', () => {
	it('glob pola codegen: ** host, * satu segmen, ?** query', () => {
		expect(matchesUrl('https://chat.knitto.org/chat/99881', { glob: '**/chat/*' })).toBe(true);
		expect(matchesUrl('https://chat.knitto.org/chat/99881/info', { glob: '**/chat/*' })).toBe(false);
		expect(matchesUrl('https://chat.knitto.org/chat/1?token=a/b', { glob: '**/chat/*?**' })).toBe(true);
		expect(matchesUrl('https://app.test/', { glob: '**/' })).toBe(true);
	});

	it('string tanpa wildcard dicocokkan persis; escape \\* literal; {a,b} alternatif', () => {
		expect(matchesUrl('https://a.test/x', { glob: 'https://a.test/x' })).toBe(true);
		expect(matchesUrl('https://a.test/x?y=1', { glob: 'https://a.test/x' })).toBe(false);
		expect(globToRegExp('**/a\\*b').test('https://a.test/a*b')).toBe(true);
		expect(matchesUrl('https://a.test/home', { glob: '**/{home,dashboard}' })).toBe(true);
	});

	it('RegExp dari codegen toHaveURL', () => {
		const regex = { regex: '^[a-z][\\w+.-]*:\\/\\/[^/]+\\/chat\\/[^/]+(?:[?#].*)?$', flags: '' };
		expect(matchesUrl('https://chat.test/chat/12?x=1', regex)).toBe(true);
		expect(matchesUrl('https://chat.test/inbox', regex)).toBe(false);
	});
});
