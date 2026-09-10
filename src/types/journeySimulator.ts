/** Entrada usada tanto para calcular o horário mínimo quanto como base da validação de uma entrada planejada. */
export interface JourneySimulationInput {
  companyId?: string | null;
  collaboratorId?: string | null;
  lastExitDate: string; // "YYYY-MM-DD"
  lastExitTime: string; // "HH:MM"
  minimumRestHours: number;
  operationalMarginMinutes: number;
  useOperationalMargin: boolean;
}

export interface JourneySimulationResult {
  lastExitDateTime: Date;
  technicalMinimumEntryDateTime: Date;
  recommendedEntryDateTime: Date;
  minimumRestMinutes: number;
  operationalMarginMinutes: number;
  useOperationalMargin: boolean;
  status: 'regular_from_recommended_time';
  message: string;
}

export interface JourneyEntryValidationInput extends JourneySimulationInput {
  plannedEntryDate: string; // "YYYY-MM-DD"
  plannedEntryTime: string; // "HH:MM"
}

export type JourneyEntryStatus = 'regular' | 'attention' | 'risk';

export interface JourneyEntryValidationResult {
  status: JourneyEntryStatus;
  statusLabel: string;
  plannedEntryDateTime: Date;
  restMinutes: number;
  missingMinutes: number;
  technicalMinimumEntryDateTime: Date;
  recommendedEntryDateTime: Date;
  message: string;
}
