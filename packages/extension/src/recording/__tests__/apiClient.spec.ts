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

	it('mengirim request POST /projects dengan payload dan token yang benar pada createProject', async () => {
		let capturedUrl = '';
		let capturedInit: RequestInit | undefined;

		const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedUrl = String(input);
			capturedInit = init;
			return new Response(
				JSON.stringify({
					result: {
						id_project: 10,
						name: 'ERP Knitto',
						code: 'erp-knitto',
						base_url: 'https://erp.knitto.id',
						description: 'Project ERP',
						is_active: true
					}
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } }
			);
		});

		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => 'test-auth-token',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const res = await client.createProject({
			name: 'ERP Knitto',
			base_url: 'https://erp.knitto.id',
			description: 'Project ERP'
		});

		expect(capturedUrl).toBe('http://127.0.0.1:8010/projects');
		expect(capturedInit?.method).toBe('POST');
		expect(capturedInit?.headers).toMatchObject({
			Authorization: 'Bearer test-auth-token',
			'Content-Type': 'application/json'
		});
		expect(JSON.parse(capturedInit?.body as string)).toEqual({
			name: 'ERP Knitto',
			base_url: 'https://erp.knitto.id',
			description: 'Project ERP'
		});
		expect(res.id_project).toBe(10);
		expect(res.name).toBe('ERP Knitto');
		expect(res.code).toBe('erp-knitto');
	});
});
