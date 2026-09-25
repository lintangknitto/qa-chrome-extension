/**
 * Offscreen Document script untuk perekaman tab video via chrome.tabCapture & MediaRecorder.
 */

let recorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let recordedChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.target !== 'offscreen') return false;

	if (message.type === 'OFFSCREEN_PING') {
		sendResponse({ pong: true });
		return false;
	}

	if (message.type === 'OFFSCREEN_START_RECORDING') {
		void (async () => {
			try {
				if (!message.streamId) {
					sendResponse({ success: false, error: 'streamId wajib disertakan.' });
					return;
				}

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

				const stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						mandatory: {
							chromeMediaSource: 'tab',
							chromeMediaSourceId: message.streamId
						}
					} as unknown as MediaTrackConstraints
				});

				currentStream = stream;
				recordedChunks = [];

				let mimeType = 'video/webm';
				if (typeof MediaRecorder !== 'undefined') {
					if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
						mimeType = 'video/webm;codecs=vp9';
					} else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
						mimeType = 'video/webm;codecs=vp8';
					}
				}

				recorder = new MediaRecorder(stream, { mimeType });
				recorder.ondataavailable = (event: BlobEvent) => {
					if (event.data && event.data.size > 0) {
						recordedChunks.push(event.data);
					}
				};

				recorder.start(1000);
				sendResponse({ success: true });
			} catch (err) {
				sendResponse({ success: false, error: (err as Error).message || 'Gagal memulai MediaRecorder' });
			}
		})();
		return true;
	}

	if (message.type === 'OFFSCREEN_STOP_RECORDING') {
		if (!recorder || recorder.state === 'inactive') {
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop());
				currentStream = null;
			}
			sendResponse({ success: true, dataUrl: null, size: 0 });
			return false;
		}

		recorder.onstop = () => {
			try {
				const blob = new Blob(recordedChunks, { type: 'video/webm' });
				if (currentStream) {
					currentStream.getTracks().forEach((track) => track.stop());
					currentStream = null;
				}

				if (blob.size === 0) {
					sendResponse({ success: true, dataUrl: null, size: 0 });
					return;
				}

				const reader = new FileReader();
				reader.onloadend = () => {
					sendResponse({
						success: true,
						dataUrl: reader.result as string,
						size: blob.size
					});
				};
				reader.onerror = () => {
					sendResponse({ success: false, error: 'Gagal membaca buffer rekaman video.' });
				};
				reader.readAsDataURL(blob);
			} catch (err) {
				sendResponse({ success: false, error: (err as Error).message });
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
