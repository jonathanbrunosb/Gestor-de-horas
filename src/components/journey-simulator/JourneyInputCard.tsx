import { Button } from '../ui/Button';
import type { CollaboratorRow, CompanyRow } from '../../types/database';

interface JourneyInputCardProps {
  companies: CompanyRow[];
  collaborators: CollaboratorRow[];
  companyId: string;
  collaboratorId: string;
  lastExitDate: string;
  lastExitTime: string;
  minimumRestHours: number;
  useOperationalMargin: boolean;
  onCompanyChange: (value: string) => void;
  onCollaboratorChange: (value: string) => void;
  onLastExitDateChange: (value: string) => void;
  onLastExitTimeChange: (value: string) => void;
  onUseOperationalMarginChange: (value: boolean) => void;
  onCalculate: () => void;
  onClear: () => void;
}

/** Card "Dados da última jornada" — formulário de entrada do Simulador de Jornada. */
export function JourneyInputCard({
  companies,
  collaborators,
  companyId,
  collaboratorId,
  lastExitDate,
  lastExitTime,
  minimumRestHours,
  useOperationalMargin,
  onCompanyChange,
  onCollaboratorChange,
  onLastExitDateChange,
  onLastExitTimeChange,
  onUseOperationalMarginChange,
  onCalculate,
  onClear
}: JourneyInputCardProps) {
  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 2 }}>
        Dados da última jornada
      </h2>
      <p className="section-subtitle">Informe os dados da última saída para calcular o horário mínimo da próxima entrada.</p>

      <div className="form-row">
        <div className="field">
          <label>Empresa</label>
          <select value={companyId} onChange={(e) => onCompanyChange(e.target.value)}>
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Colaborador</label>
          <select value={collaboratorId} onChange={(e) => onCollaboratorChange(e.target.value)}>
            <option value="">Selecione (opcional)</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.registration})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Data da última saída</label>
          <input type="date" value={lastExitDate} onChange={(e) => onLastExitDateChange(e.target.value)} />
        </div>
        <div className="field">
          <label>Horário da última saída</label>
          <input type="time" value={lastExitTime} onChange={(e) => onLastExitTimeChange(e.target.value)} />
        </div>
        <div className="field">
          <label>Descanso mínimo</label>
          <input type="text" value={`${String(minimumRestHours).padStart(2, '0')}h00`} readOnly disabled />
          <span className="small-text">Conforme ACT / Interjornada</span>
        </div>
        <div className="field">
          <label>Margem operacional</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={useOperationalMargin} onChange={(e) => onUseOperationalMarginChange(e.target.checked)} />
            <span className="toggle-switch-track" />
            <span className="toggle-switch-label">+1 minuto</span>
          </label>
          <span className="small-text">Adiciona 1 minuto ao horário técnico mínimo como margem de segurança.</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Button onClick={onCalculate} disabled={!lastExitDate || !lastExitTime}>
          Calcular
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Limpar
        </Button>
      </div>
    </div>
  );
}
