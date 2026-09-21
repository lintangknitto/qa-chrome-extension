import { describe, expect, it } from 'vitest';
import { EventBuffer } from '../eventBuffer';
import { createEventDraft } from '../eventTypes';

const draft = (payload: Record<string, unknown> = {}) => createEventDraft('action', payload);

describe('EventBuffer', () => {
	it('memberi sequence monotonik mulai dari 1', () => {
		const buffer = new EventBuffer();
		expect(buffer.enqueue(draft()).sequence).toBe(1);
		expect(buffer.enqueue(draft()).sequence).toBe(2);
		expect(buffer.nextSequence).toBe(3);
	});

	it('mengambil batch sesuai urutan dan batas', () => {
		const buffer = new EventBuffer();
		buffer.enqueue(draft({ n: 1 }));
		buffer.enqueue(draft({ n: 2 }));
		buffer.enqueue(draft({ n: 3 }));

		const batch = buffer.takeBatch(2);
		expect(batch.map((event) => event.sequence)).toEqual([1, 2]);
		expect(buffer.pendingCount).toBe(3);
	});

	it('membuang event yang sudah di-acknowledge', () => {
		const buffer = new EventBuffer();
		buffer.enqueue(draft());
		buffer.enqueue(draft());
		buffer.enqueue(draft());

		buffer.acknowledge(2);
		expect(buffer.takeBatch(10).map((event) => event.sequence)).toEqual([3]);
	});

	it('melanjutkan dari resume cursor backend', () => {
		const buffer = new EventBuffer();
		buffer.enqueue(draft());
		buffer.resumeFrom(10);
		expect(buffer.nextSequence).toBe(10);
		expect(buffer.pendingCount).toBe(0);
		expect(buffer.enqueue(draft()).sequence).toBe(10);
	});

	it('menolak resume cursor yang tidak valid', () => {
		const buffer = new EventBuffer();
		expect(() => buffer.resumeFrom(0)).toThrow();
		expect(() => buffer.resumeFrom(1.5)).toThrow();
	});

	it('mengosongkan buffer tanpa mengubah sequence', () => {
		const buffer = new EventBuffer();
		buffer.enqueue(draft());
		buffer.clear();
		expect(buffer.pendingCount).toBe(0);
		expect(buffer.nextSequence).toBe(2);
	});
});
