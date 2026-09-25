import React from 'react';
import { FileSpreadsheet, Link2 } from 'lucide-react';

export interface EmptyStateTestCaseProps {
	onUseTemplate: () => void;
	onUseCustom: () => void;
}

export const EmptyStateTestCase: React.FC<EmptyStateTestCaseProps> = ({
	onUseTemplate,
	onUseCustom
}) => {
	return (
		<div
			style={{
				padding: '36px 20px',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: '20px'
			}}
		>
			{/* Heading */}
			<div style={{ textAlign: 'center' }}>
				<div
					style={{
						fontSize: '14px',
						fontWeight: 600,
						color: '#0f172a',
						marginBottom: '6px'
					}}
				>
					Belum ada test case di project ini
				</div>
				<div style={{ fontSize: '12px', color: '#64748b' }}>
					Mulai dengan memilih cara pengisian:
				</div>
			</div>

			{/* Dua Card CTA */}
			<div
				style={{
					display: 'flex',
					gap: '12px',
					width: '100%',
					maxWidth: '480px'
				}}
			>
				{/* Card kiri — Template Sistem */}
				<button
					type="button"
					onClick={onUseTemplate}
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '8px',
						padding: '20px 12px',
						borderRadius: '12px',
						border: '2px solid #2F3574',
						background: '#f8faff',
						cursor: 'pointer',
						transition: 'all 0.15s ease',
						textAlign: 'center'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = '#eef0ff';
						e.currentTarget.style.boxShadow = '0 4px 12px rgba(47, 53, 116, 0.12)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = '#f8faff';
						e.currentTarget.style.boxShadow = 'none';
					}}
				>
					<div
						style={{
							width: '40px',
							height: '40px',
							borderRadius: '10px',
							background: '#2F3574',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<FileSpreadsheet size={20} color="#ffffff" />
					</div>
					<div>
						<div
							style={{
								fontSize: '13px',
								fontWeight: 700,
								color: '#2F3574',
								marginBottom: '4px'
							}}
						>
							Template Sistem
						</div>
						<div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
							Pakai format spreadsheet standar Knitto yang sudah terbukti
						</div>
					</div>
				</button>

				{/* Card kanan — Struktur Sendiri */}
				<button
					type="button"
					onClick={onUseCustom}
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '8px',
						padding: '20px 12px',
						borderRadius: '12px',
						border: '2px solid #cbd5e1',
						background: '#f8fafc',
						cursor: 'pointer',
						transition: 'all 0.15s ease',
						textAlign: 'center'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.borderColor = '#94a3b8';
						e.currentTarget.style.background = '#f1f5f9';
						e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.borderColor = '#cbd5e1';
						e.currentTarget.style.background = '#f8fafc';
						e.currentTarget.style.boxShadow = 'none';
					}}
				>
					<div
						style={{
							width: '40px',
							height: '40px',
							borderRadius: '10px',
							background: '#e2e8f0',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<Link2 size={20} color="#475569" />
					</div>
					<div>
						<div
							style={{
								fontSize: '13px',
								fontWeight: 700,
								color: '#334155',
								marginBottom: '4px'
							}}
						>
							Struktur Sendiri
						</div>
						<div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
							Punya spreadsheet format lain? Sistem akan analisa kolom otomatis
						</div>
					</div>
				</button>
			</div>
		</div>
	);
};
