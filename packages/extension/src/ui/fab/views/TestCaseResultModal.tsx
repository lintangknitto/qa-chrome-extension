import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
	CheckCircle,
	XCircle,
	AlertCircle,
	Clock,
	Copy,
	Check,
	Download,
	Sparkles,
	Code2,
	ListOrdered,
	RefreshCw,
	FileText,
	Share2,
	Repeat,
	Video,
	VideoOff,
	Play,
	ExternalLink,
	History,
	Layers,
	Zap,
	Gauge,
	Database,
	Cookie,
	Key,
	Search,
	Shield,
	Eye,
	EyeOff
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ReRunModal } from './ReRunModal';
import type { RecordingApiClient, RecordingSession, TestCaseItem } from '../../../recording/apiClient';
import type { PlaywrightStorageState, PlaywrightCookie, StorageEntry } from '../../../recording/storageStateCapture';
import type { GenerationItem } from './HistoryView';
import { InvestigationPanel } from './InvestigationPanel';
import { ScriptView, countAmbiguousSteps } from '../components/ScriptView';
import type { StoredUser } from '../../../recording/tokenStore';
import { canRunTest } from '../fab-permissions';
import { extensionFetch } from '../../../recording/extensionFetch';

export interface TestCaseResultModalProps {
	user?: StoredUser | null;
	isOpen?: boolean;
	open?: boolean;
	sessionId: number | null;
	testCase: TestCaseItem | null;
	api: RecordingApiClient;
	onClose: () => void;
	onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
	activeGenerations?: Map<number, { id_session: number; title: string; status: string; startTime?: number; error?: string }>;
}

export interface RunItem {
	id: string;
	runNumber: number;
	label: string;
	type: 'original' | 'rerun';
	result?: string | null;
	actualResult?: string | null;
	videoUrl?: string | null;
	timestamp?: string;
	speedMode?: 'normal' | 'fast' | 'slow';
	stepDelayMs?: number;
	parameterOverrides?: Record<string, string>;
	checkpoints?: CheckpointItem[];
	sessionId?: number;
}

interface CheckpointItem {
	id_checkpoint: number;
	note: string;
	sequence?: number;
	created_at?: string;
}

export const TestCaseResultModal: React.FC<TestCaseResultModalProps> = ({
	user,
	isOpen,
	open,
	sessionId,
	testCase,
	api,
	onClose,
	onShowToast,
	activeGenerations
}) => {
	const isVisible = open ?? isOpen ?? false;

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sessionDetail, setSessionDetail] = useState<(RecordingSession & { checkpoints?: CheckpointItem[] }) | null>(null);
	const [generations, setGenerations] = useState<GenerationItem[]>([]);
	const [runs, setRuns] = useState<RunItem[]>([]);
	const [activeRunId, setActiveRunId] = useState<string>('');
	const [busyGenerate, setBusyGenerate] = useState(false);
	const [busyInvestigate, setBusyInvestigate] = useState(false);
	const [scriptVariant, setScriptVariant] = useState<'playwright' | 'playwright_ai'>('playwright');
	const [sharing, setSharing] = useState(false);
	const [isReRunOpen, setReRunOpen] = useState(false);
	const [copiedId, setCopiedId] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<'overview' | 'checkpoints' | 'script' | 'investigation' | 'storage'>('overview');
	const [storageState, setStorageState] = useState<PlaywrightStorageState | null>(null);
	const [storageSubTab, setStorageSubTab] = useState<'cookies' | 'local' | 'session'>('cookies');
	const [storageFilter, setStorageFilter] = useState('');
	const [showValues, setShowValues] = useState<Record<string, boolean>>({});
	const [storageCopied, setStorageCopied] = useState(false);
	const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
	const [playableVideoSrc, setPlayableVideoSrc] = useState<string | null>(null);
	const [videoLoading, setVideoLoading] = useState(false);
	const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
	const [videoRetryCount, setVideoRetryCount] = useState(0);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const activeRun = runs.find((r) => r.id === activeRunId) || runs[0];
	const testCaseNo = testCase?.test_case_id || sessionDetail?.test_case_no || `Sesi #${sessionId}`;
	const title = testCase?.title || sessionDetail?.title || 'Hasil Pengujian Rekaman';
	const currentResult = activeRun?.result ?? sessionDetail?.result ?? testCase?.status;
	const currentActualResult = activeRun?.actualResult ?? sessionDetail?.actual_result ?? testCase?.actual_result;
	const currentVideoUrl = activeRun?.videoUrl ?? sessionDetail?.video_url;
	const checkpoints = (activeRun?.checkpoints && activeRun.checkpoints.length > 0) ? activeRun.checkpoints : (sessionDetail?.checkpoints || []);

	const handlePlaybackRateChange = (rate: number) => {
		setVideoPlaybackRate(rate);
		if (videoRef.current) {
			videoRef.current.playbackRate = rate;
		}
	};

	const handleShare = async () => {
		if (!sessionId || sharing) return;
		setSharing(true);
		try {
			const res = await api.generateShareUrl(sessionId);
			const shareUrl = res.share_url;
			try {
				await navigator.clipboard.writeText(shareUrl);
			} catch {
				const textarea = document.createElement('textarea');
				textarea.value = shareUrl;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
			}
			onShowToast?.('Link debug berhasil disalin ke clipboard!', 'success');
		} catch (err) {
			onShowToast?.((err as Error).message || 'Gagal membuat link share', 'error');
		} finally {
			setSharing(false);
		}
	};

	const handleStartReRun = async (opts: {
		sessionId: number;
		testCaseNo: string;
		targetUrl?: string;
		parameterOverrides: Record<string, string>;
		mode: 'tabGroup' | 'activeTab';
		speedMode?: 'normal' | 'fast' | 'slow';
		stepDelayMs?: number;
		script?: string | null;
	}) => {
		const res = await new Promise<any>((resolve) => {
			if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
				chrome.runtime.sendMessage(
					{
						type: 'replay:run',
						options: {
							...opts,
							storageState: storageState || undefined,
							apiBaseUrl: api.baseUrl
						}
					},
					(response) => resolve(response ?? { success: false, error: 'Tidak ada respon dari Service Worker' })
				);
			} else {
				resolve({ success: false, error: 'chrome.runtime tidak tersedia' });
			}
		});

		if (!res?.success) {
			throw new Error(res?.error || 'Replay gagal dijalankan');
		}

		const nextRunNumber = runs.length + 1;
		const newRun: RunItem = {
			id: `run-rerun-${Date.now()}`,
			runNumber: nextRunNumber,
			label: `Run #${nextRunNumber} (Re-run)`,
			type: 'rerun',
			result: res.result?.success ? 'PASSED' : 'FAILED',
			actualResult: res.result?.success
				? `Replay sukses dieksekusi (${res.result.executedSteps || 0} langkah selesai).`
				: (res.result?.error || 'Replay terhenti'),
			videoUrl: res.videoUrl || res.videoDataUrl || null,
			timestamp: new Date().toISOString(),
			speedMode: opts.speedMode,
			stepDelayMs: opts.stepDelayMs,
			parameterOverrides: opts.parameterOverrides,
			sessionId: opts.sessionId
		};

		setRuns((prev) => [...prev, newRun]);
		setActiveRunId(newRun.id);
		onShowToast?.(`Replay ${opts.testCaseNo} berhasil! Disimpan ke Run #${nextRunNumber}.`, 'success');
	};

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}
		};
	}, []);

	const loadData = useCallback(async (id: number) => {
		setLoading(true);
		setError(null);
		try {
			const [sessionRes, genRes] = await Promise.all([
				api.getSession(id),
				api.listGenerations(id).catch(() => ({ items: [] }))
			]);
			let sessionObj = sessionRes as unknown as (RecordingSession & { checkpoints?: CheckpointItem[] });

			// Jika video_url belum ada di session record, coba fetch dari endpoint video khusus
			if (!sessionObj.video_url && typeof api.getSessionVideo === 'function') {
				try {
					const videoRes = await api.getSessionVideo(id);
					if (videoRes?.video_url) {
						sessionObj = { ...sessionObj, video_url: videoRes.video_url };
					}
				} catch {
					// Abaikan jika video belum terunggah
				}
			}

			const origRun: RunItem = {
				id: `run-orig-${id}`,
				runNumber: 1,
				label: 'Run #1 (Asli)',
				type: 'original',
				result: sessionObj.result,
				actualResult: sessionObj.actual_result,
				videoUrl: sessionObj.video_url,
				timestamp: (sessionObj as any).created_at,
				checkpoints: sessionObj.checkpoints || [],
				sessionId: id
			};

			// Coba muat artifact storage_state (Cookies, LocalStorage, SessionStorage)
			try {
				if (typeof api.listArtifacts === 'function') {
					const artRes = await api.listArtifacts(id);
					const storageArt = (artRes.items || []).find((a) => a.kind === 'storage_state');
					if (storageArt && typeof api.getArtifactDownloadUrl === 'function') {
						const dl = await api.getArtifactDownloadUrl(id, storageArt.id_artifact);
						if (dl?.download_url) {
							const stateResp = await extensionFetch(dl.download_url);
							if (stateResp.ok) {
								const stateData = await stateResp.json();
								setStorageState(stateData);
							}
						}
					}
				}
			} catch {
				// Abaikan jika artifact storage belum ada
			}

			setSessionDetail(sessionObj);
			setGenerations((genRes.items || []) as GenerationItem[]);
			setRuns([origRun]);
			setActiveRunId(origRun.id);
		} catch (err) {
			const isAuthErr =
				(err as any)?.status === 401 ||
				(err as Error)?.message?.toLowerCase().includes('login');
			if (!isAuthErr) {
				setError((err as Error).message || 'Gagal memuat detail hasil rekaman.');
			}
		} finally {
			setLoading(false);
		}
	}, [api]);

	// Muat stream video ke blob object URL agar dapat diputar di halaman HTTPS tanpa terblokir Mixed Content & CORS
	useEffect(() => {
		let isMounted = true;
		let objectUrlToRevoke: string | null = null;

		const loadVideo = async () => {
			if (!currentVideoUrl) {
				setPlayableVideoSrc(null);
				setVideoLoading(false);
				setVideoLoadError(null);
				return;
			}

			// Jika sudah berupa blob: atau data: URL, langsung gunakan
			if (currentVideoUrl.startsWith('blob:') || currentVideoUrl.startsWith('data:')) {
				setPlayableVideoSrc(currentVideoUrl);
				setVideoLoading(false);
				setVideoLoadError(null);
				return;
			}

			setVideoLoading(true);
			setVideoLoadError(null);

			try {
				if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
					const res = await new Promise<{ success: boolean; dataUrl?: string; error?: string }>((resolve) => {
						chrome.runtime.sendMessage(
							{
								type: 'media:fetchBlobUrl',
								url: currentVideoUrl,
								apiBaseUrl: api.baseUrl,
								sessionId: activeRun?.sessionId || sessionId
							},
							(response) => resolve(response ?? { success: false, error: 'Tidak ada respon dari Service Worker' })
						);
					});

					if (!isMounted) return;

					if (res.success && res.dataUrl) {
						// Konversi base64 dataUrl ke Blob URL lokal
						const parts = res.dataUrl.split(',');
						const header = parts[0] || '';
						const base64Data = parts[1] || '';
						const mime = header.match(/:(.*?);/)?.[1] || 'video/webm';
						const byteCharacters = atob(base64Data);
						const byteNumbers = new Array(byteCharacters.length);
						for (let i = 0; i < byteCharacters.length; i++) {
							byteNumbers[i] = byteCharacters.charCodeAt(i);
						}
						const byteArray = new Uint8Array(byteNumbers);
						const blob = new Blob([byteArray], { type: mime });
						const objUrl = URL.createObjectURL(blob);
						objectUrlToRevoke = objUrl;

						setPlayableVideoSrc(objUrl);
						setVideoLoading(false);
						setVideoLoadError(null);
					} else {
						throw new Error(res.error || 'Gagal memuat video rekaman');
					}
				} else {
					setPlayableVideoSrc(currentVideoUrl);
					setVideoLoading(false);
				}
			} catch (err) {
				if (!isMounted) return;
				setPlayableVideoSrc(null);
				setVideoLoading(false);
				setVideoLoadError((err as Error).message || 'Gagal memuat video');
			}
		};

		void loadVideo();

		return () => {
			isMounted = false;
			if (objectUrlToRevoke) {
				try {
					URL.revokeObjectURL(objectUrlToRevoke);
				} catch {
					// Ignore
				}
			}
		};
	}, [currentVideoUrl, api.baseUrl, activeRun?.sessionId, sessionId, videoRetryCount]);

	useEffect(() => {
		if (isVisible && sessionId) {
			void loadData(sessionId);
			setActiveTab('overview');
		} else {
			setSessionDetail(null);
			setGenerations([]);
			setRuns([]);
			setActiveRunId('');
			setStorageState(null);
			setStorageFilter('');
			setError(null);
		}
	}, [isVisible, sessionId, loadData]);

	// Investigasi tampil di tab sendiri; status tab script hanya dari generation script/laporan.
	const investigationGen = generations.find((g) => g.kind === 'investigation');
	const scriptGenerations = generations.filter((g) => g.kind !== 'investigation');
	const hasAiPatch = scriptGenerations.some((g) => g.kind === 'playwright_ai');
	const visibleScriptGenerations = scriptGenerations.filter((g) =>
		g.kind === 'playwright' || g.kind === 'playwright_ai' ? !hasAiPatch || g.kind === scriptVariant : true
	);

	// Deteksi ketersediaan script Playwright
	const playwrightGen = generations.find((g) => g.kind === 'playwright');
	const playwrightScript = playwrightGen?.output || null;
	const hasPlaywrightScript = Boolean(
		playwrightGen?.status === 'completed' && playwrightScript && playwrightScript.trim().length > 0
	);

	// Deteksi apakah seluruh jenis generation (playwright & markdown) sudah selesai
	const hasCompletedAll = scriptGenerations.length > 0 && scriptGenerations.every(
		(g) => g.status === 'completed' || g.status === 'failed'
	);
	const hasAnyPending = scriptGenerations.some(
		(g) => g.status === 'processing' || g.status === 'pending'
	);
	const hasFailedGeneration = Boolean(
		(sessionId && activeGenerations?.get(sessionId)?.status === 'failed') ||
		(!hasCompletedAll && scriptGenerations.some((g) => g.status === 'failed'))
	);
	const isGenerating = Boolean(
		!hasCompletedAll &&
		!hasFailedGeneration &&
		(
			hasAnyPending ||
			busyGenerate ||
			(sessionId && activeGenerations?.get(sessionId)?.status === 'processing')
		)
	);

	// Polling otomatis listGenerations sampai semua generasi (playwright & markdown) selesai
	useEffect(() => {
		if (!isVisible || !sessionId) return;

		let isMounted = true;
		let pollCount = 0;
		const maxPolls = 45; // Maksimal 67.5 detik

		const pollTimer = setInterval(async () => {
			pollCount++;
			try {
				const res = await api.listGenerations(sessionId);
				if (!isMounted) return;
				const items = (res.items || []) as GenerationItem[];
				if (items.length > 0) {
					setGenerations(items);
					const allDone = items.length > 0 && items.every(
						(g) => g.status === 'completed' || g.status === 'failed'
					);
					if (allDone || pollCount >= maxPolls) {
						clearInterval(pollTimer);
					}
				}
			} catch {
				// Abaikan polling error
			}
		}, 1500);

		return () => {
			isMounted = false;
			clearInterval(pollTimer);
		};
	}, [isVisible, sessionId, api]);

	const handleCopy = async (code: string | null, idGen: number) => {
		if (!code) return;
		if (copyTimeoutRef.current) {
			clearTimeout(copyTimeoutRef.current);
		}
		try {
			await navigator.clipboard.writeText(code);
			setCopiedId(idGen);
			copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2500);
			onShowToast?.('Kode Playwright berhasil disalin!', 'success');
		} catch {
			try {
				const textarea = document.createElement('textarea');
				textarea.value = code;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
				setCopiedId(idGen);
				copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2500);
				onShowToast?.('Kode berhasil disalin', 'success');
			} catch {
				onShowToast?.('Gagal menyalin kode', 'error');
			}
		}
	};

	const handleDownload = (item: GenerationItem) => {
		if (!item.output) return;
		try {
			const kindLower = item.kind.toLowerCase();
			const extension = kindLower.includes('json')
				? 'json'
				: kindLower.includes('report') || kindLower === 'markdown' || kindLower === 'investigation'
					? 'md'
					: 'ts';
			const rawId = testCase?.test_case_id || sessionDetail?.test_case_no || 'test';
			const safeId = rawId.replace(/[/\\?%*:|"<>]/g, '-');
			const filename = `${safeId}-${item.kind}.${extension}`;
			const blob = new Blob([item.output], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			setTimeout(() => {
				try {
					URL.revokeObjectURL(url);
				} catch {
					// Ignore
				}
			}, 1000);
			onShowToast?.(`File ${filename} berhasil diunduh`, 'success');
		} catch {
			onShowToast?.('Gagal mengunduh file script', 'error');
		}
	};

	const handleCopyStorageState = async () => {
		if (!storageState) return;
		const jsonStr = JSON.stringify(storageState, null, 2);
		try {
			await navigator.clipboard.writeText(jsonStr);
			setStorageCopied(true);
			setTimeout(() => setStorageCopied(false), 2500);
			onShowToast?.('storageState JSON berhasil disalin!', 'success');
		} catch {
			try {
				const textarea = document.createElement('textarea');
				textarea.value = jsonStr;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
				setStorageCopied(true);
				setTimeout(() => setStorageCopied(false), 2500);
				onShowToast?.('storageState JSON berhasil disalin!', 'success');
			} catch {
				onShowToast?.('Gagal menyalin storageState JSON', 'error');
			}
		}
	};

	const handleGenerate = async () => {
		if (!sessionId || busyGenerate) return;
		setBusyGenerate(true);
		try {
			await api.generateOutputs(sessionId);
			const genRes = await api.listGenerations(sessionId);
			setGenerations((genRes.items || []) as GenerationItem[]);
			onShowToast?.('Script otomasi berhasil digenerate!', 'success');
			setActiveTab('script');
		} catch (err) {
			onShowToast?.((err as Error).message || 'Gagal generate script', 'error');
		} finally {
			setBusyGenerate(false);
		}
	};

	const handleInvestigate = async () => {
		if (!sessionId || busyInvestigate) return;
		setBusyInvestigate(true);
		try {
			const res = (await api.investigateSession(sessionId)) as { status?: string; error?: string } | undefined;
			const genRes = await api.listGenerations(sessionId);
			setGenerations((genRes.items || []) as GenerationItem[]);
			if (res?.status === 'failed') onShowToast?.(res.error || 'Investigasi gagal', 'error');
			else onShowToast?.('Investigasi selesai', 'success');
		} catch (err) {
			onShowToast?.((err as Error).message || 'Gagal menjalankan investigasi', 'error');
		} finally {
			setBusyInvestigate(false);
		}
	};

	const handleGenerateAiPatch = async () => {
		if (!sessionId || busyGenerate) return;
		setBusyGenerate(true);
		try {
			await api.generateOutputs(sessionId, ['playwright_ai']);
			const genRes = await api.listGenerations(sessionId);
			setGenerations((genRes.items || []) as GenerationItem[]);
			setScriptVariant('playwright_ai');
		} catch (err) {
			onShowToast?.((err as Error).message || 'Gagal membuat patch AI', 'error');
		} finally {
			setBusyGenerate(false);
		}
	};

	const renderResultBadge = (res?: string | null) => {
		const result = (res || '').toUpperCase();
		if (result === 'PASS' || result === 'PASSED') {
			return (
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
					<CheckCircle size={12} />
					PASSED
				</span>
			);
		}
		if (result === 'FAIL' || result === 'FAILED') {
			return (
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
					<XCircle size={12} />
					FAILED
				</span>
			);
		}
		if (result === 'BLOCKED' || result === 'RE-TEST' || result === 'RETEST') {
			return (
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' }}>
					<AlertCircle size={12} />
					{result}
				</span>
			);
		}
		return (
			<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
				<Clock size={12} />
				{res || 'COMPLETED'}
			</span>
		);
	};

	return (
		<>
			<Modal
				open={isVisible}
				onClose={onClose}
				title={`Hasil Rekaman: ${testCaseNo}`}
				footer={
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
						<div style={{ fontSize: '11px', color: '#64748b' }}>
							Sesi ID: <strong style={{ color: '#0f172a' }}>#{sessionId}</strong>
						</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<Button
								type="button"
								variant="outline"
								size="sm"
								loading={sharing}
								disabled={sharing}
								icon={<Share2 size={13} />}
								onClick={handleShare}
								title="Bagikan link debug sesi ini"
							>
								Bagikan Link
							</Button>
							{canRunTest(user) && (
								<Button
									type="button"
									variant="primary"
									size="sm"
									disabled={!hasPlaywrightScript || loading || isGenerating}
									icon={<Repeat size={13} />}
									onClick={() => setReRunOpen(true)}
									title={
										isGenerating
											? 'Script Playwright sedang diproses di background...'
											: hasPlaywrightScript
												? 'Jalankan ulang skenario ini secara visual di browser'
												: 'Script otomasi belum terbuat. Tunggu proses background selesai untuk menjalankan re-run.'
									}
								>
									Re-run
								</Button>
							)}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={onClose}
							>
								Tutup
							</Button>
						</div>
					</div>
				}
			>
				{loading ? (
					<div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: '13px' }}>
						<RefreshCw size={22} className="k-spinner" style={{ margin: '0 auto 10px', display: 'block', animation: 'spin 1s linear infinite', color: '#2F3574' }} />
						Memuat rincian hasil pengujian & video rekaman...
					</div>
				) : error ? (
					<div style={{ padding: 16 }}>
						<div className="sp-error" style={{ marginBottom: 12 }}>{error}</div>
						<Button size="sm" variant="secondary" onClick={() => sessionId && void loadData(sessionId)}>
							Coba Muat Ulang
						</Button>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
						{/* Header Card Ringkasan Skenario */}
						<div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 14 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
								<div style={{ flex: 1, minWidth: 200 }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
										<span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2F3574', background: '#EEF2FF', padding: '2px 8px', borderRadius: 6 }}>
											{testCaseNo}
										</span>
										{!sessionDetail?.id_project && (
											<span style={{ fontSize: 10, background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: 12, fontWeight: 700, border: '1px solid #C7D2FE' }}>
												⚡ Quick Record
											</span>
										)}
										{renderResultBadge(currentResult)}
									</div>
									<h3 style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginTop: 6, margin: '6px 0 0 0' }}>
										{title}
									</h3>
									<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
										{sessionDetail?.id_project
											? `Project #${sessionDetail.id_project}`
											: 'Mode: Rekam Langsung (Tanpa Project)'}
									</div>
								</div>
								{sessionDetail?.target_url && (
									<div style={{ fontSize: 11, color: '#64748b', maxWidth: 260, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={sessionDetail.target_url}>
										🔗 {sessionDetail.target_url}
									</div>
								)}
							</div>

							{/* Expected Result Box */}
							{(sessionDetail?.expected_result || testCase?.expected_result) && (
								<div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
									<div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
										Expected Result:
									</div>
									<div style={{ fontSize: 12, color: '#14532d', background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, border: '1px solid #bbf7d0', lineHeight: 1.5 }}>
										{sessionDetail?.expected_result || testCase?.expected_result}
									</div>
								</div>
							)}

							{/* Temuan / Actual Result Box */}
							{currentActualResult && (
								<div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
									<div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
										Temuan QA / Actual Result ({activeRun?.label || 'Hasil Aktif'}):
									</div>
									<div style={{ fontSize: 12, color: '#1e293b', background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', lineHeight: 1.5 }}>
										{currentActualResult}
									</div>
								</div>
							)}
						</div>

						{/* Historical Runs Navigation Bar */}
						{runs.length > 0 && (
							<div
								style={{
									background: '#f8fafc',
									border: '1px solid #cbd5e1',
									borderRadius: 10,
									padding: '8px 12px',
									display: 'flex',
									flexDirection: 'column',
									gap: 6
								}}
							>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#2F3574' }}>
										<History size={13} color="#2F3574" />
										<span>Riwayat Eksekusi (Historical Runs): {runs.length} Run</span>
									</div>
									{activeRun?.speedMode && (
										<span style={{ fontSize: 10, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
											<Gauge size={11} />
											<span>Pacing: {activeRun.speedMode.toUpperCase()} ({activeRun.stepDelayMs || (activeRun.speedMode === 'fast' ? 300 : activeRun.speedMode === 'slow' ? 1500 : 800)}ms)</span>
										</span>
									)}
								</div>

								<div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
									{runs.map((r) => {
										const isSelected = r.id === activeRun?.id;
										const isPass = (r.result || '').toUpperCase() === 'PASSED' || (r.result || '').toUpperCase() === 'PASS';
										const isFail = (r.result || '').toUpperCase() === 'FAILED' || (r.result || '').toUpperCase() === 'FAIL';
										return (
											<button
												key={r.id}
												type="button"
												style={{
													display: 'inline-flex',
													alignItems: 'center',
													gap: 6,
													padding: '5px 10px',
													borderRadius: 6,
													fontSize: 11,
													fontWeight: isSelected ? 700 : 500,
													background: isSelected ? '#2F3574' : '#ffffff',
													color: isSelected ? '#ffffff' : '#334155',
													border: '1px solid ' + (isSelected ? '#2F3574' : '#cbd5e1'),
													cursor: 'pointer',
													whiteSpace: 'nowrap',
													boxShadow: isSelected ? '0 1px 3px rgba(47, 53, 116, 0.25)' : 'none',
													transition: 'all 0.15s ease'
												}}
												onClick={() => setActiveRunId(r.id)}
											>
												{r.type === 'original' ? <Play size={11} fill={isSelected ? '#ffffff' : '#475569'} /> : <Repeat size={11} />}
												<span>{r.label}</span>
												<span
													style={{
														fontSize: 9.5,
														fontWeight: 700,
														padding: '1px 5px',
														borderRadius: 4,
														background: isSelected
															? (isPass ? '#15803d' : isFail ? '#b91c1c' : '#475569')
															: (isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#f1f5f9'),
														color: isSelected ? '#ffffff' : (isPass ? '#15803d' : isFail ? '#b91c1c' : '#475569')
													}}
												>
													{r.result || 'DONE'}
												</span>
											</button>
										);
									})}
								</div>

								{activeRun?.parameterOverrides && Object.keys(activeRun.parameterOverrides).length > 0 && (
									<div style={{ fontSize: 10.5, color: '#475569', background: '#ffffff', padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
										<strong>Parameter Overrides:</strong>{' '}
										{Object.entries(activeRun.parameterOverrides).map(([k, v]) => `${k} = "${v}"`).join(', ')}
									</div>
								)}
							</div>
						)}

						{/* Segmented Tabs Navigation */}
						<div
							className="k-segmented"
							style={{
								display: 'flex',
								gap: 4,
								background: '#f1f5f9',
								padding: 4,
								borderRadius: 8,
								border: '1px solid #e2e8f0'
							}}
							role="tablist"
							aria-label="Tab Rincian Hasil"
						>
							<button
								type="button"
								role="tab"
								aria-selected={activeTab === 'overview'}
								style={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 6,
									padding: '7px 12px',
									fontSize: 12,
									fontWeight: activeTab === 'overview' ? 700 : 500,
									color: activeTab === 'overview' ? '#2F3574' : '#64748b',
									background: activeTab === 'overview' ? '#ffffff' : 'transparent',
									border: 'none',
									borderRadius: 6,
									cursor: 'pointer',
									boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
									transition: 'all 0.15s ease'
								}}
								onClick={() => setActiveTab('overview')}
							>
								<Video size={14} />
								<span>Ikhtisar & Video</span>
							</button>

							<button
								type="button"
								role="tab"
								aria-selected={activeTab === 'checkpoints'}
								style={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 6,
									padding: '7px 12px',
									fontSize: 12,
									fontWeight: activeTab === 'checkpoints' ? 700 : 500,
									color: activeTab === 'checkpoints' ? '#2F3574' : '#64748b',
									background: activeTab === 'checkpoints' ? '#ffffff' : 'transparent',
									border: 'none',
									borderRadius: 6,
									cursor: 'pointer',
									boxShadow: activeTab === 'checkpoints' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
									transition: 'all 0.15s ease'
								}}
								onClick={() => setActiveTab('checkpoints')}
							>
								<ListOrdered size={14} />
								<span>Checkpoints ({checkpoints.length})</span>
							</button>

							<button
								type="button"
								role="tab"
								aria-selected={activeTab === 'script'}
								style={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 6,
									padding: '7px 12px',
									fontSize: 12,
									fontWeight: activeTab === 'script' ? 700 : 500,
									color: activeTab === 'script' ? '#2F3574' : '#64748b',
									background: activeTab === 'script' ? '#ffffff' : 'transparent',
									border: 'none',
									borderRadius: 6,
									cursor: 'pointer',
									boxShadow: activeTab === 'script' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
									transition: 'all 0.15s ease'
								}}
								onClick={() => setActiveTab('script')}
							>
								<Code2 size={14} />
								<span>Script Playwright</span>
								{hasPlaywrightScript && (
									<span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
										Ready
									</span>
								)}
							</button>

							<button
								type="button"
								role="tab"
								aria-selected={activeTab === 'investigation'}
								style={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 6,
									padding: '7px 12px',
									fontSize: 12,
									fontWeight: activeTab === 'investigation' ? 700 : 500,
									color: activeTab === 'investigation' ? '#2F3574' : '#64748b',
									background: activeTab === 'investigation' ? '#ffffff' : 'transparent',
									border: 'none',
									borderRadius: 6,
									cursor: 'pointer',
									boxShadow: activeTab === 'investigation' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
									transition: 'all 0.15s ease'
								}}
								onClick={() => setActiveTab('investigation')}
							>
								<Search size={14} />
								<span>Investigasi</span>
								{investigationGen?.status === 'completed' && (
									<span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
										Ada
									</span>
								)}
							</button>

							<button
								type="button"
								role="tab"
								aria-selected={activeTab === 'storage'}
								style={{
									flex: 1,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 6,
									padding: '7px 12px',
									fontSize: 12,
									fontWeight: activeTab === 'storage' ? 700 : 500,
									color: activeTab === 'storage' ? '#2F3574' : '#64748b',
									background: activeTab === 'storage' ? '#ffffff' : 'transparent',
									border: 'none',
									borderRadius: 6,
									cursor: 'pointer',
									boxShadow: activeTab === 'storage' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
									transition: 'all 0.15s ease'
								}}
								onClick={() => setActiveTab('storage')}
							>
								<Database size={14} />
								<span>Storage & Cookies</span>
								{Boolean(storageState?.cookies?.length || storageState?.origins?.[0]?.localStorage?.length) && (
									<span style={{ fontSize: 10, background: '#e0e7ff', color: '#3730a3', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
										{(storageState?.cookies?.length || 0) + (storageState?.origins?.[0]?.localStorage?.length || 0)}
									</span>
								)}
							</button>
						</div>

						{/* TAB 1: OVERVIEW & VIDEO */}
						{activeTab === 'overview' && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
								{/* Video Rekaman Layar Section */}
								<div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
											<Video size={15} color="#2F3574" />
											<span>Rekaman Video Pengujian (WebM)</span>
										</div>
										{currentVideoUrl && (
											<a
												href={currentVideoUrl}
												target="_blank"
												rel="noreferrer"
												style={{ fontSize: 11, color: '#2F3574', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
											>
												<span>Buka di Tab Baru</span>
												<ExternalLink size={11} />
											</a>
										)}
									</div>

									{currentVideoUrl ? (
										<div style={{ background: '#090d16', borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid #1e293b' }}>
											{videoLoading ? (
												<div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
													<RefreshCw size={24} className="k-spinner" style={{ margin: '0 auto 8px', display: 'block', animation: 'spin 1s linear infinite', color: '#818cf8' }} />
													Memuat dan menyiapkan video rekaman...
												</div>
											) : videoLoadError ? (
												<div style={{ padding: '24px 16px', textAlign: 'center', color: '#f87171' }}>
													<VideoOff size={24} style={{ margin: '0 auto 6px', color: '#f87171' }} />
													<div style={{ fontSize: '12px', fontWeight: 600 }}>Gagal Memuat Video</div>
													<div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: 2, marginBottom: 8 }}>{videoLoadError}</div>
													<div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
														<Button
															type="button"
															variant="secondary"
															size="xs"
															onClick={() => {
																setPlayableVideoSrc(null);
																setVideoLoadError(null);
																setVideoRetryCount((c) => c + 1);
															}}
														>
															Coba Lagi
														</Button>
														<a
															href={currentVideoUrl}
															target="_blank"
															rel="noreferrer"
															style={{ textDecoration: 'none' }}
														>
															<Button type="button" variant="outline" size="xs">
																Buka Direct Link
															</Button>
														</a>
													</div>
												</div>
											) : (
												<video
													ref={videoRef}
													controls
													preload="metadata"
													key={playableVideoSrc || currentVideoUrl}
													src={playableVideoSrc || currentVideoUrl}
													onLoadedMetadata={(e) => {
														e.currentTarget.playbackRate = videoPlaybackRate;
													}}
													style={{ width: '100%', maxHeight: 250, display: 'block', outline: 'none' }}
												/>
											)}
											{/* Video toolbar: Speed Controls & Download */}
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '6px 12px', borderTop: '1px solid #1e293b', flexWrap: 'wrap', gap: 6 }}>
												<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
													<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Kecepatan:</span>
													{[0.75, 1, 1.25, 1.5, 2].map((rate) => (
														<button
															key={rate}
															type="button"
															style={{
																background: videoPlaybackRate === rate ? '#2F3574' : 'transparent',
																color: videoPlaybackRate === rate ? '#ffffff' : '#94a3b8',
																border: '1px solid ' + (videoPlaybackRate === rate ? '#4338CA' : '#334155'),
																borderRadius: 4,
																padding: '2px 6px',
																fontSize: 10,
																fontWeight: 600,
																cursor: 'pointer'
															}}
															onClick={() => handlePlaybackRateChange(rate)}
														>
															{rate}x
														</button>
													))}
												</div>
												<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
													<a
														href={playableVideoSrc || currentVideoUrl}
														download={`session-${sessionId}-${activeRun?.label || 'run'}.webm`}
														target="_blank"
														rel="noreferrer"
														style={{ textDecoration: 'none' }}
													>
														<Button
															type="button"
															variant="primary"
															size="xs"
															icon={<Download size={11} color="#ffffff" />}
															style={{
																background: '#2563eb',
																borderColor: '#1d4ed8',
																color: '#ffffff',
																fontWeight: 600,
																boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)'
															}}
														>
															Unduh .webm
														</Button>
													</a>
												</div>
											</div>
										</div>
									) : (
										<div
											style={{
												padding: '24px 16px',
												textAlign: 'center',
												background: '#f8fafc',
												borderRadius: 8,
												border: '1px dashed #cbd5e1',
												color: '#64748b'
											}}
										>
											<VideoOff size={24} style={{ margin: '0 auto 6px', color: '#94a3b8' }} />
											<div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
												Tidak Ada Rekaman Video Tersimpan
											</div>
											<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
												Video tidak direkam atau belum selesai diunggah ke storage MinIO.
											</div>
										</div>
									)}
								</div>

								{/* Status Otomasi Banner */}
								<div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
									<div>
										<div style={{ fontWeight: 700, fontSize: 12, color: '#2F3574' }}>
											Otomasi Skenario
										</div>
										<div style={{ fontSize: 11, color: '#4338CA', marginTop: 2 }}>
											{hasCompletedAll && hasPlaywrightScript
												? 'Script Playwright dan Laporan Debugging siap. Gunakan tombol Re-run di footer bawah untuk eksekusi replay.'
												: isGenerating
												? 'Script Playwright & Laporan Debugging sedang diproses bersamaan oleh AI di background...'
												: hasFailedGeneration
												? 'Gagal memproses output otomatis di background. Anda dapat mencoba Generate Ulang.'
												: hasPlaywrightScript
												? 'Script Playwright siap. Gunakan tombol Re-run di footer bawah untuk eksekusi replay.'
												: 'Script Playwright sedang dipersiapkan di background...'}
										</div>
									</div>
									<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
										{hasCompletedAll && hasPlaywrightScript ? (
											<span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 6, fontWeight: 700, border: '1px solid #86efac', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
												<Check size={12} />
												Script Siap
											</span>
										) : isGenerating ? (
											<span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: 6, fontWeight: 700, border: '1px solid #93c5fd', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
												<RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
												Sedang Diproses...
											</span>
										) : hasFailedGeneration ? (
											<Button
												type="button"
												variant="secondary"
												size="xs"
												loading={busyGenerate}
												disabled={busyGenerate}
												icon={<Sparkles size={12} />}
												onClick={handleGenerate}
											>
												Generate Ulang
											</Button>
										) : null}
									</div>
								</div>
							</div>
						)}

						{/* TAB 2: CHECKPOINTS */}
						{activeTab === 'checkpoints' && (
							<div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 14 }}>
								<div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
									<ListOrdered size={15} color="#2F3574" />
									<span>Daftar Checkpoint Interaksi ({checkpoints.length})</span>
								</div>

								{checkpoints.length === 0 ? (
									<div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', padding: '16px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
										Tidak ada checkpoint manual dicatat selama perekaman ini.
									</div>
								) : (
									<div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
										{checkpoints.map((cp, idx) => (
											<div
												key={cp.id_checkpoint || idx}
												style={{
													display: 'flex',
													alignItems: 'flex-start',
													gap: 10,
													padding: '8px 12px',
													fontSize: 12,
													borderBottom: idx < checkpoints.length - 1 ? '1px solid #f1f5f9' : 'none',
													background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
												}}
											>
												<span style={{ fontWeight: 800, color: '#2F3574', minWidth: 24, fontSize: 11 }}>
													#{cp.sequence ?? idx + 1}
												</span>
												<span style={{ flex: 1, color: '#1e293b', lineHeight: 1.4 }}>{cp.note}</span>
												{cp.created_at && (
													<span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
														{new Date(cp.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
													</span>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{/* TAB 3: PLAYWRIGHT SCRIPT & AI OUTPUT */}
						{activeTab === 'script' && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
										<Code2 size={15} color="#2F3574" />
										<span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
											Kode Otomasi & Output AI
										</span>
									</div>
									{!isGenerating && scriptGenerations.length > 0 && (
										<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
											{hasAiPatch ? (
												<div role="group" aria-label="Versi script" style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
													{(['playwright', 'playwright_ai'] as const).map((variant) => (
														<button
															key={variant}
															type="button"
															aria-pressed={scriptVariant === variant}
															onClick={() => setScriptVariant(variant)}
															style={{
																fontSize: 11,
																padding: '3px 8px',
																border: 'none',
																cursor: 'pointer',
																background: scriptVariant === variant ? '#2F3574' : '#ffffff',
																color: scriptVariant === variant ? '#ffffff' : '#334155'
															}}
														>
															{variant === 'playwright' ? 'Asli (rekaman)' : 'Patch AI'}
														</button>
													))}
												</div>
											) : (
												hasPlaywrightScript && (
													<Button type="button" variant="secondary" size="xs" disabled={busyGenerate} icon={<Sparkles size={11} />} onClick={handleGenerateAiPatch}>
														Patch AI
													</Button>
												)
											)}
											<Button
												type="button"
												variant="secondary"
												size="xs"
												loading={busyGenerate}
												disabled={busyGenerate}
												icon={<Sparkles size={11} />}
												onClick={handleGenerate}
											>
												Generate Ulang
											</Button>
										</div>
									)}
								</div>

								{isGenerating ? (
									<div style={{ border: '1px dashed #93c5fd', borderRadius: 10, padding: '36px 16px', textAlign: 'center', background: '#eff6ff' }}>
										<RefreshCw size={32} color="#2563eb" style={{ margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
										<div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
											Sedang Menyusun Script Playwright & Laporan Pengujian...
										</div>
										<div style={{ fontSize: 11, color: '#3b82f6', marginTop: 6, maxWidth: 400, margin: '6px auto 0', lineHeight: 1.5 }}>
											AI sedang menganalisis rekaman interaksi & checkpoints untuk menyusun skrip uji otomatis serta dokumen investigasi debugging secara lengkap. Seluruh hasil akan muncul bersamaan di sini.
										</div>
									</div>
								) : hasFailedGeneration ? (
									<div style={{ border: '1px dashed #fca5a5', borderRadius: 10, padding: '24px 16px', textAlign: 'center', background: '#fef2f2' }}>
										<AlertCircle size={28} color="#dc2626" style={{ margin: '0 auto 8px' }} />
										<div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
											Gagal Memproses Script Otomatis
										</div>
										<div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
											{generations.find((g) => g.status === 'failed')?.error_message ||
												activeGenerations?.get(sessionId || 0)?.error ||
												'Terjadi kendala saat menghubungi AI model. Silakan periksa koneksi atau coba generate ulang.'}
										</div>
										<div style={{ marginTop: 12 }}>
											<Button
												type="button"
												variant="primary"
												size="xs"
												loading={busyGenerate}
												disabled={busyGenerate}
												icon={<Sparkles size={11} />}
												onClick={handleGenerate}
											>
												Coba Generate Ulang
											</Button>
										</div>
									</div>
								) : scriptGenerations.length > 0 ? (
									visibleScriptGenerations.map((item) => (
										<div key={item.id_generation} style={{ border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
											{/* Code Block Header */}
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '8px 12px', borderBottom: '1px solid #334155' }}>
												<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
													<Badge variant="default">{item.kind.toUpperCase()}</Badge>
													<span style={{ fontSize: 11, color: '#94a3b8' }}>#{item.id_generation}</span>
													{item.output && countAmbiguousSteps(item.output) > 0 && (
														<span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
															⚠ {countAmbiguousSteps(item.output)} locator tidak unik
														</span>
													)}
												</div>
												<div style={{ display: 'flex', gap: 6 }}>
													{item.output && (
														<>
															<Button
																type="button"
																variant="secondary"
																size="xs"
																icon={copiedId === item.id_generation ? <Check size={12} color="#16a34a" /> : <Copy size={12} color="#334155" />}
																onClick={() => void handleCopy(item.output, item.id_generation)}
																style={{
																	background: '#ffffff',
																	color: '#1e293b',
																	border: '1px solid #cbd5e1',
																	fontWeight: 600
																}}
															>
																{copiedId === item.id_generation ? 'Tersalin!' : 'Salin Kode'}
															</Button>
															<Button
																type="button"
																variant="primary"
																size="xs"
																icon={<Download size={12} color="#ffffff" />}
																onClick={() => handleDownload(item)}
																style={{
																	background: '#2563eb',
																	borderColor: '#1d4ed8',
																	color: '#ffffff',
																	fontWeight: 600,
																	boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)'
																}}
															>
																Unduh {item.kind === 'playwright' || item.kind === 'playwright_ai' ? '.spec.ts' : item.kind === 'report' || item.kind === 'markdown' ? '.md' : '.' + item.kind}
															</Button>
														</>
													)}
												</div>
											</div>
											{item.error_message && (
												<div style={{ color: '#b91c1c', fontSize: 11, padding: '8px 12px', background: '#fee2e2', borderBottom: '1px solid #fca5a5' }}>
													Error: {item.error_message}
												</div>
											)}
											{item.output && <ScriptView script={item.output} />}
										</div>
									))
								) : (
									<div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '28px 16px', textAlign: 'center', background: '#f8fafc' }}>
										<Code2 size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
										<div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
											Belum Ada Script Otomasi
										</div>
										<div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
											Klik tombol di bawah untuk membuat skrip Playwright dan laporan investigasi dengan bantuan AI.
										</div>
										<div style={{ marginTop: 12 }}>
											<Button
												type="button"
												variant="primary"
												size="xs"
												loading={busyGenerate}
												disabled={busyGenerate}
												icon={<Sparkles size={11} />}
												onClick={handleGenerate}
											>
												Generate Script AI
											</Button>
										</div>
									</div>
								)}
							</div>
						)}

						{/* TAB 4: INVESTIGASI */}
						{activeTab === 'investigation' && (
							<InvestigationPanel generation={investigationGen} busy={busyInvestigate} onInvestigate={() => void handleInvestigate()} />
						)}

						{/* TAB 5: STORAGE & COOKIES */}
						{activeTab === 'storage' && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
								{/* Storage Header Card */}
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										background: '#ffffff',
										border: '1px solid #cbd5e1',
										borderRadius: 10,
										padding: '10px 14px',
										flexWrap: 'wrap',
										gap: 8
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
										<Database size={16} color="#2F3574" />
										<div>
											<div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
												Browser Context State Snapshot
											</div>
											<div style={{ fontSize: 11, color: '#64748b' }}>
												Snapshot menyimpan nilai cookie dan storage lengkap untuk pemantauan/replay lokal. Nilai JWT/cookie dapat memberi akses ke aplikasi.
											</div>
										</div>
									</div>

									{storageState && (
										<Button
											type="button"
											variant="secondary"
											size="xs"
											icon={storageCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
											onClick={handleCopyStorageState}
										>
											{storageCopied ? 'Tersalin!' : 'Salin JSON storageState'}
										</Button>
									)}
								</div>

								{/* Sub-tab Pill Switcher & Search Bar */}
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
									<div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0' }}>
										<button
											type="button"
											style={{
												padding: '4px 10px',
												fontSize: 11,
												fontWeight: storageSubTab === 'cookies' ? 700 : 500,
												color: storageSubTab === 'cookies' ? '#2F3574' : '#64748b',
												background: storageSubTab === 'cookies' ? '#ffffff' : 'transparent',
												border: 'none',
												borderRadius: 6,
												cursor: 'pointer',
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4
											}}
											onClick={() => setStorageSubTab('cookies')}
										>
											<Cookie size={12} />
											<span>Cookies ({storageState?.cookies?.length || 0})</span>
										</button>

										<button
											type="button"
											style={{
												padding: '4px 10px',
												fontSize: 11,
												fontWeight: storageSubTab === 'local' ? 700 : 500,
												color: storageSubTab === 'local' ? '#2F3574' : '#64748b',
												background: storageSubTab === 'local' ? '#ffffff' : 'transparent',
												border: 'none',
												borderRadius: 6,
												cursor: 'pointer',
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4
											}}
											onClick={() => setStorageSubTab('local')}
										>
											<Key size={12} />
											<span>LocalStorage ({storageState?.origins?.[0]?.localStorage?.length || 0})</span>
										</button>

										<button
											type="button"
											style={{
												padding: '4px 10px',
												fontSize: 11,
												fontWeight: storageSubTab === 'session' ? 700 : 500,
												color: storageSubTab === 'session' ? '#2F3574' : '#64748b',
												background: storageSubTab === 'session' ? '#ffffff' : 'transparent',
												border: 'none',
												borderRadius: 6,
												cursor: 'pointer',
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4
											}}
											onClick={() => setStorageSubTab('session')}
										>
											<Database size={12} />
											<span>SessionStorage ({storageState?.origins?.[0]?.sessionStorage?.length || 0})</span>
										</button>
									</div>

									<div style={{ flex: 1, minWidth: 160, maxWidth: 260 }}>
										<div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
											<Search size={12} style={{ position: 'absolute', left: 8, color: '#94a3b8' }} />
											<input
												type="text"
												placeholder="Filter key atau domain..."
												value={storageFilter}
												onChange={(e) => setStorageFilter(e.target.value)}
												style={{
													width: '100%',
													padding: '5px 8px 5px 26px',
													fontSize: 11,
													borderRadius: 6,
													border: '1px solid #cbd5e1',
													outline: 'none'
												}}
											/>
										</div>
									</div>
								</div>

								{/* Storage Content Display */}
								{!storageState ? (
									<div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '24px 16px', textAlign: 'center', background: '#f8fafc' }}>
										<Database size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
										<div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
											Tidak ada state storage yang tercatat
										</div>
										<div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
											Storage snapshot (cookies & localStorage) akan otomatis terekam saat memulai dan mengakhiri sesi.
										</div>
									</div>
								) : storageSubTab === 'cookies' ? (
									/* Cookies Table */
									<div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
										{(() => {
											const filteredCookies = (storageState.cookies || []).filter((c) => {
												const q = storageFilter.toLowerCase();
												return !q || c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q) || c.value.toLowerCase().includes(q);
											});
											if (filteredCookies.length === 0) {
												return (
													<div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: '#64748b' }}>
														{storageFilter ? 'Tidak ada cookie yang cocok dengan filter.' : 'Tidak ada cookie yang terekam pada sesi ini.'}
													</div>
												);
											}
											return (
												<div style={{ maxHeight: 320, overflowY: 'auto' }}>
													<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
														<thead>
															<tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
																<th style={{ padding: '8px 10px' }}>Name</th>
																<th style={{ padding: '8px 10px' }}>Value</th>
																<th style={{ padding: '8px 10px' }}>Domain & Path</th>
																<th style={{ padding: '8px 10px' }}>Security</th>
																<th style={{ padding: '8px 10px' }}>Expires</th>
															</tr>
														</thead>
														<tbody>
														{filteredCookies.map((cookie, idx) => {
															const isValueVisible = showValues[`cookie_${idx}`];
															return (
																<tr key={`${cookie.domain}_${cookie.name}_${idx}`} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
																	<td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
																		{cookie.name}
																	</td>
																	<td style={{ padding: '8px 10px', maxWidth: 200, wordBreak: 'break-all' }}>
																		<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
																			<span style={{ fontFamily: 'monospace', color: '#334155' }}>
																				{isValueVisible ? cookie.value : '********'}
																			</span>
																			<button
																				type="button"
																				style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}
																				onClick={() => setShowValues((p) => ({ ...p, [`cookie_${idx}`]: !p[`cookie_${idx}`] }))}
																				title={isValueVisible ? 'Sembunyikan nilai' : 'Tampilkan nilai'}
																			>
																				{isValueVisible ? <EyeOff size={11} /> : <Eye size={11} />}
																			</button>
																		</div>
																	</td>
																	<td style={{ padding: '8px 10px', color: '#64748b' }}>
																		<div>{cookie.domain}</div>
																		<div style={{ fontSize: 10, color: '#94a3b8' }}>{cookie.path}</div>
																	</td>
																	<td style={{ padding: '8px 10px' }}>
																		<div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
																			{cookie.httpOnly && (
																				<span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>
																					HttpOnly
																				</span>
																			)}
																			{cookie.secure && (
																				<span style={{ fontSize: 9, background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>
																					Secure
																				</span>
																			)}
																			{cookie.sameSite && cookie.sameSite !== 'None' && (
																				<span style={{ fontSize: 9, background: '#e0e7ff', color: '#3730a3', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>
																					{cookie.sameSite}
																				</span>
																			)}
																		</div>
																	</td>
																	<td style={{ padding: '8px 10px', fontSize: 10, color: '#64748b' }}>
																		{cookie.expires > 0 ? new Date(cookie.expires * 1000).toLocaleDateString() : 'Session'}
																	</td>
																</tr>
															);
														})}
														</tbody>
													</table>
												</div>
											);
										})()}
									</div>
								) : (
									/* LocalStorage / SessionStorage Key-Value Cards */
									<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
										{(() => {
											const origin = storageState.origins?.[0];
											const entries: StorageEntry[] = storageSubTab === 'local' ? (origin?.localStorage || []) : (origin?.sessionStorage || []);
											const filteredEntries = entries.filter((e) => {
												const q = storageFilter.toLowerCase();
												return !q || e.name.toLowerCase().includes(q) || e.value.toLowerCase().includes(q);
											});

											if (filteredEntries.length === 0) {
												return (
													<div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '20px', textAlign: 'center', background: '#ffffff', fontSize: 11, color: '#64748b' }}>
														{storageFilter ? 'Tidak ada key yang cocok dengan filter.' : `Tidak ada data ${storageSubTab === 'local' ? 'LocalStorage' : 'SessionStorage'} yang tersimpan.`}
													</div>
												);
											}

											return (
												<div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
													{filteredEntries.map((entry, idx) => {
														const keyId = `${storageSubTab}_${idx}`;
														const isVisible = showValues[keyId];
														return (
															<div
																key={entry.name}
																style={{
																	background: '#ffffff',
																	border: '1px solid #e2e8f0',
																	borderRadius: 6,
																	padding: '8px 10px',
																	display: 'flex',
																	flexDirection: 'column',
																	gap: 4
																}}
															>
																<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
																	<span style={{ fontWeight: 700, fontSize: 11.5, color: '#0f172a', fontFamily: 'monospace' }}>
																		{entry.name}
																	</span>
																	<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
																		<button
																			type="button"
																			style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#64748b' }}
																			onClick={() => setShowValues((p) => ({ ...p, [keyId]: !p[keyId] }))}
																			title={isVisible ? 'Sembunyikan' : 'Tampilkan'}
																		>
																			{isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
																		</button>
																		<button
																			type="button"
																			style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#2F3574' }}
																			onClick={async () => {
																				try {
																					await navigator.clipboard.writeText(entry.value);
																					onShowToast?.(`Key "${entry.name}" disalin!`, 'success');
																				} catch {
																					// Ignore
																				}
																			}}
																			title="Salin value"
																		>
																			<Copy size={12} />
																		</button>
																	</div>
																</div>
																<pre
																	style={{
																		margin: 0,
																		background: '#f8fafc',
																		padding: '6px 8px',
																		borderRadius: 4,
																		fontSize: 10.5,
																		color: '#334155',
																		maxHeight: isVisible ? 120 : 36,
																		overflowY: 'auto',
																		whiteSpace: 'pre-wrap',
																		wordBreak: 'break-all',
																		fontFamily: 'ui-monospace, monospace'
																	}}
																>
																	{entry.value}
																</pre>
															</div>
														);
													})}
												</div>
											);
										})()}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</Modal>

			<ReRunModal
				open={isReRunOpen}
				sessionId={sessionId}
				testCaseNo={testCaseNo}
				title={title}
				targetUrl={sessionDetail?.target_url || undefined}
				script={playwrightScript}
				onClose={() => setReRunOpen(false)}
				onStartReRun={handleStartReRun}
			/>
		</>
	);
};
