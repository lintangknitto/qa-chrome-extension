import React from 'react';
import type { FabIntent } from './fab-state';

export const fabIcons: Record<FabIntent, React.ReactElement> = {
	start: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M8 5v14l11-7z" />
		</svg>
	),
	generate: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 2l2.4 6.2L21 9.6l-5 4.2 1.6 6.6-5.6-3.4-5.6 3.4L8 13.8 3 9.6l6.6-1.4z" />
		</svg>
	),
	checkpoint: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M17 3H7a2 2 0 0 0-2 2v16l7-4 7 4V5a2 2 0 0 0-2-2z" />
		</svg>
	),
	end: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<rect x="5" y="5" width="14" height="14" rx="2" />
		</svg>
	),
	panel: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M4 5h16v14H4z" fillRule="evenodd" />
			<path d="M4 9h16v2H4z" />
		</svg>
	),
	setting: (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
			<path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2.2 1.6 2 3.4 2.5-1c.5.4 1.1.8 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4z" />
		</svg>
	)
};

export const recorderIcon: React.ReactElement = (
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" />
	</svg>
);