import { useEffect, useMemo, useState } from 'react';
import type { AccessProfileRow } from '../types/database';
import type { AccessContext } from '../types/domain';
import { resolveAccessContext, writeSessionMatricula, clearSessionMatricula } from '../utils/access';
import { supabase } from '../lib/supabaseClient';

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

  function loginWithMatricula(matricula: string) {
    writeSessionMatricula(matricula);
    setManualMatricula(matricula);
  }

  async function logout() {
    clearSessionMatricula();
    setManualMatricula(null);
    setAuthMatricula(null);
    if (supabase) await supabase.auth.signOut();
  }

  return { context, loginWithMatricula, logout };
}
