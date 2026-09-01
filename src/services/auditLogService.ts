import { getSupabase } from '../lib/supabaseClient';

export interface AuditLogInput {
  actorRegistration: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Registra uma entrada em audit_logs. Nunca lança — auditoria não pode derrubar a operação principal. */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('audit_logs').insert({
      actor_registration: input.actorRegistration,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null
    });
  } catch (error) {
    console.error('Falha ao registrar audit_log', error);
  }
}

export async function listAuditLogs(limit = 200) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
