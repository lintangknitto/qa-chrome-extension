/**
 * Locator engine bersama untuk recorder (menghitung keunikan kandidat saat merekam)
 * dan Replay Engine (mencari elemen saat replay). Satu aturan pencocokan dipakai
 * keduanya, sehingga locator yang dinilai unik saat merekam juga ditemukan persis
 * saat replay. Semantik mengikuti Playwright: role implisit + accessible name,
 * `exact` = sama persis (case-sensitive), non-exact = substring case-insensitive.
 *
 * `installLocatorEngine` WAJIB self-contained (tanpa referensi ke scope luar)
 * karena disuntikkan ke halaman lewat `Function.prototype.toString()`.
 */

/** `regexFlags` terisi (boleh '') berarti `name`/`value` adalah source RegExp. */
type TextMatch = { exact?: boolean; regexFlags?: string; nth?: number };

export type LocatorSpec =
	| { kind: 'testId'; value: string; nth?: number }
	| ({ kind: 'role'; role: string; name?: string } & TextMatch)
	| ({ kind: 'label' | 'placeholder' | 'text' | 'title' | 'alt'; value: string } & TextMatch)
	| { kind: 'css'; value: string; nth?: number };

export interface LocatorCandidate {
	spec: LocatorSpec;
	/** Jumlah elemen di halaman yang cocok dengan spec (tanpa nth). */
	count: number;
	/** CSS path struktural: unik tapi mudah rusak saat layout berubah. */
	fragile?: boolean;
}

export interface KnittoLocatorEngine {
	roleOf(el: Element): string | null;
	accessibleName(el: Element): string;
	isDynamicId(id: string): boolean;
	cssPath(el: Element): string;
	queryAll(spec: LocatorSpec, root?: ParentNode): Element[];
	resolve(spec: LocatorSpec, root?: ParentNode): Element | null;
	describeCandidates(el: Element): LocatorCandidate[];
}

declare global {
	interface Window {
		__knittoLocator?: KnittoLocatorEngine;
	}
}

// Default `window`: dipanggil tanpa argumen saat disuntikkan via chrome.scripting.executeScript.
export function installLocatorEngine(win: Window = window): KnittoLocatorEngine {
	if (win.__knittoLocator) return win.__knittoLocator;
	const doc = win.document;

	const norm = (value: string | null | undefined): string => (value || '').replace(/\s+/g, ' ').trim();

	const matchText = (actual: string, expected: string, exact?: boolean, regexFlags?: string): boolean => {
		if (regexFlags !== undefined) {
			try {
				return new RegExp(expected, regexFlags).test(norm(actual));
			} catch {
				return false;
			}
		}
		const a = norm(actual);
		const e = norm(expected);
		if (!e) return false;
		return exact ? a === e : a.toLowerCase().includes(e.toLowerCase());
	};

	const NAME_FROM_CONTENT = [
		'button', 'link', 'heading', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
		'treeitem', 'cell', 'columnheader', 'rowheader', 'checkbox', 'radio', 'switch', 'tooltip', 'listitem'
	];

	const roleOf = (el: Element): string | null => {
		const explicit = norm(el.getAttribute('role')).split(' ')[0];
		if (explicit) return explicit;
		const tag = el.tagName.toLowerCase();
		const type = (el.getAttribute('type') || '').toLowerCase();
		switch (tag) {
			case 'a':
			case 'area':
				return el.hasAttribute('href') ? 'link' : null;
			case 'button':
				return 'button';
			case 'input': {
				if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
				if (type === 'checkbox') return 'checkbox';
				if (type === 'radio') return 'radio';
				if (type === 'range') return 'slider';
				if (type === 'number') return 'spinbutton';
				if (type === 'search') return 'searchbox';
				if (['', 'text', 'email', 'tel', 'url'].includes(type)) return 'textbox';
				return null;
			}
			case 'select': {
				const select = el as HTMLSelectElement;
				return select.multiple || select.size > 1 ? 'listbox' : 'combobox';
			}
			case 'textarea':
				return 'textbox';
			case 'img':
				return el.getAttribute('alt') === '' ? 'presentation' : 'img';
			case 'h1':
			case 'h2':
			case 'h3':
			case 'h4':
			case 'h5':
			case 'h6':
				return 'heading';
			case 'option':
				return 'option';
			case 'li':
				return 'listitem';
			case 'ul':
			case 'ol':
				return 'list';
			case 'nav':
				return 'navigation';
			case 'dialog':
				return 'dialog';
			case 'table':
				return 'table';
			case 'tr':
				return 'row';
			case 'td':
				return 'cell';
			case 'th':
				return 'columnheader';
			default:
				return null;
		}
	};

	const isFormControl = (el: Element): boolean =>
		['input', 'select', 'textarea', 'button', 'meter', 'output', 'progress'].includes(el.tagName.toLowerCase());

	const labelTexts = (el: Element): string[] => {
		const texts: string[] = [];
		// Label & aria-labelledby dicari di root yang sama (dokumen atau shadow root elemen).
		const scope = el.getRootNode() as Document | ShadowRoot;
		const byId = (id: string) => (typeof scope.getElementById === 'function' ? scope.getElementById(id) : doc.getElementById(id));
		const labelledBy = el.getAttribute('aria-labelledby');
		if (labelledBy) {
			texts.push(
				labelledBy
					.split(/\s+/)
					.map((id) => norm(byId(id)?.textContent))
					.filter(Boolean)
					.join(' ')
			);
		}
		const aria = el.getAttribute('aria-label');
		if (aria) texts.push(norm(aria));
		if (isFormControl(el)) {
			const labels = (el as HTMLInputElement).labels;
			if (labels && labels.length > 0) {
				for (const label of Array.from(labels)) texts.push(norm(label.textContent));
			} else {
				const id = el.getAttribute('id');
				if (id) {
					for (const label of Array.from(scope.querySelectorAll('label[for]'))) {
						if (label.getAttribute('for') === id) texts.push(norm(label.textContent));
					}
				}
				const wrapping = el.closest('label');
				if (wrapping) texts.push(norm(wrapping.textContent));
			}
		}
		return texts.filter(Boolean);
	};

	const accessibleName = (el: Element): string => {
		const fromLabels = labelTexts(el);
		if (fromLabels.length > 0) return fromLabels[0];
		const tag = el.tagName.toLowerCase();
		const type = (el.getAttribute('type') || '').toLowerCase();
		if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) {
			return norm((el as HTMLInputElement).value) || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : '');
		}
		if (tag === 'img' || (tag === 'input' && type === 'image')) {
			const alt = el.getAttribute('alt');
			if (alt) return norm(alt);
		}
		const role = roleOf(el);
		if (role && NAME_FROM_CONTENT.includes(role)) {
			const content = norm((el as HTMLElement).innerText ?? el.textContent);
			if (content) return content;
		}
		return norm(el.getAttribute('title')) || norm(el.getAttribute('placeholder'));
	};

	const isHidden = (el: Element): boolean => {
		if (el.closest('[aria-hidden="true"], [hidden]')) return true;
		try {
			const style = win.getComputedStyle(el);
			return style.display === 'none' || style.visibility === 'hidden';
		} catch {
			return false;
		}
	};

	const isDynamicId = (id: string): boolean =>
		/[:]/.test(id) ||
		/\d{4,}/.test(id) ||
		/[0-9a-f]{8,}/i.test(id) ||
		/^(mui|react-select|radix|headlessui|rc[_-]|ember|ext-gen|__|downshift|aria-)/i.test(id);

	const isStableId = (id: string | null): id is string => Boolean(id) && /^[A-Za-z][\w-]*$/.test(id as string) && !isDynamicId(id as string);

	const cssPath = (start: Element): string => {
		const path: string[] = [];
		let el: Element | null = start;
		while (el && el.nodeType === 1 && el !== doc.documentElement) {
			let selector = el.tagName.toLowerCase();
			const id = el.getAttribute('id');
			if (isStableId(id)) {
				path.unshift(`${selector}#${id}`);
				break;
			}
			let nth = 1;
			let sib = el.previousElementSibling;
			while (sib) {
				if (sib.tagName === el.tagName) nth++;
				sib = sib.previousElementSibling;
			}
			if (nth !== 1) selector += `:nth-of-type(${nth})`;
			path.unshift(selector);
			el = el.parentElement;
		}
		return path.join(' > ');
	};

	/** Root + seluruh open shadow root di dalamnya (locator Playwright menembus open shadow DOM). */
	const rootsOf = (root: ParentNode): ParentNode[] => {
		const roots: ParentNode[] = [root];
		for (let i = 0; i < roots.length; i++) {
			for (const el of Array.from(roots[i].querySelectorAll('*'))) {
				if (el.shadowRoot) roots.push(el.shadowRoot);
			}
		}
		return roots;
	};

	const deepQueryAll = (root: ParentNode, selector: string): Element[] => rootsOf(root).flatMap((r) => Array.from(r.querySelectorAll(selector)));

	const allElements = (root: ParentNode): Element[] =>
		deepQueryAll(root, '*').filter((el) => !['script', 'style', 'head', 'meta', 'link', 'title', 'noscript'].includes(el.tagName.toLowerCase()));

	const attrMatches = (root: ParentNode, attr: string, value: string, exact?: boolean, regexFlags?: string): Element[] =>
		deepQueryAll(root, `[${attr}]`).filter((el) => matchText(el.getAttribute(attr) || '', value, exact, regexFlags));

	const ownText = (el: Element): string => norm((el as HTMLElement).innerText ?? el.textContent);

	const queryAllRaw = (spec: LocatorSpec, root: ParentNode): Element[] => {
		switch (spec.kind) {
			case 'testId':
				return deepQueryAll(root, '[data-testid]').filter((el) => el.getAttribute('data-testid') === spec.value);
			case 'role':
				return allElements(root).filter(
					(el) => roleOf(el) === spec.role && !isHidden(el) && (spec.name === undefined || matchText(accessibleName(el), spec.name, spec.exact, spec.regexFlags))
				);
			case 'label':
				return allElements(root).filter((el) => labelTexts(el).some((text) => matchText(text, spec.value, spec.exact, spec.regexFlags)));
			case 'placeholder':
				return attrMatches(root, 'placeholder', spec.value, spec.exact, spec.regexFlags);
			case 'title':
				return attrMatches(root, 'title', spec.value, spec.exact, spec.regexFlags);
			case 'alt':
				return attrMatches(root, 'alt', spec.value, spec.exact, spec.regexFlags);
			case 'text': {
				const hits = allElements(root).filter((el) => matchText(ownText(el), spec.value, spec.exact, spec.regexFlags));
				// Ambil elemen terdalam saja, seperti Playwright (induk yang teksnya sama dibuang).
				return hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
			}
			case 'css':
				try {
					return deepQueryAll(root, spec.value);
				} catch {
					return [];
				}
			default:
				return [];
		}
	};

	const queryAll = (spec: LocatorSpec, root: ParentNode = doc): Element[] => {
		const all = queryAllRaw(spec, root);
		if (spec.nth === undefined) return all;
		const index = spec.nth < 0 ? all.length + spec.nth : spec.nth;
		return all[index] ? [all[index]] : [];
	};

	const resolve = (spec: LocatorSpec, root: ParentNode = doc): Element | null => queryAll(spec, root)[0] ?? null;

	const describeCandidates = (el: Element): LocatorCandidate[] => {
		const specs: LocatorSpec[] = [];
		const tag = el.tagName.toLowerCase();
		const testId = el.getAttribute('data-testid');
		if (testId) specs.push({ kind: 'testId', value: testId });

		const role = roleOf(el);
		const name = accessibleName(el);
		if (role && name && name.length <= 80) specs.push({ kind: 'role', role, name, exact: true });

		if (isFormControl(el)) {
			const label = labelTexts(el)[0];
			if (label && label.length <= 80) specs.push({ kind: 'label', value: label, exact: true });
		}
		const placeholder = norm(el.getAttribute('placeholder'));
		if (placeholder) specs.push({ kind: 'placeholder', value: placeholder, exact: true });
		const alt = norm(el.getAttribute('alt'));
		if (alt) specs.push({ kind: 'alt', value: alt, exact: true });
		const title = norm(el.getAttribute('title'));
		if (title) specs.push({ kind: 'title', value: title, exact: true });

		const text = ownText(el);
		if (!isFormControl(el) && text && text.length <= 80) specs.push({ kind: 'text', value: text, exact: true });

		const nameAttr = el.getAttribute('name');
		if (nameAttr) specs.push({ kind: 'css', value: `${tag}[name="${nameAttr.replace(/"/g, '\\"')}"]` });
		const id = el.getAttribute('id');
		if (isStableId(id)) specs.push({ kind: 'css', value: `#${id}` });
		if (role && !name) specs.push({ kind: 'role', role });
		const structuralPath = cssPath(el);
		specs.push({ kind: 'css', value: structuralPath });

		const candidates: LocatorCandidate[] = [];
		for (const spec of specs) {
			const matches = queryAllRaw(spec, doc);
			const index = matches.indexOf(el);
			// Kandidat yang tidak mengenai elemen target tidak berguna.
			if (index === -1) continue;
			const fragile = spec.kind === 'css' && spec.value === structuralPath;
			candidates.push({ spec: matches.length > 1 ? { ...spec, nth: index } : spec, count: matches.length, fragile });
		}
		return candidates;
	};

	const engine: KnittoLocatorEngine = { roleOf, accessibleName, isDynamicId, cssPath, queryAll, resolve, describeCandidates };
	win.__knittoLocator = engine;
	return engine;
}

const quote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const exactOpt = (exact?: boolean): string => (exact ? ', { exact: true }' : '');

const textArg = (value: string, regexFlags?: string): string =>
	// Source regex disimpan apa adanya dari script (sudah ter-escape), jadi ditulis ulang tanpa diubah.
	regexFlags !== undefined ? `/${value}/${regexFlags}` : quote(value);

/** Mengubah LocatorSpec menjadi ekspresi Playwright (tanpa prefix `page.`). */
export const specToCode = (spec: LocatorSpec): string => {
	let code: string;
	switch (spec.kind) {
		case 'testId':
			code = `getByTestId(${quote(spec.value)})`;
			break;
		case 'role': {
			const opts: string[] = [];
			if (spec.name !== undefined) opts.push(`name: ${textArg(spec.name, spec.regexFlags)}`);
			if (spec.name !== undefined && spec.exact && spec.regexFlags === undefined) opts.push('exact: true');
			code = `getByRole(${quote(spec.role)}${opts.length ? `, { ${opts.join(', ')} }` : ''})`;
			break;
		}
		case 'label':
			code = `getByLabel(${textArg(spec.value, spec.regexFlags)}${exactOpt(spec.exact)})`;
			break;
		case 'placeholder':
			code = `getByPlaceholder(${textArg(spec.value, spec.regexFlags)}${exactOpt(spec.exact)})`;
			break;
		case 'text':
			code = `getByText(${textArg(spec.value, spec.regexFlags)}${exactOpt(spec.exact)})`;
			break;
		case 'title':
			code = `getByTitle(${textArg(spec.value, spec.regexFlags)}${exactOpt(spec.exact)})`;
			break;
		case 'alt':
			code = `getByAltText(${textArg(spec.value, spec.regexFlags)}${exactOpt(spec.exact)})`;
			break;
		case 'css':
		default:
			code = `locator(${quote(spec.value)})`;
	}
	return spec.nth !== undefined ? `${code}.nth(${spec.nth})` : code;
};

/**
 * Mengurutkan kandidat: unik & tidak rapuh lebih dulu (prioritas asli), lalu kandidat
 * semantik dengan `.nth()`, terakhir CSS path struktural. `ambiguous` bila tidak ada
 * kandidat unik yang tidak rapuh.
 */
export const rankCandidates = (
	candidates: LocatorCandidate[]
): { locators: string[]; specs: LocatorSpec[]; uniqueLocator: string | null; ambiguous: boolean } => {
	const unique = candidates.filter((c) => c.count === 1 && !c.fragile);
	const positional = candidates.filter((c) => c.count !== 1 && !c.fragile);
	const fragile = candidates.filter((c) => c.fragile);
	const ordered = [...unique, ...positional, ...fragile];
	const locators = ordered.map((c) => specToCode(c.spec));
	return {
		locators,
		specs: ordered.map((c) => c.spec),
		uniqueLocator: unique.length > 0 ? specToCode(unique[0].spec) : null,
		ambiguous: unique.length === 0
	};
};
