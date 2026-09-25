import React, { useState } from 'react';
import {
	RotateCw,
	Cookie,
	Database,
	Zap,
	AlertTriangle,
	Globe,
	Sparkles,
	ShieldAlert
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
	parseTabDomain,
	requestHardReload,
	requestClearCookies,
	requestClearStorageAndCache,
	requestCleanAll
} from '../../../recording/cleanerService';

export interface CleanerViewProps {
	activeTabUrl?: string;
	isRecordingActive: boolean;
	onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CleanerView: React.FC<CleanerViewProps> = ({
	activeTabUrl,
	isRecordingActive,
	onShowToast
}) => {
	const currentUrl = activeTabUrl ?? (typeof window !== 'undefined' ? window.location?.href : '');
	const parsed = parseTabDomain(currentUrl);
	const [busyAction, setBusyAction] = useState<string | null>(null);

	const isActionDisabled = parsed.isRestricted || isRecordingActive || !!busyAction;

	// Handler 1: Bersihkan Semua Sekaligus
	const handleCleanAll = async () => {
		if (isActionDisabled) return;
		setBusyAction('cleanAll');
		try {
			const res = await requestCleanAll(parsed.rawUrl);
			if (res.success) {
				onShowToast('Seluruh cache, cookies, dan storage berhasil dibersihkan! Halaman dimuat ulang.', 'success');
			} else {
				onShowToast(res.error || 'Gagal membersihkan data.', 'error');
			}
		} catch (err) {
			onShowToast((err as Error).message || 'Terjadi kesalahan sistem saat membersihkan data.', 'error');
		} finally {
			setBusyAction(null);
		}
	};

	// Handler 2: Hard Reload
	const handleHardReload = async () => {
		if (isActionDisabled) return;
		setBusyAction('hardReload');
		try {
			const res = await requestHardReload();
			if (res.success) {
				onShowToast('Halaman berhasil dimuat ulang tanpa cache (bypass cache).', 'success');
			} else {
				onShowToast(res.error || 'Gagal memuat ulang halaman.', 'error');
			}
		} catch (err) {
			onShowToast((err as Error).message || 'Terjadi kesalahan saat reload.', 'error');
		} finally {
			setBusyAction(null);
		}
	};

	// Handler 3: Clear Cookies & LocalStorage
	const handleClearCookiesAndStorage = async () => {
		if (isActionDisabled) return;
		setBusyAction('cookiesAndStorage');
		try {
			const [cookieRes, storageRes] = await Promise.all([
				requestClearCookies(parsed.rawUrl),
				parsed.origin ? requestClearStorageAndCache(parsed.origin) : Promise.resolve<{ success: boolean; error?: string }>({ success: true })
			]);

			if (cookieRes.success && storageRes.success) {
				const cookieText = typeof cookieRes.count === 'number' ? ` (${cookieRes.count} cookies)` : '';
				onShowToast(`Cookies${cookieText} dan LocalStorage untuk domain ini berhasil dibersihkan.`, 'success');
			} else {
				const errorMsg = cookieRes.error || storageRes.error || 'Gagal membersihkan cookies atau storage.';
				onShowToast(errorMsg, 'error');
			}
		} catch (err) {
			onShowToast((err as Error).message || 'Terjadi kesalahan saat membersihkan data.', 'error');
		} finally {
			setBusyAction(null);
		}
	};

	// Handler 4: Unregister Service Worker & PWA Cache
	const handleClearWorkerAndCache = async () => {
		if (isActionDisabled) return;
		setBusyAction('workerAndCache');
		try {
			if (!parsed.origin) {
				onShowToast('Origin domain tidak valid.', 'error');
				return;
			}
			const res = await requestClearStorageAndCache(parsed.origin);
			if (res.success) {
				onShowToast('Service Worker dan CacheStorage PWA berhasil dicabut & dibersihkan.', 'success');
			} else {
				onShowToast(res.error || 'Gagal mencabut Service Worker & CacheStorage.', 'error');
			}
		} catch (err) {
			onShowToast((err as Error).message || 'Terjadi kesalahan saat membersihkan Service Worker.', 'error');
		} finally {
			setBusyAction(null);
		}
	};

	return (
		<div className="cleaner-view" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			{/* Domain Info Header Card */}
			<Card style={{ padding: 14 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
						<Globe size={16} color="#2F3574" style={{ flexShrink: 0 }} />
						<span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{parsed.hostname || 'Tidak ada domain aktif'}
						</span>
					</div>
					{parsed.isRestricted ? (
						<Badge variant="warning">Sistem</Badge>
					) : (
						<Badge variant="success">Domain Aktif</Badge>
					)}
				</div>
				<div className="sp-muted" style={{ fontSize: 11, wordBreak: 'break-all' }}>
					{parsed.rawUrl ? parsed.rawUrl : 'Buka halaman web yang ingin diuji untuk menggunakan Cleaner.'}
				</div>
			</Card>

			{/* Guard Warning 1: Restricted URL */}
			{parsed.isRestricted && (
				<div
					className="sp-banner sp-banner-warning"
					role="alert"
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 10,
						padding: '10px 12px',
						background: '#fffbeb',
						border: '1px solid #fde68a',
						borderRadius: 8,
						color: '#92400e',
						fontSize: 12
					}}
				>
					<AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
					<div>
						<div style={{ fontWeight: 600 }}>Halaman sistem browser tidak dapat dibersihkan</div>
						<div style={{ marginTop: 2, opacity: 0.9 }}>
							Browser melarang modifikasi data pada halaman sistem internal ({parsed.hostname || 'chrome://, about:blank, dsb'}).
						</div>
					</div>
				</div>
			)}

			{/* Guard Warning 2: Active Recording Session */}
			{isRecordingActive && (
				<div
					className="sp-banner sp-banner-danger"
					role="alert"
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 10,
						padding: '10px 12px',
						background: '#fef2f2',
						border: '1px solid #fecaca',
						borderRadius: 8,
						color: '#991b1b',
						fontSize: 12
					}}
				>
					<ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2, color: '#dc2626' }} />
					<div>
						<div style={{ fontWeight: 600 }}>Sesi recording sedang berjalan</div>
						<div style={{ marginTop: 2, opacity: 0.9 }}>
							Selesaikan atau batalkan sesi rekaman terlebih dahulu sebelum membersihkan data untuk menghindari gangguan pada jalannya perekaman.
						</div>
					</div>
				</div>
			)}

			{/* Quick Action: Bersihkan Semua Sekaligus */}
			<div
				className="cleaner-quick-card k-card"
				style={{
					padding: 14,
					background: 'linear-gradient(135deg, #f0f2fb 0%, #e2e8f0 100%)',
					border: '1px solid #c7d2fe',
					borderRadius: 10
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
					<Sparkles size={16} color="#2F3574" />
					<span style={{ fontWeight: 700, fontSize: 13, color: '#1e1b4b' }}>
						Quick Cleaner
					</span>
				</div>
				<div className="sp-muted" style={{ fontSize: 11, marginBottom: 12, color: '#475569' }}>
					Hapus seluruh cache, cookies, local storage, dan service worker domain ini sekaligus lalu muat ulang halaman.
				</div>
				<Button
					variant="primary"
					size="md"
					style={{ width: '100%' }}
					icon={<Zap size={14} />}
					loading={busyAction === 'cleanAll'}
					disabled={isActionDisabled}
					onClick={handleCleanAll}
				>
					⚡ Bersihkan Semua Sekaligus
				</Button>
			</div>

			{/* Section Header: Aksi Mandiri */}
			<div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
				Aksi Mandiri
			</div>

			{/* Card 1: Empty Cache & Hard Reload */}
			<Card style={{ padding: 14 }}>
				<CardHeader style={{ padding: 0, marginBottom: 8 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<RotateCw size={15} color="#2F3574" />
						<CardTitle style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
							Empty Cache & Hard Reload
						</CardTitle>
					</div>
					<CardDescription style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
						Bypass seluruh cache browser untuk tab ini dan refresh halaman secara bersih.
					</CardDescription>
				</CardHeader>
				<CardContent style={{ padding: 0, marginTop: 8 }}>
					<Button
						variant="outline"
						size="sm"
						icon={<RotateCw size={13} />}
						loading={busyAction === 'hardReload'}
						disabled={isActionDisabled}
						onClick={handleHardReload}
					>
						Hard Reload
					</Button>
				</CardContent>
			</Card>

			{/* Card 2: Clear Cookies & LocalStorage */}
			<Card style={{ padding: 14 }}>
				<CardHeader style={{ padding: 0, marginBottom: 8 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Cookie size={15} color="#2F3574" />
						<CardTitle style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
							Clear Cookies & LocalStorage
						</CardTitle>
					</div>
					<CardDescription style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
						Reset sesi login, token autentikasi, dan data penyimpanan lokal khusus domain ini.
					</CardDescription>
				</CardHeader>
				<CardContent style={{ padding: 0, marginTop: 8 }}>
					<Button
						variant="outline"
						size="sm"
						icon={<Cookie size={13} />}
						loading={busyAction === 'cookiesAndStorage'}
						disabled={isActionDisabled}
						onClick={handleClearCookiesAndStorage}
					>
						Reset Cookies & Storage
					</Button>
				</CardContent>
			</Card>

			{/* Card 3: Unregister Service Worker & PWA Cache */}
			<Card style={{ padding: 14 }}>
				<CardHeader style={{ padding: 0, marginBottom: 8 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Database size={15} color="#2F3574" />
						<CardTitle style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
							Unregister Service Worker & PWA Cache
						</CardTitle>
					</div>
					<CardDescription style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
						Mencabut pendaftaran Service Worker dan menghapus CacheStorage PWA aset web.
					</CardDescription>
				</CardHeader>
				<CardContent style={{ padding: 0, marginTop: 8 }}>
					<Button
						variant="outline"
						size="sm"
						icon={<Database size={13} />}
						loading={busyAction === 'workerAndCache'}
						disabled={isActionDisabled}
						onClick={handleClearWorkerAndCache}
					>
						Hapus SW & Cache
					</Button>
				</CardContent>
			</Card>
		</div>
	);
};
