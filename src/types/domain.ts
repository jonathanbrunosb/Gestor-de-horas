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

export interface RankingEntry {
  collaborator: CollaboratorWithRelations;
  /** Saldo do ciclo de compensação acumulado até a competência efetiva (ver DashboardStats.effectivePeriod). */
  balanceMinutes: number;
  status: 'Regular' | 'Atenção' | 'Crítico' | 'Folga programada' | 'Inativo';
}

export interface DashboardStats {
  total: number;
  balanceTotalMinutes: number;
  creditTotalMinutes: number;
  debitTotalMinutes: number;
  positiveCount: number;
  negativeCount: number;
  /** Empresas cujo ciclo encerra NA COMPETÊNCIA ANALISADA (não em "hoje"). */
  closingCompanies: CompanyCycleWithCompany[];
  /** Situação do ciclo, na competência analisada, de cada empresa com colaborador ativo em tela. */
  cycleSummaries: CycleSummary[];
  cycleAlerts: CycleAlert[];
  complianceAlerts: ComplianceAlert[];
  totalAlerts: number;
  /** Competência (YYYY-MM) efetivamente usada nos números acima — a selecionada no filtro Mês, ou a mais recente com dados importados. */
  effectivePeriod: string | null;
  /** Top 8 colaboradores por saldo de ciclo acumulado até effectivePeriod (ver RankingEntry). */
  ranking: RankingEntry[];
  /** Saldo de ciclo acumulado até effectivePeriod (mesmo cálculo do ranking) de TODOS os colaboradores ativos, não só o top 8 — usado pela coluna "Saldo ciclo" da tabela de Alertas. */
  cycleBalanceByCollaboratorId: Map<string, number>;
}

export interface CyclePeriod {
  start: string; // YYYY-MM
  end: string; // YYYY-MM
  months?: number;
}

/**
 * Âncora temporal de uma análise de ciclo. Existe porque "mês de
 * encerramento", "janela do ciclo" e "há folga programada à frente?" são
 * perguntas diferentes: as duas primeiras dependem da COMPETÊNCIA analisada
 * (o mês do filtro), a última depende de um instante no tempo. Sem essa
 * separação, filtrar um mês passado continuava respondendo tudo em relação
 * a "hoje".
 */
export interface CycleReference {
  /** Competência (YYYY-MM) analisada — ancora a janela do ciclo e a checagem de mês de encerramento. */
  period: string;
  /** "Agora" limitado ao fim da competência analisada (ver referenceDateForPeriod). */
  date: Date;
  /** true quando a competência analisada é a corrente ou posterior — só nesse caso um lembrete D-1 de folga é acionável. */
  isPresent: boolean;
}

/** Resumo do ciclo de compensação de uma empresa na competência analisada — usado no card "Ciclos por empresa". */
export interface CycleSummary {
  cycle: CompanyCycleRow | null;
  company: CompanyRow | null;
  /** Janela [start,end] do ciclo que contém a competência analisada. */
  period: CyclePeriod;
  /** Posição da competência dentro do ciclo, ex.: "4/4". */
  sequence: string;
  /** A competência analisada é o mês de encerramento desse ciclo. */
  isClosing: boolean;
  /** A empresa não tem ciclo ativo cadastrado — o sistema cai numa janela móvel de 4 meses que nunca encerra nem zera o saldo. */
  missingConfig: boolean;
  collaboratorCount: number;
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
