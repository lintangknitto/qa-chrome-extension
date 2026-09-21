export const REDACTED = '[REDACTED]';
export const TRUNCATED_DEPTH = '[TRUNCATED_DEPTH]';
export const MAX_REDACTION_DEPTH = 8;

const SENSITIVE_KEY_PATTERN =
	/(authorization|cookie|password|passwd|pwd|secret|token|api[-_]?key|access[-_]?key|credential|csrf|xsrf|otp|\bpin\b|session[-_]?id)/i;

const SENSITIVE_URL_PARAMS = [
	'token',
	'access_token',
	'refresh_token',
	'api_key',
	'apikey',
	'key',
	'secret',
	'password',
	'signature',
	'sig',
	'session',
	'sessionid'
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CARD_LIKE_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
// Prefix kredensial umum + nilai panjang, supaya token yang tertanam di teks
// bebas (mis. catatan tester) ikut disamarkan.
const TOKEN_LIKE_PATTERN = /\b(?:sk|pk|tok|ghp|gho|ghs|glpat|xox[baprs]|AKIA)[-_][A-Za-z0-9_-]{8,}\b/g;

const SENSITIVE_PARAM_REGEX = new RegExp(
	`([?&](?:${SENSITIVE_URL_PARAMS.join('|')})=)([^&#]*)`,
	'gi'
);

export const isSensitiveKey = (key: string): boolean => SENSITIVE_KEY_PATTERN.test(key);

export const redactStringValue = (value: string): string =>
	value
		.replace(EMAIL_PATTERN, REDACTED)
		.replace(CARD_LIKE_PATTERN, REDACTED)
		.replace(TOKEN_LIKE_PATTERN, REDACTED);

export const redactUrl = (url: string): string =>
	redactStringValue(url.replace(SENSITIVE_PARAM_REGEX, `$1${REDACTED}`));

export const redactDeep = (value: unknown, keyHint = '', depth = 0): unknown => {
	if (depth > MAX_REDACTION_DEPTH) return TRUNCATED_DEPTH;
	if (keyHint && isSensitiveKey(keyHint)) return REDACTED;

	// String juga dilewatkan `redactUrl` agar URL bersarang di payload ikut
	// menyamarkan query param sensitif (`?token=`, `?access_token=`).
	if (typeof value === 'string') return redactUrl(value);
	if (value === null || value === undefined) return value;
	if (typeof value === 'number' || typeof value === 'boolean') return value;

	if (Array.isArray(value)) return value.map((item) => redactDeep(item, keyHint, depth + 1));

	if (typeof value === 'object') {
		const output: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value as Record<string, unknown>))
			output[key] = redactDeep(nested, key, depth + 1);
		return output;
	}

	return value;
};

export const redactHeaders = (headers: unknown): Record<string, unknown> => {
	if (!headers || typeof headers !== 'object') return {};
	return redactDeep(headers) as Record<string, unknown>;
};

export const redactPayload = (payload: Record<string, unknown>): Record<string, unknown> =>
	redactDeep(payload) as Record<string, unknown>;
