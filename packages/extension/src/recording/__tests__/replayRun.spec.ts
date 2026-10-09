import { describe, expect, it, vi } from 'vitest';
import { dataUrlToBlob, replayResultToRunInput, saveReplayRun } from '../replayRun';

const times = { startedAt: '2026-10-09T03:00:00.000Z', endedAt: '2026-10-09T03:01:00.000Z' };

describe('replayRun', () => {
	it('memetakan hasil replay ke input run', () => {
		expect(replayResultToRunInput({ success: true, totalSteps: 3, executedSteps: 3 }, times.startedAt, times.endedAt)).toEqual({
			result: 'PASS',
			actual_result: 'Replay sukses dieksekusi (3 langkah selesai).',
			executed_steps: 3,
			error: null,
			started_at: times.startedAt,
			ended_at: times.endedAt
		});
		expect(replayResultToRunInput({ success: false, totalSteps: 3, executedSteps: 1, error: 'Elemen tidak ditemukan' }, 'a', 'b'))
			.toMatchObject({ result: 'FAIL', actual_result: 'Elemen tidak ditemukan', error: 'Elemen tidak ditemukan', executed_steps: 1 });
	});

	it('membuat run lalu mengunggah video lewat endpoint run', async () => {
		const api = {
			createRun: vi.fn(async () => ({ run_number: 2, video_url: null }) as any),
			uploadRunVideo: vi.fn(async () => ({ run_number: 2, video_url: 'http://minio/v.webm' }) as any)
		};
		const run = await saveReplayRun(api, 5, { success: true, totalSteps: 1, executedSteps: 1 }, 'data:video/webm;base64,AAEC', times);

		expect(api.createRun).toHaveBeenCalledWith(5, expect.objectContaining({ result: 'PASS' }));
		const [sessionId, runNumber, blob] = api.uploadRunVideo.mock.calls[0] as unknown as [number, number, Blob];
		expect([sessionId, runNumber, blob.type, blob.size]).toEqual([5, 2, 'video/webm', 3]);
		expect(run.video_url).toBe('http://minio/v.webm');
	});

	it('tanpa video tidak mengunggah; upload gagal tetap mengembalikan run tersimpan', async () => {
		const api = {
			createRun: vi.fn(async () => ({ run_number: 3, video_url: null }) as any),
			uploadRunVideo: vi.fn(async () => {
				throw new Error('PUT gagal');
			})
		};
		await saveReplayRun(api, 5, { success: false, totalSteps: 1, executedSteps: 0 }, null, times);
		expect(api.uploadRunVideo).not.toHaveBeenCalled();

		const onVideoError = vi.fn();
		const run = await saveReplayRun(api, 5, { success: false, totalSteps: 1, executedSteps: 0 }, 'data:video/webm;base64,AA==', times, onVideoError);
		expect(run.run_number).toBe(3);
		expect(onVideoError).toHaveBeenCalled();
	});

	it('dataUrlToBlob membaca mime dan isi', () => {
		const blob = dataUrlToBlob('data:video/webm;codecs=vp9;base64,AAECAw==');
		expect(blob.type).toBe('video/webm');
		expect(blob.size).toBe(4);
	});
});
