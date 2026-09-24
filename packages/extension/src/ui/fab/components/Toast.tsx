import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
	message: string | null;
	type?: 'success' | 'error' | 'info';
	onClose: () => void;
	duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
	message,
	type = 'info',
	onClose,
	duration = 3500
}) => {
	useEffect(() => {
		if (!message) return;
		const timer = setTimeout(() => {
			onClose();
		}, duration);
		return () => clearTimeout(timer);
	}, [message, duration, onClose]);

	if (!message) return null;

	const typeClass = type === 'success' ? 'k-toast-success' : type === 'error' ? 'k-toast-error' : 'k-toast-info';

	return (
		<div className={`k-toast ${typeClass}`} role="alert">
			<div className="k-toast-content">
				{type === 'success' ? (
					<CheckCircle2 size={16} />
				) : type === 'error' ? (
					<AlertCircle size={16} />
				) : (
					<Info size={16} />
				)}
				<span>{message}</span>
			</div>
			<button
				onClick={onClose}
				style={{
					background: 'transparent',
					border: 'none',
					color: 'rgba(255, 255, 255, 0.8)',
					cursor: 'pointer',
					padding: '2px',
					display: 'inline-flex',
					alignItems: 'center',
					borderRadius: '4px'
				}}
				aria-label="Tutup notifikasi"
			>
				<X size={14} />
			</button>
		</div>
	);
};
