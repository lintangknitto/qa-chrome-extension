// Deklarasi minimal untuk test: jsdom sudah menjadi devDependency (environment vitest), tanpa paket @types/jsdom.
declare module 'jsdom' {
	export class JSDOM {
		constructor(html?: string, options?: { runScripts?: 'dangerously' | 'outside-only'; url?: string });
		readonly window: Window & typeof globalThis;
	}
}
