import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Check } from 'lucide-react';
import type { StoredActiveSession } from '../../../recording/tokenStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';

interface ResultViewProps {
	session: StoredActiveSession;
	expectedResult?: string | null;
	busy: boolean;
	error: string | null;
	onConfirmEnd: (input: { result: string; actual_result: string }) => void;
	onCancel: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
	session,
	expectedResult,
	busy,
	error,
	onConfirmEnd,
	onCancel
}) => {
	const [result, setResult] = useState('PASS');
	const [actualResult, setActualResult] = useState('');

	return (
		<Card>
			<CardHeader>
				<div>
					<CardTitle className="sp-label" style={{ fontWeight: 600, fontSize: 14 }}>
						Konfirmasi Selesai Recording
					</CardTitle>
					<CardDescription className="sp-muted">
						Session: <strong>{session.title}</strong> ({session.test_case_no})
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				{error && <div className="sp-error">{error}</div>}

				{expectedResult && (
					<div
						style={{
							marginBottom: '12px',
							background: '#f0fdf4',
							border: '1px solid #bbf7d0',
							borderRadius: '6px',
							padding: '8px 12px',
							fontSize: '12px'
						}}
					>
						<span style={{ fontWeight: 600, color: '#15803d' }}>Expected Result: </span>
						<span style={{ color: '#166534' }}>{expectedResult}</span>
					</div>
				)}

				{/* Segmented Result Selector */}
				<div className="sp-field k-field">
					<span className="sp-label k-label">Hasil Pengujian</span>
					<div className="k-segmented" aria-label="Hasil Pengujian" style={{ marginBottom: '8px' }}>
						<button
							type="button"
							aria-pressed={result === 'PASS'}
							className={`k-segmented-btn ${result === 'PASS' ? 'active-pass' : ''}`}
							onClick={() => setResult('PASS')}
						>
							<CheckCircle2 size={14} /> PASS
						</button>
						<button
							type="button"
							aria-pressed={result === 'FAIL'}
							className={`k-segmented-btn ${result === 'FAIL' ? 'active-fail' : ''}`}
							onClick={() => setResult('FAIL')}
						>
							<XCircle size={14} /> FAIL
						</button>
						<button
							type="button"
							aria-pressed={result === 'BLOCKED'}
							className={`k-segmented-btn ${result === 'BLOCKED' ? 'active-blocked' : ''}`}
							onClick={() => setResult('BLOCKED')}
						>
							<AlertTriangle size={14} /> BLOCKED
						</button>
					</div>

					{/* Hidden accessible select for compatibility */}
					<select
						className="sp-select"
						value={result}
						onChange={(e) => setResult(e.target.value)}
						style={{ display: 'none' }}
						aria-label="Hasil Pengujian"
					>
						<option value="PASS">PASS</option>
						<option value="FAIL">FAIL</option>
						<option value="BLOCKED">BLOCKED</option>
					</select>
				</div>

				<Textarea
					label="Actual Result / Catatan Hasil"
					value={actualResult}
					onChange={(event) => setActualResult(event.target.value)}
					placeholder="Tuliskan hasil aktual pengujian yang didapatkan..."
				/>

				<div className="sp-button-row" style={{ marginTop: 16 }}>
					<Button
						variant="danger"
						disabled={busy}
						loading={busy}
						onClick={() => onConfirmEnd({ result, actual_result: actualResult })}
						icon={<Check size={15} />}
					>
						{busy ? 'Mengakhiri Session...' : 'Konfirmasi End Session'}
					</Button>
					<Button
						variant="secondary"
						disabled={busy}
						onClick={onCancel}
					>
						Batal
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
