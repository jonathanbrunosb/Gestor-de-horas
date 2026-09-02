import type { AuditLogRow } from './database';

/**
 * Vocabulário de ações auditadas. `| string` mantém o tipo aberto: eventos
 * legados (gravados antes desta taxonomia) e casos de borda não previstos
 * aqui continuam sendo aceitos e exibidos — só perdem o rótulo amigável de
 * getAuditActionLabel(), que cai num fallback formatado a partir do texto.
 */
export type AuditAction =
  | 'access.login_success'
  | 'access.login_denied'
  | 'access.logout'
  | 'profile.create'
  | 'profile.update'
  | 'profile.delete'
  | 'cycle.create'
  | 'cycle.update'
  | 'cycle.delete'
  | 'cycle.restore_defaults'
  | 'collaborator.create'
  | 'collaborator.update'
  | 'collaborator.delete'
  | 'manager.create'
  | 'manager.update'
  | 'manager.delete'
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'record.bulk_delete'
  | 'leave.create'
  | 'leave.update'
  | 'leave.delete'
  | 'import.confirm'
  | 'import.clear_data'
  | 'notification.mailto_generated'
  | 'settings.update'
  | 'export.json'
  | 'export.csv'
  | 'system.reset_database'
  | 'system.error';

export type AuditStatus = 'success' | 'warning' | 'error';

export type AuditEntityType =
  | 'access_profile'
  | 'company_cycle'
  | 'collaborator'
  | 'manager'
  | 'time_record'
  | 'leave'
  | 'import'
  | 'database'
  | 'notification'
  | 'app_setting'
  | 'system';

export type AuditLog = AuditLogRow;

/** Filtros de consulta da trilha de auditoria — todos opcionais, combinados com E. */
export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  actorRegistration?: string;
  action?: string;
  entityType?: string;
  status?: string;
  /** Busca livre em nome/matrícula/e-mail do ator, ação, entidade, rótulo da entidade, rota e tela. */
  search?: string;
  limit?: number;
}

/** Entrada aceita por createAuditLog — todos os campos de contexto são opcionais e, quando ausentes, o serviço tenta preenchê-los sozinho (ver auditLogService.ts). */
export interface CreateAuditLogPayload {
  action: AuditAction | string;
  status?: AuditStatus | string;
  actorRegistration?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  entityType?: AuditEntityType | string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  route?: string | null;
  screen?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

/** Um campo que mudou entre old_value e new_value — ver utils/audit.ts#diffObjects. */
export interface AuditDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export type AuditDiff = AuditDiffEntry[];
