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
	setBaseUrl,
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
import { ProgramView } from './views/ProgramView';
import { ProjectView } from './views/ProjectView';
import { CleanerView } from './views/CleanerView';
import { UserManagementView } from './views/UserManagementView';
import { ChangePasswordModal } from './views/ChangePasswordModal';
import { TestCaseResultModal } from './views/TestCaseResultModal';
import { Toast } from './components/Toast';
import { Play, History, Settings, LogOut, User, FolderKanban, Layers, Wrench, ChevronDown, ChevronRight, Trash2, Video, RefreshCw, Users, KeyRound } from 'lucide-react';
import { canManageUsers } from './fab-permissions';
import type { TestCaseItem } from '../../recording/apiClient';
import { io, type Socket } from 'socket.io-client';

const DEFAULT_SIDEBAR_WIDTH = 520;
const MIN_SIDEBAR_WIDTH = 420;
const DEFAULT_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://192.168.21.38:8010';

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
	const [isToolsExpanded, setIsToolsExpanded] = useState(false);
	const toolsHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
	const [baseUrl, setBaseUrlState] = useState(props.settings.initialBaseUrl || DEFAULT_BASE_URL);
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<StoredUser | null>(null);
	const [activeSession, setActiveSessionState] = useState<StoredActiveSession | null>(null);
	const [projects, setProjects] = useState<RecordingProject[]>([]);
	const [activeProjectInView, setActiveProjectInView] = useState<RecordingProject | null>(null);
	const [sessions, setSessions] = useState<RecordingSession[]>([]);
	const [generations, setGenerations] = useState<GenerationItem[]>([]);
	const [activeGenSessionId, setActiveGenSessionId] = useState<number | null>(null);
	const [activeGenerations, setActiveGenerations] = useState<Map<number, { id_session: number; title: string; status: 'processing' | 'completed' | 'failed'; startTime: number; error?: string }>>(new Map());
	const [prefilledTestCase, setPrefilledTestCase] = useState<PrefilledTestCase | null>(null);
	const [isResultModalOpen, setResultModalOpen] = useState(false);
	const [resultModalSessionId, setResultModalSessionId] = useState<number | null>(null);
	const [resultModalTestCase, setResultModalTestCase] = useState<TestCaseItem | null>(null);
	const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

	const showNotice = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'info') => {
		setNotice(msg);
		setNoticeType(type);
	}, []);

	const handleCloseNotice = useCallback(() => {
		setNotice(null);
	}, []);

	const handleOpenSessionDetail = useCallback((session: RecordingSession) => {
		setResultModalSessionId(session.id_session);
		setResultModalTestCase(null);
		setResultModalOpen(true);
	}, []);

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
					setError(null);
					setNotice(null);
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
			if (storedBaseUrl) {
				setBaseUrlState(storedBaseUrl);
			}
			setToken(storedToken);
			const effectiveUser = storedUser || (storedToken ? { id_user: 1, username: 'tester', nama: 'QA Tester', level: 'QA' } : null);
			setUser(effectiveUser);
			setActiveSessionState(storedSession);
			if (!storedToken) {
				setView('login');
			} else if (storedSession) {
				setView((curr) => (curr === 'root' || curr === 'start' ? 'active' : curr));
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
			const isAuthErr =
				(caught as any)?.status === 401 ||
				(caught as Error)?.message?.toLowerCase().includes('login');
			if (!isAuthErr) {
				setError((caught as Error).message);
			}
			return [];
		}
	}, [api]);

	const loadSessions = useCallback(async () => {
		try {
			const result = await api.listSessions();
			setSessions(result.items);
			if (result.items && Array.isArray(result.items)) {
				setActiveSessionState((prev) => {
					if (prev && stateRef.current !== 'recording') {
						const match = result.items.find((s) => s.id_session === prev.id_session);
						if (match && match.status !== 'recording') {
							void clearActiveSession();
							return null;
						}
					}
					return prev;
				});
			}
		} catch (caught) {
			const isAuthErr =
				(caught as any)?.status === 401 ||
				(caught as Error)?.message?.toLowerCase().includes('login');
			if (!isAuthErr) {
				setError((caught as Error).message);
			}
		}
	}, [api]);

	const [activeHangingSession, setActiveHangingSession] = useState<RecordingSession | null>(null);

	const checkActiveHangingSession = useCallback(async () => {
		if (!token || typeof api.getActiveSession !== 'function') return null;
		try {
			const active = await api.getActiveSession();
			const isValidActive = Boolean(
				active &&
				typeof active === 'object' &&
				typeof active.id_session === 'number' &&
				!Number.isNaN(active.id_session)
			);
			const validActiveSession = isValidActive ? (active as RecordingSession) : null;
			setActiveHangingSession(validActiveSession);
			if (validActiveSession) {
				setActiveSessionState((prev) => {
					if (prev && prev.id_session === validActiveSession.id_session) return prev;
					const stored: StoredActiveSession = {
						id_session: validActiveSession.id_session,
						id_project: validActiveSession.id_project ?? null,
						id_test_case: validActiveSession.id_test_case ?? null,
						test_case_no: validActiveSession.test_case_no,
						title: validActiveSession.title,
						expected_result: validActiveSession.expected_result ?? null,
						group_id: null,
						last_sequence: validActiveSession.last_sequence ?? 0,
						started_at: Date.now(),
						record_video: true
					};
					void setActiveSession(stored);
					return stored;
				});
			} else {
				// Tidak ada active session di server: rekonsiliasi state lokal agar ghost session tidak nyangkut
				if (stateRef.current !== 'recording') {
					setActiveSessionState((prev) => {
						if (prev) {
							void clearActiveSession();
						}
						return null;
					});
				}
			}
			return validActiveSession;
		} catch {
			return null;
		}
	}, [api, token]);

	const handleDiscardActiveSession = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
			try {
				if (isExtensionContextValid() && chrome.runtime?.sendMessage) {
					chrome.runtime.sendMessage({ type: 'recordingStop' });
				}
			} catch {
				// Ignore background error
			}
			if (typeof api.discardActiveSession === 'function') {
				try {
					await api.discardActiveSession();
				} catch (discardErr) {
					console.warn('discardActiveSession api call warning:', discardErr);
				}
			}
			await clearActiveSession();
			setActiveSessionState(null);
			setActiveHangingSession(null);
			setState('idle');
			stateRef.current = 'idle';
			setView((curr) => (curr === 'active' || curr === 'result' ? 'start' : curr));
			showNotice('Sesi rekaman menggantung berhasil diakhiri dan dibuang.', 'success');
			void loadSessions();
			void loadProjects();
		} catch (err) {
			setError((err as Error).message || 'Gagal mengakhiri sesi.');
		} finally {
			setBusy(false);
		}
	}, [api, showNotice, loadSessions, loadProjects]);

	const handleResumeActiveSession = useCallback(
		async (sess: RecordingSession) => {
			setBusy(true);
			setError(null);
			try {
				const tabIds: number[] = [];
				try {
					if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
						const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
						if (typeof tabs[0]?.id === 'number') tabIds.push(tabs[0].id);
					}
				} catch {
					// The background sender can fall back to its originating tab.
				}

				let groupId: number | null = null;
				if (stateRef.current !== 'recording') {
					const response = await new Promise<{ success?: boolean; error?: string; groupId?: number }>((resolve) => {
						if (!isExtensionContextValid() || !chrome.runtime?.sendMessage) {
							resolve({ success: false, error: 'Koneksi extension terputus. Muat ulang extension lalu coba lagi.' });
							return;
						}
						chrome.runtime.sendMessage(
							{ type: 'recordingStart', idSession: sess.id_session, apiBaseUrl: baseUrl, tabIds, recordVideo: true },
							(res) => {
								const runtimeError = chrome.runtime.lastError?.message;
								resolve(runtimeError
									? { success: false, error: runtimeError }
									: res ?? { success: false, error: 'Tidak ada respon dari Service Worker.' });
							}
						);
					});
					if (!response.success) throw new Error(response.error || 'Gagal melanjutkan recording.');
					groupId = response.groupId ?? null;
				}

				const stored: StoredActiveSession = {
					id_session: sess.id_session,
					id_project: sess.id_project ?? null,
					id_test_case: sess.id_test_case ?? null,
					test_case_no: sess.test_case_no,
					title: sess.title,
					expected_result: sess.expected_result ?? null,
					group_id: groupId,
					last_sequence: sess.last_sequence ?? 0,
					started_at: Date.now(),
					record_video: true
				};
				await setActiveSession(stored);
				setActiveSessionState(stored);
				setActiveHangingSession(null);
				setState('recording');
				stateRef.current = 'recording';
				setView('active');
				showNotice(`Melanjutkan sesi rekaman #${sess.id_session}`);
			} catch (error) {
				setError((error as Error).message || 'Gagal melanjutkan sesi recording.');
			} finally {
				setBusy(false);
			}
		},
		[baseUrl, showNotice]
	);

	useEffect(() => {
		if (!token) return;
		void loadProjects();
		void loadSessions();
		void checkActiveHangingSession();
	}, [token, loadProjects, loadSessions, checkActiveHangingSession]);

	// Realtime Socket.IO listener untuk background generation status
	useEffect(() => {
		if (!token || !baseUrl) return;
		const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
		const isInsecureEndpoint = baseUrl.startsWith('http://') || baseUrl.startsWith('ws://');
		// Cegah Mixed Content error jika halaman HTTPS mencoba membuka insecure WebSocket ws://
		if (isHttpsPage && isInsecureEndpoint) {
			return;
		}
		let socket: Socket | null = null;
		try {
			socket = io(baseUrl, {
				path: '/knitto-socket',
				transports: ['websocket'],
				auth: { token }
			});

			socket.on('generation:started', (payload: { idSession?: number; kind?: string }) => {
				const idSession = Number(payload?.idSession);
				if (!idSession) return;
				setActiveGenerations((prev) => {
					const existing = prev.get(idSession);
					const next = new Map(prev);
					next.set(idSession, {
						id_session: idSession,
						title: existing?.title || `Session #${idSession}`,
						status: 'processing',
						startTime: existing?.startTime || Date.now()
					});
					return next;
				});
			});

			socket.on('generation:completed', (payload: { idSession?: number; kind?: string }) => {
				const idSession = Number(payload?.idSession);
				if (!idSession) return;
				setActiveGenerations((prev) => {
					const existing = prev.get(idSession);
					const next = new Map(prev);
					next.set(idSession, {
						id_session: idSession,
						title: existing?.title || `Session #${idSession}`,
						status: 'completed',
						startTime: existing?.startTime || Date.now()
					});
					return next;
				});
				showNotice(`Script Playwright untuk Sesi #${idSession} berhasil dibuat!`, 'success');
				void loadSessions();
			});

			socket.on('generation:failed', (payload: { idSession?: number; kind?: string; error?: string }) => {
				const idSession = Number(payload?.idSession);
				if (!idSession) return;
				setActiveGenerations((prev) => {
					const existing = prev.get(idSession);
					const next = new Map(prev);
					next.set(idSession, {
						id_session: idSession,
						title: existing?.title || `Session #${idSession}`,
						status: 'failed',
						startTime: existing?.startTime || Date.now(),
						error: payload?.error
					});
					return next;
				});
			});
		} catch {
			// Abaikan jika socket error
		}

		return () => {
			if (socket) {
				try {
					socket.disconnect();
				} catch {
					// Ignore
				}
			}
		};
	}, [token, baseUrl, loadSessions, showNotice]);

	// Polling fallback untuk status active generations jika sedang processing
	useEffect(() => {
		const processingList = Array.from(activeGenerations.values()).filter((g) => g.status === 'processing');
		if (processingList.length === 0 || !token) return;

		const timer = setInterval(async () => {
			for (const proc of processingList) {
				try {
					const gens = await api.listGenerations(proc.id_session);
					const items = (gens?.items || []) as GenerationItem[];
					if (items.length > 0) {
						const hasCompleted = items.some((g) => g.status === 'completed');
						const hasFailed = items.some((g) => g.status === 'failed');
						if (hasCompleted) {
							setActiveGenerations((prev) => {
								const next = new Map(prev);
								next.set(proc.id_session, { ...proc, status: 'completed' });
								return next;
							});
							showNotice(`Script Playwright untuk Sesi #${proc.id_session} berhasil dibuat!`, 'success');
							void loadSessions();
						} else if (hasFailed) {
							setActiveGenerations((prev) => {
								const next = new Map(prev);
								next.set(proc.id_session, { ...proc, status: 'failed' });
								return next;
							});
						}
					}
				} catch {
					// Abaikan error polling
				}
			}
		}, 3000);

		return () => clearInterval(timer);
	}, [activeGenerations, api, token, loadSessions, showNotice]);

	useEffect(() => {
		let cancelled = false;
		void requestFabState()
			.then((fabState) => {
				if (cancelled) return;
				const next = fabState.recording ? 'recording' : 'idle';
				setState(next);
				stateRef.current = next;
				setPending(fabState.pendingEvents);
				if (fabState.recording) {
					setView((current) => (current === 'root' || current === 'start' ? 'active' : current));
				}
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

	const handleCloseToolsDropdown = useCallback(() => {
		if (toolsHoverTimeoutRef.current) {
			clearTimeout(toolsHoverTimeoutRef.current);
			toolsHoverTimeoutRef.current = null;
		}
		setIsToolsExpanded(false);
	}, []);

	const handleToolsMouseEnter = useCallback(() => {
		if (toolsHoverTimeoutRef.current) {
			clearTimeout(toolsHoverTimeoutRef.current);
			toolsHoverTimeoutRef.current = null;
		}
		setIsToolsExpanded(true);
	}, []);

	const handleToolsMouseLeave = useCallback(() => {
		if (toolsHoverTimeoutRef.current) {
			clearTimeout(toolsHoverTimeoutRef.current);
		}
		toolsHoverTimeoutRef.current = setTimeout(() => {
			setIsToolsExpanded(false);
		}, 150);
	}, []);

	useEffect(() => {
		return () => {
			if (toolsHoverTimeoutRef.current) {
				clearTimeout(toolsHoverTimeoutRef.current);
			}
		};
	}, []);

	const closeAll = useCallback(() => {
		handleCloseToolsDropdown();
		setOpen(false);
	}, [handleCloseToolsDropdown]);

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
		handleCloseToolsDropdown();
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
	}, [state, activeSession, token, handleCloseToolsDropdown]);

	const handleNavigatePrograms = useCallback(() => {
		handleCloseToolsDropdown();
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		setView('programs');
	}, [token, handleCloseToolsDropdown]);

	const handleNavigateProjects = useCallback(() => {
		handleCloseToolsDropdown();
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		setView('projects');
	}, [token, handleCloseToolsDropdown]);

	const handleSelectTestCaseForRecording = useCallback((project: RecordingProject, testCase: TestCaseItem) => {
		const targetUrl =
			testCase.program_base_url ||
			project.programs?.find((p) => p.id_program === testCase.id_program)?.base_url ||
			project.programs?.find((p) => p.type === 'FRONTEND')?.base_url ||
			project.base_url ||
			undefined;

		setPrefilledTestCase({
			id_project: project.id_project,
			id_test_case: testCase.id_test_case,
			test_case_no: testCase.test_case_id,
			title: testCase.title,
			target_url: targetUrl,
			pre_condition: testCase.pre_condition || undefined,
			expected_result: testCase.expected_result || undefined
		});
		setRailCollapsed(true);
		setError(null);
		setView('start');
		showNotice(`Skenario ${testCase.test_case_id} dipilih. Siap direkam.`, 'info');
	}, [showNotice]);

	const handleNavigateSetting = useCallback(() => {
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		setView('setting');
	}, [token]);

	const handleNavigateCleaner = useCallback(() => {
		handleCloseToolsDropdown();
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		setView('cleaner');
	}, [token, handleCloseToolsDropdown]);

	const handleNavigateUsers = useCallback(() => {
		handleCloseToolsDropdown();
		setRailCollapsed(true);
		setError(null);
		setNotice(null);
		if (!token) {
			setView('login');
			return;
		}
		setView('users');
	}, [token, handleCloseToolsDropdown]);

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
		setError(null);
		showNotice('Berhasil logout.', 'info');
	}, [state, showNotice]);

	const handleCreateProject = useCallback(
		async (input: {
			name: string;
			id_program?: number | null;
			base_url?: string;
			repo_url?: string;
			description?: string;
		}) => {
			const created = await api.createProject(input);
			await loadProjects();
			showNotice(`Project "${input.name}" berhasil dibuat.`, 'success');
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
			record_video?: boolean;
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
								tabIds,
								recordVideo: input.record_video !== false
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
					started_at: Date.now(),
					record_video: input.record_video !== false
				};
				await setActiveSession(session);
				setActiveSessionState(session);
				setState('recording');
				stateRef.current = 'recording';
				setView('active');
				setOpen(false);
			} catch (caught) {
				const errMsg = (caught as Error).message || 'Gagal memulai recording.';
				setError(errMsg);
				if (errMsg.toLowerCase().includes('session recording aktif')) {
					void checkActiveHangingSession();
				}
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
			const currentSession =
				activeSession ||
				(activeHangingSession
					? {
							id_session: activeHangingSession.id_session,
							id_project: activeHangingSession.id_project ?? null,
							id_test_case: activeHangingSession.id_test_case ?? null,
							test_case_no: activeHangingSession.test_case_no,
							title: activeHangingSession.title,
							expected_result: activeHangingSession.expected_result ?? null,
							group_id: null,
							last_sequence: activeHangingSession.last_sequence ?? 0,
							started_at: Date.now(),
							record_video: true
						}
					: null);
			if (!currentSession) return;
			setBusy(true);
			setError(null);
			let stopWarning: string | null = null;
			let recordedVideoUrl: string | null = null;
			try {
				try {
					const response = await new Promise<{ success?: boolean; error?: string; videoDataUrl?: string; videoUrl?: string }>((resolve) => {
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

					if (response?.videoUrl) {
						recordedVideoUrl = response.videoUrl;
					} else if (response?.videoDataUrl && currentSession.record_video !== false) {
						try {
							const videoBlob = await (await fetch(response.videoDataUrl)).blob();
							const uploadRes = await api.uploadSessionVideo(currentSession.id_session, videoBlob);
							recordedVideoUrl = uploadRes.video_url;
						} catch (videoErr) {
							console.warn('Gagal mengunggah rekaman video:', videoErr);
						}
					}
				} catch (stopError) {
					stopWarning = (stopError as Error).message;
				}

				const endedSessionId = currentSession.id_session;
				const sessionTitle = currentSession.title;
				const isProjectSession = Boolean(currentSession.id_project);

				await api.endSession(currentSession.id_session, input);
				await clearActiveSession();
				setActiveSessionState(null);
				setActiveHangingSession(null);
				setPrefilledTestCase(null);
				setState('idle');
				stateRef.current = 'idle';
				setPending(0);
				setNotice(
					stopWarning
						? `Session selesai, tetapi recorder gagal berhenti (${stopWarning}).`
						: recordedVideoUrl
							? 'Session selesai. Script Playwright sedang diproses di background...'
							: 'Session selesai. Script Playwright sedang diproses di background...'
				);
				await loadSessions();
				await loadProjects();

				// Trigger background auto-generation non-blocking
				setActiveGenerations((prev) => {
					const next = new Map(prev);
					next.set(endedSessionId, {
						id_session: endedSessionId,
						title: sessionTitle,
						status: 'processing',
						startTime: Date.now()
					});
					return next;
				});

				void (async () => {
					try {
						// Tanpa `kinds`: default markdown+playwright, plus investigasi otomatis bila sesi FAIL/BLOCKED atau ada anomali.
						await api.generateOutputs(endedSessionId);
						setActiveGenerations((prev) => {
							const next = new Map(prev);
							next.set(endedSessionId, {
								id_session: endedSessionId,
								title: sessionTitle,
								status: 'completed',
								startTime: Date.now()
							});
							return next;
						});
						showNotice(`Script Playwright untuk "${sessionTitle}" berhasil dibuat!`, 'success');
						void loadSessions();
					} catch (genErr) {
						setActiveGenerations((prev) => {
							const next = new Map(prev);
							next.set(endedSessionId, {
								id_session: endedSessionId,
								title: sessionTitle,
								status: 'failed',
								startTime: Date.now(),
								error: (genErr as Error).message
							});
							return next;
						});
						console.warn('Auto-generation error:', genErr);
					}
				})();

				// Langsung buka modal hasil pengujian di dalam ekstensi
				setResultModalSessionId(endedSessionId);
				setResultModalTestCase(null);
				setResultModalOpen(true);
				setView(isProjectSession ? 'projects' : 'history');
			} catch (caught) {
				setError((caught as Error).message);
			} finally {
				setBusy(false);
			}
		},
		[api, activeSession, activeHangingSession, loadSessions, loadProjects, showNotice]
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

	const handleShareSession = useCallback(
		async (idSession: number) => {
			try {
				const res = await api.generateShareUrl(idSession);
				try {
					await navigator.clipboard.writeText(res.share_url);
				} catch {
					const textarea = document.createElement('textarea');
					textarea.value = res.share_url;
					textarea.style.position = 'fixed';
					textarea.style.opacity = '0';
					document.body.appendChild(textarea);
					textarea.focus();
					textarea.select();
					document.execCommand('copy');
					document.body.removeChild(textarea);
				}
				showNotice('Link debug berhasil disalin ke clipboard!', 'success');
			} catch (err) {
				showNotice((err as Error).message || 'Gagal membagikan link sesi', 'error');
			}
		},
		[api, showNotice]
	);

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
	const isRecorderActive = currentView === 'start' || currentView === 'active' || currentView === 'result' || currentView === 'history';
	const isToolsActive = isRecorderActive || currentView === 'cleaner';
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
			case 'programs':
				return {
					dotClass: 'ready',
					text: 'Master Program & Aplikasi',
					badge: 'Master',
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
					text: 'Project & Skenario Test Case',
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
			case 'cleaner':
				return {
					dotClass: 'ready',
					text: 'QA Cleaner & Reset Cache Domain',
					badge: 'Cleaner',
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
							onMouseLeave={() => {
								setRailCollapsed(false);
								handleCloseToolsDropdown();
							}}
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
									<div
										className="fab-rail-tools-group"
										onMouseEnter={handleToolsMouseEnter}
										onMouseLeave={handleToolsMouseLeave}
									>
										<button
											className={`fab-rail-btn fab-rail-group-btn ${isToolsActive ? 'group-active' : ''} ${(!isToolsExpanded && isToolsActive) ? 'active' : ''}`}
											aria-label="Tools"
											title={currentView === 'cleaner' ? 'Tools · Cleaner' : isRecorderActive ? 'Tools · Recorder' : 'Tools'}
											aria-expanded={isToolsExpanded}
											onClick={(e) => {
												(e.currentTarget as HTMLElement)?.blur();
												handleNavigateRecorder();
											}}
										>
											<div className="fab-rail-btn-icon">
												<Wrench size={18} />
												{state === 'recording' && <span className="fab-rail-dot" />}
											</div>
											<span className="fab-rail-label">Tools</span>
											{state === 'recording' ? (
												<span className="fab-rail-badge">LIVE</span>
											) : !isToolsExpanded ? (
												currentView === 'cleaner' ? (
													<span className="fab-rail-subbadge">Cleaner</span>
												) : isRecorderActive ? (
													<span className="fab-rail-subbadge">Recorder</span>
												) : null
											) : null}
											<span className="fab-rail-chevron">
												{isToolsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
											</span>
										</button>

										{isToolsExpanded && (
											<div className="fab-rail-submenu">
												<button
													className={`fab-rail-btn fab-rail-subitem ${isRecorderActive ? 'active' : ''}`}
													aria-label="Recorder"
													title="Recorder"
													onClick={(e) => {
														(e.currentTarget as HTMLElement)?.blur();
														handleNavigateRecorder();
													}}
												>
													<div className="fab-rail-btn-icon">
														<Play size={16} />
														{state === 'recording' && <span className="fab-rail-dot" />}
													</div>
													<span className="fab-rail-label">Recorder</span>
													{state === 'recording' && (
														<span className="fab-rail-badge">LIVE</span>
													)}
												</button>

												<button
													className={`fab-rail-btn fab-rail-subitem ${currentView === 'cleaner' ? 'active' : ''}`}
													aria-label="Cleaner"
													title="Cleaner"
													onClick={(e) => {
														(e.currentTarget as HTMLElement)?.blur();
														handleNavigateCleaner();
													}}
												>
													<div className="fab-rail-btn-icon">
														<Trash2 size={16} />
													</div>
													<span className="fab-rail-label">Cleaner</span>
												</button>
											</div>
										)}
									</div>

									<button
										className={`fab-rail-btn ${currentView === 'programs' ? 'active' : ''}`}
										aria-label="Program"
										title="Master Program & Aplikasi"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigatePrograms();
										}}
									>
										<div className="fab-rail-btn-icon">
											<Layers size={18} />
										</div>
										<span className="fab-rail-label">Program</span>
									</button>

									<button
										className={`fab-rail-btn ${currentView === 'projects' ? 'active' : ''}`}
										aria-label="Project"
										title="Project & Skenario Test Case"
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
										className={`fab-rail-btn ${currentView === 'users' ? 'active' : ''}`}
										aria-label="Users"
										title="Manajemen Pengguna"
										onClick={(e) => {
											(e.currentTarget as HTMLElement)?.blur();
											handleNavigateUsers();
										}}
									>
										<div className="fab-rail-btn-icon">
											<Users size={18} />
										</div>
										<span className="fab-rail-label">Pengguna</span>
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
									title={`${user?.nama ?? user?.username ?? 'User'} (${user?.level ?? 'QA'}) - Klik untuk Ubah Password`}
									onClick={() => setIsChangePasswordOpen(true)}
									style={{ cursor: 'pointer' }}
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
									<button
										type="button"
										className="fab-rail-btn-icon"
										style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
										title="Ubah Password Akun"
										onClick={(e) => {
											e.stopPropagation();
											setIsChangePasswordOpen(true);
										}}
									>
										<KeyRound size={13} />
									</button>
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
									{currentView !== 'start' && currentView !== 'active' && currentView !== 'history' ? (
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

							{/* Floating Background Auto-Generation Status Banner */}
							{Array.from(activeGenerations.values()).some((g) => g.status === 'processing') && (
								<div
									style={{
										background: '#eff6ff',
										borderBottom: '1px solid #bfdbfe',
										padding: '6px 12px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										fontSize: 11,
										color: '#1e40af'
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
										<RefreshCw size={12} className="spin" style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0 }} />
										<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
											<strong>Memproses Script:</strong> {Array.from(activeGenerations.values()).find((g) => g.status === 'processing')?.title}
										</span>
									</div>
									<span style={{ fontSize: 9.5, background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }}>
										Generating...
									</span>
								</div>
							)}

							{/* Global Sticky Active / Hanging Recording Session Banner */}
							{Boolean(
								(activeSession && typeof activeSession.id_session === 'number') ||
								(activeHangingSession && typeof activeHangingSession.id_session === 'number') ||
								state === 'recording'
							) && (
								<div
									className="fab-active-session-banner"
									style={{
										background: '#fffbeb',
										borderBottom: '1.5px solid #fde68a',
										padding: '7px 12px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: 8,
										color: '#92400e',
										fontSize: 11.5,
										zIndex: 10
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
										<span
											className="k-pulse-dot"
											style={{
												background: '#dc2626',
												width: 7,
												height: 7,
												borderRadius: '50%',
												flexShrink: 0
											}}
										/>
										<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
											Sesi Rekaman Berjalan: #{activeSession?.id_session ?? activeHangingSession?.id_session ?? '-'} ({activeSession?.title || activeHangingSession?.title || 'Recording'})
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
										{currentView !== 'active' && currentView !== 'result' && (
											<button
												type="button"
												className="k-btn k-btn-xs k-btn-primary"
												style={{ padding: '2px 7px', fontSize: 10.5 }}
												onClick={() => {
													if (activeHangingSession && !activeSession) {
														void handleResumeActiveSession(activeHangingSession);
													} else {
														setView('active');
													}
												}}
											>
												Kontrol Rekam
											</button>
										)}
										<button
											type="button"
											className="k-btn k-btn-xs k-btn-danger"
											style={{ padding: '2px 7px', fontSize: 10.5 }}
											onClick={handleDiscardActiveSession}
											title="Buang/Akhiri sesi ini"
										>
											Akhiri / Buang
										</button>
									</div>
								</div>
							)}

							<div className="fab-panel-body">
								{isRecorderActive && currentView !== 'result' && (
									<div className="fab-recorder-tabs" role="tablist" aria-label="Recorder Tab">
										<button
											type="button"
											role="tab"
											aria-selected={currentView !== 'history'}
											className={`fab-recorder-tab-btn ${currentView !== 'history' ? 'active' : ''}`}
											onClick={() => {
												if (state === 'recording' || activeSession || activeHangingSession) {
													setView('active');
												} else {
													setView('start');
												}
											}}
										>
											{state === 'recording' || activeSession || activeHangingSession ? (
												<>
													<span className="fab-recorder-pulse-dot" />
													<span>Sedang Merekam</span>
												</>
											) : (
												<>
													<Video size={13} />
													<span>Mulai Rekam</span>
												</>
											)}
										</button>
										<button
											type="button"
											role="tab"
											aria-selected={currentView === 'history'}
											className={`fab-recorder-tab-btn ${currentView === 'history' ? 'active' : ''}`}
											onClick={() => {
												setView('history');
												void loadSessions();
												void checkActiveHangingSession();
											}}
										>
											<History size={13} />
											<span>Riwayat Rekaman</span>
											{sessions.length > 0 && (
												<span className="fab-recorder-tab-count">{sessions.length}</span>
											)}
										</button>
									</div>
								)}
								{currentView === 'start' ? (
									<StartView
										user={user}
										projects={projects}
										api={api}
										busy={busy}
										error={error}
										prefilledTestCase={prefilledTestCase}
										activeHangingSession={activeHangingSession}
										onDiscardActiveSession={handleDiscardActiveSession}
										onResumeActiveSession={handleResumeActiveSession}
										onSubmit={handleStart}
										onCreateProject={handleCreateProject}
									/>
								) : currentView === 'programs' ? (
									<ProgramView
										api={api}
										user={user}
										showNotice={(msg, toastType) => {
											if (toastType === 'error') {
												setError(msg);
											} else {
												showNotice(msg, toastType ?? 'success');
											}
										}}
									/>
								) : currentView === 'projects' ? (
									<ProjectView
										user={user}
										projects={projects}
										api={api}
										canCreateProject={canCreateProject}
										onRefreshProjects={async () => {
											await loadProjects();
										}}
										onCreateProject={handleCreateProject}
										onSelectTestCaseForRecording={handleSelectTestCaseForRecording}
										onActiveProjectChange={setActiveProjectInView}
										activeGenerations={activeGenerations}
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
											onDiscard={handleDiscardActiveSession}
										/>
									) : activeHangingSession ? (
										<ActiveView
											session={{
												id_session: activeHangingSession.id_session,
												id_project: activeHangingSession.id_project ?? null,
												id_test_case: activeHangingSession.id_test_case ?? null,
												test_case_no: activeHangingSession.test_case_no,
												title: activeHangingSession.title,
												expected_result: activeHangingSession.expected_result ?? null,
												group_id: null,
												last_sequence: activeHangingSession.last_sequence ?? 0,
												started_at: Date.now(),
												record_video: true
											}}
											pendingEvents={pending}
											busy={busy}
											error={error}
											onCheckpoint={handleCheckpoint}
											onNavigateEnd={() => setView('result')}
											onDiscard={handleDiscardActiveSession}
										/>
									) : (
										<div className="sp-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
											<div className="sp-muted" style={{ marginBottom: 12 }}>Tidak ada sesi rekaman aktif saat ini.</div>
											<button type="button" className="k-btn k-btn-sm k-btn-primary" onClick={() => setView('start')}>
												Buka Form Mulai Rekam
											</button>
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
											onDiscard={handleDiscardActiveSession}
										/>
									) : activeHangingSession ? (
										<ResultView
											session={{
												id_session: activeHangingSession.id_session,
												id_project: activeHangingSession.id_project ?? null,
												id_test_case: activeHangingSession.id_test_case ?? null,
												test_case_no: activeHangingSession.test_case_no,
												title: activeHangingSession.title,
												expected_result: activeHangingSession.expected_result ?? null,
												group_id: null,
												last_sequence: activeHangingSession.last_sequence ?? 0,
												started_at: Date.now(),
												record_video: true
											}}
											busy={busy}
											error={error}
											onConfirmEnd={handleEnd}
											onCancel={() => setView('active')}
											onDiscard={handleDiscardActiveSession}
										/>
									) : (
										<div className="sp-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
											<div className="sp-muted" style={{ marginBottom: 12 }}>Tidak ada sesi rekaman aktif untuk diselesaikan.</div>
											<button type="button" className="k-btn k-btn-sm k-btn-primary" onClick={() => setView('start')}>
												Kembali ke Form Mulai
											</button>
										</div>
									)
								) : currentView === 'history' ? (
									<HistoryView
										sessions={sessions}
										generations={generations}
										activeSessionId={activeGenSessionId}
										activeGenerations={activeGenerations}
										activeHangingSession={activeHangingSession}
										activeSession={activeSession}
										busy={busy}
										error={error}
										onRefresh={() => {
											void loadSessions();
											void checkActiveHangingSession();
										}}
										onGenerate={handleGenerate}
										onViewGenerations={handleViewGenerations}
										onOpenDetail={handleOpenSessionDetail}
										onDownload={downloadOutput}
										onShare={handleShareSession}
										onResumeSession={handleResumeActiveSession}
										onDiscardSession={handleDiscardActiveSession}
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
								) : currentView === 'cleaner' ? (
									<CleanerView
										activeTabUrl={typeof window !== 'undefined' ? window.location?.href : undefined}
										isRecordingActive={state === 'recording'}
										onShowToast={(msg, toastType) => {
											if (toastType === 'error') {
												setError(msg);
											} else {
												showNotice(msg, toastType ?? 'success');
											}
										}}
									/>
								) : currentView === 'users' ? (
									<UserManagementView
										currentUser={user}
										api={api}
										projects={projects}
										showNotice={showNotice}
									/>
								) : (
									<StartView
										user={user}
										projects={projects}
										api={api}
										busy={busy}
										error={error}
										prefilledTestCase={prefilledTestCase}
										activeHangingSession={activeHangingSession}
										onDiscardActiveSession={handleDiscardActiveSession}
										onResumeActiveSession={handleResumeActiveSession}
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

				<TestCaseResultModal
					user={user}
					open={isResultModalOpen}
					sessionId={resultModalSessionId}
					testCase={resultModalTestCase}
					api={api}
					activeGenerations={activeGenerations}
					onClose={() => {
						setResultModalOpen(false);
						setResultModalSessionId(null);
						setResultModalTestCase(null);
					}}
					onShowToast={(msg, toastType) => {
						if (toastType === 'error') {
							setError(msg);
						} else {
							showNotice(msg, toastType ?? 'success');
						}
					}}
				/>

				<ChangePasswordModal
					isOpen={isChangePasswordOpen}
					onClose={() => setIsChangePasswordOpen(false)}
					api={api}
					onSuccess={(msg) => showNotice(msg, 'success')}
				/>
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
							void checkActiveHangingSession();
							if (stateRef.current === 'recording' || activeSession) {
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
