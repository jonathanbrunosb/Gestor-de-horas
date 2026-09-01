-- Row Level Security — Monitor de Controles de Horas
--
-- ATENÇÃO (seção 10 do escopo do produto): o front-end é publicado no GitHub
-- Pages, um site público, e usa a chave "anon" do Supabase, que fica exposta
-- no bundle JS. Portanto:
--   * NUNCA use a service_role key no front-end.
--   * RLS é habilitado em TODAS as tabelas abaixo.
--   * Enquanto não houver Supabase Auth corporativo configurado, as políticas
--     abaixo liberam leitura/escrita para os papéis anon/authenticated —
--     a autorização por perfil (Desenvolvedor/Administrador/Gestor/
--     Facilitador/Sem acesso) é validada no FRONT-END (src/lib/permissions.ts),
--     o que NÃO é segurança real de borda. Isso é uma limitação conhecida do
--     MVP e está documentada no README.
--   * Quando Supabase Auth (e-mail corporativo) for habilitado, substitua as
--     políticas de escrita abaixo por versões que checam auth.jwt() ->> 'email'
--     contra access_profiles.email/access_type — exemplos comentados ao final
--     deste arquivo.

alter table companies enable row level security;
alter table company_cycles enable row level security;
alter table managers enable row level security;
alter table access_profiles enable row level security;
alter table collaborators enable row level security;
alter table time_records enable row level security;
alter table leaves enable row level security;
alter table imports enable row level security;
alter table app_settings enable row level security;
alter table notification_logs enable row level security;
alter table audit_logs enable row level security;

-- Cada política é recriada (drop if exists + create) para que este arquivo
-- possa ser colado mais de uma vez no SQL Editor sem erro "already exists".

-- companies: leitura ampla; escrita restrita a quem administra a solução (MVP: anon/authenticated).
drop policy if exists companies_select on companies;
create policy companies_select on companies for select using (true);
drop policy if exists companies_write on companies;
create policy companies_write on companies for all using (true) with check (true);

drop policy if exists company_cycles_select on company_cycles;
create policy company_cycles_select on company_cycles for select using (true);
drop policy if exists company_cycles_write on company_cycles;
create policy company_cycles_write on company_cycles for all using (true) with check (true);

drop policy if exists managers_select on managers;
create policy managers_select on managers for select using (true);
drop policy if exists managers_write on managers;
create policy managers_write on managers for all using (true) with check (true);

drop policy if exists access_profiles_select on access_profiles;
create policy access_profiles_select on access_profiles for select using (true);
drop policy if exists access_profiles_write on access_profiles;
create policy access_profiles_write on access_profiles for all using (true) with check (true);

drop policy if exists collaborators_select on collaborators;
create policy collaborators_select on collaborators for select using (true);
drop policy if exists collaborators_write on collaborators;
create policy collaborators_write on collaborators for all using (true) with check (true);

drop policy if exists time_records_select on time_records;
create policy time_records_select on time_records for select using (true);
drop policy if exists time_records_write on time_records;
create policy time_records_write on time_records for all using (true) with check (true);

drop policy if exists leaves_select on leaves;
create policy leaves_select on leaves for select using (true);
drop policy if exists leaves_write on leaves;
create policy leaves_write on leaves for all using (true) with check (true);

drop policy if exists imports_select on imports;
create policy imports_select on imports for select using (true);
drop policy if exists imports_write on imports;
create policy imports_write on imports for insert with check (true);

drop policy if exists app_settings_select on app_settings;
create policy app_settings_select on app_settings for select using (true);
drop policy if exists app_settings_write on app_settings;
create policy app_settings_write on app_settings for all using (true) with check (true);

drop policy if exists notification_logs_select on notification_logs;
create policy notification_logs_select on notification_logs for select using (true);
drop policy if exists notification_logs_write on notification_logs;
create policy notification_logs_write on notification_logs for insert with check (true);

-- audit_logs: somente inserção pelo front-end; nunca editável/removível por lá.
drop policy if exists audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs for select using (true);
drop policy if exists audit_logs_insert on audit_logs;
create policy audit_logs_insert on audit_logs for insert with check (true);

-- ══════════════════════════════════════════════════════════════
-- Exemplo de política reforçada para quando Supabase Auth estiver
-- configurado (login por e-mail corporativo). Mantido comentado —
-- ative substituindo as políticas de escrita acima por algo como:
-- ══════════════════════════════════════════════════════════════
--
-- create policy collaborators_write_authenticated on collaborators
--   for all
--   using (
--     exists (
--       select 1 from access_profiles p
--       where p.email = auth.jwt() ->> 'email'
--         and p.status = 'Ativo'
--         and p.access_type in ('Desenvolvedor', 'Administrador')
--     )
--   )
--   with check (
--     exists (
--       select 1 from access_profiles p
--       where p.email = auth.jwt() ->> 'email'
--         and p.status = 'Ativo'
--         and p.access_type in ('Desenvolvedor', 'Administrador')
--     )
--   );
