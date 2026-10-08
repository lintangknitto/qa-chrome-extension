import React, { useState, useEffect } from 'react';
import type { RecordingProject, ProgramItem } from '../../../recording/apiClient';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Switch } from '../components/Switch';
import { FolderKanban, FileText, CheckCircle2, Lock, Layers, Search, Globe, GitBranch } from 'lucide-react';

export interface CreateEditProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	project?: RecordingProject | null;
	programs?: ProgramItem[];
	onSave: (data: {
		name: string;
		id_program?: number | null;
		program_ids?: number[];
		base_url?: string;
		repo_url?: string;
		description?: string;
		is_active?: boolean;
	}) => Promise<void>;
}

// Stable default: a fresh `[]` per render would retrigger the form-reset effect (which depends on
// `programs`) forever whenever the prop is omitted.
const NO_PROGRAMS: ProgramItem[] = [];

export const CreateEditProjectModal: React.FC<CreateEditProjectModalProps> = ({
	isOpen,
	onClose,
	project,
	programs = NO_PROGRAMS,
	onSave
}) => {
	const isEditMode = Boolean(project);

	const [programIds, setProgramIds] = useState<number[]>([]);
	const [primaryProgramId, setPrimaryProgramId] = useState<number | null>(null);
	const [baseUrl, setBaseUrl] = useState('');
	const [repoUrl, setRepoUrl] = useState('');
	const [programSearch, setProgramSearch] = useState('');
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [isActive, setIsActive] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			if (project) {
				const initialProgIds: number[] = Array.isArray(project.program_ids) && project.program_ids.length > 0
					? project.program_ids
					: Array.isArray(project.programs) && project.programs.length > 0
						? project.programs.map((p) => p.id_program)
						: typeof project.id_program === 'number' && project.id_program > 0
							? [project.id_program]
							: [];
				setProgramIds(initialProgIds);

				// Cari primary program: utamakan program FRONTEND jika project.id_program belum menunjuk ke frontend
				let initialPrimary: number | null = null;
				if (typeof project.id_program === 'number' && initialProgIds.includes(project.id_program)) {
					const assignedProg = programs.find((p) => p.id_program === project.id_program);
					// Jika assigned program bukan frontend tapi ada program frontend terpilih, kita evaluasi
					const feProg = programs.find((p) => initialProgIds.includes(p.id_program) && p.type === 'FRONTEND');
					if (assignedProg?.type === 'FRONTEND' || !feProg) {
						initialPrimary = project.id_program;
					} else {
						// Jika assigned ke service padahal ada frontend, utamakan frontend
						initialPrimary = feProg.id_program;
					}
				} else if (initialProgIds.length > 0) {
					const feProg = programs.find((p) => initialProgIds.includes(p.id_program) && p.type === 'FRONTEND');
					initialPrimary = feProg ? feProg.id_program : initialProgIds[0];
				}
				setPrimaryProgramId(initialPrimary);

				setName(project.name || '');
				setBaseUrl(project.base_url || '');
				setRepoUrl(project.repo_url || '');
				setDescription(project.description || '');
				setIsActive(project.is_active !== false);
			} else {
				setProgramIds([]);
				setPrimaryProgramId(null);
				setName('');
				setBaseUrl('');
				setRepoUrl('');
				setDescription('');
				setIsActive(true);
			}
			setProgramSearch('');
			setError(null);
			setBusy(false);
		}
	}, [isOpen, project, programs]);

	const filteredPrograms = programs.filter((p) => {
		if (!programSearch.trim()) return true;
		const q = programSearch.toLowerCase();
		return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.base_url && p.base_url.toLowerCase().includes(q));
	});

	const handleToggleProgram = (idProg: number) => {
		setProgramIds((prev) => {
			const exists = prev.includes(idProg);
			const next = exists ? prev.filter((id) => id !== idProg) : [...prev, idProg];

			// Evaluasi primary program
			if (!exists) {
				const addedProg = programs.find((p) => p.id_program === idProg);
				const currentPrimaryProg = programs.find((p) => p.id_program === primaryProgramId);

				// Jika belum ada primary, atau program yang baru ditambahkan adalah FRONTEND sedangkan primary saat ini bukan FRONTEND
				if (!primaryProgramId || (addedProg?.type === 'FRONTEND' && currentPrimaryProg?.type !== 'FRONTEND')) {
					setPrimaryProgramId(idProg);
					if (addedProg?.base_url && (!baseUrl || baseUrl === currentPrimaryProg?.base_url)) {
						setBaseUrl(addedProg.base_url);
					}
					if (addedProg?.repo_url && (!repoUrl || repoUrl === currentPrimaryProg?.repo_url)) {
						setRepoUrl(addedProg.repo_url);
					}
				}
			} else {
				// Program dihapus
				if (primaryProgramId === idProg) {
					const feProg = programs.find((p) => next.includes(p.id_program) && p.type === 'FRONTEND');
					const replacement = feProg || programs.find((p) => next.includes(p.id_program));
					if (replacement) {
						setPrimaryProgramId(replacement.id_program);
						if (replacement.base_url) setBaseUrl(replacement.base_url);
						if (replacement.repo_url) setRepoUrl(replacement.repo_url);
					} else {
						setPrimaryProgramId(null);
					}
				}
			}

			return next;
		});
	};

	const handleSelectPrimary = (idProg: number) => {
		setPrimaryProgramId(idProg);
		const selectedProg = programs.find((p) => p.id_program === idProg);
		if (selectedProg) {
			if (selectedProg.base_url) setBaseUrl(selectedProg.base_url);
			if (selectedProg.repo_url) setRepoUrl(selectedProg.repo_url);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || busy) return;

		setBusy(true);
		setError(null);
		try {
			const resolvedPrimaryId = primaryProgramId ?? (programIds.length > 0 ? programIds[0] : null);
			const primaryProg = programs.find((p) => p.id_program === resolvedPrimaryId);
			const finalBaseUrl = baseUrl.trim() || primaryProg?.base_url || undefined;
			const finalRepoUrl = repoUrl.trim() || primaryProg?.repo_url || undefined;

			await onSave({
				name: name.trim(),
				id_program: resolvedPrimaryId,
				program_ids: programIds,
				base_url: finalBaseUrl,
				repo_url: finalRepoUrl,
				description: description.trim() || undefined,
				is_active: isEditMode ? isActive : true
			});
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menyimpan data project.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEditMode ? 'Edit Informasi Project' : 'Tambah Project Baru'}
		>
			<form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
				{error && <div className="sp-error">{error}</div>}

				<div
					style={{
						border: '1px solid #cbd5e1',
						borderRadius: '10px',
						padding: '14px',
						background: '#ffffff',
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
						boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
					}}
				>
					{isEditMode && project?.code && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
							<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
								<Lock size={12} color="#64748b" /> Kode Project (Terkunci)
							</label>
							<div
								style={{
									padding: '7px 10px',
									background: '#f1f5f9',
									border: '1px solid #e2e8f0',
									borderRadius: '6px',
									fontSize: '12px',
									fontFamily: 'monospace',
									color: '#334155',
									fontWeight: 600
								}}
							>
								{project.code}
							</div>
							<span style={{ fontSize: '11px', color: '#94a3b8' }}>
								Kode project digunakan sebagai prefix unik test case dan tidak dapat diubah.
							</span>
						</div>
					)}

					{/* Multi-Program Selector */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
								<Layers size={13} color="#2563eb" /> Program yang Terlibat ({programIds.length} Dipilih)
							</label>
							{programs.length > 0 && programIds.length > 0 && (
								<button
									type="button"
									onClick={() => setProgramIds([])}
									style={{
										background: 'transparent',
										border: 'none',
										color: '#64748b',
										fontSize: '11px',
										cursor: 'pointer',
										padding: 0,
										textDecoration: 'underline'
									}}
								>
									Reset Pilihan
								</button>
							)}
						</div>

						{programs.length === 0 ? (
							<div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
								Belum ada program terdaftar.
							</div>
						) : (
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '6px',
									border: '1px solid #e2e8f0',
									borderRadius: '8px',
									padding: '8px',
									background: '#f8fafc'
								}}
							>
								{programs.length > 4 && (
									<div style={{ position: 'relative' }}>
										<input
											type="text"
											placeholder="Cari nama atau kode program..."
											value={programSearch}
											onChange={(e) => setProgramSearch(e.target.value)}
											style={{
												width: '100%',
												padding: '5px 8px 5px 26px',
												fontSize: '11.5px',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												background: '#ffffff',
												outline: 'none',
												boxSizing: 'border-box'
											}}
										/>
										<Search size={12} color="#94a3b8" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
									</div>
								)}

								<div
									style={{
										display: 'flex',
										flexDirection: 'column',
										gap: '4px',
										maxHeight: '190px',
										overflowY: 'auto',
										paddingRight: '2px'
									}}
								>
									{filteredPrograms.length === 0 ? (
										<div style={{ fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
											Tidak ada program yang sesuai dengan kata kunci.
										</div>
									) : (
										filteredPrograms.map((prog) => {
											const isChecked = programIds.includes(prog.id_program);
											const isService = prog.type === 'SERVICE';
											return (
												<label
													key={prog.id_program}
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '8px',
														padding: '6px 8px',
														borderRadius: '6px',
														cursor: 'pointer',
														background: isChecked ? '#eff6ff' : '#ffffff',
														border: `1px solid ${isChecked ? '#bfdbfe' : '#f1f5f9'}`,
														transition: 'all 0.15s ease'
													}}
												>
													<input
														type="checkbox"
														checked={isChecked}
														onChange={() => handleToggleProgram(prog.id_program)}
														disabled={busy}
														style={{ cursor: 'pointer', width: 14, height: 14 }}
													/>
													<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
														<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
															<span style={{ fontSize: '12px', fontWeight: isChecked ? 600 : 500, color: isChecked ? '#1e40af' : '#1e293b' }}>
																{prog.name}
															</span>
															<span
																style={{
																	fontSize: '9.5px',
																	fontWeight: 600,
																	padding: '1px 5px',
																	borderRadius: '4px',
																	background: isService ? '#fdf4ff' : '#ecfdf5',
																	color: isService ? '#9333ea' : '#059669',
																	border: `1px solid ${isService ? '#f0abfc' : '#a7f3d0'}`
																}}
															>
																{isService ? 'SERVICE' : 'FRONTEND'}
															</span>
														</div>
														<span style={{ fontSize: '10px', color: '#64748b' }}>
															{prog.code} {prog.base_url ? `· ${prog.base_url}` : ''}
														</span>
													</div>
												</label>
											);
										})
									)}
								</div>
							</div>
						)}
						<span style={{ fontSize: '11px', color: '#64748b' }}>
							Pilih satu atau beberapa program aplikasi yang diuji dalam project pengembangan ini.
						</span>
					</div>

					{/* Program Utama / Entry Point (Jika memilih > 1 program) */}
					{programIds.length > 1 && (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: '8px',
								padding: '10px 12px',
								background: '#f0fdf4',
								border: '1px solid #bbf7d0',
								borderRadius: '8px'
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<label style={{ fontSize: '12px', fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}>
									<Globe size={13} color="#16a34a" /> Program Utama (Target Entry Point Pengujian)
								</label>
								<span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: 500 }}>
									Utamakan FRONTEND untuk UI Recorder
								</span>
							</div>

							<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
								{programIds.map((id) => {
									const prog = programs.find((p) => p.id_program === id);
									if (!prog) return null;
									const isSelected = primaryProgramId === id;
									const isFrontend = prog.type === 'FRONTEND';
									return (
										<label
											key={id}
											onClick={() => handleSelectPrimary(id)}
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: '8px',
												padding: '6px 10px',
												background: isSelected ? '#dcfce7' : '#ffffff',
												border: `1px solid ${isSelected ? '#86efac' : '#e2e8f0'}`,
												borderRadius: '6px',
												cursor: 'pointer',
												transition: 'all 0.15s ease'
											}}
										>
											<input
												type="radio"
												name="primary_program"
												checked={isSelected}
												onChange={() => handleSelectPrimary(id)}
												disabled={busy}
												style={{ cursor: 'pointer', accentColor: '#16a34a' }}
											/>
											<span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#14532d' : '#1e293b' }}>
												{prog.name}
											</span>
											<span
												style={{
													fontSize: '9.5px',
													fontWeight: 600,
													padding: '1px 5px',
													borderRadius: '4px',
													background: isFrontend ? '#ecfdf5' : '#fdf4ff',
													color: isFrontend ? '#059669' : '#9333ea',
													border: `1px solid ${isFrontend ? '#a7f3d0' : '#f0abfc'}`
												}}
											>
												{prog.type || 'FRONTEND'}
											</span>
											{prog.base_url && (
												<span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto', fontFamily: 'monospace' }}>
													{prog.base_url}
												</span>
											)}
										</label>
									);
								})}
							</div>
						</div>
					)}

					<Input
						label="Nama Project"
						required
						placeholder="Contoh: Sprint 23 Checkout Revamp"
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={busy}
						icon={<FolderKanban size={14} />}
					/>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
						<Input
							label="Base URL (Target Pengujian UI / Recorder)"
							placeholder="https://chat.knitto.org"
							value={baseUrl}
							onChange={(e) => setBaseUrl(e.target.value)}
							disabled={busy}
							icon={<Globe size={14} />}
							helperText="URL awal browser saat merekam skenario pengujian. Otomatis terisi dari program frontend."
						/>

						<Input
							label="Repository URL (Opsional)"
							placeholder="https://github.com/knittotextile/..."
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							disabled={busy}
							icon={<GitBranch size={14} />}
							helperText="Link repositori kode program untuk kebutuhan integrasi script Playwright."
						/>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
							<FileText size={12} /> Deskripsi (Opsional)
						</label>
						<textarea
							rows={3}
							placeholder="Keterangan alur pengujian atau modul project ini..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={busy}
							style={{
								width: '100%',
								padding: '8px 10px',
								border: '1px solid #cbd5e1',
								borderRadius: '6px',
								fontSize: '12px',
								fontFamily: 'inherit',
								resize: 'vertical',
								background: '#ffffff',
								color: '#0f172a',
								outline: 'none',
								boxSizing: 'border-box'
							}}
						/>
					</div>

					{isEditMode && (
						<div
							style={{
								padding: '12px 14px',
								background: '#f8fafc',
								borderRadius: '8px',
								border: '1px solid #e2e8f0'
							}}
						>
							<Switch
								checked={isActive}
								onChange={(val) => setIsActive(val)}
								disabled={busy}
								label={`Status Project: ${isActive ? 'Aktif' : 'Inaktif'}`}
								description={isActive ? 'Project aktif dan dapat dipilih di recorder' : 'Project dinonaktifkan dari recorder'}
								activeColor="#10b981"
							/>
						</div>
					)}
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						disabled={busy || !name.trim()}
						icon={<CheckCircle2 size={14} />}
					>
						{busy ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Project'}
					</Button>
				</div>
			</form>
		</Modal>
	);
};
