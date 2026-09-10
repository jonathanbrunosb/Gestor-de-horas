import { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { EmptyState } from '../components/ui/EmptyState';
import { JourneyInputCard } from '../components/journey-simulator/JourneyInputCard';
import { JourneyRuleCard } from '../components/journey-simulator/JourneyRuleCard';
import { JourneyResultCard } from '../components/journey-simulator/JourneyResultCard';
import { JourneyEntryTestCard } from '../components/journey-simulator/JourneyEntryTestCard';
import { calculateMinimumEntry, validatePlannedEntry, formatJourneyDateTime, formatDurationFromMinutes } from '../utils/journeySimulator';
import { canViewJourneySimulator } from '../lib/permissions';
import { createAuditLog } from '../services/auditLogService';
import type { JourneyEntryValidationResult } from '../types/journeySimulator';

const MINIMUM_REST_HOURS = 11;
const OPERATIONAL_MARGIN_MINUTES = 1;

export function JourneySimulatorPage() {
  const { data, access, toast } = useAppContext();
  const canView = canViewJourneySimulator(access.context.profile?.access_type);

  const [companyId, setCompanyId] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const [lastExitDate, setLastExitDate] = useState('');
  const [lastExitTime, setLastExitTime] = useState('');
  const [useOperationalMargin, setUseOperationalMargin] = useState(true);
  const [plannedEntryDate, setPlannedEntryDate] = useState('');
  const [plannedEntryTime, setPlannedEntryTime] = useState('');
  const [validation, setValidation] = useState<JourneyEntryValidationResult | null>(null);

  const filteredCollaborators = useMemo(
    () => data.collaborators.filter((c) => c.status === 'Ativo' && (!companyId || c.company_id === companyId)).sort((a, b) => a.name.localeCompare(b.name)),
    [data.collaborators, companyId]
  );

  const selectedCollaborator = useMemo(() => data.collaborators.find((c) => c.id === collaboratorId) ?? null, [data.collaborators, collaboratorId]);

  const result = useMemo(() => {
    if (!lastExitDate || !lastExitTime) return null;
    return calculateMinimumEntry({
      companyId: companyId || null,
      collaboratorId: collaboratorId || null,
      lastExitDate,
      lastExitTime,
      minimumRestHours: MINIMUM_REST_HOURS,
      operationalMarginMinutes: OPERATIONAL_MARGIN_MINUTES,
      useOperationalMargin
    });
  }, [companyId, collaboratorId, lastExitDate, lastExitTime, useOperationalMargin]);

  function handleCalculate() {
    if (!result) return;
    void createAuditLog({
      action: 'journey_simulator.calculate',
      entityType: 'journey_simulator',
      entityLabel: selectedCollaborator ? `${selectedCollaborator.name} (${selectedCollaborator.registration})` : undefined,
      actorRegistration: access.context.matricula,
      metadata: {
        lastExitDate,
        lastExitTime,
        technicalMinimum: result.technicalMinimumEntryDateTime.toISOString(),
        recommendedEntry: result.recommendedEntryDateTime.toISOString(),
        useOperationalMargin
      }
    });
  }

  function handleClear() {
    setCollaboratorId('');
    setLastExitDate('');
    setLastExitTime('');
    setUseOperationalMargin(true);
    setPlannedEntryDate('');
    setPlannedEntryTime('');
    setValidation(null);
  }

  function handleVerify() {
    if (!lastExitDate || !lastExitTime) {
      toast.notify('Informe a data e o horário da última saída antes de testar uma entrada.', 'danger');
      return;
    }
    if (!plannedEntryDate || !plannedEntryTime) return;

    const next = validatePlannedEntry({
      companyId: companyId || null,
      collaboratorId: collaboratorId || null,
      lastExitDate,
      lastExitTime,
      minimumRestHours: MINIMUM_REST_HOURS,
      operationalMarginMinutes: OPERATIONAL_MARGIN_MINUTES,
      useOperationalMargin,
      plannedEntryDate,
      plannedEntryTime
    });
    setValidation(next);

    void createAuditLog({
      action: 'journey_simulator.validate_entry',
      entityType: 'journey_simulator',
      entityLabel: selectedCollaborator ? `${selectedCollaborator.name} (${selectedCollaborator.registration})` : undefined,
      actorRegistration: access.context.matricula,
      metadata: {
        lastExitDate,
        lastExitTime,
        plannedEntry: next.plannedEntryDateTime.toISOString(),
        status: next.status
      }
    });
  }

  async function handleCopy() {
    if (!result) return;
    const text = [
      'Simulação de Jornada',
      '',
      `Última saída: ${formatJourneyDateTime(result.lastExitDateTime)}`,
      `Descanso mínimo: ${formatDurationFromMinutes(result.minimumRestMinutes)}`,
      `Horário técnico mínimo: ${formatJourneyDateTime(result.technicalMinimumEntryDateTime)}`,
      `Horário recomendado para nova entrada: ${formatJourneyDateTime(result.recommendedEntryDateTime)}`,
      '',
      result.message
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.notify('Resultado copiado para a área de transferência.', 'success');
      void createAuditLog({
        action: 'journey_simulator.copy_result',
        entityType: 'journey_simulator',
        actorRegistration: access.context.matricula,
        metadata: {
          lastExitDate,
          lastExitTime,
          recommendedEntry: result.recommendedEntryDateTime.toISOString()
        }
      });
    } catch {
      toast.notify('Não foi possível copiar o resultado.', 'danger');
    }
  }

  if (!canView) {
    return (
      <PageContent title="Simulador de Jornada" description="Calcule o horário mínimo para a próxima entrada considerando o descanso obrigatório entre jornadas.">
        <EmptyState message="Seu perfil não possui permissão para acessar o Simulador de Jornada." />
      </PageContent>
    );
  }

  return (
    <PageContent title="Simulador de Jornada" description="Calcule o horário mínimo para a próxima entrada considerando o descanso obrigatório entre jornadas.">
      <div className="grid journey-split" style={{ marginBottom: 14 }}>
        <JourneyInputCard
          companies={data.companies}
          collaborators={filteredCollaborators}
          companyId={companyId}
          collaboratorId={collaboratorId}
          lastExitDate={lastExitDate}
          lastExitTime={lastExitTime}
          minimumRestHours={MINIMUM_REST_HOURS}
          useOperationalMargin={useOperationalMargin}
          onCompanyChange={(value) => {
            setCompanyId(value);
            setCollaboratorId('');
          }}
          onCollaboratorChange={setCollaboratorId}
          onLastExitDateChange={setLastExitDate}
          onLastExitTimeChange={setLastExitTime}
          onUseOperationalMarginChange={setUseOperationalMargin}
          onCalculate={handleCalculate}
          onClear={handleClear}
        />
        <JourneyRuleCard />
      </div>

      <div style={{ marginBottom: 14 }}>
        <JourneyResultCard result={result} onCopy={handleCopy} />
      </div>

      <JourneyEntryTestCard
        plannedEntryDate={plannedEntryDate}
        plannedEntryTime={plannedEntryTime}
        onPlannedEntryDateChange={setPlannedEntryDate}
        onPlannedEntryTimeChange={setPlannedEntryTime}
        onVerify={handleVerify}
        disabled={!lastExitDate || !lastExitTime}
        validation={validation}
        result={result}
      />
    </PageContent>
  );
}
