import type { RefObject } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { getCycleSequence } from '../../utils/cycles';
import { minutesToTime } from '../../utils/time';
import type { CompanyCycleRow, CompanyRow } from '../../types/database';

interface CyclesSettingsPanelProps {
  companies: CompanyRow[];
  cycles: CompanyCycleRow[];
  collaboratorsCount: number;
  recordsCount: number;
  leavesCount: number;
  canManageCycles: boolean;
  onReload: () => void;
  onExportBackup: () => void;
  onImportBackupClick: () => void;
  backupInputRef: RefObject<HTMLInputElement>;
  onBackupFileSelected: (file: File) => void;
  onNewCycle: () => void;
  onRestoreDefaults: () => void;
  onDeleteCycle: (cycle: CompanyCycleRow) => void;
  canReset: boolean;
  onResetClick: () => void;
}

/**
 * Conteúdo da aba "Ciclos" em Configurações — apenas apresentação; estado,
 * modais e regras de acesso continuam vivendo em SettingsPage. Inclui,
 * junto com "Ciclos por empresa" (pedido explicitamente na tab), o card
 * "Base compartilhada (Supabase)" (conexão, contagens, backup): não foi
 * atribuído a nenhuma aba no escopo e usa a mesma permissão
 * (canManageMasterData) da gestão de ciclos, então fica aqui em vez de
 * inventar uma quarta aba fora do pedido. O card "Zona de risco" (resetar a
 * base) foi relocado do Dashboard para cá — fica separado visualmente e usa
 * uma permissão própria (canReset, restrita ao Desenvolvedor), mais estreita
 * que canManageCycles.
 */
export function CyclesSettingsPanel({
  companies,
  cycles,
  collaboratorsCount,
  recordsCount,
  leavesCount,
  canManageCycles,
  onReload,
  onExportBackup,
  onImportBackupClick,
  backupInputRef,
  onBackupFileSelected,
  onNewCycle,
  onRestoreDefaults,
  onDeleteCycle,
  canReset,
  onResetClick
}: CyclesSettingsPanelProps) {
  return (
    <>
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
            <div className="mini-value">{collaboratorsCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Registros de ponto</div>
            <div className="mini-value">{recordsCount}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-label">Folgas</div>
            <div className="mini-value">{leavesCount}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onReload}>
            Recarregar dados
          </Button>
          <Button variant="secondary" onClick={onExportBackup}>
            Exportar backup JSON
          </Button>
          {canManageCycles && (
            <>
              <Button variant="secondary" onClick={onImportBackupClick}>
                Importar backup JSON
              </Button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onBackupFileSelected(file);
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
              <Button size="small" variant="secondary" onClick={onRestoreDefaults}>
                Restaurar ciclos padrão
              </Button>
              <Button size="small" onClick={onNewCycle}>
                + Cadastrar ciclo
              </Button>
            </div>
          )}
        </div>

        {!cycles.length ? (
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
                {cycles.map((cfg) => (
                  <tr key={cfg.id}>
                    <td>{companies.find((c) => c.id === cfg.company_id)?.short_name ?? '-'}</td>
                    <td className="mono">{cfg.start_month}</td>
                    <td>{cfg.periodicity_months} meses</td>
                    <td className="mono">{minutesToTime(cfg.positive_alert_minutes)}</td>
                    <td className="mono">{minutesToTime(cfg.negative_alert_minutes)}</td>
                    <td>{cfg.responsible}</td>
                    <td>{getCycleSequence(cfg)}</td>
                    {canManageCycles && (
                      <td>
                        <Button size="small" variant="danger" onClick={() => onDeleteCycle(cfg)}>
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

      {canReset && (
        <div className="card" style={{ marginTop: 14, borderColor: 'var(--danger-mid)', background: 'var(--danger-bg)' }}>
          <h2 className="section-title" style={{ marginTop: 0, color: 'var(--danger-mid)' }}>
            Zona de risco
          </h2>
          <p className="small-text" style={{ marginBottom: 12 }}>
            Apaga colaboradores, gestores, registros de ponto, folgas e importações. Perfis de acesso e ciclos
            configurados são preservados. Esta ação não pode ser desfeita.
          </p>
          <Button variant="danger" onClick={onResetClick}>
            Resetar base
          </Button>
        </div>
      )}
    </>
  );
}
