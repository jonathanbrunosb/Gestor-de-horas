import { Button } from '../ui/Button';
import { getAuditActionLabel, getEntityTypeLabel } from '../../utils/audit';
import type { AuditAction, AuditEntityType, AuditFilters as AuditFiltersValue } from '../../types/audit';

const ACTIONS: AuditAction[] = [
  'access.login_success',
  'access.login_denied',
  'access.logout',
  'profile.create',
  'profile.update',
  'profile.delete',
  'cycle.create',
  'cycle.update',
  'cycle.delete',
  'cycle.restore_defaults',
  'collaborator.create',
  'collaborator.update',
  'collaborator.delete',
  'manager.create',
  'manager.update',
  'manager.delete',
  'record.create',
  'record.update',
  'record.delete',
  'record.bulk_delete',
  'leave.create',
  'leave.update',
  'leave.delete',
  'import.confirm',
  'import.clear_data',
  'notification.mailto_generated',
  'settings.update',
  'export.json',
  'export.csv',
  'system.reset_database',
  'system.error'
];

const ENTITY_TYPES: AuditEntityType[] = [
  'access_profile',
  'company_cycle',
  'collaborator',
  'manager',
  'time_record',
  'leave',
  'import',
  'database',
  'notification',
  'app_setting',
  'system'
];

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'success', label: 'Sucesso' },
  { value: 'warning', label: 'Alerta' },
  { value: 'error', label: 'Erro' }
];

interface AuditFiltersProps {
  value: AuditFiltersValue;
  onChange: (next: AuditFiltersValue) => void;
  onClear: () => void;
}

/** Barra de filtros da trilha de auditoria — data inicial/final, matrícula, ação, entidade, status e busca livre. */
export function AuditFiltersBar({ value, onChange, onClear }: AuditFiltersProps) {
  function set<K extends keyof AuditFiltersValue>(key: K, val: AuditFiltersValue[K]) {
    onChange({ ...value, [key]: val });
  }

  const hasAnyFilter = Boolean(value.startDate || value.endDate || value.actorRegistration || value.action || value.entityType || value.status || value.search);

  return (
    <div className="audit-toolbar">
      <div className="filters">
        <div className="field">
          <label>Data inicial</label>
          <input type="date" value={value.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Data final</label>
          <input type="date" value={value.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || undefined)} />
        </div>
        <div className="field">
          <label>Usuário/matrícula</label>
          <input value={value.actorRegistration ?? ''} onChange={(e) => set('actorRegistration', e.target.value || undefined)} placeholder="uXXXXXXX" />
        </div>
        <div className="field">
          <label>Tipo de ação</label>
          <select value={value.action ?? ''} onChange={(e) => set('action', e.target.value || undefined)}>
            <option value="">Todas</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {getAuditActionLabel(action)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Entidade</label>
          <select value={value.entityType ?? ''} onChange={(e) => set('entityType', e.target.value || undefined)}>
            <option value="">Todas</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {getEntityTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={value.status ?? ''} onChange={(e) => set('status', e.target.value || undefined)}>
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 10 }}>
        <div className="field" style={{ gridColumn: 'span 3' }}>
          <label>Busca livre</label>
          <input
            value={value.search ?? ''}
            onChange={(e) => set('search', e.target.value || undefined)}
            placeholder="Nome, matrícula, e-mail, ação, entidade, tela ou rota"
          />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <Button size="small" variant="secondary" onClick={onClear} disabled={!hasAnyFilter}>
            Limpar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
