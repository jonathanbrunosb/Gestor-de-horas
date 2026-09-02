import { getSupabase } from '../lib/supabaseClient';
import { recordAuditLog } from './auditLogService';

export interface ResetOptions {
  collaborators: boolean;
  managers: boolean;
  records: boolean;
  leaves: boolean;
  imports: boolean;
  cycles: boolean;
}

/**
 * Limpa partes selecionadas da base. Perfis de acesso NUNCA são apagados
 * por esta rotina (seção 25 do escopo) — apenas Desenvolvedor/Administrador
 * devem poder chamar esta função (verificar no chamador via permissions.ts).
 */
export async function resetDatabase(options: ResetOptions, actorRegistration: string | null): Promise<void> {
  const supabase = getSupabase();

  // Ordem respeita dependências de FK: registros/folgas antes de colaboradores.
  if (options.records) {
    const { error } = await supabase.from('time_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
  if (options.leaves) {
    const { error } = await supabase.from('leaves').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
  if (options.imports) {
    const { error } = await supabase.from('imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
  if (options.collaborators) {
    const { error } = await supabase.from('collaborators').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
  if (options.managers) {
    const { error } = await supabase.from('managers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
  if (options.cycles) {
    const { error } = await supabase.from('company_cycles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }

  await recordAuditLog({ actorRegistration, action: 'system.reset_database', entityType: 'database', newValue: options });
}
