/**
 * In-browser Replay Engine dengan dukungan Chrome Tab Groups, parameter overrides,
 * visual HUD live di halaman, element spotlighting, dan simulasi interaksi DOM nyata.
 */

import { installLocatorEngine, type LocatorSpec } from './locatorEngine';
import { parseScript, type ParsedStep } from './scriptParser';
import { describeUrlExpectation, matchesUrl, type UrlExpectation } from './urlMatcher';

export type ReplayActionStep = ParsedStep;

export interface ReplayOptions {
	sessionId: number;
	testCaseNo: string;
	targetUrl?: string;
	script?: string;
	steps?: ReplayActionStep[];
	parameterOverrides: Record<string, string>; // selector -> new value
	mode: 'tabGroup' | 'activeTab';
	speedMode?: 'normal' | 'fast' | 'slow';
	stepDelayMs?: number;
	apiBaseUrl?: string;
	storageState?: any;
	onTabReady?: (tabId: number) => Promise<void> | void;
	/** File test data sesi (`GET /sessions/:id/test-data-files`) untuk langkah `setInputFiles`. */
	testDataFiles?: ReplayTestDataFile[];
	/** Diinjeksi test; default `fetch` dari service worker (host permission `<all_urls>`). */
	fetchTestDataFile?: (url: string) => Promise<Blob>;
}

export interface ReplayTestDataFile {
	file_name: string;
	content_type?: string | null;
	download_url: string;
}

interface UploadFilePayload {
	name: string;
	type: string;
	data: string;
}

const baseName = (path: string): string => path.split(/[\\/]/).pop() || path;

/** Nama file yang diharapkan langkah upload (basename dari path di script). */
export const stepFileNames = (step: ReplayActionStep): string[] =>
	(step.files?.length ? step.files : step.value ? [step.value] : []).map(baseName).filter(Boolean);

/** Cocokkan langkah upload dengan file test data tersimpan berdasarkan nama file. */
export const matchTestDataFiles = (
	step: ReplayActionStep,
	files: ReplayTestDataFile[] = []
): { matched: ReplayTestDataFile[]; missing: string[] } => {
	const byName = new Map(files.map((file) => [file.file_name, file]));
	const matched: ReplayTestDataFile[] = [];
	const missing: string[] = [];
	for (const name of stepFileNames(step)) {
		const file = byName.get(name);
		if (file) matched.push(file);
		else missing.push(name);
	}
	return { matched, missing };
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return btoa(binary);
};

const defaultFetchTestDataFile = async (url: string): Promise<Blob> => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Gagal mengambil file test data (HTTP ${response.status}).`);
	return response.blob();
};

export const loadUploadPayloads = async (
	files: ReplayTestDataFile[],
	fetchFile: (url: string) => Promise<Blob> = defaultFetchTestDataFile
): Promise<UploadFilePayload[]> =>
	Promise.all(
		files.map(async (file) => {
			const blob = await fetchFile(file.download_url);
			return { name: file.file_name, type: file.content_type || blob.type || 'application/octet-stream', data: await blobToBase64(blob) };
		})
	);

/**
 * Dijalankan di halaman (chrome.scripting, harus self-contained): cari `<input type=file>`, pasang file lewat
 * DataTransfer, lalu picu `input` + `change` seperti pilihan manual.
 */
export function uploadIntoPage(
	spec: LocatorSpec | null,
	selector: string,
	payloads: Array<{ name: string; type: string; data: string }>
): { success: boolean; error?: string } {
	let element: Element | null = null;
	const engine = (window as Window).__knittoLocator;
	if (spec && engine) element = engine.resolve(spec) as Element | null;
	if (!element && selector) {
		try {
			element = document.querySelector(selector);
		} catch {
			element = null;
		}
	}
	if (!(element instanceof HTMLInputElement) || element.type !== 'file')
		return { success: false, error: `Input file "${selector}" tidak ditemukan.` };
	const transfer = new DataTransfer();
	for (const file of payloads) {
		const binary = atob(file.data);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		transfer.items.add(new File([bytes], file.name, { type: file.type }));
	}
	element.files = transfer.files;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	element.dispatchEvent(new Event('change', { bubbles: true }));
	return { success: true };
}

type StepOutcome = { success: boolean; error?: string };

/**
 * Jalankan fungsi self-contained di frame milik langkah (frame utama, atau iframe yang memuat locator-nya)
 * setelah locator engine terpasang.
 */
async function executeInStepFrame<Args extends unknown[]>(
	tabId: number,
	step: ReplayActionStep,
	func: (...args: Args) => StepOutcome,
	args: Args
): Promise<StepOutcome> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return { success: true };
	try {
		const frameTarget = step.frames?.length ? await findFrameForStep(tabId, step) : null;
		if (step.frames?.length && frameTarget === null) {
			return { success: false, error: `Iframe untuk langkah "${step.selector ?? ''}" belum ditemukan.` };
		}
		const target = frameTarget !== null ? { tabId, frameIds: [frameTarget] } : { tabId };
		if (step.locator && frameTarget === null) await chrome.scripting.executeScript({ target, func: installLocatorEngine as unknown as () => void });
		const [res] = await chrome.scripting.executeScript({ target, func, args } as unknown as chrome.scripting.ScriptInjection<Args, StepOutcome>);
		return (res?.result as StepOutcome | undefined) ?? { success: false, error: 'Tidak ada hasil eksekusi langkah.' };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}

const executeUploadInTab = (tabId: number, step: ReplayActionStep, files: UploadFilePayload[]): Promise<StepOutcome> =>
	executeInStepFrame(tabId, step, uploadIntoPage, [step.locator ?? null, step.selector ?? '', files]);

/**
 * Dijalankan di halaman (harus self-contained): `scrollBy` menggeser window sebesar delta,
 * `scrollTo` menggeser elemen (container atau `html` dokumen iframe) ke posisi.
 */
export function scrollInPage(mode: 'scrollBy' | 'scrollTo', spec: LocatorSpec | null, selector: string, x: number, y: number): { success: boolean; error?: string } {
	if (mode === 'scrollBy') {
		window.scrollBy(x, y);
		return { success: true };
	}
	const engine = (window as Window).__knittoLocator;
	let element: Element | null = spec && engine ? engine.resolve(spec) : null;
	if (!element && selector) {
		try {
			element = document.querySelector(selector);
		} catch {
			element = null;
		}
	}
	if (!element) return { success: false, error: `Elemen scroll "${selector}" tidak ditemukan di halaman.` };
	element.scrollTo(x, y);
	return { success: true };
}

/**
 * Dijalankan di halaman (harus self-contained): tekan tombol/kombinasi format Playwright (`Control+Shift+Enter`)
 * pada elemen locator, atau elemen fokus bila tanpa locator. Event sintetis tidak menjalankan aksi bawaan
 * browser, jadi tombol scroll (PageDown/panah/Home/End/Space di luar field teks) digeser manual dan Enter
 * di dalam form memicu submit.
 */
export function pressKeyInPage(spec: LocatorSpec | null, selector: string, combo: string): { success: boolean; error?: string } {
	let element: HTMLElement | null = null;
	if (spec) {
		const engine = (window as Window).__knittoLocator;
		element = engine ? (engine.resolve(spec) as HTMLElement | null) : null;
		if (!element) return { success: false, error: `Elemen "${selector}" tidak ditemukan di halaman.` };
	} else if (selector) {
		try {
			element = document.querySelector(selector) as HTMLElement | null;
		} catch {
			element = null;
		}
		if (!element) return { success: false, error: `Elemen "${selector}" tidak ditemukan di halaman.` };
	}
	const target = element ?? (document.activeElement as HTMLElement | null) ?? document.body;
	if (element) element.focus();

	// "Control++" → tombol "+"; selain itu bagian terakhir adalah tombol.
	const parts = combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), '+'] : combo.split('+');
	const rawKey = parts.pop() || 'Enter';
	const mods = new Set(parts);
	const key = rawKey === 'Space' ? ' ' : rawKey;
	const KEY_CODES: Record<string, number> = { Enter: 13, Tab: 9, Escape: 27, ' ': 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Backspace: 8, Delete: 46 };
	const keyCode = KEY_CODES[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
	const code = key === ' ' ? 'Space' : key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : key.length === 1 && /\d/.test(key) ? `Digit${key}` : key;
	const init: KeyboardEventInit = {
		key,
		code,
		keyCode,
		which: keyCode,
		bubbles: true,
		cancelable: true,
		composed: true,
		ctrlKey: mods.has('Control') || (mods.has('ControlOrMeta') && !/Mac/i.test(navigator.platform)),
		metaKey: mods.has('Meta') || (mods.has('ControlOrMeta') && /Mac/i.test(navigator.platform)),
		altKey: mods.has('Alt'),
		shiftKey: mods.has('Shift')
	};
	const notPrevented = target.dispatchEvent(new KeyboardEvent('keydown', init));
	if (key.length === 1 && !init.ctrlKey && !init.metaKey) target.dispatchEvent(new KeyboardEvent('keypress', init));
	target.dispatchEvent(new KeyboardEvent('keyup', init));
	if (!notPrevented || mods.size > 0) return { success: true };

	const tag = target.tagName;
	const editable = tag === 'TEXTAREA' || (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes((target as HTMLInputElement).type)) || target.isContentEditable;
	if (key === 'Enter' && tag === 'INPUT' && (target as HTMLInputElement).form) {
		const form = (target as HTMLInputElement).form!;
		if (typeof form.requestSubmit === 'function') form.requestSubmit();
		else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		return { success: true };
	}
	if (editable) return { success: true };
	// Aksi bawaan tombol scroll: geser container scrollable terdekat, atau window.
	let scroller: Element | null = target;
	while (scroller && scroller !== document.body && scroller !== document.documentElement) {
		const style = getComputedStyle(scroller);
		if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight) break;
		scroller = scroller.parentElement;
	}
	const useWindow = !scroller || scroller === document.body || scroller === document.documentElement;
	const page = Math.round((useWindow ? window.innerHeight : (scroller as Element).clientHeight) * 0.875);
	const deltas: Record<string, [number, number]> = { ArrowDown: [0, 40], ArrowUp: [0, -40], ArrowRight: [40, 0], ArrowLeft: [-40, 0], PageDown: [0, page], ' ': [0, page], PageUp: [0, -page] };
	const scrollBy = (x: number, y: number) => (useWindow ? window.scrollBy(x, y) : (scroller as Element).scrollBy(x, y));
	const scrollTo = (y: number) => (useWindow ? window.scrollTo(window.scrollX, y) : (scroller as Element).scrollTo((scroller as Element).scrollLeft, y));
	if (deltas[key]) scrollBy(deltas[key][0], deltas[key][1]);
	else if (key === 'Home') scrollTo(0);
	else if (key === 'End') scrollTo(useWindow ? document.documentElement.scrollHeight : (scroller as Element).scrollHeight);
	return { success: true };
}

const executePressInTab = (tabId: number, step: ReplayActionStep): Promise<StepOutcome> =>
	executeInStepFrame(tabId, step, pressKeyInPage, [step.locator ?? null, step.selector ?? '', step.key || 'Enter']);

/**
 * Dijalankan di halaman (harus self-contained): assertion elemen seperti Playwright —
 * `toBeVisible` (ada & terlihat), `toContainText` (teks mengandung, spasi dirapikan), `toHaveText` (sama persis).
 */
export function assertInPage(
	spec: LocatorSpec | null,
	selector: string,
	assertion: string,
	expected: string
): { success: boolean; error?: string } {
	const engine = (window as Window).__knittoLocator;
	const element = spec && engine ? (engine.resolve(spec) as HTMLElement | null) : null;
	if (!element) return { success: false, error: `Assertion gagal: elemen ${selector} tidak ditemukan.` };
	const style = window.getComputedStyle(element);
	const visible = element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
	if (assertion === 'toBeVisible') return visible ? { success: true } : { success: false, error: `Assertion gagal: elemen ${selector} tidak terlihat.` };
	const norm = (text: string) => text.replace(/\s+/g, ' ').trim();
	const actual = norm(element.innerText ?? element.textContent ?? '');
	const wanted = norm(expected);
	const ok = assertion === 'toHaveText' ? actual === wanted : actual.includes(wanted);
	return ok
		? { success: true }
		: { success: false, error: `Assertion gagal: ${selector} diharapkan ${assertion === 'toHaveText' ? 'berteks' : 'berisi teks'} "${wanted}", teks aktual "${actual.slice(0, 200)}".` };
}

/** Batas tunggu assertion (sama dengan default `expect` Playwright). */
export const ASSERTION_TIMEOUT_MS = 5_000;

export interface PointClickResult {
	success: boolean;
	error?: string;
	/** Viewport saat replay berbeda dari rekaman: koordinat diskalakan proporsional. */
	scaled?: { from: string; to: string };
}

/**
 * Dijalankan di halaman (harus self-contained): klik koordinat viewport untuk langkah tanpa locator.
 * Bila ukuran viewport berbeda dari saat rekam, koordinat diskalakan proporsional.
 */
export function clickAtPoint(
	kind: 'click' | 'dblclick' | 'rightclick',
	x: number,
	y: number,
	recorded: { w: number; h: number } | null
): PointClickResult {
	const width = window.innerWidth;
	const height = window.innerHeight;
	const differs = Boolean(recorded && recorded.w > 0 && recorded.h > 0 && (recorded.w !== width || recorded.h !== height));
	const px = differs && recorded ? Math.round((x * width) / recorded.w) : x;
	const py = differs && recorded ? Math.round((y * height) / recorded.h) : y;
	const target = document.elementFromPoint(px, py);
	if (!target) return { success: false, error: `Tidak ada elemen di koordinat (${px}, ${py}).` };
	const button = kind === 'rightclick' ? 2 : 0;
	const init: MouseEventInit = { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, button, buttons: button === 2 ? 2 : 1 };
	const press = (detail: number) => {
		target.dispatchEvent(new PointerEvent('pointerdown', { ...init, detail }));
		target.dispatchEvent(new MouseEvent('mousedown', { ...init, detail }));
		target.dispatchEvent(new PointerEvent('pointerup', { ...init, detail }));
		target.dispatchEvent(new MouseEvent('mouseup', { ...init, detail }));
		if (kind === 'rightclick') target.dispatchEvent(new MouseEvent('contextmenu', init));
		else target.dispatchEvent(new MouseEvent('click', { ...init, detail }));
	};
	press(1);
	if (kind === 'dblclick') {
		press(2);
		target.dispatchEvent(new MouseEvent('dblclick', { ...init, detail: 2 }));
	}
	return differs && recorded
		? { success: true, scaled: { from: `${recorded.w}x${recorded.h}`, to: `${width}x${height}` } }
		: { success: true };
}

declare global {
	interface Window {
		__knittoReplayClick?: (target: Element, kind: string, clientX: number, clientY: number) => void;
	}
}

/**
 * Dijalankan di halaman (harus self-contained): memasang `window.__knittoReplayClick` untuk langkah click/dblclick.
 * Urutan pointerdown → mousedown → pointerup → mouseup → click. Event `click` sintetis sudah menjalankan
 * activation behavior (navigasi <a>, submit form, toggle checkbox, forward <label>), jadi TIDAK ada `.click()`
 * tambahan — itu yang dulu membuat handler aplikasi terpanggil dua kali. dblclick = 2× click + 1× dblclick.
 */
export function installReplayClick(): void {
	(window as Window).__knittoReplayClick = (target: Element, kind: string, clientX: number, clientY: number) => {
		const base: MouseEventInit = { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0 };
		const press = (detail: number) => {
			target.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1, detail }));
			target.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, detail }));
			target.dispatchEvent(new PointerEvent('pointerup', { ...base, detail }));
			target.dispatchEvent(new MouseEvent('mouseup', { ...base, detail }));
			target.dispatchEvent(new MouseEvent('click', { ...base, detail }));
		};
		press(1);
		if (kind === 'dblclick') {
			press(2);
			target.dispatchEvent(new MouseEvent('dblclick', { ...base, detail: 2 }));
		}
	};
}

const executeClickAtInTab = async (tabId: number, step: ReplayActionStep): Promise<PointClickResult> => {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return { success: true };
	const kind = step.action === 'dblclickAt' ? 'dblclick' : step.button === 'right' ? 'rightclick' : 'click';
	try {
		const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: clickAtPoint, args: [kind, step.x ?? 0, step.y ?? 0, step.viewport ?? null] });
		return (res?.result as PointClickResult | undefined) ?? { success: false, error: 'Tidak ada hasil eksekusi klik koordinat.' };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
};

const executeScrollInTab =(tabId: number, step: ReplayActionStep): Promise<StepOutcome> =>
	executeInStepFrame(tabId, step, scrollInPage, [
		step.action === 'scrollBy' ? 'scrollBy' : 'scrollTo',
		step.locator ?? null,
		step.selector ?? '',
		step.x ?? 0,
		step.y ?? 0
	]);

export interface ReplayResult {
	success: boolean;
	totalSteps: number;
	executedSteps: number;
	error?: string;
	tabId?: number;
	groupId?: number;
	/** Nomor langkah (1-based) yang gagal, bila replay gagal pada suatu langkah. */
	failedStepNo?: number;
	failedStep?: ReplayActionStep;
	/** Peringatan non-fatal (mis. klik koordinat diskalakan karena viewport berbeda). */
	warnings?: string[];
}

/**
 * Mengurai script Playwright menjadi sekuens langkah replay terstruktur
 * (locator + aksi) memakai parser generik di `scriptParser.ts`.
 */
export function parseScriptToReplaySteps(script: string, fallbackUrl?: string): ReplayActionStep[] {
	const steps = script ? parseScript(script) : [];
	if (steps.length === 0 && fallbackUrl) {
		return [{ action: 'goto', url: fallbackUrl, description: `Navigasi ke ${fallbackUrl}` }];
	}
	return steps;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const URL_WAIT_TIMEOUT_MS = 10_000;

const historyStepInTab = async (tabId: number, direction: 'back' | 'forward'): Promise<void> => {
	if (!chrome.scripting?.executeScript) return;
	await chrome.scripting.executeScript({
		target: { tabId },
		func: (dir: 'back' | 'forward') => (dir === 'back' ? history.back() : history.forward()),
		args: [direction]
	});
};
export const POPUP_WAIT_TIMEOUT_MS = 5_000;

/**
 * Tunggu tab baru yang dibuka dari `openerTabId` (popup/target=_blank). Listener dipasang sebelum aksi
 * pemicu dijalankan agar tab yang muncul cepat tidak terlewat.
 */
export const waitForPopupTab = (openerTabId: number, timeoutMs: number): { promise: Promise<number | null> } => {
	if (typeof chrome === 'undefined' || !chrome.tabs?.onCreated) return { promise: Promise.resolve(null) };
	const promise = new Promise<number | null>((resolve) => {
		const listener = (tab: chrome.tabs.Tab) => {
			if (tab.openerTabId !== openerTabId || typeof tab.id !== 'number') return;
			chrome.tabs.onCreated.removeListener(listener);
			clearTimeout(timer);
			resolve(tab.id);
		};
		const timer = setTimeout(() => {
			chrome.tabs.onCreated.removeListener(listener);
			resolve(null);
		}, timeoutMs);
		chrome.tabs.onCreated.addListener(listener);
	});
	return { promise };
};

const addTabToGroup = async (tabId: number, groupId: number | undefined): Promise<void> => {
	if (groupId === undefined || typeof chrome === 'undefined' || !chrome.tabs?.group) return;
	try {
		await chrome.tabs.group({ tabIds: [tabId], groupId });
	} catch {
		// Tab di jendela lain tidak bisa digabung ke group.
	}
};

/** `context.newPage()`: tab kosong baru di jendela & group replay. */
const openReplayTab = async (rootTabId: number, groupId: number | undefined): Promise<number | null> => {
	if (typeof chrome === 'undefined' || !chrome.tabs?.create) return null;
	try {
		const root = chrome.tabs.get ? await chrome.tabs.get(rootTabId).catch(() => undefined) : undefined;
		const tab = await chrome.tabs.create({ url: 'about:blank', active: true, ...(root?.windowId !== undefined ? { windowId: root.windowId } : {}) });
		if (typeof tab.id !== 'number') return null;
		await addTabToGroup(tab.id, groupId);
		return tab.id;
	} catch {
		return null;
	}
};

const urlExpectationOf = (step: ReplayActionStep): UrlExpectation =>
	step.urlRegex ? { regex: step.urlRegex.regex, flags: step.urlRegex.flags } : { glob: step.url ?? '' };

const currentTabUrl = async (tabId: number): Promise<string> => {
	if (typeof chrome === 'undefined' || !chrome.tabs?.get) return '';
	try {
		const tab = await chrome.tabs.get(tabId);
		return tab?.url || tab?.pendingUrl || '';
	} catch {
		return '';
	}
};

/** Tunggu URL tab cocok dengan glob/RegExp. Mengembalikan URL yang cocok, atau null bila waktu habis. */
export const waitForTabUrl = async (tabId: number, expected: UrlExpectation, timeoutMs: number, pollMs = 250): Promise<string | null> => {
	if (typeof chrome === 'undefined' || !chrome.tabs?.get) return '';
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const url = await currentTabUrl(tabId);
		if (url && matchesUrl(url, expected)) return url;
		if (Date.now() >= deadline) return null;
		await sleep(pollMs);
	}
};

const waitForTabLoaded = (tabId: number, timeoutMs = 15000): Promise<void> =>
	new Promise((resolve) => {
		if (typeof chrome === 'undefined' || !chrome.tabs?.onUpdated) {
			resolve();
			return;
		}

		let timer: ReturnType<typeof setTimeout>;

		const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
			if (id === tabId && info.status === 'complete') {
				chrome.tabs.onUpdated.removeListener(listener);
				clearTimeout(timer);
				resolve();
			}
		};

		chrome.tabs.onUpdated.addListener(listener);
		timer = setTimeout(() => {
			try {
				chrome.tabs.onUpdated.removeListener(listener);
			} catch {
				// Ignore
			}
			resolve();
		}, timeoutMs);
	});

/**
 * Pulihkan Cookie & LocalStorage pada tab replay agar autentikasi sesi langsung aktif.
 */
async function restoreStorageState(tabId: number, storageState?: any): Promise<void> {
	if (!storageState || typeof chrome === 'undefined') return;

	// 1. Pulihkan Cookies
	if (Array.isArray(storageState.cookies) && chrome.cookies?.set) {
		for (const cookie of storageState.cookies) {
			try {
				const cookieUrl = `http${cookie.secure ? 's' : ''}://${(cookie.domain || '').replace(/^\./, '')}${cookie.path || '/'}`;
				await chrome.cookies.set({
					url: cookieUrl,
					name: cookie.name,
					value: cookie.value,
					domain: cookie.domain,
					path: cookie.path,
					secure: cookie.secure,
					httpOnly: cookie.httpOnly,
					sameSite: cookie.sameSite as any,
					expirationDate: cookie.expires && cookie.expires > 0 ? cookie.expires : undefined
				}).catch(() => {});
			} catch {
				// Abaikan kegagalan cookie individual
			}
		}
	}

	// 2. Pulihkan LocalStorage
	if (Array.isArray(storageState.origins) && chrome.scripting?.executeScript) {
		for (const originEntry of storageState.origins) {
			if (Array.isArray(originEntry.localStorage) && originEntry.localStorage.length > 0) {
				try {
					await chrome.scripting.executeScript({
						target: { tabId },
						func: (items: Array<{ name: string; value: string }>) => {
							for (const item of items) {
								try {
									localStorage.setItem(item.name, item.value);
								} catch {
									// Ignore
								}
							}
						},
						args: [originEntry.localStorage]
					}).catch(() => {});
				} catch {
					// Ignore
				}
			}
		}
	}
}

/**
 * Suntikkan overlay HUD dan spotlight visual interaksi ke dalam halaman tab yang sedang di-replay.
 */
export interface ReplayHudOptions {
	stepNo: number;
	totalSteps: number;
	title: string;
	actionDesc: string;
	targetSelector?: string;
	actionType?: string;
	isFinished?: boolean;
	isError?: boolean;
	errorMessage?: string;
	/** Replay baru dimulai: buang HUD & timer dari replay sebelumnya. */
	reset?: boolean;
}

export const REPLAY_HUD_ERROR_HIDE_MS = 10_000;
export const REPLAY_HUD_FINISHED_HIDE_MS = 4_000;

/**
 * HUD replay di halaman target (chrome.scripting, harus self-contained). Bisa ditutup lewat tombol ✕,
 * hilang sendiri setelah selesai (4 dtk) atau error (10 dtk), dan direset saat replay baru dimulai.
 */
export function renderReplayHud(opts: ReplayHudOptions, hideMs: { error: number; finished: number }): void {
	const HUD_ID = 'knitto-replay-hud';
	const w = window as Window & { __knittoReplayHudTimer?: ReturnType<typeof setTimeout> };
	const removeHud = () => {
		if (w.__knittoReplayHudTimer) clearTimeout(w.__knittoReplayHudTimer);
		w.__knittoReplayHudTimer = undefined;
		document.getElementById(HUD_ID)?.remove();
		document.querySelectorAll('.knitto-spotlight-box').forEach((el) => el.remove());
	};
	if (opts.reset) removeHud();
	if (w.__knittoReplayHudTimer) {
		clearTimeout(w.__knittoReplayHudTimer);
		w.__knittoReplayHudTimer = undefined;
	}

	let hud = document.getElementById(HUD_ID);
	if (!hud) {
		hud = document.createElement('div');
		hud.id = HUD_ID;
		Object.assign(hud.style, {
			position: 'fixed',
			top: '16px',
			right: '16px',
			zIndex: '2147483647',
			maxWidth: '360px',
			width: 'calc(100vw - 32px)',
			background: '#0f172a',
			color: '#ffffff',
			borderRadius: '12px',
			padding: '12px 16px',
			boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
			fontFamily: 'system-ui, -apple-system, sans-serif',
			fontSize: '12px',
			lineHeight: '1.4',
			transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
			// HUD tidak menghalangi klik ke halaman, kecuali tombol tutup.
			pointerEvents: 'none'
		});
		document.body.appendChild(hud);
	}

	const progressPercent = Math.min(100, Math.round((opts.stepNo / Math.max(1, opts.totalSteps)) * 100));
	let statusBg = '#2F3574';
	let statusIcon = '▶️';
	let statusText = `Langkah ${opts.stepNo} dari ${opts.totalSteps}`;
	if (opts.isFinished) {
		statusBg = '#16a34a';
		statusIcon = '✅';
		statusText = 'Replay Selesai Sukses';
	} else if (opts.isError) {
		statusBg = '#dc2626';
		statusIcon = '❌';
		statusText = 'Replay Terhenti (Gagal)';
	}

	hud.replaceChildren();
	const header = document.createElement('div');
	header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;';
	const titleBox = document.createElement('div');
	titleBox.style.cssText = 'display:flex; align-items:center; gap:6px;';
	titleBox.innerHTML = `<span style="font-size:14px;">${statusIcon}</span><strong style="font-size:13px; color:#f8fafc; letter-spacing:0.3px;">Knitto QA Re-run Live</strong>`;
	const right = document.createElement('div');
	right.style.cssText = 'display:flex; align-items:center; gap:6px;';
	const badge = document.createElement('span');
	badge.style.cssText = `background:${statusBg}; color:#ffffff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;`;
	badge.textContent = statusText;
	const close = document.createElement('button');
	close.type = 'button';
	close.setAttribute('aria-label', 'Tutup');
	close.textContent = '✕';
	close.style.cssText = 'pointer-events:auto; cursor:pointer; background:transparent; border:0; color:#cbd5e1; font-size:14px; line-height:1; padding:2px 4px;';
	close.addEventListener('click', removeHud);
	right.append(badge, close);
	header.append(titleBox, right);

	const message = document.createElement('div');
	message.style.cssText = 'font-size:12px; font-weight:500; color:#e2e8f0; margin-bottom:8px; word-break:break-word;';
	message.textContent = opts.isError ? opts.errorMessage || 'Terjadi kesalahan' : opts.actionDesc;

	const track = document.createElement('div');
	track.style.cssText = 'width:100%; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; overflow:hidden;';
	const bar = document.createElement('div');
	bar.style.cssText = `width:${progressPercent}%; height:100%; background:${opts.isError ? '#ef4444' : opts.isFinished ? '#22c55e' : '#38bdf8'}; transition:width 0.3s ease;`;
	track.append(bar);
	hud.append(header, message, track);

	if (opts.isFinished || opts.isError) {
		w.__knittoReplayHudTimer = setTimeout(removeHud, opts.isError ? hideMs.error : hideMs.finished);
	}
}

async function updateReplayOverlay(tabId: number, options: ReplayHudOptions): Promise<void> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return;
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			func: renderReplayHud,
			args: [options, { error: REPLAY_HUD_ERROR_HIDE_MS, finished: REPLAY_HUD_FINISHED_HIDE_MS }]
		});
	} catch {
		// Scripting may fail on restricted pages
	}
}

/**
 * Langkah di dalam iframe: pasang locator engine di semua frame, lalu cari frame (bukan frame utama)
 * yang memuat elemen target. Bekerja untuk iframe same-origin maupun cross-origin.
 */
async function findFrameForStep(tabId: number, step: ReplayActionStep): Promise<number | null> {
	if (!step.locator) return null;
	await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: installLocatorEngine as unknown as () => void });
	const ownerSpec = step.frames?.[step.frames.length - 1] ?? null;
	const probes = await chrome.scripting.executeScript({
		target: { tabId, allFrames: true },
		// 2 = elemen ada dan <iframe> pemilik cocok dengan frame terdalam (same-origin), 1 = elemen ada, 0 = tidak.
		func: (spec: LocatorSpec, owner: LocatorSpec | null) => {
			if (window === window.top) return 0;
			const engine = (window as Window).__knittoLocator;
			if (!engine || !engine.resolve(spec)) return 0;
			try {
				const parentEngine = (window.parent as Window).__knittoLocator;
				if (owner && parentEngine && window.frameElement && parentEngine.resolve(owner) === window.frameElement) return 2;
			} catch {
				// Parent cross-origin: pemilik tidak bisa diperiksa.
			}
			return 1;
		},
		args: [step.locator, ownerSpec]
	});
	const best = probes.reduce<{ frameId: number; score: number } | null>((acc, probe) => {
		const score = Number(probe.result) || 0;
		return score > 0 && (!acc || score > acc.score) ? { frameId: probe.frameId, score } : acc;
	}, null);
	return best ? best.frameId : null;
}

/**
 * Eksekusi satu langkah interaksi langsung di dalam DOM browser dengan React Synthetic Events & spotlight visual.
 */
async function executeStepInTab(
	tabId: number,
	step: ReplayActionStep,
	valueToUse: string | undefined
): Promise<{ success: boolean; error?: string }> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
		return { success: true };
	}

	try {
		const frameTarget = step.frames?.length ? await findFrameForStep(tabId, step) : null;
		if (step.frames?.length && frameTarget === null) {
			return { success: false, error: `Iframe untuk langkah "${step.selector ?? ''}" belum ditemukan.` };
		}
		const target = frameTarget !== null ? { tabId, frameIds: [frameTarget] } : { tabId };
		if (step.action === 'click' || step.action === 'dblclick') {
			await chrome.scripting.executeScript({ target, func: installReplayClick });
		}
		if (step.locator && frameTarget === null) {
			// Locator engine yang sama dengan recorder → elemen yang dinilai unik saat rekam ditemukan persis.
			await chrome.scripting.executeScript({ target, func: installLocatorEngine as unknown as () => void });
		}
		const [res] = await chrome.scripting.executeScript({
			target,
			func: (
				actionType: string,
				selector: string,
				val: string,
				keyName: string,
				spec: LocatorSpec | null,
				optionBy: string,
				targetSpec: LocatorSpec | null
			) => {
				const findElement = (sel: string): HTMLElement | null => {
					if (spec) {
						const engine = (window as Window).__knittoLocator;
						const found = engine ? (engine.resolve(spec) as HTMLElement | null) : null;
						// Selector CSS legacy (mis. teks bebas dari script lama) tetap boleh jatuh ke pencarian longgar.
						if (found || spec.kind !== 'css') return found;
					}
					if (!sel) return null;

					// 1. Format role: "role:button:Kirim" atau "role:button" atau "role:listitem"
					if (sel.startsWith('role:')) {
						const parts = sel.split(':');
						const roleName = parts[1] || '';
						const targetName = (parts[2] || '').toLowerCase();

						const roleElements = Array.from(document.querySelectorAll(`[role="${roleName}"], ${roleName === 'button' ? 'button, input[type="button"], input[type="submit"]' : roleName === 'link' ? 'a' : roleName === 'listitem' ? 'li, [role="listitem"]' : roleName === 'textbox' ? 'input, textarea' : '*'}`));

						for (const el of roleElements) {
							if (!targetName) return el as HTMLElement;
							const text = (el.textContent || '').trim().toLowerCase();
							const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
							const inpVal = ((el as HTMLInputElement).value || '').trim().toLowerCase();
							const matches = targetName.includes('|')
								? targetName.split('|').some((p) => text.includes(p) || aria.includes(p) || inpVal.includes(p))
								: (text.includes(targetName) || aria.includes(targetName) || inpVal.includes(targetName));
							if (matches) return el as HTMLElement;
						}
						if (!targetName && roleElements.length > 0) return roleElements[0] as HTMLElement;
					}

					// 2. Format placeholder: "placeholder:Ketik pesan"
					if (sel.startsWith('placeholder:')) {
						const phVal = sel.replace(/^placeholder:/, '').toLowerCase();
						const inputs = Array.from(document.querySelectorAll('input, textarea'));
						for (const inp of inputs) {
							const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
							const matches = phVal.includes('|')
								? phVal.split('|').some((p) => ph.includes(p))
								: ph.includes(phVal);
							if (matches) return inp as HTMLElement;
						}
					}

					// 3. Format label: "label:Nama"
					if (sel.startsWith('label:')) {
						const lblVal = sel.replace(/^label:/, '').toLowerCase();
						const labels = Array.from(document.querySelectorAll('label'));
						for (const lbl of labels) {
							if ((lbl.textContent || '').toLowerCase().includes(lblVal)) {
								const htmlFor = lbl.getAttribute('for');
								if (htmlFor) {
									const linked = document.getElementById(htmlFor);
									if (linked) return linked as HTMLElement;
								}
								const childInput = lbl.querySelector('input, select, textarea');
								if (childInput) return childInput as HTMLElement;
							}
						}
					}

					// 4. Format text=...
					if (sel.startsWith('text=')) {
						const targetText = sel.replace(/^text=/, '').trim().toLowerCase();
						const elements = Array.from(document.querySelectorAll('button, a, span, label, div, p, [role="button"], [role="tab"], [role="menuitem"], input[type="submit"], input[type="button"]'));
						for (const el of elements) {
							const t = (el.textContent || '').trim().toLowerCase();
							const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
							const matches = targetText.includes('|')
								? targetText.split('|').some((p) => t.includes(p) || aria.includes(p))
								: (t === targetText || t.includes(targetText) || aria.includes(targetText));
							if (matches) return el as HTMLElement;
						}
					}

					// 5. Coba querySelector exact (CSS path / data-testid / id / class)
					try {
						const direct = document.querySelector(sel) as HTMLElement | null;
						if (direct) return direct;
					} catch {
						// Ignore
					}

					// 6. Coba cari by placeholder, name, id, data-testid, aria-label
					try {
						const byAttr = document.querySelector(
							`[name="${sel}"], [id="${sel}"], [placeholder="${sel}"], [data-testid="${sel}"], [data-test-id="${sel}"], [data-cy="${sel}"], [aria-label="${sel}"]`
						) as HTMLElement | null;
						if (byAttr) return byAttr;
					} catch {
						// Ignore
					}

					// 7. Cari input lewat teks label terkait
					const labels = Array.from(document.querySelectorAll('label'));
					for (const lbl of labels) {
						if ((lbl.textContent || '').toLowerCase().includes(sel.toLowerCase())) {
							const htmlFor = lbl.getAttribute('for');
							if (htmlFor) {
								const linked = document.getElementById(htmlFor);
								if (linked) return linked as HTMLElement;
							}
							const childInput = lbl.querySelector('input, select, textarea');
							if (childInput) return childInput as HTMLElement;
						}
					}

					// 8. Text partial matching pada elemen yang dapat diklik
					const clickables = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], [role="tab"], [role="menuitem"], li'));
					for (const btn of clickables) {
						const text = (btn.textContent || '').toLowerCase();
						const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
						if (text.includes(sel.toLowerCase()) || aria.includes(sel.toLowerCase())) {
							return btn as HTMLElement;
						}
					}

					// 9. Inputs by placeholder partial match
					const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
					for (const inp of inputs) {
						const ph = inp.getAttribute('placeholder') || '';
						const aria = inp.getAttribute('aria-label') || '';
						const nm = inp.getAttribute('name') || '';
						if (
							(ph && ph.toLowerCase().includes(sel.toLowerCase())) ||
							(aria && aria.toLowerCase().includes(sel.toLowerCase())) ||
							(nm && nm.toLowerCase().includes(sel.toLowerCase()))
						) {
							return inp as HTMLElement;
						}
					}

					// 10. Fallback: jika selector mengarah ke path/svg di dalam button/form, cari button terdekat
					if (sel.includes('button') || sel.includes('svg') || sel.includes('path') || sel.includes('section')) {
						const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
						if (buttons.length > 0) {
							const sendBtn = buttons.find((b) => {
								const t = (b.textContent || '').toLowerCase();
								const a = (b.getAttribute('aria-label') || '').toLowerCase();
								const tit = (b.getAttribute('title') || '').toLowerCase();
								return t.includes('kirim') || t.includes('send') || a.includes('kirim') || a.includes('send') || tit.includes('kirim') || tit.includes('send') || Boolean(b.querySelector('svg'));
							});
							if (sendBtn) return sendBtn as HTMLElement;
						}
					}

					return null;
				};

				const element = findElement(selector);

				const centerOf = (el: Element) => {
					const rect = el.getBoundingClientRect();
					return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
				};

				if (!element && actionType !== 'wait') {
					return { success: false, error: `Elemen "${selector}" tidak ditemukan di halaman.` };
				}

				if (element) {
					// Spotlight efek pada elemen yang sedang dieksekusi
					element.scrollIntoView({ behavior: 'smooth', block: 'center' });

					// Buat glowing border sementara
					const prevOutline = element.style.outline;
					const prevBoxShadow = element.style.boxShadow;
					element.style.outline = '3px solid #2F3574';
					element.style.boxShadow = '0 0 16px rgba(47, 53, 116, 0.5)';
					setTimeout(() => {
						try {
							element.style.outline = prevOutline;
							element.style.boxShadow = prevBoxShadow;
						} catch {
							// Ignore
						}
					}, 1200);

					if (actionType === 'fill') {
						element.focus();
						const inputEl = element as HTMLInputElement | HTMLTextAreaElement;
						const prototype = Object.getPrototypeOf(inputEl);
						const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
							|| Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
							|| Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

						if (valueSetter && ('value' in inputEl)) {
							valueSetter.call(inputEl, val);
						} else if ('value' in inputEl) {
							inputEl.value = val;
						} else {
							element.textContent = val;
						}

						element.dispatchEvent(new Event('focus', { bubbles: true }));
						element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
						element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						element.dispatchEvent(new Event('blur', { bubbles: true }));
					} else if (actionType === 'rightclick') {
						const init: MouseEventInit = { bubbles: true, cancelable: true, view: window, button: 2, buttons: 2, ...centerOf(element) };
						element.dispatchEvent(new PointerEvent('pointerdown', init));
						element.dispatchEvent(new MouseEvent('mousedown', init));
						element.dispatchEvent(new PointerEvent('pointerup', init));
						element.dispatchEvent(new MouseEvent('mouseup', init));
						element.dispatchEvent(new MouseEvent('contextmenu', init));
					} else if (actionType === 'drag') {
						const engine = (window as Window).__knittoLocator;
						const dropTarget = targetSpec && engine ? (engine.resolve(targetSpec) as HTMLElement | null) : null;
						if (!dropTarget) return { success: false, error: 'Target drag tidak ditemukan di halaman.' };
						const from = centerOf(element);
						const to = centerOf(dropTarget);
						// Library berbasis pointer (dnd-kit, sortable) …
						element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, ...from }));
						element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, ...from }));
						for (const ratio of [0.25, 0.5, 0.75, 1]) {
							const point = { clientX: from.clientX + (to.clientX - from.clientX) * ratio, clientY: from.clientY + (to.clientY - from.clientY) * ratio };
							document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, buttons: 1, ...point }));
							document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 1, ...point }));
						}
						dropTarget.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, ...to }));
						dropTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, ...to }));
						// … dan HTML5 drag & drop.
						const dataTransfer = typeof DataTransfer === 'function' ? new DataTransfer() : undefined;
						const dragInit = (point: { clientX: number; clientY: number }): DragEventInit => ({ bubbles: true, cancelable: true, dataTransfer, ...point });
						element.dispatchEvent(new DragEvent('dragstart', dragInit(from)));
						dropTarget.dispatchEvent(new DragEvent('dragenter', dragInit(to)));
						dropTarget.dispatchEvent(new DragEvent('dragover', dragInit(to)));
						dropTarget.dispatchEvent(new DragEvent('drop', dragInit(to)));
						element.dispatchEvent(new DragEvent('dragend', dragInit(to)));
					} else if (actionType === 'hover') {
						const rect = element.getBoundingClientRect();
						const hoverInit: MouseEventInit = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
						element.dispatchEvent(new PointerEvent('pointerover', hoverInit));
						element.dispatchEvent(new MouseEvent('mouseover', hoverInit));
						element.dispatchEvent(new PointerEvent('pointerenter', { ...hoverInit, bubbles: false }));
						element.dispatchEvent(new MouseEvent('mouseenter', { ...hoverInit, bubbles: false }));
						element.dispatchEvent(new MouseEvent('mousemove', hoverInit));
					} else if (actionType === 'click' || actionType === 'dblclick') {
						const clickable = element.closest('button, a, [role="button"], input[type="submit"], input[type="button"], li') || element;
						(clickable as HTMLElement).focus();
						const rect = (clickable as HTMLElement).getBoundingClientRect();
						const clientX = rect.left + rect.width / 2;
						const clientY = rect.top + rect.height / 2;

						const replayClick = (window as Window).__knittoReplayClick;
						if (!replayClick) return { success: false, error: 'Helper klik replay belum terpasang di halaman.' };
						replayClick(clickable, actionType, clientX, clientY);
					} else if (actionType === 'select') {
						element.focus();
						const selectEl = element as HTMLSelectElement;
						if (selectEl.tagName.toLowerCase() === 'select') {
							const byLabel = optionBy === 'label'
								? Array.from(selectEl.options).find((opt) => (opt.text || '').replace(/\s+/g, ' ').trim() === val)
								: undefined;
							selectEl.value = byLabel ? byLabel.value : val;
							selectEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						}
					} else if (actionType === 'check') {
						const checkEl = element as HTMLInputElement;
						if (checkEl.type === 'checkbox' || checkEl.type === 'radio') {
							checkEl.checked = val === 'true';
							checkEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
						}
					}
				}

				return { success: true };
			},
			args: [step.action, step.selector || '', valueToUse ?? '', step.key || 'Enter', step.locator ?? null, step.optionBy ?? 'value', step.target ?? null]
		});

		return res?.result ?? { success: true };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}

/**
 * Menjalankan seluruh sekuens langkah replay dalam browser secara nyata & tampak pada tab.
 */
export async function executeReplay(options: ReplayOptions): Promise<ReplayResult> {
	const steps = options.steps && options.steps.length > 0
		? options.steps
		: parseScriptToReplaySteps(options.script || '', options.targetUrl);

	if (steps.length === 0) {
		return {
			success: false,
			totalSteps: 0,
			executedSteps: 0,
			error: 'Tidak ada langkah untuk dijalankan.'
		};
	}

	let targetTabId: number | undefined;
	let groupId: number | undefined;
	let executed = 0;
	let failedStepNo: number | undefined;
	const warnings: string[] = [];

	try {
		const initialUrl = steps.find((s) => s.action === 'goto')?.url || options.targetUrl || 'about:blank';

		if (options.mode === 'tabGroup' && typeof chrome !== 'undefined' && chrome.tabs?.create) {
			// Buat tab baru dan aktifkan (active: true) agar tester dapat melihat eksekusinya secara langsung
			const newTab = await chrome.tabs.create({ url: initialUrl, active: true });
			targetTabId = newTab.id;

			if (targetTabId && chrome.tabs.group) {
				try {
					groupId = await chrome.tabs.group({ tabIds: [targetTabId] });
					if (groupId && chrome.tabGroups?.update) {
						await chrome.tabGroups.update(groupId, {
							title: `Knitto Replay - ${options.testCaseNo}`,
							color: 'blue'
						});
					}
				} catch {
					// Tab grouping might fail if tabs are across windows
				}
			}
		} else if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
			const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
			targetTabId = active?.id;
		}

		if (!targetTabId) {
			return {
				success: false,
				totalSteps: steps.length,
				executedSteps: 0,
				error: 'Tab target tidak ditemukan.'
			};
		}

		// Pastikan tab aktif dan window terfokus ke depan
		try {
			if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
				await chrome.tabs.update(targetTabId, { active: true });
			}
			if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
				const currentWin = await chrome.windows.getCurrent();
				if (currentWin.id) {
					await chrome.windows.update(currentWin.id, { focused: true });
				}
			}
		} catch {
			// Ignore
		}

		// Pulihkan status login / storageState jika ada
		if (options.storageState && targetTabId) {
			await restoreStorageState(targetTabId, options.storageState);
		}

		await waitForTabLoaded(targetTabId);

		if (options.onTabReady && targetTabId) {
			try {
				await options.onTabReady(targetTabId);
			} catch {
				// Abaikan jika video capture gagal dimulai
			}
		}

		const pacingDelay = options.stepDelayMs ?? (options.speedMode === 'fast' ? 300 : options.speedMode === 'slow' ? 1500 : 800);
		// Variabel page script (`page`, `page2`, …) → tab replay.
		const pageTabs = new Map<string, number>([['page', targetTabId]]);
		const rootTabId = targetTabId;

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const stepNo = i + 1;
			const total = steps.length;
			const pageVar = step.page ?? 'page';

			if (step.action === 'newPage') {
				const created = await openReplayTab(rootTabId, groupId);
				if (created === null) {
					failedStepNo = stepNo;
					throw new Error(`Gagal membuka tab baru untuk ${pageVar}.`);
				}
				pageTabs.set(pageVar, created);
				executed++;
				continue;
			}
			const stepTabId = pageTabs.get(pageVar);
			if (stepTabId === undefined) {
				failedStepNo = stepNo;
				throw new Error(`Tab untuk ${pageVar} belum dibuka sebelum langkah ${stepNo}.`);
			}
			if (step.action === 'bringToFront') {
				if (typeof chrome !== 'undefined' && chrome.tabs?.update) await chrome.tabs.update(stepTabId, { active: true });
				await sleep(Math.min(pacingDelay, 300));
				executed++;
				continue;
			}
			// Langkah pembuka popup: mulai mendengarkan tab baru sebelum aksi dijalankan.
			const popup = step.opensPage ? waitForPopupTab(stepTabId, POPUP_WAIT_TIMEOUT_MS) : null;

			// Tentukan nilai override jika ada
			let valueToUse = step.value;
			if (step.selector && options.parameterOverrides[step.selector] !== undefined) {
				valueToUse = options.parameterOverrides[step.selector];
			}

			const actionDesc = step.description || `${step.action.toUpperCase()} ${step.selector || step.url || ''}`;

			await updateReplayOverlay(stepTabId, {
				stepNo,
				totalSteps: total,
				title: options.testCaseNo,
				actionDesc,
				targetSelector: step.selector,
				actionType: step.action,
				reset: i === 0
			});

			if (step.action === 'goto') {
				const dest = step.url || initialUrl;
				if (typeof chrome !== 'undefined' && chrome.tabs?.update) {
					await chrome.tabs.update(stepTabId, { url: dest });
					await waitForTabLoaded(stepTabId);
					await sleep(Math.max(600, pacingDelay));
				}
			} else if (step.action === 'setInputFiles') {
				const { matched, missing } = matchTestDataFiles(step, options.testDataFiles);
				if (missing.length > 0) {
					failedStepNo = stepNo;
					throw new Error(`File test data untuk langkah upload tidak tersedia: ${missing.join(', ')}. Pilih file pengganti di modal Re-run.`);
				}
				const payloads = await loadUploadPayloads(matched, options.fetchTestDataFile);
				let res: { success: boolean; error?: string } = { success: false };
				for (let attempt = 0; attempt < 8 && !res.success; attempt++) {
					res = await executeUploadInTab(stepTabId, step, payloads);
					if (!res.success) await sleep(350);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					throw new Error(res.error || 'Gagal memasang file upload.');
				}
				await sleep(pacingDelay);
			} else if (step.action === 'reload' || step.action === 'goBack' || step.action === 'goForward') {
				if (typeof chrome !== 'undefined' && chrome.tabs) {
					if (step.action === 'reload') await chrome.tabs.reload(stepTabId);
					// history.back/forward di halaman: chrome.tabs.goBack melewati entri pushState tanpa aktivasi pengguna
					// (intervensi riwayat Chrome), sedangkan replay SPA membuat entri lewat event sintetis.
					else await historyStepInTab(stepTabId, step.action === 'goBack' ? 'back' : 'forward');
					// Back/forward SPA tidak memuat ulang dokumen: jangan tunggu "complete" terlalu lama.
					await waitForTabLoaded(stepTabId, step.action === 'reload' ? 15000 : 5000);
				}
				await sleep(Math.max(600, pacingDelay));
			} else if (step.action === 'waitForUrl') {
				const expected = urlExpectationOf(step);
				const url = await waitForTabUrl(stepTabId, expected, URL_WAIT_TIMEOUT_MS);
				if (url === null) {
					failedStepNo = stepNo;
					const current = await currentTabUrl(stepTabId);
					throw new Error(`URL tidak sesuai setelah ${URL_WAIT_TIMEOUT_MS / 1000} detik. Diharapkan ${describeUrlExpectation(expected)}, URL sekarang ${current || '(tidak diketahui)'}.`);
				}
				await sleep(pacingDelay);
			} else if (step.action === 'expect') {
				// Assertion gagal menggagalkan run (laporan replay_failure memicu investigasi).
				let res: StepOutcome = { success: false };
				if (step.assertion === 'toHaveURL') {
					const expected = urlExpectationOf(step);
					const url = await waitForTabUrl(stepTabId, expected, ASSERTION_TIMEOUT_MS);
					if (url !== null) res = { success: true };
					else res = { success: false, error: `Assertion gagal: URL diharapkan cocok ${describeUrlExpectation(expected)}, URL aktual ${(await currentTabUrl(stepTabId)) || '(tidak diketahui)'}.` };
				} else {
					const deadline = Date.now() + ASSERTION_TIMEOUT_MS;
					do {
						res = await executeInStepFrame(stepTabId, step, assertInPage, [step.locator ?? null, step.selector ?? '', step.assertion ?? 'toBeVisible', step.value ?? '']);
						if (!res.success) await sleep(250);
					} while (!res.success && Date.now() < deadline);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					await updateReplayOverlay(stepTabId, { stepNo, totalSteps: total, title: options.testCaseNo, actionDesc, isError: true, errorMessage: res.error });
					throw new Error(res.error || 'Assertion gagal.');
				}
				await sleep(Math.min(pacingDelay, 300));
			} else if (step.action === 'press') {
				let res: StepOutcome = { success: false };
				for (let attempt = 0; attempt < 8 && !res.success; attempt++) {
					res = await executePressInTab(stepTabId, step);
					if (!res.success) await sleep(350);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					throw new Error(res.error || `Gagal menekan tombol ${step.key ?? ''}.`);
				}
				await sleep(pacingDelay);
			} else if (step.action === 'clickAt' || step.action === 'dblclickAt') {
				let res: PointClickResult = { success: false };
				for (let attempt = 0; attempt < 8 && !res.success; attempt++) {
					res = await executeClickAtInTab(stepTabId, step);
					if (!res.success) await sleep(350);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					throw new Error(res.error || 'Gagal klik koordinat.');
				}
				if (res.scaled) {
					const warning = `Langkah ${stepNo}: viewport berbeda (rekam ${res.scaled.from}, replay ${res.scaled.to}); koordinat klik diskalakan, hasil bisa meleset.`;
					warnings.push(warning);
					await updateReplayOverlay(stepTabId, { stepNo, totalSteps: total, title: options.testCaseNo, actionDesc: `⚠ ${warning}` });
				}
				await sleep(pacingDelay);
			} else if (step.action === 'scrollBy' || step.action === 'scrollTo') {
				let res: StepOutcome = { success: false };
				for (let attempt = 0; attempt < 8 && !res.success; attempt++) {
					res = await executeScrollInTab(stepTabId, step);
					if (!res.success) await sleep(350);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					throw new Error(res.error || 'Gagal menjalankan scroll.');
				}
				await sleep(pacingDelay);
			} else if (step.action === 'wait') {
				const duration = Math.min(step.timeoutMs || 1000, 5000);
				await sleep(duration);
			} else {
				// Coba eksekusi aksi (fill, click, select, check, press) dengan retry singkat jika elemen belum render
				let stepSuccess = false;
				let lastErr: string | undefined;

				for (let attempt = 0; attempt < 8; attempt++) {
					const res = await executeStepInTab(stepTabId, step, valueToUse);
					if (res.success) {
						stepSuccess = true;
						break;
					}
					lastErr = res.error;
					await sleep(350);
				}

				if (!stepSuccess && lastErr) {
					await updateReplayOverlay(stepTabId, {
						stepNo,
						totalSteps: total,
						title: options.testCaseNo,
						actionDesc: `Gagal pada langkah ${stepNo}: ${actionDesc}`,
						isError: true,
						errorMessage: lastErr
					});
					failedStepNo = stepNo;
					throw new Error(lastErr);
				}

				await sleep(pacingDelay);
			}

			if (popup && step.opensPage) {
				const popupTabId = await popup.promise;
				if (popupTabId === null) {
					failedStepNo = stepNo;
					throw new Error(`Tab popup (${step.opensPage}) tidak terbuka dalam ${POPUP_WAIT_TIMEOUT_MS / 1000} detik setelah langkah ${stepNo}.`);
				}
				pageTabs.set(step.opensPage, popupTabId);
				await addTabToGroup(popupTabId, groupId);
				await waitForTabLoaded(popupTabId, 10000);
			}

			executed++;
		}

		await updateReplayOverlay(targetTabId, {
			stepNo: steps.length,
			totalSteps: steps.length,
			title: options.testCaseNo,
			actionDesc: `Semua ${executed} langkah replay berhasil dijalankan.`,
			isFinished: true
		});

		return {
			success: true,
			totalSteps: steps.length,
			executedSteps: executed,
			tabId: targetTabId,
			groupId,
			...(warnings.length > 0 ? { warnings } : {})
		};
	} catch (err) {
		const message = (err as Error).message || 'Terjadi kesalahan saat replay';
		if (targetTabId) {
			await updateReplayOverlay(targetTabId, {
				stepNo: 0,
				totalSteps: steps.length,
				title: options.testCaseNo,
				actionDesc: `Replay Gagal`,
				isError: true,
				errorMessage: message
			});
		}
		return {
			success: false,
			totalSteps: steps.length,
			executedSteps: executed,
			error: message,
			tabId: targetTabId,
			groupId,
			failedStepNo,
			failedStep: failedStepNo ? steps[failedStepNo - 1] : undefined,
			...(warnings.length > 0 ? { warnings } : {})
		};
	}
}

export interface ReplayFailureReport {
	step_no: number;
	error: string;
	step_description?: string;
	selector?: string;
	total_steps: number;
}

/** Payload laporan replay gagal untuk API (null bila replay sukses / gagal sebelum ada langkah). */
export function buildReplayFailureReport(result: ReplayResult): ReplayFailureReport | null {
	if (result.success || !result.failedStepNo) return null;
	return {
		step_no: result.failedStepNo,
		error: (result.error || 'Replay gagal').slice(0, 2000),
		step_description: result.failedStep?.description?.slice(0, 500),
		selector: result.failedStep?.selector?.slice(0, 500),
		total_steps: result.totalSteps
	};
}
