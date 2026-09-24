export type FabUiState = 'idle' | 'recording';

export type FabView = 'root' | 'login' | 'start' | 'active' | 'result' | 'history' | 'setting' | 'projects';

export const fabViewTitles: Record<FabView, string> = {
	root: 'Knitto QA Tools',
	login: 'Login',
	start: 'Mulai Recording',
	active: 'Recording Aktif',
	result: 'Hasil Recording',
	history: 'Riwayat Session',
	setting: 'Pengaturan',
	projects: 'Manajemen Project & Test Case'
};

export interface FabState {
	recording: boolean;
	pendingEvents: number;
}

export interface FabSettings {
	enabled: boolean;
	/** Sisi tampil sidebar: kanan (default) atau kiri. */
	side: 'left' | 'right';
	/** Lebar dinamis sidebar (dalam pixel). */
	width?: number;
}

export const FAB_SETTINGS_DEFAULTS: FabSettings = { enabled: true, side: 'right' };

/**
 * URL halaman tempat content script tidak boleh inject (chrome://, extension
 * pages, PDF viewer, dsb.). Manifest sudah membatasi ke http/https, tapi guard
 * ganda lebih murah daripada crash CSP.
 */
export const isRestrictedFabUrl = (url: string): boolean => {
	const protocol = (() => {
		try {
			return new URL(url).protocol;
		} catch {
			return url.split(':')[0] ?? '';
		}
	})();
	return (
		/^(chrome|chrome-extension|about|edge|brave|view-source|devtools|file):/.test(protocol) ||
		url.toLowerCase().endsWith('.pdf')
	);
};

export interface FabRootMenu {
	id: 'recorder' | 'setting';
	label: string;
}

/** Root menu sidebar Knitto QA Tools: dua kategori besar. */
export const fabRootMenu: FabRootMenu[] = [
	{ id: 'recorder', label: 'Recorder' },
	{ id: 'setting', label: 'Setting' }
];

export const parseFabSettings = (raw: unknown): FabSettings => {
	if (!raw || typeof raw !== 'object') {
		return FAB_SETTINGS_DEFAULTS;
	}
	const record = raw as Record<string, unknown>;
	const res: FabSettings = {
		enabled: typeof record.enabled === 'boolean' ? record.enabled : FAB_SETTINGS_DEFAULTS.enabled,
		// 'position' adalah key lama (pre-refine); tetap dipahami untuk kompatibilitas.
		side:
			record.side === 'left' || record.position === 'left'
				? 'left'
				: FAB_SETTINGS_DEFAULTS.side
	};
	if (typeof record.width === 'number' && record.width >= 360 && record.width <= 1400) {
		res.width = record.width;
	}
	return res;
};