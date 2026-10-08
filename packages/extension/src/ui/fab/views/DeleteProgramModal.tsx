import React, { useState } from 'react';
import type { ProgramItem } from '../../../recording/apiClient';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface DeleteProgramModalProps {
	isOpen: boolean;
	onClose: () => void;
	program: ProgramItem | null;
	onConfirmDelete: (program: ProgramItem) => Promise<void>;
}

export const DeleteProgramModal: React.FC<DeleteProgramModalProps> = ({
	isOpen,
	onClose,
	program,
	onConfirmDelete
}) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!program) return null;

	const handleConfirm = async () => {
		setBusy(true);
		setError(null);
		try {
			await onConfirmDelete(program);
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menghapus program.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Hapus / Nonaktifkan Master Program">
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
						Apakah Anda yakin ingin menghapus master program <strong>{program.name}</strong> (<code>{program.code}</code>)?
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
					<strong>Proteksi Integritas Data:</strong> Jika program ini masih memiliki project/skenario terkait, sistem akan otomatis melakukan <em>Soft Deactivation</em> (menonaktifkan program) agar relasi project tetap utuh. Jika program belum memiliki project terkait, data akan dihapus secara permanen.
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
						{busy ? 'Memproses...' : 'Ya, Hapus Program'}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
