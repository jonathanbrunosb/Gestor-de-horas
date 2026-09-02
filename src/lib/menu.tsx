import type { ReactNode } from 'react';
import type { AccessType } from '../types/database';

export interface MenuItem {
  id: string;
  label: string;
  route: string;
  icon: ReactNode;
  /**
   * Perfis que veem este item no menu. Curadoria de navegação (UX), não uma
   * segunda camada de autorização — o controle de acesso real de cada tela
   * continua sendo feito pelas próprias páginas (ver lib/permissions.ts).
   * Colaborador (autoatendimento) e Sem acesso não entram aqui: são tratados
   * à parte pela Sidebar (restrictToSelfService / tela de acesso negado).
   */
  allowedRoles: AccessType[];
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/** Todo perfil com acesso ao sistema, exceto Colaborador (autoatendimento — não navega pelo menu). */
const ALL_STAFF_ROLES: AccessType[] = ['Desenvolvedor', 'Administrador', 'Gerente', 'Executivo', 'Facilitador'];

const dashboardIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
  </svg>
);

const summaryIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M1 13c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10.5 9.5c1.6.3 2.8 1.5 2.8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const detailsIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1" y="1.5" width="13" height="1.8" rx="0.9" fill="currentColor" />
    <rect x="1" y="6.5" width="9" height="1.8" rx="0.9" fill="currentColor" />
    <rect x="1" y="11.5" width="11" height="1.8" rx="0.9" fill="currentColor" />
  </svg>
);

const calendarIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="3" width="12" height="10.5" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4.5 1.5v2.5M10.5 1.5v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M1.5 6.5h12" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5" cy="9.5" r="0.9" fill="currentColor" />
    <circle cx="10" cy="9.5" r="0.9" fill="currentColor" />
  </svg>
);

const managementIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <polyline points="2,12 2,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="2,12 14,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="4,9 6.5,6 9,8 13,3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const peopleIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 13.5c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const uploadIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 9.5V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4.5 4.5L7.5 1.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 10.5v1.5A1.5 1.5 0 003.5 13.5h8a1.5 1.5 0 001.5-1.5v-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const settingsIcon: ReactNode = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M6.2 1.6l-.3 1a4.6 4.6 0 00-.8.5l-1-.4-.9 1.6.9.7v.9l-.9.7.9 1.6 1-.4c.25.18.52.35.8.47l.3 1.08h1.6l.3-1.08c.28-.12.55-.29.8-.47l1 .4.9-1.6-.9-.7V6l.9-.7-.9-1.6-1 .4a4.6 4.6 0 00-.8-.5l-.3-1H6.2z"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);

/**
 * Fonte única dos itens do menu lateral — Sidebar, tooltips do modo
 * recolhido e o menu off-canvas do celular consomem exatamente esta lista,
 * nunca uma cópia própria. `allowedRoles` reflete o que cada perfil já
 * consegue fazer de fato em cada tela hoje (ver lib/permissions.ts):
 * Facilitador entra em Base de Colaboradores e Upload de Arquivos porque já
 * tem canEditCollaborators/canImportTimeSheets nessas telas; Gerente/
 * Executivo não entram em Upload porque não têm canImportTimeSheets lá.
 */
export const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: dashboardIcon, allowedRoles: ALL_STAFF_ROLES },
      { id: 'summary', label: 'Resumo por Colaborador', route: '/resumo', icon: summaryIcon, allowedRoles: ALL_STAFF_ROLES }
    ]
  },
  {
    label: 'Gestão de horas',
    items: [
      { id: 'details', label: 'Controle de Horas', route: '/controle-horas', icon: detailsIcon, allowedRoles: ALL_STAFF_ROLES },
      { id: 'calendar', label: 'Calendário de Folgas', route: '/calendario', icon: calendarIcon, allowedRoles: ALL_STAFF_ROLES },
      { id: 'gestao', label: 'Gestão BH / Pagamento', route: '/gestao-bh', icon: managementIcon, allowedRoles: ALL_STAFF_ROLES }
    ]
  },
  {
    label: 'Cadastros',
    items: [
      { id: 'people', label: 'Base de Colaboradores', route: '/colaboradores', icon: peopleIcon, allowedRoles: ALL_STAFF_ROLES },
      {
        id: 'upload',
        label: 'Upload de Arquivos',
        route: '/upload',
        icon: uploadIcon,
        allowedRoles: ['Desenvolvedor', 'Administrador', 'Facilitador']
      }
    ]
  },
  {
    label: 'Administração',
    items: [{ id: 'settings', label: 'Configurações', route: '/configuracoes', icon: settingsIcon, allowedRoles: ['Desenvolvedor', 'Administrador'] }]
  }
];

/** Único item visível para o perfil "Colaborador" (autoatendimento) — fora dos grupos, sem navegação para as demais telas. */
export const SELF_SERVICE_MENU_ITEM: MenuItem = {
  id: 'details-self-service',
  label: 'Controle de Horas',
  route: '/controle-horas',
  icon: detailsIcon,
  allowedRoles: ['Colaborador']
};

/**
 * MENU_GROUPS filtrado para o perfil informado — remove tanto os itens quanto
 * os grupos que ficariam vazios. `accessType` nulo/indefinido (perfil ainda
 * carregando) mantém tudo visível, igual ao comportamento anterior à
 * reorganização em grupos.
 */
export function getVisibleMenuGroups(accessType: AccessType | null | undefined): MenuGroup[] {
  return MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !accessType || item.allowedRoles.includes(accessType))
  })).filter((group) => group.items.length > 0);
}
