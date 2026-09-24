import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
	helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
	label,
	error,
	helperText,
	id,
	className = '',
	...props
}) => {
	const textareaId = id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

	return (
		<div className="sp-field k-field">
			{label && (
				<label htmlFor={textareaId} className="sp-label k-label">
					{label}
					{props.required && <span style={{ color: '#ef4444' }}>*</span>}
				</label>
			)}
			<textarea
				id={textareaId}
				className={`sp-textarea k-textarea ${className}`.trim()}
				style={error ? { borderColor: '#ef4444' } : undefined}
				{...props}
			/>
			{error ? (
				<span style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>{error}</span>
			) : helperText ? (
				<span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{helperText}</span>
			) : null}
		</div>
	);
};
