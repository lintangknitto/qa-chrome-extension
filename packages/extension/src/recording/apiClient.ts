export interface RecordingProject {
	id_project: number;
	name: string;
	code: string;
	is_active: boolean;
	base_url?: string | null;
	description?: string | null;
}

export interface RecordingSession {
	id_session: number;
	id_project?: number | null;
	id_test_case?: number | null;
	test_case_no: string;
	title: string;
	status: string;
	result: string | null;
	actual_result?: string | null;
	last_sequence: number;
	share_token?: string | null;
	video_url?: string | null;
	record_video?: number | boolean | null;
	target_url?: string | null;
}

export interface TestCaseItem {
	id_test_case: number;
	id_project: number;
	group_no?: string | null;
	feature?: string | null;
	process_no?: string | null;
	test_type: string;
	test_case_id: string;
	test_variable?: string | null;
	title: string;
	pre_condition?: string | null;
	test_data?: string | null;
	test_steps?: string | null;
	expected_result?: string | null;
	actual_result?: string | null;
	status: string;
	evidence?: string | null;
	remarks?: string | null;
	automation_tools?: string | null;
	last_session_id?: number | null;
	created_at?: string;
	updated_at?: string;
}

export interface TestCaseSummary {
	total: number;
	passed: number;
	failed: number;
	re_test: number;
	progress: number;
	skip: number;
}

export interface PresignedUpload {
	artifact: { id_artifact: number; object_key: string };
	upload_url: string;
	object_key: string;
	expires_in: number;
}

export interface LoginResult {
	token: string;
	user: { id_user: number; username: string; nama: string; level?: string };
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

	createProject(input: {
		name: string;
		base_url?: string;
		description?: string;
		code?: string;
	}): Promise<RecordingProject> {
		return this._request<RecordingProject>('POST', '/projects', input);
	}

	listProjects(params: { page?: number; perPage?: number; search?: string } = {}): Promise<{
		items: RecordingProject[];
		total?: number;
	}> {
		const query = new URLSearchParams();
		if (params.page !== undefined) query.set('page', String(params.page));
		if (params.perPage !== undefined) query.set('perPage', String(params.perPage));
		if (params.search) query.set('search', params.search);
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/projects${suffix}`);
	}

	createSession(input: {
		id_project?: number | null;
		id_test_case?: number | null;
		test_case_no: string;
		title: string;
		description?: string | null;
		target_url?: string | null;
	}): Promise<RecordingSession> {
		const payload: Record<string, unknown> = {
			test_case_no: input.test_case_no,
			title: input.title
		};
		if (typeof input.id_project === 'number' && input.id_project > 0) {
			payload.id_project = input.id_project;
		}
		if (typeof input.id_test_case === 'number' && input.id_test_case > 0) {
			payload.id_test_case = input.id_test_case;
		}
		if (input.description) {
			payload.description = input.description;
		}
		if (input.target_url) {
			payload.target_url = input.target_url;
		}
		return this._request<RecordingSession>('POST', '/sessions', payload);
	}

	listTestCases(
		idProject: number,
		params: {
			search?: string;
			status?: string;
			feature?: string;
			test_type?: string;
			page?: number;
			limit?: number;
		} = {}
	): Promise<{
		items: TestCaseItem[];
		total: number;
		page: number;
		limit: number;
		summary: TestCaseSummary;
	}> {
		const query = new URLSearchParams();
		if (params.search) query.set('search', params.search);
		if (params.status) query.set('status', params.status);
		if (params.feature) query.set('feature', params.feature);
		if (params.test_type) query.set('test_type', params.test_type);
		if (params.page !== undefined) query.set('page', String(params.page));
		if (params.limit !== undefined) query.set('limit', String(params.limit));
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/projects/${idProject}/test-cases${suffix}`);
	}

	createTestCase(
		idProject: number,
		input: Partial<TestCaseItem> & { test_case_id: string; title: string }
	): Promise<TestCaseItem> {
		return this._request<TestCaseItem>('POST', `/projects/${idProject}/test-cases`, input);
	}

	updateTestCase(
		idProject: number,
		idTestCase: number,
		input: Partial<TestCaseItem>
	): Promise<TestCaseItem> {
		return this._request<TestCaseItem>('PUT', `/projects/${idProject}/test-cases/${idTestCase}`, input);
	}

	deleteTestCase(idProject: number, idTestCase: number): Promise<{ success: boolean }> {
		return this._request('DELETE', `/projects/${idProject}/test-cases/${idTestCase}`);
	}

	importTestCases(
		idProject: number,
		items: Array<Partial<TestCaseItem> & { test_case_id: string; title: string }>
	): Promise<{
		result: { total: number; inserted: number; updated: number };
		summary: TestCaseSummary;
	}> {
		return this._request('POST', `/projects/${idProject}/test-cases/import`, { items });
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

	generateShareUrl(sessionId: number): Promise<{ share_token: string; share_url: string }> {
		return this._request('POST', `/sessions/${sessionId}/share`);
	}

	presignSessionVideo(
		sessionId: number,
		input: { size_bytes: number; content_type?: string }
	): Promise<{ upload_url: string; object_key: string; content_type: string; expires_in: number }> {
		return this._request('POST', `/sessions/${sessionId}/video/presign-upload`, input);
	}

	completeSessionVideo(
		sessionId: number,
		input: { object_key: string }
	): Promise<{ id_session: number; video_url: string; object_key: string }> {
		return this._request('POST', `/sessions/${sessionId}/video/complete`, input);
	}

	getSessionVideo(sessionId: number): Promise<{ id_session: number; video_url: string | null }> {
		return this._request('GET', `/sessions/${sessionId}/video`);
	}

	async uploadSessionVideo(sessionId: number, videoBlob: Blob): Promise<{ video_url: string }> {
		const contentType = videoBlob.type || 'video/webm';

		// Jika di browser extension dengan chrome.runtime, delegasikan ke background agar bebas dari CORS & Mixed Content
		if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
			try {
				const dataUrl = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result as string);
					reader.onerror = () => reject(new Error('Gagal membaca blob video'));
					reader.readAsDataURL(videoBlob);
				});

				const bgRes = await new Promise<any>((resolve) => {
					chrome.runtime.sendMessage(
						{
							type: 'sessionVideo:upload',
							idSession: sessionId,
							apiBaseUrl: this._baseUrl,
							videoDataUrl: dataUrl
						},
						(res) => resolve(res)
					);
				});

				if (bgRes?.success && bgRes?.videoUrl) {
					return { video_url: bgRes.videoUrl };
				}
			} catch {
				// Fallback ke direct HTTP upload
			}
		}

		const presign = await this.presignSessionVideo(sessionId, {
			size_bytes: videoBlob.size,
			content_type: contentType
		});
		await this.uploadToPresignedUrl(presign.upload_url, videoBlob, contentType);
		const complete = await this.completeSessionVideo(sessionId, { object_key: presign.object_key });
		return { video_url: complete.video_url };
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
