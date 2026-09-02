import type { MenuGroup } from '../../lib/menu';
import { SidebarItem } from './SidebarItem';

interface SidebarGroupProps {
  group: MenuGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarGroup({ group, collapsed, onNavigate }: SidebarGroupProps) {
  if (!group.items.length) return null;
  return (
    <div className="sidebar-group">
      {group.label && <span className="sidebar-group-label">{group.label}</span>}
      <nav className="nav">
        {group.items.map((item) => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}
