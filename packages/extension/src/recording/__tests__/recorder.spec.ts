import { describe, expect, it } from 'vitest';
import { RecordingController } from '../recorder';
import type { RecordingEventDraft } from '../eventTypes';

const makeDraft = (): RecordingEventDraft => ({
	type: 'console',
	occurred_at: new Date().toISOString(),
	tab_id: null,
	url: null,
	payload: { level: 'log', text: 'x' }
});

describe('RecordingController stop drain (G3)', () => {
	it('menguras seluruh buffer (lebih dari satu batch) saat stop', async () => {
		const controller = new RecordingController();
		const sent: number[] = [];

		(controller as any)._socket = {
			sendEvents: async (events: { sequence: number }[]) => {
				sent.push(...events.map((event) => event.sequence));
				const last = events[events.length - 1].sequence;
				return {
					accepted: events.length,
					inserted: events.length,
					duplicates: 0,
					last_sequence: last,
					resume: { last_sequence: last, next_sequence: last + 1 }
				};
			},
			disconnect: () => {}
		};
		(controller as any)._options = { maxBatchSize: 2 };

		const buffer = (controller as any)._buffer;
		for (let sequence = 1; sequence <= 5; sequence += 1) buffer.enqueue(makeDraft());

		await controller.stop();

		expect(sent).toEqual([1, 2, 3, 4, 5]);
		expect((controller as any)._buffer.pendingCount).toBe(0);
	});
});
