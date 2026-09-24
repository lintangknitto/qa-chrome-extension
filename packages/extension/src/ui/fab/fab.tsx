import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	fabViewTitles,
	type FabSettings,
	type FabView
} from './fab-state';
import { isFabStateChanged, requestFabState } from './fab-messaging';
import { saveFabSettings } from './fab-settings';
import { FabLogo } from './FabLogo';
import {
	RecordingApiClient,
	type RecordingProject,
	type RecordingSession
} from '../../recording/apiClient';
import {
	clearActiveSession,
	clearAuth,
	getActiveSession,
	getBaseUrl,
	getToken,
	getUser,
	saveAuth,
	setActiveSession,
	type StoredActiveSession,
	type StoredUser
} from '../../recording/tokenStore';
import { LoginView } from './views/LoginView';
import { StartView, type PrefilledTestCase } from './views/StartView';
import { ActiveView } from './views/ActiveView';
import { ResultView } from './views/ResultView';
import { HistoryView, type GenerationItem } from './views/HistoryView';
import { ProjectView } from './views/ProjectView';
import { Toast } from './components/Toast';
import { Play, History, Settings, LogOut, User, FolderKanban } from 'lucide-react';
import type { TestCaseItem } from '../../recording/apiClient';

const DEFAULT_SIDEBAR_WIDTH = 520;
const MIN_SIDEBAR_WIDTH = 420;
const DEFAULT_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:8010';

interface FabAppProps {
	settings: FabSettings;
}

const isExtensionContextValid = (): boolean => {
	try {
		if (typeof chrome === 'undefined' || !chrome.runtime) return false;
		const id = chrome.runtime.id;
		if (typeof id === 'string') return id.length > 0;
		return typeof chrome.runtime.sendMessage === 'function';
	} catch {
		return false;
	}
};

export const FabApp = (props: FabAppProps): React.ReactElement => {
	const [state, setState] = useState<'idle' | 'recording'>('idle');
	const stateRef = useRef<'idle' | 'recording'>('idle');
	const [pending, setPending] = useState(0);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [noticeType, setNoticeType] = useState<'success' | 'info' | 'error'>('info');
	const [error, setError] = useState<string | null>(null);
	const [settings, setSettings] = useState<FabSettings>(props.settings);
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<FabView>('root');
	const [railCollapsed, setRailCollapsed] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	// Resizable sidebar states
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		const w = props.settings.width;
		return typeof w === 'number' && w >= MIN_SIDEBAR_WIDTH && w <= 1400
			? w
			: DEFAULT_SIDEBAR_WIDTH;
	});
	const [isResizing, setIsResizing] = useState(false);
	const resizingRef = useRef({
		startX: 0,
		startWidth: DEFAULT_SIDEBAR_WIDTH,
		currentWidth: DEFAULT_SIDEBAR_WIDTH
	});

	useEffect(() => {
		if (typeof props.settings.width === 'number' && props.settings.width >= MIN_SIDEBAR_WIDTH) {
			setSidebarWidth(props.settings.width);
		}
	}, [props.settings.width]);

	const handleResizeStart = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			setIsResizing(true);
			resizingRef.current = {
				startX: e.clientX,
				startWidth: sidebarWidth,
				currentWidth: sidebarWidth
			};

			const handlePointerMove = (ev: PointerEvent) => {
				const { startX, startWidth } = resizingRef.current;
				let delta = 0;
				if (settings.side === 'right') {
					// Sidebar di kanan: geser mouse ke kiri (ev.clientX < startX) melebarkan sidebar
					delta = startX - ev.clientX;
				} else {
					// Sidebar di kiri: geser mouse ke kanan (ev.clientX > startX) melebarkan sidebar
					delta = ev.clientX - startX;
				}
				const maxAllowed = Math.min(1400, Math.max(500, window.innerWidth - 40));
				const clamped = Math.min(Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta), maxAllowed);
				resizingRef.current.currentWidth = clamped;
				setSidebarWidth(clamped);
			};

			const handlePointerUp = () => {
				window.removeEventListener('pointermove', handlePointerMove);
				window.removeEventListener('pointerup', handlePointerUp);
				setIsResizing(false);
				const finalWidth = resizingRef.current.currentWidth;
				const updatedSettings = { ...settings, width: finalWidth };
				setSettings(updatedSettings);
				void saveFabSettings(updatedSettings).catch(() => {});
			};

			window.addEventListener('pointermove', handlePointerMove);
			window.addEventListener('pointerup', handlePointerUp);
		},
		[sidebarWidth, settings]
	);

	// Auth & Recording data states
	const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<StoredUser | null>(null);
	const [activeSession, setActiveSessionState] = useState<StoredActiveSession | null>(null);
	const [projects, setProjects] = useState<RecordingProject[]>([]);
	const [activeProjectInView, setActiveProjectInView] = useState<RecordingProject | null>(null);
	const [sessions, setSessions] = useState<RecordingSession[]>([]);
	const [generations, setGenerations] = useState<GenerationItem[]>([]);
	const [activeGenSessionId, setActiveGenSessionId] = useState<number | null>(null);
	const [prefilledTestCase, setPrefilledTestCase] = useState<PrefilledTestCase | null>(null);

	const api = useMemo(
		() =>
			new RecordingApiClient({
				baseUrl,
				getToken,
				onUnauthorized: () => {
					void clearAuth().catch(() => {});
					void clearActiveSession().catch(() => {});
					setToken(null);
					setUser(null);
					setActiveSessionState(null);
					setState('idle');
					stateRef.current = 'idle';
					setView('login');
				}
			}),
		[baseUrl]
	);

	const loadBootstrap = useCallback(async () => {
		try {
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
			if (!storedToken) {
				setView('login');
			}
		} catch {
			// Environment without full chrome.storage (e.g. unit tests without mocks)
		}
	}, []);

	useEffect(() => {
		void loadBootstrap();
		const onStorageChange = (_changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
			if (areaName === 'local') {
				void loadBootstrap();
			}
		};
		try {
			if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
				chrome.storage.onChanged.addListener(onStorageChange);
				return () => {
					try {
						if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
							chrome.storage.onChanged.removeListener(onStorageChange);
						}
					} catch {
						// Context invalidated
					}
				};
			}
		} catch {
			// Context invalidated
		}
	}, [loadBootstrap]);

	const loadProjects = useCallback(async () => {
		try {
			const result = await api.listActiveProjects();
			setProjects(result.items);
			return result.items;
		} catch (caught) {
			setError((caught as Error).message);
			return [];
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

	useEffect(() => {
		let cancelled = false;
		void requestFabState()
			.then((fabState) => {
				if (cancelled) return;
				const next = fabState.recording ? 'recording' : 'idle';
				setState(next);
				stateRef.current = next;
				setPending(fabState.pendingEvents);
			})
			.catch(() => {});

		const onMessage = (message: unknown): void => {
			if (!isFabStateChanged(message)) return;
			const next: 'idle' | 'recording' = message.state.recording ? 'recording' : 'idle';
			stateRef.current = next;
			setState(next);
			setPending(message.state.pendingEvents);
			if (next === 'recording') {
				setView((current) => (current === 'root' || current === 'start' ? 'active' : current));
			}
		};

		try {
			if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
				chrome.runtime.onMessage.addListener(onMessage);
			}
		} catch {
			// Context invalidated
		}

		return () => {
			cancelled = true;
			try {
				if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
					chrome.runtime.onMessage.removeListener(onMessage);
				}
			} catch {
				// Context invalidated
			}
		};
	}, []);

	// Polling pending events saat recording aktif
	useEffect(() => {
		if (state !== 'recording') return;
		const timer = setInterval(() => {
			void requestFabState()
				.then((fabState) => {
					setPending(fabState.pendingEvents);
				})
				.catch(() => {});
		}, 2000);
		return () => clearInterval(timer);
	}, [state]);

	const showNotice = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'info') => {
		setNotice(msg);
		setNoticeType(type);
	}, []);

	const handleCloseNotice = useCallback(() => {
		setNotice(null);
	}, []);

	// Tutup dengan Esc ketika sidebar terbuka
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				if (rootRef.current?.querySelector('.k-modal-overlay')) {
					return;
				}
				setOpen(false);
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open]);

	const closeAll = useCallback(() => {
		setOpen(false);
	}, []);

	const handleBack = useCallback(() => {
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		if (view === 'result') {
			setView('active');
		} else {
			setView(stateRef.current === 'recording' ? 'active' : 'start');
		}
	}, [view, token]);

	const handleNavigateRecorder = useCallback(() => {
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (state === 'recording' || activeSession) {
			setView('active');
		} else if (!token) {
			setView('login');
		} else {
			setView('start');
		}
	}, [state, activeSession, token]);

	const handleNavigateProjects = useCallback(() => {
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		setView('projects');
	}, []);

	const handleSelectTestCaseForRecording = useCallback((project: RecordingProject, testCase: TestCaseItem) => {
		setPrefilledTestCase({
			id_project: project.id_project,
			id_test_case: testCase.id_test_case,
			test_case_no: testCase.test_case_id,
			title: testCase.title,
			target_url: project.base_url || undefined,
			pre_condition: testCase.pre_condition || undefined,
			expected_result: testCase.expected_result || undefined
		});
		setRailCollapsed(true);
		setError(null);
		setView('start');
		showNotice(`Skenario ${testCase.test_case_id} dipilih. Siap direkam.`, 'info');
	}, [showNotice]);

	const handleNavigateHistory = useCallback(() => {
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		setView('history');
	}, []);

	const handleNavigateSetting = useCallback(() => {
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		setView('setting');
	}, []);

	const handleLogin = useCallback(
		async (credentials: { username: string; password: string }) => {
			setBusy(true);
			setError(null);
			setNotice(null);
			try {
				const client = new RecordingApiClient({ baseUrl, getToken: async () => null });
				const result = await client.login(credentials.username, credentials.password);
				await saveAuth(result.token, result.user);
				setToken(result.token);
				setUser(result.user);
				setView('start');
				showNotice('Login berhasil.', 'success');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[baseUrl]
	);

	const handleLogout = useCallback(async () => {
		const isContextValid = isExtensionContextValid();

		if (isContextValid && state === 'recording') {
			setError('Akhiri recording sebelum logout.');
			return;
		}

		try {
			await clearAuth();
		} catch (err) {
			console.warn('Gagal menghapus auth:', err);
		}
		try {
			await clearActiveSession();
		} catch (err) {
			console.warn('Gagal menghapus active session:', err);
		}

		setToken(null);
		setUser(null);
		setActiveSessionState(null);
		setState('idle');
		stateRef.current = 'idle';
		setView('login');
		showNotice('Berhasil logout.', 'info');
	}, [state, showNotice]);

	const handleCreateProject = useCallback(
		async (input: { name: string; base_url?: string; description?: string }) => {
			const created = await api.createProject(input);
			await loadProjects();
			showNotice('Project berhasil dibuat.', 'success');
			return created.id_project;
		},
		[api, loadProjects, showNotice]
	);

	const handleStart = useCallback(
		async (input: {
			id_project?: number | null;
			id_test_case?: number | null;
			test_case_no: string;
			title: string;
			description: string;
			target_url: string;
			expected_result?: string | null;
		}) => {
			setBusy(true);
			setError(null);
			setNotice(null);
			try {
				const createdSession = await api.createSession(input);
				let tabIds: number[] = [];
				try {
					if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
						const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
						if (tab?.id) tabIds = [tab.id];
					}
				} catch {
					// Fallback to background sender.tab if chrome.tabs.query unavailable
				}

				const response = await new Promise<{ success?: boolean; error?: string; groupId?: number }>((resolve) => {
					try {
						if (!isExtensionContextValid() || !chrome.runtime?.sendMessage) {
							return resolve({
								success: false,
								error: 'Koneksi extension terputus (ekstensi baru di-reload). Silakan refresh halaman ini.'
							});
						}
						chrome.runtime.sendMessage(
							{
								type: 'recordingStart',
								idSession: createdSession.id_session,
								apiBaseUrl: baseUrl,
								tabIds
							},
							(res: { success?: boolean; error?: string; groupId?: number } | undefined) => {
								try {
									if (chrome.runtime?.lastError) {
										return resolve({ success: false, error: chrome.runtime.lastError.message });
									}
									resolve(res ?? { success: false, error: 'Tidak ada respon dari Service Worker' });
								} catch (cbErr) {
									resolve({ success: false, error: (cbErr as Error).message });
								}
							}
						);
					} catch (sendErr) {
						resolve({
							success: false,
							error: 'Koneksi extension terputus (ekstensi baru di-reload). Silakan refresh halaman ini.'
						});
					}
				});

				if (!response?.success) throw new Error(response?.error ?? 'Gagal memulai recording.');

				const session: StoredActiveSession = {
					id_session: createdSession.id_session,
					id_project: createdSession.id_project ?? input.id_project ?? null,
					id_test_case: createdSession.id_test_case ?? input.id_test_case ?? null,
					test_case_no: createdSession.test_case_no,
					title: createdSession.title,
					expected_result: input.expected_result ?? prefilledTestCase?.expected_result ?? null,
					group_id: response.groupId ?? null,
					last_sequence: createdSession.last_sequence ?? 0,
					started_at: Date.now()
				};
				await setActiveSession(session);
				setActiveSessionState(session);
				setState('recording');
				stateRef.current = 'recording';
				setView('active');
				showNotice('Recording berjalan. Tab sudah dimasukkan ke group Knitto QA Tools.', 'info');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, baseUrl, prefilledTestCase, showNotice]
	);

	const handleCheckpoint = useCallback(
		async (note: string) => {
			const currentSession = activeSession;
			if (!currentSession) return;
			setBusy(true);
			setError(null);
			try {
				await api.createCheckpoint(currentSession.id_session, { note });
				showNotice('Checkpoint tersimpan.', 'success');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, activeSession, showNotice]
	);

	const handleEnd = useCallback(
		async (input: { result: string; actual_result: string }) => {
			const currentSession = activeSession;
			if (!currentSession) return;
			setBusy(true);
			setError(null);
			let stopWarning: string | null = null;
			try {
				try {
					const response = await new Promise<{ success?: boolean; error?: string }>((resolve) => {
						try {
							if (!isExtensionContextValid() || !chrome.runtime?.sendMessage) {
								return resolve({
									success: false,
									error: 'Koneksi extension terputus (ekstensi baru di-reload).'
								});
							}
							chrome.runtime.sendMessage({ type: 'recordingStop' }, (res) => {
								try {
									if (chrome.runtime?.lastError) {
										return resolve({ success: false, error: chrome.runtime.lastError.message });
									}
									resolve(res ?? { success: true });
								} catch {
									resolve({ success: true });
								}
							});
						} catch (sendErr) {
							resolve({ success: false, error: (sendErr as Error).message });
						}
					});
					if (response && response.success === false)
						stopWarning = response.error ?? 'Recorder gagal berhenti.';
				} catch (stopError) {
					stopWarning = (stopError as Error).message;
				}

				await api.endSession(currentSession.id_session, input);
				await clearActiveSession();
				setActiveSessionState(null);
				setPrefilledTestCase(null);
				setState('idle');
				stateRef.current = 'idle';
				setPending(0);
				setNotice(
					stopWarning
						? `Session selesai, tetapi recorder gagal berhenti (${stopWarning}).`
						: 'Session selesai. Output automation dapat digenerate.'
				);
				await loadSessions();
				await loadProjects();
				setView('history');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, activeSession, loadSessions, loadProjects]
	);

	const handleGenerate = useCallback(
		async (idSession: number) => {
			setBusy(true);
			setError(null);
			try {
				await api.generateOutputs(idSession);
				const result = await api.listGenerations(idSession);
				setGenerations(result.items as GenerationItem[]);
				setActiveGenSessionId(idSession);
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
				setActiveGenSessionId(idSession);
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
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}, []);

	const setSide = useCallback((side: 'left' | 'right') => {
		const next = { ...settings, side };
		setSettings(next);
		void saveFabSettings(next).catch(() => {});
	}, [settings]);

	const side = settings.side;
	const triggerStyle: React.CSSProperties = {
		top: '40%',
		[side]: open ? sidebarWidth + 12 : 0,
		transition: isResizing ? 'none' : undefined
	};
	const sidebarStyle: React.CSSProperties = {
		width: `${sidebarWidth}px`,
		[side]: open ? 0 : -sidebarWidth,
		transition: isResizing ? 'none' : undefined,
		userSelect: isResizing ? 'none' : undefined
	};

	const currentView: FabView = !token ? 'login' : view;
	const isRecorderActive = currentView === 'start' || currentView === 'active' || currentView === 'result';
	const userLevel = (user?.level ?? '').toUpperCase();
	const username = (user?.username ?? '').toLowerCase();
	const canCreateProject =
		Boolean(user) &&
		(!user?.level ||
			['QA', 'ADMIN', 'SUPERADMIN', 'IMPLEMENTOR'].includes(userLevel) ||
			username === 'qatester');

	const getFooterContent = () => {
		if (busy) {
			return {
				dotClass: 'busy',
				text: 'Memproses permintaan…',
				badge: 'Loading',
				isRecording: false
			};
		}
		if (state === 'recording') {
			return {
				dotClass: 'recording',
				text: `Recording aktif${pending > 0 ? ` · ${pending} event menunggu` : ' · Merekam interaksi'}`,
				badge: pending > 0 ? `${pending} pending` : 'Merekam',
				isRecording: true
			};
		}

		switch (currentView) {
			case 'start':
				return {
					dotClass: 'ready',
					text: 'Siap merekam — tentukan project & klik Start Recording',
					badge: 'Ready',
					isRecording: false
				};
			case 'projects':
				if (activeProjectInView) {
					return {
						dotClass: 'ready',
						text: `Project: ${activeProjectInView.name}`,
						badge: activeProjectInView.code || 'Project',
						isRecording: false
					};
				}
				return {
					dotClass: 'ready',
					text: 'Manajemen Project & Test Case',
					badge: `${projects.length} Project`,
					isRecording: false
				};
			case 'history':
				return {
					dotClass: 'ready',
					text: 'Riwayat Sesi Recording & Generator AI',
					badge: `${sessions.length} Sesi`,
					isRecording: false
				};
			case 'setting':
				return {
					dotClass: '',
					text: 'Pengaturan Sidebar & Ekstensi',
					badge: `Dock: ${settings.side === 'right' ? 'Kanan' : 'Kiri'}`,
					isRecording: false
				};
			case 'active':
				return {
					dotClass: 'recording',
					text: 'Sesi recording sedang berlangsung',
					badge: 'Aktif',
					isRecording: true
				};
			case 'result':
				return {
					dotClass: 'ready',
					text: 'Review & Simpan Hasil Recording',
					badge: 'Selesai',
					isRecording: false
				};
			default:
				return {
					dotClass: '',
					text: 'Knitto QA Tools',
					badge: null,
					isRecording: false
				};
		}
	};

	const footerInfo = getFooterContent();

	return (
		<div ref={rootRef} className="fab-root" data-side={side}>
			{open ? (
				<button className="fab-backdrop" aria-label="Tutup sidebar" onClick={closeAll} />
			) : null}

			<aside
				className="fab-sidebar"
				role="dialog"
				aria-modal="true"
				aria-label="Knitto QA Tools"
				style={sidebarStyle}
				data-open={open}
			>
				{open && (
					<div
						className={`fab-sidebar-resizer ${isResizing ? 'active' : ''}`}
						role="separator"
						aria-orientation="vertical"
						aria-label="Ubah ukuran sidebar"
						title="Tarik untuk mengubah lebar sidebar"
						onPointerDown={handleResizeStart}
					>
						<div className="fab-sidebar-resizer-line" />
						<div className="fab-sidebar-resizer-grip" />
					</div>
				)}
				{!token ? (
					<>
						<div className="fab-sidebar-header">
							<span>{fabViewTitles[currentView] ?? 'Login'}</span>
							<button className="fab-sidebar-close" aria-label="Tutup" onClick={closeAll}>
								✕
							</button>
						</div>
						<div className="fab-sidebar-body">
							<LoginView
								busy={busy}
								error={error}
								onSubmit={handleLogin}
							/>
							<Toast message={notice} type={noticeType} onClose={handleCloseNotice} />
						</div>
					</>
				) : (
					<div className="fab-layout">
						<div className="fab-rail-spacer" aria-hidden="true" />
						<nav
							className={`fab-rail ${railCollapsed ? 'fab-rail-collapsed' : ''}`}
							data-collapsed={railCollapsed ? 'true' : 'false'}
							aria-label="Navigasi Utama"
							onMouseEnter={() => setRailCollapsed(false)}
							onMouseLeave={() => setRailCollapsed(false)}
						>
							<div className="fab-rail-top">
								<div className="fab-rail-brand" title="Knitto QA Tools">
									<div className="fab-rail-logo">
										<FabLogo />
									</div>
									<div className="fab-rail-brand-text">
										<span className="fab-rail-brand-name">Knitto QA</span>
										<span className="fab-rail-brand-sub">Test Automation</span>
									</div>
								</div>
								<div className="fab-rail-nav">
									<button
										className={`fab-rail-btn ${isRecorderActive ? 'active' : ''}`}
										aria-label="Recorder"
										title="Recorder"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigateRecorder();
										}}
									>
										<div className="fab-rail-btn-icon">
											<Play size={18} />
											{state === 'recording' && <span className="fab-rail-dot" />}
										</div>
										<span className="fab-rail-label">Recorder</span>
										{state === 'recording' && (
											<span className="fab-rail-badge">LIVE</span>
										)}
									</button>

									<button
										className={`fab-rail-btn ${currentView === 'projects' ? 'active' : ''}`}
										aria-label="Project"
										title="Project & Test Cases"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigateProjects();
										}}
									>
										<div className="fab-rail-btn-icon">
											<FolderKanban size={18} />
										</div>
										<span className="fab-rail-label">Project</span>
									</button>

									<button
										className={`fab-rail-btn ${currentView === 'history' ? 'active' : ''}`}
										aria-label="Riwayat"
										title="Riwayat"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigateHistory();
										}}
									>
										<div className="fab-rail-btn-icon">
											<History size={18} />
										</div>
										<span className="fab-rail-label">Riwayat Rekaman</span>
									</button>

									<button
										className={`fab-rail-btn ${currentView === 'setting' ? 'active' : ''}`}
										aria-label="Setting"
										title="Setting"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigateSetting();
										}}
									>
										<div className="fab-rail-btn-icon">
											<Settings size={18} />
										</div>
										<span className="fab-rail-label">Pengaturan</span>
									</button>
								</div>
							</div>

							<div className="fab-rail-bottom">
								<div
									className="fab-rail-user"
									title={`${user?.nama ?? user?.username ?? 'User'} (${user?.level ?? 'QA'})`}
								>
									<div
										className="fab-rail-avatar"
										title={`${user?.nama ?? user?.username ?? 'User'} (${user?.level ?? 'QA'})`}
										aria-label={`User: ${user?.nama ?? user?.username ?? 'User'}`}
									>
										{user?.nama ? user.nama.charAt(0).toUpperCase() : <User size={16} />}
									</div>
									<div className="fab-rail-user-info">
										<span className="fab-rail-user-name" title={user?.nama ?? user?.username ?? 'User'}>
											{user?.nama ?? user?.username ?? 'User'}
										</span>
										<span className="fab-rail-user-level">{user?.level ?? 'QA'}</span>
									</div>
								</div>
								<button
									className="fab-rail-btn fab-rail-logout"
									aria-label="Logout"
									title="Logout"
									onClick={handleLogout}
								>
									<div className="fab-rail-btn-icon">
										<LogOut size={18} />
									</div>
									<span className="fab-rail-label">Logout</span>
								</button>
							</div>
						</nav>

						<div className="fab-panel">
							<div className="fab-panel-header">
								<div className="fab-panel-title">
									{currentView !== 'start' && currentView !== 'active' ? (
										<button
											className="fab-sidebar-back"
											aria-label="Kembali ke menu utama"
											onClick={handleBack}
										>
											←
										</button>
									) : null}
									<span>{fabViewTitles[currentView] ?? 'Knitto QA Tools'}</span>
								</div>
								<button className="fab-sidebar-close" aria-label="Tutup" onClick={closeAll}>
									✕
								</button>
							</div>

							<div className="fab-panel-body">
								{currentView === 'start' ? (
									<StartView
										user={user}
										projects={projects}
										api={api}
										busy={busy}
										error={error}
										prefilledTestCase={prefilledTestCase}
										onSubmit={handleStart}
										onCreateProject={handleCreateProject}
									/>
								) : currentView === 'projects' ? (
									<ProjectView
										projects={projects}
										api={api}
										canCreateProject={canCreateProject}
										onRefreshProjects={async () => {
											await loadProjects();
										}}
										onCreateProject={handleCreateProject}
										onSelectTestCaseForRecording={handleSelectTestCaseForRecording}
										onActiveProjectChange={setActiveProjectInView}
										onShowToast={(msg, toastType) => {
											if (toastType === 'error') {
												setError(msg);
											} else {
												showNotice(msg, toastType ?? 'success');
											}
										}}
									/>
								) : currentView === 'active' ? (
									activeSession ? (
										<ActiveView
											session={activeSession}
											pendingEvents={pending}
											busy={busy}
											error={error}
											onCheckpoint={handleCheckpoint}
											onNavigateEnd={() => setView('result')}
										/>
									) : (
										<div className="sp-card">
											<div className="sp-muted">Memuat data sesi recording...</div>
										</div>
									)
								) : currentView === 'result' ? (
									activeSession ? (
										<ResultView
											session={activeSession}
											busy={busy}
											error={error}
											onConfirmEnd={handleEnd}
											onCancel={() => setView('active')}
										/>
									) : (
										<div className="sp-card">
											<div className="sp-muted">Memuat data sesi recording...</div>
										</div>
									)
								) : currentView === 'history' ? (
									<HistoryView
										sessions={sessions}
										generations={generations}
										activeSessionId={activeGenSessionId}
										busy={busy}
										error={error}
										onRefresh={loadSessions}
										onGenerate={handleGenerate}
										onViewGenerations={handleViewGenerations}
										onDownload={downloadOutput}
									/>
								) : currentView === 'setting' ? (
									<div>
										{error && <div className="sp-error" style={{ marginBottom: 12 }}>{error}</div>}
										<div className="fab-setting-group k-card" style={{ padding: 16 }}>
											<div style={{ marginBottom: 12 }}>
												<div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Pengaturan Sidebar</div>
												<div className="sp-muted" style={{ fontSize: 11, marginTop: 2 }}>Pilih sisi docking untuk FAB dan sidebar</div>
											</div>
											<div className="fab-setting-label" style={{ marginBottom: 6, fontWeight: 500, fontSize: 12, color: '#334155' }}>
												Sisi sidebar
											</div>
											<div className="k-segmented fab-setting-radios">
												<button
													className={`k-segmented-btn fab-setting-radio ${settings.side === 'right' ? 'active fab-active' : ''}`}
													onClick={() => setSide('right')}
												>
													Kanan
												</button>
												<button
													className={`k-segmented-btn fab-setting-radio ${settings.side === 'left' ? 'active fab-active' : ''}`}
													onClick={() => setSide('left')}
												>
													Kiri
												</button>
											</div>
										</div>
									</div>
								) : (
									<StartView
										user={user}
										projects={projects}
										api={api}
										busy={busy}
										error={error}
										prefilledTestCase={prefilledTestCase}
										onSubmit={handleStart}
										onCreateProject={handleCreateProject}
									/>
								)}
							</div>
							<Toast message={notice} type={noticeType} onClose={handleCloseNotice} />
							<div
								className={`fab-sidebar-footer${footerInfo.isRecording ? ' fab-footer-recording' : ''}`}
							>
								<div className="fab-footer-left">
									<span className={`fab-footer-dot ${footerInfo.dotClass}`} />
									<span className="fab-footer-text">{footerInfo.text}</span>
								</div>
								{footerInfo.badge ? (
									<span className={`fab-footer-badge ${footerInfo.isRecording ? 'recording' : ''}`}>
										{footerInfo.badge}
									</span>
								) : null}
							</div>
						</div>
					</div>
				)}
			</aside>

			<button
				className={`fab-trigger ${side === 'left' ? 'fab-side-left' : ''}`}
				style={triggerStyle}
				aria-label="Knitto QA Tools"
				aria-expanded={open}
				onClick={() => {
					setOpen((value) => {
						const next = !value;
						if (next) {
							if (stateRef.current === 'recording') {
								setView('active');
							} else if (!token) {
								setView('login');
							} else {
								setView((curr) => (curr === 'login' || curr === 'root' ? 'start' : curr));
							}
						}
						return next;
					});
				}}
			>
				<FabLogo />
				{state === 'recording' ? (
					<span
						className="fab-rec-dot"
						aria-label={pending > 0 ? `${pending} event menunggu dikirim` : 'Recording aktif'}
					/>
				) : null}
			</button>
		</div>
	);
};