import React, { useState } from 'react';
import type { RecordingProject } from '../../../recording/apiClient';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface DeleteProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	project: RecordingProject | null;
	onConfirmDelete: (project: RecordingProject) => Promise<void>;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
	isOpen,
	onClose,
	project,
	onConfirmDelete
}) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!project) return null;

	const handleConfirm = async () => {
		setBusy(true);
		setError(null);
		try {
			await onConfirmDelete(project);
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menghapus project.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Hapus / Nonaktifkan Project">
			<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
				{error && <div className="sp-error">{error}</div>}

				<div
					style={{
						padding: '12px 14px',
						background: '#fff1f2',
						border: '1px solid #fecdd3',
						borderRadius: '8px',
						display: 'flex',
						gap: '10px',
						alignItems: 'flex-start'
					}}
				>
					<AlertTriangle size={18} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
					<div style={{ fontSize: '12.5px', color: '#9f1239', lineHeight: '1.45' }}>
						Apakah Anda yakin ingin menghapus project <strong>{project.name}</strong> (<code>{project.code}</code>)?
					</div>
				</div>

				<div
					style={{
						padding: '10px 12px',
						background: '#f8fafc',
						border: '1px solid #e2e8f0',
						borderRadius: '8px',
						fontSize: '11.5px',
						color: '#475569',
						lineHeight: '1.4'
					}}
				>
					<strong>Protective Hybrid Deletion:</strong> Jika project ini sudah memiliki data test case atau riwayat rekaman sesi, sistem akan otomatis melakukan <em>Soft Deactivation</em> (menonaktifkan project) agar riwayat log pengujian tetap aman tersimpan. Jika project masih kosong/steril, data akan dihapus secara permanen.
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
					<Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button
						type="button"
						variant="danger"
						size="sm"
						onClick={handleConfirm}
						disabled={busy}
						icon={<Trash2 size={13} />}
					>
						{busy ? 'Memproses...' : 'Ya, Hapus Project'}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
