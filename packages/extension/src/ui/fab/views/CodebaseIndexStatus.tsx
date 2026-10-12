import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Code2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import type { CodebaseRepoStatus, CodebaseStatus, RecordingApiClient } from '../../../recording/apiClient';

export interface CodebaseIndexStatusProps {
	api: Pick<RecordingApiClient, 'getCodebaseStatus' | 'syncCodebase'>;
	idProject: number;
	/** Interval polling selama ada repo yang sedang sync (ms). */
	pollMs?: number;
	/** Batas lama polling satu sesi sync (ms); setelahnya polling berhenti dan tombol sync dibuka lagi. */
	maxPollMs?: number;
	now?: () => number;
}

const relativeTime = (iso: string | null, now: number): string => {
	if (!iso) return '';
	const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
	if (minutes < 1) return 'baru saja';
	if (minutes < 60) return `${minutes} menit lalu`;
	const hours = Math.round(minutes / 60);
	return hours < 24 ? `${hours} jam lalu` : `${Math.round(hours / 24)} hari lalu`;
};

const describeRepo = (repo: CodebaseRepoStatus, now: number): { text: string; tone: 'ok' | 'busy' | 'error' | 'muted' } => {
	switch (repo.status) {
		case 'idle':
			return {
				text: `terbaru @${(repo.last_indexed_sha ?? '').slice(0, 7) || '-'} · ${relativeTime(repo.last_synced_at, now)} · ${repo.files_indexed} file`,
				tone: 'ok'
			};
		case 'syncing':
			return { text: 'sedang sync…', tone: 'busy' };
		case 'failed':
			return { text: `gagal: ${repo.last_error ?? 'alasan tidak diketahui'}`, tone: 'error' };
		default:
			return { text: 'belum ter-index', tone: 'muted' };
	}
};

const TONE_COLOR = { ok: '#15803d', busy: '#2563eb', error: '#b91c1c', muted: '#64748b' } as const;

/** Status index kode (codebase memory) per repo project + tombol sync manual. */
export const CodebaseIndexStatus: React.FC<CodebaseIndexStatusProps> = ({ api, idProject, pollMs = 5000, maxPollMs = 15 * 60_000, now = Date.now }) => {
	const [status, setStatus] = useState<CodebaseStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pollStartedAt = useRef<number | null>(null);
	const [pollExpired, setPollExpired] = useState(false);

	const load = useCallback(async () => {
		try {
			setStatus(await api.getCodebaseStatus(idProject));
			setError(null);
		} catch (err) {
			setError((err as Error).message || 'Gagal memuat status index kode.');
		}
	}, [api, idProject]);

	useEffect(() => {
		setStatus(null);
		void load();
	}, [load]);

	// Selama ada repo yang sync, cek ulang berkala sampai selesai.
	const anySyncing = Boolean(status?.repos.some((r) => r.status === 'syncing'));
	useEffect(() => {
		if (!anySyncing) {
			pollStartedAt.current = null;
			setPollExpired(false);
			return undefined;
		}
		pollStartedAt.current ??= now();
		if (now() - pollStartedAt.current >= maxPollMs) {
			setPollExpired(true);
			return undefined;
		}
		timer.current = setTimeout(() => void load(), pollMs);
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, [anySyncing, status, load, pollMs, maxPollMs, now]);

	const handleSync = async () => {
		setSyncing(true);
		pollStartedAt.current = null;
		setPollExpired(false);
		try {
			await api.syncCodebase(idProject);
			await load();
		} catch (err) {
			setError((err as Error).message || 'Gagal memicu sync index kode.');
		} finally {
			setSyncing(false);
		}
	};

	if (!status && !error) return null;
	const repos = status?.repos ?? [];
	const at = now();

	return (
		<div
			data-testid="codebase-index-status"
			style={{ marginTop: '8px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', fontSize: '11px' }}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
				<span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155' }}>
					<Code2 size={12} /> Index kode
				</span>
				{status?.can_sync && repos.length > 0 && (
					<Button
						type="button"
						variant="ghost"
						size="xs"
						icon={<RefreshCw size={12} />}
						onClick={() => void handleSync()}
						disabled={syncing || (anySyncing && !pollExpired)}
						title="Sync index kode semua repo project sekarang"
					>
						Sync sekarang
					</Button>
				)}
			</div>
			{pollExpired && (
				<div data-testid="codebase-poll-expired" style={{ color: TONE_COLOR.muted, marginTop: '4px' }}>
					Sync masih berjalan lama — status tidak dipantau lagi. Muat ulang halaman atau klik "Sync sekarang" bila macet.
				</div>
			)}
			{error && <div style={{ color: TONE_COLOR.error, marginTop: '4px' }}>{error}</div>}
			{status && repos.length === 0 && (
				<div style={{ color: TONE_COLOR.muted, marginTop: '4px' }}>Belum ada repo — isi Repository GitHub di master program atau project.</div>
			)}
			{repos.map((repo) => {
				const { text, tone } = describeRepo(repo, at);
				const Icon = tone === 'ok' ? CheckCircle2 : tone === 'busy' ? Loader2 : AlertCircle;
				return (
					<div
						key={`${repo.repo}@${repo.branch ?? ''}`}
						data-testid="codebase-repo-status"
						style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '4px', color: TONE_COLOR[tone] }}
					>
						<Icon size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
						<span>
							<span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
								{repo.repo}
								{repo.branch ? `@${repo.branch}` : ''}
							</span>
							{repo.program ? <span style={{ color: '#64748b' }}> ({repo.program})</span> : null}: {text}
						</span>
					</div>
				);
			})}
		</div>
	);
};
