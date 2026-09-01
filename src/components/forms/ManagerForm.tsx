import { useState } from 'react';
import type { CompanyRow, ManagerRow } from '../../types/database';
import type { ManagerInput } from '../../services/managersService';
import { Button } from '../ui/Button';

interface ManagerFormProps {
  initial?: ManagerRow | null;
  companies: CompanyRow[];
  onSubmit: (payload: ManagerInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function ManagerForm({ initial, companies, onSubmit, onCancel, submitting }: ManagerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registration, setRegistration] = useState(initial?.registration ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [area, setArea] = useState(initial?.area ?? 'Contabilidade');
  const [companyId, setCompanyId] = useState(initial?.company_id ?? '');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(initial?.status ?? 'Ativo');

  function handleSubmit() {
    if (!name.trim() || !registration.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), registration: registration.trim(), email: email.trim(), area, company_id: companyId || null, status });
  }

  return (
    <div>
      <div className="form-row">
        <div className="field">
          <label>Nome do gestor</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="field">
          <label>Matrícula</label>
          <input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="u0000000" />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gestor@equatorialenergia.com.br" />
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
          <label>Área assumida</label>
          <input value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div className="field">
          <label>Empresa lotação</label>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Corporativo</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="modal-foot">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar gestor'}
        </Button>
      </div>
    </div>
  );
}
