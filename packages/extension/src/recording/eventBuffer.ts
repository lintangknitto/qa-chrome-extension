import {
	RECORDING_EVENT_VERSION,
	type RecordingEvent,
	type RecordingEventDraft
} from './eventTypes';

export interface BufferedEvent extends RecordingEvent {}

/**
 * Buffer event in-memory dengan sequence monotonik.
 * - `takeBatch` mengambil event terlama yang belum terkirim.
 * - `acknowledge` membuang event yang sudah dikonfirmasi backend.
 * - `resumeFrom` menyetel ulang sequence dari resume cursor backend.
 */
export class EventBuffer {
	private _nextSequence = 1;
	private _pending: BufferedEvent[] = [];

	get nextSequence(): number {
		return this._nextSequence;
	}

	get pendingCount(): number {
		return this._pending.length;
	}

	enqueue(draft: RecordingEventDraft): BufferedEvent {
		const event: BufferedEvent = {
			...draft,
			event_version: RECORDING_EVENT_VERSION,
			sequence: this._nextSequence
		};
		this._nextSequence += 1;
		this._pending.push(event);
		return event;
	}

	takeBatch(max: number): BufferedEvent[] {
		if (max <= 0) return [];
		return this._pending.slice(0, max);
	}

	acknowledge(upToSequence: number): void {
		this._pending = this._pending.filter((event) => event.sequence > upToSequence);
	}

	resumeFrom(nextSequence: number): void {
		if (!Number.isInteger(nextSequence) || nextSequence < 1)
			throw new Error('nextSequence harus bilangan bulat >= 1.');
		this._nextSequence = nextSequence;
		this._pending = this._pending.filter((event) => event.sequence >= nextSequence);
	}

	clear(): void {
		this._pending = [];
	}
}
