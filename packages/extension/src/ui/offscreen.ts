/**
 * Offscreen Document script untuk perekaman tab video via chrome.tabCapture & MediaRecorder.
 */

let recorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let recordedChunks: Blob[] = [];
let audioContext: AudioContext | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let lastImageSrc: string | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.target !== 'offscreen') return false;

	if (message.type === 'OFFSCREEN_PING') {
		sendResponse({ pong: true });
		return false;
	}

	if (message.type === 'OFFSCREEN_ADD_FRAME') {
		if (canvas && ctx && message.data) {
			const img = new Image();
			img.onload = () => {
				if (canvas && ctx) {
					if (img.naturalWidth > 0 && img.naturalHeight > 0 && (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight)) {
						canvas.width = img.naturalWidth;
						canvas.height = img.naturalHeight;
					}
					ctx.drawImage(img, 0, 0);
				}
			};
			img.src = `data:image/jpeg;base64,${message.data}`;
			lastImageSrc = img.src;
		}
		return false;
	}

	if (message.type === 'OFFSCREEN_START_RECORDING') {
		void (async () => {
			try {
				if (recorder && recorder.state !== 'inactive') {
					try {
						recorder.stop();
					} catch {
						// Abaikan error saat reset recorder lama
					}
				}
				if (currentStream) {
					currentStream.getTracks().forEach((track) => track.stop());
					currentStream = null;
				}
				if (audioContext) {
					try {
						await audioContext.close();
					} catch {
						// Abaikan
					}
					audioContext = null;
				}
				if (keepAliveTimer) {
					clearInterval(keepAliveTimer);
					keepAliveTimer = null;
				}

				recordedChunks = [];
				let stream: MediaStream | null = null;

				// 1. Coba capture audio + video dengan tabCapture jika ada streamId
				if (message.streamId) {
					try {
						stream = await navigator.mediaDevices.getUserMedia({
							audio: {
								mandatory: {
									chromeMediaSource: 'tab',
									chromeMediaSourceId: message.streamId
								}
							} as unknown as MediaTrackConstraints,
							video: {
								mandatory: {
									chromeMediaSource: 'tab',
									chromeMediaSourceId: message.streamId
								}
							} as unknown as MediaTrackConstraints
						});

						// Route audio ke destination agar tab user tidak mute selama recording
						try {
							if (stream.getAudioTracks().length > 0) {
								audioContext = new AudioContext();
								const source = audioContext.createMediaStreamSource(stream);
								source.connect(audioContext.destination);
							}
						} catch {
							// Abaikan jika audio context routing gagal
						}
					} catch {
						// Fallback ke video-only tabCapture
						try {
							stream = await navigator.mediaDevices.getUserMedia({
								video: {
									mandatory: {
										chromeMediaSource: 'tab',
										chromeMediaSourceId: message.streamId
									}
								} as unknown as MediaTrackConstraints
							});
						} catch {
							stream = null;
						}
					}
				}

				// 2. Jika tabCapture tidak tersedia (atau gagal permission), gunakan Canvas Screencast Stream (CDP Mode)
				if (!stream) {
					canvas = document.createElement('canvas');
					canvas.width = 1280;
					canvas.height = 720;
					ctx = canvas.getContext('2d');
					if (ctx) {
						ctx.fillStyle = '#0f172a';
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
					stream = (canvas as any).captureStream ? (canvas as any).captureStream(25) : null;

					// Heartbeat interval agar canvas stream tetap menghasilkan frame saat user idle
					keepAliveTimer = setInterval(() => {
						if (canvas && ctx && lastImageSrc) {
							ctx.fillRect(0, 0, 0, 0);
						}
					}, 200);
				}

				if (!stream) {
					throw new Error('Tidak dapat membuat media stream video.');
				}

				currentStream = stream;

				const preferredTypes = [
					'video/webm;codecs=vp9,opus',
					'video/webm;codecs=vp8,opus',
					'video/webm;codecs=vp9',
					'video/webm;codecs=vp8',
					'video/webm'
				];
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
					if (event.data && event.data.size > 0) {
						recordedChunks.push(event.data);
					}
				};

				recorder.start(1000);
				sendResponse({ success: true, mode: message.streamId ? 'tabCapture' : 'cdp_screencast' });
			} catch (err) {
				sendResponse({ success: false, error: (err as Error).message || 'Gagal memulai MediaRecorder' });
			}
		})();
		return true;
	}

	if (message.type === 'OFFSCREEN_STOP_RECORDING') {
		if (keepAliveTimer) {
			clearInterval(keepAliveTimer);
			keepAliveTimer = null;
		}

		if (!recorder || recorder.state === 'inactive') {
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop());
				currentStream = null;
			}
			if (audioContext) {
				try {
					void audioContext.close();
				} catch {
					// Abaikan
				}
				audioContext = null;
			}
			canvas = null;
			ctx = null;
			lastImageSrc = null;
			sendResponse({ success: true, dataUrl: null, size: 0 });
			return false;
		}

		let isHandled = false;
		const finish = (result: { success: boolean; dataUrl?: string | null; size?: number; error?: string }) => {
			if (isHandled) return;
			isHandled = true;
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop());
				currentStream = null;
			}
			if (audioContext) {
				try {
					void audioContext.close();
				} catch {
					// Abaikan
				}
				audioContext = null;
			}
			canvas = null;
			ctx = null;
			lastImageSrc = null;
			sendResponse(result);
		};

		// Safety timeout
		const timer = setTimeout(() => {
			if (recordedChunks.length > 0) {
				try {
					const blob = new Blob(recordedChunks, { type: 'video/webm' });
					const reader = new FileReader();
					reader.onloadend = () => finish({ success: true, dataUrl: reader.result as string, size: blob.size });
					reader.onerror = () => finish({ success: false, error: 'Timeout reading video chunks' });
					reader.readAsDataURL(blob);
					return;
				} catch {
					// Fallback
				}
			}
			finish({ success: true, dataUrl: null, size: 0 });
		}, 8000);

		recorder.onstop = () => {
			clearTimeout(timer);
			try {
				const blob = new Blob(recordedChunks, { type: 'video/webm' });
				if (blob.size === 0) {
					finish({ success: true, dataUrl: null, size: 0 });
					return;
				}

				const reader = new FileReader();
				reader.onloadend = () => {
					finish({
						success: true,
						dataUrl: reader.result as string,
						size: blob.size
					});
				};
				reader.onerror = () => {
					finish({ success: false, error: 'Gagal membaca buffer rekaman video.' });
				};
				reader.readAsDataURL(blob);
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
