import { io, type Socket } from 'socket.io-client';

export interface SocketJoinResult {
	session: { id_session: number; last_sequence: number; status: string };
	resume: { last_sequence: number; next_sequence: number };
}

export interface SocketEventsResult {
	accepted: number;
	inserted: number;
	duplicates: number;
	last_sequence: number;
	resume: { last_sequence: number; next_sequence: number };
}

export interface SocketClientOptions {
	baseUrl: string;
	getToken: () => Promise<string | null>;
	socketFactory?: typeof io;
	ackTimeoutMs?: number;
}

const DEFAULT_ACK_TIMEOUT_MS = 10000;

/**
 * Client Socket.IO untuk streaming event recording. Ack dipakai sebagai
 * acknowledgement sehingga extension tahu sampai sequence berapa yang aman
 * dibuang dari buffer.
 */
export class RecordingSocketClient {
	private readonly _baseUrl: string;
	private readonly _getToken: () => Promise<string | null>;
	private readonly _ioFactory: typeof io;
	private readonly _ackTimeoutMs: number;
	private _socket: Socket | null = null;
	private _idSession: number | null = null;

	constructor(options: SocketClientOptions) {
		this._baseUrl = options.baseUrl.replace(/\/+$/, '');
		this._getToken = options.getToken;
		this._ioFactory = options.socketFactory ?? io;
		this._ackTimeoutMs = options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
	}

	get isConnected(): boolean {
		return this._socket?.connected === true;
	}

	async connect(idSession: number): Promise<SocketJoinResult> {
		const token = await this._getToken();
		if (!token) throw new Error('Belum login.');

		this.disconnect();
		this._socket = this._ioFactory(this._baseUrl, {
			auth: { token },
			path: '/knitto-socket',
			transports: ['websocket'],
			reconnection: true
		});
		this._idSession = idSession;

		const response = await this._emitWithAck<{ ok: boolean; result?: SocketJoinResult; error?: string }>(
			'recording:join',
			{ id_session: idSession }
		);
		if (!response?.ok || !response.result) throw new Error(response?.error ?? 'Gagal bergabung ke session.');

		return response.result;
	}

	async sendEvents(events: unknown[]): Promise<SocketEventsResult> {
		if (!this._socket || this._idSession === null) throw new Error('Socket belum terhubung.');

		const response = await this._emitWithAck<{ ok: boolean; result?: SocketEventsResult; error?: string }>(
			'recording:events',
			{ id_session: this._idSession, events }
		);
		if (!response?.ok || !response.result) throw new Error(response?.error ?? 'Gagal mengirim event.');

		return response.result;
	}

	disconnect(): void {
		this._socket?.disconnect();
		this._socket = null;
		this._idSession = null;
	}

	private _emitWithAck<T>(event: string, payload: unknown): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const socket = this._socket;
			if (!socket) {
				reject(new Error('Socket belum terhubung.'));
				return;
			}

			socket.timeout(this._ackTimeoutMs).emit(event, payload, (error: Error | null, response: T) => {
				if (error) reject(new Error('Timeout menunggu acknowledgement backend.'));
				else resolve(response);
			});
		});
	}
}
