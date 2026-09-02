import type { ReactNode } from 'react';
import type { AccessType } from '../../types/database';
import { Sidebar } from './Sidebar';
import { SidebarStateProvider, useSidebarState } from '../../hooks/useSidebarState';

interface AppLayoutProps {
  children: ReactNode;
  footerText: string;
  accessType: AccessType | null | undefined;
  restrictToSelfService?: boolean;
}

function AppLayoutShell({ children, footerText, accessType, restrictToSelfService }: AppLayoutProps) {
  const { collapsed, mobileOpen, closeMobile } = useSidebarState();

  return (
    <div className={`app${collapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar footerText={footerText} accessType={accessType} restrictToSelfService={restrictToSelfService} />
      {mobileOpen && <div className="mobile-sidebar-backdrop" onClick={closeMobile} />}
      <main className="main">{children}</main>
    </div>
  );
}

/**
 * Casca fixa (sidebar + main). Cada página renderiza seu próprio <Topbar/> +
 * conteúdo dentro de <main>. SidebarStateProvider fica por fora de tudo para
 * que o <Topbar/> de cada página (renderizado bem mais fundo na árvore, via
 * PageContent) consiga ler/abrir o menu mobile sem prop drilling.
 */
export function AppLayout(props: AppLayoutProps) {
  return (
    <SidebarStateProvider>
      <AppLayoutShell {...props} />
    </SidebarStateProvider>
  );
}
