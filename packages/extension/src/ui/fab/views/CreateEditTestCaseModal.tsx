import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Combobox } from '../components/Combobox';
import { Button } from '../components/Button';
import type { TestCaseItem, ProgramItem } from '../../../recording/apiClient';

export interface CreateEditTestCaseModalProps {
	isOpen: boolean;
	initialData?: TestCaseItem | null;
	projectName: string;
	programs?: ProgramItem[];
	onClose: () => void;
	onSave: (data: Partial<TestCaseItem> & { test_case_id: string; title: string }) => Promise<void>;
}

export const CreateEditTestCaseModal: React.FC<CreateEditTestCaseModalProps> = ({
	isOpen,
	initialData,
	projectName,
	programs = [],
	onClose,
	onSave
}) => {
	const [idProgram, setIdProgram] = useState<number | ''>('');
	const [testCaseId, setTestCaseId] = useState('');
	const [title, setTitle] = useState('');
	const [scenario, setScenario] = useState('');
	const [testDate, setTestDate] = useState('');
	const [feature, setFeature] = useState('');
	const [testType, setTestType] = useState<'+' | '-'>('+');
	const [preCondition, setPreCondition] = useState('');
	const [expectedResult, setExpectedResult] = useState('');
	const [status, setStatus] = useState('Progress');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialData) {
			setIdProgram(initialData.id_program ?? '');
			setTestCaseId(initialData.test_case_id ?? '');
			setTitle(initialData.title ?? '');
			setScenario(initialData.scenario ?? '');
			setTestDate(initialData.test_date ?? '');
			setFeature(initialData.feature ?? '');
			setTestType(initialData.test_type === '-' ? '-' : '+');
			setPreCondition(initialData.pre_condition ?? '');
			setExpectedResult(initialData.expected_result ?? '');
			setStatus(initialData.status ?? 'Progress');
		} else {
			setIdProgram('');
			setTestCaseId('');
			setTitle('');
			setScenario('');
			setTestDate('');
			setFeature('');
			setTestType('+');
			setPreCondition('');
			setExpectedResult('');
			setStatus('Progress');
		}
		setError(null);
	}, [initialData, isOpen]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!testCaseId.trim() || !title.trim() || busy) return;

		setBusy(true);
		setError(null);
		try {
			await onSave({
				id_program: typeof idProgram === 'number' && idProgram > 0 ? idProgram : null,
				test_case_id: testCaseId.trim(),
				title: title.trim(),
				// Saat edit, string kosong mengosongkan kolom; saat tambah cukup dihilangkan.
				scenario: scenario.trim() || (initialData ? '' : undefined),
				test_date: testDate.trim() || (initialData ? '' : undefined),
				feature: feature.trim() || undefined,
				test_type: testType,
				pre_condition: preCondition.trim() || undefined,
				expected_result: expectedResult.trim() || undefined,
				status
			});
			onClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal menyimpan test case.');
		} finally {
			setBusy(false);
		}
	};

	const programOptions = [
		{ value: '', label: '-- Tanpa Program Spesifik / Umum --' },
		...programs.map((prog) => ({
			value: prog.id_program,
			label: `${prog.name} (${prog.code})`,
			code: prog.type || 'FRONTEND',
			sublabel: prog.base_url || undefined
		}))
	];

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={initialData ? `Edit Test Case — ${projectName}` : `Tambah Test Case — ${projectName}`}
		>
			<form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
				{error && <div className="sp-error">{error}</div>}

				{/* Section 1: Identifikasi */}
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
					<div
						style={{
							fontSize: '11px',
							fontWeight: 700,
							color: '#2F3574',
							textTransform: 'uppercase',
							letterSpacing: '0.5px',
							borderBottom: '1px solid #f1f5f9',
							paddingBottom: '6px',
							marginBottom: '2px'
						}}
					>
						Identifikasi Test Case
					</div>

					{programs.length > 0 && (
						<Combobox
							label="Master Program Target (Opsional)"
							placeholder="-- Tanpa Program Spesifik / Umum --"
							searchPlaceholder="Cari program..."
							value={idProgram}
							onChange={(val) => setIdProgram(val ? Number(val) : '')}
							options={programOptions}
							disabled={busy}
						/>
					)}

					<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
						<div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
							<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
								Tipe Test <span style={{ color: '#ef4444' }}>*</span>
							</label>
							<div
								style={{
									display: 'grid',
									gridTemplateColumns: '1fr 1fr',
									gap: '3px',
									background: '#f1f5f9',
									padding: '3px',
									borderRadius: '8px',
									border: '1px solid #e2e8f0'
								}}
							>
								<button
									type="button"
									onClick={() => setTestType('+')}
									style={{
										padding: '6px 0',
										borderRadius: '6px',
										border: 'none',
										fontSize: '11px',
										fontWeight: testType === '+' ? 700 : 500,
										background: testType === '+' ? '#16a34a' : 'transparent',
										color: testType === '+' ? '#ffffff' : '#64748b',
										cursor: 'pointer',
										boxShadow: testType === '+' ? '0 1px 2px rgba(22,163,74,0.3)' : 'none',
										transition: 'all 0.15s ease'
									}}
								>
									+ Positif
								</button>
								<button
									type="button"
									onClick={() => setTestType('-')}
									style={{
										padding: '6px 0',
										borderRadius: '6px',
										border: 'none',
										fontSize: '11px',
										fontWeight: testType === '-' ? 700 : 500,
										background: testType === '-' ? '#dc2626' : 'transparent',
										color: testType === '-' ? '#ffffff' : '#64748b',
										cursor: 'pointer',
										boxShadow: testType === '-' ? '0 1px 2px rgba(220,38,38,0.3)' : 'none',
										transition: 'all 0.15s ease'
									}}
								>
									- Negatif
								</button>
							</div>
						</div>
						<div style={{ flex: 1 }}>
							<Input
								label="Test Case ID"
								required
								placeholder="Contoh: TC-ORDER-01"
								value={testCaseId}
								onChange={(e) => setTestCaseId(e.target.value)}
								disabled={busy}
							/>
						</div>
					</div>

					<Input
						label="Fitur / Modul"
						placeholder="Contoh: Order Kain, Checkout, Auth"
						value={feature}
						onChange={(e) => setFeature(e.target.value)}
						disabled={busy}
					/>

					<Input
						label="Scenario"
						placeholder="Contoh: Menguji edit order perubahan qty"
						value={scenario}
						onChange={(e) => setScenario(e.target.value)}
						disabled={busy}
					/>

					<Input
						label="Test Case (Judul)"
						required
						placeholder="Contoh: User dapat melakukan order kain sampai checkout"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						disabled={busy}
					/>

					<Input
						label="Date"
						placeholder="Contoh: 19/09/24"
						value={testDate}
						onChange={(e) => setTestDate(e.target.value)}
						disabled={busy}
					/>
				</div>

				{/* Section 2: Spesifikasi & Hasil */}
				<div
					style={{
						border: '1px solid #cbd5e1',
						borderRadius: '10px',
						padding: '14px',
						background: '#f8fafc',
						display: 'flex',
						flexDirection: 'column',
						gap: '12px',
						boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
					}}
				>
					<div
						style={{
							fontSize: '11px',
							fontWeight: 700,
							color: '#475569',
							textTransform: 'uppercase',
							letterSpacing: '0.5px',
							borderBottom: '1px solid #e2e8f0',
							paddingBottom: '6px',
							marginBottom: '2px'
						}}
					>
						Spesifikasi & Validasi
					</div>

					<Textarea
						label="Pre-Condition (Prasyarat)"
						placeholder="Contoh: User sudah login dan keranjang kosong"
						value={preCondition}
						onChange={(e) => setPreCondition(e.target.value)}
						rows={2}
						disabled={busy}
					/>

					<Textarea
						label="Expected Result (Hasil yang Diharapkan)"
						placeholder="Contoh: Muncul toast order berhasil dibuat dan dialihkan ke detail invoice"
						value={expectedResult}
						onChange={(e) => setExpectedResult(e.target.value)}
						rows={2}
						disabled={busy}
					/>

					{/* Modern Status Selector */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
							Status Test Case <span style={{ color: '#ef4444' }}>*</span>
						</label>
						<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
							{[
								{ key: 'Progress', label: 'Progress', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
								{ key: 'Passed', label: 'Passed', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
								{ key: 'Failed', label: 'Failed', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
								{ key: 'Re-Test', label: 'Re-Test', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
								{ key: 'Skip', label: 'Skip', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }
							].map((st) => {
								const isSelected = status.toLowerCase() === st.key.toLowerCase();
								return (
									<button
										key={st.key}
										type="button"
										onClick={() => setStatus(st.key)}
										disabled={busy}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '6px',
											padding: '6px 12px',
											borderRadius: '8px',
											fontSize: '12px',
											fontWeight: isSelected ? 700 : 500,
											cursor: 'pointer',
											background: isSelected ? st.bg : '#ffffff',
											border: `1.5px solid ${isSelected ? st.color : '#cbd5e1'}`,
											color: isSelected ? st.color : '#475569',
											boxShadow: isSelected ? `0 1px 3px ${st.color}25` : 'none',
											transition: 'all 0.15s ease'
										}}
									>
										<span
											style={{
												width: '8px',
												height: '8px',
												borderRadius: '50%',
												background: isSelected ? st.color : '#94a3b8'
											}}
										/>
										<span>{st.label}</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
					<Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
						Batal
					</Button>
					<Button type="submit" variant="primary" size="sm" loading={busy} disabled={busy || !testCaseId.trim() || !title.trim()}>
						{busy ? 'Menyimpan...' : 'Simpan Test Case'}
					</Button>
				</div>
			</form>
		</Modal>
	);
};
