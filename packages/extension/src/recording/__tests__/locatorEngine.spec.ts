// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { installLocatorEngine, rankCandidates, specToCode, type KnittoLocatorEngine } from '../locatorEngine';

let engine: KnittoLocatorEngine;

const setup = (html: string) => {
	document.body.innerHTML = html;
	delete window.__knittoLocator;
	engine = installLocatorEngine(window);
};

const best = (selector: string) => rankCandidates(engine.describeCandidates(document.querySelector(selector)!));

describe('locatorEngine', () => {
	beforeEach(() => setup(''));

	it('menghitung role implisit elemen native', () => {
		setup(`
			<input id="a" type="text"><input id="b" type="checkbox"><input id="c" type="password">
			<select id="d"></select><select id="e" multiple></select><textarea id="f"></textarea>
			<a id="g" href="#">x</a><a id="h">x</a><button id="i">x</button><h2 id="j">x</h2>`);
		const roleOf = (id: string) => engine.roleOf(document.getElementById(id)!);
		expect(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(roleOf)).toEqual([
			'textbox', 'checkbox', null, 'combobox', 'listbox', 'textbox', 'link', null, 'button', 'heading'
		]);
	});

	it('accessible name dari label for, label pembungkus, aria-label, dan konten', () => {
		setup(`
			<label for="nama">Nama Customer</label><input id="nama">
			<label>Aktif <input id="aktif" type="checkbox"></label>
			<button id="ikon" aria-label="Hapus"><svg></svg></button>
			<button id="simpan"> Simpan </button>`);
		const name = (id: string) => engine.accessibleName(document.getElementById(id)!);
		expect(name('nama')).toBe('Nama Customer');
		expect(name('aktif')).toBe('Aktif');
		expect(name('ikon')).toBe('Hapus');
		expect(name('simpan')).toBe('Simpan');
	});

	it('memprioritaskan kandidat unik: role+name exact mengalahkan text yang ganda', () => {
		setup(`<button id="s1">Simpan</button><span>Simpan</span><button>Simpan Draft</button>`);
		const ranked = best('#s1');
		expect(ranked.ambiguous).toBe(false);
		expect(ranked.uniqueLocator).toBe("getByRole('button', { name: 'Simpan', exact: true })");
	});

	it('exact: "Simpan" tidak ikut cocok dengan "Simpan Draft"', () => {
		setup(`<button>Simpan</button><button>Simpan Draft</button>`);
		expect(engine.queryAll({ kind: 'role', role: 'button', name: 'Simpan', exact: true })).toHaveLength(1);
		expect(engine.queryAll({ kind: 'role', role: 'button', name: 'Simpan' })).toHaveLength(2);
	});

	it('menandai ambiguous dan memakai nth bila tidak ada kandidat unik', () => {
		setup(`<ul><li><input type="checkbox"></li><li><input type="checkbox"></li></ul>`);
		const target = document.querySelectorAll('input')[1];
		const ranked = rankCandidates(engine.describeCandidates(target));
		expect(ranked.ambiguous).toBe(true);
		expect(ranked.uniqueLocator).toBeNull();
		expect(ranked.locators[0]).toBe("getByRole('checkbox').nth(1)");
		expect(engine.resolve(ranked.specs[0])).toBe(target);
		expect(ranked.locators.at(-1)).toBe("locator('body > ul > li:nth-of-type(2) > input')");
	});

	it('mengabaikan id dinamis di kandidat dan cssPath', () => {
		setup(`<div id="mui-12345"><input id=":r1:" name="kota"></div><div id="main"><span>a</span><span id="ok">b</span></div>`);
		expect(engine.isDynamicId('mui-12345')).toBe(true);
		expect(engine.isDynamicId(':r1:')).toBe(true);
		expect(engine.isDynamicId('main')).toBe(false);
		const ranked = best('[name="kota"]');
		expect(ranked.locators.some((l) => l.includes(':r1:') || l.includes('mui-12345'))).toBe(false);
		expect(engine.cssPath(document.querySelector('#main > span')!)).toBe('div#main > span');
		expect(engine.cssPath(document.getElementById('ok')!)).toBe('span#ok');
	});

	it('getByText mengambil elemen terdalam saja', () => {
		setup(`<div><p><span>Customer berhasil disimpan</span></p></div>`);
		const hits = engine.queryAll({ kind: 'text', value: 'Customer berhasil disimpan', exact: true });
		expect(hits).toHaveLength(1);
		expect(hits[0].tagName).toBe('SPAN');
	});

	it('getByRole mengabaikan elemen tersembunyi', () => {
		setup(`<button hidden>Kirim</button><button id="v">Kirim</button>`);
		expect(engine.queryAll({ kind: 'role', role: 'button', name: 'Kirim', exact: true })).toEqual([document.getElementById('v')]);
	});

	it('specToCode meng-escape kutip dan newline', () => {
		expect(specToCode({ kind: 'text', value: "It's\nok", exact: true })).toBe("getByText('It\\'s\\nok', { exact: true })");
		expect(specToCode({ kind: 'css', value: 'input[name="kota"]', nth: 2 })).toBe('locator(\'input[name="kota"]\').nth(2)');
	});

	it('bisa disuntikkan lewat toString (self-contained)', () => {
		setup(`<button>Masuk</button>`);
		delete window.__knittoLocator;
		// eslint-disable-next-line no-new-func
		new Function(`(${installLocatorEngine.toString()})(window);`)();
		expect((window as Window).__knittoLocator!.queryAll({ kind: 'role', role: 'button', name: 'Masuk', exact: true })).toHaveLength(1);
	});
});
