import React, { useState, useEffect } from 'react';
import type { RecordingProject } from '../../../recording/apiClient';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { FolderKanban, Globe, FileText, CheckCircle2, Lock } from 'lucide-react';

export interface CreateEditProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	project?: RecordingProject | null;
	onSave: (data: {
		name: string;
		base_url?: string;
		description?: string;
		is_active?: boolean;
	}) => Promise<void>;
}

export const CreateEditProjectModal: React.FC<CreateEditProjectModalProps> = ({
	isOpen,
	onClose,
	project,
	onSave
}) => {
	const isEditMode = Boolean(project);

	const [name, setName] = useState('');
	const [baseUrl, setBaseUrl] = useState('');
	const [description, setDescription] = useState('');
	const [isActive, setIsActive] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			if (project) {
				setName(project.name || '');
				setBaseUrl(project.base_url || '');
				setDescription(project.description || '');
				setIsActive(project.is_active !== false);
			} else {
				setName('');
				setBaseUrl('');
				setDescription('');
				setIsActive(true);
			}
			setError(null);
			setBusy(false);
		}
	}, [isOpen, project]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || busy) return;

		setBusy(true);
		setError(null);
		try {
			await onSave({
				name: name.trim(),
				base_url: baseUrl.trim() || undefined,
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

					<Input
						label="Nama Project"
						required
						placeholder="Contoh: Portal Knitto E-Commerce"
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={busy}
						icon={<FolderKanban size={14} />}
					/>

					<Input
						label="Base Target URL"
						placeholder="https://app.knitto.co.id (Opsional)"
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
						disabled={busy}
						icon={<Globe size={14} />}
					/>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
							<FileText size={12} /> Deskripsi
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
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '10px 12px',
								background: '#f8fafc',
								borderRadius: '8px',
								border: '1px solid #e2e8f0'
							}}
						>
							<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
								<span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Status Project</span>
								<span style={{ fontSize: '11px', color: '#64748b' }}>
									{isActive ? 'Project aktif dan dapat dipilih di recorder' : 'Project dinonaktifkan'}
								</span>
							</div>
							<label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: isActive ? '#059669' : '#64748b' }}>
								<input
									type="checkbox"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									disabled={busy}
									style={{ cursor: 'pointer', width: 16, height: 16 }}
								/>
								<span>{isActive ? 'Aktif' : 'Inaktif'}</span>
							</label>
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
