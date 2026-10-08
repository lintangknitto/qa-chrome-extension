import React from 'react';

export interface SwitchProps {
	id?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label?: string;
	description?: string;
	activeColor?: string;
}

export const Switch: React.FC<SwitchProps> = ({
	id,
	checked,
	onChange,
	disabled = false,
	label,
	description,
	activeColor = '#10b981'
}) => {
	const switchId = id || (label ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: '12px',
				cursor: disabled ? 'not-allowed' : 'pointer',
				userSelect: 'none'
			}}
			onClick={() => {
				if (!disabled) onChange(!checked);
			}}
		>
			{(label || description) && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
					{label && (
						<label
							htmlFor={switchId}
							style={{
								fontSize: '12px',
								fontWeight: 600,
								color: '#1e293b',
								cursor: disabled ? 'not-allowed' : 'pointer'
							}}
						>
							{label}
						</label>
					)}
					{description && (
						<span style={{ fontSize: '11px', color: '#64748b' }}>
							{description}
						</span>
					)}
				</div>
			)}
			<div
				id={switchId}
				role="switch"
				aria-checked={checked}
				tabIndex={disabled ? -1 : 0}
				onKeyDown={(e) => {
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault();
						if (!disabled) onChange(!checked);
					}
				}}
				style={{
					width: '40px',
					height: '24px',
					borderRadius: '12px',
					background: checked ? activeColor : '#cbd5e1',
					padding: '2px',
					position: 'relative',
					cursor: disabled ? 'not-allowed' : 'pointer',
					opacity: disabled ? 0.6 : 1,
					transition: 'background 0.2s ease, box-shadow 0.2s ease',
					flexShrink: 0,
					boxShadow: checked ? `0 1px 4px ${activeColor}44` : 'none'
				}}
			>
				<div
					style={{
						width: '20px',
						height: '20px',
						borderRadius: '50%',
						background: '#ffffff',
						transform: checked ? 'translateX(16px)' : 'translateX(0px)',
						transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
						boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)'
					}}
				/>
			</div>
		</div>
	);
};
