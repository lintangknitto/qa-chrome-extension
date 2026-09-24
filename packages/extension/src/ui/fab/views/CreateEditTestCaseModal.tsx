import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import type { TestCaseItem } from '../../../recording/apiClient';

export interface CreateEditTestCaseModalProps {
	isOpen: boolean;
	initialData?: TestCaseItem | null;
	projectName: string;
	onClose: () => void;
	onSave: (data: Partial<TestCaseItem> & { test_case_id: string; title: string }) => Promise<void>;
}

export const CreateEditTestCaseModal: React.FC<CreateEditTestCaseModalProps> = ({
	isOpen,
	initialData,
	projectName,
	onClose,
	onSave
}) => {
	const [testCaseId, setTestCaseId] = useState('');
	const [title, setTitle] = useState('');
	const [feature, setFeature] = useState('');
	const [testType, setTestType] = useState<'+' | '-'>('+');
	const [preCondition, setPreCondition] = useState('');
	const [expectedResult, setExpectedResult] = useState('');
	const [status, setStatus] = useState('Progress');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialData) {
			setTestCaseId(initialData.test_case_id ?? '');
			setTitle(initialData.title ?? '');
			setFeature(initialData.feature ?? '');
			setTestType(initialData.test_type === '-' ? '-' : '+');
			setPreCondition(initialData.pre_condition ?? '');
			setExpectedResult(initialData.expected_result ?? '');
			setStatus(initialData.status ?? 'Progress');
		} else {
			setTestCaseId('');
			setTitle('');
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
				test_case_id: testCaseId.trim(),
				title: title.trim(),
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
						gap: '10px',
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

					<div style={{ display: 'flex', gap: '10px' }}>
						<div style={{ flex: '0 0 120px' }}>
							<Select
								label="Tipe Test"
								value={testType}
								onChange={(e) => setTestType(e.target.value as '+' | '-')}
								options={[
									{ value: '+', label: '+ (Positive)' },
									{ value: '-', label: '- (Negative)' }
								]}
							/>
						</div>
						<div style={{ flex: 1 }}>
							<Input
								label="Test Case ID"
								required
								placeholder="Contoh: TC-ORDER-01"
								value={testCaseId}
								onChange={(e) => setTestCaseId(e.target.value)}
							/>
						</div>
					</div>

					<Input
						label="Fitur / Modul"
						placeholder="Contoh: Order Kain, Checkout, Auth"
						value={feature}
						onChange={(e) => setFeature(e.target.value)}
					/>

					<Input
						label="Judul Skenario / Test Case"
						required
						placeholder="Contoh: User dapat melakukan order kain sampai checkout"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
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
						gap: '10px',
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
					/>

					<Textarea
						label="Expected Result (Hasil yang Diharapkan)"
						placeholder="Contoh: Muncul toast order berhasil dibuat dan dialihkan ke detail invoice"
						value={expectedResult}
						onChange={(e) => setExpectedResult(e.target.value)}
						rows={2}
					/>

					<Select
						label="Status"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						options={[
							{ value: 'Progress', label: 'Progress' },
							{ value: 'Passed', label: 'Passed' },
							{ value: 'Failed', label: 'Failed' },
							{ value: 'Re-Test', label: 'Re-Test' },
							{ value: 'Skip', label: 'Skip' }
						]}
					/>
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
