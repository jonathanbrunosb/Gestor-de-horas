-- Adiciona o tipo de acesso "Colaborador" (autoatendimento): perfil restrito
-- que só enxerga o próprio Controle de Horas, vinculado pela matrícula.
-- Idempotente — seguro colar mais de uma vez no SQL Editor.

alter table access_profiles drop constraint if exists access_profiles_access_type_check;
alter table access_profiles
  add constraint access_profiles_access_type_check
  check (access_type in ('Desenvolvedor', 'Administrador', 'Gestor', 'Facilitador', 'Sem acesso', 'Colaborador'));
