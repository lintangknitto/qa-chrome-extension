import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
	FolderKanban,
	Plus,
	Search,
	Upload,
	Download,
	Play,
	Edit,
	Trash2,
	ArrowLeft,
	Globe,
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
	Eye,
	RefreshCw,
	FileText,
	Share2,
	MoreVertical,
	Repeat,
	Layers
} from 'lucide-react';
import type {
	RecordingApiClient,
	RecordingProject,
	RecordingSession,
	TestCaseItem,
	TestCaseSummary,
	TestCaseTemplate,
	ProgramItem
} from '../../../recording/apiClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Combobox } from '../components/Combobox';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ImportTestCaseModal } from './ImportTestCaseModal';
import { CreateEditTestCaseModal } from './CreateEditTestCaseModal';
import { CreateEditProjectModal, type ProjectFormData } from './CreateEditProjectModal';
import { DeleteProjectModal } from './DeleteProjectModal';
import { EmptyStateTestCase } from './EmptyStateTestCase';
import { TestCaseResultModal } from './TestCaseResultModal';
import type { ParsedImportTestCase } from '../../../recording/spreadsheetParser';
import type { StoredUser } from '../../../recording/tokenStore';
import { canManageTestCases, canRecord, canRunTest, canEditProject, canDeleteProject } from '../fab-permissions';

export interface ProjectViewProps {
	user?: StoredUser | null;
	projects: RecordingProject[];
	api: RecordingApiClient;
	canCreateProject: boolean;
	onRefreshProjects: () => Promise<void>;
	onCreateProject: (input: ProjectFormData) => Promise<number | undefined>;
	onSelectTestCaseForRecording: (project: RecordingProject, testCase: TestCaseItem) => void;
	onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
	onActiveProjectChange?: (project: RecordingProject | null) => void;
	activeGenerations?: Map<number, { id_session: number; title: string; status: string; startTime?: number; error?: string }>;
}

/** Simpan blob sebagai file lewat anchor sementara (bekerja di content script tanpa izin downloads). */
export const downloadBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** URL tab template: tambahkan gid bila URL terdaftar belum membawanya, supaya tab yang tepat yang diunduh. */
export const templateSheetUrl = (template: Pick<TestCaseTemplate, 'spreadsheet_url' | 'gid'>): string => {
	const url = template.spreadsheet_url.trim();
	if (!template.gid || /[?&#]gid=\d+/.test(url)) return url;
	return `${url.split('#')[0]}#gid=${template.gid}`;
};

export const ProjectView: React.FC<ProjectViewProps> = ({
	user,
	projects,
	api,
	canCreateProject,
	onRefreshProjects,
	onCreateProject,
	onSelectTestCaseForRecording,
	onShowToast,
	onActiveProjectChange,
	activeGenerations
}) => {
	const allowManageTc = canManageTestCases(user);
	const allowRecord = canRecord(user);
	const allowRunTest = canRunTest(user);

	const [selectedProject, setSelectedProject] = useState<RecordingProject | null>(null);

	const handleSetSelectedProject = useCallback(
		(p: RecordingProject | null) => {
			setSelectedProject(p);
			onActiveProjectChange?.(p);
		},
		[onActiveProjectChange]
	);

	const [projectSearch, setProjectSearch] = useState('');

	// Test case data states
	const [testCases, setTestCases] = useState<TestCaseItem[]>([]);
	const [summary, setSummary] = useState<TestCaseSummary | null>(null);
	const [loadingTestCases, setLoadingTestCases] = useState(false);
	const [tcSearch, setTcSearch] = useState('');
	const [tcStatusFilter, setTcStatusFilter] = useState('');
	const [activeDropdownTcId, setActiveDropdownTcId] = useState<number | null>(null);
	const [dropdownCoords, setDropdownCoords] = useState<{
		top?: number;
		bottom?: number;
		right: number;
	} | null>(null);

	// Project Modal & Dropdown states
	const [isCreateEditProjectModalOpen, setCreateEditProjectModalOpen] = useState(false);
	const [editingProject, setEditingProject] = useState<RecordingProject | null>(null);
	const [isDeleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
	const [deletingProject, setDeletingProject] = useState<RecordingProject | null>(null);
	const [activeDropdownProjectId, setActiveDropdownProjectId] = useState<number | null>(null);

	// Click outside and scroll listener for action dropdowns
	useEffect(() => {
		const handleGlobalClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (activeDropdownTcId !== null && !target?.closest('.tc-action-dropdown-container')) {
				setActiveDropdownTcId(null);
				setDropdownCoords(null);
			}
			if (activeDropdownProjectId !== null && !target?.closest('.proj-action-dropdown-container')) {
				setActiveDropdownProjectId(null);
			}
		};
		const handleScroll = () => {
			if (activeDropdownTcId !== null) {
				setActiveDropdownTcId(null);
				setDropdownCoords(null);
			}
		};
		window.addEventListener('click', handleGlobalClick);
		window.addEventListener('scroll', handleScroll, true);
		return () => {
			window.removeEventListener('click', handleGlobalClick);
			window.removeEventListener('scroll', handleScroll, true);
		};
	}, [activeDropdownTcId, activeDropdownProjectId]);

	// Modal states
	const [isImportModalOpen, setImportModalOpen] = useState(false);
	const [importPrefillUrl, setImportPrefillUrl] = useState<string | undefined>(undefined);
	const [isCreateTcModalOpen, setCreateTcModalOpen] = useState(false);
	const [editingTestCase, setEditingTestCase] = useState<TestCaseItem | null>(null);

	// Result Modal state
	const [isResultModalOpen, setResultModalOpen] = useState(false);
	const [resultModalSessionId, setResultModalSessionId] = useState<number | null>(null);
	const [resultModalTestCase, setResultModalTestCase] = useState<TestCaseItem | null>(null);

	// Project Tab state: 'test-cases' | 'sessions'
	const [activeProjectTab, setActiveProjectTab] = useState<'test-cases' | 'sessions'>('test-cases');
	const [projectSessions, setProjectSessions] = useState<RecordingSession[]>([]);
	const [loadingProjectSessions, setLoadingProjectSessions] = useState(false);
	const [sessionSearch, setSessionSearch] = useState('');

	// Master Program states
	const [activePrograms, setActivePrograms] = useState<ProgramItem[]>([]);
	const [selectedProgramFilter, setSelectedProgramFilter] = useState<number | ''>('');

	// Template test case default (registry di API) untuk "Template Sistem" & pemetaan kolom import
	const [defaultTemplate, setDefaultTemplate] = useState<TestCaseTemplate | null>(null);
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const template = await api.getDefaultTestCaseTemplate();
				if (!cancelled) setDefaultTemplate(template);
			} catch {
				// non-blocking: import tetap jalan dengan alias kolom bawaan
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [api]);

	const loadActivePrograms = useCallback(async () => {
		try {
			const res = await api.listActivePrograms();
			setActivePrograms(res.items || []);
		} catch {
			// non-blocking
		}
	}, [api]);

	useEffect(() => {
		void loadActivePrograms();
	}, [loadActivePrograms]);

	const handleOpenCreateProject = () => {
		setEditingProject(null);
		setCreateEditProjectModalOpen(true);
	};

	const handleOpenEditProject = (proj: RecordingProject) => {
		setEditingProject(proj);
		setCreateEditProjectModalOpen(true);
	};

	const handleOpenDeleteProject = (proj: RecordingProject) => {
		setDeletingProject(proj);
		setDeleteProjectModalOpen(true);
	};

	const handleSaveProject = async (data: ProjectFormData) => {
		if (editingProject) {
			const updated = await api.updateProject(editingProject.id_project, data);
			onShowToast('Project berhasil diperbarui.', 'success');
			if (selectedProject?.id_project === updated.id_project) {
				handleSetSelectedProject(updated);
			}
			await onRefreshProjects();
		} else {
			const newId = await onCreateProject(data);
			onShowToast('Project baru berhasil ditambahkan.', 'success');
			await onRefreshProjects();
			if (newId) {
				const found = projects.find((p) => p.id_project === newId);
				if (found) handleSetSelectedProject(found);
			}
		}
	};

	const handleConfirmDeleteProject = async (proj: RecordingProject) => {
		try {
			const res = await api.deleteProject(proj.id_project);
			if (res?.deactivated) {
				onShowToast('Project memiliki riwayat data sehingga dinonaktifkan.', 'info');
			} else {
				onShowToast('Project berhasil dihapus secara permanen.', 'success');
			}
			if (selectedProject?.id_project === proj.id_project) {
				handleSetSelectedProject(null);
			}
			await onRefreshProjects();
		} catch (err) {
			onShowToast((err as Error).message || 'Gagal menghapus project.', 'error');
			throw err;
		}
	};

	const loadTestCases = useCallback(
		async (idProject: number) => {
			setLoadingTestCases(true);
			try {
				const res = await api.listTestCases(idProject, {
					search: tcSearch.trim() || undefined,
					status: tcStatusFilter || undefined,
					limit: 100
				});
				setTestCases(res.items);
				setSummary(res.summary);
			} catch (err) {
				const isAuthErr =
					(err as any)?.status === 401 ||
					(err as Error)?.message?.toLowerCase().includes('login');
				if (!isAuthErr) {
					onShowToast((err as Error).message || 'Gagal memuat test cases.', 'error');
				}
			} finally {
				setLoadingTestCases(false);
			}
		},
		[api, tcSearch, tcStatusFilter, onShowToast]
	);

	const loadProjectSessions = useCallback(
		async (idProject: number) => {
			setLoadingProjectSessions(true);
			try {
				const res = await api.listSessions({ id_project: idProject, perPage: 100 });
				setProjectSessions(res.items);
			} catch (err) {
				const isAuthErr =
					(err as any)?.status === 401 ||
					(err as Error)?.message?.toLowerCase().includes('login');
				if (!isAuthErr) {
					onShowToast((err as Error).message || 'Gagal memuat riwayat sesi project.', 'error');
				}
			} finally {
				setLoadingProjectSessions(false);
			}
		},
		[api, onShowToast]
	);

	useEffect(() => {
		if (selectedProject) {
			void loadTestCases(selectedProject.id_project);
		}
	}, [selectedProject, loadTestCases]);

	useEffect(() => {
		if (selectedProject && activeProjectTab === 'sessions') {
			void loadProjectSessions(selectedProject.id_project);
		}
	}, [selectedProject, activeProjectTab, loadProjectSessions]);

	const [exporting, setExporting] = useState(false);
	const handleExportTestCases = async () => {
		if (!selectedProject || exporting) return;
		setExporting(true);
		try {
			const { blob, filename } = await api.exportTestCases(selectedProject.id_project, defaultTemplate?.id_template);
			downloadBlob(blob, filename);
			onShowToast(`File ${filename} berhasil diunduh.`, 'success');
		} catch (err) {
			onShowToast((err as Error).message || 'Gagal mengekspor test case.', 'error');
		} finally {
			setExporting(false);
		}
	};

	const handleImportTestCases = async (items: ParsedImportTestCase[]) => {
		if (!selectedProject) return;
		const res = await api.importTestCases(selectedProject.id_project, items);
		onShowToast(
			`Berhasil import: ${res.result.inserted} baru, ${res.result.updated} diperbarui.`,
			'success'
		);
		await loadTestCases(selectedProject.id_project);
	};

	const handleSaveSingleTestCase = async (
		data: Partial<TestCaseItem> & { test_case_id: string; title: string }
	) => {
		if (!selectedProject) return;
		if (editingTestCase) {
			await api.updateTestCase(selectedProject.id_project, editingTestCase.id_test_case, data);
			onShowToast('Test Case berhasil diperbarui.', 'success');
		} else {
			await api.createTestCase(selectedProject.id_project, data);
			onShowToast('Test Case berhasil ditambahkan.', 'success');
		}
		setEditingTestCase(null);
		await loadTestCases(selectedProject.id_project);
	};

	const handleDeleteTestCase = async (tc: TestCaseItem) => {
		if (!selectedProject) return;
		if (!confirm(`Hapus Test Case "${tc.test_case_id} — ${tc.title}"?`)) return;
		try {
			await api.deleteTestCase(selectedProject.id_project, tc.id_test_case);
			onShowToast('Test Case berhasil dihapus.', 'info');
			await loadTestCases(selectedProject.id_project);
		} catch (err) {
			onShowToast((err as Error).message || 'Gagal menghapus test case.', 'error');
		}
	};

	const filteredProjects = useMemo(() => {
		const s = projectSearch.toLowerCase().trim();
		return projects.filter((p) => {
			const matchSearch =
				!s ||
				p.name.toLowerCase().includes(s) ||
				(p.code && p.code.toLowerCase().includes(s)) ||
				(p.program_name && p.program_name.toLowerCase().includes(s)) ||
				(p.programs && p.programs.some((prog) => prog.name.toLowerCase().includes(s) || prog.code.toLowerCase().includes(s)));
			const matchProg =
				selectedProgramFilter === '' ||
				p.id_program === selectedProgramFilter ||
				(p.program_ids && p.program_ids.includes(selectedProgramFilter as number)) ||
				(p.programs && p.programs.some((prog) => prog.id_program === selectedProgramFilter));
			return matchSearch && matchProg;
		});
	}, [projects, projectSearch, selectedProgramFilter]);

	const filteredProjectSessions = useMemo(() => {
		const s = sessionSearch.toLowerCase().trim();
		if (!s) return projectSessions;
		return projectSessions.filter(
			(sess) =>
				sess.title.toLowerCase().includes(s) ||
				sess.test_case_no.toLowerCase().includes(s) ||
				String(sess.id_session).includes(s)
		);
	}, [projectSessions, sessionSearch]);

	const renderStatusBadge = (status: string) => {
		const st = (status || '').toLowerCase();
		let bg = '#f1f5f9';
		let color = '#475569';
		let icon = <Clock size={12} />;

		if (st === 'passed') {
			bg = '#dcfce7';
			color = '#15803d';
			icon = <CheckCircle size={12} />;
		} else if (st === 'failed') {
			bg = '#fee2e2';
			color = '#b91c1c';
			icon = <XCircle size={12} />;
		} else if (st === 're-test' || st === 'retest') {
			bg = '#ffedd5';
			color = '#c2410c';
			icon = <AlertCircle size={12} />;
		} else if (st === 'progress') {
			bg = '#e0f2fe';
			color = '#0369a1';
		}

		return (
			<span
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '4px',
					padding: '2px 8px',
					borderRadius: '12px',
					fontSize: '11px',
					fontWeight: 600,
					background: bg,
					color
				}}
			>
				{icon}
				{status}
			</span>
		);
	};

	// SUB-VIEW 1: KATALOG PROJECT
	if (!selectedProject) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
				<Card>
					<CardHeader>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
							<div>
								<CardTitle style={{ fontSize: '15px', fontWeight: 600 }}>Daftar Project & Skenario</CardTitle>
								<CardDescription>Pilih project untuk mengelola skenario spreadsheet dan riwayat sesi</CardDescription>
							</div>
							{canCreateProject && (
								<Button
									type="button"
									variant="primary"
									size="sm"
									icon={<Plus size={14} />}
									onClick={handleOpenCreateProject}
								>
									Tambah Project
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
							<div style={{ flex: 1, minWidth: '200px' }}>
								<Input
									placeholder="Cari nama project, kode, atau program..."
									icon={<Search size={14} />}
									value={projectSearch}
									onChange={(e) => setProjectSearch(e.target.value)}
								/>
							</div>
							{activePrograms.length > 0 && (
								<div style={{ minWidth: '180px' }}>
									<Combobox
										placeholder="Semua Master Program"
										searchPlaceholder="Cari program..."
										value={selectedProgramFilter}
										onChange={(val) => setSelectedProgramFilter(val ? Number(val) : '')}
										options={[
											{ value: '', label: 'Semua Master Program' },
											...activePrograms.map((prog) => ({
												value: prog.id_program,
												label: `${prog.name} (${prog.code})`,
												code: prog.type || 'FRONTEND'
											}))
										]}
									/>
								</div>
							)}
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
							{filteredProjects.length === 0 ? (
								<div
									style={{
										textAlign: 'center',
										padding: '32px 16px',
										color: 'var(--sp-text-muted, #64748b)',
										fontSize: '13px'
									}}
								>
									Project tidak ditemukan. Buat project baru untuk memulai.
								</div>
							) : (
								filteredProjects.map((p) => {
									const userCanEdit = canEditProject(user, p);
									const userCanDelete = canDeleteProject(user, p);
									const hasAction = userCanEdit || userCanDelete;

									return (
										<div
											key={p.id_project}
											onClick={() => handleSetSelectedProject(p)}
											style={{
												padding: '14px 16px',
												borderRadius: '10px',
												border: p.is_active === false ? '1px dashed #cbd5e1' : '1px solid #cbd5e1',
												background: p.is_active === false ? '#f8fafc' : '#ffffff',
												cursor: 'pointer',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												transition: 'all 0.15s ease',
												boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
												opacity: p.is_active === false ? 0.75 : 1
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.borderColor = '#2F3574';
												e.currentTarget.style.boxShadow = '0 4px 12px rgba(47, 53, 116, 0.08)';
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.borderColor = '#cbd5e1';
												e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
											}}
										>
											<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
												<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
													<span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{p.name}</span>
													<span
														style={{
															padding: '2px 8px',
															borderRadius: '6px',
															fontSize: '11px',
															fontWeight: 600,
															background: '#f1f5f9',
															color: '#334155',
															border: '1px solid #e2e8f0'
														}}
													>
														{p.code}
													</span>
													{p.programs && p.programs.length > 0 ? (
														p.programs.map((prog) => {
															const isFrontend = prog.type === 'FRONTEND';
															return (
																<span
																	key={prog.id_program}
																	style={{
																		padding: '2px 8px',
																		borderRadius: '6px',
																		fontSize: '11px',
																		fontWeight: 600,
																		background: isFrontend ? '#ecfdf5' : '#fdf4ff',
																		color: isFrontend ? '#059669' : '#9333ea',
																		border: `1px solid ${isFrontend ? '#a7f3d0' : '#f0abfc'}`,
																		display: 'inline-flex',
																		alignItems: 'center',
																		gap: '4px'
																	}}
																	title={`Master Program: ${prog.name} (${prog.type || 'FRONTEND'})`}
																>
																	<Layers size={11} />
																	{prog.name}
																	<span style={{ fontSize: '9px', opacity: 0.85 }}>({isFrontend ? 'FE' : 'SVC'})</span>
																</span>
															);
														})
													) : p.program_name ? (
														<span
															style={{
																padding: '2px 8px',
																borderRadius: '6px',
																fontSize: '11px',
																fontWeight: 600,
																background: '#eff6ff',
																color: '#2563eb',
																border: '1px solid #bfdbfe',
																display: 'inline-flex',
																alignItems: 'center',
																gap: '4px'
															}}
															title={`Master Program: ${p.program_name}`}
														>
															<Layers size={11} />
															{p.program_name}
														</span>
													) : null}
													{p.is_active === false && (
														<span
															style={{
																padding: '2px 6px',
																borderRadius: '4px',
																fontSize: '10px',
																fontWeight: 600,
																background: '#fee2e2',
																color: '#991b1b',
																border: '1px solid #fecdd3'
															}}
														>
															Inactive
														</span>
													)}
												</div>
												{p.base_url && (
													<div
														style={{
															fontSize: '12px',
															color: '#475569',
															display: 'flex',
															alignItems: 'center',
															gap: '5px'
														}}
													>
														<Globe size={13} color="#2563eb" />
														<span style={{ fontWeight: 500, color: '#64748b' }}>Target UI:</span>
														<span style={{ color: '#0f172a' }}>{p.base_url}</span>
													</div>
												)}
												{p.repo_url && (
													<div
														style={{
															fontSize: '12px',
															color: '#64748b',
															display: 'flex',
															alignItems: 'center',
															gap: '5px'
														}}
													>
														<FolderKanban size={13} color="#94a3b8" />
														<span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>{p.repo_url}</span>
													</div>
												)}
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												<Button
													type="button"
													variant="secondary"
													size="xs"
													onClick={(e) => {
														e.stopPropagation();
														handleSetSelectedProject(p);
													}}
												>
													Kelola Test Case →
												</Button>

												{hasAction && (
													<div className="proj-action-dropdown-container" style={{ position: 'relative' }}>
														<button
															type="button"
															style={{
																background: 'transparent',
																border: '1px solid #e2e8f0',
																borderRadius: '6px',
																padding: '5px',
																cursor: 'pointer',
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																color: '#64748b'
															}}
															onClick={(e) => {
																e.stopPropagation();
																setActiveDropdownProjectId(
																	activeDropdownProjectId === p.id_project ? null : p.id_project
																);
															}}
															title="Menu Opsi Project"
														>
															<MoreVertical size={14} />
														</button>

														{activeDropdownProjectId === p.id_project && (
															<div
																style={{
																	position: 'absolute',
																	right: 0,
																	top: '100%',
																	marginTop: '4px',
																	background: '#ffffff',
																	border: '1px solid #cbd5e1',
																	borderRadius: '8px',
																	boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
																	zIndex: 50,
																	minWidth: '130px',
																	padding: '4px',
																	display: 'flex',
																	flexDirection: 'column',
																	gap: '2px'
																}}
															>
																{userCanEdit && (
																	<button
																		type="button"
																		style={{
																			display: 'flex',
																			alignItems: 'center',
																			gap: 8,
																			padding: '6px 8px',
																			fontSize: '11.5px',
																			fontWeight: 500,
																			color: '#334155',
																			background: 'transparent',
																			border: 'none',
																			borderRadius: 4,
																			cursor: 'pointer',
																			width: '100%',
																			textAlign: 'left'
																		}}
																		onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
																		onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
																		onClick={(e) => {
																			e.stopPropagation();
																			setActiveDropdownProjectId(null);
																			handleOpenEditProject(p);
																		}}
																	>
																		<Edit size={13} color="#2563eb" />
																		<span>Edit Project</span>
																	</button>
																)}
																{userCanDelete && (
																	<button
																		type="button"
																		style={{
																			display: 'flex',
																			alignItems: 'center',
																			gap: 8,
																			padding: '6px 8px',
																			fontSize: '11.5px',
																			fontWeight: 500,
																			color: '#b91c1c',
																			background: 'transparent',
																			border: 'none',
																			borderRadius: 4,
																			cursor: 'pointer',
																			width: '100%',
																			textAlign: 'left'
																		}}
																		onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
																		onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
																		onClick={(e) => {
																			e.stopPropagation();
																			setActiveDropdownProjectId(null);
																			handleOpenDeleteProject(p);
																		}}
																	>
																		<Trash2 size={13} />
																		<span>Hapus Project</span>
																	</button>
																)}
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									);
								})
							)}
						</div>
					</CardContent>
				</Card>

				{/* Modal Tambah / Edit Project */}
				<CreateEditProjectModal
					isOpen={isCreateEditProjectModalOpen}
					onClose={() => {
						setCreateEditProjectModalOpen(false);
						setEditingProject(null);
					}}
					project={editingProject}
					programs={activePrograms}
					onSave={handleSaveProject}
				/>

				{/* Modal Konfirmasi Hapus Project */}
				<DeleteProjectModal
					isOpen={isDeleteProjectModalOpen}
					onClose={() => {
						setDeleteProjectModalOpen(false);
						setDeletingProject(null);
					}}
					project={deletingProject}
					onConfirmDelete={handleConfirmDeleteProject}
				/>
			</div>
		);
	}

	// SUB-VIEW 2: DETAIL PROJECT & TEST CASE MANAGEMENT (SPREADSHEET STYLE)
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
			{/* Header Navigasi & Project Overview */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					icon={<ArrowLeft size={14} />}
					onClick={() => handleSetSelectedProject(null)}
				>
					Semua Project
				</Button>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					{allowManageTc && (
						<>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								icon={<Upload size={14} />}
								onClick={() => setImportModalOpen(true)}
								title="Import dari Excel / CSV Google Sheets Knitto"
							>
								Import Excel / CSV
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								icon={<Download size={14} />}
								loading={exporting}
								disabled={exporting}
								onClick={() => void handleExportTestCases()}
								title={defaultTemplate ? `Unduh test case berformat ${defaultTemplate.name}` : 'Unduh test case berformat template default'}
							>
								Ekspor {defaultTemplate?.version_label ?? 'V4'} (.xlsx)
							</Button>
							<Button
								type="button"
								variant="primary"
								size="sm"
								icon={<Plus size={14} />}
								onClick={() => {
									setEditingTestCase(null);
									setCreateTcModalOpen(true);
								}}
							>
								Test Case Baru
							</Button>
						</>
					)}
				</div>
			</div>

			<Card>
				<CardHeader style={{ paddingBottom: '8px' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
						<div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<CardTitle style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
									{selectedProject.name}
								</CardTitle>
								<span
									style={{
										padding: '1px 6px',
										borderRadius: '4px',
										fontSize: '11px',
										fontWeight: 600,
										background: '#e0f2fe',
										color: '#0369a1'
									}}
								>
									{selectedProject.code}
								</span>
								{selectedProject.programs && selectedProject.programs.length > 0 ? (
									selectedProject.programs.map((prog) => {
										const isFrontend = prog.type === 'FRONTEND';
										return (
											<span
												key={prog.id_program}
												style={{
													padding: '1px 6px',
													borderRadius: '4px',
													fontSize: '11px',
													fontWeight: 600,
													background: isFrontend ? '#ecfdf5' : '#fdf4ff',
													color: isFrontend ? '#059669' : '#9333ea',
													border: `1px solid ${isFrontend ? '#a7f3d0' : '#f0abfc'}`,
													display: 'inline-flex',
													alignItems: 'center',
													gap: '4px'
												}}
												title={`Master Program: ${prog.name} (${prog.type || 'FRONTEND'})`}
											>
												<Layers size={11} />
												{prog.name}
												<span style={{ fontSize: '9px', opacity: 0.85 }}>({isFrontend ? 'FE' : 'SVC'})</span>
											</span>
										);
									})
								) : selectedProject.program_name ? (
									<span
										style={{
											padding: '1px 6px',
											borderRadius: '4px',
											fontSize: '11px',
											fontWeight: 600,
											background: '#eff6ff',
											color: '#2563eb',
											border: '1px solid #bfdbfe',
											display: 'inline-flex',
											alignItems: 'center',
											gap: '4px'
										}}
										title={`Master Program: ${selectedProject.program_name}`}
									>
										<Layers size={11} />
										{selectedProject.program_name}
									</span>
								) : null}
								{selectedProject.is_active === false && (
									<span
										style={{
											padding: '1px 6px',
											borderRadius: '4px',
											fontSize: '11px',
											fontWeight: 600,
											background: '#fee2e2',
											color: '#991b1b'
										}}
									>
										Inactive
									</span>
								)}
							</div>
							{selectedProject.base_url && (
								<div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
									<Globe size={13} color="#2563eb" />
									<span style={{ color: '#64748b', fontWeight: 500 }}>Target UI:</span>
									<span style={{ color: '#0f172a' }}>{selectedProject.base_url}</span>
								</div>
							)}
						</div>
						<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
							{canEditProject(user, selectedProject) && (
								<Button
									type="button"
									variant="ghost"
									size="xs"
									icon={<Edit size={13} />}
									onClick={() => handleOpenEditProject(selectedProject)}
									title="Edit Project"
								>
									Edit
								</Button>
							)}
							{canDeleteProject(user, selectedProject) && (
								<Button
									type="button"
									variant="ghost"
									size="xs"
									style={{ color: '#b91c1c' }}
									icon={<Trash2 size={13} />}
									onClick={() => handleOpenDeleteProject(selectedProject)}
									title="Hapus / Nonaktifkan Project"
								>
									Hapus
								</Button>
							)}
						</div>
					</div>

					{/* KPI Summary Chips */}
					{summary && (
						<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									background: '#f1f5f9',
									color: '#334155',
									fontWeight: 600
								}}
							>
								Total: {summary.total}
							</span>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									background: '#dcfce7',
									color: '#15803d',
									fontWeight: 600
								}}
							>
								Passed: {summary.passed}
							</span>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									background: '#fee2e2',
									color: '#b91c1c',
									fontWeight: 600
								}}
							>
								Failed: {summary.failed}
							</span>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									background: '#ffedd5',
									color: '#c2410c',
									fontWeight: 600
								}}
							>
								Re-Test: {summary.re_test}
							</span>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 8px',
									borderRadius: '6px',
									background: '#e0f2fe',
									color: '#0369a1',
									fontWeight: 600
								}}
							>
								Progress: {summary.progress}
							</span>
						</div>
					)}
				</CardHeader>

				<CardContent>
					{/* Project Tabs Switcher */}
					<div
						className="k-segmented"
						style={{
							display: 'flex',
							gap: '4px',
							background: '#f1f5f9',
							padding: '4px',
							borderRadius: '8px',
							marginBottom: '12px',
							border: '1px solid #e2e8f0'
						}}
						role="tablist"
						aria-label="Tab Project"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeProjectTab === 'test-cases'}
							style={{
								flex: 1,
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '6px',
								padding: '6px 12px',
								fontSize: '12px',
								fontWeight: activeProjectTab === 'test-cases' ? 600 : 500,
								color: activeProjectTab === 'test-cases' ? '#2F3574' : '#64748b',
								background: activeProjectTab === 'test-cases' ? '#ffffff' : 'transparent',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								boxShadow: activeProjectTab === 'test-cases' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
								transition: 'all 0.15s ease'
							}}
							onClick={() => setActiveProjectTab('test-cases')}
						>
							<FileText size={13} />
							<span>Daftar Test Case ({testCases.length})</span>
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeProjectTab === 'sessions'}
							style={{
								flex: 1,
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '6px',
								padding: '6px 12px',
								fontSize: '12px',
								fontWeight: activeProjectTab === 'sessions' ? 600 : 500,
								color: activeProjectTab === 'sessions' ? '#2F3574' : '#64748b',
								background: activeProjectTab === 'sessions' ? '#ffffff' : 'transparent',
								border: 'none',
								borderRadius: '6px',
								cursor: 'pointer',
								boxShadow: activeProjectTab === 'sessions' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
								transition: 'all 0.15s ease'
							}}
							onClick={() => {
								setActiveProjectTab('sessions');
							}}
						>
							<Play size={13} />
							<span>Riwayat Sesi Project</span>
							{projectSessions.length > 0 && (
								<span
									style={{
										fontSize: '10px',
										padding: '1px 6px',
										borderRadius: '10px',
										background: activeProjectTab === 'sessions' ? '#EEF2FF' : '#e2e8f0',
										color: activeProjectTab === 'sessions' ? '#2F3574' : '#475569',
										fontWeight: 700
									}}
								>
									{projectSessions.length}
								</span>
							)}
						</button>
					</div>

					{activeProjectTab === 'test-cases' ? (
						<>
							{/* Filter Toolbar */}
					<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
						<div style={{ flex: 1 }}>
							<Input
								placeholder="Cari ID, judul skenario, atau fitur..."
								icon={<Search size={14} />}
								value={tcSearch}
								onChange={(e) => setTcSearch(e.target.value)}
							/>
						</div>
						<div style={{ width: '150px' }}>
							<Combobox
								placeholder="Semua Status"
								searchPlaceholder="Cari status..."
								value={tcStatusFilter}
								onChange={(val) => setTcStatusFilter(String(val))}
								options={[
									{ value: '', label: 'Semua Status' },
									{ value: 'Progress', label: 'Progress', code: 'PROG' },
									{ value: 'Passed', label: 'Passed', code: 'PASS' },
									{ value: 'Failed', label: 'Failed', code: 'FAIL' },
									{ value: 'Re-Test', label: 'Re-Test', code: 'RETRY' },
									{ value: 'Skip', label: 'Skip', code: 'SKIP' }
								]}
							/>
						</div>
					</div>

					{/* Tabel Spreadsheet Style */}
					<div
						style={{
							overflowX: 'auto',
							border: '1px solid #cbd5e1',
							borderRadius: '10px',
							maxHeight: '440px',
							overflowY: 'auto',
							boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
							background: '#ffffff'
						}}
					>
						<table
							style={{
								width: '100%',
								borderCollapse: 'separate',
								borderSpacing: 0,
								fontSize: '12px',
								textAlign: 'left'
							}}
						>
							<thead>
								<tr style={{ background: '#f1f5f9', color: '#334155' }}>
									<th style={{ padding: '10px 12px', width: '48px', textAlign: 'center', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>TYPE</th>
									<th style={{ padding: '10px 12px', minWidth: '95px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Test Case ID</th>
									<th style={{ padding: '10px 12px', minWidth: '110px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Fitur</th>
									<th style={{ padding: '10px 12px', minWidth: '180px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Scenario / Test Case</th>
									<th style={{ padding: '10px 12px', minWidth: '150px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Expected Result</th>
									<th style={{ padding: '10px 12px', width: '100px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Status</th>
									<th style={{ padding: '10px 12px', width: '120px', textAlign: 'center', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Aksi</th>
								</tr>
							</thead>
							<tbody>
								{loadingTestCases ? (
									<tr>
										<td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
											Memuat data test case...
										</td>
									</tr>
								) : testCases.length === 0 ? (
									<tr>
										{Boolean(tcSearch.trim() || tcStatusFilter) ? (
											<td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
												Tidak ada test case yang cocok dengan filter pencarian.
											</td>
										) : (
											<td colSpan={7} style={{ padding: '0', border: 'none' }}>
												<EmptyStateTestCase
													onUseTemplate={() => {
														if (!defaultTemplate) {
															onShowToast(
																'Belum ada template test case default. Minta admin mendaftarkannya di Pengaturan → Template Test Case.',
																'error'
															);
															return;
														}
														setImportPrefillUrl(templateSheetUrl(defaultTemplate));
														setImportModalOpen(true);
													}}
													onUseCustom={() => {
														setImportPrefillUrl(undefined);
														setImportModalOpen(true);
													}}
												/>
											</td>
										)}
									</tr>
								) : (
									testCases.map((tc) => (
										<tr
											key={tc.id_test_case}
											style={{
												cursor: 'pointer',
												transition: 'background 0.15s ease'
											}}
											onClick={() => {
												if (tc.last_session_id) {
													setResultModalSessionId(tc.last_session_id);
													setResultModalTestCase(tc);
													setResultModalOpen(true);
												} else if (allowManageTc) {
													setEditingTestCase(tc);
													setCreateTcModalOpen(true);
												}
											}}
											onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
											onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
											title={
												tc.last_session_id
													? 'Klik baris untuk membuka hasil pengujian'
													: allowManageTc
													? 'Klik baris untuk mengedit test case'
													: undefined
											}
										>
											<td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
												<span
													style={{
														padding: '2px 8px',
														borderRadius: '6px',
														fontWeight: 700,
														fontSize: '11px',
														background: tc.test_type === '-' ? '#fee2e2' : '#dcfce7',
														color: tc.test_type === '-' ? '#b91c1c' : '#15803d',
														border: tc.test_type === '-' ? '1px solid #fecaca' : '1px solid #bbf7d0'
													}}
													title={tc.test_type === '-' ? 'Negative Test' : 'Positive Test'}
												>
													{tc.test_type}
												</span>
											</td>
											<td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
												<div>{tc.test_case_id}</div>
												{tc.program_name && (
													<span
														style={{
															display: 'inline-block',
															marginTop: '3px',
															padding: '1px 6px',
															borderRadius: '4px',
															fontSize: '10px',
															fontWeight: 600,
															background: '#eff6ff',
															color: '#2563eb',
															border: '1px solid #bfdbfe'
														}}
														title={`Master Program: ${tc.program_name}`}
													>
														{tc.program_code || tc.program_name}
													</span>
												)}
											</td>
											<td style={{ padding: '10px 12px', color: '#475569', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>{tc.feature || '-'}</td>
											<td style={{ padding: '10px 12px', color: '#1e293b', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
												{tc.scenario && (
													<div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }} title="Scenario">
														{tc.scenario}
													</div>
												)}
												<div style={{ fontWeight: 500 }}>{tc.title}</div>
												{tc.test_date && (
													<div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Date: {tc.test_date}</div>
												)}
												{tc.pre_condition && (
													<div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
														<em>Pre: {tc.pre_condition}</em>
													</div>
												)}
											</td>
											<td style={{ padding: '10px 12px', color: '#64748b', fontSize: '11px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
												{tc.expected_result || '-'}
											</td>
											<td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>{renderStatusBadge(tc.status)}</td>
											<td
												style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'relative' }}
												onClick={(e) => e.stopPropagation()}
											>
												<div className="tc-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
													<Button
														type="button"
														variant="ghost"
														size="xs"
														icon={<MoreVertical size={14} />}
														aria-label={`Aksi ${tc.test_case_id}`}
														title="Pilihan Aksi"
														onClick={(e) => {
															e.stopPropagation();
															if (activeDropdownTcId === tc.id_test_case) {
																setActiveDropdownTcId(null);
																setDropdownCoords(null);
															} else {
																const rect = e.currentTarget.getBoundingClientRect();
																const spaceBelow = window.innerHeight - rect.bottom;
																const openUp = spaceBelow < 190;
																setDropdownCoords({
																	top: openUp ? undefined : rect.bottom + 4,
																	bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
																	right: Math.max(8, window.innerWidth - rect.right)
																});
																setActiveDropdownTcId(tc.id_test_case);
															}
														}}
														style={{
															padding: '4px 6px',
															borderRadius: 6,
															background: activeDropdownTcId === tc.id_test_case ? '#e2e8f0' : 'transparent'
														}}
													/>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Floating Dropdown Menu (Position Fixed to prevent table overflow clipping) */}
					{Boolean(activeDropdownTcId && dropdownCoords) && (() => {
						const activeTc = testCases.find((t) => t.id_test_case === activeDropdownTcId);
						const coords = dropdownCoords;
						if (!activeTc || !coords) return null;
						return (
							<div
								className="tc-action-dropdown-container tc-action-dropdown-menu"
								style={{
									position: 'fixed',
									top: coords.top !== undefined ? `${coords.top}px` : undefined,
									bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
									right: `${coords.right}px`,
									background: '#ffffff',
									border: '1px solid #cbd5e1',
									borderRadius: 8,
									boxShadow: '0 10px 25px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05)',
									zIndex: 99999,
									minWidth: 165,
									padding: '4px',
									display: 'flex',
									flexDirection: 'column',
									gap: 2,
									textAlign: 'left'
								}}
								onClick={(e) => e.stopPropagation()}
							>
								{allowRecord && (
									<button
										type="button"
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '7px 10px',
											fontSize: 11.5,
											fontWeight: 600,
											color: '#15803d',
											background: 'transparent',
											border: 'none',
											borderRadius: 6,
											cursor: 'pointer',
											width: '100%',
											textAlign: 'left'
										}}
										onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
										onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
										onClick={() => {
											setActiveDropdownTcId(null);
											setDropdownCoords(null);
											onSelectTestCaseForRecording(selectedProject, activeTc);
										}}
									>
										<Play size={13} fill="#15803d" />
										<span>Mulai Rekam</span>
									</button>
								)}

								{Boolean(activeTc.last_session_id) && (
									<button
										type="button"
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: 8,
											padding: '7px 10px',
											fontSize: 11.5,
											fontWeight: 600,
											color: '#2F3574',
											background: 'transparent',
											border: 'none',
											borderRadius: 6,
											cursor: 'pointer',
											width: '100%',
											textAlign: 'left'
										}}
										onMouseEnter={(e) => (e.currentTarget.style.background = '#eef2ff')}
										onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
										onClick={() => {
											setActiveDropdownTcId(null);
											setDropdownCoords(null);
											setResultModalSessionId(activeTc.last_session_id!);
											setResultModalTestCase(activeTc);
											setResultModalOpen(true);
										}}
									>
										<Eye size={13} />
										<span>Lihat Hasil & Video</span>
									</button>
								)}

								{allowManageTc && (
									<>
										<button
											type="button"
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '7px 10px',
												fontSize: 11.5,
												fontWeight: 500,
												color: '#334155',
												background: 'transparent',
												border: 'none',
												borderRadius: 6,
												cursor: 'pointer',
												width: '100%',
												textAlign: 'left'
											}}
											onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
											onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
											onClick={() => {
												setActiveDropdownTcId(null);
												setDropdownCoords(null);
												setEditingTestCase(activeTc);
												setCreateTcModalOpen(true);
											}}
										>
											<Edit size={13} />
											<span>Edit Test Case</span>
										</button>

										<div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />

										<button
											type="button"
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8,
												padding: '7px 10px',
												fontSize: 11.5,
												fontWeight: 500,
												color: '#b91c1c',
												background: 'transparent',
												border: 'none',
												borderRadius: 6,
												cursor: 'pointer',
												width: '100%',
												textAlign: 'left'
											}}
											onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
											onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
											onClick={() => {
												setActiveDropdownTcId(null);
												setDropdownCoords(null);
												handleDeleteTestCase(activeTc);
											}}
										>
											<Trash2 size={13} />
											<span>Hapus Test Case</span>
										</button>
									</>
								)}
							</div>
						);
					})()}
						</>
					) : (
						<div>
							{/* Filter & Refresh Toolbar */}
							<div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
								<div style={{ flex: 1 }}>
									<Input
										placeholder="Cari judul rekaman atau ID skenario..."
										icon={<Search size={14} />}
										value={sessionSearch}
										onChange={(e) => setSessionSearch(e.target.value)}
									/>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									loading={loadingProjectSessions}
									disabled={loadingProjectSessions}
									icon={<RefreshCw size={12} />}
									onClick={() => selectedProject && void loadProjectSessions(selectedProject.id_project)}
								>
									Refresh
								</Button>
							</div>

							{loadingProjectSessions ? (
								<div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b', fontSize: '13px' }}>
									Memuat riwayat sesi rekaman project...
								</div>
							) : filteredProjectSessions.length === 0 ? (
								<div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b', fontSize: '13px', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
									{projectSessions.length === 0
										? 'Belum ada sesi rekaman untuk project ini. Rekam skenario dari tab Test Case.'
										: `Tidak ada sesi yang cocok dengan pencarian "${sessionSearch}".`}
								</div>
							) : (
								<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '440px', overflowY: 'auto' }}>
									{filteredProjectSessions.map((sess) => (
											<div
												key={sess.id_session}
												style={{
													padding: '12px 14px',
													border: '1px solid #cbd5e1',
													borderRadius: '8px',
													background: '#ffffff',
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													gap: '10px'
												}}
											>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
														<span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', color: '#2F3574' }}>
															{sess.test_case_no}
														</span>
														{renderStatusBadge(sess.result || sess.status)}
														<span style={{ fontSize: '11px', color: '#64748b' }}>
															#Session {sess.id_session}
														</span>
													</div>
													<div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
														{sess.title}
													</div>
													{sess.actual_result && (
														<div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', fontStyle: 'italic' }}>
															Temuan: {sess.actual_result}
														</div>
													)}
												</div>
												<div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
													<Button
														type="button"
														variant="outline"
														size="xs"
														icon={<Eye size={12} />}
														onClick={() => {
															const matchedTc = testCases.find((t) => t.test_case_id === sess.test_case_no || t.id_test_case === sess.id_test_case) || null;
															setResultModalSessionId(sess.id_session);
															setResultModalTestCase(matchedTc);
															setResultModalOpen(true);
														}}
													>
														Hasil
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="xs"
														icon={<Share2 size={12} />}
														title="Bagikan Link Debug"
														aria-label={`Bagikan ${sess.test_case_no}`}
														onClick={async () => {
															if (!api) return;
															try {
																const res = await api.generateShareUrl(sess.id_session);
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
																onShowToast?.('Link debug berhasil disalin ke clipboard!', 'success');
															} catch (err) {
																onShowToast?.((err as Error).message || 'Gagal membagikan sesi', 'error');
															}
														}}
													/>
												</div>
											</div>
										))}
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Modal Import Excel / CSV */}
			<ImportTestCaseModal
				isOpen={isImportModalOpen}
				projectName={selectedProject.name}
				prefillUrl={importPrefillUrl}
				templateMapping={defaultTemplate?.column_mapping}
				placeholderUrl={defaultTemplate ? templateSheetUrl(defaultTemplate) : undefined}
				onClose={() => {
					setImportModalOpen(false);
					setImportPrefillUrl(undefined);
				}}
				onImport={handleImportTestCases}
			/>

			{/* Modal Tambah / Edit Test Case Manual */}
			<CreateEditTestCaseModal
				isOpen={isCreateTcModalOpen}
				initialData={editingTestCase}
				projectName={selectedProject.name}
				programs={selectedProject?.programs || []}
				onClose={() => {
					setCreateTcModalOpen(false);
					setEditingTestCase(null);
				}}
				onSave={handleSaveSingleTestCase}
			/>

			{/* Modal Hasil Rekaman Test Case */}
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
				onShowToast={onShowToast}
			/>

			{/* Modal Tambah / Edit Project */}
			<CreateEditProjectModal
				isOpen={isCreateEditProjectModalOpen}
				onClose={() => {
					setCreateEditProjectModalOpen(false);
					setEditingProject(null);
				}}
				project={editingProject}
				programs={activePrograms}
				onSave={handleSaveProject}
			/>

			{/* Modal Konfirmasi Hapus Project */}
			<DeleteProjectModal
				isOpen={isDeleteProjectModalOpen}
				onClose={() => {
					setDeleteProjectModalOpen(false);
					setDeletingProject(null);
				}}
				project={deletingProject}
				onConfirmDelete={handleConfirmDeleteProject}
			/>
		</div>
	);
};
