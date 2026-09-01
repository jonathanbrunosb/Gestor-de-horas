import type { CollaboratorRow, LeaveRow, ManagerRow, TimeRecordRow } from '../types/database';
import { normalizeMatricula } from '../lib/permissions';

/**
 * IDs dos colaboradores que reportam ao gestor identificado pela matrícula
 * logada — via managers.registration (a matrícula do gestor) casada com
 * collaborators.manager_id -> managers.id. "Sua equipe", na prática, é
 * exatamente essa relação já modelada no cadastro.
 *
 * Sem um registro de gestor correspondente à matrícula, retorna vazio
 * (fail closed): melhor um Executivo mal cadastrado ver uma base vazia — um
 * sinal óbvio de que falta vincular o cadastro — do que ver a base inteira.
 */
export function getTeamCollaboratorIds(collaborators: CollaboratorRow[], managers: ManagerRow[], matricula: string): Set<string> {
  const manager = managers.find((m) => normalizeMatricula(m.registration) === matricula);
  if (!manager) return new Set();
  return new Set(collaborators.filter((c) => c.manager_id === manager.id).map((c) => c.id));
}

export interface TeamScopedData {
  collaborators: CollaboratorRow[];
  records: TimeRecordRow[];
  leaves: LeaveRow[];
}

/**
 * Restringe colaboradores, registros de ponto e folgas ao time do gestor
 * logado (perfil "Executivo") — usado em todas as telas que hoje mostram a
 * base inteira, sem precisar de nenhum ajuste por página: filtra uma vez, no
 * nível do contexto de dados da aplicação.
 */
export function scopeDataToTeam(
  collaborators: CollaboratorRow[],
  records: TimeRecordRow[],
  leaves: LeaveRow[],
  managers: ManagerRow[],
  matricula: string
): TeamScopedData {
  const teamIds = getTeamCollaboratorIds(collaborators, managers, matricula);
  return {
    collaborators: collaborators.filter((c) => teamIds.has(c.id)),
    records: records.filter((r) => teamIds.has(r.collaborator_id)),
    leaves: leaves.filter((l) => teamIds.has(l.collaborator_id))
  };
}
