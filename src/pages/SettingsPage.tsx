import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AccessProfileForm } from '../components/forms/AccessProfileForm';
import { CycleForm } from '../components/forms/CycleForm';
import { SettingsTabs, settingsTabButtonId, settingsTabPanelId, type SettingsTab } from '../components/settings/SettingsTabs';
import { UsersSettingsPanel } from '../components/settings/UsersSettingsPanel';
import { CyclesSettingsPanel } from '../components/settings/CyclesSettingsPanel';
import { AuditSettingsPanel } from '../components/settings/AuditSettingsPanel';
import { usePersistedFilter } from '../hooks/useFilters';
import { createAccessProfile, deleteAccessProfile, updateAccessProfile, type AccessProfileInput } from '../services/accessProfilesService';
import { createCycle, deleteCycle, restoreDefaultCycles, type CycleInput } from '../services/cyclesService';
import { importLegacyJson } from '../services/jsonImportService';
import { createAuditLog } from '../services/auditLogService';
import { resetDatabase } from '../services/resetService';
import { canManageAccessProfiles, canManageMasterData, canResetDatabase, canViewAuditLogs } from '../lib/permissions';
import { SETTINGS_ACTIVE_TAB_KEY } from '../lib/constants';
import { downloadFile } from '../utils/formatters';
import type { AccessProfileRow, CompanyCycleRow } from '../types/database';
import type { LegacyJsonExport } from '../types/imports';

function readStoredActiveTab(): SettingsTab {
  try {
    const stored = window.localStorage.getItem(SETTINGS_ACTIVE_TAB_KEY);
    return stored === 'cycles' || stored === 'audit' ? stored : 'users';
  } catch {
    return 'users';
  }
}

function writeStoredActiveTab(tab: SettingsTab): void {
  try {
    window.localStorage.setItem(SETTINGS_ACTIVE_TAB_KEY, tab);
  } catch {
    /* localStorage indisponível (modo privado, quota) — preferência de UI fica só em memória */
  }
}

export function SettingsPage() {
  const { data, access, toast } = useAppContext();

  // Preferência puramente visual (qual aba estava aberta) — nunca dado de
  // negócio. Trocar de aba não recarrega a página; os filtros de Usuários
  // abaixo continuam vivendo neste componente independentemente da aba
  // ativa, e a aba Auditoria só busca logs quando está montada (ver
  // AuditSettingsPanel), então trocar de aba não gera chamada desnecessária.
  const [activeTab, setActiveTab] = useState<SettingsTab>(readStoredActiveTab);
  useEffect(() => writeStoredActiveTab(activeTab), [activeTab]);

  const [search, setSearch] = usePersistedFilter('settings.profileSearch', '');
  const [typeFilter, setTypeFilter] = usePersistedFilter('settings.profileType', '');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfileRow | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<AccessProfileRow | null>(null);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [deletingCycle, setDeletingCycle] = useState<CompanyCycleRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<{ fileName: string; payload: LegacyJsonExport } | null>(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const canManageProfiles = canManageAccessProfiles(access.context.profile?.access_type);
  const canManageCycles = canManageMasterData(access.context.profile?.access_type);
  const canViewAudit = canViewAuditLogs(access.context.profile?.access_type);
  const canReset = canResetDatabase(access.context.profile?.access_type);

  const filteredProfiles = useMemo(() => {
    return data.accessProfiles
      .filter((p) => !typeFilter || p.access_type === typeFilter)
      .filter((p) => {
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        return [p.name, p.registration, p.email, p.area, p.title].some((field) => field?.toLowerCase().includes(term));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.accessProfiles, typeFilter, search]);

  async function handleProfileSubmit(payload: AccessProfileInput) {
    setSubmitting(true);
    try {
      if (editingProfile) {
        await updateAccessProfile(editingProfile.id, payload, access.context.matricula);
        toast.notify('Perfil de acesso atualizado.', 'success');
      } else {
        await createAccessProfile(payload, access.context.matricula);
        toast.notify('Perfil de acesso cadastrado.', 'success');
      }
      setProfileModalOpen(false);
      setEditingProfile(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar perfil.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProfile() {
    if (!deletingProfile) return;
    try {
      await deleteAccessProfile(deletingProfile.id, access.context.matricula);
      toast.notify('Perfil de acesso excluído.', 'success');
      setDeletingProfile(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir perfil.', 'danger');
    }
  }

  async function handleCycleSubmit(payload: CycleInput) {
    setSubmitting(true);
    try {
      await createCycle(payload, access.context.matricula);
      toast.notify('Ciclo cadastrado.', 'success');
      setCycleModalOpen(false);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao salvar ciclo.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCycle() {
    if (!deletingCycle) return;
    try {
      await deleteCycle(deletingCycle.id, access.context.matricula);
      toast.notify('Ciclo excluído.', 'success');
      setDeletingCycle(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao excluir ciclo.', 'danger');
    }
  }

  async function handleRestoreDefaults() {
    try {
      await restoreDefaultCycles(data.companies, access.context.matricula);
      toast.notify('Ciclos padrão restaurados para empresas sem ciclo cadastrado.', 'success');
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao restaurar ciclos padrão.', 'danger');
    }
  }

  function handleExportBackup() {
    const payload = { companies: data.companies, collaborators: data.collaborators, managers: data.managers, cycles: data.cycles, leaves: data.leaves, records: data.records, accessProfiles: data.accessProfiles };
    downloadFile(`backup-monitor-horas-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    void createAuditLog({
      action: 'export.json',
      actorRegistration: access.context.matricula,
      entityType: 'database',
      entityLabel: 'Backup completo (Configurações)',
      metadata: { collaborators: data.collaborators.length, managers: data.managers.length, records: data.records.length }
    });
    toast.notify('Backup JSON exportado.', 'success');
  }

  async function handleBackupFileSelected(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as LegacyJsonExport;
      const hasRecognizableData = ['collaborators', 'managers', 'records', 'leaves', 'cycles', 'userProfiles', 'perfisAcesso', 'accessProfiles', 'profiles'].some(
        (key) => Array.isArray((payload as Record<string, unknown>)[key]) && ((payload as Record<string, unknown>)[key] as unknown[]).length > 0
      );
      if (!hasRecognizableData) {
        toast.notify('Arquivo JSON não reconhecido — verifique se é um backup exportado pelo sistema.', 'danger');
        return;
      }
      setPendingBackup({ fileName: file.name, payload });
    } catch {
      toast.notify('Falha ao ler o arquivo — verifique se é um JSON válido.', 'danger');
    }
  }

  async function handleReset() {
    try {
      await resetDatabase(
        { collaborators: true, managers: true, records: true, leaves: true, imports: true, cycles: false },
        access.context.matricula
      );
      toast.notify('Base resetada. Perfis de acesso e ciclos foram preservados.', 'success');
      setResetOpen(false);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao resetar a base.', 'danger');
    }
  }

  async function handleConfirmBackupImport() {
    if (!pendingBackup) return;
    setImportingBackup(true);
    try {
      const summary = await importLegacyJson(pendingBackup.payload, data.companies, access.context.matricula);
      toast.notify(
        `Backup importado: ${summary.collaboratorsCreated} colaborador(es) criado(s), ${summary.collaboratorsUpdated} atualizado(s), ` +
          `${summary.recordsInserted} registro(s) de ponto, ${summary.leavesInserted} folga(s), ${summary.managersCreated + summary.managersUpdated} gestor(es), ` +
          `${summary.cyclesProcessed} ciclo(s), ${summary.profilesCreated} perfil(is) novo(s).`,
        'success'
      );
      setPendingBackup(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao importar o backup.', 'danger');
    } finally {
      setImportingBackup(false);
    }
  }

  return (
    <PageContent title="Configurações" description="Perfil do usuário, perfis de acesso, ciclos por empresa e trilha de auditoria.">
      <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'users' && (
        <div id={settingsTabPanelId('users')} role="tabpanel" aria-labelledby={settingsTabButtonId('users')} className="settings-tab-panel">
          <UsersSettingsPanel
            accessContext={access.context}
            profiles={filteredProfiles}
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            canManageProfiles={canManageProfiles}
            onNewProfile={() => {
              setEditingProfile(null);
              setProfileModalOpen(true);
            }}
            onEditProfile={(p) => {
              setEditingProfile(p);
              setProfileModalOpen(true);
            }}
            onDeleteProfile={setDeletingProfile}
          />
        </div>
      )}

      {activeTab === 'cycles' && (
        <div id={settingsTabPanelId('cycles')} role="tabpanel" aria-labelledby={settingsTabButtonId('cycles')} className="settings-tab-panel">
          <CyclesSettingsPanel
            companies={data.companies}
            cycles={data.cycles}
            collaboratorsCount={data.collaborators.length}
            recordsCount={data.records.length}
            leavesCount={data.leaves.length}
            canManageCycles={canManageCycles}
            onReload={() => data.reload()}
            onExportBackup={handleExportBackup}
            onImportBackupClick={() => backupInputRef.current?.click()}
            backupInputRef={backupInputRef}
            onBackupFileSelected={handleBackupFileSelected}
            onNewCycle={() => setCycleModalOpen(true)}
            onRestoreDefaults={handleRestoreDefaults}
            onDeleteCycle={setDeletingCycle}
            canReset={canReset}
            onResetClick={() => setResetOpen(true)}
          />
        </div>
      )}

      {activeTab === 'audit' && (
        <div id={settingsTabPanelId('audit')} role="tabpanel" aria-labelledby={settingsTabButtonId('audit')} className="settings-tab-panel">
          <AuditSettingsPanel canView={canViewAudit} />
        </div>
      )}

      <Modal open={profileModalOpen} title={editingProfile ? 'Editar perfil de acesso' : 'Cadastrar perfil de acesso'} onClose={() => setProfileModalOpen(false)}>
        <AccessProfileForm initial={editingProfile} onSubmit={handleProfileSubmit} onCancel={() => setProfileModalOpen(false)} submitting={submitting} />
      </Modal>

      <Modal open={cycleModalOpen} title="Cadastrar ciclo" onClose={() => setCycleModalOpen(false)}>
        <CycleForm companies={data.companies} onSubmit={handleCycleSubmit} onCancel={() => setCycleModalOpen(false)} submitting={submitting} />
      </Modal>

      <Modal
        open={Boolean(pendingBackup)}
        title="Confirmar importação de backup"
        description={pendingBackup ? `Arquivo: ${pendingBackup.fileName}` : undefined}
        onClose={() => setPendingBackup(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingBackup(null)} disabled={importingBackup}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmBackupImport} disabled={importingBackup}>
              {importingBackup ? 'Importando…' : 'Confirmar importação'}
            </Button>
          </>
        }
      >
        {pendingBackup && (
          <div className="grid cards-4">
            <div className="mini-stat">
              <div className="mini-label">Colaboradores</div>
              <div className="mini-value">{pendingBackup.payload.collaborators?.length ?? 0}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Gestores</div>
              <div className="mini-value">{pendingBackup.payload.managers?.length ?? 0}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Registros de ponto</div>
              <div className="mini-value">{pendingBackup.payload.records?.length ?? 0}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Folgas</div>
              <div className="mini-value">{pendingBackup.payload.leaves?.length ?? 0}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Ciclos</div>
              <div className="mini-value">{pendingBackup.payload.cycles?.length ?? 0}</div>
            </div>
            <div className="mini-stat">
              <div className="mini-label">Perfis de acesso</div>
              <div className="mini-value">{pendingBackup.payload.userProfiles?.length ?? pendingBackup.payload.accessProfiles?.length ?? 0}</div>
            </div>
          </div>
        )}
        <p className="small-text" style={{ marginTop: 12 }}>
          Colaboradores/gestores/perfis existentes serão atualizados (nunca duplicados); registros e folgas já
          importados anteriormente são ignorados automaticamente. O perfil do Desenvolvedor (u1205385) nunca é alterado
          por esta importação.
        </p>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingProfile)}
        title="Excluir perfil de acesso"
        message="Esta ação remove permanentemente o perfil de acesso selecionado."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDeleteProfile}
        onCancel={() => setDeletingProfile(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingCycle)}
        title="Excluir ciclo"
        message="Esta ação remove permanentemente a configuração de ciclo desta empresa."
        confirmLabel="Excluir"
        danger
        onConfirm={handleDeleteCycle}
        onCancel={() => setDeletingCycle(null)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Resetar base de dados"
        message="Esta ação apaga colaboradores, gestores, registros de ponto, folgas e importações. Perfis de acesso e ciclos configurados são preservados. Esta ação não pode ser desfeita."
        confirmLabel="Resetar base"
        danger
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </PageContent>
  );
}
