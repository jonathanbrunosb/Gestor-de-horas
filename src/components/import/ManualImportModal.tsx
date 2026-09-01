import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { COMPANIES } from '../../lib/constants';
import type { ImportedRecord } from '../../types/imports';
import { toISODate } from '../../utils/dates';

interface ManualImportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (record: ImportedRecord) => void;
}

const SCHEDULE_OPTIONS = [
  ['0001', '0001 — Jornada padrão'],
  ['9997', '9997 — Feriado'],
  ['9998', '9998 — Compensado'],
  ['9999', '9999 — DSR']
];

const OCCURRENCE_OPTIONS = ['Trabalhando', 'Débito Banco de Horas', 'Crédito Banco de Horas', 'Compensado', 'Feriado', 'Dsr', 'Férias', 'Normal'];

/** Assistente de lançamento manual — usado quando o PDF não tem texto selecionável. */
export function ManualImportModal({ open, onClose, onSubmit }: ManualImportModalProps) {
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [company, setCompany] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [scheduleCode, setScheduleCode] = useState('0001');
  const [occurrence, setOccurrence] = useState('Trabalhando');
  const [punches, setPunches] = useState(['', '', '', '']);

  function updatePunch(index: number, value: string) {
    setPunches((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function handleSubmit() {
    if (!name.trim() || !registration.trim() || !company || !date) return;
    const date0 = new Date(`${date}T00:00:00`);
    onSubmit({
      collaboratorName: name.trim(),
      collaboratorRegistration: registration.trim(),
      companyName: company,
      date,
      weekday: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][date0.getDay()],
      scheduleCode,
      punches: punches.filter(Boolean),
      occurrence,
      period: date.slice(0, 7)
    });
    setName('');
    setRegistration('');
    setPunches(['', '', '', '']);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Lançamento manual"
      description="Use este assistente quando o PDF não tiver texto selecionável (ex.: digitalizado como imagem)."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Adicionar à prévia</Button>
        </>
      }
    >
      <div className="form-row">
        <div className="field">
          <label>Colaborador</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="field">
          <label>Matrícula</label>
          <input value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="000000000" />
        </div>
        <div className="field">
          <label>Empresa</label>
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">Selecione</option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Código de horário</label>
          <select value={scheduleCode} onChange={(e) => setScheduleCode(e.target.value)}>
            {SCHEDULE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ocorrência</label>
          <select value={occurrence} onChange={(e) => setOccurrence(e.target.value)}>
            {OCCURRENCE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        {punches.map((p, idx) => (
          <div className="field" key={idx}>
            <label>Marcação {idx + 1}</label>
            <input type="time" value={p} onChange={(e) => updatePunch(idx, e.target.value)} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
