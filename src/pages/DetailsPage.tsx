import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { usePersistedFilter } from '../hooks/useFilters';
import { minutesToTime, timeToMinutes } from '../utils/time';
import { formatDate } from '../utils/dates';
import { deleteRecord, deleteRecordsBatch, updateRecord } from '../services/recordsService';
import { downloadFile, toCSV } from '../utils/formatters';
import { canManageMasterData, isSelfServiceOnly, normalizeMatricula } from '../lib/permissions';
import type { TimeRecordRow } from '../types/database';

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

export function DetailsPage() {
  const { data, access, toast } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collaboratorId, setCollaboratorId] = usePersistedFilter('details.collaborator', searchParams.get('colaborador') ?? '');
  const [month, setMonth] = usePersistedFilter('details.month', String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = usePersistedFilter('details.year', String(new Date().getFullYear()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TimeRecordRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const canEdit = canManageMasterData(access.context.profile?.access_type);
  const selfServiceOnly = isSelfServiceOnly(access.context.profile?.access_type);

  const ownCollaborator = useMemo(
    () => data.collaborators.find((c) => normalizeMatricula(c.registration) === access.context.matricula) ?? null,
    [data.collaborators, access.context.matricula]
  );
  // Perfil "Colaborador": ignora qualquer seleção/URL e trava no próprio cadastro.
  const effectiveCollaboratorId = selfServiceOnly ? (ownCollaborator?.id ?? '') : collaboratorId;

  const collaborator = useMemo(() => data.collaborators.find((c) => c.id === effectiveCollaboratorId) ?? null, [data.collaborators, effectiveCollaboratorId]);
  const company = useMemo(() => data.companies.find((c) => c.id === collaborator?.company_id) ?? null, [data.companies, collaborator]);
  const manager = useMemo(() => data.managers.find((m) => m.id === collaborator?.manager_id) ?? null, [data.managers, collaborator]);

  const period = `${year}-${month}`;
  const records = useMemo(
    () =>
      data.records
        .filter((r) => r.collaborator_id === effectiveCollaboratorId && (r.period === period || r.record_date?.startsWith(period)))
        .sort((a, b) => a.record_date.localeCompare(b.record_date)),
    [data.records, effectiveCollaboratorId, period]
  );

  const summary = useMemo(() => {
    return records.reduce(
      (acc, r) => ({
        worked: acc.worked + r.worked_minutes,
        night: acc.night + r.night_minutes,
        credit: acc.credit + r.credit_bh_minutes,
        debit: acc.debit + r.debit_bh_minutes,
        balance: acc.balance + r.balance_bh_minutes,
        extra50: acc.extra50 + r.extra_50_minutes,
        extra100: acc.extra100 + r.extra_100_minutes
      }),
      { worked: 0, night: 0, credit: 0, debit: 0, balance: 0, extra50: 0, extra100: 0 }
    );
  }, [records]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteRecord(id, access.context.matricula);
      toast.notify('Registro excluído.', 'success');
      setConfirmDeleteId(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir registro.', 'danger');
    }
  }

  async function handleBulkDelete() {
    try {
      await deleteRecordsBatch(Array.from(selectedIds), access.context.matricula);
      toast.notify(`${selectedIds.size} registro(s) excluído(s).`, 'success');
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir registros.', 'danger');
    }
  }

  function exportCsv() {
    if (!collaborator) return;
    const rows = records.map((r) => ({
      Data: formatDate(r.record_date),
      Sem: r.weekday ?? '',
      Hor: r.schedule_code ?? '',
      Marcacoes: (r.punches ?? []).join(' '),
      Ocorrencia: r.occurrence ?? '',
      Trab: minutesToTime(r.worked_minutes),
      CrdBH: minutesToTime(r.credit_bh_minutes),
      DebBH: minutesToTime(r.debit_bh_minutes),
      SldBH: minutesToTime(r.balance_bh_minutes),
      AdNot: minutesToTime(r.night_minutes),
      Ext50: minutesToTime(r.extra_50_minutes),
      Ext100: minutesToTime(r.extra_100_minutes),
      Tipo: r.day_type
    }));
    downloadFile(`controle-horas-${collaborator.registration}-${period}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast.notify('Exportação CSV gerada.', 'success');
  }

  function exportJson() {
    if (!collaborator) return;
    downloadFile(`controle-horas-${collaborator.registration}-${period}.json`, JSON.stringify({ collaborator, records }, null, 2), 'application/json');
    toast.notify('Exportação JSON gerada.', 'success');
  }

  return (
    <PageContent title="Controle de Horas" description="Cartão-ponto individual do colaborador, com resumo do período e ações de edição.">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters four">
          <div className="field">
            <label>Colaborador</label>
            {selfServiceOnly ? (
              <input value={ownCollaborator?.name ?? 'Não vinculado'} disabled />
            ) : (
              <select
                value={collaboratorId}
                onChange={(e) => {
                  setCollaboratorId(e.target.value);
                  setSearchParams(e.target.value ? { colaborador: e.target.value } : {});
                }}
              >
                <option value="">Selecione um colaborador</option>
                {data.collaborators
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="field">
            <label>Mês</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ano</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <div className="actions-cell">
              <Button size="small" variant="secondary" onClick={exportCsv} disabled={!collaborator}>
                Exportar CSV
              </Button>
              <Button size="small" variant="secondary" onClick={exportJson} disabled={!collaborator}>
                Exportar JSON
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!collaborator ? (
        <EmptyState
          message={
            selfServiceOnly
              ? 'Não encontramos um colaborador vinculado à sua matrícula na Base de Colaboradores. Fale com o administrador.'
              : 'Selecione um colaborador para visualizar o controle de horas.'
          }
        />
      ) : (
        <>
          <div className="grid cards-4" style={{ marginBottom: 14 }}>
            <div className="mini-stat">
              <div className="mini-label">Empresa</div>
              <div className="mini-value" style={{ fontSize: 14 }}>
                {company?.short_name ?? '-'}
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Matrícula</div>
              <div className="mini-value" style={{ fontSize: 14 }}>
                {collaborator.registration}
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Gestor</div>
              <div className="mini-value" style={{ fontSize: 14 }}>
                {manager?.name ?? collaborator.legacy_manager_name ?? '-'}
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Registros no período</div>
              <div className="mini-value" style={{ fontSize: 14 }}>
                {records.length}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Cartão-ponto do período
              </h2>
              {canEdit && selectedIds.size > 0 && (
                <Button size="small" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
                  Excluir selecionados ({selectedIds.size})
                </Button>
              )}
            </div>

            {!records.length ? (
              <EmptyState message="Nenhum registro de ponto para este período." />
            ) : (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      {canEdit && <th></th>}
                      <th>Data</th>
                      <th>Sem</th>
                      <th>Hor</th>
                      <th>Marcações</th>
                      <th>Ocorrência</th>
                      <th>Trab.</th>
                      <th>Crd BH</th>
                      <th>Deb BH</th>
                      <th>Sld BH</th>
                      <th>AdNot</th>
                      <th>Ext 50%</th>
                      <th>Ext 100%</th>
                      <th>Tipo do dia</th>
                      {canEdit && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        {canEdit && (
                          <td>
                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                          </td>
                        )}
                        <td>{formatDate(r.record_date)}</td>
                        <td>{r.weekday ?? '-'}</td>
                        <td className="mono">{r.schedule_code ?? '-'}</td>
                        <td className="mono">{(r.punches ?? []).join(' ') || '-'}</td>
                        <td>{r.occurrence ?? '-'}</td>
                        <td className="mono">{minutesToTime(r.worked_minutes)}</td>
                        <td className="mono">{minutesToTime(r.credit_bh_minutes)}</td>
                        <td className="mono">{minutesToTime(r.debit_bh_minutes)}</td>
                        <td className="mono">{minutesToTime(r.balance_bh_minutes)}</td>
                        <td className="mono">{minutesToTime(r.night_minutes)}</td>
                        <td className="mono">{minutesToTime(r.extra_50_minutes)}</td>
                        <td className="mono">{minutesToTime(r.extra_100_minutes)}</td>
                        <td>{r.day_type}</td>
                        {canEdit && (
                          <td className="actions-cell">
                            <Button size="small" variant="secondary" onClick={() => setEditing(r)}>
                              Editar
                            </Button>
                            <Button size="small" variant="danger" onClick={() => setConfirmDeleteId(r.id)}>
                              Excluir
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Resumo do período</h2>
            <div className="kpi-row">
              <div className="mini-stat">
                <div className="mini-label">Horas trabalhadas</div>
                <div className="mini-value">{minutesToTime(summary.worked)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Adicional noturno</div>
                <div className="mini-value">{minutesToTime(summary.night)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Crédito mês</div>
                <div className="mini-value">{minutesToTime(summary.credit)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Débito mês</div>
                <div className="mini-value">{minutesToTime(summary.debit)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Saldo do mês</div>
                <div className="mini-value">{minutesToTime(summary.balance)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Saldo do ciclo</div>
                <div className="mini-value">{minutesToTime(collaborator.cycle_balance_minutes)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Extras 50%</div>
                <div className="mini-value">{minutesToTime(summary.extra50)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Extras 100%</div>
                <div className="mini-value">{minutesToTime(summary.extra100)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-label">Faltas / atrasos</div>
                <div className="mini-value">{minutesToTime(collaborator.absence_delay_minutes)}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {editing && (
        <RecordEditModal
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            data.reload();
          }}
          actorRegistration={access.context.matricula}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Excluir registro"
        message="Esta ação remove permanentemente o registro de ponto selecionado."
        confirmLabel="Excluir"
        danger
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        title="Excluir registros selecionados"
        message={`Esta ação remove permanentemente ${selectedIds.size} registro(s) de ponto selecionado(s).`}
        confirmLabel="Excluir selecionados"
        danger
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </PageContent>
  );
}

interface RecordEditModalProps {
  record: TimeRecordRow;
  onClose: () => void;
  onSaved: () => void;
  actorRegistration: string | null;
}

function RecordEditModal({ record, onClose, onSaved, actorRegistration }: RecordEditModalProps) {
  const [worked, setWorked] = useState(minutesToTime(record.worked_minutes));
  const [credit, setCredit] = useState(minutesToTime(record.credit_bh_minutes));
  const [debit, setDebit] = useState(minutesToTime(record.debit_bh_minutes));
  const [occurrence, setOccurrence] = useState(record.occurrence ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const creditMin = timeToMinutes(credit);
      const debitMin = timeToMinutes(debit);
      await updateRecord(
        record.id,
        {
          worked_minutes: timeToMinutes(worked),
          credit_bh_minutes: creditMin,
          debit_bh_minutes: debitMin,
          balance_bh_minutes: creditMin - debitMin,
          occurrence
        },
        actorRegistration
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={`Editar registro de ${formatDate(record.record_date)}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar registro'}</Button>
      </>
    }>
      <div className="form-row">
        <div className="field">
          <label>Horas trabalhadas</label>
          <input value={worked} onChange={(e) => setWorked(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Crédito BH</label>
          <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Débito BH</label>
          <input value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="00:00" />
        </div>
        <div className="field">
          <label>Ocorrência</label>
          <input value={occurrence} onChange={(e) => setOccurrence(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
