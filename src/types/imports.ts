import type { DayType, ImportFileType } from './database';

/** Linha normalizada de cartão-ponto, pronta para virar time_records + collaborators. */
export interface ImportedRecord {
  collaboratorName: string;
  collaboratorRegistration: string;
  collaboratorEmail?: string;
  companyCode?: string;
  companyName?: string;
  period?: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  weekday?: string;
  scheduleCode?: string;
  punches: string[];
  occurrence?: string;
  workedTime?: string; // HH:MM
  creditBhTime?: string;
  debitBhTime?: string;
  balanceBhTime?: string;
  nightTime?: string;
  extra50Time?: string;
  extra100Time?: string;
  dayType?: DayType;
  sourceLine?: string;
}

export interface ImportValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
}

export interface ImportPreviewResult {
  fileName: string;
  fileType: ImportFileType;
  rowsRead: number;
  records: ImportedRecord[];
  messages: ImportValidationMessage[];
  requiresManualEntry: boolean;
}

export interface ImportConfirmationSummary {
  recordsInserted: number;
  collaboratorsCreated: number;
  collaboratorsUpdated: number;
  duplicateRecords: number;
  skippedRows: number;
}

/** Payload aceito ao importar uma base JSON exportada (legado ou desta aplicação). */
export interface LegacyJsonCollaborator {
  nome?: string;
  name?: string;
  colaborador?: string;
  empregado?: string;
  matricula?: string;
  registration?: string;
  idEmpregado?: string;
  email?: string;
  eMail?: string;
  e_mail?: string;
  mail?: string;
  emailColaborador?: string;
  emailCorporativo?: string;
  corporateEmail?: string;
  empresa?: string;
  company?: string;
  empregador?: string;
  empresaCodigo?: string;
  codigo?: string;
  codEmpresa?: string;
  gestorId?: string;
  managerId?: string;
  gestorEmail?: string;
  managerEmail?: string;
  gestorMatricula?: string;
  managerRegistration?: string;
  facilitador?: boolean;
  isFacilitador?: boolean;
  perfilFacilitador?: boolean;
  cargo?: string;
  status?: string;
  [key: string]: unknown;
}

export interface LegacyJsonManager {
  nome?: string;
  name?: string;
  gestor?: string;
  manager?: string;
  matricula?: string;
  registration?: string;
  codigo?: string;
  email?: string;
  mail?: string;
  e_mail?: string;
  area?: string;
  departamento?: string;
  empresa?: string;
  company?: string;
  empresaCodigo?: string;
  codigoEmpresa?: string;
  status?: string;
  [key: string]: unknown;
}

export interface LegacyJsonAccessProfile {
  nome?: string;
  name?: string;
  matricula?: string;
  registration?: string;
  user?: string;
  login?: string;
  tipo?: string;
  perfil?: string;
  role?: string;
  accessRole?: string;
  cargo?: string;
  funcao?: string;
  title?: string;
  email?: string;
  area?: string;
  status?: string;
  observacao?: string;
  obs?: string;
  [key: string]: unknown;
}

export interface LegacyJsonExport {
  collaborators?: LegacyJsonCollaborator[];
  managers?: LegacyJsonManager[];
  userProfiles?: LegacyJsonAccessProfile[];
  perfisAcesso?: LegacyJsonAccessProfile[];
  accessProfiles?: LegacyJsonAccessProfile[];
  profiles?: LegacyJsonAccessProfile[];
  leaves?: Array<{ colaboradorId?: string; data?: string; motivo?: string; observacao?: string; [key: string]: unknown }>;
  records?: Array<Record<string, unknown>>;
  cycles?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
