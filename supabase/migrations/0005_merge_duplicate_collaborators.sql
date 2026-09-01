-- Corrige a causa raiz descoberta em produção: uploads de folha de ponto de
-- períodos diferentes vinham com a mesma matrícula formatada de jeitos
-- diferentes (ex.: "1009912" x "001009912" para a mesma pessoa), e o sistema
-- tratava isso como dois colaboradores distintos, duplicando o cadastro.
--
-- Esta migration é uma correção de dados ÚNICA (não roda em todo deploy):
-- 1) localiza colaboradores da mesma empresa cuja matrícula, ao remover
--    zeros à esquerda, é idêntica;
-- 2) mantém o cadastro mais antigo (survivor) e move para ele todos os
--    registros de ponto (time_records) e folgas (leaves) do(s) duplicado(s);
-- 3) remove o(s) cadastro(s) duplicado(s), já esvaziado(s);
-- 4) só então normaliza a matrícula do survivor para a forma sem zeros à
--    esquerda (mesma forma que o código passa a gravar a partir de agora) —
--    feito por último para nunca colidir com a unique (company_id, registration)
--    de um duplicado que ainda não tenha sido removido.
--
-- Tudo dentro de uma única transação: se algo falhar, nada é alterado.
-- Idempotente: rodar de novo não encontra mais duplicados e não faz nada.
-- Testado localmente em Postgres 16 com cenários sintéticos (par simples,
-- trio de duplicados e casos com data de batida/folga coincidente) antes de
-- ser publicada aqui.

begin;

create temp table _dup_groups as
select
  company_id,
  norm_registration,
  survivor_id,
  duplicate_ids
from (
  select
    company_id,
    case when registration ~ '^\d+$' then ltrim(registration, '0') else registration end as norm_registration,
    array_agg(id order by created_at asc) as ids
  from collaborators
  group by company_id, case when registration ~ '^\d+$' then ltrim(registration, '0') else registration end
  having count(*) > 1
) g
cross join lateral (
  select g.ids[1] as survivor_id, g.ids[2:array_length(g.ids, 1)] as duplicate_ids
) split;

-- Move registros de ponto dos duplicados para o survivor (a unique
-- (collaborator_id, record_date, period) pode gerar conflito genuíno se as
-- duas linhas tiverem batida no mesmo dia; nesse caso mantém a do survivor
-- e descarta a do duplicado, já que representam o mesmo evento).
delete from time_records tr
using _dup_groups g, unnest(g.duplicate_ids) as dup_id
where tr.collaborator_id = dup_id
  and exists (
    select 1 from time_records tr2
    where tr2.collaborator_id = g.survivor_id
      and tr2.record_date = tr.record_date
      and coalesce(tr2.period, '') = coalesce(tr.period, '')
  );

update time_records tr
set collaborator_id = g.survivor_id
from _dup_groups g, unnest(g.duplicate_ids) as dup_id
where tr.collaborator_id = dup_id;

-- Move folgas, descartando duplicidade de data (mesma regra acima).
delete from leaves l
using _dup_groups g, unnest(g.duplicate_ids) as dup_id
where l.collaborator_id = dup_id
  and exists (
    select 1 from leaves l2
    where l2.collaborator_id = g.survivor_id
      and l2.leave_date = l.leave_date
  );

update leaves l
set collaborator_id = g.survivor_id
from _dup_groups g, unnest(g.duplicate_ids) as dup_id
where l.collaborator_id = dup_id;

-- Remove os cadastros duplicados, já sem nenhum registro/folga pendurado.
-- Feito ANTES de renomear o survivor, para nunca colidir com a matrícula
-- normalizada de um duplicado que por acaso já esteja sem zeros à esquerda.
delete from collaborators c
using _dup_groups g, unnest(g.duplicate_ids) as dup_id
where c.id = dup_id;

-- Normaliza a matrícula do survivor (sem zeros à esquerda) para casar com o
-- que o código passa a gravar a partir desta correção.
update collaborators c
set registration = g.norm_registration
from _dup_groups g
where c.id = g.survivor_id
  and c.registration <> g.norm_registration;

drop table _dup_groups;

commit;
