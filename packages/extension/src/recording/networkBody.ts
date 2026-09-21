/**
 * Aturan body network sisi extension: hanya tipe teks/JSON yang dikirim,
 * dibatasi ukuran, dan ditandai `truncated` bila dipotong. Backend tetap
 * menjadi penegak terakhir.
 */
export interface NetworkBodyResult {
	stored: boolean;
	body: string | null;
	truncated: boolean;
	reason: string | null;
	original_bytes: number;
}

const STORABLE_CONTENT_TYPES = [
	'application/json',
	'application/ld+json',
	'application/xml',
	'application/x-www-form-urlencoded',
	'application/graphql',
	'application/javascript',
	'text/plain',
	'text/html',
	'text/css',
	'text/xml',
	'text/csv',
	'text/javascript'
];

const BINARY_PREFIXES = ['image/', 'video/', 'audio/', 'font/'];
const BINARY_TYPES = [
	'application/octet-stream',
	'application/pdf',
	'application/zip',
	'application/gzip',
	'application/wasm',
	'multipart/form-data'
];

export const baseContentType = (contentType: string | null | undefined): string =>
	(contentType ?? '').split(';')[0].trim().toLowerCase();

export const isStorableContentType = (contentType: string | null | undefined): boolean => {
	const base = baseContentType(contentType);
	if (!base) return false;
	return STORABLE_CONTENT_TYPES.some(
		(allowed) => base === allowed || base.endsWith(`+${allowed.split('/')[1]}`)
	);
};

export const isBinaryOrStreaming = (contentType: string | null | undefined): boolean => {
	const base = baseContentType(contentType);
	if (!base) return false;
	if (base === 'text/event-stream') return true;
	return BINARY_PREFIXES.some((prefix) => base.startsWith(prefix)) || BINARY_TYPES.includes(base);
};

export const byteLength = (value: string): number => new TextEncoder().encode(value).length;

export const prepareNetworkBody = (
	contentType: string | null | undefined,
	body: string | null | undefined,
	maxBytes: number
): NetworkBodyResult => {
	const value = body ?? null;
	const originalBytes = value === null ? 0 : byteLength(value);

	if (value === null || value === '')
		return { stored: false, body: null, truncated: false, reason: 'no_body', original_bytes: 0 };

	if (isBinaryOrStreaming(contentType))
		return {
			stored: false,
			body: null,
			truncated: false,
			reason: 'binary_or_streaming',
			original_bytes: originalBytes
		};

	if (!isStorableContentType(contentType))
		return {
			stored: false,
			body: null,
			truncated: false,
			reason: 'content_type_not_allowlisted',
			original_bytes: originalBytes
		};

	if (originalBytes > maxBytes) {
		const truncated = new TextEncoder().encode(value).slice(0, maxBytes);
		return {
			stored: true,
			body: new TextDecoder().decode(truncated),
			truncated: true,
			reason: 'body_exceeds_limit',
			original_bytes: originalBytes
		};
	}

	return { stored: true, body: value, truncated: false, reason: null, original_bytes: originalBytes };
};
