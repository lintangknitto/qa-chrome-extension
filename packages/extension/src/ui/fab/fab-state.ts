export type FabUiState = 'idle' | 'recording';

export type FabIntent = 'start' | 'checkpoint' | 'end' | 'generate' | 'panel' | 'setting';

export interface FabState {
	recording: boolean;
	pendingEvents: number;
}

export interface FabSettings {
	enabled: boolean;
	/** Sisi tampil sidebar: kanan (default) atau kiri. */
	side: 'left' | 'right';
}

export const FAB_SETTINGS_DEFAULTS: FabSettings = { enabled: true, side: 'right' };

export interface FabMenuItem {
	id: FabIntent;
	label: string;
}

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

/**
 * Menu FAB adaptif terhadap state recording. "Generate Hasil" selalu tersedia
 * pada state idle → membuka panel ke riwayat session (bukan eksekusi langsung).
 */
export const fabMenuForState = (state: FabUiState): FabMenuItem[] =>
	state === 'recording'
		? [
				{ id: 'checkpoint', label: 'Tambah Checkpoint' },
				{ id: 'end', label: 'End Recording' },
				{ id: 'panel', label: 'Buka Panel' }
			]
		: [
				{ id: 'start', label: 'Mulai Recording' },
				{ id: 'generate', label: 'Generate Hasil' },
				{ id: 'panel', label: 'Buka Panel' }
			];

export interface FabRootMenu {
	id: 'recorder' | 'setting';
	label: string;
}

/** Root menu sidebar Knitto QA Extension: dua kategori besar. */
export const fabRootMenu: FabRootMenu[] = [
	{ id: 'recorder', label: 'Recorder' },
	{ id: 'setting', label: 'Setting' }
];

export const parseFabSettings = (raw: unknown): FabSettings => {
	const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		enabled: typeof record.enabled === 'boolean' ? record.enabled : FAB_SETTINGS_DEFAULTS.enabled,
		// 'position' adalah key lama (pre-refine); tetap dipahami untuk kompatibilitas.
		side:
			record.side === 'left' || record.position === 'left'
				? 'left'
				: FAB_SETTINGS_DEFAULTS.side
	};
};