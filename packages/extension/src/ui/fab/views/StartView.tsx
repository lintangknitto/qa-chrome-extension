import React, { useState, useEffect } from 'react';
import { Play, Hash, FileText, Globe, Plus, CheckCircle, Info, Video } from 'lucide-react';
import type { RecordingApiClient, RecordingProject, TestCaseItem } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Combobox } from '../components/Combobox';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export interface PrefilledTestCase {
	id_project?: number;
	id_test_case?: number;
	test_case_no?: string;
	title?: string;
	target_url?: string;
	pre_condition?: string;
	expected_result?: string;
}

export interface StartViewProps {
	user: StoredUser | null;
	projects: RecordingProject[];
	api?: RecordingApiClient;
	busy: boolean;
	error: string | null;
	prefilledTestCase?: PrefilledTestCase | null;
	onSubmit: (input: {
		id_project?: number | null;
		id_test_case?: number | null;
		test_case_no: string;
		title: string;
		description: string;
		target_url: string;
		expected_result?: string | null;
		record_video?: boolean;
	}) => void;
	onCreateProject?: (input: {
		name: string;
		base_url?: string;
		description?: string;
	}) => Promise<number | undefined>;
	onNavigateHistory?: () => void;
	onLogout?: () => void;
}

const getOriginFromUrl = (urlStr: string): string => {
	if (!urlStr) return '';
	try {
		const parsed = new URL(urlStr);
		if (parsed.origin && parsed.origin !== 'null') {
			return parsed.origin;
		}
		return urlStr;
	} catch {
		return urlStr;
	}
};

export const StartView: React.FC<StartViewProps> = ({
	user,
	projects,
	api,
	busy,
	error,
	prefilledTestCase,
	onSubmit,
	onCreateProject
}) => {
	const [idProject, setIdProject] = useState<number | ''>('');
	const [idTestCase, setIdTestCase] = useState<number | ''>('');
	const [testCaseNo, setTestCaseNo] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [targetUrl, setTargetUrl] = useState('');
	const [activeTabUrl, setActiveTabUrl] = useState('');
	const [recordVideo, setRecordVideo] = useState(true);

	// Project test cases list
	const [projectTestCases, setProjectTestCases] = useState<TestCaseItem[]>([]);
	const [loadingTestCases, setLoadingTestCases] = useState(false);
	const [expectedResultPreview, setExpectedResultPreview] = useState<string | null>(null);
	const [preConditionPreview, setPreConditionPreview] = useState<string | null>(null);

	// Project Modal States
	const [isProjectModalOpen, setProjectModalOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState('');
	const [newProjectBaseUrl, setNewProjectBaseUrl] = useState('');
	const [newProjectDesc, setNewProjectDesc] = useState('');
	const [createProjectBusy, setCreateProjectBusy] = useState(false);
	const [createProjectError, setCreateProjectError] = useState<string | null>(null);

	// Akses Tambah Project
	const userLevel = (user?.level ?? '').toUpperCase();
	const username = (user?.username ?? '').toLowerCase();
	const canCreateProject =
		Boolean(user) &&
		(!user?.level ||
			['QA', 'ADMIN', 'SUPERADMIN', 'IMPLEMENTOR'].includes(userLevel) ||
			username === 'qatester');

	// Menangani prefilled test case jika dipanggil dari ProjectView
	useEffect(() => {
		if (prefilledTestCase) {
			if (prefilledTestCase.id_project) {
				setIdProject(prefilledTestCase.id_project);
			}
			if (prefilledTestCase.id_test_case) {
				setIdTestCase(prefilledTestCase.id_test_case);
			}
			if (prefilledTestCase.test_case_no) {
				setTestCaseNo(prefilledTestCase.test_case_no);
			}
			if (prefilledTestCase.title) {
				setTitle(prefilledTestCase.title);
			}
			if (prefilledTestCase.target_url) {
				setTargetUrl(prefilledTestCase.target_url);
			}
			if (prefilledTestCase.pre_condition) {
				setPreConditionPreview(prefilledTestCase.pre_condition);
				setDescription((prev) => (prev ? prev : `Prasyarat: ${prefilledTestCase.pre_condition}`));
			}
			if (prefilledTestCase.expected_result) {
				setExpectedResultPreview(prefilledTestCase.expected_result);
			}
		}
	}, [prefilledTestCase]);

	// Auto-prefill target URL dari tab aktif
	useEffect(() => {
		let isMounted = true;
		const detectActiveUrl = async () => {
			try {
				if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
					const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
					if (isMounted && tab?.url) {
						setActiveTabUrl(tab.url);
						setTargetUrl((prev) => (prev ? prev : tab.url!));
						return;
					}
				}
			} catch {
				// Fallback jika chrome.tabs tidak tersedia
			}
			if (typeof window !== 'undefined' && window.location?.href) {
				const href = window.location.href;
				if (isMounted && href) {
					setActiveTabUrl(href);
					setTargetUrl((prev) => (prev ? prev : href));
				}
			}
		};
		void detectActiveUrl();
		return () => {
			isMounted = false;
		};
	}, []);

	// Memuat daftar test cases ketika project dipilih
	useEffect(() => {
		if (!idProject || idProject === 0 || !api) {
			setProjectTestCases([]);
			return;
		}

		let isMounted = true;
		const loadCases = async () => {
			setLoadingTestCases(true);
			try {
				const res = await api.listTestCases(Number(idProject), { limit: 100 });
				if (isMounted) {
					setProjectTestCases(res.items);
				}
			} catch {
				if (isMounted) setProjectTestCases([]);
			} finally {
				if (isMounted) setLoadingTestCases(false);
			}
		};

		void loadCases();
		return () => {
			isMounted = false;
		};
	}, [idProject, api]);

	const handleProjectChange = (val: string | number) => {
		const num = val ? Number(val) : '';
		setIdProject(num);
		setIdTestCase('');
		setExpectedResultPreview(null);
		setPreConditionPreview(null);

		// Jika memilih project tertentu yang memiliki base_url dan targetUrl masih kosong
		if (num && num !== 0) {
			const proj = projects.find((p) => p.id_project === num);
			if (proj?.base_url && (!targetUrl || targetUrl === 'about:blank')) {
				setTargetUrl(proj.base_url);
			}
		}
	};

	const handleTestCaseSelect = (val: string | number) => {
		const num = val ? Number(val) : '';
		setIdTestCase(num);

		if (num && num !== 0) {
			const tc = projectTestCases.find((t) => t.id_test_case === num);
			if (tc) {
				setTestCaseNo(tc.test_case_id);
				setTitle(tc.title);
				if (tc.pre_condition) {
					setPreConditionPreview(tc.pre_condition);
					setDescription(`Prasyarat: ${tc.pre_condition}`);
				} else {
					setPreConditionPreview(null);
				}
				if (tc.expected_result) {
					setExpectedResultPreview(tc.expected_result);
				} else {
					setExpectedResultPreview(null);
				}
			}
		} else {
			setExpectedResultPreview(null);
			setPreConditionPreview(null);
		}
	};

	const handleOpenProjectModal = () => {
		setCreateProjectError(null);
		setNewProjectName('');
		setNewProjectDesc('');
		const defaultBaseUrl = getOriginFromUrl(targetUrl || activeTabUrl);
		setNewProjectBaseUrl(defaultBaseUrl);
		setProjectModalOpen(true);
	};

	const handleSaveProject = async () => {
		if (newProjectName.trim().length < 3 || createProjectBusy) return;
		if (!onCreateProject) return;
		setCreateProjectBusy(true);
		setCreateProjectError(null);
		try {
			const newId = await onCreateProject({
				name: newProjectName.trim(),
				base_url: newProjectBaseUrl.trim() || undefined,
				description: newProjectDesc.trim() || undefined
			});
			if (typeof newId === 'number') {
				setIdProject(newId);
			}
			setProjectModalOpen(false);
		} catch (err) {
			setCreateProjectError((err as Error).message || 'Gagal membuat project.');
		} finally {
			setCreateProjectBusy(false);
		}
	};

	// Tombol submit aktif jika testCaseNo & title terisi (Project bersifat opsional untuk mode rekam langsung)
	const canSubmit = testCaseNo.trim().length > 0 && title.trim().length > 0 && !busy;

	const handleSubmitForm = (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmit) return;

		onSubmit({
			id_project: idProject && idProject !== 0 ? Number(idProject) : null,
			id_test_case: idTestCase && idTestCase !== 0 ? Number(idTestCase) : null,
			test_case_no: testCaseNo.trim(),
			title: title.trim(),
			description: description.trim(),
			target_url: targetUrl.trim(),
			expected_result: expectedResultPreview || null,
			record_video: recordVideo
		});
	};

	// Dropdown options project: tambahkan opsi Rekam Langsung (Quick Record) di paling atas
	const projectOptions = [
		{
			value: 0,
			label: '-- Tanpa Project (Rekam Langsung / Quick Record) --',
			code: 'QUICK'
		},
		...projects.map((project) => ({
			value: project.id_project,
			label: project.name,
			code: project.code
		}))
	];

	return (
		<>
			{/* Main Form */}
			<Card>
				<CardHeader>
					<div>
						<CardTitle className="sp-label" style={{ fontWeight: 600, fontSize: 14 }}>
							Form Mulai Rekaman
						</CardTitle>
						<CardDescription>
							{idProject && idProject !== 0
								? 'Rekaman terikat ke Project & Master Test Case'
								: 'Mode Rekam Langsung aktif (bisa langsung merekam tanpa master project)'}
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent>
					{error && <div className="sp-error">{error}</div>}

					{/* Selector Project */}
					<div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
						<div style={{ flex: 1, minWidth: 0 }}>
							<Combobox
								label="Pilih Project (Opsional)"
								placeholder="Pilih project atau rekam langsung..."
								searchPlaceholder="Cari project..."
								emptyMessage="Project tidak ditemukan"
								value={idProject !== '' ? idProject : 0}
								onChange={handleProjectChange}
								options={projectOptions}
							/>
						</div>
						{canCreateProject && (
							<div style={{ marginBottom: '12px', flexShrink: 0 }}>
								<Button
									type="button"
									variant="secondary"
									size="md"
									style={{ width: '38px', height: '38px', padding: 0 }}
									title="Tambah Project Baru"
									aria-label="Tambah Project Baru"
									onClick={handleOpenProjectModal}
								>
									<Plus size={16} />
								</Button>
							</div>
						)}
					</div>

					{/* Selector Test Case dari Project (hanya jika project dipilih) */}
					{idProject && idProject !== 0 ? (
						<div style={{ marginTop: '10px' }}>
							<Combobox
								label="Pilih Skenario / Test Case (Opsional)"
								placeholder={loadingTestCases ? 'Memuat test cases...' : 'Pilih test case atau input manual...'}
								searchPlaceholder="Cari ID atau judul test case..."
								emptyMessage="Belum ada test case di project ini"
								value={idTestCase}
								onChange={handleTestCaseSelect}
								options={[
									{ value: 0, label: '-- Input Manual / Skenario Baru --', code: 'MANUAL' },
									...projectTestCases.map((tc) => ({
										value: tc.id_test_case,
										label: `${tc.test_case_id} — ${tc.title}`,
										code: tc.test_type
									}))
								]}
							/>
						</div>
					) : null}

					{/* Preview Kartu Pre-Condition & Expected Result */}
					{(expectedResultPreview || preConditionPreview) && (
						<div
							style={{
								marginTop: '10px',
								background: '#f8fafc',
								border: '1px solid #e2e8f0',
								borderRadius: '8px',
								padding: '10px 12px',
								fontSize: '12px',
								display: 'flex',
								flexDirection: 'column',
								gap: '6px'
							}}
						>
							{preConditionPreview && (
								<div style={{ color: '#475569' }}>
									<span style={{ fontWeight: 600, color: '#334155' }}>Prasyarat: </span>
									{preConditionPreview}
								</div>
							)}
							{expectedResultPreview && (
								<div style={{ color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: '4px' }}>
									<span style={{ fontWeight: 600, color: '#15803d' }}>Expected Result: </span>
									{expectedResultPreview}
								</div>
							)}
						</div>
					)}

					<form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
						<Input
							label="Nomor test case"
							icon={<Hash size={14} />}
							value={testCaseNo}
							required
							onChange={(event) => setTestCaseNo(event.target.value)}
							placeholder="Contoh: TC-AUTH-01"
						/>

						<Input
							label="Judul"
							icon={<FileText size={14} />}
							value={title}
							required
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Contoh: Test Login Sukses User Standar"
						/>

						<Textarea
							label="Deskripsi / tujuan"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Catatan skenario atau deskripsi pengujian"
						/>

						<Input
							label="Target URL"
							icon={<Globe size={14} />}
							value={targetUrl}
							onChange={(event) => setTargetUrl(event.target.value)}
							placeholder="Contoh: https://app.knitto.co.id/login"
						/>

						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#334155' }}>
								<input
									type="checkbox"
									checked={recordVideo}
									onChange={(e) => setRecordVideo(e.target.checked)}
									style={{ accentColor: '#2F3574', cursor: 'pointer' }}
								/>
								<Video size={14} color="#2F3574" />
								<span>Rekam Video Layar (WebM)</span>
							</label>
						</div>

						<div style={{ paddingTop: '8px' }}>
							<Button
								type="submit"
								variant="primary"
								size="lg"
								disabled={!canSubmit}
								style={{ width: '100%' }}
							>
								<Play size={16} fill="currentColor" />
								<span>{busy ? 'Menyiapkan...' : 'Start Recording'}</span>
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{/* Modal Tambah Project Baru */}
			<Modal
				open={isProjectModalOpen}
				onClose={() => {
					if (!createProjectBusy) setProjectModalOpen(false);
				}}
				title="Tambah Project Baru"
				footer={
					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={createProjectBusy}
							onClick={() => setProjectModalOpen(false)}
						>
							Batal
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={newProjectName.trim().length < 3 || createProjectBusy}
							loading={createProjectBusy}
							onClick={handleSaveProject}
						>
							{createProjectBusy ? 'Menyimpan...' : 'Simpan Project'}
						</Button>
					</div>
				}
			>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					{createProjectError && (
						<div className="sp-error" style={{ marginBottom: '12px' }}>
							{createProjectError}
						</div>
					)}

					<Input
						label="Nama Project"
						value={newProjectName}
						required
						placeholder="Contoh: Knitto ERP Portal"
						onChange={(e) => setNewProjectName(e.target.value)}
						helperText="Minimal 3 karakter. Kode project digenerate otomatis."
					/>

					<Input
						label="Base URL"
						icon={<Globe size={14} />}
						value={newProjectBaseUrl}
						placeholder="Contoh: https://erp.knitto.id"
						onChange={(e) => setNewProjectBaseUrl(e.target.value)}
						helperText="URL dasar atau origin aplikasi yang diuji (dapat diedit)"
					/>

					<Textarea
						label="Deskripsi"
						value={newProjectDesc}
						placeholder="Deskripsi singkat project (opsional)"
						onChange={(e) => setNewProjectDesc(e.target.value)}
					/>
				</div>
			</Modal>
		</>
	);
};
