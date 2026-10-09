export interface ProgramItem {
	id_program: number;
	name: string;
	code: string;
	type?: 'FRONTEND' | 'SERVICE';
	grafana_dashboard_url?: string | null;
	description?: string | null;
	base_url?: string | null;
	repo_url?: string | null;
	project_count?: number;
	is_active: boolean;
	created_by_user_id?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface RecordingProject {
	id_project: number;
	id_program?: number | null;
	program_name?: string | null;
	program_code?: string | null;
	program_ids?: number[];
	programs?: Array<ProgramItem>;
	name: string;
	code: string;
	is_active: boolean;
	base_url?: string | null;
	repo_url?: string | null;
	description?: string | null;
	release_version?: string | null;
	test_app_folder?: string | null;
	ip_dev?: string | null;
	ip_prod?: string | null;
	tester_name?: string | null;
	programmer_name?: string | null;
	task_dev?: string | null;
	brd_id?: string | null;
	link_task_pb?: string | null;
	link_figma?: string | null;
	created_by_user_id?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
}

import type { ProjectMetadataField } from './projectMetadata';
export type { ProjectMetadataField } from './projectMetadata';

export type TemplateColumnMapping = Record<string, { header: string; aliases?: string[] }>;

export interface TestCaseTemplate {
	id_template: number;
	version_label: string;
	name: string;
	spreadsheet_url: string;
	gid: string | null;
	column_mapping: TemplateColumnMapping;
	export_anchors: Record<string, unknown>;
	is_default: boolean;
	is_active: boolean;
	created_at?: string | null;
	updated_at?: string | null;
}

export type TestCaseTemplateInput = {
	version_label: string;
	name: string;
	spreadsheet_url: string;
	gid?: string | null;
	column_mapping: TemplateColumnMapping;
	export_anchors?: Record<string, unknown>;
	is_default?: boolean;
};

export interface RecordingSession {
	id_session: number;
	id_project?: number | null;
	id_test_case?: number | null;
	test_case_no: string;
	title: string;
	status: string;
	result: string | null;
	expected_result?: string | null;
	actual_result?: string | null;
	description?: string | null;
	last_sequence: number;
	share_token?: string | null;
	video_url?: string | null;
	record_video?: number | boolean | null;
	target_url?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface TestCaseItem {
	id_test_case: number;
	id_project: number;
	id_program?: number | null;
	program_name?: string | null;
	program_code?: string | null;
	program_type?: 'FRONTEND' | 'SERVICE' | string | null;
	program_base_url?: string | null;
	program_repo_url?: string | null;
	group_no?: string | null;
	feature?: string | null;
	process_no?: string | null;
	test_type: string;
	test_case_id: string;
	test_variable?: string | null;
	scenario?: string | null;
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
	test_date?: string | null;
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

export interface UserItem {
	id_user: number;
	nama: string;
	username: string;
	level: string;
	is_active: boolean;
	created_at?: string | null;
	updated_at?: string | null;
	assigned_project_ids?: number[];
}

export interface ListUsersParams {
	page?: number;
	perPage?: number;
	search?: string;
	level?: string;
	is_active?: 'all' | 'true' | 'false';
}

export interface ListUsersResult {
	list: UserItem[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
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

import { extensionFetch } from './extensionFetch';

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
		this._fetch = options.fetchImpl ?? extensionFetch;
	}

	public get baseUrl(): string {
		return this._baseUrl;
	}

	login(username: string, password: string): Promise<LoginResult> {
		return this._request<LoginResult>('POST', '/auth/login', { username, password }, { skipAuth: true });
	}

	listActiveProjects(): Promise<{ items: RecordingProject[] }> {
		return this._request('GET', '/projects/active');
	}

	createProject(input: {
		name: string;
		id_program?: number | null;
		program_ids?: number[];
		base_url?: string;
		repo_url?: string;
		description?: string;
		code?: string;
	} & Partial<Record<ProjectMetadataField, string | null>>): Promise<RecordingProject> {
		return this._request<RecordingProject>('POST', '/projects', input);
	}

	updateProject(
		idProject: number,
		input: {
			name?: string;
			id_program?: number | null;
			program_ids?: number[];
			base_url?: string;
			repo_url?: string;
			description?: string;
			is_active?: boolean;
		} & Partial<Record<ProjectMetadataField, string | null>>
	): Promise<RecordingProject> {
		return this._request<RecordingProject>('PUT', `/projects/${idProject}`, input);
	}

	deleteProject(idProject: number): Promise<{
		id_project?: number;
		success: boolean;
		deleted?: boolean;
		deactivated?: boolean;
		message?: string;
	}> {
		return this._request('DELETE', `/projects/${idProject}`);
	}

	listProjects(params: { page?: number; perPage?: number; search?: string; id_program?: number } = {}): Promise<{
		items: RecordingProject[];
		total?: number;
	}> {
		const query = new URLSearchParams();
		if (params.page !== undefined) query.set('page', String(params.page));
		if (params.perPage !== undefined) query.set('perPage', String(params.perPage));
		if (params.search) query.set('search', params.search);
		if (params.id_program !== undefined) query.set('id_program', String(params.id_program));
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/projects${suffix}`);
	}

	listPrograms(params: { page?: number; perPage?: number; search?: string; is_active?: string } = {}): Promise<{
		items: ProgramItem[];
		total?: number;
		page?: number;
		perPage?: number;
	}> {
		const query = new URLSearchParams();
		if (params.page !== undefined) query.set('page', String(params.page));
		if (params.perPage !== undefined) query.set('perPage', String(params.perPage));
		if (params.search) query.set('search', params.search);
		if (params.is_active) query.set('is_active', params.is_active);
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/programs${suffix}`);
	}

	listActivePrograms(params: { search?: string } = {}): Promise<{ items: ProgramItem[]; total?: number }> {
		const query = new URLSearchParams();
		if (params.search) query.set('search', params.search);
		const suffix = query.toString() ? `?${query.toString()}` : '';
		return this._request('GET', `/programs/active${suffix}`);
	}

	getProgram(idProgram: number): Promise<ProgramItem> {
		return this._request<ProgramItem>('GET', `/programs/${idProgram}`);
	}

	createProgram(input: {
		name: string;
		code?: string;
		type?: 'FRONTEND' | 'SERVICE';
		grafana_dashboard_url?: string;
		base_url?: string;
		repo_url?: string;
		description?: string;
	}): Promise<ProgramItem> {
		return this._request<ProgramItem>('POST', '/programs', input);
	}

	updateProgram(
		idProgram: number,
		input: {
			name?: string;
			code?: string;
			type?: 'FRONTEND' | 'SERVICE';
			grafana_dashboard_url?: string;
			base_url?: string;
			repo_url?: string;
			description?: string;
			is_active?: boolean;
		}
	): Promise<ProgramItem> {
		return this._request<ProgramItem>('PUT', `/programs/${idProgram}`, input);
	}

	deleteProgram(idProgram: number): Promise<{
		success: boolean;
		action: string;
		message: string;
	}> {
		return this._request('DELETE', `/programs/${idProgram}`);
	}

	createSession(input: {
		id_project?: number | null;
		id_test_case?: number | null;
		test_case_no: string;
		title: string;
		description?: string | null;
		target_url?: string | null;
		force_end_previous?: boolean;
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
		if (input.force_end_previous) {
			payload.force_end_previous = true;
		}
		return this._request<RecordingSession>('POST', '/sessions', payload);
	}

	getActiveSession(): Promise<RecordingSession | null> {
		return this._request<RecordingSession | null>('GET', '/sessions/active');
	}

	discardActiveSession(): Promise<{ success: boolean; count: number }> {
		return this._request<{ success: boolean; count: number }>('POST', '/sessions/active/discard');
	}

	listTestCases(
		idProject: number,
		params: {
			search?: string;
			status?: string;
			feature?: string;
			test_type?: string;
			id_program?: number;
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
		if (params.id_program !== undefined) query.set('id_program', String(params.id_program));
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

	/** Unduh test case project sebagai .xlsx berformat template (default bila idTemplate kosong). */
	async exportTestCases(idProject: number, idTemplate?: number): Promise<{ blob: Blob; filename: string }> {
		const suffix = idTemplate ? `?template=${idTemplate}` : '';
		const response = await this._send('GET', `/projects/${idProject}/test-cases/export${suffix}`);
		const disposition = response.headers.get('content-disposition') ?? '';
		const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `project-${idProject}-test-case.xlsx`;
		return { blob: await response.blob(), filename };
	}

	listTestCaseTemplates(includeInactive = false): Promise<TestCaseTemplate[]> {
		return this._request('GET', `/test-case-templates${includeInactive ? '?include_inactive=true' : ''}`);
	}

	getDefaultTestCaseTemplate(): Promise<TestCaseTemplate> {
		return this._request('GET', '/test-case-templates/default');
	}

	createTestCaseTemplate(input: TestCaseTemplateInput): Promise<TestCaseTemplate> {
		return this._request('POST', '/test-case-templates', input);
	}

	updateTestCaseTemplate(
		idTemplate: number,
		input: Partial<Omit<TestCaseTemplateInput, 'is_default'>> & { is_active?: boolean }
	): Promise<TestCaseTemplate> {
		return this._request('PUT', `/test-case-templates/${idTemplate}`, input);
	}

	setDefaultTestCaseTemplate(idTemplate: number): Promise<TestCaseTemplate> {
		return this._request('PATCH', `/test-case-templates/${idTemplate}/default`);
	}

	deactivateTestCaseTemplate(idTemplate: number): Promise<TestCaseTemplate> {
		return this._request('PATCH', `/test-case-templates/${idTemplate}/deactivate`);
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

	listArtifacts(idSession: number): Promise<{ items: Array<{ id_artifact: number; kind: string; object_key: string; content_type: string; size_bytes: number }> }> {
		return this._request('GET', `/sessions/${idSession}/artifacts`);
	}

	getArtifactDownloadUrl(idSession: number, idArtifact: number): Promise<{ download_url: string }> {
		return this._request('GET', `/sessions/${idSession}/artifacts/${idArtifact}/download-url`);
	}

	async uploadStorageStateArtifact(
		idSession: number,
		storageState: unknown
	): Promise<unknown> {
		const jsonStr = JSON.stringify(storageState, null, 2);
		const blob = new Blob([jsonStr], { type: 'application/json' });
		const presign = await this.presignArtifactUpload(idSession, {
			kind: 'storage_state',
			content_type: 'application/json',
			size_bytes: blob.size
		});
		await this.uploadToPresignedUrl(presign.upload_url, blob, 'application/json');
		return this.completeArtifactUpload(idSession, presign.artifact.id_artifact, {
			size_bytes: blob.size
		});
	}

	generateOutputs(idSession: number, kinds?: string[]): Promise<unknown> {
		return this._request('POST', `/sessions/${idSession}/generations`, kinds ? { kinds } : {});
	}

	listGenerations(idSession: number): Promise<{ items: unknown[] }> {
		return this._request('GET', `/sessions/${idSession}/generations`);
	}

	/** Investigasi kegagalan sesi (rekaman + log Loki dashboard program + codebase memory). */
	investigateSession(idSession: number): Promise<{ status: 'completed' | 'failed'; output?: string; error?: string }> {
		return this._request('POST', `/sessions/${idSession}/investigate`);
	}

	/** Laporkan langkah replay yang gagal; API mencatat & menjalankan investigasi di background. */
	reportReplayFailure(
		idSession: number,
		input: { step_no: number; error: string; step_description?: string; selector?: string; total_steps?: number }
	): Promise<{ recorded: boolean; investigation: string }> {
		return this._request('POST', `/sessions/${idSession}/replay-failures`, input);
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

	async listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
		const searchParams = new URLSearchParams();
		if (params.page !== undefined) searchParams.set('page', String(params.page));
		if (params.perPage !== undefined) searchParams.set('perPage', String(params.perPage));
		if (params.search) searchParams.set('search', params.search);
		if (params.level && params.level !== 'all') searchParams.set('level', params.level);
		if (params.is_active && params.is_active !== 'all') searchParams.set('is_active', params.is_active);

		const query = searchParams.toString();
		return this._request<ListUsersResult>('GET', `/users${query ? `?${query}` : ''}`);
	}

	async getUserDetail(idUser: number): Promise<UserItem> {
		return this._request<UserItem>('GET', `/users/${idUser}`);
	}

	async createUser(payload: {
		nama: string;
		username: string;
		password: string;
		level: string;
		is_active?: boolean;
		project_ids?: number[];
	}): Promise<UserItem> {
		return this._request<UserItem>('POST', '/users', payload);
	}

	async updateUser(
		idUser: number,
		payload: {
			nama?: string;
			level?: string;
			is_active?: boolean;
			project_ids?: number[];
		}
	): Promise<UserItem> {
		return this._request<UserItem>('PUT', `/users/${idUser}`, payload);
	}

	async resetUserPassword(
		idUser: number,
		password: string
	): Promise<{ success: boolean; message: string }> {
		return this._request<{ success: boolean; message: string }>(
			'PATCH',
			`/users/${idUser}/reset-password`,
			{ password }
		);
	}

	async deleteUser(
		idUser: number
	): Promise<{ success: boolean; mode: 'deleted' | 'deactivated'; message: string }> {
		return this._request<{ success: boolean; mode: 'deleted' | 'deactivated'; message: string }>(
			'DELETE',
			`/users/${idUser}`
		);
	}

	async changePassword(
		oldPassword: string,
		newPassword: string
	): Promise<{ success: boolean; message: string }> {
		return this._request<{ success: boolean; message: string }>(
			'POST',
			'/auth/change-password',
			{
				old_password: oldPassword,
				new_password: newPassword
			}
		);
	}

	/** Request mentah (untuk unduhan biner); error JSON API tetap jadi ApiError. */
	private async _send(method: string, path: string, body?: unknown, options: { skipAuth?: boolean } = {}): Promise<Response> {
		const headers: Record<string, string> = { Accept: '*/*' };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		if (!options.skipAuth) {
			const token = await this._getToken();
			if (!token) {
				this._onUnauthorized?.();
				throw new ApiError('Belum login.', 401);
			}
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
		if (!response.ok) {
			const parsed = safeParse(await response.text());
			const message = (parsed as { message?: string } | null)?.message ?? `Request gagal (HTTP ${response.status}).`;
			throw new ApiError(message, response.status);
		}
		return response;
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
			if (!token) {
				this._onUnauthorized?.();
				throw new ApiError('Belum login.', 401);
			}
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

		const isWrapped = parsed !== null && typeof parsed === 'object' && 'result' in (parsed as Record<string, unknown>);
		const payload = isWrapped ? (parsed as { result?: unknown }).result : parsed;
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
