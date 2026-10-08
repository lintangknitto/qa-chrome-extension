import React, { useCallback, useEffect, useState } from 'react';
import {
	Users,
	UserPlus,
	Search,
	Edit,
	KeyRound,
	Trash2,
	CheckCircle2,
	XCircle,
	RefreshCw,
	ChevronLeft,
	ChevronRight,
	ShieldAlert
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/Card';
import { CreateEditUserModal } from './CreateEditUserModal';
import { AdminResetPasswordModal } from './AdminResetPasswordModal';
import type { RecordingApiClient, RecordingProject, UserItem } from '../../../recording/apiClient';
import type { StoredUser } from '../../../recording/tokenStore';
import { isSuperadmin } from '../fab-permissions';

export interface UserManagementViewProps {
	currentUser: StoredUser | null;
	api: RecordingApiClient;
	projects?: RecordingProject[];
	showNotice?: (msg: string, type?: 'info' | 'success' | 'error') => void;
	onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const getRoleBadgeStyle = (role?: string) => {
	switch (role?.toUpperCase()) {
		case 'SUPERADMIN':
			return { bg: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.3)' };
		case 'ADMIN':
			return { bg: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.3)' };
		case 'QA':
			return { bg: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', border: 'rgba(22, 163, 74, 0.3)' };
		case 'IMPLEMENTOR':
			return { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)' };
		case 'VIEWER':
		default:
			return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: 'rgba(100, 116, 139, 0.3)' };
	}
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({
	currentUser,
	api,
	projects = [],
	showNotice,
	onShowToast
}) => {
	const notify = showNotice || onShowToast || (() => {});
	const [users, setUsers] = useState<UserItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState('all');
	const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
	const [page, setPage] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [total, setTotal] = useState(0);

	// Modals
	const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<UserItem | null>(null);
	const [isResetOpen, setIsResetOpen] = useState(false);
	const [resettingUser, setResettingUser] = useState<UserItem | null>(null);

	const actorIsSuperadmin = isSuperadmin(currentUser);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.listUsers({
				page,
				perPage: 15,
				search: search.trim() || undefined,
				level: roleFilter !== 'all' ? roleFilter : undefined,
				is_active: statusFilter !== 'all' ? statusFilter : undefined
			});
			setUsers(res?.list || (res as any)?.users || []);
			setTotal(res?.total ?? 0);
			setTotalPages(Math.max(1, res?.totalPages || (res as any)?.total_pages || 1));
		} catch (err) {
			const isAuthErr =
				(err as any)?.status === 401 ||
				(err as Error)?.message?.toLowerCase().includes('login');
			if (!isAuthErr) {
				notify((err as Error).message || 'Gagal memuat daftar pengguna.', 'error');
			}
		} finally {
			setLoading(false);
		}
	}, [api, page, search, roleFilter, statusFilter, notify]);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleOpenCreate = () => {
		setEditingUser(null);
		setIsCreateEditOpen(true);
	};

	const handleOpenEdit = (user: UserItem) => {
		setEditingUser(user);
		setIsCreateEditOpen(true);
	};

	const handleOpenReset = (user: UserItem) => {
		setResettingUser(user);
		setIsResetOpen(true);
	};

	const handleToggleActive = async (user: UserItem) => {
		try {
			const newStatus = !user.is_active;
			await api.updateUser(user.id_user, { is_active: newStatus });
			notify(`Status akun ${user.username} berhasil diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}.`, 'success');
			loadUsers();
		} catch (err) {
			notify((err as Error).message || 'Gagal mengubah status pengguna.', 'error');
		}
	};

	const handleDeleteUser = async (user: UserItem) => {
		if (user.id_user === currentUser?.id_user) {
			notify('Tidak dapat menghapus akun Anda sendiri.', 'error');
			return;
		}

		const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus user "${user.nama}" (@${user.username})?`);
		if (!confirmed) return;

		try {
			const res = await api.deleteUser(user.id_user);
			notify(res.message || 'User berhasil diproses.', 'info');
			loadUsers();
		} catch (err) {
			notify((err as Error).message || 'Gagal menghapus user.', 'error');
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Top bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '12px 16px',
					borderBottom: '1px solid #e2e8f0',
					background: '#fff'
				}}
			>
				<div>
					<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Users size={18} color="#3b82f6" />
						Manajemen Pengguna
					</h3>
					<span style={{ fontSize: '11px', color: '#64748b' }}>
						Total {total} pengguna terdaftar
					</span>
				</div>
				<div style={{ display: 'flex', gap: '8px' }}>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadUsers}
						loading={loading}
						icon={<RefreshCw size={13} />}
						title="Refresh"
					/>
					<Button
						variant="primary"
						size="sm"
						onClick={handleOpenCreate}
						icon={<UserPlus size={14} />}
					>
						Tambah User
					</Button>
				</div>
			</div>

			{/* Filters */}
			<div
				style={{
					padding: '10px 16px',
					background: '#f8fafc',
					borderBottom: '1px solid #e2e8f0',
					display: 'flex',
					flexDirection: 'column',
					gap: '8px'
				}}
			>
				<div style={{ position: 'relative' }}>
					<Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
					<input
						type="text"
						placeholder="Cari nama atau username..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(0);
						}}
						style={{
							width: '100%',
							padding: '7px 12px 7px 32px',
							fontSize: '12px',
							borderRadius: '6px',
							border: '1px solid #cbd5e1',
							background: '#fff',
							boxSizing: 'border-box'
						}}
					/>
				</div>

				<div style={{ display: 'flex', gap: '8px' }}>
					<select
						value={roleFilter}
						onChange={(e) => {
							setRoleFilter(e.target.value);
							setPage(0);
						}}
						style={{
							flex: 1,
							padding: '6px 8px',
							fontSize: '11px',
							borderRadius: '6px',
							border: '1px solid #cbd5e1',
							background: '#fff',
							color: '#334155'
						}}
					>
						<option value="all">Semua Role</option>
						<option value="SUPERADMIN">Superadmin</option>
						<option value="ADMIN">Admin</option>
						<option value="QA">QA / Tester</option>
						<option value="IMPLEMENTOR">Implementor / Dev</option>
						<option value="VIEWER">Viewer</option>
					</select>

					<select
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter(e.target.value as any);
							setPage(0);
						}}
						style={{
							flex: 1,
							padding: '6px 8px',
							fontSize: '11px',
							borderRadius: '6px',
							border: '1px solid #cbd5e1',
							background: '#fff',
							color: '#334155'
						}}
					>
						<option value="all">Semua Status</option>
						<option value="true">Aktif</option>
						<option value="false">Nonaktif</option>
					</select>
				</div>
			</div>

			{/* Users list body */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{loading && (!users || users.length === 0) ? (
					<div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
						Memuat data pengguna...
					</div>
				) : !users || users.length === 0 ? (
					<div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
						Tidak ada pengguna yang cocok dengan kriteria filter.
					</div>
				) : (
					(users || []).map((u) => {
						const badge = getRoleBadgeStyle(u.level);
						const isTargetSuperadmin = u.level?.toUpperCase() === 'SUPERADMIN';
						const canManageThisUser = actorIsSuperadmin || !isTargetSuperadmin;
						const isSelf = u.id_user === currentUser?.id_user;

						return (
							<Card key={u.id_user} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
								<CardContent style={{ padding: 0 }}>
									<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
												<span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
													{u.nama}
												</span>
												{isSelf && (
													<span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
														Anda
													</span>
												)}
											</div>
											<div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
												@{u.username}
											</div>
										</div>

										<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
											<span
												style={{
													fontSize: '10px',
													fontWeight: 700,
													padding: '2px 7px',
													borderRadius: '12px',
													background: badge.bg,
													color: badge.color,
													border: `1px solid ${badge.border}`
												}}
											>
												{u.level}
											</span>
											<span
												style={{
													fontSize: '10px',
													fontWeight: 600,
													padding: '2px 6px',
													borderRadius: '12px',
													background: u.is_active ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
													color: u.is_active ? '#16a34a' : '#ef4444',
													display: 'flex',
													alignItems: 'center',
													gap: '3px'
												}}
											>
												{u.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
												{u.is_active ? 'Aktif' : 'Nonaktif'}
											</span>
										</div>
									</div>

									{/* Action buttons */}
									{canManageThisUser && (
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'flex-end',
												gap: '6px',
												marginTop: '10px',
												paddingTop: '8px',
												borderTop: '1px solid #f1f5f9'
											}}
										>
											<Button
												variant="ghost"
												size="xs"
												onClick={() => handleToggleActive(u)}
												style={{ fontSize: '11px', color: u.is_active ? '#e11d48' : '#16a34a' }}
												title={u.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
											>
												{u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
											</Button>
											<Button
												variant="ghost"
												size="xs"
												onClick={() => handleOpenReset(u)}
												icon={<KeyRound size={12} />}
												style={{ fontSize: '11px' }}
												title="Reset Password"
											>
												Reset Password
											</Button>
											<Button
												variant="ghost"
												size="xs"
												onClick={() => handleOpenEdit(u)}
												icon={<Edit size={12} />}
												style={{ fontSize: '11px' }}
												title="Edit User"
											>
												Edit
											</Button>
											{!isSelf && (
												<Button
													variant="ghost"
													size="xs"
													onClick={() => handleDeleteUser(u)}
													icon={<Trash2 size={12} />}
													style={{ fontSize: '11px', color: '#ef4444' }}
													title="Hapus / Deactivate User"
												/>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						);
					})
				)}
			</div>

			{/* Pagination bar */}
			{totalPages > 1 && (
				<div
					style={{
						padding: '8px 16px',
						borderTop: '1px solid #e2e8f0',
						background: '#fff',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: '11px',
						color: '#64748b'
					}}
				>
					<span>
						Halaman {page + 1} dari {totalPages}
					</span>
					<div style={{ display: 'flex', gap: '4px' }}>
						<Button
							variant="ghost"
							size="xs"
							disabled={page <= 0}
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							icon={<ChevronLeft size={13} />}
						/>
						<Button
							variant="ghost"
							size="xs"
							disabled={page >= totalPages - 1}
							onClick={() => setPage((p) => p + 1)}
							icon={<ChevronRight size={13} />}
						/>
					</div>
				</div>
			)}

			{/* Modals */}
			<CreateEditUserModal
				isOpen={isCreateEditOpen}
				user={editingUser}
				currentUser={currentUser}
				projects={projects}
				api={api}
				onClose={() => setIsCreateEditOpen(false)}
				onSuccess={(savedUser, isEdit) => {
					notify(`User ${savedUser.nama} berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}.`, 'success');
					loadUsers();
				}}
			/>

			<AdminResetPasswordModal
				isOpen={isResetOpen}
				user={resettingUser}
				api={api}
				onClose={() => setIsResetOpen(false)}
				onSuccess={(msg) => notify(msg, 'success')}
			/>
		</div>
	);
};
