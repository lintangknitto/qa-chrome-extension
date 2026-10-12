import React, { useEffect, useState } from 'react';
import { Flag, Square, Send, Layers, Trash2, Crosshair, X } from 'lucide-react';
import type { StoredActiveSession } from '../../../recording/tokenStore';
import type { PickedTarget } from '../elementPicker';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

interface ActiveViewProps {
	session: StoredActiveSession;
	pendingEvents: number;
	busy: boolean;
	error: string | null;
	/** `target` terisi bila tester memilih elemen untuk diverifikasi (assertion di script). */
	onCheckpoint: (note: string, target?: PickedTarget | null) => void;
	/** Mode "Pilih elemen": resolve elemen yang diklik, null bila dibatalkan (Esc). */
	onPickElement?: () => Promise<PickedTarget | null>;
	onCancelPick?: () => void;
	onNavigateEnd: () => void;
	onDiscard?: () => void;
}

/** Catatan otomatis bila tester hanya memilih elemen tanpa menulis catatan. */
export const defaultCheckpointNote = (target: PickedTarget): string =>
	`Verifikasi elemen: ${target.text ? `"${target.text.slice(0, 80)}"` : target.locators[0] ?? target.tagName}`;

export const ActiveView: React.FC<ActiveViewProps> = ({
	session,
	pendingEvents,
	busy,
	error,
	onCheckpoint,
	onPickElement,
	onCancelPick,
	onNavigateEnd,
	onDiscard
}) => {
	const [note, setNote] = useState('');
	const [target, setTarget] = useState<PickedTarget | null>(null);
	const [picking, setPicking] = useState(false);
	const canSubmit = !busy && !picking && (Boolean(note.trim()) || target !== null);

	const submit = () => {
		if (!canSubmit) return;
		if (target) onCheckpoint(note.trim() || defaultCheckpointNote(target), target);
		else onCheckpoint(note.trim());
		setNote('');
		setTarget(null);
	};

	const pick = async () => {
		if (!onPickElement) return;
		setPicking(true);
		try {
			const picked = await onPickElement();
			if (picked) setTarget(picked);
		} finally {
			setPicking(false);
		}
	};
	const [seconds, setSeconds] = useState(() => {
		if (session.started_at) {
			return Math.max(0, Math.floor((Date.now() - session.started_at) / 1000));
		}
		return 0;
	});

	useEffect(() => {
		const updateTimer = () => {
			if (session.started_at) {
				setSeconds(Math.max(0, Math.floor((Date.now() - session.started_at) / 1000)));
			} else {
				setSeconds((s) => s + 1);
			}
		};
		const interval = setInterval(updateTimer, 1000);
		return () => clearInterval(interval);
	}, [session.started_at]);

	const formatTime = (totalSeconds: number) => {
		const hrs = Math.floor(totalSeconds / 3600);
		const mins = Math.floor((totalSeconds % 3600) / 60);
		const secs = totalSeconds % 60;
		if (hrs > 0) {
			return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
		}
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};

	return (
		<Card>
			{/* Top Bar with Badge & Session ID */}
			<div className="sp-button-row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
				<Badge variant="recording" className="sp-badge">
					Recording Aktif
				</Badge>
				<span className="sp-muted" style={{ fontWeight: 500 }}>
					Session #{session.id_session}
				</span>
			</div>

			{error && <div className="sp-error" style={{ marginTop: 8 }}>{error}</div>}

			{/* Session Info */}
			<div style={{ marginTop: 6, marginBottom: 12 }}>
				<div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{session.title}</div>
				<div className="sp-muted" style={{ fontWeight: 500 }}>{session.test_case_no}</div>
			</div>

			{/* Live Stopwatch Dashboard */}
			<div className="k-stopwatch">
				<div className="k-stopwatch-time">{formatTime(seconds)}</div>
				<div className="k-stopwatch-label">
					<span className="k-pulse-dot" /> Durasi Perekaman
				</div>
			</div>

			{/* Metrics Cards */}
			<div className="sp-metrics k-metrics">
				<div className="sp-metric k-metric-card">
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#2F3574' }}>
						<Send size={14} />
						<span className="sp-metric-value k-metric-value">{pendingEvents}</span>
					</div>
					<div className="sp-metric-label k-metric-label">Event menunggu kirim</div>
				</div>
				<div className="sp-metric k-metric-card">
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#2F3574' }}>
						<Layers size={14} />
						<span className="sp-metric-value k-metric-value">{session.group_id ?? '-'}</span>
					</div>
					<div className="sp-metric-label k-metric-label">ID Tab Group</div>
				</div>
			</div>

			{/* Checkpoint Input */}
			<div style={{ marginTop: '12px' }}>
				<Input
					label="Catatan / checkpoint"
					icon={<Flag size={14} />}
					value={note}
					onChange={(event) => setNote(event.target.value)}
					placeholder="Tulis catatan langkah atau checkpoint..."
					onKeyDown={(e) => {
						if (e.key === 'Enter') submit();
					}}
				/>
				{onPickElement && (
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
						{picking ? (
							<>
								<span className="sp-muted" role="status">Klik elemen di halaman yang ingin diverifikasi (Esc untuk batal)…</span>
								<Button variant="ghost" onClick={() => onCancelPick?.()} icon={<X size={14} />}>
									Batal
								</Button>
							</>
						) : target ? (
							<span
								data-testid="checkpoint-target"
								title={target.locators[0] ?? target.tagName}
								style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, background: '#eef0fb', color: '#2F3574', borderRadius: 6, padding: '2px 6px', maxWidth: '100%' }}
							>
								<Crosshair size={12} />
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
									{target.text ? `"${target.text}"` : target.locators[0] ?? `<${target.tagName}>`}
								</span>
								<button type="button" aria-label="Hapus elemen target" onClick={() => setTarget(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
									<X size={12} />
								</button>
							</span>
						) : (
							<Button variant="ghost" disabled={busy} onClick={() => void pick()} icon={<Crosshair size={14} />} title="Pilih elemen di halaman untuk dijadikan assertion">
								Pilih elemen
							</Button>
						)}
					</div>
				)}
			</div>

			{/* Action Buttons */}
			<div className="sp-button-row" style={{ marginTop: 12, justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
				<div style={{ display: 'flex', gap: 6 }}>
					<Button variant="secondary" disabled={!canSubmit} onClick={submit} icon={<Flag size={14} />}>
						Add Checkpoint
					</Button>
					{onDiscard && (
						<Button
							variant="ghost"
							disabled={busy}
							onClick={onDiscard}
							icon={<Trash2 size={14} />}
							title="Buang/Batalkan sesi rekaman ini tanpa menyimpan"
							style={{ color: '#dc2626' }}
						>
							Buang Sesi
						</Button>
					)}
				</div>
				<Button
					variant="danger"
					disabled={busy}
					onClick={onNavigateEnd}
					icon={<Square size={14} fill="currentColor" />}
				>
					End Recording
				</Button>
			</div>
		</Card>
	);
};
