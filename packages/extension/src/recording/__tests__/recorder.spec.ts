import { describe, expect, it } from 'vitest';
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
