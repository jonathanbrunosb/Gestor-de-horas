-- Substitui o perfil de acesso "Gestor" (visão irrestrita de toda a base,
-- igual para qualquer gestor) por dois perfis:
--   "Executivo" — enxerga só os colaboradores do próprio time (vinculado
--     pela matrícula ao registro em managers, e daí a collaborators.manager_id).
--   "Gerente" — mantém a visão irrestrita que "Gestor" já tinha hoje.
--
-- Perfis já cadastrados como "Gestor" viram "Gerente" (preserva o acesso
-- amplo que já tinham, sem reduzir nada por conta própria) — quem deve virar
-- "Executivo" (restrito ao próprio time) precisa ser ajustado manualmente em
-- Configurações → Perfis de acesso, pessoa a pessoa, já que só quem está
-- operando o sistema sabe quem realmente deveria ver só a própria equipe.
--
-- Transação única (tudo ou nada) e idempotente — seguro colar mais de uma
-- vez no SQL Editor; na segunda execução não há mais nenhuma linha "Gestor"
-- para migrar e a constraint já está no formato final.

begin;

alter table access_profiles drop constraint if exists access_profiles_access_type_check;
alter table access_profiles
  add constraint access_profiles_access_type_check
  check (access_type in ('Desenvolvedor', 'Administrador', 'Gestor', 'Executivo', 'Gerente', 'Facilitador', 'Sem acesso', 'Colaborador'));

update access_profiles set access_type = 'Gerente' where access_type = 'Gestor';

alter table access_profiles drop constraint if exists access_profiles_access_type_check;
alter table access_profiles
  add constraint access_profiles_access_type_check
  check (access_type in ('Desenvolvedor', 'Administrador', 'Executivo', 'Gerente', 'Facilitador', 'Sem acesso', 'Colaborador'));

commit;
