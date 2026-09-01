import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
  footerText: string;
}

/** Casca fixa (sidebar + main). Cada página renderiza seu próprio <Topbar/> + conteúdo dentro de <main>. */
export function AppLayout({ children, footerText }: AppLayoutProps) {
  return (
    <div className="app">
      <Sidebar footerText={footerText} />
      <main className="main">{children}</main>
    </div>
  );
}
