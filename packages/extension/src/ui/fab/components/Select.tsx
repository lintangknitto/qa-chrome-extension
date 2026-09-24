import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	helperText?: string;
	options?: Array<{ value: string | number; label: string }>;
}

export const Select: React.FC<SelectProps> = ({
	label,
	error,
	helperText,
	id,
	children,
	options,
	className = '',
	...props
}) => {
	const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

	return (
		<div className="sp-field k-field">
			{label && (
				<label htmlFor={selectId} className="sp-label k-label">
					{label}
					{props.required && <span style={{ color: '#ef4444' }}>*</span>}
				</label>
			)}
			<select
				id={selectId}
				className={`sp-select k-select ${className}`.trim()}
				style={error ? { borderColor: '#ef4444' } : undefined}
				{...props}
			>
				{options
					? options.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
					  ))
					: children}
			</select>
			{error ? (
				<span style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>{error}</span>
			) : helperText ? (
				<span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{helperText}</span>
			) : null}
		</div>
	);
};
