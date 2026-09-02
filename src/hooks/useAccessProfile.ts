import { useEffect, useMemo, useRef, useState } from 'react';
import type { AccessProfileRow } from '../types/database';
import type { AccessContext } from '../types/domain';
import { resolveAccessContext, writeSessionMatricula, clearSessionMatricula } from '../utils/access';
import { supabase } from '../lib/supabaseClient';
import { createAuditLog } from '../services/auditLogService';

/**
 * Resolve o contexto de acesso do usuário atual (seção 12 do escopo):
 * Supabase Auth > query string > sessão local > tela de login manual.
 */
export function useAccessProfile(accessProfiles: AccessProfileRow[], loadingProfiles: boolean) {
  const [authMatricula, setAuthMatricula] = useState<string | null>(null);
  const [manualMatricula, setManualMatricula] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email) {
        // Convenção MVP: local-part do e-mail corporativo == matrícula (uXXXXXXX@equatorialenergia.com.br).
        setAuthMatricula(email.split('@')[0]);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email;
      setAuthMatricula(email ? email.split('@')[0] : null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const context: AccessContext = useMemo(() => {
    if (loadingProfiles) {
      return { authorized: true, role: 'Carregando', matricula: '', source: null, profile: null, reason: 'Carregando perfis…' };
    }
    return resolveAccessContext({ authMatricula: authMatricula ?? manualMatricula, profiles: accessProfiles });
  }, [accessProfiles, authMatricula, manualMatricula, loadingProfiles]);

  // Registra o desfecho do acesso (liberado/negado) uma única vez por
  // matrícula resolvida — não a cada re-render. "Tentativa" não existe como
  // evento separado neste MVP (não há etapa de senha antes da resolução por
  // matrícula): o desfecho já É o resultado da tentativa.
  const lastLoggedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (context.role === 'Carregando' || !context.matricula) return;
    const key = `${context.matricula}:${context.authorized}`;
    if (lastLoggedKeyRef.current === key) return;
    lastLoggedKeyRef.current = key;
    void createAuditLog({
      action: context.authorized ? 'access.login_success' : 'access.login_denied',
      status: context.authorized ? 'success' : 'warning',
      actorRegistration: context.matricula,
      actorName: context.profile?.name ?? null,
      actorEmail: context.profile?.email ?? null,
      actorRole: context.profile?.access_type ?? null,
      entityType: 'access_profile',
      entityId: context.profile?.id ?? null,
      entityLabel: context.profile?.name ?? context.matricula,
      metadata: { source: context.source, reason: context.reason }
    });
  }, [context]);

  function loginWithMatricula(matricula: string) {
    writeSessionMatricula(matricula);
    setManualMatricula(matricula);
  }

  async function logout() {
    void createAuditLog({
      action: 'access.logout',
      actorRegistration: context.matricula || null,
      actorName: context.profile?.name ?? null,
      actorEmail: context.profile?.email ?? null,
      actorRole: context.profile?.access_type ?? null,
      entityType: 'access_profile',
      entityId: context.profile?.id ?? null,
      entityLabel: context.profile?.name ?? context.matricula
    });
    clearSessionMatricula();
    setManualMatricula(null);
    setAuthMatricula(null);
    lastLoggedKeyRef.current = null;
    if (supabase) await supabase.auth.signOut();
  }

  return { context, loginWithMatricula, logout };
}
