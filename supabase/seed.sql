-- Seed de DESENVOLVIMENTO — dados 100% fictícios para exercitar a aplicação
-- localmente. NÃO execute este arquivo em produção (supabase/migrations/
-- 0003_seed_initial_data.sql já cobre os dados obrigatórios de produção:
-- empresas, ciclos padrão e o perfil do Desenvolvedor).
--
-- Uso local:
--   supabase db reset          -- aplica migrations + este seed automaticamente
--   ou: psql "$DATABASE_URL" -f supabase/seed.sql

do $$
declare
  v_company_al uuid;
  v_company_ma uuid;
  v_company_pa uuid;
  v_manager_1 uuid;
  v_manager_2 uuid;
  v_collab_1 uuid;
  v_collab_2 uuid;
  v_collab_3 uuid;
  v_today date := current_date;
begin
  select id into v_company_al from companies where short_name = 'EQTL AL';
  select id into v_company_ma from companies where short_name = 'EQTL MA';
  select id into v_company_pa from companies where short_name = 'EQTL PA';

  insert into managers (name, registration, email, area, company_id, status)
  values ('Gestor Demonstração Um', 'gest0001', 'gestor.demo1@example.com', 'Contabilidade Corporativa', v_company_al, 'Ativo')
  returning id into v_manager_1;

  insert into managers (name, registration, email, area, company_id, status)
  values ('Gestor Demonstração Dois', 'gest0002', 'gestor.demo2@example.com', 'Contabilidade', v_company_ma, 'Ativo')
  returning id into v_manager_2;

  insert into collaborators (
    company_id, manager_id, name, registration, email, title, area, status, is_facilitator,
    previous_month_balance_minutes, month_credit_minutes, month_debit_minutes, month_balance_minutes,
    cycle_balance_minutes, bank_hours_balance_minutes, extra_50_minutes, extra_100_minutes, absence_delay_minutes
  ) values (
    v_company_al, v_manager_1, 'Ana Beatriz Lima (demo)', '01030051', 'ana.demo@example.com',
    'Analista de Contabilidade', 'Contabilidade', 'Ativo', false,
    260, 1355, 250, 1105, 1115, 1115, 300, 0, 0
  ) returning id into v_collab_1;

  insert into collaborators (
    company_id, manager_id, name, registration, email, title, area, status, is_facilitator,
    previous_month_balance_minutes, month_credit_minutes, month_debit_minutes, month_balance_minutes,
    cycle_balance_minutes, bank_hours_balance_minutes, extra_50_minutes, extra_100_minutes, absence_delay_minutes
  ) values (
    v_company_ma, v_manager_2, 'Bruna Almeida Torres (demo)', '02030082', 'bruna.demo@example.com',
    'Assistente de Contabilidade SR', 'Contabilidade', 'Ativo', true,
    90, 195, 575, -380, -380, -380, 0, 0, 75
  ) returning id into v_collab_2;

  insert into collaborators (
    company_id, manager_id, name, registration, email, title, area, status, is_facilitator,
    previous_month_balance_minutes, month_credit_minutes, month_debit_minutes, month_balance_minutes,
    cycle_balance_minutes, bank_hours_balance_minutes, extra_50_minutes, extra_100_minutes, absence_delay_minutes
  ) values (
    v_company_pa, v_manager_1, 'Teresa Cristina Santos (demo)', '08030051', 'teresa.demo@example.com',
    'Analista de Contabilidade', 'Contabilidade', 'Ativo', false,
    260, 870, 140, 730, 730, 730, 0, 0, 0
  ) returning id into v_collab_3;

  -- Alguns registros de ponto no mês corrente para os 3 colaboradores demo.
  insert into time_records (collaborator_id, period, record_date, weekday, schedule_code, punches, occurrence, worked_minutes, credit_bh_minutes, debit_bh_minutes, balance_bh_minutes, day_type)
  select
    v_collab_1,
    to_char(v_today, 'YYYY-MM'),
    date_trunc('month', v_today)::date + (n - 1),
    to_char(date_trunc('month', v_today)::date + (n - 1), 'DY'),
    '0001',
    '["07:40", "11:45", "13:50", "17:35"]'::jsonb,
    case when n % 3 = 0 then 'Crédito Banco de Horas' else 'Débito Banco de Horas' end,
    450,
    case when n % 3 = 0 then 70 else 0 end,
    case when n % 3 <> 0 then 18 else 0 end,
    case when n % 3 = 0 then 70 else -18 end,
    'Normal'
  from generate_series(1, 10) as n
  on conflict do nothing;

  insert into leaves (collaborator_id, company_id, leave_date, reason, source)
  values (v_collab_3, v_company_pa, date_trunc('month', v_today)::date + 19, 'Compensação de banco de horas', 'manual')
  on conflict do nothing;

  insert into app_settings (setting_key, setting_value)
  values ('gestao_config', '{"custoHora": 35, "adicionalPct": 50}'::jsonb)
  on conflict (setting_key) do nothing;
end $$;
