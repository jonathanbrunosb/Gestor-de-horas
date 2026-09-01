import { useMemo, useState } from 'react';
import type { CollaboratorRow, LeaveRow } from '../../types/database';
import type { LeaveInput } from '../../services/leavesService';
import { Button } from '../ui/Button';
import { minutesToTime, timeOfDayToMinutes } from '../../utils/time';

interface LeaveFormProps {
  initial?: LeaveRow | null;
  collaborators: CollaboratorRow[];
  defaultDate: string;
  onSubmit: (payload: LeaveInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function LeaveForm({ initial, collaborators, defaultDate, onSubmit, onCancel, submitting }: LeaveFormProps) {
  const [collaboratorId, setCollaboratorId] = useState(initial?.collaborator_id ?? '');
  const [date, setDate] = useState(initial?.leave_date ?? defaultDate);
  const [reason, setReason] = useState(initial?.reason ?? 'Compensação de banco de horas');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [startTime, setStartTime] = useState(initial?.start_time ?? '08:00');
  const [endTime, setEndTime] = useState(initial?.end_time ?? '17:00');

  const compensatedMinutes = useMemo(() => {
    const start = timeOfDayToMinutes(startTime);
    const end = timeOfDayToMinutes(endTime);
    if (start < 0 || end < 0 || end <= start) return 0;
    return end - start;
  }, [startTime, endTime]);

  const invalidRange = Boolean(startTime && endTime && compensatedMinutes === 0);

  function handleSubmit() {
    const collaborator = collaborators.find((c) => c.id === collaboratorId);
    if (!collaborator || !date) return;
    onSubmit({
      collaborator_id: collaborator.id,
      company_id: collaborator.company_id,
      leave_date: date,
      reason: reason || 'Compensação de banco de horas',
      notes: notes || null,
      source: initial?.source ?? 'manual',
      start_time: startTime || null,
      end_time: endTime || null,
      compensated_minutes: compensatedMinutes
    });
  }

  return (
    <div>
      <div className="form-row">
        <div className="field">
          <label>Colaborador</label>
          <select value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)} disabled={Boolean(initial)}>
            <option value="">Selecione</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          <label>Hora inicial</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label>Hora final</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="field">
          <label>Horas compensadas</label>
          <input className="mono" value={minutesToTime(compensatedMinutes)} disabled />
        </div>
      </div>
      {invalidRange && (
        <p className="small-text" style={{ color: 'var(--danger)', marginTop: 6 }}>
          Hora final deve ser depois da hora inicial para calcular as horas compensadas.
        </p>
      )}
      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Motivo</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="field">
          <label>Observação</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar folga'}
        </Button>
      </div>
    </div>
  );
}
