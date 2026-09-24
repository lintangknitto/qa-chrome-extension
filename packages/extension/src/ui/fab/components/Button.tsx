import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost';
	size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
	loading?: boolean;
	icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
	children,
	variant = 'primary',
	size = 'md',
	loading = false,
	icon,
	disabled,
	className = '',
	...props
}) => {
	const variantClass = (() => {
		switch (variant) {
			case 'secondary':
				return 'sp-button secondary k-btn-secondary';
			case 'success':
				return 'sp-button success k-btn-success';
			case 'danger':
				return 'sp-button danger k-btn-danger';
			case 'outline':
				return 'k-btn k-btn-outline';
			case 'ghost':
				return 'k-btn k-btn-ghost';
			case 'primary':
			default:
				return 'sp-button k-btn k-btn-primary';
		}
	})();

	const sizeClass = (() => {
		switch (size) {
			case 'xs':
				return 'k-btn-xs';
			case 'sm':
				return 'k-btn-sm';
			case 'lg':
				return 'k-btn-lg';
			case 'icon':
				return 'k-btn-icon';
			case 'md':
			default:
				return 'k-btn-md';
		}
	})();

	const spinnerSize = size === 'xs' ? 12 : size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

	return (
		<button
			disabled={disabled || loading}
			className={`${variantClass} ${sizeClass} ${className}`.trim()}
			{...props}
		>
			{loading ? <Loader2 size={spinnerSize} className="k-spin" style={{ animation: 'spin 1s linear infinite' }} /> : icon}
			{children}
		</button>
	);
};
