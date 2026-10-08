import React, { useState, useEffect, useCallback } from 'react';
import {
	RecordingApiClient,
	type ProgramItem
} from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';
import { CreateEditProgramModal } from './CreateEditProgramModal';
import { DeleteProgramModal } from './DeleteProgramModal';
import { Button } from '../components/Button';
import {
	Layers,
	Plus,
	Search,
	RefreshCw,
	Globe,
	Code2,
	Edit2,
	Trash2,
	ExternalLink,
	Copy,
	Check,
	FolderKanban,
	AlertCircle,
	Server,
	Activity
} from 'lucide-react';
import { canEditProgram, canDeleteProgram } from '../fab-permissions';

export interface ProgramViewProps {
	api: RecordingApiClient;
	user?: StoredUser | null;
	onSelectProgram?: (program: ProgramItem) => void;
	showNotice: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const ProgramView: React.FC<ProgramViewProps> = ({
	api,
	user,
	onSelectProgram,
	showNotice
}) => {
	const [programs, setPrograms] = useState<ProgramItem[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	// Modal states
	const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
	const [editingProgram, setEditingProgram] = useState<ProgramItem | null>(null);
	const [deletingProgram, setDeletingProgram] = useState<ProgramItem | null>(null);

	const fetchPrograms = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.listPrograms({
				search: searchQuery.trim() || undefined,
				perPage: 50
			});
			setPrograms(res.items || []);
			setTotal(res.total ?? (res.items || []).length);
		} catch (err) {
			const isAuthErr =
				(err as any)?.status === 401 ||
				(err as Error)?.message?.toLowerCase().includes('login');
			if (!isAuthErr) {
				showNotice((err as Error).message || 'Gagal memuat master program.', 'error');
			}
		} finally {
			setLoading(false);
		}
	}, [api, searchQuery, showNotice]);

	useEffect(() => {
		fetchPrograms();
	}, [fetchPrograms]);

	const handleCopy = (text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
		showNotice('URL disalin ke clipboard.', 'success');
	};

	const handleSaveProgram = async (data: {
		name: string;
		code?: string;
		base_url?: string;
		repo_url?: string;
		description?: string;
		is_active?: boolean;
	}) => {
		if (editingProgram) {
			await api.updateProgram(editingProgram.id_program, data);
			showNotice(`Program "${data.name}" berhasil diperbarui.`, 'success');
		} else {
			await api.createProgram(data);
			showNotice(`Program "${data.name}" berhasil ditambahkan.`, 'success');
		}
		await fetchPrograms();
	};

	const handleConfirmDelete = async (program: ProgramItem) => {
		const res = await api.deleteProgram(program.id_program);
		if (res.action === 'deactivated') {
			showNotice(`Program "${program.name}" dinonaktifkan (memiliki project terkait).`, 'info');
		} else {
			showNotice(`Program "${program.name}" berhasil dihapus.`, 'success');
		}
		await fetchPrograms();
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				gap: '12px',
				padding: '16px',
				boxSizing: 'border-box',
				overflowY: 'auto'
			}}
		>
			{/* Top Bar */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					flexWrap: 'wrap',
					gap: '8px'
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Layers size={20} color="#2563eb" />
					<h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
						Master Program
					</h2>
					<span
						style={{
							background: '#eff6ff',
							color: '#2563eb',
							padding: '2px 8px',
							borderRadius: '12px',
							fontSize: '11px',
							fontWeight: 600
						}}
					>
						{total} Program
					</span>
				</div>

				<Button
					variant="primary"
					size="sm"
					icon={<Plus size={14} />}
					onClick={() => {
						setEditingProgram(null);
						setIsCreateEditOpen(true);
					}}
				>
					Tambah Program
				</Button>
			</div>

			{/* Search & Actions Bar */}
			<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						background: '#ffffff',
						border: '1px solid #cbd5e1',
						borderRadius: '8px',
						padding: '6px 10px',
						flex: 1
					}}
				>
					<Search size={14} color="#94a3b8" />
					<input
						type="text"
						placeholder="Cari nama atau kode program..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						style={{
							border: 'none',
							outline: 'none',
							fontSize: '13px',
							width: '100%',
							background: 'transparent',
							color: '#1e293b'
						}}
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery('')}
							style={{
								background: 'none',
								border: 'none',
								color: '#94a3b8',
								cursor: 'pointer',
								fontSize: '12px',
								padding: '0 4px'
							}}
						>
							✕
						</button>
					)}
				</div>

				<Button
					variant="secondary"
					size="sm"
					icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
					onClick={fetchPrograms}
					disabled={loading}
					title="Segarkan data"
				/>
			</div>

			{/* Program Catalog List */}
			{loading && programs.length === 0 ? (
				<div
					style={{
						padding: '32px 16px',
						textAlign: 'center',
						color: '#64748b',
						fontSize: '13px',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '8px'
					}}
				>
					<RefreshCw size={20} className="animate-spin" color="#3b82f6" />
					<span>Memuat master program...</span>
				</div>
			) : programs.length === 0 ? (
				<div
					style={{
						padding: '40px 16px',
						textAlign: 'center',
						background: '#ffffff',
						border: '1px dashed #cbd5e1',
						borderRadius: '12px',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '12px'
					}}
				>
					<Layers size={36} color="#94a3b8" />
					<div style={{ color: '#475569', fontSize: '13.5px', fontWeight: 500 }}>
						{searchQuery ? 'Tidak ada program yang sesuai dengan pencarian.' : 'Belum ada Master Program terdaftar.'}
					</div>
					<p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '320px' }}>
						Daftarkan master aplikasi (contoh: Knitto Portal, Knitto ERP) beserta URL staging dan repository GitHub.
					</p>
					<Button
						variant="primary"
						size="sm"
						icon={<Plus size={14} />}
						onClick={() => {
							setEditingProgram(null);
							setIsCreateEditOpen(true);
						}}
					>
						Tambah Program Pertama
					</Button>
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
					{programs.map((prog) => {
						const userCanEdit = canEditProgram(user, prog);
						const userCanDelete = canDeleteProgram(user, prog);
						return (
							<div
								key={prog.id_program}
								style={{
									background: '#ffffff',
									border: '1px solid #e2e8f0',
									borderRadius: '10px',
									padding: '14px',
									display: 'flex',
									flexDirection: 'column',
									gap: '10px',
									boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
									transition: 'border-color 0.2s, box-shadow 0.2s'
								}}
							>
								{/* Header: Title & Badges */}
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
										gap: '8px'
									}}
								>
									<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
											<span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
												{prog.name}
											</span>
											<span
												style={{
													fontFamily: 'monospace',
													fontSize: '11px',
													padding: '2px 6px',
													background: '#f1f5f9',
													color: '#475569',
													borderRadius: '4px',
													border: '1px solid #e2e8f0'
												}}
											>
												{prog.code}
											</span>
											{prog.type === 'SERVICE' ? (
												<span
													style={{
														display: 'inline-flex',
														alignItems: 'center',
														gap: '3px',
														fontSize: '10.5px',
														fontWeight: 600,
														padding: '1px 6px',
														background: '#faf5ff',
														color: '#7e22ce',
														borderRadius: '4px',
														border: '1px solid #e9d5ff'
													}}
													title="Service / Backend Component"
												>
													<Server size={11} />
													<span>SERVICE</span>
												</span>
											) : (
												<span
													style={{
														display: 'inline-flex',
														alignItems: 'center',
														gap: '3px',
														fontSize: '10.5px',
														fontWeight: 600,
														padding: '1px 6px',
														background: '#eff6ff',
														color: '#1d4ed8',
														borderRadius: '4px',
														border: '1px solid #bfdbfe'
													}}
													title="Frontend / UI Component"
												>
													<Globe size={11} />
													<span>FRONTEND</span>
												</span>
											)}
											{!prog.is_active && (
												<span
													style={{
														fontSize: '10px',
														fontWeight: 600,
														padding: '1px 6px',
														background: '#fee2e2',
														color: '#ef4444',
														borderRadius: '4px'
													}}
												>
													Nonaktif
												</span>
											)}
										</div>
										{prog.description && (
											<span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
												{prog.description}
											</span>
										)}
									</div>

									{/* Project count badge */}
									<div
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '4px',
											padding: '3px 8px',
											borderRadius: '6px',
											background: '#f0fdf4',
											border: '1px solid #bbf7d0',
											color: '#16a34a',
											fontSize: '11px',
											fontWeight: 600,
											whiteSpace: 'nowrap'
										}}
										title="Jumlah Project / Sprint terkait"
									>
										<FolderKanban size={13} />
										<span>{prog.project_count ?? 0} Project</span>
									</div>
								</div>

								{/* URLs: Staging Base URL, GitHub Repo URL & Grafana Dashboard */}
								<div
									style={{
										display: 'flex',
										flexDirection: 'column',
										gap: '6px',
										background: '#f8fafc',
										padding: '8px 10px',
										borderRadius: '6px',
										border: '1px solid #f1f5f9',
										fontSize: '12px'
									}}
								>
									{prog.base_url ? (
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
												<Globe size={13} color="#2563eb" style={{ flexShrink: 0 }} />
												<span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>Staging:</span>
												<a
													href={prog.base_url}
													target="_blank"
													rel="noreferrer"
													style={{
														color: '#2563eb',
														textDecoration: 'none',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap'
													}}
												>
													{prog.base_url}
												</a>
											</div>
											<button
												type="button"
												onClick={() => handleCopy(prog.base_url!, `url-${prog.id_program}`)}
												style={{
													background: 'none',
													border: 'none',
													color: '#94a3b8',
													cursor: 'pointer',
													padding: '2px 4px'
												}}
												title="Salin Staging URL"
											>
												{copiedKey === `url-${prog.id_program}` ? (
													<Check size={12} color="#16a34a" />
												) : (
													<Copy size={12} />
												)}
											</button>
										</div>
									) : (
										<div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '11px' }}>
											<Globe size={13} />
											<span>URL Staging belum ditentukan</span>
										</div>
									)}

									{prog.grafana_dashboard_url ? (
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
												<Activity size={13} color="#ea580c" style={{ flexShrink: 0 }} />
												<span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>Grafana:</span>
												<a
													href={prog.grafana_dashboard_url}
													target="_blank"
													rel="noreferrer"
													style={{
														color: '#ea580c',
														textDecoration: 'none',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														fontWeight: 500
													}}
												>
													{prog.grafana_dashboard_url}
												</a>
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
												<button
													type="button"
													onClick={() => handleCopy(prog.grafana_dashboard_url!, `grafana-${prog.id_program}`)}
													style={{
														background: 'none',
														border: 'none',
														color: '#94a3b8',
														cursor: 'pointer',
														padding: '2px 4px'
													}}
													title="Salin Grafana URL"
												>
													{copiedKey === `grafana-${prog.id_program}` ? (
														<Check size={12} color="#16a34a" />
													) : (
														<Copy size={12} />
													)}
												</button>
												<a
													href={prog.grafana_dashboard_url}
													target="_blank"
													rel="noreferrer"
													style={{
														color: '#ea580c',
														display: 'flex',
														alignItems: 'center',
														padding: '2px 4px',
														textDecoration: 'none'
													}}
													title="Buka Grafana Dashboard"
												>
													<ExternalLink size={12} />
												</a>
											</div>
										</div>
									) : null}

									{prog.repo_url ? (
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
												<Code2 size={13} color="#0f172a" style={{ flexShrink: 0 }} />
												<span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>Repo:</span>
												<a
													href={prog.repo_url}
													target="_blank"
													rel="noreferrer"
													style={{
														color: '#0f172a',
														textDecoration: 'none',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap'
													}}
												>
													{prog.repo_url}
												</a>
											</div>
											<button
												type="button"
												onClick={() => handleCopy(prog.repo_url!, `repo-${prog.id_program}`)}
												style={{
													background: 'none',
													border: 'none',
													color: '#94a3b8',
													cursor: 'pointer',
													padding: '2px 4px'
												}}
												title="Salin Repository URL"
											>
												{copiedKey === `repo-${prog.id_program}` ? (
													<Check size={12} color="#16a34a" />
												) : (
													<Copy size={12} />
												)}
											</button>
										</div>
									) : (
										<div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '11px' }}>
											<Code2 size={13} />
											<span>Repository GitHub belum ditentukan</span>
										</div>
									)}
								</div>

								{/* Action Buttons */}
								<div
									style={{
										display: 'flex',
										justifyContent: 'flex-end',
										alignItems: 'center',
										gap: '6px',
										paddingTop: '4px',
										borderTop: '1px solid #f8fafc'
									}}
								>
									{userCanEdit && (
										<Button
											variant="ghost"
											size="sm"
											icon={<Edit2 size={13} />}
											onClick={() => {
												setEditingProgram(prog);
												setIsCreateEditOpen(true);
											}}
										>
											Edit
										</Button>
									)}
									{userCanDelete && (
										<Button
											variant="ghost"
											size="sm"
											icon={<Trash2 size={13} color="#ef4444" />}
											onClick={() => setDeletingProgram(prog)}
										>
											<span style={{ color: '#ef4444' }}>Hapus</span>
										</Button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Modals */}
			<CreateEditProgramModal
				isOpen={isCreateEditOpen}
				onClose={() => {
					setIsCreateEditOpen(false);
					setEditingProgram(null);
				}}
				program={editingProgram}
				onSave={handleSaveProgram}
			/>

			<DeleteProgramModal
				isOpen={Boolean(deletingProgram)}
				onClose={() => setDeletingProgram(null)}
				program={deletingProgram}
				onConfirmDelete={handleConfirmDelete}
			/>
		</div>
	);
};
