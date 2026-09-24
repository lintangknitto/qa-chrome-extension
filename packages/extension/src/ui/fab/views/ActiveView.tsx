import React, { useEffect, useState } from 'react';
import { Flag, Square, Send, Layers } from 'lucide-react';
import type { StoredActiveSession } from '../../../recording/tokenStore';
import { Card, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

interface ActiveViewProps {
	session: StoredActiveSession;
	pendingEvents: number;
	busy: boolean;
	error: string | null;
	onCheckpoint: (note: string) => void;
	onNavigateEnd: () => void;
}

export const ActiveView: React.FC<ActiveViewProps> = ({
	session,
	pendingEvents,
	busy,
	error,
	onCheckpoint,
	onNavigateEnd
}) => {
	const [note, setNote] = useState('');
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
						if (e.key === 'Enter' && !busy && note.trim()) {
							onCheckpoint(note.trim());
							setNote('');
						}
					}}
				/>
			</div>

			{/* Action Buttons */}
			<div className="sp-button-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
				<Button
					variant="secondary"
					disabled={busy || !note.trim()}
					onClick={() => {
						onCheckpoint(note.trim());
						setNote('');
					}}
					icon={<Flag size={14} />}
				>
					Add Checkpoint
				</Button>
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
