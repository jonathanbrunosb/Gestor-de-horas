import { NavLink } from 'react-router-dom';
import type { MenuItem } from '../../lib/menu';

interface SidebarItemProps {
  item: MenuItem;
  /** No modo recolhido, o rótulo vira tooltip nativo (title) já que o texto fica oculto. */
  collapsed: boolean;
  /** Fecha o menu mobile ao navegar — no desktop é undefined (nada a fechar). */
  onNavigate?: () => void;
}

export function SidebarItem({ item, collapsed, onNavigate }: SidebarItemProps) {
  return (
    <NavLink
      to={item.route}
      onClick={onNavigate}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      <span className="sidebar-item-icon">{item.icon}</span>
      <span className="sidebar-item-label">{item.label}</span>
    </NavLink>
  );
}
