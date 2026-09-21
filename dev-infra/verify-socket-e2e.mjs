/**
 * Verifikasi end-to-end Socket.IO ingestion + redaksi.
 *
 * Menyambung sebagai QA tester, join session, mengirim batch event yang berisi
 * data sensitif, menguji deduplikasi/resume, lalu memeriksa isi tabel
 * qa_recording_event di MySQL untuk memastikan tidak ada secret yang lolos.
 *
 * Prasyarat: infra docker + backend berjalan.
 *   node dev-infra/verify-socket-e2e.mjs
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(new URL('../packages/extension/package.json', import.meta.url));
const { io } = require('socket.io-client');

const BASE_URL = process.env.QA_API_BASE_URL ?? 'http://127.0.0.1:8010';
const MYSQL_CONTAINER = 'qa-recorder-infra-mysql-1';

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

const api = async (method, path, { token, body } = {}) => {
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
	return { status: response.status, result: parsed?.result ?? parsed, raw: text };
};

const queryDb = (sql) => {
	const output = execSync(
		`docker exec -i ${MYSQL_CONTAINER} mysql -uroot -pqa_root_password -N -e ${JSON.stringify(sql)}`,
		{ encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
	);
	return output.trim();
};

const SECRETS = {
	urlToken: 'SECRET_URL_TOKEN_9f3a',
	headerToken: 'SECRET_HEADER_TOKEN_7b2c',
	email: 'rahasia.qa@knitto.co.id',
	freeTextToken: 'tok_live_abcdef123456',
	password: 'P@ssw0rd-Rahasia'
};

const state = {};

const main = async () => {
	await step('login QA tester', async () => {
		const login = await api('POST', '/auth/login', {
			body: { username: 'qatester', password: 'qatester123' }
		});
		state.token = login.result?.token;
		state.userId = login.result?.user?.id_user;
		assert(state.token, `login gagal: ${login.raw}`);
		return `id_user=${state.userId}`;
	});

	await step('bersihkan session recording yang masih aktif', async () => {
		const list = await api('GET', '/sessions?status=recording', { token: state.token });
		for (const session of list.result?.items ?? []) {
			await api('POST', `/sessions/${session.id_session}/end`, {
				token: state.token,
				body: { result: 'BLOCKED', actual_result: 'dibersihkan oleh verifikasi /qa' }
			});
		}
		return `${list.result?.items?.length ?? 0} session dibersihkan`;
	});

	await step('ambil project aktif', async () => {
		const list = await api('GET', '/projects/active', { token: state.token });
		const project = list.result?.items?.[0];
		assert(project, 'tidak ada project aktif');
		state.projectId = project.id_project;
		return `id_project=${project.id_project}`;
	});

	await step('buat session recording baru', async () => {
		const created = await api('POST', '/sessions', {
			token: state.token,
			body: {
				id_project: state.projectId,
				test_case_no: 'TC-SOCKET-001',
				title: 'Verifikasi socket + redaksi',
				target_url: 'https://contoh.test/'
			}
		});
		assert(created.status === 201, `gagal membuat session: ${created.raw}`);
		state.sessionId = created.result.id_session;
		return `id_session=${state.sessionId}`;
	});

	await step('koneksi socket tanpa token ditolak', async () => {
		const rejected = await new Promise((resolve) => {
			const socket = io(BASE_URL, { path: '/knitto-socket', transports: ['websocket'], reconnection: false });
			const timer = setTimeout(() => {
				socket.close();
				resolve(true);
			}, 4000);
			socket.on('connect', () => {
				clearTimeout(timer);
				socket.close();
				resolve(false);
			});
			socket.on('connect_error', () => {
				clearTimeout(timer);
				socket.close();
				resolve(true);
			});
		});
		assert(rejected, 'socket tanpa token seharusnya ditolak');
		return 'connect_error (unauthorized)';
	});

	await step('join session dengan token -> dapat resume cursor', async () => {
		state.socket = io(BASE_URL, {
			path: '/knitto-socket',
			transports: ['websocket'],
			auth: { token: state.token },
			reconnection: false
		});

		const joined = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout join')), 8000);
			state.socket.on('connect', () => {
				state.socket.emit('recording:join', { id_session: state.sessionId }, (response) => {
					clearTimeout(timer);
					resolve(response);
				});
			});
			state.socket.on('connect_error', (error) => {
				clearTimeout(timer);
				reject(new Error(`connect_error: ${error.message}`));
			});
		});

		assert(joined?.ok, `join gagal: ${JSON.stringify(joined)}`);
		assert(joined.result?.resume?.next_sequence === 1, 'resume awal harus 1');
		return `next_sequence=${joined.result.resume.next_sequence}`;
	});

	const batch = [
		{
			event_version: 1,
			type: 'action',
			sequence: 1,
			occurred_at: new Date().toISOString(),
			tab_id: 1,
			url: `https://contoh.test/login?token=${SECRETS.urlToken}`,
			payload: {
				action: 'change',
				locators: ["getByLabel('Password')"],
				value: SECRETS.password,
				value_redacted: false,
				element: { tagName: 'INPUT', name: 'password', ariaLabel: 'Password' }
			}
		},
		{
			event_version: 1,
			type: 'network',
			sequence: 2,
			occurred_at: new Date().toISOString(),
			tab_id: 1,
			url: `https://contoh.test/api/orders?token=${SECRETS.urlToken}`,
			payload: {
				method: 'POST',
				status: 401,
				request: {
					content_type: 'application/json',
					body: `{"email":"${SECRETS.email}","note":"kontak ${SECRETS.email}"}`,
					headers: { authorization: `Bearer ${SECRETS.headerToken}`, cookie: 'sid=abc' }
				}
			}
		},
		{
			event_version: 1,
			type: 'console',
			sequence: 3,
			occurred_at: new Date().toISOString(),
			tab_id: 1,
			url: 'https://contoh.test/',
			payload: { level: 'error', text: `gagal untuk ${SECRETS.email} token ${SECRETS.freeTextToken}` }
		}
	];

	await step('kirim batch event berisi data sensitif', async () => {
		const ack = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout events')), 10000);
			state.socket.emit('recording:events', { id_session: state.sessionId, events: batch }, (response) => {
				clearTimeout(timer);
				resolve(response);
			});
		});
		assert(ack?.ok, `ack gagal: ${JSON.stringify(ack)}`);
		assert(ack.result.accepted === 3, `accepted harus 3, dapat ${ack.result.accepted}`);
		assert(ack.result.inserted === 3, `inserted harus 3, dapat ${ack.result.inserted}`);
		state.lastSequence = ack.result.last_sequence;
		return `accepted=3 inserted=3 last_sequence=${ack.result.last_sequence}`;
	});

	await step('kirim ulang batch yang sama -> terdeduplikasi', async () => {
		const ack = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout events')), 10000);
			state.socket.emit('recording:events', { id_session: state.sessionId, events: batch }, (response) => {
				clearTimeout(timer);
				resolve(response);
			});
		});
		assert(ack?.ok, `ack gagal: ${JSON.stringify(ack)}`);
		assert(ack.result.accepted === 0, `accepted harus 0, dapat ${ack.result.accepted}`);
		assert(ack.result.duplicates === 3, `duplicates harus 3, dapat ${ack.result.duplicates}`);
		return `accepted=0 duplicates=${ack.result.duplicates}`;
	});

	await step('sequence tidak monotonik ditolak', async () => {
		const ack = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout events')), 10000);
			state.socket.emit(
				'recording:events',
				{ id_session: state.sessionId, events: [{ event_version: 1, type: 'action', sequence: 0, payload: {} }] },
				(response) => {
					clearTimeout(timer);
					resolve(response);
				}
			);
		});
		assert(ack?.ok === false, 'sequence 0 seharusnya ditolak');
		return ack.error;
	});

	await step('versi event tidak didukung ditolak', async () => {
		const ack = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout events')), 10000);
			state.socket.emit(
				'recording:events',
				{ id_session: state.sessionId, events: [{ event_version: 99, type: 'action', sequence: 10, payload: {} }] },
				(response) => {
					clearTimeout(timer);
					resolve(response);
				}
			);
		});
		assert(ack?.ok === false, 'versi 99 seharusnya ditolak');
		return ack.error;
	});

	await step('join ulang memberi resume cursor setelah event tersimpan', async () => {
		const second = io(BASE_URL, {
			path: '/knitto-socket',
			transports: ['websocket'],
			auth: { token: state.token },
			reconnection: false
		});
		const joined = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timeout join')), 8000);
			second.on('connect', () => {
				second.emit('recording:join', { id_session: state.sessionId }, (response) => {
					clearTimeout(timer);
					resolve(response);
				});
			});
			second.on('connect_error', (error) => {
				clearTimeout(timer);
				reject(new Error(error.message));
			});
		});
		second.close();
		assert(joined.result?.resume?.next_sequence === state.lastSequence + 1, 'resume cursor tidak sesuai');
		return `next_sequence=${joined.result.resume.next_sequence}`;
	});

	await step('event tersimpan berurutan dan lengkap', async () => {
		const rows = queryDb(
			`SELECT sequence, event_type FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} ORDER BY sequence`
		);
		const lines = rows.split('\n').filter(Boolean);
		assert(lines.length === 3, `harus ada 3 event, dapat ${lines.length}`);
		assert(lines[0].startsWith('1\t'), 'event pertama bukan sequence 1');
		return lines.join(' | ');
	});

	await step('REDAKSI: tidak ada secret tersimpan di MySQL', async () => {
		const payloads = queryDb(
			`SELECT CONCAT(COALESCE(url,''),' ',COALESCE(payload,'')) FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId}`
		);
		const leaked = Object.entries(SECRETS)
			.filter(([, value]) => payloads.includes(value))
			.map(([key]) => key);
		assert(leaked.length === 0, `secret lolos ke database: ${leaked.join(', ')}`);
		return 'semua secret tersamarkan';
	});

	await step('REDAKSI: email dan token di teks bebas tersamarkan', async () => {
		const consolePayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='console'`
		);
		assert(!consolePayload.includes(SECRETS.email), 'email lolos di console log');
		assert(!consolePayload.includes(SECRETS.freeTextToken), 'token teks bebas lolos');
		return 'console payload bersih';
	});

	await step('REDAKSI: header authorization dan body network', async () => {
		const networkPayload = queryDb(
			`SELECT payload FROM qa_recorder.qa_recording_event WHERE id_session=${state.sessionId} AND event_type='network'`
		);
		assert(!networkPayload.includes(SECRETS.headerToken), 'authorization header lolos');
		assert(!networkPayload.includes(SECRETS.email), 'email di body lolos');
		return 'network payload bersih';
	});

	await step('tutup socket dan akhiri session', async () => {
		state.socket?.close();
		const ended = await api('POST', `/sessions/${state.sessionId}/end`, {
			token: state.token,
			body: { result: 'PASS', actual_result: 'verifikasi socket /qa' }
		});
		assert(ended.result?.status === 'completed', `gagal mengakhiri: ${ended.raw}`);
		return `id_session=${state.sessionId} completed`;
	});

	console.log('\n=== Hasil verifikasi Socket.IO + Redaksi ===\n');
	for (const result of results)
		console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  — ${result.detail}` : ''}`);
	console.log(`\nTotal: ${results.length - failures}/${results.length} langkah lulus`);
	process.exit(failures === 0 ? 0 : 1);
};

main().catch((error) => {
	console.error('Verifikasi gagal di luar skenario:', error);
	process.exit(1);
});
