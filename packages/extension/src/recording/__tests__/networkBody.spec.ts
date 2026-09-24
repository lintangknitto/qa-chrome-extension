import { describe, expect, it } from 'vitest';
import { isBinaryOrStreaming, isStorableContentType, prepareNetworkBody } from '../networkBody';

const MAX = 32;

describe('recording networkBody', () => {
	it('mengenali tipe yang boleh disimpan dan yang binary/streaming', () => {
		expect(isStorableContentType('application/json; charset=utf-8')).toBe(true);
		expect(isStorableContentType('image/png')).toBe(false);
		expect(isBinaryOrStreaming('image/png')).toBe(true);
		expect(isBinaryOrStreaming('text/event-stream')).toBe(true);
	});

	it('menyimpan body dalam batas', () => {
		const result = prepareNetworkBody('application/json', '{"a":1}', MAX);
		expect(result.stored).toBe(true);
		expect(result.truncated).toBe(false);
		expect(result.body).toBe('{"a":1}');
	});

	it('memotong body melebihi batas dan menandai truncated', () => {
		const result = prepareNetworkBody('application/json', 'x'.repeat(100), MAX);
		expect(result.stored).toBe(true);
		expect(result.truncated).toBe(true);
		expect(result.original_bytes).toBe(100);
		expect(result.body?.length).toBe(MAX);
	});

	it('tidak menyimpan body binary dan streaming', () => {
		expect(prepareNetworkBody('image/png', 'binary', MAX).reason).toBe('binary_or_streaming');
		expect(prepareNetworkBody('text/event-stream', 'data: x', MAX).reason).toBe('binary_or_streaming');
	});

	it('tidak menyimpan tipe di luar allowlist', () => {
		expect(prepareNetworkBody('application/x-custom', 'x', MAX).reason).toBe(
			'content_type_not_allowlisted'
		);
	});

	it('menandai tidak ada body', () => {
		expect(prepareNetworkBody('application/json', null, MAX).reason).toBe('no_body');
	});
});
