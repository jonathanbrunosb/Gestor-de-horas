import { useMemo, useRef, useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { AccessProfileForm } from '../components/forms/AccessProfileForm';
import { CycleForm } from '../components/forms/CycleForm';
import { usePersistedFilter } from '../hooks/useFilters';
import { createAccessProfile, deleteAccessProfile, updateAccessProfile, type AccessProfileInput } from '../services/accessProfilesService';
import { createCycle, deleteCycle, restoreDefaultCycles, type CycleInput } from '../services/cyclesService';
import { importLegacyJson } from '../services/jsonImportService';
import { canManageAccessProfiles, canManageMasterData, accessTypeBadgeTone, isDeveloperMatricula } from '../lib/permissions';
import { ACCESS_PROFILE_TYPES } from '../lib/constants';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { getCycleSequence } from '../utils/cycles';
import { minutesToTime } from '../utils/time';
import { downloadFile } from '../utils/formatters';
import type { AccessProfileRow, CompanyCycleRow } from '../types/database';
import type { LegacyJsonExport } from '../types/imports';

export function SettingsPage() {
  const { data, access, toast } = useAppContext();
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
  const backupInputRef = useRef<HTMLInputElement>(null);

  const canManageProfiles = canManageAccessProfiles(access.context.profile?.access_type);
  const canManageCycles = canManageMasterData(access.context.profile?.access_type);

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
    <PageContent title="Configurações" description="Perfil do usuário, perfis de acesso, conexão com o Supabase e ciclos por empresa.">
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="section-title">Perfil do usuário</h2>
        <div className="form-row">
          <div className="field">
            <label>Nome</label>
            <input value={access.context.profile?.name ?? ''} disabled />
          </div>
          <div className="field">
            <label>Matrícula</label>
            <input value={access.context.matricula} disabled />
          </div>
          <div className="field">
            <label>Área</label>
            <input value={access.context.profile?.area ?? ''} disabled />
          </div>
          <div className="field">
            <label>Status da matrícula</label>
            <Badge label={access.context.role} tone={accessTypeBadgeTone(access.context.profile?.access_type)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Perfis de acesso
          </h2>
          {canManageProfiles && (
            <Button
              size="small"
              onClick={() => {
                setEditingProfile(null);
                setProfileModalOpen(true);
              }}
            >
              + Cadastrar perfil de acesso
            </Button>
          )}
        </div>

        <div className="filters three" style={{ marginBottom: 12 }}>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Busca</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, matrícula, e-mail, área ou cargo" />
          </div>
          <div className="field">
            <label>Perfil</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos</option>
              {ACCESS_PROFILE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {!filteredProfiles.length ? (
          <EmptyState message="Nenhum perfil de acesso cadastrado." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Área</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.registration}</td>
                    <td>{p.name}</td>
                    <td>{p.email || '-'}</td>
                    <td>
                      <Badge label={p.access_type} tone={accessTypeBadgeTone(p.access_type)} />
                    </td>
                    <td>{p.area || '-'}</td>
                    <td>
                      <Badge label={p.status} tone={p.status === 'Ativo' ? 'success' : 'inactive'} />
                    </td>
                    <td className="actions-cell">
                      {canManageProfiles && (
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => {
                            setEditingProfile(p);
                            setProfileModalOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      {canManageProfiles && !isDeveloperMatricula(p.registration) && (
                        <Button size="small" variant="danger" onClick={() => setDeletingProfile(p)}>
                          Excluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="section-title">Base compartilhada (Supabase)</h2>
        <div className="grid cards-4">
          <div className="mini-stat">
            <div className="mini-label">Conexão</div>
            <div className="mini-value" style={{ fontSize: 13 }}>
              {isSupabaseConfigured ? <Badge label="Conectado" tone="success" /> : <Badge label="Não configurado" tone="danger" />}
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Colaboradores</div>
            <div className="mini-value">{data.collaborators.length}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Registros de ponto</div>
            <div className="mini-value">{data.records.length}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Folgas</div>
            <div className="mini-value">{data.leaves.length}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => data.reload()}>
            Recarregar dados
          </Button>
          <Button variant="secondary" onClick={handleExportBackup}>
            Exportar backup JSON
          </Button>
          {canManageCycles && (
            <>
              <Button variant="secondary" onClick={() => backupInputRef.current?.click()}>
                Importar backup JSON
              </Button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBackupFileSelected(file);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>
        {canManageCycles && (
          <p className="small-text" style={{ marginTop: 8 }}>
            Aceita um backup completo (empresas, gestores, colaboradores com saldos, registros de ponto, folgas, ciclos e
            perfis de acesso) exportado por esta aplicação ou pelo sistema legado. Nunca duplica dados, nunca cria
            gestores automaticamente e nunca altera o perfil protegido do Desenvolvedor.
          </p>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Ciclos por empresa
          </h2>
          {canManageCycles && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" variant="secondary" onClick={handleRestoreDefaults}>
                Restaurar ciclos padrão
              </Button>
              <Button size="small" onClick={() => setCycleModalOpen(true)}>
                + Cadastrar ciclo
              </Button>
            </div>
          )}
        </div>

        {!data.cycles.length ? (
          <EmptyState message="Nenhum ciclo cadastrado." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Início do ciclo</th>
                  <th>Periodicidade</th>
                  <th>Limite positivo</th>
                  <th>Limite negativo</th>
                  <th>Responsável</th>
                  <th>Posição atual</th>
                  {canManageCycles && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {data.cycles.map((cfg) => (
                  <tr key={cfg.id}>
                    <td>{data.companies.find((c) => c.id === cfg.company_id)?.short_name ?? '-'}</td>
                    <td className="mono">{cfg.start_month}</td>
                    <td>{cfg.periodicity_months} meses</td>
                    <td className="mono">{minutesToTime(cfg.positive_alert_minutes)}</td>
                    <td className="mono">{minutesToTime(cfg.negative_alert_minutes)}</td>
                    <td>{cfg.responsible}</td>
                    <td>{getCycleSequence(cfg)}</td>
                    {canManageCycles && (
                      <td>
                        <Button size="small" variant="danger" onClick={() => setDeletingCycle(cfg)}>
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
    </PageContent>
  );
}
