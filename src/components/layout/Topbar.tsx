import type { ReactNode } from 'react';

interface TopbarProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function Topbar({ eyebrow, title, description, actions }: TopbarProps) {
  return (
    <div className="topbar">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div className="top-actions">{actions}</div>}
    </div>
  );
}
