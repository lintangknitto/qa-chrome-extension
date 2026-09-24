import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
	<div className={`sp-card k-card ${className}`.trim()} {...props}>
		{children}
	</div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
	<div className={`k-card-header ${className}`.trim()} {...props}>
		{children}
	</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...props }) => (
	<div className={`k-card-title ${className}`.trim()} {...props}>
		{children}
	</div>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className = '', ...props }) => (
	<div className={`k-card-desc ${className}`.trim()} {...props}>
		{children}
	</div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
	<div className={`k-card-content ${className}`.trim()} {...props}>
		{children}
	</div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
	<div className={`k-card-footer ${className}`.trim()} style={{ marginTop: '12px' }} {...props}>
		{children}
	</div>
);
