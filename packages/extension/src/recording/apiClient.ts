export interface RecordingProject {
	id_project: number;
	name: string;
	code: string;
	is_active: boolean;
}

export interface RecordingSession {
	id_session: number;
	id_project: number;
	test_case_no: string;
	title: string;
	status: string;
	result: string | null;
	last_sequence: number;
}

export interface PresignedUpload {
	artifact: { id_artifact: number; object_key: string };
	upload_url: string;
	object_key: string;
	expires_in: number;
}

export interface LoginResult {
	token: string;
	user: { id_user: number; username: string; nama: string };
}

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export interface ApiClientOptions {
	baseUrl: string;
	getToken: () => Promise<string | null>;
	onUnauthorized?: () => void;
	fetchImpl?: typeof fetch;
}

export class RecordingApiClient {
	private readonly _baseUrl: string;
	private readonly _getToken: () => Promise<string | null>;
	private readonly _onUnauthorized?: () => void;
	private readonly _fetch: typeof fetch;

	constructor(options: ApiClientOptions) {
		this._baseUrl = options.baseUrl.replace(/\/+$/, '');
		this._getToken = options.getToken;
		this._onUnauthorized = options.onUnauthorized;
		// `fetch` wajib terikat ke global-nya; memanggilnya sebagai method instance
		// (this._fetch(...)) memicu "Illegal invocation" di Chromium.
		this._fetch = options.fetchImpl ?? fetch.bind(globalThis);
	}

	login(username: string, password: string): Promise<LoginResult> {
		return this._request<LoginResult>('POST', '/auth/login', { username, password }, { skipAuth: true });
	}

	listActiveProjects(): Promise<{ items: RecordingProject[] }> {
		return this._request('GET', '/projects/active');
	}

	createSession(input: {
		id_project: number;
		test_case_no: string;
		title: string;
		description?: string;
		target_url?: string;
	}): Promise<RecordingSession> {
		return this._request<RecordingSession>('POST', '/sessions', input);
	}

	listSessions(params: { page?: number; perPage?: number; id_project?: number } = {}): Promise<{
		items: RecordingSession[];
	}> {
		const query = new URLSearchParams();
		if (params.page !== undefined) query.set('page', String(params.page));
		if (params.perPage !== undefined) query.set('perPage', String(params.perPage));
		if (params.id_project !== undefined) query.set('id_project', String(params.id_project));
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/sessions${suffix}`);
	}

	getSession(idSession: number): Promise<RecordingSession & { checkpoints: unknown[] }> {
		return this._request('GET', `/sessions/${idSession}`);
	}

	endSession(idSession: number, input: { result: string; actual_result?: string }): Promise<RecordingSession> {
		return this._request<RecordingSession>('POST', `/sessions/${idSession}/end`, input);
	}

	createCheckpoint(idSession: number, input: { note: string; sequence?: number }): Promise<unknown> {
		return this._request('POST', `/sessions/${idSession}/checkpoints`, input);
	}

	presignArtifactUpload(
		idSession: number,
		input: { kind: string; content_type: string; size_bytes: number; sequence?: number }
	): Promise<PresignedUpload> {
		return this._request<PresignedUpload>('POST', `/sessions/${idSession}/artifacts/presign-upload`, input);
	}

	completeArtifactUpload(
		idSession: number,
		idArtifact: number,
		input: { size_bytes?: number; checksum_sha256?: string }
	): Promise<unknown> {
		return this._request('POST', `/sessions/${idSession}/artifacts/${idArtifact}/complete`, input);
	}

	generateOutputs(idSession: number, kinds?: string[]): Promise<unknown> {
		return this._request('POST', `/sessions/${idSession}/generations`, kinds ? { kinds } : {});
	}

	listGenerations(idSession: number): Promise<{ items: unknown[] }> {
		return this._request('GET', `/sessions/${idSession}/generations`);
	}

	async uploadToPresignedUrl(
		uploadUrl: string,
		body: Blob,
		contentType: string
	): Promise<void> {
		const response = await this._fetch(uploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': contentType },
			body
		});
		if (!response.ok) throw new ApiError(`Upload artifact gagal (HTTP ${response.status}).`, response.status);
	}

	private async _request<T>(
		method: string,
		path: string,
		body?: unknown,
		options: { skipAuth?: boolean } = {}
	): Promise<T> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (body !== undefined) headers['Content-Type'] = 'application/json';

		if (!options.skipAuth) {
			const token = await this._getToken();
			if (!token) throw new ApiError('Belum login.', 401);
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await this._fetch(`${this._baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});

		if (response.status === 401) {
			this._onUnauthorized?.();
			throw new ApiError('Sesi login berakhir. Silakan login ulang.', 401);
		}

		const text = await response.text();
		const parsed = text ? safeParse(text) : null;

		if (!response.ok) {
			const message =
				(parsed as { message?: string } | null)?.message ?? `Request gagal (HTTP ${response.status}).`;
			throw new ApiError(message, response.status);
		}

		const payload = (parsed as { result?: unknown } | null)?.result ?? parsed;
		return payload as T;
	}
}

const safeParse = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
};
