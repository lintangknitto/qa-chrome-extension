/**
 * Menyimpan fungsi pelepasan listener agar seluruh listener debugger dapat
 * dibersihkan tepat sekali saat recording berakhir atau gagal.
 */
export class ListenerRegistry {
	private _removers: Array<() => void> = [];

	get size(): number {
		return this._removers.length;
	}

	add(remover: () => void): void {
		this._removers.push(remover);
	}

	removeAll(): void {
		const removers = this._removers;
		this._removers = [];
		for (const remover of removers) {
			try {
				remover();
			} catch {
				// Listener sudah lepas bukan kondisi fatal.
			}
		}
	}
}
