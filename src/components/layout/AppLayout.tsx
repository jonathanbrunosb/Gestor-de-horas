import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
  footerText: string;
  restrictToSelfService?: boolean;
}

/** Casca fixa (sidebar + main). Cada página renderiza seu próprio <Topbar/> + conteúdo dentro de <main>. */
export function AppLayout({ children, footerText, restrictToSelfService }: AppLayoutProps) {
  return (
    <div className="app">
      <Sidebar footerText={footerText} restrictToSelfService={restrictToSelfService} />
      <main className="main">{children}</main>
    </div>
  );
}
