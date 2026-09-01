import { getSupabase } from '../lib/supabaseClient';
import type { CollaboratorRow, CompanyRow, ManagerRow } from '../types/database';
import type { LegacyJsonExport } from '../types/imports';
import { extractLegacyAccessProfiles, normalizeLegacyAccessProfile, normalizeLegacyCollaborator, normalizeLegacyManager } from '../utils/imports';
import { normalizeMatricula, isDeveloperMatricula } from '../lib/permissions';
import { recordAuditLog } from './auditLogService';

export interface JsonImportSummary {
  collaboratorsCreated: number;
  collaboratorsUpdated: number;
  managersCreated: number;
  managersUpdated: number;
  profilesCreated: number;
  profilesSkippedProtected: number;
}

/**
 * Mescla uma base JSON exportada (legado ou desta aplicação) com os dados
 * já existentes no Supabase. Nunca duplica colaboradores/gestores (chave
 * empresa+matrícula / matrícula) e nunca sobrescreve o perfil protegido do
 * Desenvolvedor (seção 19/35 do escopo).
 */
export async function importLegacyJson(payload: LegacyJsonExport, companies: CompanyRow[], actorRegistration: string | null): Promise<JsonImportSummary> {
  const supabase = getSupabase();
  const summary: JsonImportSummary = {
    collaboratorsCreated: 0,
    collaboratorsUpdated: 0,
    managersCreated: 0,
    managersUpdated: 0,
    profilesCreated: 0,
    profilesSkippedProtected: 0
  };

  const { data: existingManagers } = await supabase.from('managers').select('*');
  const managersByRegistration = new Map<string, ManagerRow>((existingManagers ?? []).map((m) => [normalizeMatricula(m.registration), m]));

  for (const rawManager of payload.managers ?? []) {
    const normalized = normalizeLegacyManager(rawManager);
    if (!normalized.name || !normalized.registration) continue;
    const company = companies.find((c) => c.short_name === normalized.company);
    const existing = managersByRegistration.get(normalized.registration);
    if (existing) {
      await supabase.from('managers').update({ name: normalized.name, email: normalized.email || existing.email, area: normalized.area, status: normalized.status }).eq('id', existing.id);
      summary.managersUpdated++;
    } else {
      const { data: created } = await supabase
        .from('managers')
        .insert({ name: normalized.name, registration: normalized.registration, email: normalized.email, area: normalized.area, company_id: company?.id ?? null, status: normalized.status })
        .select()
        .single();
      if (created) {
        managersByRegistration.set(normalized.registration, created);
        summary.managersCreated++;
      }
    }
  }

  const { data: existingCollaborators } = await supabase.from('collaborators').select('*');
  const collaboratorsByKey = new Map<string, CollaboratorRow>((existingCollaborators ?? []).map((c) => [`${c.company_id}:${c.registration}`, c]));

  for (const rawCollaborator of payload.collaborators ?? []) {
    const normalized = normalizeLegacyCollaborator(rawCollaborator);
    if (!normalized.name || !normalized.registration || !normalized.company) continue;
    const company = companies.find((c) => c.short_name === normalized.company);
    if (!company) continue;

    const manager = normalized.managerRegistration ? managersByRegistration.get(normalized.managerRegistration) : undefined;
    const key = `${company.id}:${normalized.registration}`;
    const existing = collaboratorsByKey.get(key);

    const patch = {
      name: normalized.name,
      email: normalized.email || existing?.email || null,
      manager_id: manager?.id ?? existing?.manager_id ?? null,
      manager_email: normalized.managerEmail ?? existing?.manager_email ?? null,
      manager_registration: normalized.managerRegistration ?? existing?.manager_registration ?? null,
      is_facilitator: normalized.isFacilitator,
      title: normalized.title ?? existing?.title ?? null,
      status: normalized.status
    };

    if (existing) {
      await supabase.from('collaborators').update(patch).eq('id', existing.id);
      summary.collaboratorsUpdated++;
    } else {
      const { data: created } = await supabase
        .from('collaborators')
        .insert({ company_id: company.id, registration: normalized.registration, area: 'Contabilidade', ...patch })
        .select()
        .single();
      if (created) {
        collaboratorsByKey.set(key, created);
        summary.collaboratorsCreated++;
      }
    }
  }

  const legacyProfiles = extractLegacyAccessProfiles(payload);
  for (const rawProfile of legacyProfiles) {
    const normalized = normalizeLegacyAccessProfile(rawProfile);
    if (!normalized.registration) continue;
    if (isDeveloperMatricula(normalized.registration)) {
      // Perfil protegido: nunca sobrescrito por importação externa.
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

  await recordAuditLog({ actorRegistration, action: 'import_json', entityType: 'database', newValue: summary });
  return summary;
}
