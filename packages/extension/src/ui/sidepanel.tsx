import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RecordingApiClient, type RecordingProject, type RecordingSession } from '../recording/apiClient';
import { readAndClearFabIntent } from './fab/fab-settings';
import {
	clearActiveSession,
	clearAuth,
	getActiveSession,
	getBaseUrl,
	getToken,
	getUser,
	saveAuth,
	setActiveSession,
	setBaseUrl,
	type StoredActiveSession,
	type StoredUser
} from '../recording/tokenStore';
import './sidepanel.css';

const DEFAULT_BASE_URL = 'http://localhost:8000';

interface GenerationItem {
	id_generation: number;
	kind: string;
	status: string;
	output: string | null;
	error_message: string | null;
}

export const SidePanelApp: React.FC = () => {
	const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<StoredUser | null>(null);
	const [activeSession, setActiveSessionState] = useState<StoredActiveSession | null>(null);
	const [projects, setProjects] = useState<RecordingProject[]>([]);
	const [sessions, setSessions] = useState<RecordingSession[]>([]);
	const [pendingEvents, setPendingEvents] = useState(0);
	const [generations, setGenerations] = useState<GenerationItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const api = useMemo(
		() =>
			new RecordingApiClient({
				baseUrl,
				getToken,
				onUnauthorized: () => {
					void clearAuth();
					setToken(null);
					setUser(null);
				}
			}),
		[baseUrl]
	);

	const loadBootstrap = useCallback(async () => {
		const [storedBaseUrl, storedToken, storedUser, storedSession] = await Promise.all([
			getBaseUrl(),
			getToken(),
			getUser(),
			getActiveSession()
		]);
		if (storedBaseUrl) setBaseUrlState(storedBaseUrl);
		setToken(storedToken);
		setUser(storedUser);
		setActiveSessionState(storedSession);
	}, []);

	useEffect(() => {
		void loadBootstrap();
	}, [loadBootstrap]);

	const loadProjects = useCallback(async () => {
		try {
			const result = await api.listActiveProjects();
			setProjects(result.items);
		} catch (caught) {
			setError((caught as Error).message);
		}
	}, [api]);

	const loadSessions = useCallback(async () => {
		try {
			const result = await api.listSessions();
			setSessions(result.items);
		} catch (caught) {
			setError((caught as Error).message);
		}
	}, [api]);

	useEffect(() => {
		if (!token) return;
		void loadProjects();
		void loadSessions();
	}, [token, loadProjects, loadSessions]);

	// Intent dari floating button (FAB): fokuskan bagian panel yang diminta.
	useEffect(() => {
		void (async () => {
			try {
				const intent = await readAndClearFabIntent();
				if (!intent) return;
				setNotice(`Diakses dari tombol QA Recorder: ${intent}.`);
				const focus = () => {
					if (intent === 'start') window.scrollTo({ top: 0, behavior: 'smooth' });
					else if (intent === 'checkpoint') {
						const label = Array.from(document.querySelectorAll('label.sp-field')).find((el) =>
							el.textContent?.includes('Catatan / checkpoint')
						);
						label?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					} else if (intent === 'end') {
						const button = Array.from(document.querySelectorAll('button')).find((el) =>
							el.textContent?.includes('End Recording')
						);
						button?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					} else if (intent === 'generate') {
						const button = Array.from(document.querySelectorAll('button')).find((el) =>
							el.textContent?.includes('generate')
						);
						button?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				};
				focus();
				setTimeout(focus, 600);
			} catch {
				// chrome.storage tidak tersedia (mis. di lingkungan test) → abaikan.
			}
		})();
	}, []);

	useEffect(() => {
		if (!activeSession) return;
		const timer = setInterval(async () => {
			const response = await chrome.runtime.sendMessage({ type: 'recordingStatus' });
			setPendingEvents(response?.pendingEvents ?? 0);
		}, 2000);
		return () => clearInterval(timer);
	}, [activeSession]);

	const handleLogin = useCallback(
		async (credentials: { username: string; password: string; baseUrl: string }) => {
			setBusy(true);
			setError(null);
			try {
				const client = new RecordingApiClient({ baseUrl: credentials.baseUrl, getToken: async () => null });
				const result = await client.login(credentials.username, credentials.password);
				await setBaseUrl(credentials.baseUrl);
				await saveAuth(result.token, result.user);
				setBaseUrlState(credentials.baseUrl);
				setToken(result.token);
				setUser(result.user);
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[]
	);

	const handleLogout = useCallback(async () => {
		// Cegah logout saat recording aktif agar recorder tidak berjalan tanpa
		// token (buffer tumbuh tak terbatas, debugger tetap ter-attach).
		if (activeSession) {
			setError('Akhiri recording sebelum logout.');
			return;
		}
		await clearAuth();
		setToken(null);
		setUser(null);
	}, [activeSession]);

	const handleStart = useCallback(
		async (input: {
			id_project: number;
			test_case_no: string;
			title: string;
			description: string;
			target_url: string;
		}) => {
			setBusy(true);
			setError(null);
			setNotice(null);
			try {
				const createdSession = await api.createSession(input);
				const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
				if (!tab?.id) throw new Error('Tidak ada tab aktif untuk direkam.');

				const response = await chrome.runtime.sendMessage({
					type: 'recordingStart',
					idSession: createdSession.id_session,
					apiBaseUrl: baseUrl,
					tabIds: [tab.id]
				});
				if (!response?.success) throw new Error(response?.error ?? 'Gagal memulai recording.');

				const session: StoredActiveSession = {
					id_session: createdSession.id_session,
					id_project: createdSession.id_project,
					test_case_no: createdSession.test_case_no,
					title: createdSession.title,
					group_id: response.groupId ?? null,
					last_sequence: createdSession.last_sequence ?? 0
				};
				await setActiveSession(session);
				setActiveSessionState(session);
				setNotice('Recording berjalan. Tab sudah dimasukkan ke group QA Recording.');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, baseUrl]
	);

	const handleCheckpoint = useCallback(
		async (note: string) => {
			if (!activeSession) return;
			setBusy(true);
			try {
				await api.createCheckpoint(activeSession.id_session, { note });
				setNotice('Checkpoint tersimpan.');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, activeSession]
	);

	const handleEnd = useCallback(
		async (input: { result: string; actual_result: string }) => {
			if (!activeSession) return;
			setBusy(true);
			setError(null);
			let stopWarning: string | null = null;
			try {
				// Hentikan & flush recorder lebih dulu; jika session diakhiri
				// duluan, event terakhir akan ditolak backend (session selesai).
				// Kegagalan stop (SW mati / tidak ada receiver) TIDAK boleh
				// menggagalkan endSession, supaya session tidak tersangkut.
				try {
					const response = await chrome.runtime.sendMessage({ type: 'recordingStop' });
					if (response && response.success === false)
						stopWarning = response.error ?? 'Recorder gagal berhenti.';
				} catch (stopError) {
					stopWarning = (stopError as Error).message;
				}

				await api.endSession(activeSession.id_session, input);
				await clearActiveSession();
				setActiveSessionState(null);
				setNotice(
					stopWarning
						? `Session selesai, tetapi recorder gagal berhenti (${stopWarning}).`
						: 'Session selesai. Generation AI dapat dijalankan dari daftar session.'
				);
				await loadSessions();
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, activeSession, loadSessions]
	);

	const handleGenerate = useCallback(
		async (idSession: number) => {
			setBusy(true);
			setError(null);
			try {
				await api.generateOutputs(idSession);
				const result = await api.listGenerations(idSession);
				setGenerations(result.items as GenerationItem[]);
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api]
	);

	const handleViewGenerations = useCallback(
		async (idSession: number) => {
			try {
				const result = await api.listGenerations(idSession);
				setGenerations(result.items as GenerationItem[]);
			} catch (caught) {
				setError((caught as Error).message);
			}
		},
		[api]
	);

	const downloadOutput = useCallback((item: GenerationItem) => {
		if (!item.output) return;
		const extension = item.kind === 'playwright' ? 'spec.ts' : 'md';
		const blob = new Blob([item.output], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `session-${item.id_generation}.${extension}`;
		anchor.click();
		URL.revokeObjectURL(url);
	}, []);

	return (
		<div className='sp-app'>
			<h1 className='sp-title'>QA Knitto Recorder</h1>
			<p className='sp-subtitle'>Rekam test manual, hasilkan bukti debugging dan draft automation.</p>

			{error && <div className='sp-error'>{error}</div>}
			{notice && <div className='sp-success'>{notice}</div>}

			{!token ? (
				<LoginForm baseUrl={baseUrl} busy={busy} onSubmit={handleLogin} />
			) : (
				<>
					<div className='sp-card'>
						<div className='sp-button-row' style={{ justifyContent: 'space-between' }}>
							<span className='sp-muted'>Login sebagai <strong>{user?.nama ?? user?.username ?? '-'}</strong></span>
							<button className='sp-button secondary' onClick={handleLogout}>Logout</button>
						</div>
					</div>

					{activeSession ? (
						<ActiveSession
							session={activeSession}
							pendingEvents={pendingEvents}
							busy={busy}
							onCheckpoint={handleCheckpoint}
							onEnd={handleEnd}
						/>
					) : (
						<StartForm projects={projects} busy={busy} onSubmit={handleStart} />
					)}

					<SessionHistory
						sessions={sessions}
						busy={busy}
						onRefresh={loadSessions}
						onGenerate={handleGenerate}
						onView={handleViewGenerations}
					/>

					{generations.length > 0 && (
						<div className='sp-card'>
							<div className='sp-label'>Hasil Generation</div>
							{generations.map((item) => (
								<div className='sp-list-item' key={item.id_generation}>
									<div className='sp-button-row' style={{ justifyContent: 'space-between' }}>
										<span>
											<span className='sp-badge'>{item.kind}</span>{' '}
											<span className='sp-muted'>{item.status}</span>
										</span>
										{item.output && (
											<button className='sp-link-button' onClick={() => downloadOutput(item)}>download</button>
										)}
									</div>
									{item.error_message && <div className='sp-muted'>Error: {item.error_message}</div>}
									{item.output && <pre className='sp-pre'>{item.output}</pre>}
								</div>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
};

const LoginForm: React.FC<{
	baseUrl: string;
	busy: boolean;
	onSubmit: (credentials: { username: string; password: string; baseUrl: string }) => void;
}> = ({ baseUrl, busy, onSubmit }) => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [url, setUrl] = useState(baseUrl);

	return (
		<div className='sp-card'>
			<label className='sp-field'>
				<span className='sp-label'>Base URL API</span>
				<input className='sp-input' value={url} onChange={(event) => setUrl(event.target.value)} />
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Username</span>
				<input className='sp-input' value={username} onChange={(event) => setUsername(event.target.value)} />
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Password</span>
				<input
					className='sp-input'
					type='password'
					value={password}
					onChange={(event) => setPassword(event.target.value)}
				/>
			</label>
			<button
				className='sp-button'
				disabled={busy || !username || !password || !url}
				onClick={() => onSubmit({ username, password, baseUrl: url })}
			>
				{busy ? 'Memproses...' : 'Login'}
			</button>
		</div>
	);
};

const StartForm: React.FC<{
	projects: RecordingProject[];
	busy: boolean;
	onSubmit: (input: {
		id_project: number;
		test_case_no: string;
		title: string;
		description: string;
		target_url: string;
	}) => void;
}> = ({ projects, busy, onSubmit }) => {
	const [idProject, setIdProject] = useState<number | ''>('');
	const [testCaseNo, setTestCaseNo] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [targetUrl, setTargetUrl] = useState('');

	const canSubmit = idProject !== '' && testCaseNo.trim() && title.trim() && !busy;

	return (
		<div className='sp-card'>
			<div className='sp-label'>Mulai Recording</div>
			<label className='sp-field'>
				<span className='sp-label'>Project</span>
				<select
					className='sp-select'
					value={idProject}
					onChange={(event) => setIdProject(event.target.value ? Number(event.target.value) : '')}
				>
					<option value=''>Pilih project</option>
					{projects.map((project) => (
						<option key={project.id_project} value={project.id_project}>{project.name}</option>
					))}
				</select>
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Nomor test case</span>
				<input className='sp-input' value={testCaseNo} onChange={(event) => setTestCaseNo(event.target.value)} />
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Judul</span>
				<input className='sp-input' value={title} onChange={(event) => setTitle(event.target.value)} />
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Deskripsi / tujuan</span>
				<textarea className='sp-textarea' value={description} onChange={(event) => setDescription(event.target.value)} />
			</label>
			<label className='sp-field'>
				<span className='sp-label'>Target URL</span>
				<input className='sp-input' value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} />
			</label>
			<button
				className='sp-button'
				disabled={!canSubmit}
				onClick={() =>
					onSubmit({
						id_project: Number(idProject),
						test_case_no: testCaseNo.trim(),
						title: title.trim(),
						description,
						target_url: targetUrl.trim()
					})
				}
			>
				{busy ? 'Memulai...' : 'Start Recording'}
			</button>
		</div>
	);
};

const ActiveSession: React.FC<{
	session: StoredActiveSession;
	pendingEvents: number;
	busy: boolean;
	onCheckpoint: (note: string) => void;
	onEnd: (input: { result: string; actual_result: string }) => void;
}> = ({ session, pendingEvents, busy, onCheckpoint, onEnd }) => {
	const [note, setNote] = useState('');
	const [showEnd, setShowEnd] = useState(false);
	const [result, setResult] = useState('PASS');
	const [actualResult, setActualResult] = useState('');

	return (
		<div className='sp-card'>
			<div className='sp-button-row' style={{ justifyContent: 'space-between' }}>
				<span className='sp-badge'>Recording aktif</span>
				<span className='sp-muted'>#{session.id_session}</span>
			</div>
			<div style={{ marginTop: 8 }}>
				<strong>{session.title}</strong>
				<div className='sp-muted'>{session.test_case_no}</div>
			</div>
			<div className='sp-metrics'>
				<div className='sp-metric'>
					<div className='sp-metric-value'>{pendingEvents}</div>
					<div className='sp-metric-label'>Event menunggu kirim</div>
				</div>
				<div className='sp-metric'>
					<div className='sp-metric-value'>{session.group_id ?? '-'}</div>
					<div className='sp-metric-label'>ID Tab Group</div>
				</div>
			</div>
			<label className='sp-field'>
				<span className='sp-label'>Catatan / checkpoint</span>
				<input className='sp-input' value={note} onChange={(event) => setNote(event.target.value)} />
			</label>
			<div className='sp-button-row'>
				<button
					className='sp-button secondary'
					disabled={busy || !note.trim()}
					onClick={() => {
						onCheckpoint(note.trim());
						setNote('');
					}}
				>
					Add Checkpoint
				</button>
				<button className='sp-button danger' disabled={busy} onClick={() => setShowEnd(true)}>
					End Recording
				</button>
			</div>

			{showEnd && (
				<div style={{ marginTop: 12 }}>
					<label className='sp-field'>
						<span className='sp-label'>Hasil</span>
						<select className='sp-select' value={result} onChange={(event) => setResult(event.target.value)}>
							<option value='PASS'>PASS</option>
							<option value='FAIL'>FAIL</option>
							<option value='BLOCKED'>BLOCKED</option>
						</select>
					</label>
					<label className='sp-field'>
						<span className='sp-label'>Actual result</span>
						<textarea
							className='sp-textarea'
							value={actualResult}
							onChange={(event) => setActualResult(event.target.value)}
						/>
					</label>
					<div className='sp-button-row'>
						<button
							className='sp-button danger'
							disabled={busy}
							onClick={() => onEnd({ result, actual_result: actualResult })}
						>
							Konfirmasi End
						</button>
						<button className='sp-button secondary' disabled={busy} onClick={() => setShowEnd(false)}>
							Batal
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

const SessionHistory: React.FC<{
	sessions: RecordingSession[];
	busy: boolean;
	onRefresh: () => void;
	onGenerate: (idSession: number) => void;
	onView: (idSession: number) => void;
}> = ({ sessions, busy, onRefresh, onGenerate, onView }) => (
	<div className='sp-card'>
		<div className='sp-button-row' style={{ justifyContent: 'space-between' }}>
			<span className='sp-label'>Riwayat Session</span>
			<button className='sp-link-button' onClick={onRefresh}>refresh</button>
		</div>
		{sessions.length === 0 ? (
			<div className='sp-muted'>Belum ada session.</div>
		) : (
			sessions.map((session) => (
				<div className='sp-list-item' key={session.id_session}>
					<div className='sp-button-row' style={{ justifyContent: 'space-between' }}>
						<span>
							<strong>{session.title}</strong>{' '}
							<span className='sp-muted'>{session.test_case_no} - {session.status}{session.result ? ` / ${session.result}` : ''}</span>
						</span>
						<span className='sp-button-row'>
							<button className='sp-link-button' disabled={busy} onClick={() => onGenerate(session.id_session)}>
								generate
							</button>
							<button className='sp-link-button' onClick={() => onView(session.id_session)}>hasil</button>
						</span>
					</div>
				</div>
			))
		)}
	</div>
);

const container = document.getElementById('root');
if (container) {
	createRoot(container).render(<SidePanelApp />);
}
