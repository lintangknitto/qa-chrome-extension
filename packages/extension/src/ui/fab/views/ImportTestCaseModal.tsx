import React, { useState } from 'react';
import {
	Upload,
	CheckCircle,
	AlertTriangle,
	Globe,
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
	parseSpreadsheetFile,
	type ParsedImportTestCase,
	type ParseSpreadsheetResult,
	type GoogleSpreadsheetInfo
} from '../../../recording/spreadsheetParser';

export interface ImportTestCaseModalProps {
	isOpen: boolean;
	projectName: string;
	onClose: () => void;
	onImport: (items: ParsedImportTestCase[]) => Promise<void>;
}

export const ImportTestCaseModal: React.FC<ImportTestCaseModalProps> = ({
	isOpen,
	projectName,
	onClose,
	onImport
}) => {
	const [activeTab, setActiveTab] = useState<'link' | 'file'>('link');
	const [sheetUrl, setSheetUrl] = useState('');
	const [detectedInfo, setDetectedInfo] = useState<GoogleSpreadsheetInfo | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [parsing, setParsing] = useState(false);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [parseResult, setParseResult] = useState<ParseSpreadsheetResult | null>(null);

	const handleUrlChange = (val: string) => {
		setSheetUrl(val);
		setError(null);
		setParseResult(null);
		const info = extractGoogleSpreadsheetInfo(val);
		setDetectedInfo(info);
	};

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

	const handleFileChange = async (selectedFile: File) => {
		setError(null);
		setParseResult(null);
		setFile(selectedFile);
		setParsing(true);

		try {
			const buffer = await selectedFile.arrayBuffer();
			const result = await parseSpreadsheetFile(buffer);
			if (result.items.length === 0) {
				setError('Tidak ada baris test case yang valid ditemukan pada file tersebut.');
			} else {
				setParseResult(result);
			}
		} catch (err) {
			setError((err as Error).message || 'Gagal membaca file spreadsheet.');
		} finally {
			setParsing(false);
		}
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			void handleFileChange(e.dataTransfer.files[0]);
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
		setFile(null);
		setParseResult(null);
		setError(null);
		onClose();
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title={`Import Test Case — ${projectName}`}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
				{/* Segmented Control Mode Import */}
				<div className="k-segmented" style={{ width: '100%' }}>
					<button
						type="button"
						className={`k-segmented-btn ${activeTab === 'link' ? 'active' : ''}`}
						style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
						onClick={() => {
							setActiveTab('link');
							setError(null);
						}}
					>
						<Globe size={14} />
						<span>Link Google Spreadsheet</span>
					</button>
					<button
						type="button"
						className={`k-segmented-btn ${activeTab === 'file' ? 'active' : ''}`}
						style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
						onClick={() => {
							setActiveTab('file');
							setError(null);
						}}
					>
						<Upload size={14} />
						<span>Upload File (.xlsx / .csv)</span>
					</button>
				</div>

				{/* Tab 1: Link Google Spreadsheet */}
				{activeTab === 'link' && (
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
				)}

				{/* Tab 2: Upload File Local */}
				{activeTab === 'file' && (
					<div
						onDragOver={(e) => e.preventDefault()}
						onDrop={handleDrop}
						style={{
							border: '2px dashed #94a3b8',
							borderRadius: '10px',
							padding: '24px 16px',
							textAlign: 'center',
							cursor: 'pointer',
							background: file ? '#f0fdf4' : '#f8fafc',
							transition: 'all 0.2s ease',
							boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
						}}
						onClick={() => {
							const input = document.createElement('input');
							input.type = 'file';
							input.accept = '.xlsx, .xls, .csv';
							input.onchange = (e) => {
								const files = (e.target as HTMLInputElement).files;
								if (files && files[0]) void handleFileChange(files[0]);
							};
							input.click();
						}}
					>
						<Upload size={32} style={{ margin: '0 auto 8px', color: '#2F3574' }} />
						<div style={{ fontWeight: 600, color: '#0f172a' }}>
							{file ? file.name : 'Klik atau seret file spreadsheet ke sini'}
						</div>
						<div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
							Mendukung .xlsx, .xls, dan .csv
						</div>
					</div>
				)}

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
							{activeTab === 'link' && detectedInfo
								? `Sheet GID: ${detectedInfo.gid} · Header di baris ke-${parseResult.headerRowIndex + 1}`
								: `Sheet: ${parseResult.sheetName ?? 'Default'} · Header di baris ke-${parseResult.headerRowIndex + 1}`}
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
