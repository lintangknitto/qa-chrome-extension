import React, { useState, useEffect, useCallback } from 'react';
import {
	CheckCircle,
	AlertTriangle,
	Link2,
	Download,
	Info
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
	extractGoogleSpreadsheetInfo,
	fetchGoogleSpreadsheetCsv,
	parseSpreadsheetCsv,
	TOTAL_KNOWN_COLUMNS,
	type ParsedImportTestCase,
	type ParseSpreadsheetResult,
	type GoogleSpreadsheetInfo
} from '../../../recording/spreadsheetParser';

export interface ImportTestCaseModalProps {
	isOpen: boolean;
	projectName: string;
	prefillUrl?: string;
	onClose: () => void;
	onImport: (items: ParsedImportTestCase[]) => Promise<void>;
}

export const ImportTestCaseModal: React.FC<ImportTestCaseModalProps> = ({
	isOpen,
	projectName,
	prefillUrl,
	onClose,
	onImport
}) => {
	const [sheetUrl, setSheetUrl] = useState('');
	const [detectedInfo, setDetectedInfo] = useState<GoogleSpreadsheetInfo | null>(null);
	const [parsing, setParsing] = useState(false);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [parseResult, setParseResult] = useState<ParseSpreadsheetResult | null>(null);

	const handleUrlChange = useCallback((val: string) => {
		setSheetUrl(val);
		setError(null);
		setParseResult(null);
		const info = extractGoogleSpreadsheetInfo(val);
		setDetectedInfo(info);
	}, []);

	// Prefill URL ketika modal dibuka dengan prefillUrl prop
	useEffect(() => {
		if (isOpen && prefillUrl) {
			handleUrlChange(prefillUrl);
		}
	}, [isOpen, prefillUrl, handleUrlChange]);

	const handleFetchGoogleSheet = async () => {
		if (!detectedInfo) {
			setError('Format link Google Spreadsheet tidak valid. Pastikan link berisi /spreadsheets/d/...');
			return;
		}

		setError(null);
		setParseResult(null);
		setParsing(true);

		try {
			const csvText = await fetchGoogleSpreadsheetCsv(detectedInfo.exportUrl);
			const result = parseSpreadsheetCsv(csvText);
			if (result.items.length === 0) {
				setError('Tidak ada baris test case valid ditemukan pada sheet tersebut.');
			} else {
				setParseResult(result);
			}
		} catch (err) {
			setError((err as Error).message || 'Gagal mengambil data dari Google Spreadsheet.');
		} finally {
			setParsing(false);
		}
	};

	const handleSubmit = async () => {
		if (!parseResult || parseResult.items.length === 0 || importing) return;
		setImporting(true);
		setError(null);

		try {
			await onImport(parseResult.items);
			handleClose();
		} catch (err) {
			setError((err as Error).message || 'Gagal mengimpor data test case.');
		} finally {
			setImporting(false);
		}
	};

	const handleClose = () => {
		setSheetUrl('');
		setDetectedInfo(null);
		setParseResult(null);
		setError(null);
		onClose();
	};

	const detectedColumnNames = parseResult ? Object.keys(parseResult.detectedColumns) : [];
	const detectedCount = detectedColumnNames.length;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title={`Import Test Case — ${projectName}`}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
				{/* Input URL Google Spreadsheet */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
					<Input
						label="URL Google Spreadsheet"
						icon={<Link2 size={14} />}
						value={sheetUrl}
						placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=1730053292#gid=1730053292"
						onChange={(e) => handleUrlChange(e.target.value)}
						helperText={
							detectedInfo
								? `✓ Sheet GID terdeteksi: ${detectedInfo.gid} (Siap diunduh)`
								: 'Salin dan tempel URL langsung dari browser saat membuka sheet test case Anda.'
						}
					/>

					{/* Info Persyaratan Akses */}
					<div
						style={{
							padding: '10px 12px',
							background: '#f8fafc',
							border: '1px solid #cbd5e1',
							borderRadius: '8px',
							fontSize: '12px',
							color: '#334155',
							display: 'flex',
							flexDirection: 'column',
							gap: '4px'
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1e293b' }}>
							<Info size={14} color="#2563eb" />
							<span>Persyaratan Akses Publik (Read-Only)</span>
						</div>
						<div style={{ color: '#475569', lineHeight: 1.4 }}>
							1. Di Google Sheets, klik menu <strong>Bagikan / Share</strong> lalu pilih{' '}
							<strong>"Siapa saja yang memiliki link"</strong> dengan izin <strong>Pelihat (Viewer)</strong>.
						</div>
						<div style={{ color: '#475569', lineHeight: 1.4 }}>
							2. Parameter <code>gid</code> pada link memastikan ekstensi membaca tab sheet yang tepat secara spesifik.
						</div>
					</div>

					<div>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<Download size={14} />}
							loading={parsing}
							disabled={!detectedInfo || parsing}
							onClick={handleFetchGoogleSheet}
						>
							{parsing ? 'Mengunduh & Membaca Spreadsheet...' : 'Tarik Data Spreadsheet'}
						</Button>
					</div>
				</div>

				{/* Error Box */}
				{error && (
					<div
						className="sp-error"
						style={{
							padding: '10px 12px',
							borderRadius: '8px',
							background: '#fef2f2',
							color: '#b91c1c',
							border: '1px solid #fecaca',
							display: 'flex',
							alignItems: 'flex-start',
							gap: '8px',
							lineHeight: 1.4
						}}
					>
						<AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
						<span>{error}</span>
					</div>
				)}

				{/* Parse Result Preview */}
				{parseResult && (
					<div
						style={{
							background: '#f0fdf4',
							border: '1px solid #86efac',
							borderRadius: '10px',
							padding: '14px',
							boxShadow: '0 1px 3px rgba(22, 163, 74, 0.08)'
						}}
					>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								fontWeight: 600,
								color: '#15803d'
							}}
						>
							<CheckCircle size={16} />
							<span>Ditemukan {parseResult.items.length} skenario test case valid!</span>
						</div>
						<div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
							{`Sheet GID: ${detectedInfo?.gid ?? '-'} · Header di baris ke-${parseResult.headerRowIndex + 1}`}
						</div>

						{/* Kolom Terdeteksi & Confidence */}
						<div
							style={{
								marginTop: '10px',
								padding: '10px 12px',
								background: '#ffffff',
								borderRadius: '8px',
								border: '1px solid #bbf7d0'
							}}
						>
							<div
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									marginBottom: '8px'
								}}
							>
								<span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
									Kolom Terdeteksi
								</span>
								<span
									style={{
										fontSize: '11px',
										fontWeight: 700,
										padding: '2px 8px',
										borderRadius: '10px',
										background: detectedCount >= 8 ? '#dcfce7' : detectedCount >= 4 ? '#fef9c3' : '#fee2e2',
										color: detectedCount >= 8 ? '#15803d' : detectedCount >= 4 ? '#92400e' : '#b91c1c'
									}}
								>
									{detectedCount} / {TOTAL_KNOWN_COLUMNS} kolom dikenali
								</span>
							</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
								{detectedColumnNames.map((col) => (
									<span
										key={col}
										style={{
											fontSize: '10px',
											fontWeight: 600,
											padding: '2px 7px',
											borderRadius: '4px',
											background: '#dcfce7',
											color: '#15803d',
											border: '1px solid #bbf7d0'
										}}
									>
										✓ {col}
									</span>
								))}
							</div>
						</div>

						{/* Preview Data Table */}
						<div
							style={{
								marginTop: '10px',
								maxHeight: '140px',
								overflowY: 'auto',
								fontSize: '11px',
								background: '#ffffff',
								borderRadius: '8px',
								border: '1px solid #cbd5e1',
								padding: '8px 10px'
							}}
						>
							{parseResult.items.slice(0, 5).map((item, idx) => (
								<div
									key={idx}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '8px',
										padding: '4px 0',
										borderBottom: idx < Math.min(parseResult.items.length, 5) - 1 ? '1px solid #f1f5f9' : 'none'
									}}
								>
									<span style={{ fontWeight: 600, color: '#0f172a', minWidth: '75px' }}>
										{item.test_case_id}
									</span>
									<span
										style={{
											color: '#475569',
											flex: 1,
											textOverflow: 'ellipsis',
											overflow: 'hidden',
											whiteSpace: 'nowrap'
										}}
									>
										{item.title}
									</span>
									<span
										style={{
											color: item.test_type === '-' ? '#dc2626' : '#16a34a',
											fontWeight: 600,
											fontSize: '11px'
										}}
									>
										[{item.test_type}]
									</span>
									<span
										style={{
											fontSize: '10px',
											padding: '1px 6px',
											borderRadius: '4px',
											background:
												item.status === 'Passed'
													? '#dcfce7'
													: item.status === 'Failed'
														? '#fee2e2'
														: '#e0f2fe',
											color:
												item.status === 'Passed'
													? '#15803d'
													: item.status === 'Failed'
														? '#b91c1c'
														: '#0369a1',
											fontWeight: 600
										}}
									>
										{item.status}
									</span>
								</div>
							))}
							{parseResult.items.length > 5 && (
								<div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: '6px', fontSize: '11px' }}>
									...dan {parseResult.items.length - 5} skenario test case lainnya
								</div>
							)}
						</div>
					</div>
				)}

				{/* Modal Footer */}
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
					<Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={importing}>
						Batal
					</Button>
					<Button
						type="button"
						variant="primary"
						size="sm"
						loading={importing}
						onClick={handleSubmit}
						disabled={!parseResult || parseResult.items.length === 0 || importing}
					>
						{importing ? 'Mengimpor...' : `Import ${parseResult ? parseResult.items.length : ''} Test Case`}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
