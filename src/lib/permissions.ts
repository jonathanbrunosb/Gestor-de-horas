import type { AccessType } from '../types/database';
import { DEVELOPER_MATRICULA } from './constants';

export function normalizeMatricula(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  // Matrículas puramente numéricas às vezes chegam com zeros à esquerda
  // inconsistentes entre uploads de períodos diferentes (ex.: "1009912" x
  // "001009912" para a mesma pessoa) — trata como o mesmo valor para não
  // duplicar cadastro. Matrículas alfanuméricas (ex.: "u1205385") não são
  // afetadas.
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, '') : normalized;
}

export function isDeveloperMatricula(matricula: string | null | undefined): boolean {
  return normalizeMatricula(matricula) === DEVELOPER_MATRICULA;
}

/** Perfis com acesso liberado ao sistema (qualquer coisa fora dessa lista = acesso negado). */
export function isAuthorizedAccessType(accessType: AccessType | null | undefined): boolean {
  return (
    accessType === 'Desenvolvedor' ||
    accessType === 'Administrador' ||
    accessType === 'Executivo' ||
    accessType === 'Gerente' ||
    accessType === 'Facilitador' ||
    accessType === 'Colaborador'
  );
}

/**
 * Perfil de autoatendimento: só pode abrir o próprio Controle de Horas,
 * travado na matrícula do colaborador correspondente — nunca vê dados de
 * outros colaboradores nem os demais módulos do sistema.
 */
export function isSelfServiceOnly(accessType: AccessType | null | undefined): boolean {
  return accessType === 'Colaborador';
}

/**
 * Perfil "Executivo": enxerga só os colaboradores do próprio time (vinculado
 * pela matrícula ao registro de gestor correspondente em `managers`, e daí
 * aos colaboradores com esse `manager_id`) — nunca a base inteira. O perfil
 * "Gerente" (e os demais não-restritos) continuam vendo tudo, sem esse corte.
 */
export function isTeamScopedAccess(accessType: AccessType | null | undefined): boolean {
  return accessType === 'Executivo';
}

export function canManageAccessProfiles(accessType: AccessType | null | undefined): boolean {
  return accessType === 'Desenvolvedor' || accessType === 'Administrador';
}

export function canManageMasterData(accessType: AccessType | null | undefined): boolean {
  // Colaboradores, gestores, ciclos, importações e parâmetros de Gestão BH.
  return accessType === 'Desenvolvedor' || accessType === 'Administrador';
}

export function canResetDatabase(accessType: AccessType | null | undefined): boolean {
  return accessType === 'Desenvolvedor' || accessType === 'Administrador';
}

export function canViewFinancials(accessType: AccessType | null | undefined): boolean {
  return isAuthorizedAccessType(accessType) && !isSelfServiceOnly(accessType);
}

export function accessTypeBadgeTone(accessType: AccessType | null | undefined): 'dark' | 'info' | 'success' | 'neutral' | 'inactive' {
  switch (accessType) {
    case 'Desenvolvedor':
      return 'dark';
    case 'Administrador':
      return 'info';
    case 'Gerente':
      return 'success';
    case 'Executivo':
      return 'neutral';
    case 'Facilitador':
      return 'neutral';
    case 'Colaborador':
      return 'neutral';
    default:
      return 'inactive';
  }
}
