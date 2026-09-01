/**
 * Tipos espelhando as tabelas do Supabase/PostgreSQL definidas em
 * supabase/migrations/0001_create_schema.sql. Minutos são a unidade de
 * armazenamento para todo saldo/duração — nunca strings "HH:MM" no banco.
 */

// Ordem reflete a hierarquia real dos cargos: Gerente está acima de Executivo
// (Executivo é restrito ao próprio time; Gerente enxerga tudo).
export type AccessType = 'Desenvolvedor' | 'Administrador' | 'Gerente' | 'Executivo' | 'Facilitador' | 'Colaborador' | 'Sem acesso';
export type PersonStatus = 'Ativo' | 'Inativo';
export type ImportStatus = 'Concluído' | 'Concluído com avisos' | 'Falhou';
export type ImportFileType = 'csv' | 'txt' | 'pdf' | 'json';
export type DayType = 'Normal' | 'Não útil' | 'Férias';

export interface CompanyRow {
  id: string;
  code: string | null;
  name: string;
  short_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyCycleRow {
  id: string;
  company_id: string;
  start_month: string; // YYYY-MM
  periodicity_months: 3 | 4;
  positive_alert_minutes: number;
  negative_alert_minutes: number;
  responsible: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagerRow {
  id: string;
  name: string;
  registration: string;
  email: string;
  area: string;
  company_id: string | null;
  status: PersonStatus;
  created_at: string;
  updated_at: string;
}

export interface AccessProfileRow {
  id: string;
  name: string;
  registration: string;
  email: string | null;
  title: string | null;
  area: string | null;
  access_type: AccessType;
  status: PersonStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaboratorRow {
  id: string;
  company_id: string;
  manager_id: string | null;
  name: string;
  registration: string;
  email: string | null;
  title: string | null;
  area: string;
  status: PersonStatus;
  is_facilitator: boolean;

  previous_month_balance_minutes: number;
  month_credit_minutes: number;
  month_debit_minutes: number;
  month_balance_minutes: number;
  cycle_balance_minutes: number;
  bank_hours_balance_minutes: number;
  extra_50_minutes: number;
  extra_100_minutes: number;
  absence_delay_minutes: number;

  legacy_manager_name: string | null;
  manager_email: string | null;
  manager_registration: string | null;

  created_at: string;
  updated_at: string;
}

export interface TimeRecordRow {
  id: string;
  collaborator_id: string;
  period: string | null; // YYYY-MM
  record_date: string; // YYYY-MM-DD
  weekday: string | null;
  schedule_code: string | null;
  punches: string[]; // marcações HH:MM, jsonb
  occurrence: string | null;
  worked_minutes: number;
  credit_bh_minutes: number;
  debit_bh_minutes: number;
  balance_bh_minutes: number;
  night_minutes: number;
  extra_50_minutes: number;
  extra_100_minutes: number;
  day_type: DayType;
  created_at: string;
  updated_at: string;
}

export interface LeaveRow {
  id: string;
  collaborator_id: string;
  company_id: string | null;
  leave_date: string; // YYYY-MM-DD
  reason: string;
  notes: string | null;
  source: string;
  start_time: string | null; // HH:MM
  end_time: string | null; // HH:MM
  compensated_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ImportRow {
  id: string;
  filename: string | null;
  file_type: ImportFileType | null;
  source: string | null;
  rows_read: number;
  records_inserted: number;
  collaborators_created: number;
  collaborators_updated: number;
  duplicate_records: number;
  skipped_rows: number;
  status: ImportStatus;
  messages: string[];
  created_by_registration: string | null;
  created_at: string;
}

export interface AppSettingRow {
  id: string;
  setting_key: string;
  setting_value: unknown;
  created_at: string;
  updated_at: string;
}

export interface NotificationLogRow {
  id: string;
  collaborator_id: string | null;
  manager_id: string | null;
  notification_type: string | null;
  to_email: string | null;
  cc_email: string | null;
  subject: string | null;
  body: string | null;
  mailto_url: string | null;
  status: string;
  created_by_registration: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_registration: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export interface GestaoConfigValue {
  custoHora: number;
  adicionalPct: number;
}
