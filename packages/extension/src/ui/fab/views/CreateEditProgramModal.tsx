import React, { useState, useEffect } from 'react';
import type { ProgramItem } from '../../../recording/apiClient';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Switch } from '../components/Switch';
import { Layers, Globe, FileText, CheckCircle2, Lock, Server, Activity } from 'lucide-react';

export interface CreateEditProgramModalProps {
	isOpen: boolean;
	onClose: () => void;
	program?: ProgramItem | null;
	onSave: (data: {
		name: string;
		code?: string;
		type?: 'FRONTEND' | 'SERVICE';
		grafana_dashboard_url?: string;
		base_url?: string;
		repo_url?: string;
		description?: string;
		is_active?: boolean;
	}) => Promise<void>;
}

export const CreateEditProgramModal: React.FC<CreateEditProgramModalProps> = ({
	isOpen,
	onClose,
	program,
	onSave
}) => {
	const isEditMode = Boolean(program);

	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [type, setType] = useState<'FRONTEND' | 'SERVICE'>('FRONTEND');
	const [grafanaDashboardUrl, setGrafanaDashboardUrl] = useState('');
	const [baseUrl, setBaseUrl] = useState('');
	const [repoUrl, setRepoUrl] = useState('');
	const [description, setDescription] = useState('');
	const [isActive, setIsActive] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			if (program) {
				setName(program.name || '');
				setCode(program.code || '');
				setType(program.type === 'SERVICE' ? 'SERVICE' : 'FRONTEND');
				setGrafanaDashboardUrl(program.grafana_dashboard_url || '');
				setBaseUrl(program.base_url || '');
				setRepoUrl(program.repo_url || '');
				setDescription(program.description || '');
				setIsActive(program.is_active !== false);
			} else {
				setName('');
				setCode('');
				setType('FRONTEND');
				setGrafanaDashboardUrl('');
				setBaseUrl('');
				setRepoUrl('');
				setDescription('');
				setIsActive(true);
			}
			setError(null);
			setBusy(false);
		}
	}, [isOpen, program]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || busy) return;

		setBusy(true);
		setError(null);
		try {
			await onSave({
				name: name.trim(),
				code: code.trim() || undefined,
				type,
				grafana_dashboard_url: grafanaDashboardUrl.trim() || undefined,
				base_url: baseUrl.trim() || undefined,
				repo_url: repoUrl.trim() || undefined,
				description: description.trim() || undefined,
				is_active: isEditMode ? isActive : true
			});
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menyimpan data program.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEditMode ? 'Edit Master Program' : 'Tambah Master Program Baru'}
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
					{isEditMode && program?.code ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
							<label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
								KODE PROGRAM (KUNCI IDENTIFIER)
							</label>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									background: '#f8fafc',
									border: '1px solid #e2e8f0',
									padding: '8px 12px',
									borderRadius: '8px',
									color: '#64748b',
									fontSize: '13px',
									fontFamily: 'monospace'
								}}
							>
								<Lock size={14} color="#94a3b8" />
								<span>{program.code}</span>
							</div>
						</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
							<label htmlFor="program-code" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
								KODE PROGRAM (OPSIONAL)
							</label>
							<Input
								id="program-code"
								placeholder="contoh: knitto-portal (otomatis jika kosong)"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								disabled={busy}
							/>
						</div>
					)}

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label htmlFor="program-name" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
							NAMA PROGRAM <span style={{ color: '#ef4444' }}>*</span>
						</label>
						<div style={{ position: 'relative' }}>
							<Input
								id="program-name"
								placeholder="contoh: Knitto Portal"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								disabled={busy}
							/>
						</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
							TIPE PROGRAM <span style={{ color: '#ef4444' }}>*</span>
						</label>
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
							<button
								type="button"
								onClick={() => setType('FRONTEND')}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									padding: '10px 12px',
									borderRadius: '8px',
									border: `1.5px solid ${type === 'FRONTEND' ? '#2563eb' : '#e2e8f0'}`,
									background: type === 'FRONTEND' ? '#eff6ff' : '#f8fafc',
									color: type === 'FRONTEND' ? '#1e40af' : '#64748b',
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: '12px',
									textAlign: 'left'
								}}
							>
								<Globe size={16} color={type === 'FRONTEND' ? '#2563eb' : '#94a3b8'} />
								<div>
									<div>Frontend / UI</div>
									<div style={{ fontSize: '10px', fontWeight: 400, color: '#64748b' }}>Web App, Portal, Client</div>
								</div>
							</button>
							<button
								type="button"
								onClick={() => setType('SERVICE')}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									padding: '10px 12px',
									borderRadius: '8px',
									border: `1.5px solid ${type === 'SERVICE' ? '#9333ea' : '#e2e8f0'}`,
									background: type === 'SERVICE' ? '#faf5ff' : '#f8fafc',
									color: type === 'SERVICE' ? '#6b21a8' : '#64748b',
									cursor: 'pointer',
									fontWeight: 600,
									fontSize: '12px',
									textAlign: 'left'
								}}
							>
								<Server size={16} color={type === 'SERVICE' ? '#9333ea' : '#94a3b8'} />
								<div>
									<div>Service / Backend</div>
									<div style={{ fontSize: '10px', fontWeight: 400, color: '#64748b' }}>API, Worker, Timer</div>
								</div>
							</button>
						</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label htmlFor="program-base-url" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
							URL STAGING / BASE URL (OPSIONAL)
						</label>
						<Input
							id="program-base-url"
							placeholder="contoh: https://staging.portal.knitto.id"
							value={baseUrl}
							onChange={(e) => setBaseUrl(e.target.value)}
							disabled={busy}
						/>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label htmlFor="program-grafana-url" style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
							<Activity size={12} color="#f97316" /> GRAFANA DASHBOARD URL (OPSIONAL)
						</label>
						<Input
							id="program-grafana-url"
							placeholder="contoh: http://192.168.20.15:3800/d/portal-kpi"
							value={grafanaDashboardUrl}
							onChange={(e) => setGrafanaDashboardUrl(e.target.value)}
							disabled={busy}
						/>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label htmlFor="program-repo-url" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
							REPOSITORY GITHUB (OPSIONAL)
						</label>
						<Input
							id="program-repo-url"
							placeholder="contoh: https://github.com/knittotextile/knitto-portal"
							value={repoUrl}
							onChange={(e) => setRepoUrl(e.target.value)}
							disabled={busy}
						/>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						<label htmlFor="program-description" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
							DESKRIPSI (OPSIONAL)
						</label>
						<textarea
							id="program-description"
							placeholder="Deskripsi fungsi dan cakupan sistem aplikasi..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={busy}
							rows={3}
							style={{
								width: '100%',
								padding: '8px 12px',
								border: '1px solid #cbd5e1',
								borderRadius: '8px',
								fontSize: '13px',
								outline: 'none',
								fontFamily: 'inherit',
								resize: 'vertical',
								boxSizing: 'border-box'
							}}
						/>
					</div>

					{isEditMode && (
						<div
							style={{
								padding: '12px 14px',
								background: '#f8fafc',
								borderRadius: '8px',
								border: '1px solid #e2e8f0',
								marginTop: '4px'
							}}
						>
							<Switch
								checked={isActive}
								onChange={(val) => setIsActive(val)}
								disabled={busy}
								label={`Status Program: ${isActive ? 'Aktif' : 'Inaktif'}`}
								description={isActive ? 'Program aktif dan dapat dipilih di project' : 'Program dinonaktifkan'}
								activeColor="#10b981"
							/>
						</div>
					)}
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
					<Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button type="submit" variant="primary" disabled={busy || !name.trim()}>
						{busy ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Master Program'}
					</Button>
				</div>
			</form>
		</Modal>
	);
};
