/**
 * Offscreen Document: merekam video dari frame CDP screencast semua tab dalam group.
 * Hanya frame tab aktif yang digambar ke canvas, lalu MediaRecorder merekam canvas itu.
 */
import { drawTabLabel, FrameCompositor, tabLabel } from './offscreenCompositor';

let recorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let recordedChunks: Blob[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let lastImage: HTMLImageElement | null = null;
const compositor = new FrameCompositor();

const render = () => {
	if (!canvas || !ctx) return;
	if (lastImage) {
		ctx.drawImage(lastImage, 0, 0, canvas.width, canvas.height);
	} else {
		ctx.fillStyle = '#0f172a';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	drawTabLabel(ctx, compositor.label, canvas.width);
};

const drawFrame = (tabId: number, data: string) => {
	const img = new Image();
	img.onload = () => {
		// Frame lama yang selesai di-decode setelah pindah tab tidak boleh menimpa tab baru.
		if (!canvas || compositor.activeTabId !== tabId) return;
		if (img.naturalWidth > 0 && img.naturalHeight > 0 && (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight)) {
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
		}
		lastImage = img;
		render();
	};
	img.src = `data:image/jpeg;base64,${data}`;
};

/** `keepTabs`: saat mulai rekam, tab aktif yang sudah ditetapkan recorder tetap dipakai. */
const resetCanvas = (keepTabs = false) => {
	if (keepAliveTimer) {
		clearInterval(keepAliveTimer);
		keepAliveTimer = null;
	}
	if (currentStream) {
		currentStream.getTracks().forEach((track) => track.stop());
		currentStream = null;
	}
	canvas = null;
	ctx = null;
	lastImage = null;
	if (!keepTabs) compositor.clear();
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.target !== 'offscreen') return false;

	if (message.type === 'OFFSCREEN_PING') {
		sendResponse({ pong: true });
		return false;
	}

	if (message.type === 'OFFSCREEN_ADD_FRAME') {
		if (typeof message.data === 'string' && typeof message.tabId === 'number') {
			if (compositor.addFrame(message.tabId, message.data) && canvas) drawFrame(message.tabId, message.data);
		}
		return false;
	}

	if (message.type === 'OFFSCREEN_SET_ACTIVE_TAB') {
		if (typeof message.tabId === 'number') {
			const switched = compositor.activeTabId !== message.tabId;
			const cached = compositor.setActiveTab(message.tabId, tabLabel(message.title, message.url));
			if (switched && cached) drawFrame(message.tabId, cached);
			else render();
		}
		return false;
	}

	if (message.type === 'OFFSCREEN_START_RECORDING') {
		try {
			if (recorder && recorder.state !== 'inactive') {
				try {
					recorder.stop();
				} catch {
					// Abaikan error saat reset recorder lama
				}
			}
			resetCanvas(true);
			recordedChunks = [];

			canvas = document.createElement('canvas');
			canvas.width = 1280;
			canvas.height = 720;
			ctx = canvas.getContext('2d');
			render();
			const stream: MediaStream | null = (canvas as any).captureStream ? (canvas as any).captureStream(25) : null;
			if (!stream) throw new Error('Tidak dapat membuat media stream video.');
			currentStream = stream;

			// Canvas stream hanya menghasilkan frame saat digambar ulang: redraw berkala agar video tetap berjalan saat halaman diam.
			keepAliveTimer = setInterval(render, 200);

			const preferredTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
			let mimeType = 'video/webm';
			if (typeof MediaRecorder !== 'undefined') {
				for (const t of preferredTypes) {
					if (MediaRecorder.isTypeSupported(t)) {
						mimeType = t;
						break;
					}
				}
			}

			recorder = new MediaRecorder(stream, { mimeType });
			recorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) recordedChunks.push(event.data);
			};

			recorder.start(1000);
			sendResponse({ success: true, mode: 'cdp_screencast' });
		} catch (err) {
			sendResponse({ success: false, error: (err as Error).message || 'Gagal memulai MediaRecorder' });
		}
		return false;
	}

	if (message.type === 'OFFSCREEN_STOP_RECORDING') {
		if (!recorder || recorder.state === 'inactive') {
			resetCanvas();
			sendResponse({ success: true, dataUrl: null, size: 0 });
			return false;
		}

		let isHandled = false;
		const finish = (result: { success: boolean; dataUrl?: string | null; size?: number; error?: string }) => {
			if (isHandled) return;
			isHandled = true;
			resetCanvas();
			sendResponse(result);
		};

		const readChunks = (onEmpty: () => void) => {
			const blob = new Blob(recordedChunks, { type: 'video/webm' });
			if (blob.size === 0) {
				onEmpty();
				return;
			}
			const reader = new FileReader();
			reader.onloadend = () => finish({ success: true, dataUrl: reader.result as string, size: blob.size });
			reader.onerror = () => finish({ success: false, error: 'Gagal membaca buffer rekaman video.' });
			reader.readAsDataURL(blob);
		};

		// Safety timeout bila onstop tidak pernah terpanggil.
		const timer = setTimeout(() => {
			try {
				readChunks(() => finish({ success: true, dataUrl: null, size: 0 }));
			} catch {
				finish({ success: true, dataUrl: null, size: 0 });
			}
		}, 8000);

		recorder.onstop = () => {
			clearTimeout(timer);
			try {
				readChunks(() => finish({ success: true, dataUrl: null, size: 0 }));
			} catch (err) {
				finish({ success: false, error: (err as Error).message });
			}
		};

		if (recorder.state === 'recording') {
			try {
				recorder.requestData();
			} catch {
				// Ignore
			}
		}
		recorder.stop();
		return true;
	}

	return false;
});
