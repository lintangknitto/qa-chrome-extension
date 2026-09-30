import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { KeyRound, ShieldAlert } from 'lucide-react';
import type { RecordingApiClient, UserItem } from '../../../recording/apiClient';

interface AdminResetPasswordModalProps {
	user: UserItem | null;
	isOpen: boolean;
	onClose: () => void;
	api: RecordingApiClient;
	onSuccess?: (msg: string) => void;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
	user,
	isOpen,
	onClose,
	api,
	onSuccess
}) => {
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;

	const handleReset = async () => {
		if (!newPassword || newPassword.length < 6) {
			setError('Password baru minimal 6 karakter.');
			return;
		}
		if (newPassword !== confirmPassword) {
			setError('Konfirmasi password tidak cocok.');
			return;
		}

		setBusy(true);
		setError(null);

		try {
			const res = await api.resetUserPassword(user.id_user, newPassword);
			onSuccess?.(res.message || `Password untuk ${user.username} berhasil direset.`);
			onClose();
			setNewPassword('');
			setConfirmPassword('');
		} catch (err) {
			setError((err as Error).message || 'Gagal mereset password user.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Reset Password: ${user.nama} (@${user.username})`}
			footer={
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<Button variant="ghost" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button
						variant="primary"
						loading={busy}
						disabled={busy || !newPassword || !confirmPassword}
						onClick={handleReset}
						icon={<KeyRound size={15} />}
					>
						Reset Password
					</Button>
				</div>
			}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					background: 'rgba(234, 179, 8, 0.1)',
					border: '1px solid rgba(234, 179, 8, 0.3)',
					borderRadius: '6px',
					padding: '10px 12px',
					marginBottom: '14px',
					fontSize: '12px',
					color: '#ca8a04'
				}}
			>
				<ShieldAlert size={16} style={{ flexShrink: 0 }} />
				<span>
					Anda sedang mengatur ulang password untuk akun <strong>{user.username}</strong> ({user.level}).
				</span>
			</div>

			{error && <div className="sp-error" style={{ marginBottom: '12px' }}>{error}</div>}

			<Input
				label="Password Baru"
				type="password"
				icon={<KeyRound size={14} />}
				value={newPassword}
				onChange={(e) => setNewPassword(e.target.value)}
				placeholder="Minimal 6 karakter"
				required
				autoFocus
			/>

			<Input
				label="Konfirmasi Password Baru"
				type="password"
				icon={<KeyRound size={14} />}
				value={confirmPassword}
				onChange={(e) => setConfirmPassword(e.target.value)}
				placeholder="Ketik ulang password baru"
				required
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !busy && newPassword && confirmPassword) {
						handleReset();
					}
				}}
			/>
		</Modal>
	);
};
