import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordingApiClient } from '../apiClient';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('recording apiClient fetch binding', () => {
	it('memanggil fetch global dengan receiver globalThis (bukan instance client)', async () => {
		const receivers: unknown[] = [];
		globalThis.fetch = function (this: unknown) {
			receivers.push(this);
			return Promise.resolve(
				new Response(JSON.stringify({ result: { token: 't', user: { id_user: 1, username: 'u', nama: 'U' } } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		} as typeof fetch;

		const client = new RecordingApiClient({ baseUrl: 'http://127.0.0.1:8010', getToken: async () => null });
		const result = await client.login('u', 'p');

		expect(result.token).toBe('t');
		expect(receivers).toHaveLength(1);
		expect(receivers[0]).toBe(globalThis);
	});

	it('menghormati fetchImpl yang diinjeksi', async () => {
		const fetchImpl = vi.fn(
			async () => new Response(JSON.stringify({ result: { token: 'x' } }), { status: 200 })
		);
		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => null,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		await client.login('u', 'p');

		expect(fetchImpl).toHaveBeenCalledOnce();
	});
});
