import type {
  AccessProfileRow,
  AccessType,
  CollaboratorRow,
  CompanyCycleRow,
  CompanyRow,
  DayType,
  ImportRow,
  LeaveRow,
  ManagerRow,
  TimeRecordRow
} from './database';

/** Status calculado do colaborador (nunca persistido — derivado em tempo real). */
export type CollaboratorStatus = 'Regular' | 'Atenção' | 'Crítico' | 'Folga programada' | 'Inativo';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dark' | 'inactive';

/** Colaborador com empresa e gestor resolvidos para exibição em telas. */
export interface CollaboratorWithRelations extends CollaboratorRow {
  company: CompanyRow | null;
  manager: ManagerRow | null;
}

export interface CompanyCycleWithCompany extends CompanyCycleRow {
  company: CompanyRow | null;
}

export interface LeaveWithRelations extends LeaveRow {
  collaborator: CollaboratorRow | null;
  company: CompanyRow | null;
}

export type ComplianceAlertType =
  | 'interjornada'
  | 'intrajornada'
  | 'batida_incompleta'
  | 'folga_amanha';

export interface ComplianceAlert {
  type: ComplianceAlertType;
  collaborator: CollaboratorWithRelations;
  count: number;
  period: string;
  details: string;
  leaveDate?: string;
  leaveReason?: string;
  /** Datas ISO com batida incompleta (apenas para type === 'batida_incompleta'). */
  incompleteDays?: string[];
}

export interface CycleAlert {
  collaborator: CollaboratorWithRelations;
  config: CompanyCycleRow | null;
  balanceMinutes: number;
  limitMinutes: number;
  closing: boolean;
  hasFutureLeave: boolean;
}

export interface DashboardStats {
  total: number;
  balanceTotalMinutes: number;
  creditTotalMinutes: number;
  debitTotalMinutes: number;
  positiveCount: number;
  negativeCount: number;
  closingCompanies: CompanyCycleWithCompany[];
  cycleAlerts: CycleAlert[];
  complianceAlerts: ComplianceAlert[];
  totalAlerts: number;
}

export interface CyclePeriod {
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  months?: number;
}

export interface GestaoCollaboratorRow extends CollaboratorWithRelations {
  balanceMinutes: number;
  leavesCount: number;
  leavesMinutes: number;
  cycleCreditMinutes: number;
  atRisk: boolean;
}

export interface GestaoCompanyRow {
  company: CompanyRow;
  cycleConfig: CompanyCycleRow | null;
  period: CyclePeriod;
  isClosing: boolean;
  collaboratorRows: GestaoCollaboratorRow[];
  atRiskCollaborators: GestaoCollaboratorRow[];
  accumulatedBhMinutes: number;
  debitMinutes: number;
  compensatedMinutes: number;
  pendingBalanceMinutes: number;
  positiveBalanceMinutes: number;
  negativeBalanceMinutes: number;
  totalLeaves: number;
  compensatedPct: number;
}

export interface PaymentProjectionRow {
  status: 'Obrigação' | 'Risco';
  company: string;
  collaborator: string;
  accumulatedMinutes: number;
  compensatedMinutes: number;
  pendingMinutes: number;
  estimatedValue: number;
}

export interface AccessContext {
  authorized: boolean;
  role: AccessType | 'Carregando' | 'Sem perfil';
  matricula: string;
  source: 'auth' | 'query' | 'session' | 'login' | null;
  profile: AccessProfileRow | null;
  reason: string;
}

export type { CollaboratorRow, TimeRecordRow, LeaveRow, ManagerRow, AccessProfileRow, CompanyRow, CompanyCycleRow, ImportRow, DayType, AccessType };
