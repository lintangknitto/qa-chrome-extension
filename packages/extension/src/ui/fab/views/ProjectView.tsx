import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
	FolderKanban,
	Plus,
	Search,
	Upload,
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
	Share2
} from 'lucide-react';
import type {
	RecordingApiClient,
	RecordingProject,
	RecordingSession,
	TestCaseItem,
	TestCaseSummary
} from '../../../recording/apiClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ImportTestCaseModal } from './ImportTestCaseModal';
import { CreateEditTestCaseModal } from './CreateEditTestCaseModal';
import { EmptyStateTestCase } from './EmptyStateTestCase';
import { TestCaseResultModal } from './TestCaseResultModal';
import type { ParsedImportTestCase } from '../../../recording/spreadsheetParser';

export interface ProjectViewProps {
	projects: RecordingProject[];
	api: RecordingApiClient;
	canCreateProject: boolean;
	onRefreshProjects: () => Promise<void>;
	onCreateProject: (input: {
		name: string;
		base_url?: string;
		description?: string;
	}) => Promise<number | undefined>;
	onSelectTestCaseForRecording: (project: RecordingProject, testCase: TestCaseItem) => void;
	onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
	onActiveProjectChange?: (project: RecordingProject | null) => void;
}

const SYSTEM_TEMPLATE_URL =
	'https://docs.google.com/spreadsheets/d/1k_08EdNZUBGBhLNU-FIPxqm06PpCfn4Dyprc4sDYCsI/edit?gid=603972469#gid=603972469';

export const ProjectView: React.FC<ProjectViewProps> = ({
	projects,
	api,
	canCreateProject,
	onRefreshProjects,
	onCreateProject,
	onSelectTestCaseForRecording,
	onShowToast,
	onActiveProjectChange
}) => {
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

	// New Project modal states
	const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);
	const [newProjName, setNewProjName] = useState('');
	const [newProjUrl, setNewProjUrl] = useState('');
	const [newProjDesc, setNewProjDesc] = useState('');
	const [newProjBusy, setNewProjBusy] = useState(false);
	const [newProjError, setNewProjError] = useState<string | null>(null);

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
				onShowToast((err as Error).message || 'Gagal memuat test cases.', 'error');
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
				onShowToast((err as Error).message || 'Gagal memuat riwayat sesi project.', 'error');
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

	const handleSaveNewProject = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newProjName.trim() || newProjBusy) return;
		setNewProjBusy(true);
		setNewProjError(null);
		try {
			const newId = await onCreateProject({
				name: newProjName.trim(),
				base_url: newProjUrl.trim() || undefined,
				description: newProjDesc.trim() || undefined
			});
			setNewProjectModalOpen(false);
			setNewProjName('');
			setNewProjUrl('');
			setNewProjDesc('');
			await onRefreshProjects();
			onShowToast('Project baru berhasil ditambahkan.', 'success');
			if (newId) {
				const found = projects.find((p) => p.id_project === newId);
				if (found) handleSetSelectedProject(found);
			}
		} catch (err) {
			setNewProjError((err as Error).message || 'Gagal membuat project.');
		} finally {
			setNewProjBusy(false);
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

	const filteredProjects = projects.filter((p) => {
		const s = projectSearch.toLowerCase();
		return p.name.toLowerCase().includes(s) || (p.code && p.code.toLowerCase().includes(s));
	});

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
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
							<div>
								<CardTitle style={{ fontSize: '15px', fontWeight: 600 }}>Manajemen Project</CardTitle>
								<CardDescription>Pilih project untuk mengelola skenario dan test case</CardDescription>
							</div>
							{canCreateProject && (
								<Button
									type="button"
									variant="primary"
									size="sm"
									icon={<Plus size={14} />}
									onClick={() => setNewProjectModalOpen(true)}
								>
									Project Baru
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<Input
							placeholder="Cari nama atau kode project..."
							icon={<Search size={14} />}
							value={projectSearch}
							onChange={(e) => setProjectSearch(e.target.value)}
						/>

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
								filteredProjects.map((p) => (
									<div
										key={p.id_project}
										onClick={() => handleSetSelectedProject(p)}
										style={{
											padding: '14px 16px',
											borderRadius: '10px',
											border: '1px solid #cbd5e1',
											background: '#ffffff',
											cursor: 'pointer',
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											transition: 'all 0.15s ease',
											boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
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
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
											</div>
											{p.base_url && (
												<div
													style={{
														fontSize: '12px',
														color: '#64748b',
														display: 'flex',
														alignItems: 'center',
														gap: '5px'
													}}
												>
													<Globe size={13} color="#94a3b8" />
													<span>{p.base_url}</span>
												</div>
											)}
										</div>
										<Button
											type="button"
											variant="secondary"
											size="xs"
										>
											Kelola Test Case →
										</Button>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>

				{/* Modal Tambah Project Baru */}
				<Modal
					isOpen={isNewProjectModalOpen}
					onClose={() => setNewProjectModalOpen(false)}
					title="Tambah Project Baru"
				>
					<form onSubmit={handleSaveNewProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						{newProjError && <div className="sp-error">{newProjError}</div>}
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
							<Input
								label="Nama Project"
								required
								placeholder="Contoh: Portal Knitto"
								value={newProjName}
								onChange={(e) => setNewProjName(e.target.value)}
							/>
							<Input
								label="Base URL (Opsional)"
								placeholder="https://portal.knitto.org"
								value={newProjUrl}
								onChange={(e) => setNewProjUrl(e.target.value)}
							/>
							<Input
								label="Deskripsi (Opsional)"
								placeholder="Keterangan singkat project"
								value={newProjDesc}
								onChange={(e) => setNewProjDesc(e.target.value)}
							/>
						</div>
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setNewProjectModalOpen(false)}
								disabled={newProjBusy}
							>
								Batal
							</Button>
							<Button type="submit" variant="primary" size="sm" loading={newProjBusy} disabled={newProjBusy || !newProjName.trim()}>
								{newProjBusy ? 'Menyimpan...' : 'Simpan Project'}
							</Button>
						</div>
					</form>
				</Modal>
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
							</div>
							{selectedProject.base_url && (
								<div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
									{selectedProject.base_url}
								</div>
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
						<div style={{ width: '130px' }}>
							<Select
								value={tcStatusFilter}
								onChange={(e) => setTcStatusFilter(e.target.value)}
								options={[
									{ value: '', label: 'Semua Status' },
									{ value: 'Progress', label: 'Progress' },
									{ value: 'Passed', label: 'Passed' },
									{ value: 'Failed', label: 'Failed' },
									{ value: 'Re-Test', label: 'Re-Test' },
									{ value: 'Skip', label: 'Skip' }
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
									<th style={{ padding: '10px 12px', minWidth: '180px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 2 }}>Test Case (Skenario)</th>
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
														setImportPrefillUrl(SYSTEM_TEMPLATE_URL);
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
												transition: 'background 0.15s ease'
											}}
											onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
											onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
												{tc.test_case_id}
											</td>
											<td style={{ padding: '10px 12px', color: '#475569', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>{tc.feature || '-'}</td>
											<td style={{ padding: '10px 12px', color: '#1e293b', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }}>
												<div style={{ fontWeight: 500 }}>{tc.title}</div>
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
											<td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
												<div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
													<Button
														type="button"
														variant="success"
														size="xs"
														icon={<Play size={11} fill="currentColor" />}
														title="Rekam Skenario Ini Langsung"
														onClick={() => onSelectTestCaseForRecording(selectedProject, tc)}
													>
														Rekam
													</Button>
													{Boolean(tc.last_session_id) && (
														<Button
															type="button"
															variant="outline"
															size="xs"
															icon={<Eye size={11} />}
															title="Lihat Hasil Rekaman Skenario Ini"
															aria-label={`Hasil ${tc.test_case_id}`}
															onClick={() => {
																setResultModalSessionId(tc.last_session_id!);
																setResultModalTestCase(tc);
																setResultModalOpen(true);
															}}
														>
															Hasil
														</Button>
													)}
													<Button
														type="button"
														variant="ghost"
														size="xs"
														icon={<Edit size={12} />}
														title="Edit Test Case"
														aria-label={`Edit ${tc.test_case_id}`}
														onClick={() => {
															setEditingTestCase(tc);
															setCreateTcModalOpen(true);
														}}
													/>
													<Button
														type="button"
														variant="ghost"
														size="xs"
														className="k-btn-danger-ghost"
														icon={<Trash2 size={12} />}
														title="Hapus Test Case"
														aria-label={`Hapus ${tc.test_case_id}`}
														onClick={() => handleDeleteTestCase(tc)}
													/>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
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
				onClose={() => {
					setCreateTcModalOpen(false);
					setEditingTestCase(null);
				}}
				onSave={handleSaveSingleTestCase}
			/>

			{/* Modal Hasil Rekaman Test Case */}
			<TestCaseResultModal
				open={isResultModalOpen}
				sessionId={resultModalSessionId}
				testCase={resultModalTestCase}
				api={api}
				onClose={() => {
					setResultModalOpen(false);
					setResultModalSessionId(null);
					setResultModalTestCase(null);
				}}
				onShowToast={onShowToast}
			/>
		</div>
	);
};
