import type { AccessType } from '../../types/database';
import { APP_NAME } from '../../lib/constants';
import { SELF_SERVICE_MENU_ITEM, getVisibleMenuGroups } from '../../lib/menu';
import { useSidebarState } from '../../hooks/useSidebarState';
import { SidebarGroup } from './SidebarGroup';

interface SidebarProps {
  footerText: string;
  accessType: AccessType | null | undefined;
  /** Perfil "Colaborador": só mostra o item Controle de Horas no menu. */
  restrictToSelfService?: boolean;
}

const collapseIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 2v12" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 6.5L8.5 8l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const expandIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 2v12" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8.5 6.5L10.5 8l-2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Sidebar({ footerText, accessType, restrictToSelfService }: SidebarProps) {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebarState();

  const className = `sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`;

  return (
    <aside className={className}>
      <div className="logo-wrap">
        <img className="logo-image" src="./logo-equatorial-white.png" alt="Grupo Equatorial" />
      </div>

      <div className="system-block">
        <div className="system-block-inner">
          <div className="system-badge-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12V4" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M2 12H14" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M5 9.5L8 6.5L10.5 9L14 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="system-title">{APP_NAME}</div>
        </div>
      </div>

      <button
        type="button"
        className="sidebar-toggle"
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        onClick={toggleCollapsed}
      >
        {collapsed ? expandIcon : collapseIcon}
      </button>

      <div className="sidebar-nav-wrap">
        {restrictToSelfService ? (
          <SidebarGroup group={{ label: '', items: [SELF_SERVICE_MENU_ITEM] }} collapsed={collapsed} onNavigate={closeMobile} />
        ) : (
          getVisibleMenuGroups(accessType).map((group) => (
            <SidebarGroup key={group.label} group={group} collapsed={collapsed} onNavigate={closeMobile} />
          ))
        )}
      </div>

      <div className="sidebar-footer">{footerText}</div>
    </aside>
  );
}
