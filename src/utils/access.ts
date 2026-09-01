import type { AccessProfileRow } from '../types/database';
import type { AccessContext } from '../types/domain';
import { normalizeMatricula, isAuthorizedAccessType } from '../lib/permissions';
import { SESSION_STORAGE_KEY } from '../lib/constants';

/** query string temporária `?matricula=uXXXXX`, apenas para compatibilidade/MVP. */
export function extractMatriculaFromQuery(href: string = window.location.href): string {
  try {
    const url = new URL(href);
    return normalizeMatricula(url.searchParams.get('matricula'));
  } catch {
    return '';
  }
}

export function readSessionMatricula(): string {
  try {
    return normalizeMatricula(window.localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function writeSessionMatricula(matricula: string): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, normalizeMatricula(matricula));
  } catch {
    /* localStorage indisponível (modo privado, quota) — sessão fica só em memória */
  }
}

export function clearSessionMatricula(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Resolve a matrícula do usuário atual, na ordem definida na seção 12 do
 * escopo: Supabase Auth (se disponível) > query string > sessão local > login manual.
 * `authEmail`/`authMatricula` vêm de supabase.auth quando configurado.
 */
export function resolveAccessContext(options: {
  authMatricula?: string | null;
  profiles: AccessProfileRow[];
}): AccessContext {
  const { authMatricula, profiles } = options;

  let matricula = '';
  let source: AccessContext['source'] = null;

  if (authMatricula) {
    matricula = normalizeMatricula(authMatricula);
    source = 'auth';
  } else {
    const fromQuery = extractMatriculaFromQuery();
    if (fromQuery) {
      matricula = fromQuery;
      source = 'query';
      writeSessionMatricula(fromQuery);
    } else {
      const fromSession = readSessionMatricula();
      if (fromSession) {
        matricula = fromSession;
        source = 'session';
      }
    }
  }

  if (!matricula) {
    return {
      authorized: false,
      role: 'Sem perfil',
      matricula: '',
      source: null,
      profile: null,
      reason: 'Nenhuma matrícula identificada — informe a matrícula corporativa para continuar.'
    };
  }

  const profile = profiles.find((p) => normalizeMatricula(p.registration) === matricula) ?? null;

  if (!profile) {
    return {
      authorized: false,
      role: 'Sem perfil',
      matricula,
      source,
      profile: null,
      reason: `A matrícula ${matricula} não possui perfil de acesso cadastrado.`
    };
  }

  if (profile.status !== 'Ativo') {
    return {
      authorized: false,
      role: profile.access_type,
      matricula,
      source,
      profile,
      reason: `O perfil da matrícula ${matricula} está inativo.`
    };
  }

  if (!isAuthorizedAccessType(profile.access_type)) {
    return {
      authorized: false,
      role: profile.access_type,
      matricula,
      source,
      profile,
      reason: `O perfil da matrícula ${matricula} é "Sem acesso".`
    };
  }

  return {
    authorized: true,
    role: profile.access_type,
    matricula,
    source,
    profile,
    reason: 'Perfil ativo e autorizado.'
  };
}
