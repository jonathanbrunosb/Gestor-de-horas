import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { SIDEBAR_STORAGE_KEY } from '../lib/constants';

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    /* localStorage indisponível (modo privado, quota) — preferência de UI fica só em memória */
  }
}

export interface SidebarState {
  /** Menu recolhido (desktop, modo só-ícone) — persistido no navegador; nunca dado de negócio. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Menu off-canvas aberto (celular) — sempre transitório, nunca persistido. */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

/**
 * Provider único do estado de exibição do menu lateral, montado uma vez em
 * AppLayout — Sidebar e Topbar (este último renderizado bem mais fundo na
 * árvore, dentro de cada página) leem o mesmo estado via useSidebarState()
 * sem precisar de prop drilling por App.tsx/PageContent/páginas.
 */
export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeStoredCollapsed(next);
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

  // Fecha o menu mobile com Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMobile();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobile]);

  // Bloqueia a rolagem do conteúdo por trás enquanto o menu mobile está aberto.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const value: SidebarState = { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile, toggleMobile };
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/** Lê/muda o estado do menu lateral — precisa estar dentro de <SidebarStateProvider> (montado em AppLayout). */
export function useSidebarState(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarState deve ser usado dentro de <SidebarStateProvider>.');
  return ctx;
}
