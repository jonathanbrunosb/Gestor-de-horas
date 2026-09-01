import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Card({ title, subtitle, actions, className, children, ...rest }: CardProps) {
  return (
    <div className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {(title || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: subtitle ? 2 : 12 }}>
          {title && <h2 className="section-title" style={{ margin: 0 }}>{title}</h2>}
          {actions}
        </div>
      )}
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
