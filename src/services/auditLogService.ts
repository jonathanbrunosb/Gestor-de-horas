import { getSupabase } from '../lib/supabaseClient';
import { normalizeMatricula } from '../lib/permissions';
import { getCurrentRouteLabel, sanitizeAuditValue } from '../utils/audit';
import type { AuditFilters, AuditLog, CreateAuditLogPayload } from '../types/audit';

/**
 * Assinatura legada, usada pelos ~25 pontos de chamada já existentes nos
 * demais services (colaboradores, gestores, ciclos, folgas, registros,
 * perfis, importações, reset, configurações). Mantida de propósito — trocar
 * a assinatura exigiria editar cada um desses arquivos só para preservar o
 * comportamento atual, contrariando a diretriz de não reescrever regra de
 * negócio já testada. createAuditLog() (abaixo) é a porta de entrada mais
 * rica, usada pela instrumentação nova (acesso, exportação, notificação,
 * erro do sistema).
 */
export interface AuditLogInput {
  actorRegistration: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

const EDGE_FUNCTION_TIMEOUT_MS = 3000;

interface AuditInsertRow {
  actor_profile_id: string | null;
  actor_registration: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  route: string | null;
  screen: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  error_message: string | null;
}

/**
 * Busca nome/e-mail/perfil/id do autor pela matrícula, para preencher a
 * trilha de auditoria mesmo quando o chamador só tem a matrícula em mãos
 * (caso dos ~25 pontos de chamada legados). Nunca lança — se a consulta
 * falhar, o log ainda é gravado, só sem esses campos preenchidos.
 */
async function lookupActorByRegistration(registration: string | null | undefined): Promise<{
  id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
}> {
  const empty = { id: null, name: null, email: null, role: null };
  if (!registration) return empty;
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('access_profiles')
      .select('id,name,email,access_type')
      .eq('registration', normalizeMatricula(registration))
      .maybeSingle();
    if (!data) return empty;
    return { id: data.id, name: data.name, email: data.email, role: data.access_type };
  } catch {
    return empty;
  }
}

/** navigator.userAgent, se disponível (ambiente de navegador). */
function currentUserAgent(): string | null {
  return typeof navigator !== 'undefined' ? navigator.userAgent : null;
}

function currentPathname(): string | null {
  return typeof window !== 'undefined' ? window.location.pathname : null;
}

/**
 * Tenta entregar o evento à Edge Function log-audit-event, que complementa
 * com o IP real (lido dos headers da requisição no servidor — nunca
 * confiável a partir do navegador, ver utils/audit.ts) antes de inserir.
 *
 * Só tenta quando VITE_AUDIT_EDGE_FUNCTION_URL está configurada
 * explicitamente (ver .env.example) — de propósito, não deriva da URL do
 * Supabase: essa função não é publicada automaticamente por este
 * repositório (sem CI/CD nem Supabase CLI configurados aqui), então tentar
 * chamá-la sempre, com todo mundo usando a chave anon "crua", faria TODA
 * ação de escrita do sistema pagar uma chamada de rede fadada a falhar
 * (404) até alguém publicar a função de verdade. Sem a variável, cai direto
 * para o insert (abaixo) sem nenhuma tentativa de rede.
 *
 * Timeout/qualquer falha de rede também fazem retornar false silenciosamente
 * — nunca deixa a auditoria derrubar a ação principal do usuário.
 */
async function tryEdgeFunction(row: AuditInsertRow): Promise<boolean> {
  const edgeFunctionUrl = import.meta.env.VITE_AUDIT_EDGE_FUNCTION_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!edgeFunctionUrl || !anonKey) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS);
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}`, apikey: anonKey },
      body: JSON.stringify(row),
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function insertAuditRowDirect(row: AuditInsertRow): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('audit_logs').insert(row);
  if (error) throw error;
}

/**
 * Núcleo único de gravação da auditoria — usado tanto por recordAuditLog()
 * (assinatura legada) quanto por createAuditLog() (assinatura nova), para
 * não duplicar a lógica de enriquecimento/tentativa de Edge Function/
 * fallback entre as duas. Nunca lança: falha ao registrar auditoria não
 * pode impedir a ação principal do usuário (seção 12 do escopo) — em caso
 * de erro, só loga no console, para suporte técnico investigar.
 */
async function logAuditEvent(payload: CreateAuditLogPayload): Promise<void> {
  try {
    const hasExplicitActor = payload.actorName !== undefined || payload.actorEmail !== undefined || payload.actorRole !== undefined;
    const actor = hasExplicitActor
      ? { id: null, name: payload.actorName ?? null, email: payload.actorEmail ?? null, role: payload.actorRole ?? null }
      : await lookupActorByRegistration(payload.actorRegistration);

    const row: AuditInsertRow = {
      actor_profile_id: actor.id,
      actor_registration: payload.actorRegistration ?? null,
      actor_name: actor.name,
      actor_email: actor.email,
      actor_role: actor.role,
      action: payload.action,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      entity_label: payload.entityLabel ?? null,
      route: payload.route ?? currentPathname(),
      screen: payload.screen ?? getCurrentRouteLabel(),
      old_value: sanitizeAuditValue(payload.oldValue ?? null),
      new_value: sanitizeAuditValue(payload.newValue ?? null),
      metadata: (sanitizeAuditValue(payload.metadata ?? null) as Record<string, unknown> | null) ?? null,
      ip_address: null, // nunca capturado no front-end — só a Edge Function tem acesso ao IP real (ver tryEdgeFunction).
      user_agent: currentUserAgent(),
      status: payload.status ?? 'success',
      error_message: payload.errorMessage ?? null
    };

    const deliveredByEdgeFunction = await tryEdgeFunction(row);
    if (!deliveredByEdgeFunction) await insertAuditRowDirect(row);
  } catch (error) {
    console.error('Falha ao registrar evento de auditoria', payload.action, error);
  }
}

/** Registra uma entrada em audit_logs (assinatura legada). Nunca lança. */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  await logAuditEvent({
    action: input.action,
    actorRegistration: input.actorRegistration,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    oldValue: input.oldValue,
    newValue: input.newValue
  });
}

/**
 * Registra uma entrada em audit_logs com o contexto completo (ator, rota,
 * entidade, metadados, status). Ponto de entrada recomendado para
 * instrumentação nova — ver seção 12/19 do escopo. Nunca lança; use
 * `void createAuditLog(...)` quando a auditoria não deve bloquear a ação
 * principal.
 */
export async function createAuditLog(payload: CreateAuditLogPayload): Promise<void> {
  await logAuditEvent(payload);
}

/**
 * Lista a trilha de auditoria com os filtros da tela (data, ator, ação,
 * entidade, status, busca livre), mais recentes primeiro. A busca livre usa
 * `or()` do PostgREST para varrer nome/matrícula/e-mail do ator, ação,
 * entidade, rótulo da entidade, rota e tela numa única chamada.
 */
export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
  const supabase = getSupabase();
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

  if (filters.startDate) query = query.gte('created_at', filters.startDate);
  // "Data final" vem de um <input type="date"> (ex.: "2026-09-01"), sem hora.
  // Comparar direto com created_at (timestamptz) excluiria os eventos do
  // próprio dia final — por isso a filtragem usa o início do dia seguinte
  // como limite exclusivo.
  if (filters.endDate) {
    const nextDay = new Date(`${filters.endDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt('created_at', nextDay.toISOString());
  }
  if (filters.actorRegistration) query = query.eq('actor_registration', normalizeMatricula(filters.actorRegistration));
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/g, ' ').trim();
    const fields = ['actor_name', 'actor_registration', 'actor_email', 'action', 'entity_type', 'entity_label', 'route', 'screen'];
    query = query.or(fields.map((field) => `${field}.ilike.%${term}%`).join(','));
  }
  query = query.limit(filters.limit ?? 200);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
