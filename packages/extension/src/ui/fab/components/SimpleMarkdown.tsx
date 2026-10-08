import React from 'react';

/**
 * Renderer Markdown minimal & aman (tanpa innerHTML) untuk laporan AI:
 * heading, paragraf, list, code fence, kode inline, tebal, dan tautan http(s).
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
	const nodes: React.ReactNode[] = [];
	let last = 0;
	let index = 0;
	for (const match of text.matchAll(INLINE_PATTERN)) {
		const start = match.index ?? 0;
		if (start > last) nodes.push(text.slice(last, start));
		const token = match[0];
		const key = `${keyPrefix}-${index++}`;
		if (token.startsWith('**')) {
			nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
		} else if (token.startsWith('`')) {
			nodes.push(
				<code key={key} style={{ background: '#f1f5f9', padding: '0 4px', borderRadius: 4, fontSize: '0.92em' }}>
					{token.slice(1, -1)}
				</code>
			);
		} else {
			const label = token.slice(1, token.indexOf(']('));
			nodes.push(
				<a key={key} href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
					{label}
				</a>
			);
		}
		last = start + token.length;
	}
	if (last < text.length) nodes.push(text.slice(last));
	return nodes;
};

export const SimpleMarkdown: React.FC<{ source: string }> = ({ source }) => {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const blocks: React.ReactNode[] = [];
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed.startsWith('```')) {
			const code: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
			i++;
			blocks.push(
				<pre
					key={key++}
					style={{ background: '#0f172a', color: '#f8fafc', padding: '8px 10px', borderRadius: 6, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', margin: '6px 0' }}
				>
					{code.join('\n')}
				</pre>
			);
			continue;
		}

		const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
		if (heading) {
			const size = [16, 14, 13, 12][heading[1].length - 1];
			blocks.push(
				<div key={key++} style={{ fontSize: size, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>
					{renderInline(heading[2], `h${key}`)}
				</div>
			);
			i++;
			continue;
		}

		if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
			const ordered = /^\d+\.\s+/.test(trimmed);
			const items: React.ReactNode[] = [];
			while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
				const content = lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, '');
				items.push(<li key={items.length}>{renderInline(content, `li${key}-${items.length}`)}</li>);
				i++;
			}
			const style = { margin: '4px 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.55, color: '#334155' };
			blocks.push(ordered ? <ol key={key++} style={style}>{items}</ol> : <ul key={key++} style={style}>{items}</ul>);
			continue;
		}

		if (trimmed === '---') {
			blocks.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />);
			i++;
			continue;
		}

		if (trimmed) {
			blocks.push(
				<p key={key++} style={{ margin: '4px 0', fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
					{renderInline(trimmed, `p${key}`)}
				</p>
			);
		}
		i++;
	}

	return <div>{blocks}</div>;
};
