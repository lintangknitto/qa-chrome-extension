/**
 * Logika murni video multi-tab di offscreen: frame screencast terakhir di-cache per tab,
 * hanya tab aktif yang digambar, dan label tab aktif ditempel di pojok canvas.
 */

/** Judul tab, atau host bila judul kosong. */
export const tabLabel = (title: string | undefined | null, url: string | undefined | null): string => {
	const trimmed = (title ?? '').trim();
	if (trimmed) return trimmed;
	try {
		return url ? new URL(url).host : '';
	} catch {
		return '';
	}
};

export class FrameCompositor {
	private readonly _frames = new Map<number, string>();
	private _activeTabId: number | null = null;
	private _label = '';

	get activeTabId(): number | null {
		return this._activeTabId;
	}

	get label(): string {
		return this._label;
	}

	/** Simpan frame; true bila frame ini harus langsung digambar (milik tab aktif). */
	addFrame(tabId: number, data: string): boolean {
		this._frames.set(tabId, data);
		// Frame datang sebelum tab aktif ditetapkan: pakai tab pertama yang mengirim frame.
		if (this._activeTabId === null) this._activeTabId = tabId;
		return tabId === this._activeTabId;
	}

	/** Ganti tab aktif; kembalikan frame cache tab tersebut agar langsung digambar (tanpa jeda hitam). */
	setActiveTab(tabId: number, label: string): string | null {
		this._activeTabId = tabId;
		this._label = label;
		return this._frames.get(tabId) ?? null;
	}

	clear(): void {
		this._frames.clear();
		this._activeTabId = null;
		this._label = '';
	}
}

type LabelContext = Pick<
	CanvasRenderingContext2D,
	'save' | 'restore' | 'fillRect' | 'fillText' | 'measureText' | 'fillStyle' | 'font' | 'textBaseline'
>;

const LABEL_MAX_CHARS = 80;

/** Label tab aktif di pojok kiri atas canvas. */
export const drawTabLabel = (ctx: LabelContext, label: string, canvasWidth: number): void => {
	if (!label) return;
	const text = label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
	const fontSize = Math.max(12, Math.round(canvasWidth / 80));
	const padding = Math.round(fontSize / 2);
	ctx.save();
	ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
	ctx.textBaseline = 'top';
	const width = Math.min(ctx.measureText(text).width, canvasWidth - padding * 4);
	ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
	ctx.fillRect(padding, padding, width + padding * 2, fontSize + padding * 2);
	ctx.fillStyle = '#ffffff';
	ctx.fillText(text, padding * 2, padding * 2, width);
	ctx.restore();
};
