import { useMemo, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { LeaveDayPanel } from '../components/calendar/LeaveDayPanel';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LeaveForm } from '../components/forms/LeaveForm';
import { usePersistedFilter } from '../hooks/useFilters';
import { createLeave, deleteLeave, updateLeave, type LeaveInput } from '../services/leavesService';
import { generateAndLogNotification } from '../services/notificationsService';
import { formatMonthName, toISODate } from '../utils/dates';
import { getCompanyConfig, isCycleClosingMonth } from '../utils/cycles';
import { getCycleAlerts } from '../utils/compliance';
import type { LeaveRow } from '../types/database';
import type { LeaveWithRelations } from '../types/domain';
import { canManageMasterData } from '../lib/permissions';
import { Button } from '../components/ui/Button';

export function CalendarPage() {
  const { data, access, toast } = useAppContext();
  const [companyFilter, setCompanyFilter] = usePersistedFilter('calendar.company', '');
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [editingLeave, setEditingLeave] = useState<LeaveRow | null>(null);
  // Força o formulário inline de "Registrar nova folga" a remontar (e limpar os campos) após cada folga criada com sucesso.
  const [createFormKey, setCreateFormKey] = useState(0);
  const [deletingLeave, setDeletingLeave] = useState<LeaveWithRelations | null>(null);
  const [notifyPrompt, setNotifyPrompt] = useState<LeaveWithRelations | null>(null);

  const canManage = canManageMasterData(access.context.profile?.access_type);

  const leavesWithRelations: LeaveWithRelations[] = useMemo(
    () =>
      data.leaves
        .map((leave) => ({
          ...leave,
          collaborator: data.collaborators.find((c) => c.id === leave.collaborator_id) ?? null,
          company: data.companies.find((co) => co.id === leave.company_id) ?? null
        }))
        .filter((l) => !companyFilter || l.company?.short_name === companyFilter),
    [data.leaves, data.collaborators, data.companies, companyFilter]
  );

  const leavesByDay = useMemo(() => {
    const map = new Map<string, LeaveWithRelations[]>();
    for (const leave of leavesWithRelations) {
      const list = map.get(leave.leave_date) ?? [];
      list.push(leave);
      map.set(leave.leave_date, list);
    }
    return map;
  }, [leavesWithRelations]);

  const cycleClosingDays = useMemo(() => {
    const set = new Set<string>();
    const today = new Date();
    const closingCompanies = data.cycles.filter((cfg) => isCycleClosingMonth(cfg));
    if (!closingCompanies.length) return set;
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      set.add(toISODate(new Date(today.getFullYear(), today.getMonth(), d)));
    }
    return set;
  }, [data.cycles]);

  const criticalDays = useMemo(() => {
    const withRelations = data.collaborators.map((c) => ({
      ...c,
      company: data.companies.find((co) => co.id === c.company_id) ?? null,
      manager: data.managers.find((m) => m.id === c.manager_id) ?? null
    }));
    const alerts = getCycleAlerts(withRelations, data.cycles, data.leaves, data.records);
    const set = new Set<string>();
    for (const alert of alerts) {
      const config = getCompanyConfig(data.cycles, alert.collaborator.company_id);
      if (config) {
        // Marca o dia de hoje como crítico para colaboradores em risco no mês de encerramento.
        set.add(toISODate(new Date()));
      }
    }
    return set;
  }, [data.collaborators, data.companies, data.managers, data.cycles, data.leaves, data.records]);

  const selectedLeaves = leavesByDay.get(selectedDate) ?? [];

  async function handleSubmit(payload: LeaveInput) {
    try {
      if (editingLeave) {
        await updateLeave(editingLeave.id, payload, access.context.matricula);
        toast.notify('Folga atualizada.', 'success');
        setEditingLeave(null);
      } else {
        const created = await createLeave(payload, access.context.matricula);
        toast.notify('Folga cadastrada.', 'success');
        const collaborator = data.collaborators.find((c) => c.id === created.collaborator_id);
        const company = data.companies.find((c) => c.id === created.company_id);
        if (collaborator) {
          setNotifyPrompt({ ...created, collaborator, company: company ?? null });
        }
        setCreateFormKey((key) => key + 1);
      }
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar folga.', 'danger');
    }
  }

  async function handleDelete() {
    if (!deletingLeave) return;
    try {
      await deleteLeave(deletingLeave.id, access.context.matricula);
      toast.notify('Folga excluída.', 'success');
      setDeletingLeave(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir folga.', 'danger');
    }
  }

  async function handleSendNotification() {
    if (!notifyPrompt?.collaborator) return;
    const collaboratorWithRelations = {
      ...notifyPrompt.collaborator,
      company: notifyPrompt.company ?? null,
      manager: data.managers.find((m) => m.id === notifyPrompt.collaborator?.manager_id) ?? null
    };
    try {
      const { mailtoUrl } = await generateAndLogNotification(
        {
          collaborator: collaboratorWithRelations,
          type: 'Folga registrada',
          details: `Folga programada para ${notifyPrompt.leave_date} — ${notifyPrompt.reason}`,
          action: 'Nenhuma ação necessária; confirmação informativa.'
        },
        access.context.matricula
      );
      window.location.href = mailtoUrl;
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao gerar notificação.', 'danger');
    } finally {
      setNotifyPrompt(null);
    }
  }

  return (
    <PageContent title="Calendário de Folgas" description="Visualize e programe folgas de compensação de banco de horas por empresa.">
      <div className="grid calendar-split">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>
                {formatMonthName(new Date())}
              </h2>
              <p className="section-subtitle" style={{ margin: '2px 0 0' }}>
                Clique em um dia para visualizar as folgas programadas.
              </p>
            </div>
            <div className="field" style={{ minWidth: 200 }}>
              <label>Filtrar empresa</label>
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <option value="">Todas</option>
                {data.companies.map((c) => (
                  <option key={c.id} value={c.short_name}>
                    {c.short_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CalendarGrid
            month={new Date()}
            leavesByDay={leavesByDay}
            criticalDays={criticalDays}
            cycleClosingDays={cycleClosingDays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
        <LeaveDayPanel
          date={selectedDate}
          leaves={selectedLeaves}
          collaborators={data.collaborators}
          canManage={canManage}
          onEdit={(leave) => setEditingLeave(leave)}
          onDelete={(leave) => setDeletingLeave(leave)}
          onCreate={handleSubmit}
          createFormKey={createFormKey}
        />
      </div>

      <Modal open={Boolean(editingLeave)} title="Editar folga" onClose={() => setEditingLeave(null)}>
        <LeaveForm
          initial={editingLeave}
          collaborators={data.collaborators}
          defaultDate={selectedDate}
          onSubmit={handleSubmit}
          onCancel={() => setEditingLeave(null)}
          submitting={false}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingLeave)}
        title="Excluir folga"
        message="Esta ação remove permanentemente a folga programada."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeletingLeave(null)}
      />

      <Modal
        open={Boolean(notifyPrompt)}
        title="Notificar colaborador?"
        description="Deseja enviar um e-mail (via cliente de e-mail padrão) avisando o colaborador sobre a folga registrada?"
        onClose={() => setNotifyPrompt(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotifyPrompt(null)}>
              Agora não
            </Button>
            <Button onClick={handleSendNotification}>Enviar notificação</Button>
          </>
        }
      >
        <p className="small-text">
          {notifyPrompt?.collaborator?.email ? `E-mail: ${notifyPrompt.collaborator.email}` : 'Sem e-mail cadastrado para este colaborador — cadastre em Base de Colaboradores.'}
        </p>
      </Modal>
    </PageContent>
  );
}
