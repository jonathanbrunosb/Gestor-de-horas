-- Estende audit_logs com o contexto completo da trilha de auditoria
-- (Configurações → Auditoria): quem fez, com qual perfil, de onde, com qual
-- resultado — além do que já existia (ator/ação/entidade/valores antigo e
-- novo). Idempotente (add column if not exists / create index if not
-- exists / drop+create policy) — seguro colar mais de uma vez no SQL Editor.
--
-- ip_address nunca é preenchido pelo front-end sozinho: o React não tem
-- acesso confiável ao IP do usuário. Ele só é preenchido quando a Edge
-- Function opcional supabase/functions/log-audit-event está publicada (lê o
-- IP dos headers da requisição no servidor) — caso contrário fica null e a
-- tela de Auditoria mostra "Não capturado". Ver README (seção "Trilha de
-- Auditoria") para os detalhes dessa limitação de MVP.

begin;

alter table audit_logs add column if not exists actor_profile_id uuid references access_profiles(id) on delete set null;
alter table audit_logs add column if not exists actor_name text;
alter table audit_logs add column if not exists actor_email text;
alter table audit_logs add column if not exists actor_role text;
alter table audit_logs add column if not exists entity_label text;
alter table audit_logs add column if not exists route text;
alter table audit_logs add column if not exists screen text;
alter table audit_logs add column if not exists metadata jsonb;
alter table audit_logs add column if not exists ip_address text;
alter table audit_logs add column if not exists user_agent text;
alter table audit_logs add column if not exists status text not null default 'success';
alter table audit_logs add column if not exists error_message text;

-- created_at (desc) e (entity_type, entity_id) já são indexados desde
-- 0001_create_schema.sql — o composto também atende buscas só por
-- entity_type, então não é duplicado aqui.
create index if not exists idx_audit_logs_actor_registration on audit_logs(actor_registration);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_status on audit_logs(status);

commit;

-- ══════════════════════════════════════════════════════════════
-- RLS de audit_logs: nenhuma política nova aqui — as duas de
-- 0002_create_rls_policies.sql (audit_logs_select: using(true) e
-- audit_logs_insert: with check(true)) continuam valendo, e não existem
-- políticas de update/delete, então a UI nunca consegue editar nem excluir
-- um log (RLS nega por padrão o que não tem política — critérios 8/9 do
-- escopo). É o MESMO modelo MVP das demais tabelas deste projeto (ver o
-- cabeçalho de 0002): sem Supabase Auth corporativo configurado, não há
-- auth.jwt() real para checar, então a política de leitura restrita a
-- Desenvolvedor/Administrador sugerida no escopo do produto NÃO é ativada
-- aqui — ativá-la sem Auth faria auth.jwt()->>'email' ser sempre nulo e
-- devolveria a tabela de auditoria vazia para todo mundo, inclusive quem
-- deveria vê-la. A restrição de leitura por perfil é aplicada no FRONT-END
-- (lib/permissions.ts#canViewAuditLogs), o que NÃO é segurança de borda —
-- limitação conhecida do MVP, documentada no README.
--
-- Quando Supabase Auth (e-mail corporativo) estiver configurado, troque a
-- política de leitura por algo como:
--
-- drop policy if exists audit_logs_select on audit_logs;
-- create policy audit_logs_select_admins on audit_logs
--   for select
--   using (
--     exists (
--       select 1 from access_profiles ap
--       where lower(trim(ap.email)) = lower(trim(auth.jwt() ->> 'email'))
--         and ap.status = 'Ativo'
--         and ap.access_type in ('Desenvolvedor', 'Administrador')
--     )
--   );
-- ══════════════════════════════════════════════════════════════
