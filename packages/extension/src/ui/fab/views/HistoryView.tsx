import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, Download, Copy, Check, Eye, Code2, AlertTriangle, Share2, Play } from 'lucide-react';
import type { RecordingSession } from '../../../recording/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';

export interface GenerationItem {
	id_generation: number;
	kind: string;
	status: string;
	output: string | null;
	error_message: string | null;
}

export interface HistoryViewProps {
	sessions: RecordingSession[];
	generations: GenerationItem[];
	activeSessionId: number | null;
	busy: boolean;
	error: string | null;
	onRefresh: () => void;
	onGenerate: (idSession: number) => void;
	onViewGenerations: (idSession: number) => void;
	onOpenDetail?: (session: RecordingSession) => void;
	onDownload: (item: GenerationItem) => void;
	onShare?: (idSession: number) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
	sessions,
	generations,
	activeSessionId,
	busy,
	error,
	onRefresh,
	onGenerate,
	onViewGenerations,
	onOpenDetail,
	onDownload,
	onShare
}) => {
	const [search, setSearch] = useState('');
	const [selectedProject, setSelectedProject] = useState<string>('all');
	const [copiedId, setCopiedId] = useState<number | null>(null);
	const [modalItem, setModalItem] = useState<GenerationItem | null>(null);

	const handleCopy = async (item: GenerationItem) => {
		if (!item.output) return;
		try {
			await navigator.clipboard.writeText(item.output);
			setCopiedId(item.id_generation);
			setTimeout(() => setCopiedId(null), 2000);
		} catch (err) {
			try {
				const textarea = document.createElement('textarea');
				textarea.value = item.output;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				const successful = document.execCommand('copy');
				document.body.removeChild(textarea);
				if (successful) {
					setCopiedId(item.id_generation);
					setTimeout(() => setCopiedId(null), 2000);
					return;
				}
			} catch {
				// Fallback also failed
			}
			console.error('Gagal menyalin kode ke clipboard:', err);
		}
	};

	// Ekstrak list unik project ID jika tersedia
	const projectOptions = useMemo(() => {
		const map = new Map<number, string>();
		sessions.forEach((s) => {
			if (s.id_project && !map.has(s.id_project)) {
				map.set(s.id_project, `Project #${s.id_project}`);
			}
		});
		return Array.from(map.entries());
	}, [sessions]);

	const filteredSessions = useMemo(() => {
		const query = search.trim().toLowerCase();
		return sessions.filter((session) => {
			const matchQuery =
				!query ||
				session.title.toLowerCase().includes(query) ||
				session.test_case_no.toLowerCase().includes(query) ||
				String(session.id_session).includes(query);
			const matchProj = selectedProject === 'all' || String(session.id_project) === selectedProject;
			return matchQuery && matchProj;
		});
	}, [sessions, search, selectedProject]);

	const renderStatusBadge = (session: RecordingSession) => {
		const res = session.result?.toUpperCase();
		if (res === 'PASS') return <Badge variant="success">PASS</Badge>;
		if (res === 'FAIL') return <Badge variant="danger">FAIL</Badge>;
		if (res === 'BLOCKED') return <Badge variant="warning">BLOCKED</Badge>;
		return <Badge variant="neutral">{session.status}</Badge>;
	};

	const handleSessionClick = (session: RecordingSession) => {
		if (onOpenDetail) {
			onOpenDetail(session);
		} else {
			onViewGenerations(session.id_session);
		}
	};

	return (
		<>
			{error && <div className="sp-error">{error}</div>}

			{/* Modal Code Preview */}
			<Modal
				open={Boolean(modalItem)}
				onClose={() => setModalItem(null)}
				noPadding
				title={
					modalItem
						? `Preview: ${modalItem.kind.toUpperCase()} (#${modalItem.id_generation})`
						: 'Code Preview'
				}
				footer={
					modalItem ? (
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => handleCopy(modalItem)}
								icon={copiedId === modalItem.id_generation ? <Check size={14} /> : <Copy size={14} />}
							>
								{copiedId === modalItem.id_generation ? 'Tersalin' : 'Salin Kode'}
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={() => onDownload(modalItem)}
								icon={<Download size={14} />}
							>
								download
							</Button>
						</div>
					) : null
				}
			>
				{modalItem?.output ? (
					<pre className="k-code-block">{modalItem.output}</pre>
				) : (
					<div className="sp-muted" style={{ padding: 16 }}>
						Tidak ada output kode.
					</div>
				)}
			</Modal>

			{/* Generation Results Card (jika ada output aktif) */}
			{generations.length > 0 && (
				<Card className="sp-card" style={{ marginBottom: 12 }}>
					<CardHeader>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Code2 size={16} color="#2F3574" />
							<CardTitle className="sp-label" style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
								Hasil Generation {activeSessionId ? `(#${activeSessionId})` : ''}
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{generations.map((item) => (
							<div className="sp-list-item" key={item.id_generation} style={{ paddingTop: 8 }}>
								<div className="sp-button-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
										<Badge variant="default" className="sp-badge">{item.kind}</Badge>
										<span className="sp-muted" style={{ fontSize: 11 }}>{item.status}</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
										{item.output && (
											<>
												<Button
													variant="ghost"
													size="xs"
													onClick={() => setModalItem(item)}
													title="Lihat di modal besar"
													icon={<Eye size={12} />}
												>
													preview
												</Button>
												<Button
													variant="ghost"
													size="xs"
													onClick={() => handleCopy(item)}
													title="Salin kode"
													icon={copiedId === item.id_generation ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
												>
													{copiedId === item.id_generation ? 'tersalin' : 'salin'}
												</Button>
												<Button
													variant="primary"
													size="xs"
													onClick={() => onDownload(item)}
													icon={<Download size={12} />}
												>
													download
												</Button>
											</>
										)}
									</div>
								</div>
								{item.error_message && (
									<div className="sp-muted" style={{ color: '#dc2626', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
										<AlertTriangle size={12} />
										<span>Error: {item.error_message}</span>
									</div>
								)}
								{item.output && <pre className="sp-pre">{item.output}</pre>}
							</div>
						))}
					</CardContent>
				</Card>
			)}

			{/* Riwayat Session List Card */}
			<Card className="sp-card">
				<CardHeader>
					<div className="sp-button-row" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
						<CardTitle className="sp-label" style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
							Riwayat Session
						</CardTitle>
						<Button
							variant="ghost"
							size="sm"
							className="sp-link-button"
							onClick={onRefresh}
							disabled={busy}
							loading={busy}
							icon={!busy ? <RefreshCw size={12} /> : undefined}
						>
							{busy ? 'memuat...' : 'refresh'}
						</Button>
					</div>

					{/* Search & Project Filter Controls */}
					<div style={{ display: 'flex', gap: 8, marginTop: 4, width: '100%' }}>
						<div style={{ flex: 1 }}>
							<Input
								placeholder="Cari test case atau judul..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								icon={<Search size={14} />}
								style={{ marginBottom: 0 }}
							/>
						</div>
						{projectOptions.length > 1 && (
							<div style={{ width: '120px' }}>
								<select
									className="k-select"
									value={selectedProject}
									onChange={(e) => setSelectedProject(e.target.value)}
									style={{ height: '36px', fontSize: '11px', padding: '0 8px' }}
									aria-label="Filter berdasarkan project"
								>
									<option value="all">Semua Project</option>
									{projectOptions.map(([id, label]) => (
										<option key={id} value={String(id)}>
											{label}
										</option>
									))}
								</select>
							</div>
						)}
					</div>
				</CardHeader>

				<CardContent>
					{sessions.length === 0 ? (
						<div className="sp-muted" style={{ padding: '16px 0', textAlign: 'center' }}>
							Belum ada session rekaman.
						</div>
					) : filteredSessions.length === 0 ? (
						<div className="sp-muted" style={{ padding: '16px 0', textAlign: 'center' }}>
							Tidak ada sesi yang cocok dengan &quot;{search}&quot;.
						</div>
					) : (
						filteredSessions.map((session) => (
							<div
								className="sp-list-item"
								key={session.id_session}
								style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
								onClick={() => handleSessionClick(session)}
							>
								<div className="sp-button-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
									<div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
										<div
											style={{
												fontWeight: 600,
												fontSize: 13,
												color: '#0f172a',
												textOverflow: 'ellipsis',
												overflow: 'hidden',
												whiteSpace: 'nowrap'
											}}
										>
											{session.title}
										</div>
										<div className="sp-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
											<span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2F3574' }}>
												{session.test_case_no}
											</span>
											{!session.id_project && (
												<span style={{ fontSize: 10, background: '#EEF2FF', color: '#3730A3', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
													Quick
												</span>
											)}
											<span>·</span>
											{renderStatusBadge(session)}
											<span>·</span>
											<span style={{ fontSize: 11 }}>#Session {session.id_session}</span>
										</div>
									</div>
									<div className="sp-button-row" style={{ gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
										{onShare && (
											<Button
												variant="ghost"
												size="xs"
												title="Bagikan Link Debug"
												aria-label={`Bagikan ${session.test_case_no}`}
												icon={<Share2 size={12} />}
												onClick={() => onShare(session.id_session)}
											/>
										)}
										<Button
											variant="outline"
											size="xs"
											disabled={busy}
											onClick={() => onGenerate(session.id_session)}
										>
											generate
										</Button>
										<Button
											variant="secondary"
											size="xs"
											disabled={busy}
											icon={<Eye size={11} />}
											onClick={() => handleSessionClick(session)}
										>
											hasil
										</Button>
									</div>
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>
		</>
	);
};

