import React from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from '../components/Button';
import { SimpleMarkdown } from '../components/SimpleMarkdown';
import type { GenerationItem } from './HistoryView';

/**
 * Hasil investigasi AI (rekaman + log Loki dashboard program + codebase memory).
 * Otomatis dibuat saat sesi FAIL/ada anomali; bisa dijalankan ulang manual.
 */
export const InvestigationPanel: React.FC<{
	generation?: GenerationItem;
	busy: boolean;
	onInvestigate: () => void;
}> = ({ generation, busy, onInvestigate }) => {
	const processing = busy || generation?.status === 'processing' || generation?.status === 'pending';

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<Search size={15} color="#2F3574" />
					<span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Investigasi Kegagalan</span>
				</div>
				<Button
					type="button"
					variant={generation ? 'secondary' : 'primary'}
					size="xs"
					loading={processing}
					disabled={processing}
					icon={<RefreshCw size={11} />}
					onClick={onInvestigate}
				>
					{generation ? 'Investigasi Ulang' : 'Investigasi'}
				</Button>
			</div>

			{processing ? (
				<div style={{ border: '1px dashed #93c5fd', borderRadius: 10, padding: '28px 16px', textAlign: 'center', background: '#eff6ff' }}>
					<RefreshCw size={28} color="#2563eb" style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
					<div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>Mengumpulkan log server & menganalisis...</div>
					<div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
						Mencocokkan request gagal dengan log Loki dari dashboard program, lalu AI menyusun dugaan akar masalah.
					</div>
				</div>
			) : generation?.status === 'failed' ? (
				<div style={{ border: '1px dashed #fca5a5', borderRadius: 10, padding: '18px 14px', background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>
					<AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
					Investigasi gagal: {generation.error_message || 'kesalahan tidak diketahui'}
				</div>
			) : generation?.output ? (
				<div
					data-testid="investigation-report"
					style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', background: '#ffffff', maxHeight: 420, overflowY: 'auto' }}
				>
					<SimpleMarkdown source={generation.output} />
				</div>
			) : (
				<div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
					Belum ada investigasi. Investigasi berjalan otomatis bila sesi FAIL/BLOCKED atau ada request gagal/console error; klik
					“Investigasi” untuk menjalankannya sekarang.
				</div>
			)}
		</div>
	);
};
