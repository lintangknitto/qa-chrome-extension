import React, { useState, useEffect } from 'react';
import {
	RotateCcw,
	Dices,
	Globe,
	Layers,
	PlayCircle,
	AlertCircle,
	CheckCircle2,
	Gauge,
	Zap,
	Clock,
	Video,
	FileUp
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
	extractReRunParameters,
	generateRandomValue,
	type ReRunParameter
} from '../../../recording/parameterExtractor';
import { parseScriptToReplaySteps, stepFileNames } from '../../../recording/replayEngine';
import type { RecordingApiClient, TestDataFile } from '../../../recording/apiClient';

/** Nama file yang dibutuhkan langkah upload di script, tanpa duplikat. */
export const requiredUploadFileNames = (script: string | null | undefined): string[] => {
	if (!script?.trim()) return [];
	const names = parseScriptToReplaySteps(script)
		.filter((step) => step.action === 'setInputFiles')
		.flatMap(stepFileNames);
	return [...new Set(names)];
};

export interface ReRunModalProps {
	isOpen?: boolean;
	open?: boolean;
	sessionId: number | null;
	testCaseNo: string;
	title: string;
	targetUrl?: string;
	script?: string | null;
	actions?: Array<{ action_type?: string; target_selector?: string; value?: string }>;
	/** Untuk mendeteksi & mengunggah file test data pengganti langkah upload. */
	api?: Pick<RecordingApiClient, 'listTestDataFiles' | 'uploadReplacementTestData'>;
	onClose: () => void;
	onStartReRun: (options: {
		sessionId: number;
		testCaseNo: string;
		targetUrl?: string;
		parameterOverrides: Record<string, string>;
		mode: 'tabGroup' | 'activeTab';
		speedMode?: 'normal' | 'fast' | 'slow';
		stepDelayMs?: number;
		script?: string | null;
	}) => Promise<void>;
}

export const ReRunModal: React.FC<ReRunModalProps> = ({
	isOpen,
	open,
	sessionId,
	testCaseNo,
	title,
	targetUrl,
	script,
	actions,
	api,
	onClose,
	onStartReRun
}) => {
	const isVisible = open ?? isOpen ?? false;

	const [parameters, setParameters] = useState<ReRunParameter[]>([]);
	const [mode, setMode] = useState<'tabGroup' | 'activeTab'>('tabGroup');
	const [speedMode, setSpeedMode] = useState<'normal' | 'fast' | 'slow'>('normal');
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasScript = Boolean(script && script.trim().length > 0);
	const [testDataFiles, setTestDataFiles] = useState<TestDataFile[] | null>(null);
	const [uploadingName, setUploadingName] = useState<string | null>(null);
	const requiredFiles = requiredUploadFileNames(script);
	const availableNames = new Set((testDataFiles ?? []).map((file) => file.file_name));
	// Daftar belum dimuat dianggap belum lengkap agar replay tidak jalan sebelum file dicek.
	const missingFiles = requiredFiles.filter((name) => testDataFiles === null || !availableNames.has(name));
	const filesReady = requiredFiles.length === 0 || (testDataFiles !== null && missingFiles.length === 0);

	useEffect(() => {
		if (!isVisible || !api || !sessionId || requiredFiles.length === 0) {
			setTestDataFiles(requiredFiles.length === 0 ? [] : null);
			return;
		}
		let active = true;
		api.listTestDataFiles(sessionId)
			.then((files) => active && setTestDataFiles(files))
			.catch(() => active && setTestDataFiles([]));
		return () => {
			active = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isVisible, api, sessionId, script]);

	const handleReplacementFile = async (expectedName: string, file: File | undefined) => {
		if (!file || !api || !sessionId) return;
		setUploadingName(expectedName);
		setError(null);
		try {
			setTestDataFiles(await api.uploadReplacementTestData(sessionId, expectedName, file));
		} catch (err) {
			setError((err as Error).message || 'Gagal mengunggah file pengganti');
		} finally {
			setUploadingName(null);
		}
	};

	useEffect(() => {
		if (isVisible) {
			const extracted = extractReRunParameters({ script, actions });
			setParameters(extracted);
			setError(null);
		} else {
			setParameters([]);
			setError(null);
		}
	}, [isVisible, script, actions]);

	const handleValueChange = (id: string, newVal: string) => {
		setParameters((prev) =>
			prev.map((p) => (p.id === id ? { ...p, currentValue: newVal } : p))
		);
	};

	const handleRandomizeAll = () => {
		setParameters((prev) =>
			prev.map((p) => ({
				...p,
				currentValue: generateRandomValue(p)
			}))
		);
	};

	const handleResetAll = () => {
		setParameters((prev) =>
			prev.map((p) => ({
				...p,
				currentValue: p.originalValue
			}))
		);
	};

	const handleSubmit = async () => {
		if (!sessionId || !hasScript) return;
		setRunning(true);
		setError(null);

		const overrides: Record<string, string> = {};
		for (const p of parameters) {
			overrides[p.selector] = p.currentValue;
		}

		const stepDelayMs = speedMode === 'fast' ? 300 : speedMode === 'slow' ? 1500 : 800;

		try {
			await onStartReRun({
				sessionId,
				testCaseNo,
				targetUrl,
				parameterOverrides: overrides,
				mode,
				speedMode,
				stepDelayMs,
				script
			});
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal memulai Re-run');
		} finally {
			setRunning(false);
		}
	};

	return (
		<Modal
			open={isVisible}
			onClose={() => !running && onClose()}
			title={`Re-run Dinamis: ${testCaseNo}`}
			footer={
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={running}
						onClick={onClose}
					>
						Batal
					</Button>
					<Button
						type="button"
						variant="primary"
						size="sm"
						loading={running}
						disabled={running || !hasScript || !filesReady || uploadingName !== null}
						icon={<PlayCircle size={14} />}
						onClick={handleSubmit}
						title={!hasScript ? 'Script otomasi belum tersedia' : !filesReady ? 'Pilih file pengganti untuk semua langkah upload' : undefined}
					>
						Mulai Re-run
					</Button>
				</div>
			}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
				{!hasScript && (
					<div
						style={{
							padding: '10px 12px',
							borderRadius: 8,
							background: '#fff1f2',
							border: '1px solid #fecdd3',
							color: '#9f1239',
							fontSize: 12,
							display: 'flex',
							alignItems: 'center',
							gap: 8
						}}
					>
						<AlertCircle size={16} />
						<span>Script otomasi Playwright belum terbuat. Generate script terlebih dahulu sebelum dapat menjalankan re-run.</span>
					</div>
				)}

				{requiredFiles.length > 0 && missingFiles.length > 0 && (
					<div
						data-testid="rerun-missing-files"
						style={{ padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#92400e' }}>
							<FileUp size={14} />
							<span>{testDataFiles === null ? 'Memeriksa file test data…' : 'File test data langkah upload belum tersedia'}</span>
						</div>
						{testDataFiles !== null && missingFiles.map((name) => (
							<label key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#78350f' }}>
								<span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
									<span style={{ fontWeight: 600 }}>{uploadingName === name ? 'Mengunggah…' : 'Pilih file pengganti'}</span>
									<input
										type="file"
										aria-label={`Pilih file pengganti untuk ${name}`}
										disabled={uploadingName !== null || !api}
										onChange={(event) => void handleReplacementFile(name, event.target.files?.[0])}
										style={{ fontSize: 11, maxWidth: 180 }}
									/>
								</span>
							</label>
						))}
					</div>
				)}

				{/* Skenario Meta Card */}
				<div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#2F3574' }}>
							{testCaseNo}
						</span>
						<span style={{ color: '#94a3b8' }}>·</span>
						<span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{title}</span>
					</div>
					{targetUrl && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: '#64748b' }}>
							<Globe size={12} />
							<span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
								{targetUrl}
							</span>
						</div>
					)}
				</div>

				{error && (
					<div className="sp-error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<AlertCircle size={14} />
						<span>{error}</span>
					</div>
				)}

				{/* Parameter Override Section */}
				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
						<div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
							Parameter Input ({parameters.length})
						</div>
						{parameters.length > 0 && (
							<div style={{ display: 'flex', gap: 6 }}>
								<Button
									type="button"
									variant="ghost"
									size="xs"
									icon={<RotateCcw size={11} />}
									onClick={handleResetAll}
									title="Kembalikan ke nilai awal"
								>
									Reset
								</Button>
								<Button
									type="button"
									variant="secondary"
									size="xs"
									icon={<Dices size={11} />}
									onClick={handleRandomizeAll}
									title="Acak semua nilai parameter"
								>
									Acak Data
								</Button>
							</div>
						)}
					</div>

					{parameters.length === 0 ? (
						<div
							style={{
								padding: '16px',
								textAlign: 'center',
								background: '#f8fafc',
								border: '1px dashed #cbd5e1',
								borderRadius: 8,
								fontSize: 12,
								color: '#64748b'
							}}
						>
							Tidak ada field input form yang perlu di-override untuk skenario ini.
							Alur dapat langsung dijalankan ulang.
						</div>
					) : (
						<div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
							<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
								<thead>
									<tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
										<th style={{ padding: '8px 10px', width: '38%' }}>Field / Selector</th>
										<th style={{ padding: '8px 10px', width: '28%' }}>Nilai Asli</th>
										<th style={{ padding: '8px 10px', width: '34%' }}>Nilai Baru (Override)</th>
									</tr>
								</thead>
								<tbody>
									{parameters.map((p, idx) => (
										<tr
											key={p.id}
											style={{
												borderBottom: idx < parameters.length - 1 ? '1px solid #f1f5f9' : 'none',
												background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
											}}
										>
											<td style={{ padding: '6px 10px' }}>
												<div style={{ fontWeight: 600, color: '#1e293b' }}>{p.label}</div>
												<div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: 10 }}>
													{p.selector}
												</div>
											</td>
											<td style={{ padding: '6px 10px', color: '#64748b', fontStyle: 'italic' }}>
												{p.originalValue || '-'}
											</td>
											<td style={{ padding: '6px 10px' }}>
												<Input
													value={p.currentValue}
													onChange={(e) => handleValueChange(p.id, e.target.value)}
													style={{ fontSize: 11, padding: '4px 8px', height: '28px', margin: 0 }}
													aria-label={`Override nilai untuk ${p.label}`}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Pilihan Mode Eksekusi */}
				<div>
					<div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
						<Layers size={13} color="#2F3574" />
						<span>Mode Eksekusi Browser</span>
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<label
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 10,
								padding: '10px 12px',
								border: `1.5px solid ${mode === 'tabGroup' ? '#2F3574' : '#e2e8f0'}`,
								borderRadius: 8,
								background: mode === 'tabGroup' ? '#f0f4ff' : '#ffffff',
								cursor: 'pointer',
								transition: 'all 0.15s ease'
							}}
						>
							<input
								type="radio"
								name="replayMode"
								value="tabGroup"
								checked={mode === 'tabGroup'}
								onChange={() => setMode('tabGroup')}
								style={{ marginTop: 2, accentColor: '#2F3574' }}
							/>
							<div>
								<div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
									Tab Group Baru di Latar Belakang (Non-blocking & Parallel)
								</div>
								<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
									Membuka tab baru dalam grup khusus &quot;Knitto Replay&quot; tanpa mengganggu tab aktif yang sedang Anda gunakan.
								</div>
							</div>
						</label>

						<label
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: 10,
								padding: '10px 12px',
								border: `1.5px solid ${mode === 'activeTab' ? '#2F3574' : '#e2e8f0'}`,
								borderRadius: 8,
								background: mode === 'activeTab' ? '#f0f4ff' : '#ffffff',
								cursor: 'pointer',
								transition: 'all 0.15s ease'
							}}
						>
							<input
								type="radio"
								name="replayMode"
								value="activeTab"
								checked={mode === 'activeTab'}
								onChange={() => setMode('activeTab')}
								style={{ marginTop: 2, accentColor: '#2F3574' }}
							/>
							<div>
								<div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
									Tab Browser yang Sedang Aktif
								</div>
								<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
									Menjalankan interaksi langsung pada tab browser yang sedang terbuka di layar utama.
								</div>
							</div>
						</label>
					</div>
				</div>

				{/* Pilihan Kecepatan Replay & Perekaman Video */}
				<div>
					<div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<Gauge size={13} color="#2F3574" />
							<span>Kecepatan Replay (Pacing)</span>
						</div>
						<span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
							{speedMode === 'normal' ? 'Jeda 800ms / step' : speedMode === 'fast' ? 'Jeda 300ms / step' : 'Jeda 1500ms / step'}
						</span>
					</div>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
						<button
							type="button"
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 4,
								padding: '10px 8px',
								border: `1.5px solid ${speedMode === 'fast' ? '#2F3574' : '#e2e8f0'}`,
								background: speedMode === 'fast' ? '#f0f4ff' : '#ffffff',
								borderRadius: 8,
								cursor: 'pointer',
								textAlign: 'center',
								transition: 'all 0.15s ease'
							}}
							onClick={() => setSpeedMode('fast')}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11, color: speedMode === 'fast' ? '#2F3574' : '#475569' }}>
								<Zap size={12} color={speedMode === 'fast' ? '#2F3574' : '#64748b'} />
								<span>Cepat</span>
							</div>
							<span style={{ fontSize: 10, color: '#64748b' }}>~300ms delay</span>
						</button>

						<button
							type="button"
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 4,
								padding: '10px 8px',
								border: `1.5px solid ${speedMode === 'normal' ? '#2F3574' : '#e2e8f0'}`,
								background: speedMode === 'normal' ? '#f0f4ff' : '#ffffff',
								borderRadius: 8,
								cursor: 'pointer',
								textAlign: 'center',
								transition: 'all 0.15s ease',
								position: 'relative'
							}}
							onClick={() => setSpeedMode('normal')}
						>
							<span style={{ position: 'absolute', top: -7, right: 6, background: '#16a34a', color: '#ffffff', fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 6 }}>
								Disarankan
							</span>
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11, color: speedMode === 'normal' ? '#2F3574' : '#475569' }}>
								<PlayCircle size={12} color={speedMode === 'normal' ? '#2F3574' : '#64748b'} />
								<span>Normal</span>
							</div>
							<span style={{ fontSize: 10, color: '#64748b' }}>~800ms delay</span>
						</button>

						<button
							type="button"
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 4,
								padding: '10px 8px',
								border: `1.5px solid ${speedMode === 'slow' ? '#2F3574' : '#e2e8f0'}`,
								background: speedMode === 'slow' ? '#f0f4ff' : '#ffffff',
								borderRadius: 8,
								cursor: 'pointer',
								textAlign: 'center',
								transition: 'all 0.15s ease'
							}}
							onClick={() => setSpeedMode('slow')}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11, color: speedMode === 'slow' ? '#2F3574' : '#475569' }}>
								<Clock size={12} color={speedMode === 'slow' ? '#2F3574' : '#64748b'} />
								<span>Lambat / Debug</span>
							</div>
							<span style={{ fontSize: 10, color: '#64748b' }}>~1.5s delay</span>
						</button>
					</div>
				</div>

				{/* Video Recording Live Capture Notice */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 12px', borderRadius: 8, fontSize: 11, color: '#065f46' }}>
					<Video size={14} color="#059669" />
					<span>Tab browser akan direkam otomatis (WebM) dan disimpan ke riwayat eksekusi (Historical Runs).</span>
				</div>
			</div>
		</Modal>
	);
};
