import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { User, Lock, Shield, CheckSquare, Square, Search, UserPlus, Check } from 'lucide-react';
import type { RecordingApiClient, RecordingProject, UserItem } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';
import { isSuperadmin } from '../fab-permissions';

interface CreateEditUserModalProps {
	isOpen: boolean;
	user: UserItem | null;
	currentUser: StoredUser | null;
	projects: RecordingProject[];
	api: RecordingApiClient;
	onClose: () => void;
	onSuccess: (user: UserItem, isEdit: boolean) => void;
}

const ALL_ROLES = [
	{ id: 'SUPERADMIN', label: 'Superadmin (Full Access)', desc: 'Akses penuh ke seluruh sistem & kelola admin' },
	{ id: 'ADMIN', label: 'Admin (User & Project Mgmt)', desc: 'Kelola user non-superadmin dan master project' },
	{ id: 'QA', label: 'QA / Tester', desc: 'Rekam sesi, buat test case, generate AI Playwright script' },
	{ id: 'IMPLEMENTOR', label: 'Developer / Implementor', desc: 'Jalankan test, lihat test case & script (read-only)' },
	{ id: 'VIEWER', label: 'Viewer', desc: 'Hanya melihat daftar test case dan riwayat hasil' }
];

export const CreateEditUserModal: React.FC<CreateEditUserModalProps> = ({
	isOpen,
	user,
	currentUser,
	projects = [],
	api,
	onClose,
	onSuccess
}) => {
	const isEdit = Boolean(user);
	const actorIsSuperadmin = isSuperadmin(currentUser);

	const [nama, setNama] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [level, setLevel] = useState<string>('QA');
	const [isActive, setIsActive] = useState(true);
	const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
	const [projectSearch, setProjectSearch] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (user) {
			setNama(user.nama || '');
			setUsername(user.username || '');
			setPassword('');
			setLevel(user.level || 'QA');
			setIsActive(user.is_active ?? true);
			setSelectedProjectIds(user.assigned_project_ids ?? []);

			// Fetch detail fresh from API to ensure assigned_project_ids is fully loaded
			if (user.id_user) {
				api.getUserDetail(user.id_user)
					.then((detail) => {
						if (detail.assigned_project_ids) {
							setSelectedProjectIds(detail.assigned_project_ids);
						}
					})
					.catch(() => {});
			}
		} else {
			setNama('');
			setUsername('');
			setPassword('');
			setLevel('QA');
			setIsActive(true);
			setSelectedProjectIds([]);
		}
		setError(null);
		setProjectSearch('');
	}, [user, isOpen, api]);

	const availableRoles = ALL_ROLES.filter((r) => {
		if (r.id === 'SUPERADMIN') return actorIsSuperadmin;
		return true;
	});

	const toggleProject = (projectId: number) => {
		setSelectedProjectIds((prev) =>
			prev.includes(projectId)
				? prev.filter((id) => id !== projectId)
				: [...prev, projectId]
		);
	};

	const selectAllProjects = () => {
		setSelectedProjectIds((projects || []).map((p) => p.id_project));
	};

	const clearAllProjects = () => {
		setSelectedProjectIds([]);
	};

	const filteredProjects = (projects || []).filter((p) =>
		p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
		p.code.toLowerCase().includes(projectSearch.toLowerCase())
	);

	const handleSubmit = async () => {
		if (!nama.trim()) {
			setError('Nama lengkap wajib diisi.');
			return;
		}
		if (!isEdit && !username.trim()) {
			setError('Username wajib diisi.');
			return;
		}
		if (!isEdit && (!password || password.length < 6)) {
			setError('Password minimal 6 karakter.');
			return;
		}

		setBusy(true);
		setError(null);

		try {
			if (isEdit && user) {
				const updated = await api.updateUser(user.id_user, {
					nama: nama.trim(),
					level,
					is_active: isActive,
					project_ids: selectedProjectIds
				});
				onSuccess(updated, true);
			} else {
				const created = await api.createUser({
					nama: nama.trim(),
					username: username.trim(),
					password,
					level,
					is_active: isActive,
					project_ids: selectedProjectIds
				});
				onSuccess(created, false);
			}
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menyimpan data pengguna.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEdit ? `Edit User: ${user?.nama}` : 'Tambah Pengguna Baru'}
			footer={
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<Button variant="ghost" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button
						variant="primary"
						loading={busy}
						disabled={busy || !nama || (!isEdit && (!username || !password))}
						onClick={handleSubmit}
						icon={isEdit ? <Check size={15} /> : <UserPlus size={15} />}
					>
						{isEdit ? 'Simpan Perubahan' : 'Tambah Pengguna'}
					</Button>
				</div>
			}
		>
			{error && <div className="sp-error" style={{ marginBottom: '12px' }}>{error}</div>}

			<Input
				label="Nama Lengkap"
				icon={<User size={14} />}
				value={nama}
				onChange={(e) => setNama(e.target.value)}
				placeholder="cth. Budi Santoso"
				required
				autoFocus
			/>

			{!isEdit && (
				<Input
					label="Username"
					icon={<User size={14} />}
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="cth. budi.s"
					required
				/>
			)}

			{!isEdit && (
				<Input
					label="Password"
					type="password"
					icon={<Lock size={14} />}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Minimal 6 karakter"
					required
				/>
			)}

			<div style={{ marginBottom: '14px' }}>
				<label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
					<Shield size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
					Role & Hak Akses
				</label>
				<select
					className="k-select"
					style={{
						width: '100%',
						padding: '8px 12px',
						borderRadius: '6px',
						border: '1px solid #cbd5e1',
						fontSize: '13px',
						background: '#fff',
						color: '#0f172a'
					}}
					value={level}
					onChange={(e) => setLevel(e.target.value)}
				>
					{availableRoles.map((r) => (
						<option key={r.id} value={r.id}>
							{r.label}
						</option>
					))}
				</select>
				<div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
					{availableRoles.find((r) => r.id === level)?.desc}
				</div>
			</div>

			<div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
				<input
					type="checkbox"
					id="chk-user-active"
					checked={isActive}
					onChange={(e) => setIsActive(e.target.checked)}
					style={{ cursor: 'pointer', width: '15px', height: '15px' }}
				/>
				<label htmlFor="chk-user-active" style={{ fontSize: '13px', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
					Akun Aktif (Dapat Login ke Sistem)
				</label>
			</div>

			<div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
					<label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
						Penugasan Akses Project ({selectedProjectIds.length} dipilih)
					</label>
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							type="button"
							onClick={selectAllProjects}
							style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', padding: 0 }}
						>
							Pilih Semua
						</button>
						<span style={{ color: '#cbd5e1', fontSize: '11px' }}>|</span>
						<button
							type="button"
							onClick={clearAllProjects}
							style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}
						>
							Kosongkan
						</button>
					</div>
				</div>

				<div style={{ position: 'relative', marginBottom: '8px' }}>
					<Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
					<input
						type="text"
						placeholder="Cari project..."
						value={projectSearch}
						onChange={(e) => setProjectSearch(e.target.value)}
						style={{
							width: '100%',
							padding: '6px 10px 6px 30px',
							fontSize: '12px',
							border: '1px solid #e2e8f0',
							borderRadius: '6px',
							boxSizing: 'border-box'
						}}
					/>
				</div>

				<div
					style={{
						maxHeight: '140px',
						overflowY: 'auto',
						border: '1px solid #e2e8f0',
						borderRadius: '6px',
						background: '#f8fafc',
						padding: '4px'
					}}
				>
					{filteredProjects.length === 0 ? (
						<div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
							Tidak ada project yang cocok
						</div>
					) : (
						filteredProjects.map((proj) => {
							const isSelected = selectedProjectIds.includes(proj.id_project);
							return (
								<div
									key={proj.id_project}
									onClick={() => toggleProject(proj.id_project)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '8px',
										padding: '6px 8px',
										borderRadius: '4px',
										cursor: 'pointer',
										background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
										transition: 'background 0.15s'
									}}
								>
									{isSelected ? (
										<CheckSquare size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />
									) : (
										<Square size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
									)}
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
											{proj.name}
										</div>
										<div style={{ fontSize: '10px', color: '#64748b' }}>
											{proj.code}
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
				<div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
					* Superadmin & Admin secara default memiliki akses global ke seluruh project.
				</div>
			</div>
		</Modal>
	);
};
