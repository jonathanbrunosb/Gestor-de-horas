import { getSupabase } from '../lib/supabaseClient';
import type { NotificationLogRow } from '../types/database';
import type { CollaboratorWithRelations } from '../types/domain';
import { buildAlertMailto, type MailtoAlertInput } from '../utils/mailto';
import { createAuditLog } from './auditLogService';

export type NotificationLogInput = Omit<NotificationLogRow, 'id' | 'created_at'>;

/** Gera o link mailto e registra a notificação em notification_logs. */
export async function generateAndLogNotification(
  input: MailtoAlertInput,
  actorRegistration: string | null
): Promise<{ mailtoUrl: string; log: NotificationLogRow }> {
  const supabase = getSupabase();
  const mailtoUrl = buildAlertMailto(input);
  const collaborator: CollaboratorWithRelations = input.collaborator;

  const { data, error } = await supabase
    .from('notification_logs')
    .insert({
      collaborator_id: collaborator.id,
      manager_id: collaborator.manager_id,
      notification_type: input.type,
      to_email: collaborator.email,
      cc_email: collaborator.manager?.email ?? collaborator.manager_email,
      subject: `[Gestor de Horas] ${input.type} — ${collaborator.name}`,
      body: input.details,
      mailto_url: mailtoUrl,
      status: 'Gerado',
      created_by_registration: actorRegistration
    })
    .select()
    .single();
  if (error) throw error;
  void createAuditLog({
    action: 'notification.mailto_generated',
    actorRegistration,
    entityType: 'notification',
    entityId: data.id,
    entityLabel: `${input.type} — ${collaborator.name}`,
    metadata: { notificationType: input.type, toEmail: data.to_email, ccEmail: data.cc_email }
  });
  return { mailtoUrl, log: data };
}

export async function listNotificationLogs(collaboratorId?: string): Promise<NotificationLogRow[]> {
  const supabase = getSupabase();
  let query = supabase.from('notification_logs').select('*').order('created_at', { ascending: false });
  if (collaboratorId) query = query.eq('collaborator_id', collaboratorId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
