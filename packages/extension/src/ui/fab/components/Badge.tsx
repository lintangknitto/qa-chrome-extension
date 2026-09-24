import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'recording';
	icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
	children,
	variant = 'default',
	icon,
	className = '',
	...props
}) => {
	const variantClass = (() => {
		switch (variant) {
			case 'success':
				return 'sp-badge k-badge k-badge-success';
			case 'danger':
				return 'sp-badge k-badge k-badge-danger';
			case 'warning':
				return 'sp-badge k-badge k-badge-warning';
			case 'neutral':
				return 'sp-badge k-badge k-badge-neutral';
			case 'recording':
				return 'sp-badge k-badge k-badge-danger';
			case 'default':
			default:
				return 'sp-badge k-badge';
		}
	})();

	return (
		<span className={`${variantClass} ${className}`.trim()} {...props}>
			{variant === 'recording' && <span className="k-pulse-dot" />}
			{icon}
			{children}
		</span>
	);
};
