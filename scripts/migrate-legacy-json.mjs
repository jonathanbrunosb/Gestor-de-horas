#!/usr/bin/env node
/**
 * Migra uma base JSON legada (export completo do sistema antigo, ou o
 * "Exportar backup JSON" desta aplicação) para o Supabase.
 *
 * Uso:
 *   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=eyJ... \
 *   node scripts/migrate-legacy-json.mjs caminho/para/base.json
 *
 * Ou, se já tiver um .env preenchido na raiz do projeto:
 *   npm run migrate:legacy -- caminho/para/base.json
 *
 * Idempotente: pode ser rodado mais de uma vez sem duplicar dados —
 * casa colaboradores/gestores/perfis por matrícula e registros/folgas
 * pelas mesmas chaves únicas usadas no schema (ver 0001_create_schema.sql).
 *
 * Nunca sobrescreve o perfil protegido do Desenvolvedor (u1205385) com um
 * tipo de acesso diferente de "Desenvolvedor", mesmo que o JSON diga outra
 * coisa — mesma regra aplicada em src/services/accessProfilesService.ts.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY) como variáveis de ambiente antes de rodar.'
  );
  process.exit(1);
}
if (!filePath) {
  console.error('Uso: node scripts/migrate-legacy-json.mjs <caminho-para-base.json>');
  process.exit(1);
}

// Este script não lê .env automaticamente — exporte as variáveis no shell
// antes de rodar (ou rode com `env $(cat .env | xargs) node scripts/...`).
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function timeToMinutes(value) {
  if (value === null || value === undefined) return 0;
  let text = String(value).trim();
  if (!text || text === '-') return 0;
  text = text.replace(',', ':');
  let sign = 1;
  if (text.endsWith('-')) {
    sign = -1;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  }
  const match = text.match(/^(\d{1,5}):(\d{2})$/);
  if (!match) return 0;
  return sign * (parseInt(match[1], 10) * 60 + parseInt(match[2], 10));
}

function normalizeMatricula(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function main() {
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`Lendo ${filePath}`);
  console.log(`  collaborators: ${data.collaborators?.length ?? 0}`);
  console.log(`  managers: ${data.managers?.length ?? 0}`);
  console.log(`  records: ${data.records?.length ?? 0}`);
  console.log(`  leaves: ${data.leaves?.length ?? 0}`);
  console.log(`  cycles: ${data.cycles?.length ?? 0}`);
  console.log(`  userProfiles: ${data.userProfiles?.length ?? 0}`);
  console.log('');

  // 1. Empresas — devem já existir via migration 0003; só carrega o mapa short_name -> row.
  const { data: companies, error: companiesError } = await supabase.from('companies').select('*');
  if (companiesError) throw companiesError;
  const companyByShortName = new Map(companies.map((c) => [c.short_name, c]));

  // 2. Gestores (upsert por matrícula)
  const managerByRegistration = new Map();
  for (const item of data.managers ?? []) {
    const registration = normalizeMatricula(item.matricula);
    if (!registration) continue;
    const company = companyByShortName.get(item.empresa) ?? null;
    const payload = {
      name: item.nome,
      registration,
      email: item.email || `${registration}@sem-email.invalido`,
      area: item.area || 'Contabilidade',
      company_id: company?.id ?? null,
      status: item.status === 'Inativo' ? 'Inativo' : 'Ativo'
    };
    const { data: existing } = await supabase.from('managers').select('*').eq('registration', registration).maybeSingle();
    let row;
    if (existing) {
      const { data: updated, error } = await supabase.from('managers').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = updated;
    } else {
      const { data: created, error } = await supabase.from('managers').insert(payload).select().single();
      if (error) throw error;
      row = created;
    }
    managerByRegistration.set(registration, row);
  }
  console.log(`Gestores processados: ${managerByRegistration.size}`);

  // 3. Ciclos por empresa (um por empresa — atualiza se já existir)
  let cyclesProcessed = 0;
  for (const item of data.cycles ?? []) {
    const company = companyByShortName.get(item.empresa);
    if (!company) {
      console.warn(`  Ciclo ignorado — empresa não encontrada: ${item.empresa}`);
      continue;
    }
    const payload = {
      company_id: company.id,
      start_month: item.inicioCiclo,
      periodicity_months: item.periodicidadeMeses,
      positive_alert_minutes: timeToMinutes(item.limiteAlertaPositivo),
      negative_alert_minutes: timeToMinutes(item.limiteAlertaNegativo),
      responsible: item.responsavel || 'Contabilidade Corporativa',
      active: true
    };
    const { data: existing } = await supabase.from('company_cycles').select('id').eq('company_id', company.id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('company_cycles').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('company_cycles').insert(payload);
      if (error) throw error;
    }
    cyclesProcessed++;
  }
  console.log(`Ciclos processados: ${cyclesProcessed}`);

  // 4. Colaboradores (upsert por empresa+matrícula), com saldos convertidos para minutos
  const collaboratorByLegacyId = new Map();
  for (const item of data.collaborators ?? []) {
    const company = companyByShortName.get(item.empresa);
    if (!company) {
      console.warn(`  Colaborador ignorado — empresa não encontrada: ${item.nome} (${item.empresa})`);
      continue;
    }
    const registration = String(item.matricula ?? '').trim();
    const managerReg = normalizeMatricula(item.gestorMatricula);
    const manager = managerReg ? managerByRegistration.get(managerReg) : null;

    const payload = {
      company_id: company.id,
      manager_id: manager?.id ?? null,
      name: item.nome,
      registration,
      email: item.email || null,
      title: item.cargo || null,
      area: item.area || 'Contabilidade',
      status: item.status === 'Inativo' ? 'Inativo' : 'Ativo',
      is_facilitator: Boolean(item.facilitador),
      previous_month_balance_minutes: timeToMinutes(item.saldoMesAnterior),
      month_credit_minutes: timeToMinutes(item.creditoMes),
      month_debit_minutes: timeToMinutes(item.debitoMes),
      month_balance_minutes: timeToMinutes(item.saldoMes),
      cycle_balance_minutes: timeToMinutes(item.saldoCiclo),
      bank_hours_balance_minutes: timeToMinutes(item.saldoBancoHoras),
      extra_50_minutes: timeToMinutes(item.horasExtras50),
      extra_100_minutes: timeToMinutes(item.horasExtras100),
      absence_delay_minutes: timeToMinutes(item.faltasAtrasos),
      legacy_manager_name: manager ? null : item.gestor || null,
      manager_email: manager ? null : item.gestorEmail || null,
      manager_registration: manager ? null : managerReg || null
    };

    const { data: existing } = await supabase
      .from('collaborators')
      .select('*')
      .eq('company_id', company.id)
      .eq('registration', registration)
      .maybeSingle();
    let row;
    if (existing) {
      const { data: updated, error } = await supabase.from('collaborators').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = updated;
    } else {
      const { data: created, error } = await supabase.from('collaborators').insert(payload).select().single();
      if (error) throw error;
      row = created;
    }
    collaboratorByLegacyId.set(item.id, row);
  }
  console.log(`Colaboradores processados: ${collaboratorByLegacyId.size}`);

  // 5. Registros de ponto (upsert em lote, ignora duplicados pela constraint única)
  const recordRows = [];
  for (const item of data.records ?? []) {
    const collaborator = collaboratorByLegacyId.get(item.colaboradorId);
    if (!collaborator) continue;
    recordRows.push({
      collaborator_id: collaborator.id,
      period: item.periodo || item.data?.slice(0, 7) || null,
      record_date: item.data,
      weekday: item.diaSemana || null,
      schedule_code: item.codigoHorario || null,
      punches: item.marcacoes || [],
      occurrence: item.ocorrencia || null,
      worked_minutes: timeToMinutes(item.horasTrabalhadas),
      credit_bh_minutes: timeToMinutes(item.creditoBH),
      debit_bh_minutes: timeToMinutes(item.debitoBH),
      balance_bh_minutes: timeToMinutes(item.saldoBH),
      night_minutes: timeToMinutes(item.adicionalNoturno),
      extra_50_minutes: timeToMinutes(item.extra50),
      extra_100_minutes: timeToMinutes(item.extra100),
      day_type: ['Normal', 'Não útil', 'Férias'].includes(item.tipoDia) ? item.tipoDia : 'Normal'
    });
  }
  let recordsInserted = 0;
  for (const batch of chunk(recordRows, 500)) {
    const { data: inserted, error } = await supabase
      .from('time_records')
      .upsert(batch, { onConflict: 'collaborator_id,record_date,period', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    recordsInserted += inserted?.length ?? 0;
  }
  console.log(`Registros de ponto inseridos: ${recordsInserted} de ${recordRows.length} (restante já existia ou foi ignorado)`);

  // 6. Folgas (upsert em lote pela constraint única collaborator_id+leave_date)
  const leaveRows = [];
  for (const item of data.leaves ?? []) {
    const collaborator = collaboratorByLegacyId.get(item.colaboradorId);
    if (!collaborator) continue;
    const company = companyByShortName.get(item.empresa) ?? null;
    leaveRows.push({
      collaborator_id: collaborator.id,
      company_id: company?.id ?? collaborator.company_id,
      leave_date: item.data,
      reason: item.motivo || 'Compensação de banco de horas',
      notes: item.observacao || null,
      source: 'legacy-import'
    });
  }
  let leavesInserted = 0;
  for (const batch of chunk(leaveRows, 500)) {
    const { data: inserted, error } = await supabase
      .from('leaves')
      .upsert(batch, { onConflict: 'collaborator_id,leave_date', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    leavesInserted += inserted?.length ?? 0;
  }
  console.log(`Folgas inseridas: ${leavesInserted} de ${leaveRows.length} (restante já existia ou foi ignorado)`);

  // 7. Perfis de acesso (nunca rebaixa o perfil protegido do Desenvolvedor)
  let profilesProcessed = 0;
  for (const item of data.userProfiles ?? []) {
    const registration = normalizeMatricula(item.matricula);
    if (!registration) continue;
    const isProtected = registration === 'u1205385';
    const payload = {
      name: item.nome,
      email: item.email || null,
      title: item.cargo || null,
      area: item.area || null,
      access_type: isProtected ? 'Desenvolvedor' : item.tipo || 'Sem acesso',
      status: isProtected ? 'Ativo' : item.status === 'Inativo' ? 'Inativo' : 'Ativo',
      notes: item.observacao || null
    };
    const { data: existing } = await supabase.from('access_profiles').select('id').eq('registration', registration).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('access_profiles').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('access_profiles').insert({ ...payload, registration });
      if (error) throw error;
    }
    profilesProcessed++;
  }
  console.log(`Perfis de acesso processados: ${profilesProcessed}`);

  // 8. Parâmetros de Gestão BH
  if (data.gestaoConfig) {
    const { error } = await supabase.from('app_settings').upsert(
      {
        setting_key: 'gestao_config',
        setting_value: {
          custoHora: data.gestaoConfig.custoHora ?? 35,
          adicionalPct: data.gestaoConfig.adicionalPct ?? 50
        }
      },
      { onConflict: 'setting_key' }
    );
    if (error) throw error;
    console.log('Parâmetros de Gestão BH atualizados.');
  }

  console.log('\nMigração concluída com sucesso.');
}

main().catch((err) => {
  console.error('\nErro na migração:', err);
  process.exit(1);
});
