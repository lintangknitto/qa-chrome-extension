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

	it('generateShareUrl mengirim POST /sessions/:id/share', async () => {
		let capturedUrl = '';
		let capturedInit: RequestInit | undefined;

		const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedUrl = String(input);
			capturedInit = init;
			return new Response(
				JSON.stringify({
					result: {
						share_token: 'uuid-tok',
						share_url: 'http://127.0.0.1:8010/share/uuid-tok'
					}
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});

		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => 'jwt-token',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const res = await client.generateShareUrl(99);

		expect(capturedUrl).toBe('http://127.0.0.1:8010/sessions/99/share');
		expect(capturedInit?.method).toBe('POST');
		expect(res.share_token).toBe('uuid-tok');
		expect(res.share_url).toBe('http://127.0.0.1:8010/share/uuid-tok');
	});

	it('uploadSessionVideo alur presign -> upload PUT -> complete berhasil', async () => {
		const calls: Array<{ url: string; method?: string }> = [];

		const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({ url, method: init?.method });

			if (url.includes('/video/presign-upload')) {
				return new Response(
					JSON.stringify({
						result: {
							upload_url: 'http://minio:9000/presigned-put',
							object_key: 'sessions/1/99-video.webm',
							content_type: 'video/webm',
							expires_in: 3600
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.includes('/presigned-put')) {
				return new Response(null, { status: 200 });
			}

			if (url.includes('/video/complete')) {
				return new Response(
					JSON.stringify({
						result: {
							id_session: 99,
							video_url: 'http://minio:9000/artifacts/video.webm',
							object_key: 'sessions/1/99-video.webm'
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response(JSON.stringify({}), { status: 200 });
		});

		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => 'jwt-token',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const dummyBlob = new Blob(['video-bytes'], { type: 'video/webm' });
		const res = await client.uploadSessionVideo(99, dummyBlob);

		expect(calls).toHaveLength(3);
		expect(calls[0].url).toContain('/sessions/99/video/presign-upload');
		expect(calls[1].url).toBe('http://minio:9000/presigned-put');
		expect(calls[1].method).toBe('PUT');
		expect(calls[2].url).toContain('/sessions/99/video/complete');
		expect(res.video_url).toBe('http://minio:9000/artifacts/video.webm');
	});
});
