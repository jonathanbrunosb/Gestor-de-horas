import { useState } from 'react';
import type { CollaboratorRow, CompanyRow, ManagerRow } from '../../types/database';
import type { CollaboratorInput } from '../../services/collaboratorsService';
import { Button } from '../ui/Button';
import { minutesToTime, timeToMinutes } from '../../utils/time';

interface CollaboratorFormProps {
  initial?: CollaboratorRow | null;
  companies: CompanyRow[];
  managers: ManagerRow[];
  onSubmit: (payload: CollaboratorInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

function timeField(minutes: number | undefined): string {
  return minutesToTime(minutes ?? 0);
}

export function CollaboratorForm({ initial, companies, managers, onSubmit, onCancel, submitting }: CollaboratorFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registration, setRegistration] = useState(initial?.registration ?? '');
  const [companyId, setCompanyId] = useState(initial?.company_id ?? companies[0]?.id ?? '');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(initial?.status ?? 'Ativo');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [area, setArea] = useState(initial?.area ?? 'Contabilidade');
  const [managerId, setManagerId] = useState(initial?.manager_id ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [isFacilitator, setIsFacilitator] = useState(initial?.is_facilitator ?? false);
  const [previousMonthBalance, setPreviousMonthBalance] = useState(timeField(initial?.previous_month_balance_minutes));
  const [monthCredit, setMonthCredit] = useState(timeField(initial?.month_credit_minutes));
  const [monthDebit, setMonthDebit] = useState(timeField(initial?.month_debit_minutes));
  const [cycleBalance, setCycleBalance] = useState(timeField(initial?.cycle_balance_minutes));
  const [extra50, setExtra50] = useState(timeField(initial?.extra_50_minutes));
  const [extra100, setExtra100] = useState(timeField(initial?.extra_100_minutes));
  const [absenceDelay, setAbsenceDelay] = useState(timeField(initial?.absence_delay_minutes));

  function handleSubmit() {
    if (!name.trim() || !registration.trim() || !companyId) return;
    const monthBalance = timeToMinutes(monthCredit) - timeToMinutes(monthDebit);
    onSubmit({
      name: name.trim(),
      registration: registration.trim(),
      company_id: companyId,
      manager_id: managerId || null,
      status,
      title: title || null,
      area,
      email: email || null,
      is_facilitator: isFacilitator,
      previous_month_balance_minutes: timeToMinutes(previousMonthBalance),
      month_credit_minutes: timeToMinutes(monthCredit),
      month_debit_minutes: timeToMinutes(monthDebit),
      month_balance_minutes: monthBalance,
      cycle_balance_minutes: timeToMinutes(cycleBalance),
      bank_hours_balance_minutes: timeToMinutes(cycleBalance),
      extra_50_minutes: timeToMinutes(extra50),
      extra_100_minutes: timeToMinutes(extra100),
      absence_delay_minutes: timeToMinutes(absenceDelay),
      legacy_manager_name: initial?.legacy_manager_name ?? null,
      manager_email: initial?.manager_email ?? null,
      manager_registration: initial?.manager_registration ?? null
    });
  }

  return (
    <div>
      <div className="form-row">
        <div className="field">
          <label>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="field">
          <label>Matrícula</label>
          <input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="000000000" />
        </div>
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
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'Ativo' | 'Inativo')}>
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Cargo</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Área</label>
          <input value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div className="field">
          <label>Gestor vinculado</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Sem gestor</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>E-mail do colaborador</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@equatorialenergia.com.br" />
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Facilitador?</label>
          <select value={isFacilitator ? 'sim' : 'nao'} onChange={(e) => setIsFacilitator(e.target.value === 'sim')}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div className="field">
          <label>Saldo mês anterior</label>
          <input value={previousMonthBalance} onChange={(e) => setPreviousMonthBalance(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Crédito do mês</label>
          <input value={monthCredit} onChange={(e) => setMonthCredit(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Débito do mês</label>
          <input value={monthDebit} onChange={(e) => setMonthDebit(e.target.value)} placeholder="00:00" />
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Saldo do ciclo</label>
          <input value={cycleBalance} onChange={(e) => setCycleBalance(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Extra 50%</label>
          <input value={extra50} onChange={(e) => setExtra50(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Extra 100%</label>
          <input value={extra100} onChange={(e) => setExtra100(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Faltas / atrasos</label>
          <input value={absenceDelay} onChange={(e) => setAbsenceDelay(e.target.value)} placeholder="00:00" />
        </div>
      </div>

      <div className="modal-foot">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar colaborador'}
        </Button>
      </div>
    </div>
  );
}
