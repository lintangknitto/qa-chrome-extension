import { describe, expect, it } from 'vitest';
import { REDACTED, redactPayload, redactStringValue, redactUrl } from '../redaction';

describe('recording redaction', () => {
	it('menyamarkan header sensitif pada payload bersarang', () => {
		const result = redactPayload({
			request: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
			keep: 'ok'
		}) as any;

		expect(result.request.headers.authorization).toBe(REDACTED);
		expect(result.request.headers.cookie).toBe(REDACTED);
		expect(result.keep).toBe('ok');
	});

	it('menyamarkan nilai query param sensitif pada URL relatif', () => {
		const result = redactUrl('/api/checkout?token=abc123&page=2');
		expect(result).toContain(`token=${REDACTED}`);
		expect(result).toContain('page=2');
		expect(result).not.toContain('abc123');
	});

	it('menyamarkan email dan deretan angka mirip kartu', () => {
		expect(redactStringValue('a@b.co 4111 1111 1111 1111')).not.toContain('a@b.co');
		expect(redactStringValue('a@b.co 4111 1111 1111 1111')).toContain(REDACTED);
	});

	it('memastikan secret fixture tidak lolos', () => {
		const secret = 'tok_live_9f8e7d6c5b4a';
		const serialized = JSON.stringify(
			redactPayload({ auth: { access_token: secret }, note: `pakai ${secret}` })
		);

		expect(serialized).not.toContain(secret);
	});
});
