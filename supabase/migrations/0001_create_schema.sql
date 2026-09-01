-- Monitor de Controles de Horas — schema inicial
-- Todas as durações/saldos são armazenados em MINUTOS inteiros (nunca strings "HH:MM").

create extension if not exists "pgcrypto";

-- Função utilitária para manter updated_at sempre atualizado.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ══════════════════════════════════════════════════════════════
-- companies
-- ══════════════════════════════════════════════════════════════
create table companies (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  short_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- company_cycles
-- ══════════════════════════════════════════════════════════════
create table company_cycles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  start_month text not null,
  periodicity_months integer not null check (periodicity_months in (3, 4)),
  positive_alert_minutes integer not null default 600,
  negative_alert_minutes integer not null default -300,
  responsible text not null default 'Contabilidade Corporativa',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_start_month_format check (start_month ~ '^\d{4}-\d{2}$')
);

create index idx_company_cycles_company_id on company_cycles(company_id);

create trigger trg_company_cycles_updated_at before update on company_cycles
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- managers
-- ══════════════════════════════════════════════════════════════
create table managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration text not null unique,
  email text not null unique,
  area text not null default 'Contabilidade',
  company_id uuid references companies(id),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_managers_company_id on managers(company_id);

create trigger trg_managers_updated_at before update on managers
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- access_profiles
-- ══════════════════════════════════════════════════════════════
create table access_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration text not null unique,
  email text,
  title text,
  area text,
  access_type text not null check (access_type in ('Desenvolvedor', 'Administrador', 'Gestor', 'Facilitador', 'Sem acesso')),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_access_profiles_updated_at before update on access_profiles
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- collaborators
-- ══════════════════════════════════════════════════════════════
create table collaborators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  manager_id uuid references managers(id),
  name text not null,
  registration text not null,
  email text,
  title text,
  area text not null default 'Contabilidade',
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  is_facilitator boolean not null default false,

  previous_month_balance_minutes integer not null default 0,
  month_credit_minutes integer not null default 0,
  month_debit_minutes integer not null default 0,
  month_balance_minutes integer not null default 0,
  cycle_balance_minutes integer not null default 0,
  bank_hours_balance_minutes integer not null default 0,
  extra_50_minutes integer not null default 0,
  extra_100_minutes integer not null default 0,
  absence_delay_minutes integer not null default 0,

  legacy_manager_name text,
  manager_email text,
  manager_registration text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_collaborator_name_not_blank check (btrim(name) <> ''),
  constraint chk_collaborator_registration_not_blank check (btrim(registration) <> ''),
  unique (company_id, registration)
);

create index idx_collaborators_company_id on collaborators(company_id);
create index idx_collaborators_manager_id on collaborators(manager_id);
create index idx_collaborators_status on collaborators(status);

create trigger trg_collaborators_updated_at before update on collaborators
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- time_records
-- ══════════════════════════════════════════════════════════════
create table time_records (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references collaborators(id) on delete cascade,
  period text,
  record_date date not null,
  weekday text,
  schedule_code text,
  punches jsonb not null default '[]'::jsonb,
  occurrence text,
  worked_minutes integer not null default 0,
  credit_bh_minutes integer not null default 0,
  debit_bh_minutes integer not null default 0,
  balance_bh_minutes integer not null default 0,
  night_minutes integer not null default 0,
  extra_50_minutes integer not null default 0,
  extra_100_minutes integer not null default 0,
  day_type text not null default 'Normal' check (day_type in ('Normal', 'Não útil', 'Férias')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (collaborator_id, record_date, period)
);

create index idx_time_records_collaborator_id on time_records(collaborator_id);
create index idx_time_records_period on time_records(period);
create index idx_time_records_record_date on time_records(record_date);

create trigger trg_time_records_updated_at before update on time_records
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- leaves
-- ══════════════════════════════════════════════════════════════
create table leaves (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references collaborators(id) on delete cascade,
  company_id uuid references companies(id),
  leave_date date not null,
  reason text not null default 'Compensação de banco de horas',
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (collaborator_id, leave_date)
);

create index idx_leaves_collaborator_id on leaves(collaborator_id);
create index idx_leaves_leave_date on leaves(leave_date);

create trigger trg_leaves_updated_at before update on leaves
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- imports
-- ══════════════════════════════════════════════════════════════
create table imports (
  id uuid primary key default gen_random_uuid(),
  filename text,
  file_type text check (file_type in ('csv', 'txt', 'pdf', 'json')),
  source text,
  rows_read integer not null default 0,
  records_inserted integer not null default 0,
  collaborators_created integer not null default 0,
  collaborators_updated integer not null default 0,
  duplicate_records integer not null default 0,
  skipped_rows integer not null default 0,
  status text not null default 'Concluído',
  messages jsonb not null default '[]'::jsonb,
  created_by_registration text,
  created_at timestamptz not null default now()
);

create index idx_imports_created_at on imports(created_at desc);

-- ══════════════════════════════════════════════════════════════
-- app_settings
-- ══════════════════════════════════════════════════════════════
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique not null,
  setting_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- notification_logs
-- ══════════════════════════════════════════════════════════════
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid references collaborators(id),
  manager_id uuid references managers(id),
  notification_type text,
  to_email text,
  cc_email text,
  subject text,
  body text,
  mailto_url text,
  status text not null default 'Gerado',
  created_by_registration text,
  created_at timestamptz not null default now()
);

create index idx_notification_logs_collaborator_id on notification_logs(collaborator_id);

-- ══════════════════════════════════════════════════════════════
-- audit_logs
-- ══════════════════════════════════════════════════════════════
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_registration text,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created_at on audit_logs(created_at desc);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
