export const RECORDING_EVENT_VERSION = 1;

export const RECORDING_EVENT_TYPES = [
	'action',
	'tab',
	'console',
	'exception',
	'network',
	'artifact',
	'checkpoint'
] as const;

export type RecordingEventType = (typeof RECORDING_EVENT_TYPES)[number];

export interface RecordingEventDraft {
	type: RecordingEventType;
	occurred_at: string;
	tab_id?: number | null;
	url?: string | null;
	payload: Record<string, unknown>;
}

export interface RecordingEvent extends RecordingEventDraft {
	event_version: number;
	sequence: number;
}

export const isRecordingEventType = (value: string): value is RecordingEventType =>
	(RECORDING_EVENT_TYPES as readonly string[]).includes(value);

export const createEventDraft = (
	type: RecordingEventType,
	payload: Record<string, unknown>,
	extra: { occurredAt?: string; tabId?: number | null; url?: string | null } = {}
): RecordingEventDraft => ({
	type,
	occurred_at: extra.occurredAt ?? new Date().toISOString(),
	tab_id: extra.tabId ?? null,
	url: extra.url ?? null,
	payload
});
