import { getSupabase } from '../lib/supabaseClient';
import type { CollaboratorRow, CompanyRow, ImportFileType, ImportRow } from '../types/database';
import type { ImportConfirmationSummary, ImportedRecord } from '../types/imports';
import { normalizeMatricula } from '../lib/permissions';
import { calcPunchMetrics, resolveDayType } from '../utils/imports';
import { timeToMinutes } from '../utils/time';
import { recordAuditLog } from './auditLogService';

export async function listImports(): Promise<ImportRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('imports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

interface ConfirmImportOptions {
  records: ImportedRecord[];
  fileName: string;
  fileType: ImportFileType;
  companies: CompanyRow[];
  existingCollaborators: CollaboratorRow[];
  actorRegistration: string | null;
}

/**
 * Confirma uma importação: cria/atualiza colaboradores, insere registros de
 * ponto (ignorando duplicados via unique constraint), cria folgas quando a
 * ocorrência indicar compensação, e grava o histórico em `imports`.
 */
export async function confirmImport(options: ConfirmImportOptions): Promise<ImportConfirmationSummary> {
  const { records, fileName, fileType, companies, existingCollaborators, actorRegistration } = options;
  const supabase = getSupabase();

  const summary: ImportConfirmationSummary = {
    recordsInserted: 0,
    collaboratorsCreated: 0,
    collaboratorsUpdated: 0,
    duplicateRecords: 0,
    skippedRows: 0
  };
  const messages: string[] = [];

  const collaboratorCache = new Map<string, CollaboratorRow>(
    existingCollaborators.map((c) => [`${c.company_id}:${normalizeMatricula(c.registration)}`, c])
  );

  for (const record of records) {
    const company = companies.find((c) => c.short_name === record.companyName);
    if (!company) {
      summary.skippedRows++;
      messages.push(`Empresa não mapeada para ${record.collaboratorName} (${record.date}) — linha ignorada.`);
      continue;
    }
    const registration = normalizeMatricula(record.collaboratorRegistration || record.collaboratorName);
    const cacheKey = `${company.id}:${registration}`;
    let collaborator = collaboratorCache.get(cacheKey);

    if (!collaborator) {
      const { data: created, error } = await supabase
        .from('collaborators')
        .insert({
          company_id: company.id,
          name: record.collaboratorName,
          registration,
          email: record.collaboratorEmail ?? null,
          area: 'Contabilidade',
          status: 'Ativo'
        })
        .select()
        .single();
      if (error) {
        // Corrida de duplicidade (unique company_id+registration) — recarrega o existente.
        const { data: existing } = await supabase.from('collaborators').select('*').eq('company_id', company.id).eq('registration', registration).maybeSingle();
        if (!existing) {
          summary.skippedRows++;
          messages.push(`Falha ao criar colaborador ${record.collaboratorName}: ${error.message}`);
          continue;
        }
        collaborator = existing;
      } else {
        collaborator = created;
        summary.collaboratorsCreated++;
      }
      collaboratorCache.set(cacheKey, collaborator!);
    } else if (record.collaboratorEmail && !collaborator.email) {
      const { data: updated } = await supabase.from('collaborators').update({ email: record.collaboratorEmail }).eq('id', collaborator.id).select().single();
      if (updated) {
        collaborator = updated;
        collaboratorCache.set(cacheKey, collaborator!);
        summary.collaboratorsUpdated++;
      }
    }

    if (!collaborator) {
      summary.skippedRows++;
      messages.push(`Falha ao resolver colaborador ${record.collaboratorName} — linha ignorada.`);
      continue;
    }

    const metrics = record.workedTime
      ? {
          workedMinutes: timeToMinutes(record.workedTime),
          creditBhMinutes: timeToMinutes(record.creditBhTime),
          debitBhMinutes: timeToMinutes(record.debitBhTime),
          balanceBhMinutes: timeToMinutes(record.balanceBhTime),
          nightMinutes: timeToMinutes(record.nightTime),
          extra50Minutes: timeToMinutes(record.extra50Time),
          extra100Minutes: timeToMinutes(record.extra100Time)
        }
      : calcPunchMetrics(record.punches, record.scheduleCode ?? '', record.weekday ?? '');

    const { error: insertError, data: insertedRow } = await supabase
      .from('time_records')
      .insert({
        collaborator_id: collaborator.id,
        period: record.period ?? record.date.slice(0, 7),
        record_date: record.date,
        weekday: record.weekday ?? null,
        schedule_code: record.scheduleCode ?? null,
        punches: record.punches ?? [],
        occurrence: record.occurrence ?? null,
        worked_minutes: metrics.workedMinutes,
        credit_bh_minutes: metrics.creditBhMinutes,
        debit_bh_minutes: metrics.debitBhMinutes,
        balance_bh_minutes: metrics.balanceBhMinutes,
        night_minutes: metrics.nightMinutes,
        extra_50_minutes: metrics.extra50Minutes,
        extra_100_minutes: metrics.extra100Minutes,
        day_type: record.dayType ?? resolveDayType(record.occurrence)
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        summary.duplicateRecords++;
      } else {
        summary.skippedRows++;
        messages.push(`Falha ao gravar registro de ${record.collaboratorName} em ${record.date}: ${insertError.message}`);
      }
      continue;
    }
    summary.recordsInserted++;

    if (insertedRow && /compensa[cç][aã]o|compensado/i.test(record.occurrence || '')) {
      await supabase
        .from('leaves')
        .upsert(
          {
            collaborator_id: collaborator.id,
            company_id: company.id,
            leave_date: record.date,
            reason: 'Compensação de banco de horas',
            source: 'import'
          },
          { onConflict: 'collaborator_id,leave_date', ignoreDuplicates: true }
        );
    }
  }

  const { data: importRow, error: importError } = await supabase
    .from('imports')
    .insert({
      filename: fileName,
      file_type: fileType,
      source: 'upload',
      rows_read: records.length,
      records_inserted: summary.recordsInserted,
      collaborators_created: summary.collaboratorsCreated,
      collaborators_updated: summary.collaboratorsUpdated,
      duplicate_records: summary.duplicateRecords,
      skipped_rows: summary.skippedRows,
      status: summary.skippedRows > 0 ? 'Concluído com avisos' : 'Concluído',
      messages,
      created_by_registration: actorRegistration
    })
    .select()
    .single();
  if (importError) throw importError;

  await recordAuditLog({ actorRegistration, action: 'import', entityType: 'import', entityId: importRow.id, newValue: summary });

  return summary;
}

export async function clearImportedTimeRecords(actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('time_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
  await recordAuditLog({ actorRegistration, action: 'clear_imported_data', entityType: 'time_record' });
}
