import React from 'react';

/** Penanda yang ditulis codegen API di atas langkah yang locatornya tidak unik saat direkam. */
export const AMBIGUOUS_MARKER = '⚠';

export const countAmbiguousSteps = (script: string): number =>
	script.split('\n').filter((line) => line.trim().startsWith(`// ${AMBIGUOUS_MARKER} locator`)).length;

/** Menampilkan script dengan baris peringatan (⚠) & komentar AI disorot. */
export const ScriptView: React.FC<{ script: string }> = ({ script }) => (
	<pre
		style={{
			margin: 0,
			padding: '12px 14px',
			background: '#0f172a',
			color: '#f8fafc',
			fontSize: 11.5,
			lineHeight: 1.6,
			maxHeight: 260,
			overflowY: 'auto',
			whiteSpace: 'pre-wrap',
			fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
		}}
	>
		{script.split('\n').map((line, index) => {
			const trimmed = line.trim();
			const warning = trimmed.startsWith(`// ${AMBIGUOUS_MARKER}`);
			const aiNote = trimmed.startsWith('// AI:') || trimmed.startsWith('// Patch AI');
			return (
				<div
					key={index}
					data-ambiguous={warning ? 'true' : undefined}
					style={{
						background: warning ? 'rgba(245, 158, 11, 0.18)' : undefined,
						color: warning ? '#fcd34d' : aiNote ? '#a5b4fc' : undefined
					}}
				>
					{line || ' '}
				</div>
			);
		})}
	</pre>
);
