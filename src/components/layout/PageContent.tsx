import type { ReactNode } from 'react';
import { Topbar } from './Topbar';

interface PageContentProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageContent({ eyebrow = 'Monitoramento corporativo', title, description, actions, children }: PageContentProps) {
  return (
    <>
      <Topbar eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <section className="view-root">{children}</section>
    </>
  );
}
