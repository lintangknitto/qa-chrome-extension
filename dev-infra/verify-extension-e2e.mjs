/**
 * Verifikasi end-to-end FLOW EXTENSION di browser Chromium nyata untuk fitur
 * Test Session Recorder.
 *
 * Yang diuji (lihat docs/prd/todo/test-session-recorder/TEST-CASE-MATRIX.md):
 *  - Login Side Panel (UI nyata) + penyimpanan token.
 *  - Start/End recording lewat UI, pembuatan & rekonsiliasi Chrome Tab Group.
 *  - CDP capture: action/locator, console, exception, network.
 *  - Upload screenshot lewat presigned URL MinIO (tanpa credential MinIO di extension).
 *  - Checkpoint dari Side Panel.
 *  - Redaksi nilai password dari jalur extension (DB + output AI).
 *
 * Prasyarat infra (jangan bongkar container):
 *  - MySQL 127.0.0.1:3307 (qa_recorder), MinIO 127.0.0.1:9000, mock OpenAI 127.0.0.1:8090.
 *  - Backend `pnpm dev` di http://127.0.0.1:8010.
 *  - Extension sudah di-build: packages/extension/dist.
 *  - playwright-core terpasang di dev-infra (npm install --prefix dev-infra).
 *
 * Jalankan:
 *   node dev-infra/verify-extension-e2e.mjs
 *
 * Exit code non-nol jika ada langkah yang gagal.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try {
	({ chromium } = require('playwright-core'));
} catch (error) {
	console.error(
		'playwright-core tidak ditemukan. Jalankan dulu:\n' +
			'  npm install --prefix dev-infra\n' +
			`Detail: ${error.message}`
	);
	process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIST = resolve(__dirname, '../packages/extension/dist');
const FIXTURE_DIR = join(__dirname, 'e2e-fixtures');
const API_BASE_URL = process.env.QA_API_BASE_URL ?? 'http://127.0.0.1:8010';
const MYSQL_CONTAINER = 'qa-recorder-infra-mysql-1';
const MINIO_CONTAINER = 'qa-recorder-infra-minio-1';
const TEST_PORT = Number(process.env.QA_E2E_PORT ?? 8123);
const INDEX_URL = `http://127.0.0.1:${TEST_PORT}/index.html`;
const SECOND_URL = `http://127.0.0.1:${TEST_PORT}/second.html`;

const RUN = Date.now().toString(36);
const SECRETS = {
	password: `P@ssw0rd-Ext-${RUN}`,
	nonSensitive: 'Nama Tester E2E',
	privateLog: `PRIVATE_LOG_${RUN}`,
	joinedLog: `JOINED_LOG_${RUN}`,
	leftLog: `LEFT_LOG_${RUN}`
};

const PROJECT_NAME = `Proyek E2E Extension ${RUN}`;
const TEST_CASE_NO = `TC-EXT-${RUN}`;
const TEST_TITLE = `E2E extension recording ${RUN}`;

// PNG 1x1 untuk route /api/image (binary -> metadata-only).
const PNG_BYTES = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82
]);

let failures = 0;
const results = [];
let currentStep = '';
const step = async (name, fn) => {
	currentStep = name;
	try {
		const detail = await fn();
		results.push({ name, ok: true, detail: detail ?? '' });
		console.log(`PASS  ${name}${detail ? `  - ${detail}` : ''}`);
	} catch (error) {
		failures += 1;
		results.push({ name, ok: false, detail: error.message });
		console.log(`FAIL  ${name}  - ${error.message}`);
	}
};
const assert = (condition, message) => {
	if (!condition) throw new Error(message);
	return true;
};
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const eventually = async (fn, { timeout = 20000, interval = 500, label = 'kondisi' } = {}) => {
	const started = Date.now();
	let lastError;
	while (Date.now() - started < timeout) {
		try {
			const value = await fn();
			if (value) return value;
		} catch (error) {
			lastError = error;
		}
		await sleep(interval);
	}
	throw new Error(`timeout menunggu ${label}${lastError ? `: ${lastError.message}` : ''}`);
};

// ---------------------------------------------------------------------------
// API backend
// ---------------------------------------------------------------------------
const apiRequest = async (method, path, { token, body } = {}) => {
	const headers = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (token) headers.Authorization = `Bearer ${token}`;
	const response = await fetch(`${API_BASE_URL}${path}`, {
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
	return { status: response.status, result: parsed?.result ?? parsed, raw: text };
};

const loginApi = async (username, password) => {
	const response = await apiRequest('POST', '/auth/login', { body: { username, password } });
	if (!response.result?.token) throw new Error(`login API ${username} gagal: ${response.raw}`);
	return response.result;
};

// ---------------------------------------------------------------------------
// MySQL lewat container
// ---------------------------------------------------------------------------
const queryDb = (sql) => {
	const output = execSync(
		`docker exec -i ${MYSQL_CONTAINER} mysql -uroot -pqa_root_password -N -e ${JSON.stringify(sql)}`,
		{ encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
	);
	return output.trim();
};
const numberQuery = (sql) => Number(queryDb(sql) || '0');

const countContaining = (sessionId, value) => {
	const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	return numberQuery(
		`SELECT COUNT(*) FROM qa_recorder.qa_recording_event ` +
			`WHERE id_session=${sessionId} AND LOCATE('${escaped}', CONCAT(COALESCE(url,''), COALESCE(payload,''))) > 0`
	);
};

// ---------------------------------------------------------------------------
// Fixture server
// ---------------------------------------------------------------------------
const startFixtureServer = () =>
	new Promise((resolvePromise) => {
		const server = createServer((req, res) => {
			const path = new URL(req.url, `http://127.0.0.1:${TEST_PORT}`).pathname;
			if (path === '/api/echo' && req.method === 'POST') {
				let body = '';
				req.on('data', (chunk) => (body += chunk));
				req.on('end', () => {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ ok: true, note: 'E2E network', received: body.slice(0, 200) }));
				});
				return;
			}
			if (path === '/api/image') {
				res.writeHead(200, { 'Content-Type': 'image/png' });
				res.end(Buffer.from(PNG_BYTES));
				return;
			}
			const file = path === '/' ? 'index.html' : path.replace(/^\//, '');
			const full = join(FIXTURE_DIR, file);
			if (existsSync(full)) {
				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(readFileSync(full));
				return;
			}
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('not found');
		});
		server.listen(TEST_PORT, '127.0.0.1', () => resolvePromise(server));
	});

// ---------------------------------------------------------------------------
// Chromium executable
// ---------------------------------------------------------------------------
const findChromiumExecutable = () => {
	const cacheRoot = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : null;
	if (cacheRoot && existsSync(cacheRoot)) {
		const candidates = readdirSync(cacheRoot)
			.filter((entry) => /^chromium-\d+$/.test(entry))
			.map((entry) => ({ entry, revision: Number(entry.split('-')[1]) }))
			.sort((a, b) => b.revision - a.revision);
		for (const { entry } of candidates) {
			const executable = join(cacheRoot, entry, 'chrome-win64', 'chrome.exe');
			if (existsSync(executable)) return executable;
		}
	}
	const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
	return existsSync(systemChrome) ? systemChrome : null;
};

// ---------------------------------------------------------------------------
// Helpers Chrome extension di page Side Panel
// ---------------------------------------------------------------------------
const storageGetAll = (page) =>
	page.evaluate(() => new Promise((resolvePromise) => chrome.storage.local.get(null, resolvePromise)));

const chromeTabsQuery = (page, queryInfo = {}) =>
	page.evaluate((query) => new Promise((resolvePromise) => chrome.tabs.query(query, resolvePromise)), queryInfo);

const chromeGroupsQuery = (page) =>
	page.evaluate(() => new Promise((resolvePromise) => chrome.tabGroups.query({}, resolvePromise)));

const fillByLabel = async (page, labelText, value) => {
	const input = page.locator('label.sp-field', { hasText: labelText }).first().locator('input, textarea').first();
	await input.fill(value);
};
const clickButton = async (page, name) => {
	await page.getByRole('button', { name }).first().click();
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
	adminToken: null,
	testerToken: null,
	projectId: null,
	sessionId: null,
	groupId: null,
	testTabId: null,
	privateTabId: null,
	joinedTabId: null,
	artifactIds: []
};

const cleanup = async () => {
	const sessions = [...new Set([...state.sessionIds ?? [], state.sessionId].filter(Boolean))];
	try {
		execSync(`docker exec ${MINIO_CONTAINER} mc alias set local http://127.0.0.1:9000 qa_minio qa_minio_secret`, {
			stdio: 'ignore'
		});
	} catch {}
	for (const sessionId of sessions) {
		try {
			execSync(`docker exec ${MINIO_CONTAINER} mc rm --recursive --force local/qa-recording-artifacts/sessions/${sessionId}`, {
				stdio: 'ignore'
			});
		} catch {}
		queryDb(`DELETE FROM qa_recorder.qa_recording_generation WHERE id_session=${sessionId}`);
		queryDb(`DELETE FROM qa_recorder.qa_recording_checkpoint WHERE id_session=${sessionId}`);
		queryDb(`DELETE FROM qa_recorder.qa_recording_event WHERE id_session=${sessionId}`);
		queryDb(`DELETE FROM qa_recorder.qa_recording_artifact WHERE id_session=${sessionId}`);
		queryDb(`DELETE FROM qa_recorder.qa_recording_session WHERE id_session=${sessionId}`);
	}
	if (state.projectId) queryDb(`DELETE FROM qa_recorder.qa_project WHERE id_project=${state.projectId}`);
};

const main = async () => {
	state.sessionIds = [];
	let server;
	let context;
	let userDataDir;

	await step('Infra: fixture server + Chromium + extension ter-load', async () => {
		const health = await fetch(`${API_BASE_URL}/projects/active`).catch(() => null);
		assert(health && health.status === 401, `backend tidak sehat di ${API_BASE_URL}`);
		assert(existsSync(EXT_DIST), `extension belum di-build: ${EXT_DIST}`);
		server = await startFixtureServer();
		const executablePath = findChromiumExecutable();
		assert(executablePath, 'tidak menemukan executable Chromium/Chrome');
		userDataDir = mkdtempSync(join(tmpdir(), 'qa-ext-e2e-'));
		context = await chromium.launchPersistentContext(userDataDir, {
			headless: false,
			executablePath,
			viewport: { width: 1280, height: 900 },
			args: [
				`--disable-extensions-except=${EXT_DIST}`,
				`--load-extension=${EXT_DIST}`,
				'--no-first-run',
				'--no-default-browser-check'
			]
		});
		return `chromium=${executablePath}`;
	});

	await step('Infra: siapkan project + token tester', async () => {
		const admin = await loginApi('qaadmin', 'qaadmin123');
		state.adminToken = admin.token;
		const created = await apiRequest('POST', '/projects', {
			token: state.adminToken,
			body: { name: PROJECT_NAME, description: 'project harness E2E extension' }
		});
		assert(created.status === 201, `gagal membuat project: ${created.raw}`);
		state.projectId = created.result.id_project;

		const tester = await loginApi('qatester', 'qatester123');
		state.testerToken = tester.token;

		// Cegah session aktif ganda milik tester (sisa run sebelumnya).
		const active = await apiRequest('GET', '/sessions?status=recording', { token: state.testerToken });
		for (const session of active.result?.items ?? []) {
			await apiRequest('POST', `/sessions/${session.id_session}/end`, {
				token: state.testerToken,
				body: { result: 'BLOCKED', actual_result: 'dibersihkan harness E2E extension' }
			});
		}
		return `id_project=${state.projectId}`;
	});

	// Extension id + panel page
	let sw;
	await step('Infra: ambil extension id dari service worker dan buka Side Panel', async () => {
		sw = context.serviceWorkers()[0];
		if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20000 });
		const extensionId = new URL(sw.url()).host;
		state.extensionId = extensionId;
		state.panel = await context.newPage();
		await state.panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
		await state.panel.waitForSelector('.sp-title');
		return `extensionId=${extensionId}`;
	});

	// -------------------------------------------------------------------------
	// TC1-2 — login negatif
	// -------------------------------------------------------------------------
	await step('TC1-2 login password salah ditolak (UI)', async () => {
		const panel = state.panel;
		await fillByLabel(panel, 'Base URL API', API_BASE_URL);
		await fillByLabel(panel, 'Username', 'qatester');
		await fillByLabel(panel, 'Password', 'salah-sekali');
		await clickButton(panel, 'Login');
		await panel.waitForSelector('.sp-error', { timeout: 10000 });
		const errorText = (await panel.locator('.sp-error').innerText()).trim();
		const stored = await storageGetAll(panel);
		assert(!stored.qa_recording_token, 'token tersimpan padahal login gagal');
		return `error="${errorText.slice(0, 80)}"`;
	});

	// -------------------------------------------------------------------------
	// TC1-1 — login UI sukses
	// -------------------------------------------------------------------------
	await step('TC1-1 login QA tester lewat UI + token tersimpan', async () => {
		const panel = state.panel;
		await fillByLabel(panel, 'Password', 'qatester123');
		await clickButton(panel, 'Login');
		await panel.waitForSelector('text=Login sebagai', { timeout: 15000 });
		await eventually(
			async () => (await panel.locator('select.sp-select option').count()) > 1,
			{ label: 'daftar project termuat', timeout: 15000 }
		);
		const stored = await storageGetAll(panel);
		assert(stored.qa_recording_token, 'token tidak tersimpan di chrome.storage');
		assert(!JSON.stringify(stored).includes('qatester123'), 'password tersimpan di chrome.storage');
		assert(stored.qa_recording_base_url === API_BASE_URL, `base url tersimpan salah: ${stored.qa_recording_base_url}`);
		return `token=${String(stored.qa_recording_token).slice(0, 12)}...`;
	});

	// -------------------------------------------------------------------------
	// TC2-2 — start negatif
	// -------------------------------------------------------------------------
	await step('TC2-2 recordingStart tanpa tab ditolak', async () => {
		const response = await state.panel.evaluate(() =>
			chrome.runtime.sendMessage({
				type: 'recordingStart',
				idSession: 1,
				apiBaseUrl: 'http://127.0.0.1:8010',
				tabIds: []
			})
		);
		assert(response?.success === false, `seharusnya gagal, dapat ${JSON.stringify(response)}`);
		assert(/tab/i.test(response.error ?? ''), `pesan error tidak jelas: ${response.error}`);
		return response.error;
	});

	// -------------------------------------------------------------------------
	// TC11-2 — tidak ada credential MinIO di extension
	// -------------------------------------------------------------------------
	await step('TC11-2 tidak ada credential MinIO di manifest/bundle/storage', async () => {
		const manifest = readFileSync(join(EXT_DIST, 'manifest.json'), 'utf8');
		const background = readFileSync(join(EXT_DIST, 'lib', 'background.mjs'), 'utf8');
		const storage = JSON.stringify(await storageGetAll(state.panel));
		const material = `${manifest}\n${background}\n${storage}`;
		for (const needle of ['qa_minio_secret', 'qa_minio', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY']) {
			assert(!material.includes(needle), `credential/kunci MinIO bocor: ${needle}`);
		}
		return `storage keys=${Object.keys(await storageGetAll(state.panel)).join(',')}`;
	});

	// -------------------------------------------------------------------------
	// TC13 — Floating button & sidebar (state idle; halaman uji terpisah)
	// -------------------------------------------------------------------------
	await step('TC13-1 FAB + sidebar (root menu) terbuka di halaman uji', async () => {
		const fabPage = await context.newPage();
		state.fabPage = fabPage;
		await fabPage.goto(`${INDEX_URL}?page=fab`);
		await fabPage.locator(`#${'qa-knitto-fab-host'}`).first().waitFor({ state: 'attached', timeout: 10000 });

		const trigger = fabPage.getByRole('button', { name: 'QA Knitto Extension' });
		await trigger.waitFor({ state: 'attached', timeout: 5000 });
		await fabPage.locator('.fab-sidebar[data-open="false"]').first().waitFor({ state: 'attached', timeout: 5000 });

		await trigger.click();
		await fabPage.waitForTimeout(800);
		await fabPage.locator('.fab-sidebar[data-open="true"]').first().waitFor({ state: 'visible', timeout: 5000 });
		await fabPage.locator('.fab-backdrop').first().waitFor({ state: 'visible', timeout: 3000 });
		await fabPage.getByText('Knitto QA Extension').first().waitFor({ state: 'visible', timeout: 3000 });

		// Root menu: Recorder & Setting.
		await fabPage.getByRole('button', { name: 'Recorder' }).first().waitFor({ state: 'visible', timeout: 5000 });
		await fabPage.getByRole('button', { name: 'Setting' }).first().waitFor({ state: 'visible', timeout: 3000 });

		// Root → Recorder (idle) → kembali.
		await fabPage.getByRole('button', { name: 'Recorder' }).first().click();
		await fabPage.getByRole('button', { name: 'Mulai Recording' }).first().waitFor({ state: 'visible', timeout: 5000 });
		await fabPage.getByRole('button', { name: 'Kembali ke menu utama' }).first().click();
		await fabPage.getByRole('button', { name: 'Recorder' }).first().waitFor({ state: 'visible', timeout: 3000 });

		await fabPage.keyboard.press('Escape');
		await fabPage.locator('.fab-sidebar[data-open="false"]').first().waitFor({ state: 'attached', timeout: 5000 });
		return 'root menu (Recorder/Setting) + nav Recorder + kembali + Esc';
	});

	await step('TC13-2 Setting dari root: toggle off/on + ganti sisi', async () => {
		const page = state.fabPage;
		const trigger = page.getByRole('button', { name: 'QA Knitto Extension' });
		await trigger.click();
		await page.waitForTimeout(800);
		await page.getByRole('button', { name: 'Setting' }).first().waitFor({ state: 'visible', timeout: 5000 });
		await page.getByRole('button', { name: 'Setting' }).first().click();
		await page.locator('.fab-setting-group').first().waitFor({ state: 'visible', timeout: 3000 });
		await page.getByRole('button', { name: 'Tampilkan FAB' }).first().waitFor({ state: 'attached', timeout: 3000 });

		// invisible → unmount (storage onChanged di content script)
		await state.panel.evaluate(() =>
			chrome.storage.local.set({ qa_fab_settings: { enabled: false, side: 'right' } })
		);
		await page.locator(`#${'qa-knitto-fab-host'}`).waitFor({ state: 'detached', timeout: 5000 });

		// tampil kembali + sisi kiri
		await state.panel.evaluate(() =>
			chrome.storage.local.set({ qa_fab_settings: { enabled: true, side: 'left' } })
		);
		await page.locator(`#${'qa-knitto-fab-host'}`).first().waitFor({ state: 'attached', timeout: 5000 });
		await page
			.locator('.fab-root[data-side="left"] [aria-label="QA Knitto Extension"]')
			.first()
			.waitFor({ state: 'attached', timeout: 5000 });
		return 'setting dari root: toggle off/on + ganti sisi (storage onChanged)';
	});

	// -------------------------------------------------------------------------
	// TC2-1 / TC9-1 — start via UI + tab group
	// -------------------------------------------------------------------------
	await step('TC2-1 Start Recording via UI + group QA Recording dibuat', async () => {
		const panel = state.panel;
		// Halaman uji utama
		state.testPage = await context.newPage();
		await state.testPage.goto(`${INDEX_URL}?page=main`);
		await state.testPage.waitForSelector('#submit-btn');

		await panel
			.locator('label.sp-field', { hasText: 'Project' })
			.locator('select')
			.selectOption(String(state.projectId));
		await fillByLabel(panel, 'Nomor test case', TEST_CASE_NO);
		await fillByLabel(panel, 'Judul', TEST_TITLE);
		await fillByLabel(panel, 'Deskripsi / tujuan', 'verifikasi flow extension');
		await fillByLabel(panel, 'Target URL', `${INDEX_URL}?page=main`);

		// Buat tab target aktif tanpa mengaktifkan panel, lalu klik Start dari DOM
		// panel langsung agar chrome.tabs.query(active) menunjuk tab halaman uji.
		await state.testPage.bringToFront();
		await panel.locator('button:has-text("Start Recording")').evaluate((button) => button.click());
		await panel.waitForSelector('text=Recording aktif', { timeout: 15000 });

		const stored = await storageGetAll(panel);
		const active = stored.qa_recording_active_session;
		assert(active?.id_session, 'active session tidak tersimpan di storage');
		state.sessionId = active.id_session;
		state.sessionIds.push(active.id_session);
		state.groupId = active.group_id;
		assert(typeof state.groupId === 'number', `groupId tidak diterima: ${state.groupId}`);

		const groups = await chromeGroupsQuery(panel);
		const group = groups.find((item) => item.id === state.groupId);
		assert(group, `group ${state.groupId} tidak ditemukan di chrome.tabGroups`);
		assert(group.title === 'QA Recording', `judul group salah: ${group.title}`);
		return `id_session=${state.sessionId} groupId=${state.groupId} title="${group.title}"`;
	});

	await step('TC9-1 hanya tab target yang ada di group QA Recording', async () => {
		const panel = state.panel;
		const tabs = await chromeTabsQuery(panel, { groupId: state.groupId });
		assert(tabs.length === 1, `group harus berisi 1 tab, dapat ${tabs.length}`);
		assert(/page=main/.test(tabs[0].url ?? ''), `tab group bukan halaman uji: ${tabs[0].url}`);
		state.testTabId = tabs[0].id;
		return `tabs=${tabs.map((tab) => tab.id).join(',')} url=${tabs[0].url}`;
	});

	// -------------------------------------------------------------------------
	// (TC13 FAB/sidebar dipindahkan ke sebelum Start agar dapat diuji pada
	// state idle — lihat blok "TC13" di atas TC2-1)
	// -------------------------------------------------------------------------

	// -------------------------------------------------------------------------
	// TC13-3 — saat recording aktif: buka FAB langsung ke sub-menu Recorder + badge
	// -------------------------------------------------------------------------
	await step('TC13-3 saat recording, FAB buka langsung ke Recorder + badge status', async () => {
		const page = state.fabPage;
		const trigger = page.getByRole('button', { name: 'QA Knitto Extension' });
		await trigger.click();
		await page.waitForTimeout(800);

		// Langsung sub-menu Recorder (root tidak tampil).
		await page.getByRole('button', { name: 'Tambah Checkpoint' }).first().waitFor({ state: 'visible', timeout: 5000 });
		await page.getByRole('button', { name: 'End Recording' }).first().waitFor({ state: 'visible', timeout: 3000 });
		const rootCount = await page.getByRole('button', { name: 'Recorder' }).count();
		assert(rootCount === 0, `root menu masih tampil saat recording (count=${rootCount})`);

		// Badge status recording + counter pending events.
		await page.locator('.fab-rec-dot').first().waitFor({ state: 'attached', timeout: 3000 });

		await page.keyboard.press('Escape');
		await page.locator('.fab-sidebar[data-open="false"]').first().waitFor({ state: 'attached', timeout: 5000 });
		return 'buka langsung Recorder saat recording + badge';
	});

	// -------------------------------------------------------------------------
	// TC5-1 / TC6 / TC7 — interaksi + CDP capture
	// -------------------------------------------------------------------------
	await step('TC5-1 aksi click/fill/password + kandidat locator tersimpan', async () => {
		const page = state.testPage;
		await page.locator('#submit-btn').click();
		await page.locator('#fullname').fill(SECRETS.nonSensitive);
		await page.locator('#fullname').press('Tab');
		await page.locator('#password').fill(SECRETS.password);
		await page.locator('#password').press('Tab');

		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(*) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='action' AND payload LIKE '%submit-btn%'`
				) > 0,
			{ label: 'event action click tersimpan' }
		);
		const clickPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='action' AND payload LIKE '%submit-btn%' LIMIT 1`
		);
		assert(/locators/i.test(clickPayload), 'kandidat locator tidak ada pada payload action');
		return 'action click + locators tersimpan';
	});

	await step('TC6-1 console log/warn/error semua level tersimpan', async () => {
		const page = state.testPage;
		await page.evaluate(() => {
			window.__e2e.log();
			window.__e2e.warn();
			window.__e2e.error();
		});
		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(DISTINCT payload) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='console'`
				) >= 3,
			{ label: 'event console tersimpan (min 3 level)' }
		);
		const levels = queryDb(
			`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.level')) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='console'`
		)
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		assert(levels.includes('log'), `level log tidak ada: ${levels.join(',')}`);
		assert(levels.includes('error'), `level error tidak ada: ${levels.join(',')}`);
		assert(levels.some((level) => level === 'warning' || level === 'warn'), `level warn tidak ada: ${levels.join(',')}`);
		return `levels=${[...new Set(levels)].join(',')}`;
	});

	await step('TC6-2 uncaught exception + source location tersimpan', async () => {
		await state.testPage.evaluate(() => window.__e2e.boom());
		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(*) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='exception' AND payload LIKE '%E2E uncaught 7b2c%'`
				) > 0,
			{ label: 'event exception tersimpan' }
		);
		const exceptionPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='exception' LIMIT 1`
		);
		assert(/line/i.test(exceptionPayload), 'source location (line) tidak ada pada exception');
		return 'exception + line/column tersimpan';
	});

	await step('TC7-1 network text/json: method, status, request body tersimpan', async () => {
		await state.testPage.evaluate(() => window.__e2e.echo());
		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(*) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='network' AND url LIKE '%/api/echo%'`
				) > 0,
			{ label: 'event network /api/echo tersimpan' }
		);
		const networkPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='network' AND url LIKE '%/api/echo%' LIMIT 1`
		);
		assert(/"status":\s*200/.test(networkPayload), `status 200 tidak tersimpan: ${networkPayload.slice(0, 200)}`);
		assert(/E2E network/.test(networkPayload), 'request body tidak tersimpan');
		return 'network echo status=200 + request body';
	});

	await step('TC7-2 network binary hanya metadata (body tidak disimpan)', async () => {
		await state.testPage.evaluate(() => window.__e2e.image());
		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(*) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='network' AND url LIKE '%/api/image%'`
				) > 0,
			{ label: 'event network /api/image tersimpan' }
		);
		const networkPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='network' AND url LIKE '%/api/image%' LIMIT 1`
		);
		assert(/"body_stored":\s*false/.test(networkPayload), `body binary seharusnya tidak disimpan: ${networkPayload.slice(0, 200)}`);
		return 'image/png body_stored=false';
	});

	// -------------------------------------------------------------------------
	// TC3-1 — checkpoint dari UI
	// -------------------------------------------------------------------------
	await step('TC3-1 Add Checkpoint dari Side Panel tersimpan ke MySQL', async () => {
		const panel = state.panel;
		await panel.bringToFront();
		await fillByLabel(panel, 'Catatan / checkpoint', 'cek error setelah submit');
		await clickButton(panel, 'Add Checkpoint');
		await panel.waitForSelector('text=Checkpoint tersimpan.', { timeout: 10000 });
		const count = numberQuery(
			`SELECT COUNT(*) FROM qa_recorder.qa_recording_checkpoint WHERE id_session=${state.sessionId} AND note='cek error setelah submit'`
		);
		assert(count === 1, `checkpoint tidak tersimpan di MySQL (count=${count})`);
		return 'checkpoint note tersimpan';
	});

	// -------------------------------------------------------------------------
	// TC8-1 / TC11-1 — screenshot + presigned MinIO
	// -------------------------------------------------------------------------
	await step('TC8-1 screenshot setelah aksi tercatat sebagai artifact uploaded', async () => {
		await eventually(
			() =>
				numberQuery(
					`SELECT COUNT(*) FROM qa_recorder.qa_recording_artifact WHERE id_session=${state.sessionId} AND kind='screenshot' AND status='uploaded'`
				) > 0,
			{ label: 'artifact screenshot uploaded', timeout: 25000 }
		);
		const rows = queryDb(
			`SELECT id_artifact, object_key, size_bytes FROM qa_recorder.qa_recording_artifact WHERE id_session=${state.sessionId} AND kind='screenshot' ORDER BY id_artifact`
		)
			.split('\n')
			.filter(Boolean)
			.map((line) => line.split('\t'));
		state.artifactIds = rows.map((row) => row[0]);
		const [first] = rows;
		assert(/^sessions\/\d+\/screenshot\/.+\.png$/.test(first[1]), `object_key tidak sesuai: ${first[1]}`);
		assert(Number(first[2]) > 0, 'size_bytes screenshot 0');
		return `${rows.length} artifact, contoh key=${first[1]}`;
	});

	await step('TC11-1 presigned download artifact terverifikasi dari MinIO', async () => {
		const response = await apiRequest(
			'GET',
			`/sessions/${state.sessionId}/artifacts/${state.artifactIds[0]}/download-url`,
			{ token: state.testerToken }
		);
		assert(response.status === 200, `download-url gagal: ${response.raw}`);
		const downloadUrl = response.result?.download_url;
		assert(downloadUrl && downloadUrl.includes('X-Amz'), 'bukan presigned URL');
		const downloaded = await fetch(downloadUrl);
		assert(downloaded.ok, `download object MinIO gagal: HTTP ${downloaded.status}`);
		const bytes = (await downloaded.arrayBuffer()).byteLength;
		assert(bytes > 0, 'object MinIO kosong');
		return `bytes=${bytes}`;
	});

	// -------------------------------------------------------------------------
	// TC9-2 / TC10 — batas tab group
	// -------------------------------------------------------------------------
	await step('TC9-2 tab di luar group TIDAK direkam', async () => {
		const panel = state.panel;
		const privatePage = await context.newPage();
		await privatePage.goto(`${INDEX_URL}?page=private`);
		await privatePage.waitForSelector('#submit-btn');
		const tabs = await chromeTabsQuery(panel, {});
		const privateTab = tabs.find((tab) => /page=private/.test(tab.url ?? ''));
		assert(privateTab, 'tab private tidak ditemukan');
		state.privateTabId = privateTab.id;
		assert(privateTab.groupId === -1, `tab private seharusnya di luar group, groupId=${privateTab.groupId}`);

		await privatePage.evaluate((text) => console.log(text), SECRETS.privateLog);
		await privatePage.locator('#submit-btn').click();
		await sleep(5000);

		assert(countContaining(state.sessionId, SECRETS.privateLog) === 0, 'log tab di luar group bocor ke rekaman');
		const eventsFromPrivate = numberQuery(
			`SELECT COUNT(*) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND tab_id=${state.privateTabId}`
		);
		assert(eventsFromPrivate === 0, `ada ${eventsFromPrivate} event dari tab di luar group`);
		state.privatePage = privatePage;
		return 'tidak ada event dari tab private';
	});

	await step('TC10-1 tab yang digeser MASUK group mulai direkam', async () => {
		const panel = state.panel;
		const joinedPage = await context.newPage();
		await joinedPage.goto(`${INDEX_URL}?page=joined`);
		await joinedPage.waitForSelector('#submit-btn');
		const tabs = await chromeTabsQuery(panel, {});
		const joinedTab = tabs.find((tab) => /page=joined/.test(tab.url ?? ''));
		assert(joinedTab, 'tab joined tidak ditemukan');
		state.joinedTabId = joinedTab.id;

		await panel.evaluate(
			async ({ tabId, groupId }) => {
				await chrome.tabs.group({ groupId, tabIds: [tabId] });
			},
			{ tabId: joinedTab.id, groupId: state.groupId }
		);
		// Beri waktu rekonsiliasi group (tabs.onUpdated -> attach debugger).
		await sleep(2500);
		await joinedPage.evaluate((text) => console.log(text), SECRETS.joinedLog);
		await eventually(() => countContaining(state.sessionId, SECRETS.joinedLog) > 0, {
			label: 'event dari tab yang digeser masuk group'
		});
		state.joinedPage = joinedPage;
		return 'JOINED_LOG tersimpan setelah masuk group';
	});

	await step('TC10-2 tab yang KELUAR group berhenti direkam', async () => {
		const panel = state.panel;
		await panel.evaluate(async (tabId) => {
			await chrome.tabs.ungroup([tabId]);
		}, state.joinedTabId);
		await sleep(2500);
		await state.joinedPage.evaluate((text) => console.log(text), SECRETS.leftLog);
		await sleep(5000);
		assert(countContaining(state.sessionId, SECRETS.leftLog) === 0, 'log setelah keluar group tetap terekam');
		return 'LEFT_LOG tidak terekam';
	});

	// -------------------------------------------------------------------------
	// TC5-2 — navigation
	// -------------------------------------------------------------------------
	await step('TC5-2 navigasi tercatat sebagai action navigation', async () => {
		await state.testPage.locator('#navigate-link').click();
		await state.testPage.waitForURL('**/second.html');
		await eventually(() => countContaining(state.sessionId, 'second.html') > 0, {
			label: 'event navigation ke second.html'
		});
		const navigationPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='action' AND payload LIKE '%navigation%' AND payload LIKE '%second.html%' LIMIT 1`
		);
		assert(navigationPayload, 'payload navigation tidak ada');
		return 'action navigation + url second.html';
	});

	// -------------------------------------------------------------------------
	// TC12-1 / TC12-2 — redaksi di DB
	// -------------------------------------------------------------------------
	await step('TC12-1 nilai password TIDAK tersimpan di MySQL', async () => {
		const leaked = countContaining(state.sessionId, SECRETS.password);
		assert(leaked === 0, `password bocor di ${leaked} event`);
		// Ambil semua kandidat action yang menyebut password (termasuk keydown),
		// lalu pastikan setidaknya satu event change menandai `value_redacted: true`.
		const passwordActionPayloads = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='action' AND payload LIKE '%password%'`
		)
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		assert(
			passwordActionPayloads.some((payload) => /"value_redacted":\s*true/.test(payload)),
			'value_redacted tidak true pada event password'
		);
		return 'password tidak tersimpan + value_redacted=true';
	});

	await step('TC12-2 nilai field non-sensitif tetap tersimpan', async () => {
		const stored = countContaining(state.sessionId, SECRETS.nonSensitive);
		assert(stored > 0, 'nilai field non-sensitif hilang dari event');
		return 'fullname tersimpan';
	});

	// -------------------------------------------------------------------------
	// TC4-1 — End via UI + generate
	// -------------------------------------------------------------------------
	await step('TC4-1 End Recording via UI (PASS) + session completed', async () => {
		const panel = state.panel;
		await panel.bringToFront();
		await clickButton(panel, 'End Recording');
		await panel.locator('label.sp-field', { hasText: 'Hasil' }).locator('select').selectOption('PASS');
		await fillByLabel(panel, 'Actual result', 'alur extension berjalan sesuai harapan');
		await clickButton(panel, 'Konfirmasi End');
		await panel.waitForSelector('text=Session selesai', { timeout: 15000 });

		const detail = await apiRequest('GET', `/sessions/${state.sessionId}`, { token: state.testerToken });
		assert(detail.result?.status === 'completed', `status session bukan completed: ${detail.result?.status}`);
		assert(detail.result?.result === 'PASS', `result bukan PASS: ${detail.result?.result}`);
		const stored = await storageGetAll(panel);
		assert(!stored.qa_recording_active_session, 'active session tidak dibersihkan setelah End');
		return `status=completed result=PASS`;
	});

	await step('TC4-1 generate Markdown + draft Playwright dari UI', async () => {
		const panel = state.panel;
		const row = panel.locator('.sp-list-item', { hasText: TEST_TITLE }).first();
		await row.getByRole('button', { name: 'generate' }).click();
		await eventually(async () => (await panel.locator('.sp-pre').count()) > 0, {
			label: 'hasil generation tampil di panel',
			timeout: 20000
		});
		const badges = (await panel.locator('.sp-badge').allInnerTexts()).map((text) => text.trim());
		assert(badges.includes('markdown'), `badge markdown tidak ada: ${badges.join(',')}`);
		assert(badges.includes('playwright'), `badge playwright tidak ada: ${badges.join(',')}`);
		const generations = await apiRequest('GET', `/sessions/${state.sessionId}/generations`, { token: state.testerToken });
		const items = generations.result?.items ?? [];
		const markdown = items.find((item) => item.kind === 'markdown');
		const playwright = items.find((item) => item.kind === 'playwright');
		assert(markdown?.status === 'completed', `markdown status: ${markdown?.status}`);
		assert(playwright?.status === 'completed', `playwright status: ${playwright?.status}`);
		return `markdown=${markdown.output.length}B playwright=${playwright.output.length}B`;
	});

	// -------------------------------------------------------------------------
	// TC12-3 — redaksi di output AI
	// -------------------------------------------------------------------------
	await step('TC12-3 password tidak muncul di output AI', async () => {
		const dump = queryDb(
			`SELECT CONCAT(COALESCE(kind,''),' ',COALESCE(output,'')) FROM qa_recorder.qa_recording_generation WHERE id_session=${state.sessionId}`
		);
		assert(!dump.includes(SECRETS.password), 'password bocor ke output AI');
		return 'output AI bersih dari password';
	});

	// cleanup
	await step('Cleanup: hapus data test di MySQL + MinIO', async () => {
		await context.close().catch(() => {});
		await cleanup();
		return `sessions=${state.sessionIds.join(',')} project=${state.projectId}`;
	});

	server?.close();
	rmSync(userDataDir, { recursive: true, force: true });

	console.log('\n=== Hasil verifikasi E2E flow extension ===\n');
	console.log(`Total: ${results.length - failures}/${results.length} langkah lulus`);
	if (failures > 0) {
		console.log('\nLangkah gagal:');
		for (const result of results.filter((item) => !item.ok)) console.log(`- ${result.name}: ${result.detail}`);
	}
	process.exit(failures === 0 ? 0 : 1);
};

main().catch(async (error) => {
	console.error(`\nVerifikasi gagal di luar skenario [${currentStep}]:`, error);
	await cleanup().catch(() => {});
	process.exit(1);
});
