import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	icon?: React.ReactNode;
	error?: string;
	helperText?: string;
}

export const Input: React.FC<InputProps> = ({
	label,
	icon,
	error,
	helperText,
	id,
	className = '',
	...props
}) => {
	const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

	return (
		<div className="sp-field k-field">
			{label && (
				<label htmlFor={inputId} className="sp-label k-label">
					{label}
					{props.required && <span style={{ color: '#ef4444' }}>*</span>}
				</label>
			)}
			<div className="k-input-wrapper">
				{icon && <span className="k-input-icon">{icon}</span>}
				<input
					id={inputId}
					className={`sp-input k-input ${icon ? 'has-icon-left' : ''} ${className}`.trim()}
					style={error ? { borderColor: '#ef4444' } : undefined}
					{...props}
				/>
			</div>
			{error ? (
				<span style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>{error}</span>
			) : helperText ? (
				<span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{helperText}</span>
			) : null}
		</div>
	);
};
