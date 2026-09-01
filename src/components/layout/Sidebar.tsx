import { NavLink } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      </svg>
    )
  },
  {
    to: '/resumo',
    label: 'Resumo por Colaborador',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 13c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.5 9.5c1.6.3 2.8 1.5 2.8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    to: '/controle-horas',
    label: 'Controle de Horas',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1.5" width="13" height="1.8" rx="0.9" fill="currentColor" />
        <rect x="1" y="6.5" width="9" height="1.8" rx="0.9" fill="currentColor" />
        <rect x="1" y="11.5" width="11" height="1.8" rx="0.9" fill="currentColor" />
      </svg>
    )
  },
  {
    to: '/calendario',
    label: 'Calendário de Folgas',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="3" width="12" height="10.5" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.5 1.5v2.5M10.5 1.5v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M1.5 6.5h12" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5" cy="9.5" r="0.9" fill="currentColor" />
        <circle cx="10" cy="9.5" r="0.9" fill="currentColor" />
      </svg>
    )
  },
  {
    to: '/upload',
    label: 'Upload de Arquivos',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 9.5V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.5 4.5L7.5 1.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 10.5v1.5A1.5 1.5 0 003.5 13.5h8a1.5 1.5 0 001.5-1.5v-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    to: '/gestao-bh',
    label: 'Gestão BH / Pagamento',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <polyline points="2,12 2,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="2,12 14,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <polyline points="4,9 6.5,6 9,8 13,3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.2 1.6l-.3 1a4.6 4.6 0 00-.8.5l-1-.4-.9 1.6.9.7v.9l-.9.7.9 1.6 1-.4c.25.18.52.35.8.47l.3 1.08h1.6l.3-1.08c.28-.12.55-.29.8-.47l1 .4.9-1.6-.9-.7V6l.9-.7-.9-1.6-1 .4a4.6 4.6 0 00-.8-.5l-.3-1H6.2z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    )
  },
  {
    to: '/colaboradores',
    label: 'Base de Colaboradores',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 13.5c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
];

interface SidebarProps {
  footerText: string;
}

export function Sidebar({ footerText }: SidebarProps) {
  return (
    <aside className="sidebar">
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

      <div className="sidebar-nav-wrap">
        <span className="sidebar-nav-label">Módulos</span>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              <span className="nav-ico">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">{footerText}</div>
    </aside>
  );
}
