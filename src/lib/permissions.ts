import type { AccessType } from '../types/database';
import { DEVELOPER_MATRICULA } from './constants';

export function normalizeMatricula(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function isDeveloperMatricula(matricula: string | null | undefined): boolean {
  return normalizeMatricula(matricula) === DEVELOPER_MATRICULA;
}

/** Perfis com acesso liberado ao sistema (qualquer coisa fora dessa lista = acesso negado). */
export function isAuthorizedAccessType(accessType: AccessType | null | undefined): boolean {
  return accessType === 'Desenvolvedor' || accessType === 'Administrador' || accessType === 'Gestor' || accessType === 'Facilitador';
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
  return isAuthorizedAccessType(accessType);
}

export function accessTypeBadgeTone(accessType: AccessType | null | undefined): 'dark' | 'info' | 'success' | 'neutral' | 'inactive' {
  switch (accessType) {
    case 'Desenvolvedor':
      return 'dark';
    case 'Administrador':
      return 'info';
    case 'Gestor':
      return 'success';
    case 'Facilitador':
      return 'neutral';
    default:
      return 'inactive';
  }
}
