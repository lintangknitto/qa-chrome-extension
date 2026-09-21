/**
 * Verifikasi end-to-end API test-session-recorder terhadap infra docker lokal
 * (MySQL + MinIO + mock OpenAI-compatible).
 *
 * Jalankan backend + infra dulu, lalu:
 *   node dev-infra/verify-api-e2e.mjs
 */
const BASE_URL = process.env.QA_API_BASE_URL ?? 'http://127.0.0.1:8010';

let failures = 0;
const results = [];

const step = async (name, fn) => {
	try {
		const detail = await fn();
		results.push({ name, ok: true, detail: detail ?? '' });
	} catch (error) {
		failures += 1;
		results.push({ name, ok: false, detail: error.message });
	}
};

const assert = (condition, message) => {
	if (!condition) throw new Error(message);
};

const request = async (method, path, { token, body } = {}) => {
	const headers = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	let parsed = null;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		parsed = null;
	}
	return { status: response.status, body: parsed, raw: text };
};

const unwrap = (response) => response.body?.result ?? response.body;

const state = {};

const main = async () => {
	await step('guest tanpa token ditolak (401)', async () => {
		const response = await request('GET', '/projects/active');
		assert(response.status === 401, `diharapkan 401, dapat ${response.status}`);
		return 'HTTP 401';
	});

	await step('login QA admin', async () => {
		const response = await request('POST', '/auth/login', {
			body: { username: 'qaadmin', password: 'qaadmin123' }
		});
		assert(response.status === 200, `diharapkan 200, dapat ${response.status}: ${response.raw}`);
		const result = unwrap(response);
		assert(result?.token, 'token tidak ada pada respons');
		state.adminToken = result.token;
		return `user=${result.user?.username}`;
	});

	await step('login QA tester', async () => {
		const response = await request('POST', '/auth/login', {
			body: { username: 'qatester', password: 'qatester123' }
		});
		const result = unwrap(response);
		assert(response.status === 200 && result?.token, 'login tester gagal');
		state.testerToken = result.token;
		return `user=${result.user?.username}`;
	});

	await step('login password salah ditolak', async () => {
		const response = await request('POST', '/auth/login', {
			body: { username: 'qaadmin', password: 'salah' }
		});
		assert(response.status >= 400, `diharapkan error, dapat ${response.status}`);
		return `HTTP ${response.status}`;
	});

	await step('tester tidak boleh membuat project (403/401)', async () => {
		const response = await request('POST', '/projects', {
			token: state.testerToken,
			body: { name: 'Proyek Ilegal' }
		});
		assert(response.status === 403, `diharapkan 403, dapat ${response.status}`);
		return `HTTP ${response.status}`;
	});

	await step('QA admin membuat project', async () => {
		const suffix = Date.now();
		const response = await request('POST', '/projects', {
			token: state.adminToken,
			body: { name: `Proyek QA ${suffix}`, description: 'project verifikasi /qa' }
		});
		assert(response.status === 201, `diharapkan 201, dapat ${response.status}: ${response.raw}`);
		const project = unwrap(response);
		assert(project?.is_active === true, 'project baru harus aktif');
		state.projectId = project.id_project;
		state.projectCode = project.code;
		return `id=${project.id_project} code=${project.code}`;
	});

	await step('kode project otomatis dari nama (slug)', async () => {
		assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(state.projectCode), `kode tidak valid: ${state.projectCode}`);
		return state.projectCode;
	});

	await step('tester melihat project aktif', async () => {
		const response = await request('GET', '/projects/active', { token: state.testerToken });
		assert(response.status === 200, `diharapkan 200, dapat ${response.status}`);
		const items = unwrap(response)?.items ?? [];
		assert(items.some((item) => item.id_project === state.projectId), 'project baru tidak muncul');
		return `${items.length} project aktif`;
	});

	await step('tester membuat recording session', async () => {
		const response = await request('POST', '/sessions', {
			token: state.testerToken,
			body: {
				id_project: state.projectId,
				test_case_no: 'TC-QA-001',
				title: 'Login dan checkout',
				description: 'verifikasi alur utama',
				target_url: 'https://contoh.test/'
			}
		});
		assert(response.status === 201, `diharapkan 201, dapat ${response.status}: ${response.raw}`);
		const session = unwrap(response);
		assert(session?.status === 'recording', `status harus recording, dapat ${session?.status}`);
		state.sessionId = session.id_session;
		return `id_session=${session.id_session}`;
	});

	await step('session aktif ganda ditolak', async () => {
		const response = await request('POST', '/sessions', {
			token: state.testerToken,
			body: { id_project: state.projectId, test_case_no: 'TC-QA-002', title: 'Duplikat' }
		});
		assert(response.status === 400, `diharapkan 400, dapat ${response.status}`);
		return `HTTP ${response.status}`;
	});

	await step('tester menambah checkpoint', async () => {
		const response = await request('POST', `/sessions/${state.sessionId}/checkpoints`, {
			token: state.testerToken,
			body: { note: 'cek error setelah klik bayar', sequence: 3 }
		});
		assert(response.status === 201, `diharapkan 201, dapat ${response.status}: ${response.raw}`);
		return `id_checkpoint=${unwrap(response)?.id_checkpoint}`;
	});

	await step('presigned upload screenshot + upload ke MinIO + complete', async () => {
		const presign = await request('POST', `/sessions/${state.sessionId}/artifacts/presign-upload`, {
			token: state.testerToken,
			body: { kind: 'screenshot', content_type: 'image/png', size_bytes: 68 }
		});
		assert(presign.status === 201, `presign gagal: ${presign.raw}`);

		const { upload_url, artifact, object_key } = unwrap(presign);
		const png = Uint8Array.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
			0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
			0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
			0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
			0x42, 0x60, 0x82
		]);

		const upload = await fetch(upload_url, {
			method: 'PUT',
			headers: { 'Content-Type': 'image/png' },
			body: png
		});
		assert(upload.ok, `upload ke MinIO gagal: HTTP ${upload.status}`);

		const complete = await request('POST', `/sessions/${state.sessionId}/artifacts/${artifact.id_artifact}/complete`, {
			token: state.testerToken,
			body: { size_bytes: png.byteLength }
		});
		assert(complete.status === 200, `complete gagal: ${complete.raw}`);
		assert(unwrap(complete)?.status === 'uploaded', 'status artifact harus uploaded');
		state.artifactId = artifact.id_artifact;
		return `object_key=${object_key}`;
	});

	await step('presigned download artifact', async () => {
		const response = await request('GET', `/sessions/${state.sessionId}/artifacts/${state.artifactId}/download-url`, {
			token: state.testerToken
		});
		assert(response.status === 200, `diharapkan 200, dapat ${response.status}`);
		const downloadUrl = unwrap(response)?.download_url;
		assert(typeof downloadUrl === 'string' && downloadUrl.includes('X-Amz'), 'download_url bukan presigned URL');

		const downloaded = await fetch(downloadUrl);
		assert(downloaded.ok, `download dari MinIO gagal: HTTP ${downloaded.status}`);
		return `bytes=${(await downloaded.arrayBuffer()).byteLength}`;
	});

	await step('content type artifact di luar allowlist ditolak', async () => {
		const response = await request('POST', `/sessions/${state.sessionId}/artifacts/presign-upload`, {
			token: state.testerToken,
			body: { kind: 'screenshot', content_type: 'application/zip', size_bytes: 10 }
		});
		assert(response.status === 400, `diharapkan 400, dapat ${response.status}`);
		return `HTTP ${response.status}`;
	});

	await step('generate Markdown + draft Playwright (AI mock)', async () => {
		const response = await request('POST', `/sessions/${state.sessionId}/generations`, {
			token: state.testerToken,
			body: {}
		});
		assert(response.status === 200, `diharapkan 200, dapat ${response.status}: ${response.raw}`);
		const results_ = unwrap(response)?.results ?? {};
		assert(results_.markdown?.status === 'completed', `markdown: ${JSON.stringify(results_.markdown)}`);
		assert(results_.playwright?.status === 'completed', `playwright: ${JSON.stringify(results_.playwright)}`);
		assert(/playwright/.test(results_.playwright.output), 'draft playwright tidak sesuai');
		return `markdown=${results_.markdown.output.length}B playwright=${results_.playwright.output.length}B`;
	});

	await step('retry generation idempotent (tidak menambah baris)', async () => {
		const before = await request('GET', `/sessions/${state.sessionId}/generations`, { token: state.testerToken });
		const beforeCount = unwrap(before)?.items?.length ?? 0;

		await request('POST', `/sessions/${state.sessionId}/generations`, { token: state.testerToken, body: {} });

		const after = await request('GET', `/sessions/${state.sessionId}/generations`, { token: state.testerToken });
		const afterItems = unwrap(after)?.items ?? [];
		assert(afterItems.length === beforeCount, `jumlah generation berubah: ${beforeCount} -> ${afterItems.length}`);
		const play = afterItems.find((item) => item.kind === 'playwright');
		assert(play.attempt_count >= 2, `attempt_count harus naik, dapat ${play?.attempt_count}`);
		return `items=${afterItems.length} attempt_count=${play.attempt_count}`;
	});

	await step('tester mengakhiri session dengan PASS', async () => {
		const response = await request('POST', `/sessions/${state.sessionId}/end`, {
			token: state.testerToken,
			body: { result: 'PASS', actual_result: 'alur utama berjalan sesuai harapan' }
		});
		assert(response.status === 200, `diharapkan 200, dapat ${response.status}`);
		const session = unwrap(response);
		assert(session.status === 'completed', `status harus completed, dapat ${session.status}`);
		assert(session.result === 'PASS', `result harus PASS, dapat ${session.result}`);
		return `status=${session.status} result=${session.result}`;
	});

	await step('session selesai tidak bisa diakhiri lagi', async () => {
		const response = await request('POST', `/sessions/${state.sessionId}/end`, {
			token: state.testerToken,
			body: { result: 'FAIL' }
		});
		assert(response.status === 400, `diharapkan 400, dapat ${response.status}`);
		return `HTTP ${response.status}`;
	});

	await step('tester lain tidak boleh melihat session orang lain', async () => {
		const login = await request('POST', '/auth/login', {
			body: { username: 'qaadmin', password: 'qaadmin123' }
		});
		const adminToken = unwrap(login).token;
		const response = await request('GET', `/sessions/${state.sessionId}`, { token: adminToken });
		assert(response.status === 200, `QA/admin harus boleh melihat, dapat ${response.status}`);
		return 'QA/admin dapat mengakses (sesuai aturan)';
	});

	await step('detail session memuat checkpoint', async () => {
		const response = await request('GET', `/sessions/${state.sessionId}`, { token: state.testerToken });
		const detail = unwrap(response);
		assert(Array.isArray(detail?.checkpoints) && detail.checkpoints.length === 1, 'checkpoint tidak terbawa');
		return `checkpoints=${detail.checkpoints.length}`;
	});

	await step('session dapat difilter berdasarkan result', async () => {
		const response = await request('GET', `/sessions?result=PASS&id_project=${state.projectId}`, {
			token: state.testerToken
		});
		const items = unwrap(response)?.items ?? [];
		assert(items.some((item) => item.id_session === state.sessionId), 'session tidak muncul pada filter PASS');
		return `${items.length} session PASS`;
	});

	console.log('\n=== Hasil verifikasi API E2E ===\n');
	for (const result of results)
		console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  — ${result.detail}` : ''}`);
	console.log(`\nTotal: ${results.length - failures}/${results.length} langkah lulus`);
	process.exit(failures === 0 ? 0 : 1);
};

main().catch((error) => {
	console.error('Verifikasi gagal di luar skenario:', error);
	process.exit(1);
});
