import { useState } from 'react';
import type { CompanyCycleRow, CompanyRow } from '../../types/database';
import type { CycleInput } from '../../services/cyclesService';
import { minutesToTime, timeToMinutes } from '../../utils/time';
import { Button } from '../ui/Button';

interface CycleFormProps {
  initial?: CompanyCycleRow | null;
  companies: CompanyRow[];
  onSubmit: (payload: CycleInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CycleForm({ initial, companies, onSubmit, onCancel, submitting }: CycleFormProps) {
  const [companyId, setCompanyId] = useState(initial?.company_id ?? companies[0]?.id ?? '');
  const [startMonth, setStartMonth] = useState(initial?.start_month ?? '');
  const [periodicity, setPeriodicity] = useState<3 | 4>(initial?.periodicity_months ?? 4);
  const [positiveLimit, setPositiveLimit] = useState(minutesToTime(initial?.positive_alert_minutes ?? 600));
  const [negativeLimit, setNegativeLimit] = useState(minutesToTime(initial?.negative_alert_minutes ?? -300));
  const [responsible, setResponsible] = useState(initial?.responsible ?? 'Contabilidade Corporativa');

  function handleSubmit() {
    if (!companyId || !startMonth) return;
    onSubmit({
      company_id: companyId,
      start_month: startMonth,
      periodicity_months: periodicity,
      positive_alert_minutes: timeToMinutes(positiveLimit),
      negative_alert_minutes: timeToMinutes(negativeLimit),
      responsible,
      active: true
    });
  }

  return (
    <div>
      <div className="form-row">
        <div className="field">
          <label>Empresa</label>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Início do ciclo (AAAA-MM)</label>
          <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </div>
        <div className="field">
          <label>Periodicidade</label>
          <select value={periodicity} onChange={(e) => setPeriodicity(Number(e.target.value) as 3 | 4)}>
            <option value={3}>3 meses</option>
            <option value={4}>4 meses</option>
          </select>
        </div>
        <div className="field">
          <label>Responsável</label>
          <input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Limite positivo (ex.: 10:00)</label>
          <input value={positiveLimit} onChange={(e) => setPositiveLimit(e.target.value)} />
        </div>
        <div className="field">
          <label>Limite negativo (ex.: -05:00)</label>
          <input value={negativeLimit} onChange={(e) => setNegativeLimit(e.target.value)} />
        </div>
      </div>

      <div className="modal-foot">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar ciclo'}
        </Button>
      </div>
    </div>
  );
}
