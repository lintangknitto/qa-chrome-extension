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

	it('request non-GET membawa x-request-id unik agar POST paralel ke path sama tidak digabung API', async () => {
		const headersSeen: Array<Record<string, string>> = [];
		const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
			headersSeen.push(init.headers as Record<string, string>);
			return new Response(JSON.stringify({ result: { upload_url: 'u', artifact: { id_artifact: 1 } } }), { status: 200 });
		});
		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => 't',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const body = { kind: 'test_data_file', content_type: 'text/plain', size_bytes: 1 };
		await Promise.all([client.presignArtifactUpload(1, body), client.presignArtifactUpload(1, body)]);
		await client.getSessionVideo(1).catch(() => undefined);

		const [a, b, get] = headersSeen;
		expect(a['x-request-id']).toBeTruthy();
		expect(b['x-request-id']).toBeTruthy();
		expect(a['x-request-id']).not.toBe(b['x-request-id']);
		expect(get['x-request-id']).toBeUndefined();
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

	it('mengembalikan null ketika endpoint membungkus { result: null } (seperti getActiveSession saat tidak ada sesi aktif)', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: 'Success', result: null }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		const client = new RecordingApiClient({
			baseUrl: 'http://127.0.0.1:8010',
			getToken: async () => 'test-token',
			fetchImpl: fetchImpl as unknown as typeof fetch
		});

		const active = await client.getActiveSession();
		expect(active).toBeNull();
	});
});

describe('recording apiClient — template & ekspor test case', () => {
	const makeClient = (fetchImpl: typeof fetch) =>
		new RecordingApiClient({ baseUrl: 'http://api.local', getToken: async () => 'tok', fetchImpl });

	it('exportTestCases mengunduh blob dengan nama file dari Content-Disposition', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(new Uint8Array([1, 2, 3]), {
				status: 200,
				headers: { 'Content-Disposition': 'attachment; filename="chat-widget-test-case-v4.xlsx"' }
			})
		);
		const { blob, filename } = await makeClient(fetchImpl as unknown as typeof fetch).exportTestCases(5, 2);
		expect(filename).toBe('chat-widget-test-case-v4.xlsx');
		expect(blob.size).toBe(3);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('http://api.local/projects/5/test-cases/export?template=2');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
	});

	it('exportTestCases meneruskan pesan error JSON dari API', async () => {
		const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: 'Belum ada template test case default.' }), { status: 404 }));
		await expect(makeClient(fetchImpl as unknown as typeof fetch).exportTestCases(5)).rejects.toThrow('Belum ada template test case default.');
	});

	it('endpoint template memakai path & method yang benar', async () => {
		const calls: Array<[string, string]> = [];
		const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
			calls.push([String(init.method), url.replace('http://api.local', '')]);
			return new Response(JSON.stringify({ result: [] }), { status: 200 });
		});
		const client = makeClient(fetchImpl as unknown as typeof fetch);
		await client.listTestCaseTemplates(true);
		await client.getDefaultTestCaseTemplate();
		await client.createTestCaseTemplate({ version_label: 'V5', name: 'V5', spreadsheet_url: 'u', column_mapping: {} });
		await client.updateTestCaseTemplate(2, { name: 'x' });
		await client.setDefaultTestCaseTemplate(2);
		await client.deactivateTestCaseTemplate(2);
		expect(calls).toEqual([
			['GET', '/test-case-templates?include_inactive=true'],
			['GET', '/test-case-templates/default'],
			['POST', '/test-case-templates'],
			['PUT', '/test-case-templates/2'],
			['PATCH', '/test-case-templates/2/default'],
			['PATCH', '/test-case-templates/2/deactivate']
		]);
	});
});

describe('recording apiClient run (re-run)', () => {
	const json = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200, headers: { 'Content-Type': 'application/json' } });

	it('createRun dan listRuns memanggil endpoint run sesi', async () => {
		const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
		const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
			return json(init?.method === 'GET' ? [{ run_number: 1 }] : { run_number: 2 });
		});
		const client = new RecordingApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: fetchImpl as unknown as typeof fetch });

		const run = await client.createRun(5, { result: 'FAIL', executed_steps: 2 });
		const runs = await client.listRuns(5);

		expect(run.run_number).toBe(2);
		expect(runs).toEqual([{ run_number: 1 }]);
		expect(calls).toEqual([
			{ url: 'http://api/sessions/5/runs', method: 'POST', body: { result: 'FAIL', executed_steps: 2 } },
			{ url: 'http://api/sessions/5/runs', method: 'GET', body: undefined }
		]);
	});

	it('uploadRunVideo: presign run → PUT → complete run', async () => {
		const calls: string[] = [];
		const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push(`${init?.method} ${url}`);
			if (url.endsWith('/presign-upload')) return json({ upload_url: 'http://minio/b/k.webm', object_key: 'sessions/5/video/u/k.webm' });
			if (url.startsWith('http://minio')) return new Response(null, { status: 200 });
			return json({ run_number: 2, video_url: 'http://minio/b/k.webm' });
		});
		const client = new RecordingApiClient({ baseUrl: 'http://api', getToken: async () => 't', fetchImpl: fetchImpl as unknown as typeof fetch });

		const run = await client.uploadRunVideo(5, 2, new Blob(['v'], { type: 'video/webm' }));

		expect(run.video_url).toBe('http://minio/b/k.webm');
		expect(calls).toEqual([
			'POST http://api/sessions/5/runs/2/video/presign-upload',
			'PUT http://minio/b/k.webm',
			'POST http://api/sessions/5/runs/2/video/complete'
		]);
	});
});
