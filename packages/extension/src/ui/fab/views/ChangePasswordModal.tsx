import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { KeyRound, Lock } from 'lucide-react';
import type { RecordingApiClient } from '../../../recording/apiClient';

interface ChangePasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
	api: RecordingApiClient;
	onSuccess?: (msg: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
	isOpen,
	onClose,
	api,
	onSuccess
}) => {
	const [oldPassword, setOldPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		if (!oldPassword) {
			setError('Password lama wajib diisi.');
			return;
		}
		if (!newPassword || newPassword.length < 6) {
			setError('Password baru minimal 6 karakter.');
			return;
		}
		if (newPassword !== confirmPassword) {
			setError('Konfirmasi password tidak cocok dengan password baru.');
			return;
		}

		setBusy(true);
		setError(null);

		try {
			const res = await api.changePassword(oldPassword, newPassword);
			onSuccess?.(res.message || 'Password berhasil diperbarui.');
			onClose();
			setOldPassword('');
			setNewPassword('');
			setConfirmPassword('');
		} catch (err) {
			setError((err as Error).message || 'Gagal memperbarui password.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Ubah Password Akun"
			footer={
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<Button variant="ghost" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button
						variant="primary"
						loading={busy}
						disabled={busy || !oldPassword || !newPassword || !confirmPassword}
						onClick={handleSave}
						icon={<KeyRound size={15} />}
					>
						Simpan Password
					</Button>
				</div>
			}
		>
			{error && <div className="sp-error" style={{ marginBottom: '12px' }}>{error}</div>}

			<Input
				label="Password Lama"
				type="password"
				icon={<Lock size={14} />}
				value={oldPassword}
				onChange={(e) => setOldPassword(e.target.value)}
				placeholder="Masukkan password saat ini"
				required
			/>

			<Input
				label="Password Baru"
				type="password"
				icon={<KeyRound size={14} />}
				value={newPassword}
				onChange={(e) => setNewPassword(e.target.value)}
				placeholder="Minimal 6 karakter"
				required
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
					if (e.key === 'Enter' && !busy && oldPassword && newPassword && confirmPassword) {
						handleSave();
					}
				}}
			/>
		</Modal>
	);
};
