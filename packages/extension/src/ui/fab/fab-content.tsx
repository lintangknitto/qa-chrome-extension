import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FabApp } from './fab';
import { loadFabSettings } from './fab-settings';
import { isRestrictedFabUrl } from './fab-state';
import { FAB_CSS } from './fab-styles';

/**
 * Entry content script untuk floating button QA Knitto. UI React dirender di
 * dalam Shadow DOM (isolasi style dua arah), CSS dimuat via constructed
 * stylesheet, dan re-inject otomatis bila halaman SPA menghapus elemennya.
 */

export const FAB_HOST_ID = 'qa-knitto-fab-host';

interface ActiveFabMount {
	host: HTMLElement;
	root: Root;
	observer: MutationObserver;
}

let activeMount: ActiveFabMount | null = null;
let reInjectTimer = 0;

const isExtensionValid = (): boolean => {
	try {
		return typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string' && chrome.runtime.id.length > 0;
	} catch {
		return false;
	}
};

const scheduleReInject = (): void => {
	if (typeof chrome !== 'undefined' && !isExtensionValid()) return;
	window.clearTimeout(reInjectTimer);
	reInjectTimer = window.setTimeout(() => void mountFab(), 400);
};

const applyFabStyles = (shadow: ShadowRoot): void => {
	// Constructed stylesheet di-adopt ke shadow root: style halaman tidak
	// menembus, style kita tidak bocor ke halaman.
	const sheet = new CSSStyleSheet();
	sheet.replaceSync(FAB_CSS);
	shadow.adoptedStyleSheets = [sheet];
};

const watchHostRemoval = (host: HTMLElement): MutationObserver => {
	const observer = new MutationObserver(() => {
		const stillAttached = host.isConnected && !!host.shadowRoot;
		if (!stillAttached) scheduleReInject();
	});
	observer.observe(document.body, { childList: true, subtree: true });
	return observer;
};

export const mountFab = async (): Promise<void> => {
	try {
		if (isRestrictedFabUrl(window.location.href)) return;
		if (typeof chrome !== 'undefined' && !isExtensionValid()) return;

		if (activeMount) {
			// Host masih terpasang → biarkan; host hilang (SPA) → bersihkan dulu.
			if (document.getElementById(FAB_HOST_ID)) return;
			unmountFab();
		}

		const settings = await loadFabSettings();

	const host = document.createElement('div');
	host.id = FAB_HOST_ID;

	const shadow = host.attachShadow({ mode: 'open' });
	const container = document.createElement('div');
	shadow.appendChild(container);
	host.setAttribute('style', 'all:initial;');
	document.body.appendChild(host);

	applyFabStyles(shadow);

	const root = createRoot(container);
	root.render(<FabApp settings={settings} />);

	activeMount = { host, root, observer: watchHostRemoval(host) };
	} catch (err) {
		console.warn('mountFab failed:', err);
	}
};

export const unmountFab = (): void => {
	if (!activeMount) return;
	activeMount.observer.disconnect();
	activeMount.root.unmount();
	activeMount.host.remove();
	activeMount = null;
};

// Tangani unhandled rejection saat extension context di-invalidasi ketika ekstensi di-reload.
// event.preventDefault() mencegah Chrome mencatatnya sebagai uncaught error / stack trace di chrome://extensions.
if (typeof window !== 'undefined') {
	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		const message = typeof reason === 'string' ? reason : (reason?.message as string | undefined);
		if (typeof message === 'string' && message.includes('Extension context invalidated')) {
			event.preventDefault();
			unmountFab();
		}
	});

	window.addEventListener('error', (event) => {
		const message = typeof event.message === 'string' ? event.message : (event.error?.message as string | undefined);
		if (typeof message === 'string' && message.includes('Extension context invalidated')) {
			event.preventDefault();
			unmountFab();
		}
	});
}

window.addEventListener('pagehide', unmountFab);

void mountFab();