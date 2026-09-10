import { Button } from '../ui/Button';
import { MetricCard } from '../ui/MetricCard';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatJourneyDateTime, formatDurationFromMinutes } from '../../utils/journeySimulator';
import type { JourneySimulationResult } from '../../types/journeySimulator';

interface JourneyResultCardProps {
  result: JourneySimulationResult | null;
  onCopy: () => void;
}

/** Card "Resultado da simulação" — KPIs do cálculo de horário mínimo/recomendado, com botão de copiar. */
export function JourneyResultCard({ result, onCopy }: JourneyResultCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>
            Resultado da simulação
          </h2>
          <p className="section-subtitle" style={{ marginBottom: result ? 14 : 0 }}>
            Confira abaixo o resultado com base nos dados informados.
          </p>
        </div>
        {result && (
          <Button variant="secondary" size="small" onClick={onCopy}>
            Copiar resultado
          </Button>
        )}
      </div>

      {!result ? (
        <EmptyState message="Informe a data e o horário da última saída para calcular o horário recomendado de próxima entrada." />
      ) : (
        <>
          <div className="grid cards-4">
            <MetricCard title="Última saída" value={formatJourneyDateTime(result.lastExitDateTime)} tone="neutral" />
            <MetricCard title="Horário técnico mínimo" value={formatJourneyDateTime(result.technicalMinimumEntryDateTime)} tone="info" />
            <MetricCard
              title="Horário recomendado para nova entrada"
              value={<span className="journey-highlight-value">{formatJourneyDateTime(result.recommendedEntryDateTime)}</span>}
              tone="success"
            />
            <MetricCard title="Status" value={<Badge label="Regular a partir do horário recomendado" tone="success" />} tone="success" />
          </div>
          <p className="small-text" style={{ marginTop: 14 }}>
            {result.message}
          </p>
          <p className="small-text" style={{ marginTop: 4 }}>
            Descanso mínimo aplicado: {formatDurationFromMinutes(result.minimumRestMinutes)}
            {result.useOperationalMargin ? ` · Margem operacional: +${result.operationalMarginMinutes} min` : ' · Margem operacional desativada'}
          </p>
        </>
      )}
    </div>
  );
}
