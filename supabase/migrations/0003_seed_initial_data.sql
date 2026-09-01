-- Dados de referência obrigatórios em QUALQUER ambiente (produção incluída):
-- empresas/códigos oficiais, ciclos padrão e o perfil do Desenvolvedor
-- (u1205385), que deve sempre existir para permitir o primeiro acesso à
-- solução. Dados fictícios de demonstração ficam em supabase/seed.sql
-- (uso restrito a ambiente de desenvolvimento).

insert into companies (code, name, short_name) values
  ('0001', 'Equatorial Maranhão', 'EQTL MA'),
  ('0011', 'Equatorial Piauí', 'EQTL PI'),
  ('0012', 'Equatorial Alagoas', 'EQTL AL'),
  ('0014', 'Equatorial CEEE', 'EQTL CEEE'),
  ('0015', 'Equatorial CEA', 'EQTL CEA'),
  ('0016', 'CSA', 'CSA'),
  ('0021', 'Equatorial Goiás', 'EQTL GO'),
  ('0100', 'Equatorial Pará', 'EQTL PA')
on conflict (code) do nothing;

-- Ciclo padrão (4 meses, limites 10:00 / -05:00) a partir do mês corrente,
-- para todas as empresas. Ajustável depois em Configurações > Ciclos.
insert into company_cycles (company_id, start_month, periodicity_months, positive_alert_minutes, negative_alert_minutes, responsible)
select id, to_char(now(), 'YYYY-MM'), 4, 600, -300, 'Contabilidade Corporativa'
from companies
on conflict do nothing;

-- Perfil do Desenvolvedor — protegido, nunca excluído pela aplicação
-- (ver src/lib/permissions.ts e src/services/accessProfilesService.ts).
-- Renomeie o campo "name" após o primeiro acesso em Configurações > Perfil do usuário.
insert into access_profiles (name, registration, email, title, area, access_type, status, notes)
values (
  'Desenvolvedor da Solução',
  'u1205385',
  null,
  'Desenvolvedor / Administrador da solução',
  'Contabilidade IV',
  'Desenvolvedor',
  'Ativo',
  'Perfil protegido — criado automaticamente pela migration inicial.'
)
on conflict (registration) do nothing;
