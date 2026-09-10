import { Button } from '../ui/Button';
import { JourneyStatusBadge } from './JourneyStatusBadge';
import { formatJourneyDateTime, formatDurationFromMinutes } from '../../utils/journeySimulator';
import type { JourneyEntryValidationResult, JourneySimulationResult } from '../../types/journeySimulator';

interface JourneyEntryTestCardProps {
  plannedEntryDate: string;
  plannedEntryTime: string;
  onPlannedEntryDateChange: (value: string) => void;
  onPlannedEntryTimeChange: (value: string) => void;
  onVerify: () => void;
  disabled: boolean;
  validation: JourneyEntryValidationResult | null;
  result: JourneySimulationResult | null;
}

const RESULT_TONE_CLASS: Record<JourneyEntryValidationResult['status'], string> = {
  risk: 'danger',
  attention: 'warning',
  regular: 'success'
};

/** Card "Testar próxima entrada" — valida um horário de entrada planejado contra a regra de interjornada. */
export function JourneyEntryTestCard({
  plannedEntryDate,
  plannedEntryTime,
  onPlannedEntryDateChange,
  onPlannedEntryTimeChange,
  onVerify,
  disabled,
  validation,
  result
}: JourneyEntryTestCardProps) {
  const exampleRestMinutes = result ? result.minimumRestMinutes + result.operationalMarginMinutes : 0;

  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 2 }}>
        Testar próxima entrada
      </h2>
      <p className="section-subtitle">Informe um horário de entrada para verificar se está em conformidade com a regra de interjornada.</p>

      <div className="form-row">
        <div className="field">
          <label>Próxima entrada prevista — data</label>
          <input type="date" value={plannedEntryDate} onChange={(e) => onPlannedEntryDateChange(e.target.value)} />
        </div>
        <div className="field">
          <label>Próxima entrada prevista — horário</label>
          <input type="time" value={plannedEntryTime} onChange={(e) => onPlannedEntryTimeChange(e.target.value)} />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <Button onClick={onVerify} disabled={disabled || !plannedEntryDate || !plannedEntryTime}>
            Verificar
          </Button>
        </div>
      </div>

      {(validation || result) && (
        <div className="grid journey-test-split" style={{ marginTop: 16 }}>
          {validation ? (
            <div className={`alert-box ${RESULT_TONE_CLASS[validation.status]}`} style={{ marginBottom: 0, flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', width: '100%' }}>
                <h3 style={{ margin: 0 }}>{validation.statusLabel}</h3>
                <JourneyStatusBadge status={validation.status} label={validation.statusLabel} />
              </div>
              <p>Descanso apurado: {formatDurationFromMinutes(validation.restMinutes)}</p>
              {validation.missingMinutes > 0 && (
                <p>
                  Faltam {validation.missingMinutes} minuto{validation.missingMinutes === 1 ? '' : 's'} para o mínimo
                </p>
              )}
              <p>Entrada recomendada: {formatJourneyDateTime(validation.recommendedEntryDateTime)}</p>
            </div>
          ) : (
            <div />
          )}

          {result && (
            <div className="alert-box info" style={{ marginBottom: 0, flexDirection: 'column' }}>
              <h3 style={{ margin: 0 }}>Exemplo de horário regular</h3>
              <p>Se informar {formatJourneyDateTime(result.recommendedEntryDateTime)}:</p>
              <p style={{ marginTop: 4 }}>
                <span className="badge success">Regular ({formatDurationFromMinutes(exampleRestMinutes)} de descanso)</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
