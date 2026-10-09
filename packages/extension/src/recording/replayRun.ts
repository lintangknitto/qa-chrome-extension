import type { CreateRunInput, RecordingApiClient, SessionRun } from './apiClient';
import type { ReplayResult } from './replayEngine';

export const replayResultToRunInput = (result: ReplayResult, startedAt: string, endedAt: string): CreateRunInput => ({
	result: result.success ? 'PASS' : 'FAIL',
	actual_result: result.success
		? `Replay sukses dieksekusi (${result.executedSteps} langkah selesai).`
		: result.error || 'Replay terhenti',
	executed_steps: result.executedSteps,
	error: result.success ? null : result.error ?? null,
	started_at: startedAt,
	ended_at: endedAt
});

export const dataUrlToBlob = (dataUrl: string): Blob => {
	const [header, base64 = ''] = dataUrl.split(',');
	const mime = header.match(/^data:([^;]+)/)?.[1] || 'video/webm';
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], { type: mime });
};

/**
 * Simpan hasil replay sebagai run baru di server, lalu unggah videonya lewat endpoint video run.
 * Video sesi (Run #1) tidak disentuh. Upload video gagal tidak membatalkan run yang sudah tersimpan.
 */
export const saveReplayRun = async (
	api: Pick<RecordingApiClient, 'createRun' | 'uploadRunVideo'>,
	sessionId: number,
	result: ReplayResult,
	videoDataUrl: string | null,
	times: { startedAt: string; endedAt: string },
	onVideoError: (error: unknown) => void = () => {}
): Promise<SessionRun> => {
	const run = await api.createRun(sessionId, replayResultToRunInput(result, times.startedAt, times.endedAt));
	if (!videoDataUrl) return run;
	try {
		return await api.uploadRunVideo(sessionId, run.run_number, dataUrlToBlob(videoDataUrl));
	} catch (error) {
		onVideoError(error);
		return run;
	}
};
