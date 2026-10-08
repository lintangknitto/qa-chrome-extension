import { describe, expect, it, vi } from 'vitest';
import { RecordingSocketClient } from '../socketClient';

const makeSocketFactory = (acknowledge: (event: string, payload: any) => unknown) => {
	const emitted: Array<{ event: string; payload: any }> = [];
	const socket = {
		connected: true,
		disconnect: vi.fn(),
		timeout: vi.fn(() => ({
			emit: (event: string, payload: any, callback: (error: Error | null, response: unknown) => void) => {
				emitted.push({ event, payload });
				callback(null, acknowledge(event, payload));
			}
		}))
	};
	const factory = vi.fn(() => socket);
	return { emitted, factory, socket };
};

describe('RecordingSocketClient recording protocol', () => {
	it('authenticates, joins the session and sends event batches with the same session id', async () => {
		const mock = makeSocketFactory((event) => event === 'recording:join'
			? { ok: true, result: { session: { id_session: 12, last_sequence: 2, status: 'recording' }, resume: { last_sequence: 2, next_sequence: 3 } } }
			: { ok: true, result: { accepted: 1, inserted: 1, duplicates: 0, last_sequence: 3, resume: { last_sequence: 3, next_sequence: 4 } } });
		const client = new RecordingSocketClient({
			baseUrl: 'http://localhost:8000/', getToken: async () => 'test-jwt',
			socketFactory: mock.factory as any
		});

		const joined = await client.connect(12);
		const sent = await client.sendEvents([{ sequence: 3, type: 'click' }]);

		expect(mock.factory).toHaveBeenCalledWith('http://localhost:8000', expect.objectContaining({
			auth: { token: 'test-jwt' }, path: '/knitto-socket', transports: ['websocket']
		}));
		expect(joined.resume.next_sequence).toBe(3);
		expect(mock.emitted).toEqual([
			{ event: 'recording:join', payload: { id_session: 12 } },
			{ event: 'recording:events', payload: { id_session: 12, events: [{ sequence: 3, type: 'click' }] } }
		]);
		expect(sent.resume.next_sequence).toBe(4);
	});

	it('refuses to connect without an auth token', async () => {
		const mock = makeSocketFactory(() => ({ ok: true }));
		const client = new RecordingSocketClient({ baseUrl: 'http://localhost:8000', getToken: async () => null, socketFactory: mock.factory as any });

		await expect(client.connect(12)).rejects.toThrow('Belum login.');
		expect(mock.factory).not.toHaveBeenCalled();
	});

	it('clears session state on disconnect so later sends cannot leak to the prior session', async () => {
		const mock = makeSocketFactory(() => ({ ok: true, result: { session: { id_session: 12, last_sequence: 0, status: 'recording' }, resume: { last_sequence: 0, next_sequence: 1 } } }));
		const client = new RecordingSocketClient({ baseUrl: 'http://localhost:8000', getToken: async () => 'jwt', socketFactory: mock.factory as any });
		await client.connect(12);

		client.disconnect();
		await expect(client.sendEvents([])).rejects.toThrow('Socket belum terhubung.');
		expect(mock.socket.disconnect).toHaveBeenCalledOnce();
	});
});
