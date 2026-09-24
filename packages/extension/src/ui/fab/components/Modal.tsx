import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
	open?: boolean;
	isOpen?: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	noPadding?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
	open,
	isOpen,
	onClose,
	title,
	children,
	footer,
	noPadding = false
}) => {
	const isVisible = open ?? isOpen ?? false;

	useEffect(() => {
		if (!isVisible) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				e.stopImmediatePropagation();
				onClose();
			}
		};
		document.addEventListener('keydown', onKeyDown, true);
		return () => document.removeEventListener('keydown', onKeyDown, true);
	}, [isVisible, onClose]);

	if (!isVisible) return null;

	return (
		<div className="k-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
			<div className="k-modal-sheet">
				<div className="k-modal-header">
					<span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{title}</span>
					<button
						className="k-btn k-btn-ghost k-btn-icon k-btn-xs"
						aria-label="Tutup modal"
						onClick={onClose}
					>
						<X size={16} />
					</button>
				</div>
				<div className={`k-modal-body ${noPadding ? 'no-padding' : ''}`}>
					{children}
				</div>
				{footer && (
					<div className="k-modal-footer">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
};
