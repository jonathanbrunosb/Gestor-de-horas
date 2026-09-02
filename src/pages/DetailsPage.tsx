import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { usePersistedFilter } from '../hooks/useFilters';
import { minutesToTime } from '../utils/time';
import { formatDate } from '../utils/dates';
import { deleteRecord, deleteRecordsBatch, updateRecord } from '../services/recordsService';
import { downloadFile, toCSV } from '../utils/formatters';
import { calcMetricsFromPunches, inferStandardMinutes, resolveDayType, scheduleJourneyMinutes } from '../utils/imports';
import { canEditTimeRecords, isSelfServiceOnly, normalizeMatricula } from '../lib/permissions';
import { createAuditLog } from '../services/auditLogService';
import { DEFAULT_SCHEDULE_TIMES, PUNCH_TOLERANCE_MINUTES } from '../lib/constants';
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

  const canEdit = canEditTimeRecords(access.context.profile?.access_type);
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

  // Trocar de colaborador ou de período zera a seleção: sem isso, "selecionar
  // todos" em um mês deixaria ids de outro mês marcados e o "Excluir
  // selecionados" apagaria registros fora da tela.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [effectiveCollaboratorId, period]);

  const allSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id));
  const someSelected = records.some((r) => selectedIds.has(r.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (records.every((r) => prev.has(r.id)) ? new Set() : new Set(records.map((r) => r.id))));
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
    void createAuditLog({
      action: 'export.csv',
      actorRegistration: access.context.matricula,
      entityType: 'time_record',
      entityId: collaborator.id,
      entityLabel: `${collaborator.name} — ${period}`,
      metadata: { rows: rows.length, period }
    });
    toast.notify('Exportação CSV gerada.', 'success');
  }

  function exportJson() {
    if (!collaborator) return;
    downloadFile(`controle-horas-${collaborator.registration}-${period}.json`, JSON.stringify({ collaborator, records }, null, 2), 'application/json');
    void createAuditLog({
      action: 'export.json',
      actorRegistration: access.context.matricula,
      entityType: 'time_record',
      entityId: collaborator.id,
      entityLabel: `${collaborator.name} — ${period}`,
      metadata: { records: records.length, period }
    });
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
              {canEdit && records.length > 0 && (
                <div className="actions-cell">
                  <Button size="small" variant="secondary" onClick={toggleSelectAll}>
                    {allSelected ? 'Limpar seleção' : `Selecionar todos (${records.length})`}
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button size="small" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
                      Excluir selecionados ({selectedIds.size})
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!records.length ? (
              <EmptyState message="Nenhum registro de ponto para este período." />
            ) : (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      {canEdit && (
                        <th>
                          <SelectAllCheckbox
                            checked={allSelected}
                            indeterminate={someSelected && !allSelected}
                            onChange={toggleSelectAll}
                            label={allSelected ? 'Limpar seleção' : 'Selecionar todos os registros do período'}
                          />
                        </th>
                      )}
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

interface SelectAllCheckboxProps {
  checked: boolean;
  /** Alguns (não todos) selecionados — traço no lugar do check, padrão de tabela. */
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}

function SelectAllCheckbox({ checked, indeterminate, onChange, label }: SelectAllCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` só existe como propriedade do elemento, não como atributo.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} title={label} aria-label={label} />;
}

interface RecordEditModalProps {
  record: TimeRecordRow;
  onClose: () => void;
  onSaved: () => void;
  actorRegistration: string | null;
}

/** Mantém um número par de campos (entrada/saída) e pelo menos um par vazio para novas marcações. */
function toPunchFields(punches: string[]): string[] {
  const clean = (punches ?? []).filter(Boolean);
  const slots = Math.max(4, clean.length + (clean.length % 2 === 0 ? 2 : 1));
  return Array.from({ length: slots }, (_, i) => clean[i] ?? '');
}

function RecordEditModal({ record, onClose, onSaved, actorRegistration }: RecordEditModalProps) {
  const [punchFields, setPunchFields] = useState<string[]>(() => toPunchFields(record.punches));
  // Dias não úteis/férias não têm horário a cumprir — tudo que for trabalhado vira crédito.
  const [scheduleFields, setScheduleFields] = useState<string[]>(() =>
    inferStandardMinutes(record) > 0 ? [...DEFAULT_SCHEDULE_TIMES] : ['', '', '', '']
  );
  const [occurrence, setOccurrence] = useState(record.occurrence ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const punches = useMemo(() => punchFields.filter(Boolean), [punchFields]);
  const scheduleTimes = useMemo(() => scheduleFields.filter(Boolean), [scheduleFields]);

  // Trabalhado, crédito, débito, saldo, adicional noturno e extras saem das
  // marcações — não são mais digitados à mão.
  const metrics = useMemo(
    () => calcMetricsFromPunches(punches, scheduleTimes, record.weekday ?? ''),
    [punches, scheduleTimes, record.weekday]
  );

  const journeyMinutes = useMemo(() => scheduleJourneyMinutes(scheduleTimes), [scheduleTimes]);
  const recordJourneyMinutes = inferStandardMinutes(record);
  // Avisa quando o horário previsto informado não fecha a jornada que o próprio
  // registro indica — sinal de que este dia segue outro horário.
  const journeyMismatch = recordJourneyMinutes > 0 && journeyMinutes > 0 && journeyMinutes !== recordJourneyMinutes;

  const oddPunches = punches.length % 2 !== 0;
  const changed =
    metrics.workedMinutes !== record.worked_minutes ||
    metrics.creditBhMinutes !== record.credit_bh_minutes ||
    metrics.debitBhMinutes !== record.debit_bh_minutes;

  function updatePunch(index: number, value: string) {
    setPunchFields((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPunchPair() {
    setPunchFields((prev) => [...prev, '', '']);
  }

  function updateScheduleField(index: number, value: string) {
    setScheduleFields((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateRecord(
        record.id,
        {
          punches,
          occurrence,
          day_type: resolveDayType(occurrence),
          worked_minutes: metrics.workedMinutes,
          credit_bh_minutes: metrics.creditBhMinutes,
          debit_bh_minutes: metrics.debitBhMinutes,
          balance_bh_minutes: metrics.balanceBhMinutes,
          night_minutes: metrics.nightMinutes,
          extra_50_minutes: metrics.extra50Minutes,
          extra_100_minutes: metrics.extra100Minutes
        },
        actorRegistration
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o registro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Editar registro de ${formatDate(record.record_date)}`}
      description="Informe as marcações do dia — o sistema recalcula horas trabalhadas, crédito, débito e saldo automaticamente."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || oddPunches}>
            {saving ? 'Salvando…' : 'Salvar registro'}
          </Button>
        </>
      }
    >
      <div className="form-row">
        {punchFields.map((value, idx) => (
          <div className="field" key={idx}>
            <label>{idx % 2 === 0 ? `Entrada ${Math.floor(idx / 2) + 1}` : `Saída ${Math.floor(idx / 2) + 1}`}</label>
            <input type="time" value={value} onChange={(e) => updatePunch(idx, e.target.value)} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <Button size="small" variant="secondary" onClick={addPunchPair}>
          Adicionar par de marcações
        </Button>
      </div>

      <h3 className="section-title" style={{ marginTop: 18 }}>
        Horário previsto
      </h3>
      <p className="small-text" style={{ marginTop: -6, marginBottom: 8 }}>
        Base do cálculo e da tolerância do ACT: variação de até {PUNCH_TOLERANCE_MINUTES} minutos em cada marcação, para mais ou para
        menos, não gera crédito nem débito. Deixe em branco em dias sem jornada a cumprir.
      </p>
      <div className="form-row">
        {scheduleFields.map((value, idx) => (
          <div className="field" key={idx}>
            <label>{idx % 2 === 0 ? `Entrada ${Math.floor(idx / 2) + 1} prevista` : `Saída ${Math.floor(idx / 2) + 1} prevista`}</label>
            <input type="time" value={value} onChange={(e) => updateScheduleField(idx, e.target.value)} />
          </div>
        ))}
        <div className="field">
          <label>Jornada prevista</label>
          <input value={minutesToTime(journeyMinutes)} readOnly data-testid="journey-derived" />
        </div>
        <div className="field">
          <label>Ocorrência</label>
          <input value={occurrence} onChange={(e) => setOccurrence(e.target.value)} />
        </div>
      </div>
      {journeyMismatch && (
        <p className="small-text" style={{ marginTop: 8 }}>
          A jornada deste horário previsto ({minutesToTime(journeyMinutes)}) difere da jornada que o registro indica (
          {minutesToTime(recordJourneyMinutes)}). Ajuste os horários previstos se este dia segue outra escala.
        </p>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Cálculo automático
        </h3>
        <div className="kpi-row">
          <div className="mini-stat">
            <div className="mini-label">Horas trabalhadas</div>
            <div className="mini-value" data-testid="calc-worked">
              {minutesToTime(metrics.workedMinutes)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Crédito BH</div>
            <div className="mini-value" data-testid="calc-credit">
              {minutesToTime(metrics.creditBhMinutes)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Débito BH</div>
            <div className="mini-value" data-testid="calc-debit">
              {minutesToTime(metrics.debitBhMinutes)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Saldo BH</div>
            <div className="mini-value" data-testid="calc-balance">
              {minutesToTime(metrics.balanceBhMinutes)}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Adicional noturno</div>
            <div className="mini-value">{minutesToTime(metrics.nightMinutes)}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Extras 100%</div>
            <div className="mini-value">{minutesToTime(metrics.extra100Minutes)}</div>
          </div>
        </div>
        {oddPunches && (
          <p className="small-text" style={{ marginTop: 10 }}>
            Há uma marcação sem par (entrada sem saída). Complete o par para salvar.
          </p>
        )}
        {!oddPunches && changed && (
          <p className="small-text" style={{ marginTop: 10 }}>
            Os valores calculados diferem dos importados ({minutesToTime(record.worked_minutes)} trab. ·{' '}
            {minutesToTime(record.credit_bh_minutes)} créd. · {minutesToTime(record.debit_bh_minutes)} déb.). Salvar substitui os
            valores do registro pelos calculados acima.
          </p>
        )}
        {error && (
          <p className="small-text" style={{ marginTop: 10, color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
