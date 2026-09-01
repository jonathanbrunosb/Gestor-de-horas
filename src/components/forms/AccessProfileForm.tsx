import { useState } from 'react';
import type { AccessProfileRow, AccessType } from '../../types/database';
import type { AccessProfileInput } from '../../services/accessProfilesService';
import { ACCESS_PROFILE_TYPES } from '../../lib/constants';
import { isDeveloperMatricula } from '../../lib/permissions';
import { Button } from '../ui/Button';

interface AccessProfileFormProps {
  initial?: AccessProfileRow | null;
  onSubmit: (payload: AccessProfileInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function AccessProfileForm({ initial, onSubmit, onCancel, submitting }: AccessProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registration, setRegistration] = useState(initial?.registration ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [accessType, setAccessType] = useState<AccessType>(initial?.access_type ?? 'Sem acesso');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>(initial?.status ?? 'Ativo');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const protectedProfile = isDeveloperMatricula(initial?.registration);

  function handleSubmit() {
    if (!name.trim() || !registration.trim()) return;
    onSubmit({
      name: name.trim(),
      registration: registration.trim(),
      email: email || null,
      title: title || null,
      area: area || null,
      access_type: protectedProfile ? 'Desenvolvedor' : accessType,
      status: protectedProfile ? 'Ativo' : status,
      notes: notes || null
    });
  }

  return (
    <div>
      {protectedProfile && (
        <div className="alert-box" style={{ marginBottom: 14 }}>
          <span className="alert-box-icon">!</span>
          <div>
            <h3>Perfil protegido</h3>
            <p>Este é o perfil do Desenvolvedor da solução (u1205385). Tipo de acesso e status não podem ser alterados nem excluídos.</p>
          </div>
        </div>
      )}
      <div className="form-row">
        <div className="field">
          <label>Nome completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Matrícula</label>
          <input value={registration} onChange={(e) => setRegistration(e.target.value)} disabled={Boolean(initial)} />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Perfil de acesso</label>
          <select value={accessType} onChange={(e) => setAccessType(e.target.value as AccessType)} disabled={protectedProfile}>
            {ACCESS_PROFILE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Cargo / função</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Área</label>
          <input value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'Ativo' | 'Inativo')} disabled={protectedProfile}>
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
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
          {submitting ? 'Salvando…' : 'Salvar perfil'}
        </Button>
      </div>
    </div>
  );
}
