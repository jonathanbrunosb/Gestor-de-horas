import { getSupabase } from '../lib/supabaseClient';
import type { CollaboratorRow, CompanyRow, ManagerRow } from '../types/database';
import type { LegacyJsonExport } from '../types/imports';
import {
  extractLegacyAccessProfiles,
  normalizeLegacyAccessProfile,
  normalizeLegacyCollaborator,
  normalizeLegacyCycle,
  normalizeLegacyManager,
  resolveDayType
} from '../utils/imports';
import { timeToMinutes } from '../utils/time';
import { normalizeMatricula, isDeveloperMatricula } from '../lib/permissions';
import { recordAuditLog } from './auditLogService';

export interface JsonImportSummary {
  managersCreated: number;
  managersUpdated: number;
  cyclesProcessed: number;
  collaboratorsCreated: number;
  collaboratorsUpdated: number;
  recordsInserted: number;
  recordsSkipped: number;
  leavesInserted: number;
  leavesSkipped: number;
  profilesCreated: number;
  profilesSkippedProtected: number;
}

function chunk<T>(array: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/**
 * Mescla um backup JSON completo (exportado por esta aplicação ou pelo
 * sistema legado) com os dados já existentes no Supabase — companies,
 * managers, company_cycles, collaborators (com saldos), time_records,
 * leaves e access_profiles. Roda inteiramente no navegador, usando a mesma
 * sessão Supabase da aplicação (sem depender de nenhuma ferramenta externa).
 *
 * Nunca duplica colaboradores/gestores (chave empresa+matrícula / matrícula),
 * nunca cria gestores automaticamente a partir do texto do colaborador e
 * nunca sobrescreve o perfil protegido do Desenvolvedor.
 */
export async function importLegacyJson(
  payload: LegacyJsonExport,
  companies: CompanyRow[],
  actorRegistration: string | null
): Promise<JsonImportSummary> {
  const supabase = getSupabase();
  const summary: JsonImportSummary = {
    managersCreated: 0,
    managersUpdated: 0,
    cyclesProcessed: 0,
    collaboratorsCreated: 0,
    collaboratorsUpdated: 0,
    recordsInserted: 0,
    recordsSkipped: 0,
    leavesInserted: 0,
    leavesSkipped: 0,
    profilesCreated: 0,
    profilesSkippedProtected: 0
  };

  const companyByShortName = new Map(companies.map((c) => [c.short_name, c]));

  // 1. Gestores
  const { data: existingManagers } = await supabase.from('managers').select('*');
  const managersByRegistration = new Map<string, ManagerRow>((existingManagers ?? []).map((m) => [normalizeMatricula(m.registration), m]));

  for (const rawManager of payload.managers ?? []) {
    const normalized = normalizeLegacyManager(rawManager);
    if (!normalized.name || !normalized.registration) continue;
    const company = companyByShortName.get(normalized.company);
    const existing = managersByRegistration.get(normalized.registration);
    if (existing) {
      const { data: updated } = await supabase
        .from('managers')
        .update({ name: normalized.name, email: normalized.email || existing.email, area: normalized.area, status: normalized.status })
        .eq('id', existing.id)
        .select()
        .single();
      if (updated) managersByRegistration.set(normalized.registration, updated);
      summary.managersUpdated++;
    } else {
      const { data: created } = await supabase
        .from('managers')
        .insert({
          name: normalized.name,
          registration: normalized.registration,
          email: normalized.email || `${normalized.registration}@sem-email.invalido`,
          area: normalized.area,
          company_id: company?.id ?? null,
          status: normalized.status
        })
        .select()
        .single();
      if (created) {
        managersByRegistration.set(normalized.registration, created);
        summary.managersCreated++;
      }
    }
  }

  // 2. Ciclos por empresa (um por empresa — atualiza se já existir)
  for (const rawCycle of payload.cycles ?? []) {
    const normalized = normalizeLegacyCycle(rawCycle);
    const company = companyByShortName.get(normalized.company);
    if (!company || !normalized.startMonth) continue;

    const cyclePayload = {
      company_id: company.id,
      start_month: normalized.startMonth,
      periodicity_months: normalized.periodicityMonths,
      positive_alert_minutes: normalized.positiveAlertMinutes,
      negative_alert_minutes: normalized.negativeAlertMinutes,
      responsible: normalized.responsible,
      active: true
    };
    const { data: existingCycle } = await supabase.from('company_cycles').select('id').eq('company_id', company.id).maybeSingle();
    if (existingCycle) {
      await supabase.from('company_cycles').update(cyclePayload).eq('id', existingCycle.id);
    } else {
      await supabase.from('company_cycles').insert(cyclePayload);
    }
    summary.cyclesProcessed++;
  }

  // 3. Colaboradores (com saldos convertidos para minutos)
  const { data: existingCollaborators } = await supabase.from('collaborators').select('*');
  const collaboratorsByKey = new Map<string, CollaboratorRow>(
    (existingCollaborators ?? []).map((c) => [`${c.company_id}:${normalizeMatricula(c.registration)}`, c])
  );
  const collaboratorByLegacyId = new Map<string, CollaboratorRow>();
  const fallbackLeaves: Array<{ collaboratorLegacyId: string; date: string; reason: string }> = [];

  for (const rawCollaborator of payload.collaborators ?? []) {
    const normalized = normalizeLegacyCollaborator(rawCollaborator);
    if (!normalized.name || !normalized.registration || !normalized.company) continue;
    const company = companyByShortName.get(normalized.company);
    if (!company) continue;

    const manager = normalized.managerRegistration ? managersByRegistration.get(normalized.managerRegistration) : undefined;
    const key = `${company.id}:${normalized.registration}`;
    const existing = collaboratorsByKey.get(key);

    const patch = {
      name: normalized.name,
      email: normalized.email || existing?.email || null,
      manager_id: manager?.id ?? existing?.manager_id ?? null,
      manager_email: manager ? null : (normalized.managerEmail ?? existing?.manager_email ?? null),
      manager_registration: manager ? null : (normalized.managerRegistration ?? existing?.manager_registration ?? null),
      is_facilitator: normalized.isFacilitator,
      title: normalized.title ?? existing?.title ?? null,
      status: normalized.status,
      previous_month_balance_minutes: normalized.previousMonthBalanceMinutes,
      month_credit_minutes: normalized.monthCreditMinutes,
      month_debit_minutes: normalized.monthDebitMinutes,
      month_balance_minutes: normalized.monthBalanceMinutes,
      cycle_balance_minutes: normalized.cycleBalanceMinutes,
      bank_hours_balance_minutes: normalized.bankHoursBalanceMinutes,
      extra_50_minutes: normalized.extra50Minutes,
      extra_100_minutes: normalized.extra100Minutes,
      absence_delay_minutes: normalized.absenceDelayMinutes
    };

    let row: CollaboratorRow | null = null;
    if (existing) {
      const { data: updated } = await supabase.from('collaborators').update(patch).eq('id', existing.id).select().single();
      row = updated;
      summary.collaboratorsUpdated++;
    } else {
      const { data: created } = await supabase
        .from('collaborators')
        .insert({ company_id: company.id, registration: normalized.registration, area: 'Contabilidade', ...patch })
        .select()
        .single();
      row = created;
      if (created) summary.collaboratorsCreated++;
    }

    if (row) {
      collaboratorsByKey.set(key, row);
      const legacyId = rawCollaborator.id;
      if (legacyId) collaboratorByLegacyId.set(legacyId, row);
      for (const leave of normalized.embeddedLeaves) {
        if (legacyId) fallbackLeaves.push({ collaboratorLegacyId: legacyId, date: leave.date, reason: leave.reason });
      }
    }
  }

  // 4. Registros de ponto (upsert em lote, ignora duplicados pela constraint única)
  const recordRows: Array<Record<string, unknown>> = [];
  for (const item of payload.records ?? []) {
    const collaborator = item.colaboradorId ? collaboratorByLegacyId.get(item.colaboradorId) : undefined;
    if (!collaborator || !item.data) continue;
    recordRows.push({
      collaborator_id: collaborator.id,
      period: item.periodo || item.data.slice(0, 7),
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
      day_type: ['Normal', 'Não útil', 'Férias'].includes(String(item.tipoDia)) ? item.tipoDia : resolveDayType(item.ocorrencia)
    });
  }
  summary.recordsSkipped = (payload.records?.length ?? 0) - recordRows.length;
  for (const batch of chunk(recordRows, 500)) {
    const { data: inserted, error } = await supabase
      .from('time_records')
      .upsert(batch, { onConflict: 'collaborator_id,record_date,period', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    summary.recordsInserted += inserted?.length ?? 0;
  }

  // 5. Folgas — prioriza o array `leaves` do topo; usa as embutidas em cada
  // colaborador (`folgasProgramadas`) apenas se não houver `leaves` no topo.
  const topLevelLeaves = payload.leaves ?? [];
  const leaveRows: Array<Record<string, unknown>> = [];
  if (topLevelLeaves.length > 0) {
    for (const item of topLevelLeaves) {
      const collaborator = item.colaboradorId ? collaboratorByLegacyId.get(item.colaboradorId) : undefined;
      if (!collaborator || !item.data) continue;
      const company = item.empresa ? companyByShortName.get(item.empresa) : null;
      leaveRows.push({
        collaborator_id: collaborator.id,
        company_id: company?.id ?? collaborator.company_id,
        leave_date: item.data,
        reason: item.motivo || 'Compensação de banco de horas',
        notes: item.observacao || null,
        source: 'legacy-import'
      });
    }
    summary.leavesSkipped = topLevelLeaves.length - leaveRows.length;
  } else {
    for (const item of fallbackLeaves) {
      const collaborator = collaboratorByLegacyId.get(item.collaboratorLegacyId);
      if (!collaborator) continue;
      leaveRows.push({
        collaborator_id: collaborator.id,
        company_id: collaborator.company_id,
        leave_date: item.date,
        reason: item.reason,
        notes: null,
        source: 'legacy-import'
      });
    }
  }
  for (const batch of chunk(leaveRows, 500)) {
    const { data: inserted, error } = await supabase
      .from('leaves')
      .upsert(batch, { onConflict: 'collaborator_id,leave_date', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    summary.leavesInserted += inserted?.length ?? 0;
  }

  // 6. Perfis de acesso (nunca rebaixa o perfil protegido do Desenvolvedor)
  const legacyProfiles = extractLegacyAccessProfiles(payload);
  for (const rawProfile of legacyProfiles) {
    const normalized = normalizeLegacyAccessProfile(rawProfile);
    if (!normalized.registration) continue;
    if (isDeveloperMatricula(normalized.registration)) {
      summary.profilesSkippedProtected++;
      continue;
    }
    const { data: existingProfile } = await supabase.from('access_profiles').select('id').eq('registration', normalized.registration).maybeSingle();
    if (existingProfile) continue;
    const { error } = await supabase.from('access_profiles').insert({
      name: normalized.name,
      registration: normalized.registration,
      email: normalized.email || null,
      title: normalized.title ?? null,
      area: normalized.area ?? null,
      access_type: normalized.accessType,
      status: normalized.status,
      notes: normalized.notes ?? null
    });
    if (!error) summary.profilesCreated++;
  }

  // 7. Parâmetros de Gestão BH
  if (payload.gestaoConfig) {
    await supabase.from('app_settings').upsert(
      {
        setting_key: 'gestao_config',
        setting_value: {
          custoHora: payload.gestaoConfig.custoHora ?? 35,
          adicionalPct: payload.gestaoConfig.adicionalPct ?? 50
        }
      },
      { onConflict: 'setting_key' }
    );
  }

  await recordAuditLog({ actorRegistration, action: 'import_json', entityType: 'database', newValue: summary });
  return summary;
}
