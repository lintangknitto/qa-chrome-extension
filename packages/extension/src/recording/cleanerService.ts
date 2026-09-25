/**
 * cleanerService.ts
 * Utilitas untuk deteksi domain tab dan eksekusi aksi pembersihan (cleaner)
 * via komunikasi ke background service worker Chrome Extension.
 */

export interface ParsedTabDomain {
	rawUrl: string;
	origin: string;
	hostname: string;
	isRestricted: boolean;
	restrictedReason?: string;
}

/**
 * Memeriksa apakah URL merupakan halaman sistem browser yang tidak dapat dibersihkan.
 */
export const parseTabDomain = (url?: string): ParsedTabDomain => {
	if (!url || typeof url !== 'string' || !url.trim()) {
		return {
			rawUrl: '',
			origin: '',
			hostname: '',
			isRestricted: true,
			restrictedReason: 'Tidak ada URL tab yang terdeteksi'
		};
	}

	const trimmed = url.trim();

	// Cek skema sistem browser
	const restrictedProtocols = [
		'chrome:',
		'chrome-extension:',
		'chrome-untrusted:',
		'devtools:',
		'edge:',
		'about:',
		'view-source:',
		'data:'
	];

	for (const protocol of restrictedProtocols) {
		if (trimmed.startsWith(protocol)) {
			return {
				rawUrl: trimmed,
				origin: '',
				hostname: trimmed.split('/')[0] || trimmed,
				isRestricted: true,
				restrictedReason: 'Halaman sistem browser tidak dapat dibersihkan'
			};
		}
	}

	try {
		const parsed = new URL(trimmed);
		return {
			rawUrl: trimmed,
			origin: parsed.origin,
			hostname: parsed.hostname,
			isRestricted: false
		};
	} catch {
		return {
			rawUrl: trimmed,
			origin: '',
			hostname: trimmed,
			isRestricted: true,
			restrictedReason: 'Format URL tidak valid'
		};
	}
};

/**
 * Mengirim pesan ke background service worker dengan penanganan fallback aman.
 */
export const sendCleanerMessage = async <T = unknown>(
	message: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string }> => {
	if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
		return {
			success: false,
			error: 'Chrome extension runtime tidak tersedia.'
		};
	}

	return new Promise((resolve) => {
		try {
			chrome.runtime.sendMessage(message, (response) => {
				if (chrome.runtime.lastError) {
					resolve({
						success: false,
						error: chrome.runtime.lastError.message || 'Gagal berkomunikasi dengan background service worker.'
					});
					return;
				}
				if (!response) {
					resolve({
						success: false,
						error: 'Tidak ada respon dari background service worker.'
					});
					return;
				}
				resolve(response as { success: boolean; data?: T; error?: string });
			});
		} catch (err) {
			resolve({
				success: false,
				error: (err as Error).message || 'Terjadi kesalahan saat mengeksekusi aksi cleaner.'
			});
		}
	});
};

/**
 * 1-Klik Empty Cache & Hard Reload untuk tab tertentu atau tab aktif.
 */
export const requestHardReload = async (tabId?: number): Promise<{ success: boolean; error?: string }> => {
	return sendCleanerMessage({
		type: 'cleaner:hardReload',
		tabId
	});
};

/**
 * Hapus cookies khusus origin / domain tab tertentu.
 */
export const requestClearCookies = async (url: string): Promise<{ success: boolean; count?: number; error?: string }> => {
	return sendCleanerMessage({
		type: 'cleaner:clearCookies',
		url
	});
};

/**
 * Hapus CacheStorage, Service Worker, LocalStorage, dan IndexedDB untuk origin domain ini.
 */
export const requestClearStorageAndCache = async (origin: string): Promise<{ success: boolean; error?: string }> => {
	return sendCleanerMessage({
		type: 'cleaner:clearStorageAndCache',
		origin
	});
};

/**
 * Bersihkan seluruh data (Cache, Cookies, Storage, Service Worker) lalu muat ulang tab tanpa cache.
 */
export const requestCleanAll = async (
	url: string,
	tabId?: number
): Promise<{ success: boolean; error?: string }> => {
	return sendCleanerMessage({
		type: 'cleaner:cleanAll',
		url,
		tabId
	});
};
