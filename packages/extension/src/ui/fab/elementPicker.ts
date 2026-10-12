/**
 * Mode "Pilih elemen" untuk checkpoint: elemen di bawah kursor di-highlight seperti inspector,
 * klik memilih elemen tanpa diteruskan ke halaman, Esc membatalkan.
 *
 * Listener dipasang di `window` fase capture: berjalan sebelum listener capture recorder di `document`,
 * sehingga klik/Esc saat memilih tidak ikut terekam sebagai langkah tester.
 */
import { installLocatorEngine, rankCandidates } from '../../recording/locatorEngine';

export interface PickedTarget {
	/** Kandidat locator, terbaik dulu (maksimal 10). */
	locators: string[];
	/** Teks elemen (spasi dirapikan, maksimal 200 karakter). */
	text: string;
	tagName: string;
}

export const PICKER_OVERLAY_ATTR = 'data-qa-knitto-ext';
export const PICKED_TEXT_MAX_LENGTH = 200;
const MAX_LOCATORS = 10;

/** Event yang tidak boleh sampai ke halaman/recorder selama mode pilih aktif. */
const BLOCKED_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'contextmenu', 'mouseover', 'auxclick'];

export const describePickedElement = (win: Window, element: Element): PickedTarget => {
	const engine = installLocatorEngine(win);
	let locators: string[] = [];
	try {
		locators = rankCandidates(engine.describeCandidates(element)).locators.slice(0, MAX_LOCATORS);
	} catch {
		locators = [];
	}
	const raw = (element as HTMLElement).innerText ?? element.textContent ?? '';
	return {
		locators,
		text: raw.replace(/\s+/g, ' ').trim().slice(0, PICKED_TEXT_MAX_LENGTH),
		tagName: element.tagName.toLowerCase()
	};
};

/** Elemen milik UI extension (FAB di shadow root atau elemen bertanda), naik melewati batas shadow root. */
export const isExtensionUiElement = (element: Element): boolean => {
	let node: Element | null = element;
	while (node) {
		if (node.closest('#qa-knitto-fab-host, [data-qa-knitto-ext]')) return true;
		const root = node.getRootNode() as ShadowRoot | Document;
		node = 'host' in root && root.host ? root.host : null;
	}
	return false;
};

export interface ElementPickerHandle {
	promise: Promise<PickedTarget | null>;
	cancel: () => void;
}

export const startElementPicker = (options: { win?: Window; isOwnElement?: (el: Element) => boolean } = {}): ElementPickerHandle => {
	const win = options.win ?? window;
	const isOwnElement = options.isOwnElement ?? isExtensionUiElement;
	const doc = win.document;
	const overlay = doc.createElement('div');
	overlay.setAttribute(PICKER_OVERLAY_ATTR, 'picker');
	Object.assign(overlay.style, {
		position: 'fixed',
		pointerEvents: 'none',
		zIndex: '2147483646',
		border: '2px solid #2F3574',
		background: 'rgba(47, 53, 116, 0.12)',
		borderRadius: '3px',
		display: 'none',
		transition: 'all 60ms ease-out'
	});
	const label = doc.createElement('div');
	Object.assign(label.style, {
		position: 'absolute',
		left: '0',
		top: '-22px',
		background: '#2F3574',
		color: '#fff',
		font: '11px system-ui, sans-serif',
		padding: '2px 6px',
		borderRadius: '3px',
		whiteSpace: 'nowrap'
	});
	overlay.appendChild(label);
	doc.documentElement.appendChild(overlay);
	const previousCursor = doc.documentElement.style.cursor;
	doc.documentElement.style.cursor = 'crosshair';

	// Window lain (iframe/JSDOM) punya konstruktor Element sendiri: cek nodeType, bukan instanceof.
	const isElement = (node: EventTarget | null): node is Element => Boolean(node) && (node as Node).nodeType === 1;
	const targetOf = (event: Event): Element | null => {
		const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
		const first = path.find(isElement);
		const element = first ?? (isElement(event.target) ? event.target : null);
		if (!element || element === overlay || overlay.contains(element) || isOwnElement(element)) return null;
		return element;
	};

	let resolve!: (value: PickedTarget | null) => void;
	const promise = new Promise<PickedTarget | null>((res) => (resolve = res));
	let done = false;

	const highlight = (element: Element) => {
		const rect = element.getBoundingClientRect();
		Object.assign(overlay.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
		label.textContent = element.tagName.toLowerCase();
	};

	const block = (event: Event) => {
		if (!targetOf(event)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	const onMove = (event: Event) => {
		const element = targetOf(event);
		if (element) highlight(element);
	};
	const onClick = (event: Event) => {
		const element = targetOf(event);
		// Klik di panel extension tetap berjalan normal (mis. tombol batal).
		if (!element) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		finish(describePickedElement(win, element));
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopImmediatePropagation();
		finish(null);
	};

	const finish = (value: PickedTarget | null) => {
		if (done) return;
		done = true;
		win.removeEventListener('mousemove', onMove, true);
		win.removeEventListener('click', onClick, true);
		win.removeEventListener('keydown', onKey, true);
		for (const type of BLOCKED_EVENTS) win.removeEventListener(type, block, true);
		overlay.remove();
		doc.documentElement.style.cursor = previousCursor;
		resolve(value);
	};

	win.addEventListener('mousemove', onMove, true);
	win.addEventListener('click', onClick, true);
	win.addEventListener('keydown', onKey, true);
	for (const type of BLOCKED_EVENTS) win.addEventListener(type, block, true);

	return { promise, cancel: () => finish(null) };
};
