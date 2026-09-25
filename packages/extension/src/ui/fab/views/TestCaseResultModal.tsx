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
	ExternalLink
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ReRunModal } from './ReRunModal';
import type { RecordingApiClient, RecordingSession, TestCaseItem } from '../../../recording/apiClient';
import type { GenerationItem } from './HistoryView';

export interface TestCaseResultModalProps {
	isOpen?: boolean;
	open?: boolean;
	sessionId: number | null;
	testCase: TestCaseItem | null;
	api: RecordingApiClient;
	onClose: () => void;
	onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface CheckpointItem {
	id_checkpoint: number;
	note: string;
	sequence?: number;
	created_at?: string;
}

export const TestCaseResultModal: React.FC<TestCaseResultModalProps> = ({
	isOpen,
	open,
	sessionId,
	testCase,
	api,
	onClose,
	onShowToast
}) => {
	const isVisible = open ?? isOpen ?? false;

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sessionDetail, setSessionDetail] = useState<(RecordingSession & { checkpoints?: CheckpointItem[] }) | null>(null);
	const [generations, setGenerations] = useState<GenerationItem[]>([]);
	const [busyGenerate, setBusyGenerate] = useState(false);
	const [sharing, setSharing] = useState(false);
	const [isReRunOpen, setReRunOpen] = useState(false);
	const [copiedId, setCopiedId] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<'overview' | 'checkpoints' | 'script'>('overview');
	const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
		script?: string | null;
	}) => {
		const res = await new Promise<any>((resolve) => {
			if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
				chrome.runtime.sendMessage(
					{
						type: 'replay:run',
						options: opts
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
		onShowToast?.(`Replay ${opts.testCaseNo} berhasil dijalankan!`, 'success');
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

			setSessionDetail(sessionObj);
			setGenerations((genRes.items || []) as GenerationItem[]);
		} catch (err) {
			setError((err as Error).message || 'Gagal memuat detail hasil rekaman.');
		} finally {
			setLoading(false);
		}
	}, [api]);

	useEffect(() => {
		if (isVisible && sessionId) {
			void loadData(sessionId);
			setActiveTab('overview');
		} else {
			setSessionDetail(null);
			setGenerations([]);
			setError(null);
		}
	}, [isVisible, sessionId, loadData]);

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
			const extension = kindLower.includes('json') ? 'json' : kindLower.includes('report') ? 'md' : 'ts';
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

	const testCaseNo = testCase?.test_case_id || sessionDetail?.test_case_no || `Sesi #${sessionId}`;
	const title = testCase?.title || sessionDetail?.title || 'Hasil Pengujian Rekaman';
	const actualResult = sessionDetail?.actual_result || testCase?.actual_result;
	const checkpoints = sessionDetail?.checkpoints || [];

	const playwrightGen = generations.find((g) => g.kind === 'playwright');
	const playwrightScript = playwrightGen?.output || null;
	const hasPlaywrightScript = Boolean(playwrightScript && playwrightScript.trim().length > 0);

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
							<Button
								type="button"
								variant="primary"
								size="sm"
								disabled={!hasPlaywrightScript || loading || busyGenerate}
								icon={<Repeat size={13} />}
								onClick={() => setReRunOpen(true)}
								title={
									hasPlaywrightScript
										? 'Jalankan ulang skenario ini secara visual di browser'
										: 'Script otomasi belum terbuat. Generate script terlebih dahulu untuk menjalankan re-run.'
								}
							>
								Re-run
							</Button>
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
										{renderResultBadge(sessionDetail?.result || testCase?.status)}
									</div>
									<h3 style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginTop: 6, margin: '6px 0 0 0' }}>
										{title}
									</h3>
								</div>
								{sessionDetail?.target_url && (
									<div style={{ fontSize: 11, color: '#64748b', maxWidth: 260, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={sessionDetail.target_url}>
										🔗 {sessionDetail.target_url}
									</div>
								)}
							</div>

							{/* Temuan / Actual Result Box */}
							{actualResult && (
								<div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
									<div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
										Temuan QA / Actual Result:
									</div>
									<div style={{ fontSize: 12, color: '#1e293b', background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', lineHeight: 1.5 }}>
										{actualResult}
									</div>
								</div>
							)}
						</div>

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
										{sessionDetail?.video_url && (
											<a
												href={sessionDetail.video_url}
												target="_blank"
												rel="noreferrer"
												style={{ fontSize: 11, color: '#2F3574', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
											>
												<span>Buka di Tab Baru</span>
												<ExternalLink size={11} />
											</a>
										)}
									</div>

									{sessionDetail?.video_url ? (
										<div style={{ background: '#090d16', borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid #1e293b' }}>
											<video
												ref={videoRef}
												controls
												preload="metadata"
												src={sessionDetail.video_url}
												style={{ width: '100%', maxHeight: 250, display: 'block', outline: 'none' }}
											/>
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
														href={sessionDetail.video_url}
														download={`session-${sessionId}-recording.webm`}
														target="_blank"
														rel="noreferrer"
														style={{ textDecoration: 'none' }}
													>
														<Button type="button" variant="ghost" size="xs" icon={<Download size={11} />} style={{ color: '#e2e8f0' }}>
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

								{/* Quick Action Banner */}
								<div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
									<div>
										<div style={{ fontWeight: 700, fontSize: 12, color: '#2F3574' }}>
											Otomasi Skenario Ini
										</div>
										<div style={{ fontSize: 11, color: '#4338CA', marginTop: 2 }}>
											{hasPlaywrightScript
												? 'Script Playwright tersedia dan siap di-re-run langsung di browser.'
												: 'Generate script Playwright untuk menjalankan otomasi browser secara instan.'}
										</div>
									</div>
									<div style={{ display: 'flex', gap: 6 }}>
										{hasPlaywrightScript ? (
											<Button
												type="button"
												variant="primary"
												size="xs"
												icon={<Play size={12} fill="currentColor" />}
												onClick={() => setReRunOpen(true)}
											>
												Mulai Re-run
											</Button>
										) : (
											<Button
												type="button"
												variant="primary"
												size="xs"
												loading={busyGenerate}
												disabled={busyGenerate}
												icon={<Sparkles size={12} />}
												onClick={handleGenerate}
											>
												Generate Script
											</Button>
										)}
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

						{/* TAB 3: PLAYWRIGHT SCRIPT */}
						{activeTab === 'script' && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
										<Code2 size={15} color="#2F3574" />
										<span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
											Kode Otomasi Playwright (AI Generated)
										</span>
									</div>
									<Button
										type="button"
										variant="primary"
										size="xs"
										loading={busyGenerate}
										disabled={busyGenerate}
										icon={<Sparkles size={11} />}
										onClick={handleGenerate}
									>
										{generations.length > 0 ? 'Generate Ulang' : 'Generate Script'}
									</Button>
								</div>

								{generations.length === 0 ? (
									<div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '24px 16px', textAlign: 'center', background: '#f8fafc' }}>
										<FileText size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
										<div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
											Belum ada script otomasi yang digenerate
										</div>
										<div style={{ fontSize: 11, color: '#64748b', marginTop: 4, maxWidth: 320, margin: '4px auto 0' }}>
											Klik tombol &quot;Generate Script&quot; di atas untuk membuat kode Playwright dari rekaman sesi ini secara instan.
										</div>
									</div>
								) : (
									generations.map((item) => (
										<div key={item.id_generation} style={{ border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
											{/* Code Block Header */}
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '8px 12px', borderBottom: '1px solid #334155' }}>
												<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
													<Badge variant="default">{item.kind.toUpperCase()}</Badge>
													<span style={{ fontSize: 11, color: '#94a3b8' }}>#{item.id_generation}</span>
												</div>
												<div style={{ display: 'flex', gap: 6 }}>
													{item.output && (
														<>
															<Button
																type="button"
																variant="secondary"
																size="xs"
																icon={copiedId === item.id_generation ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
																onClick={() => void handleCopy(item.output, item.id_generation)}
															>
																{copiedId === item.id_generation ? 'Tersalin!' : 'Salin Kode'}
															</Button>
															<Button
																type="button"
																variant="outline"
																size="xs"
																icon={<Download size={12} />}
																onClick={() => handleDownload(item)}
															>
																Unduh {item.kind === 'playwright' ? '.spec.ts' : item.kind === 'report' ? '.md' : '.' + item.kind}
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
											{item.output && (
												<pre
													style={{
														margin: 0,
														padding: '12px 14px',
														background: '#0f172a',
														color: '#f8fafc',
														fontSize: 11.5,
														lineHeight: 1.6,
														maxHeight: 260,
														overflowY: 'auto',
														whiteSpace: 'pre-wrap',
														fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
													}}
												>
													{item.output}
												</pre>
											)}
										</div>
									))
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

