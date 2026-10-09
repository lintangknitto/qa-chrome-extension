/**
 * Parser generik script Playwright → langkah replay terstruktur.
 * Menggantikan regex per-kombinasi: setiap statement `page.<locator chain>.<aksi>(args)`
 * dipecah menjadi daftar pemanggilan, argumen diurai sebagai literal JS sederhana
 * (string, number, boolean, regex, object, `process.env.X ?? 'default'`).
 */
import { specToCode, type LocatorSpec } from './locatorEngine';

export type ReplayAction =
	| 'goto'
	| 'fill'
	| 'click'
	| 'rightclick'
	| 'drag'
	| 'dblclick'
	| 'hover'
	| 'wait'
	| 'waitForUrl'
	| 'select'
	| 'check'
	| 'press'
	| 'setInputFiles';

export interface ParsedStep {
	action: ReplayAction;
	locator?: LocatorSpec;
	/** Rantai <iframe> (terluar → terdalam) dari `.contentFrame()` / `frameLocator()`. */
	frames?: LocatorSpec[];
	/** Locator tujuan untuk aksi drag (`dragTo`). */
	target?: LocatorSpec;
	targetFrames?: LocatorSpec[];
	/** Representasi teks locator (dipakai untuk overlay & parameter override). */
	selector?: string;
	value?: string;
	/** Untuk select: cocokkan opsi berdasarkan label (teks) atau value. */
	optionBy?: 'label' | 'value';
	url?: string;
	timeoutMs?: number;
	key?: string;
	description?: string;
	/** `setInputFiles`: semua path file (mis. `test-data/invoice.pdf`). */
	files?: string[];
}

type Literal =
	| string
	| number
	| boolean
	| null
	| undefined
	| { regex: string; flags: string }
	| { chain: Call[] }
	| { [key: string]: Literal }
	| Literal[];

interface Call {
	name: string;
	args: Literal[];
}

class LiteralReader {
	private pos = 0;
	constructor(private readonly src: string) {}

	private ws(): void {
		while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
	}

	private peek(): string {
		this.ws();
		return this.src[this.pos] ?? '';
	}

	atEnd(): boolean {
		return this.peek() === '';
	}

	expect(ch: string): void {
		if (this.peek() !== ch) throw new Error(`Diharapkan "${ch}" pada posisi ${this.pos}`);
		this.pos++;
	}

	tryConsume(ch: string): boolean {
		if (this.peek() === ch) {
			this.pos++;
			return true;
		}
		return false;
	}

	private string(): string {
		const quote = this.src[this.pos++];
		let out = '';
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos++];
			if (ch === quote) return out;
			if (ch === '\\') {
				const next = this.src[this.pos++];
				out += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
				continue;
			}
			if (quote === '`' && ch === '$' && this.src[this.pos] === '{') throw new Error('Template literal dinamis tidak didukung');
			out += ch;
		}
		throw new Error('String tidak ditutup');
	}

	private regex(): { regex: string; flags: string } {
		this.pos++;
		let body = '';
		let inClass = false;
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos++];
			if (ch === '\\') {
				body += ch + this.src[this.pos++];
				continue;
			}
			if (ch === '[') inClass = true;
			if (ch === ']') inClass = false;
			if (ch === '/' && !inClass) break;
			body += ch;
		}
		let flags = '';
		while (/[a-z]/i.test(this.src[this.pos] ?? '')) flags += this.src[this.pos++];
		return { regex: body, flags };
	}

	private identifier(): string {
		this.ws();
		const match = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos));
		if (!match) throw new Error(`Identifier tidak valid pada posisi ${this.pos}`);
		this.pos += match[0].length;
		return match[0];
	}

	value(): Literal {
		const ch = this.peek();
		let result: Literal;
		if (ch === "'" || ch === '"' || ch === '`') result = this.string();
		else if (ch === '/') result = this.regex();
		else if (ch === '{') result = this.object();
		else if (ch === '[') result = this.array();
		else if (/[-\d]/.test(ch)) {
			const match = /^-?\d+(\.\d+)?/.exec(this.src.slice(this.pos));
			if (!match) throw new Error('Angka tidak valid');
			this.pos += match[0].length;
			result = Number(match[0]);
		} else {
			const ident = this.identifier();
			if (ident === 'true' || ident === 'false') result = ident === 'true';
			else if (ident === 'null' || ident === 'undefined') result = null;
			else if (ident === 'process') {
				this.expect('.');
				this.identifier(); // env
				this.expect('.');
				const name = this.identifier();
				result = `\${${name}}`;
			} else if (ident === 'page') {
				// Argumen berupa locator lain, mis. dragTo(page.getByTestId('x')).
				result = { chain: this.calls() };
			} else throw new Error(`Ekspresi "${ident}" tidak didukung`);
		}
		// `a ?? b` / `a || b`: pakai nilai default (kanan) bila kiri berupa env placeholder.
		const after = this.src.slice(this.pos).trimStart();
		if (after.startsWith('??') || after.startsWith('||')) {
			this.ws();
			this.pos += 2;
			const fallback = this.value();
			return typeof result === 'string' && /^\$\{\w+\}$/.test(result) ? fallback : result;
		}
		return result;
	}

	private object(): { [key: string]: Literal } {
		this.expect('{');
		const obj: { [key: string]: Literal } = {};
		while (!this.tryConsume('}')) {
			const ch = this.peek();
			const key = ch === "'" || ch === '"' ? (this.value() as string) : this.identifier();
			this.expect(':');
			obj[key] = this.value();
			this.tryConsume(',');
		}
		return obj;
	}

	private array(): Literal[] {
		this.expect('[');
		const arr: Literal[] = [];
		while (!this.tryConsume(']')) {
			arr.push(this.value());
			this.tryConsume(',');
		}
		return arr;
	}

	/** Membaca `.name(args)` berulang setelah `page`. */
	calls(): Call[] {
		const calls: Call[] = [];
		while (this.tryConsume('.')) {
			const name = this.identifier();
			if (!this.tryConsume('(')) {
				// akses properti seperti `page.keyboard`
				calls.push({ name, args: [] });
				continue;
			}
			const args: Literal[] = [];
			while (!this.tryConsume(')')) {
				args.push(this.value());
				this.tryConsume(',');
			}
			calls.push({ name, args });
		}
		return calls;
	}
}

const asText = (value: Literal): string => {
	if (value && typeof value === 'object' && 'regex' in value) return String(value.regex);
	return value === null || value === undefined ? '' : String(value);
};

const regexFlagsOf = (value: Literal): { regexFlags?: string } =>
	value && typeof value === 'object' && 'regex' in (value as object) ? { regexFlags: String((value as { flags: string }).flags) } : {};

const textOpts = (value: Literal, options: Literal) => ({
	...regexFlagsOf(value),
	...(opts(options).exact === true ? { exact: true } : {})
});

const opts = (value: Literal): { [key: string]: Literal } =>
	value && typeof value === 'object' && !Array.isArray(value) && !('regex' in value) ? (value as { [key: string]: Literal }) : {};

const LOCATOR_FACTORIES: Record<string, (args: Literal[]) => LocatorSpec> = {
	getByTestId: (a) => ({ kind: 'testId', value: asText(a[0]) }),
	getByRole: (a) => {
		const o = opts(a[1]);
		const spec: LocatorSpec = { kind: 'role', role: asText(a[0]) };
		if (o.name !== undefined) {
			spec.name = asText(o.name);
			Object.assign(spec, textOpts(o.name, a[1]));
		}
		return spec;
	},
	getByLabel: (a) => ({ kind: 'label', value: asText(a[0]), ...textOpts(a[0], a[1]) }),
	getByPlaceholder: (a) => ({ kind: 'placeholder', value: asText(a[0]), ...textOpts(a[0], a[1]) }),
	getByText: (a) => ({ kind: 'text', value: asText(a[0]), ...textOpts(a[0], a[1]) }),
	getByTitle: (a) => ({ kind: 'title', value: asText(a[0]), ...textOpts(a[0], a[1]) }),
	getByAltText: (a) => ({ kind: 'alt', value: asText(a[0]), ...textOpts(a[0], a[1]) }),
	locator: (a) => ({ kind: 'css', value: asText(a[0]) })
};

/** Aksi legacy `page.fill(selector, value)` dan sejenisnya. */
const LEGACY_PAGE_ACTIONS = new Set(['fill', 'type', 'click', 'dblclick', 'hover', 'check', 'uncheck', 'selectOption', 'press', 'setInputFiles']);

const describe = (step: ParsedStep): string => {
	const target = step.selector ? ` ${step.selector}` : '';
	switch (step.action) {
		case 'goto':
			return `Navigasi ke ${step.url}`;
		case 'drag':
			return `Drag${target} ke ${step.target ? specToCode(step.target) : '?'}`;
		case 'fill':
			return `Mengisi${target} dengan "${step.value}"`;
		case 'select':
			return `Memilih opsi "${step.value}" pada${target}`;
		case 'check':
			return `${step.value === 'false' ? 'Hapus centang' : 'Centang'}${target}`;
		case 'press':
			return `Menekan tombol "${step.key}"${target}`;
		case 'waitForUrl':
			return `Menunggu URL ${step.url}`;
		case 'wait':
			return step.selector ? `Menunggu elemen${target} tampil` : `Menunggu jeda ${step.timeoutMs}ms`;
		default:
			return `${step.action}${target}`;
	}
};

interface ResolvedChain {
	locator?: LocatorSpec;
	frames: LocatorSpec[];
	/** Pemanggilan setelah rantai locator (aksi). */
	rest: Call[];
}

/** Mengurai rantai locator: factory getBy... dan locator(), modifier nth/first/last, serta batas frame. */
const resolveLocatorChain = (calls: Call[]): ResolvedChain => {
	let locator: LocatorSpec | undefined;
	const frames: LocatorSpec[] = [];
	for (let i = 0; i < calls.length; i++) {
		const call = calls[i];
		const factory = LOCATOR_FACTORIES[call.name];
		if (factory) {
			// Rantai locator bertingkat (mis. .locator() di dalam getByRole) disederhanakan ke yang terakhir.
			locator = factory(call.args);
		} else if (call.name === 'frameLocator') {
			frames.push({ kind: 'css', value: asText(call.args[0]) });
			locator = undefined;
		} else if (call.name === 'contentFrame' && locator) {
			frames.push(locator);
			locator = undefined;
		} else if (call.name === 'first' && locator) locator = { ...locator, nth: 0 };
		else if (call.name === 'last' && locator) locator = { ...locator, nth: -1 };
		else if (call.name === 'nth' && locator) locator = { ...locator, nth: Number(call.args[0]) || 0 };
		else if (call.name !== 'filter') return { locator, frames, rest: calls.slice(i) };
	}
	return { locator, frames, rest: [] };
};

const isChain = (value: Literal): value is { chain: Call[] } => Boolean(value && typeof value === 'object' && 'chain' in (value as object));

const buildActionStep = (name: string, args: Literal[], locator: LocatorSpec | undefined): ParsedStep | null => {
	const selector = locator ? specToCode(locator) : undefined;
	const base = { locator, selector };
	switch (name) {
		case 'fill':
		case 'type':
		case 'pressSequentially':
			return { action: 'fill', ...base, value: asText(args[0]) };
		case 'click':
			return opts(args[0]).button === 'right' ? { action: 'rightclick', ...base } : { action: 'click', ...base };
		case 'dragTo': {
			if (!isChain(args[0])) return null;
			const target = resolveLocatorChain(args[0].chain);
			return target.locator ? { action: 'drag', ...base, target: target.locator, targetFrames: target.frames } : null;
		}
		case 'dblclick':
			return { action: 'dblclick', ...base };
		case 'hover':
			return { action: 'hover', ...base };
		case 'check':
			return { action: 'check', ...base, value: 'true' };
		case 'uncheck':
			return { action: 'check', ...base, value: 'false' };
		case 'setChecked':
			return { action: 'check', ...base, value: args[0] === false ? 'false' : 'true' };
		case 'press':
			return { action: 'press', ...base, key: asText(args[0]) || 'Enter' };
		case 'selectOption': {
			const arg = Array.isArray(args[0]) ? args[0][0] : args[0];
			const o = opts(arg);
			if (o.label !== undefined) return { action: 'select', ...base, value: asText(o.label), optionBy: 'label' };
			if (o.value !== undefined) return { action: 'select', ...base, value: asText(o.value), optionBy: 'value' };
			return { action: 'select', ...base, value: asText(arg), optionBy: 'value' };
		}
		case 'setInputFiles': {
			const files = (Array.isArray(args[0]) ? args[0] : [args[0]]).map(asText).filter((name): name is string => Boolean(name));
			return { action: 'setInputFiles', ...base, value: files[0], files };
		}
		case 'waitFor':
			return { action: 'wait', ...base, timeoutMs: 1500 };
		default:
			return null;
	}
};

const parseStatement = (statement: string): ParsedStep | null => {
	const text = statement.trim().replace(/^await\s+/, '').replace(/;\s*$/, '');
	if (!text.startsWith('page.') && !text.startsWith('page\n')) return null;
	const reader = new LiteralReader(text.slice(4));
	const calls = reader.calls();
	if (calls.length === 0) return null;

	const [first, ...rest] = calls;
	switch (first.name) {
		case 'goto':
			return { action: 'goto', url: asText(first.args[0]) };
		case 'waitForURL':
			return { action: 'waitForUrl', url: asText(first.args[0]) };
		case 'waitForTimeout':
			return { action: 'wait', timeoutMs: Number(first.args[0]) || 0 };
		case 'waitForSelector':
			return { action: 'wait', locator: { kind: 'css', value: asText(first.args[0]) }, selector: asText(first.args[0]), timeoutMs: 1500 };
		case 'keyboard':
			if (rest[0]?.name === 'press') return { action: 'press', key: asText(rest[0].args[0]) || 'Enter' };
			if (rest[0]?.name === 'type' || rest[0]?.name === 'insertText') return { action: 'fill', value: asText(rest[0].args[0]) };
			return null;
		default:
			break;
	}

	if (LEGACY_PAGE_ACTIONS.has(first.name)) {
		const css = asText(first.args[0]);
		const step = buildActionStep(first.name, first.args.slice(1), { kind: 'css', value: css });
		if (step) step.selector = css;
		return step;
	}

	const chain = resolveLocatorChain(calls);
	const action = chain.rest[0];
	if (!action) return null;
	const step = buildActionStep(action.name, action.args, chain.locator);
	if (step && chain.frames.length > 0) {
		step.frames = chain.frames;
		step.selector = `${chain.frames.map((frame) => `${specToCode(frame)}.contentFrame()`).join('.')}.${step.selector ?? ''}`;
	}
	return step;
};

/** Memecah script menjadi statement (aman terhadap `;` di dalam string). */
export const splitStatements = (script: string): string[] => {
	const statements: string[] = [];
	let current = '';
	let quote: string | null = null;
	let depth = 0;
	for (let i = 0; i < script.length; i++) {
		const ch = script[i];
		const next = script[i + 1];
		if (!quote && ch === '/' && next === '/') {
			while (i < script.length && script[i] !== '\n') i++;
			continue;
		}
		if (!quote && ch === '/' && next === '*') {
			i = script.indexOf('*/', i + 2);
			if (i === -1) break;
			i++;
			continue;
		}
		current += ch;
		if (quote) {
			if (ch === '\\') {
				current += script[++i] ?? '';
			} else if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') quote = ch;
		else if (ch === '(' || ch === '{' || ch === '[') depth++;
		else if (ch === ')' || ch === '}' || ch === ']') depth = Math.max(0, depth - 1);
		else if (
			depth === 0 &&
			(ch === ';' || (ch === '\n' && /\)\s*$/.test(current) && !/^\s*\./.test(script.slice(i + 1))))
		) {
			if (current.trim()) statements.push(current.trim());
			current = '';
		}
	}
	if (current.trim()) statements.push(current.trim());
	return statements;
};

/** Mengambil isi body `test(..., async ({ page }) => { ... })` bila ada. */
const extractStatementsFromScript = (script: string): string[] =>
	splitStatements(script)
		.flatMap((stmt) => {
			const bodyStart = stmt.indexOf('=> {');
			if (/^(test|it)\s*\(/.test(stmt) && bodyStart !== -1) return splitStatements(stmt.slice(bodyStart + 4, stmt.lastIndexOf('}')));
			return [stmt];
		})
		.map((stmt) => stmt.replace(/^[;\s]+/, ''))
		.map(resolveVariables())
		.filter((stmt) => /^(await\s+)?page[.\s]/.test(stmt));

/**
 * `const tombol = page.getByRole(...)` lalu `await tombol.click()` →
 * statement diganti menjadi `page.getByRole(...).click()`.
 */
function resolveVariables(): (stmt: string) => string {
	const variables = new Map<string, string>();
	return (stmt) => {
		const assign = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(page\.[\s\S]*?);?$/.exec(stmt);
		if (assign) {
			variables.set(assign[1], assign[2]);
			return '';
		}
		const usage = /^(await\s+)?([A-Za-z_$][\w$]*)\.([\s\S]*)$/.exec(stmt);
		if (usage && variables.has(usage[2])) return `${usage[1] ?? ''}${variables.get(usage[2])}.${usage[3]}`;
		return stmt;
	};
}

export const parseScript = (script: string): ParsedStep[] => {
	const steps: ParsedStep[] = [];
	for (const statement of extractStatementsFromScript(script)) {
		let step: ParsedStep | null = null;
		try {
			step = parseStatement(statement);
		} catch {
			step = null;
		}
		if (step) steps.push({ ...step, description: describe(step) });
	}
	return steps;
};
