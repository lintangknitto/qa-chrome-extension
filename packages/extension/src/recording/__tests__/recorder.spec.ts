import { describe, expect, it, vi } from 'vitest';
import { RecordingController } from '../recorder';
import type { RecordingEventDraft } from '../eventTypes';

const makeDraft = (): RecordingEventDraft => ({
	type: 'console',
	occurred_at: new Date().toISOString(),
	tab_id: null,
	url: null,
	payload: { level: 'log', text: 'x' }
});

describe('RecordingController stop drain (G3)', () => {
	it('menguras seluruh buffer (lebih dari satu batch) saat stop', async () => {
		const controller = new RecordingController();
		const sent: number[] = [];

		(controller as any)._socket = {
			sendEvents: async (events: { sequence: number }[]) => {
				sent.push(...events.map((event) => event.sequence));
				const last = events[events.length - 1].sequence;
				return {
					accepted: events.length,
					inserted: events.length,
					duplicates: 0,
					last_sequence: last,
					resume: { last_sequence: last, next_sequence: last + 1 }
				};
			},
			disconnect: () => {}
		};
		(controller as any)._options = { maxBatchSize: 2 };

		const buffer = (controller as any)._buffer;
		for (let sequence = 1; sequence <= 5; sequence += 1) buffer.enqueue(makeDraft());

		await controller.stop();

		expect(sent).toEqual([1, 2, 3, 4, 5]);
		expect((controller as any)._buffer.pendingCount).toBe(0);
	});
});

describe('RecordingController capture events', () => {
	const capture = () => {
		const controller = new RecordingController();
		const enqueued: Array<{ type: string; payload: Record<string, unknown> }> = [];
		(controller as any)._enqueue = (type: string, payload: Record<string, unknown>) => enqueued.push({ type, payload });
		(controller as any)._captureScreenshot = async () => {};
		const dispatch = (method: string, params: Record<string, unknown>) =>
			(controller as any)._onDebuggerEvent(1, method, params);
		return { enqueued, dispatch };
	};

	it('hanya mencatat navigasi main frame', async () => {
		const { enqueued, dispatch } = capture();
		await dispatch('Page.frameNavigated', { frame: { id: 'f2', parentId: 'f1', url: 'https://ads.example/frame' } });
		await dispatch('Page.frameNavigated', { frame: { id: 'f1', url: 'https://app.example/login' } });
		expect(enqueued).toHaveLength(1);
		expect(enqueued[0].payload).toMatchObject({ action: 'navigation', url: 'https://app.example/login' });
	});

	it('menyimpan request id dari header response', async () => {
		const { enqueued, dispatch } = capture();
		await dispatch('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://api.example/x', method: 'POST', headers: {} } });
		await dispatch('Network.responseReceived', { requestId: 'r1', response: { status: 500, headers: { 'X-Request-Id': 'abc123' } } });
		await dispatch('Network.loadingFinished', { requestId: 'r1' });
		expect(enqueued[0].payload).toMatchObject({ status: 500, request_id: 'abc123' });
	});

	it('mengurutkan locator dari kandidat engine dan menandai ambiguous', async () => {
		const { enqueued, dispatch } = capture();
		const element = {
			tagName: 'INPUT',
			candidates: [
				{ spec: { kind: 'role', role: 'checkbox', nth: 1 }, count: 2 },
				{ spec: { kind: 'css', value: 'ul > li:nth-of-type(2) > input' }, count: 1, fragile: true }
			]
		};
		await dispatch('Runtime.bindingCalled', { name: '__qaRecorderBinding', payload: JSON.stringify({ action: 'click', element }) });
		expect(enqueued[0].payload).toMatchObject({
			locators: ["getByRole('checkbox').nth(1)", "locator('ul > li:nth-of-type(2) > input')"],
			unique_locator: null,
			ambiguous: true
		});
	});
});

describe('extractRequestId', () => {
	it('case-insensitive dan mengabaikan nilai kosong', async () => {
		const { extractRequestId } = await import('../recorder');
		expect(extractRequestId({ 'x-correlation-id': ' c-1 ' })).toBe('c-1');
		expect(extractRequestId({ 'x-request-id': '' })).toBeNull();
		expect(extractRequestId(undefined)).toBeNull();
	});
});

describe('RecordingController iframe cross-origin (child session CDP)', () => {
	const setup = () => {
		const controller = new RecordingController();
		const enqueued: Array<{ type: string; payload: Record<string, unknown> }> = [];
		const commands: Array<{ method: string; sessionId?: string; params: Record<string, unknown> }> = [];
		(controller as any)._enqueue = (type: string, payload: Record<string, unknown>) => enqueued.push({ type, payload });
		(controller as any)._captureScreenshot = async () => {};
		(controller as any)._sendCommand = async (_tabId: number, method: string, params: Record<string, unknown>, sessionId?: string) => {
			commands.push({ method, sessionId, params });
			if (method === 'DOM.getFrameOwner') return { backendNodeId: 42 };
			if (method === 'DOM.resolveNode') return { object: { objectId: 'obj-1' } };
			if (method === 'Runtime.callFunctionOn') {
				return { result: { value: [{ spec: { kind: 'title', value: 'Live Chat', exact: true }, count: 1 }] } };
			}
			return {};
		};
		const dispatch = (method: string, params: Record<string, unknown>, sessionId?: string) =>
			(controller as any)._onDebuggerEvent(1, method, params, sessionId);
		return { enqueued, commands, dispatch };
	};

	it('memasang capture di iframe lalu aksinya membawa locator <iframe> pemilik', async () => {
		const { enqueued, commands, dispatch } = setup();
		await dispatch('Target.attachedToTarget', { sessionId: 'S1', targetInfo: { type: 'iframe', targetId: 'F1' } });

		expect(commands.filter((c) => c.sessionId === 'S1').map((c) => c.method)).toEqual(
			expect.arrayContaining(['Runtime.addBinding', 'Page.addScriptToEvaluateOnNewDocument', 'Runtime.evaluate', 'Network.enable'])
		);
		expect(commands.find((c) => c.method === 'DOM.getFrameOwner')).toMatchObject({ sessionId: undefined, params: { frameId: 'F1' } });

		await dispatch(
			'Runtime.bindingCalled',
			{ name: '__qaRecorderBinding', payload: JSON.stringify({ action: 'click', crossOriginFrame: true, element: { tagName: 'BUTTON', candidates: [{ spec: { kind: 'role', role: 'button', name: 'Kirim', exact: true }, count: 1 }] } }) },
			'S1'
		);
		expect(enqueued[0].payload).toMatchObject({
			unique_locator: "getByRole('button', { name: 'Kirim', exact: true })",
			frame_locators: ["getByTitle('Live Chat', { exact: true })"]
		});
	});

	it('mengabaikan navigasi dari iframe dan memberi namespace requestId per session', async () => {
		const { enqueued, dispatch } = setup();
		await dispatch('Page.frameNavigated', { frame: { id: 'F1', url: 'https://widget.example/' } }, 'S1');
		expect(enqueued).toHaveLength(0);

		await dispatch('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://api/main', method: 'GET', headers: {} } });
		await dispatch('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://api/frame', method: 'POST', headers: {} } }, 'S1');
		await dispatch('Network.responseReceived', { requestId: 'r1', response: { status: 500, headers: {} } }, 'S1');
		await dispatch('Network.loadingFinished', { requestId: 'r1' }, 'S1');
		await dispatch('Network.responseReceived', { requestId: 'r1', response: { status: 200, headers: {} } });
		await dispatch('Network.loadingFinished', { requestId: 'r1' });
		expect(enqueued.map((e) => [e.payload.method, e.payload.status])).toEqual([
			['POST', 500],
			['GET', 200]
		]);
	});

	it('drag membawa locator target dan upload membawa nama file', async () => {
		const { enqueued, dispatch } = setup();
		await dispatch('Runtime.bindingCalled', {
			name: '__qaRecorderBinding',
			payload: JSON.stringify({
				action: 'drag',
				element: { tagName: 'DIV', candidates: [{ spec: { kind: 'testId', value: 'card-1' }, count: 1 }] },
				target: { tagName: 'SECTION', candidates: [{ spec: { kind: 'testId', value: 'kolom-selesai' }, count: 1 }] }
			})
		});
		await dispatch('Runtime.bindingCalled', {
			name: '__qaRecorderBinding',
			payload: JSON.stringify({ action: 'upload', element: { tagName: 'INPUT' }, files: ['invoice.pdf'] })
		});
		expect(enqueued[0].payload).toMatchObject({ unique_locator: "getByTestId('card-1')", target_unique_locator: "getByTestId('kolom-selesai')" });
		expect(enqueued[1].payload).toMatchObject({ action: 'upload', files: ['invoice.pdf'] });
	});
});

describe('RecordingController tab aktif (video multi-tab)', () => {
	const setup = () => {
		const controller = new RecordingController();
		const enqueued: Array<{ type: string; payload: Record<string, unknown>; extra: unknown }> = [];
		const posted: Array<Record<string, unknown>> = [];
		(controller as any)._enqueue = (type: string, payload: Record<string, unknown>, extra: unknown) => enqueued.push({ type, payload, extra });
		(controller as any)._postToOffscreen = (message: Record<string, unknown>) => posted.push(message);
		(controller as any)._sendCommand = async () => ({});
		(controller as any)._attachedTabs.add(1);
		(controller as any)._attachedTabs.add(2);
		return { controller, enqueued, posted };
	};

	it('frame screencast dikirim ke offscreen bersama tabId', async () => {
		const { controller, posted } = setup();
		await (controller as any)._onDebuggerEvent(2, 'Page.screencastFrame', { sessionId: 7, data: 'AAAA' });
		expect(posted).toEqual([{ type: 'OFFSCREEN_ADD_FRAME', tabId: 2, data: 'AAAA' }]);
	});

	it('penetapan awal tanpa event; perpindahan mencatat event tab switch', () => {
		const { controller, enqueued, posted } = setup();
		controller.setActiveTab(1, { title: 'Checkout', url: 'https://app.example/checkout' });
		expect(enqueued).toHaveLength(0);

		controller.setActiveTab(2, { title: 'Bayar', url: 'https://pay.example/x?token=rahasia' });
		expect(controller.activeTabId).toBe(2);
		expect(posted.map((m) => [m.type, m.tabId, m.title])).toEqual([
			['OFFSCREEN_SET_ACTIVE_TAB', 1, 'Checkout'],
			['OFFSCREEN_SET_ACTIVE_TAB', 2, 'Bayar']
		]);
		expect(enqueued).toHaveLength(1);
		expect(enqueued[0].type).toBe('tab');
		expect(enqueued[0].payload).toMatchObject({ kind: 'switch', from_tab_id: 1, to_tab_id: 2, title: 'Bayar' });
		expect(String(enqueued[0].payload.url)).not.toContain('rahasia');
	});

	it('perubahan judul tab aktif hanya memperbarui label, tab di luar group diabaikan', () => {
		const { controller, enqueued, posted } = setup();
		controller.setActiveTab(1, { title: '', url: 'https://app.example/' });
		controller.setActiveTab(1, { title: 'Dashboard', url: 'https://app.example/' });
		controller.setActiveTab(99, { title: 'Lain', url: 'https://other/' });
		expect(enqueued).toHaveLength(0);
		expect(posted.map((m) => m.title)).toEqual(['', 'Dashboard']);
		expect(controller.activeTabId).toBe(1);
	});
});

describe('RecordingController file test data upload', () => {
	it('upload_data diunggah sebagai artifact test_data_file dengan sequence event upload; base64 tidak masuk event', async () => {
		const controller = new RecordingController();
		const calls: Array<[string, ...unknown[]]> = [];
		(controller as any)._captureScreenshot = async () => {};
		(controller as any)._options = { idSession: 9 };
		(controller as any)._api = {
			presignArtifactUpload: async (...args: unknown[]) => {
				calls.push(['presign', ...args]);
				return { upload_url: 'http://minio/b/k', artifact: { id_artifact: 31 } };
			},
			uploadToPresignedUrl: async (url: string, blob: Blob, type: string) => calls.push(['put', url, blob.size, type]),
			completeArtifactUpload: async (...args: unknown[]) => calls.push(['complete', ...args])
		};
		const dispatch = (payload: Record<string, unknown>) =>
			(controller as any)._onDebuggerEvent(1, 'Runtime.bindingCalled', { name: '__qaRecorderBinding', payload: JSON.stringify(payload) });

		await dispatch({ action: 'upload', element: { tagName: 'INPUT' }, files: ['a.pdf', 'besar.zip'], upload_ref: 'r1' });
		await dispatch({
			action: 'upload_data',
			upload_ref: 'r1',
			files: [
				{ name: 'a.pdf', type: 'application/pdf', size: 4, data: 'aGFsbw==' },
				{ name: 'besar.zip', type: 'application/zip', size: 99, stored: false }
			]
		});
		await vi.waitFor(() => expect(calls.some((c) => c[0] === 'complete')).toBe(true));

		const events = (controller as any)._buffer.takeBatch(10);
		expect(events).toHaveLength(1);
		expect(events[0].payload).toMatchObject({ action: 'upload', files: ['a.pdf', 'besar.zip'] });
		expect(JSON.stringify(events[0].payload)).not.toContain('aGFsbw==');
		expect(calls).toEqual([
			['presign', 9, { kind: 'test_data_file', content_type: 'application/pdf', size_bytes: 4, sequence: events[0].sequence, file_name: 'a.pdf' }],
			['put', 'http://minio/b/k', 4, 'application/pdf'],
			['complete', 9, 31, { size_bytes: 4 }]
		]);
	});

	it('upload_data per file: referensi tetap hidup sampai pesan last:true', async () => {
		const controller = new RecordingController();
		const presigned: string[] = [];
		(controller as any)._captureScreenshot = async () => {};
		(controller as any)._options = { idSession: 9 };
		(controller as any)._api = {
			presignArtifactUpload: async (_id: number, body: { file_name: string }) => {
				presigned.push(body.file_name);
				return { upload_url: 'http://minio/b/k', artifact: { id_artifact: 1 } };
			},
			uploadToPresignedUrl: async () => {},
			completeArtifactUpload: async () => {}
		};
		const dispatch = (payload: Record<string, unknown>) =>
			(controller as any)._onDebuggerEvent(1, 'Runtime.bindingCalled', { name: '__qaRecorderBinding', payload: JSON.stringify(payload) });

		await dispatch({ action: 'upload', element: { tagName: 'INPUT' }, files: ['a.txt', 'b.txt'], upload_ref: 'r2' });
		await dispatch({ action: 'upload_data', upload_ref: 'r2', files: [{ name: 'a.txt', type: 'text/plain', size: 1, data: 'YQ==' }], last: false });
		expect((controller as any)._uploadSequences.has('r2')).toBe(true);
		await dispatch({ action: 'upload_data', upload_ref: 'r2', files: [{ name: 'b.txt', type: 'text/plain', size: 1, data: 'Yg==' }], last: true });
		expect((controller as any)._uploadSequences.has('r2')).toBe(false);
		await vi.waitFor(() => expect(presigned).toEqual(['a.txt', 'b.txt']));
	});

	it('upload_data dengan ref tak dikenal diabaikan', async () => {
		const controller = new RecordingController();
		const presign = vi.fn();
		(controller as any)._options = { idSession: 9 };
		(controller as any)._api = { presignArtifactUpload: presign };
		await (controller as any)._onDebuggerEvent(1, 'Runtime.bindingCalled', {
			name: '__qaRecorderBinding',
			payload: JSON.stringify({ action: 'upload_data', upload_ref: 'x', files: [{ name: 'a', data: 'AA==' }] })
		});
		expect(presign).not.toHaveBeenCalled();
		expect((controller as any)._buffer.pendingCount).toBe(0);
	});
});

describe('RecordingController tab baru yang masih loading', () => {
	it('event switch memakai pendingUrl bila url belum ada', () => {
		const controller = new RecordingController();
		const enqueued: Array<{ payload: Record<string, unknown> }> = [];
		(controller as any)._enqueue = (_type: string, payload: Record<string, unknown>) => enqueued.push({ payload });
		(controller as any)._postToOffscreen = () => {};
		(controller as any)._attachedTabs.add(1);
		(controller as any)._attachedTabs.add(2);
		controller.setActiveTab(1, { title: 'A', url: 'https://app/a' });
		controller.setActiveTab(2, { title: '', url: '', pendingUrl: 'https://app/b' });
		expect(enqueued[0].payload).toMatchObject({ to_tab_id: 2, title: null, url: 'https://app/b' });
	});
});
