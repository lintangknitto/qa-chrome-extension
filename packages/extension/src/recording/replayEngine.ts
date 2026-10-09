/**
 * In-browser Replay Engine dengan dukungan Chrome Tab Groups, parameter overrides,
 * visual HUD live di halaman, element spotlighting, dan simulasi interaksi DOM nyata.
 */

import { installLocatorEngine, type LocatorSpec } from './locatorEngine';
import { parseScript, type ParsedStep } from './scriptParser';

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

async function executeUploadInTab(
	tabId: number,
	step: ReplayActionStep,
	files: UploadFilePayload[]
): Promise<{ success: boolean; error?: string }> {
	if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) return { success: true };
	try {
		const frameTarget = step.frames?.length ? await findFrameForStep(tabId, step) : null;
		if (step.frames?.length && frameTarget === null) {
			return { success: false, error: `Iframe untuk langkah "${step.selector ?? ''}" belum ditemukan.` };
		}
		const target = frameTarget !== null ? { tabId, frameIds: [frameTarget] } : { tabId };
		if (step.locator && frameTarget === null) await chrome.scripting.executeScript({ target, func: installLocatorEngine as unknown as () => void });
		const [res] = await chrome.scripting.executeScript({
			target,
			func: uploadIntoPage,
			args: [step.locator ?? null, step.selector ?? '', files]
		});
		return (res?.result as { success: boolean; error?: string }) ?? { success: false, error: 'Tidak ada hasil eksekusi upload.' };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}

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
	const probes = await chrome.scripting.executeScript({
		target: { tabId, allFrames: true },
		func: (spec: LocatorSpec) => {
			if (window === window.top) return false;
			const engine = (window as Window).__knittoLocator;
			return Boolean(engine && engine.resolve(spec));
		},
		args: [step.locator]
	});
	const hit = probes.find((probe) => probe.result === true);
	return hit ? hit.frameId : null;
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

				const element = actionType === 'press' && !selector && !spec ? (document.activeElement as HTMLElement | null) : findElement(selector);

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

						const eventInit: MouseEventInit = { bubbles: true, cancelable: true, view: window, clientX, clientY };
						clickable.dispatchEvent(new PointerEvent('pointerdown', eventInit));
						clickable.dispatchEvent(new MouseEvent('mousedown', eventInit));
						clickable.dispatchEvent(new PointerEvent('pointerup', eventInit));
						clickable.dispatchEvent(new MouseEvent('mouseup', eventInit));
						clickable.dispatchEvent(new MouseEvent('click', eventInit));
						if (typeof (clickable as any).click === 'function') {
							(clickable as any).click();
						}
						if (actionType === 'dblclick') {
							(clickable as any).click?.();
							clickable.dispatchEvent(new MouseEvent('dblclick', eventInit));
						}
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
					} else if (actionType === 'press') {
						element.focus();
						const key = keyName || 'Enter';
						const code = key === 'Enter' ? 'Enter' : key === 'Tab' ? 'Tab' : key === 'Escape' ? 'Escape' : key;
						const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0;
						const keyInit: KeyboardEventInit = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, view: window };
						element.dispatchEvent(new KeyboardEvent('keydown', keyInit));
						element.dispatchEvent(new KeyboardEvent('keypress', keyInit));
						element.dispatchEvent(new KeyboardEvent('keyup', keyInit));
						if (key === 'Enter' && (element as HTMLInputElement).form) {
							(element as HTMLInputElement).form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const stepNo = i + 1;
			const total = steps.length;

			// Tentukan nilai override jika ada
			let valueToUse = step.value;
			if (step.selector && options.parameterOverrides[step.selector] !== undefined) {
				valueToUse = options.parameterOverrides[step.selector];
			}

			const actionDesc = step.description || `${step.action.toUpperCase()} ${step.selector || step.url || ''}`;

			await updateReplayOverlay(targetTabId, {
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
					await chrome.tabs.update(targetTabId, { url: dest });
					await waitForTabLoaded(targetTabId);
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
					res = await executeUploadInTab(targetTabId, step, payloads);
					if (!res.success) await sleep(350);
				}
				if (!res.success) {
					failedStepNo = stepNo;
					throw new Error(res.error || 'Gagal memasang file upload.');
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
					const res = await executeStepInTab(targetTabId, step, valueToUse);
					if (res.success) {
						stepSuccess = true;
						break;
					}
					lastErr = res.error;
					await sleep(350);
				}

				if (!stepSuccess && lastErr) {
					await updateReplayOverlay(targetTabId, {
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
			groupId
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
			failedStep: failedStepNo ? steps[failedStepNo - 1] : undefined
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
