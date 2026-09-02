import type { ReactNode } from 'react';
import { useSidebarState } from '../../hooks/useSidebarState';

interface TopbarProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

const hamburgerIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const closeIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export function Topbar({ eyebrow, title, description, actions }: TopbarProps) {
  const { mobileOpen, toggleMobile } = useSidebarState();

  return (
    <div className="topbar">
      <button
        type="button"
        className="mobile-menu-button"
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileOpen}
        onClick={toggleMobile}
      >
        {mobileOpen ? closeIcon : hamburgerIcon}
      </button>
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div className="top-actions">{actions}</div>}
    </div>
  );
}
