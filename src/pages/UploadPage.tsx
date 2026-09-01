import { useState } from 'react';
import { useAppContext } from '../hooks/AppDataContext';
import { PageContent } from '../components/layout/PageContent';
import { UploadDropzone } from '../components/import/UploadDropzone';
import { ImportPreview } from '../components/import/ImportPreview';
import { ManualImportModal } from '../components/import/ManualImportModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import type { ImportFileType } from '../types/database';
import type { ImportPreviewResult, ImportedRecord } from '../types/imports';
import { parseDelimitedFile } from '../utils/csvParser';
import { confirmImport, clearImportedTimeRecords } from '../services/importsService';
import { formatImportSummary } from '../utils/formatters';
import { formatDateTime } from '../utils/dates';
import { canManageMasterData } from '../lib/permissions';
import { EmptyState } from '../components/ui/EmptyState';

function detectFileType(fileName: string): ImportFileType {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'json') return 'json';
  if (ext === 'txt') return 'txt';
  return 'csv';
}

export function UploadPage() {
  const { data, access, toast } = useAppContext();
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lastFailedFile, setLastFailedFile] = useState<string | null>(null);

  const canImport = canManageMasterData(access.context.profile?.access_type);

  async function handleFiles(files: File[]) {
    setProcessing(true);
    try {
      for (const file of files) {
        const fileType = detectFileType(file.name);
        if (fileType === 'csv' || fileType === 'txt') {
          const text = await file.text();
          const { records, messages } = parseDelimitedFile(text);
          setPreview({ fileName: file.name, fileType, rowsRead: records.length + messages.filter((m) => m.level === 'error').length, records, messages, requiresManualEntry: false });
        } else if (fileType === 'pdf') {
          const { parseTimeCardPdf } = await import('../utils/pdfParser');
          const result = await parseTimeCardPdf(file);
          if (!result.hasSelectableText) {
            setLastFailedFile(file.name);
            setManualOpen(true);
            setPreview({ fileName: file.name, fileType, rowsRead: 0, records: [], messages: result.messages, requiresManualEntry: true });
          } else {
            setPreview({ fileName: file.name, fileType, rowsRead: result.records.length, records: result.records, messages: result.messages, requiresManualEntry: false });
          }
        } else if (fileType === 'json') {
          const text = await file.text();
          try {
            const payload = JSON.parse(text);
            const records: ImportedRecord[] = Array.isArray(payload.records) ? payload.records : [];
            setPreview({ fileName: file.name, fileType, rowsRead: records.length, records, messages: [{ level: 'info', message: 'Base JSON carregada. Use Base de Colaboradores > Configurações para mesclar cadastros completos.' }], requiresManualEntry: false });
          } catch {
            toast.notify('JSON inválido — verifique o arquivo.', 'danger');
          }
        }
      }
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao processar arquivo.', 'danger');
    } finally {
      setProcessing(false);
    }
  }

  function handleManualSubmit(record: ImportedRecord) {
    setPreview((prev) =>
      prev
        ? { ...prev, records: [...prev.records, record], rowsRead: prev.rowsRead + 1, requiresManualEntry: false }
        : { fileName: lastFailedFile ?? 'lançamento-manual', fileType: 'pdf', rowsRead: 1, records: [record], messages: [], requiresManualEntry: false }
    );
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    try {
      const summary = await confirmImport({
        records: preview.records,
        fileName: preview.fileName,
        fileType: preview.fileType,
        companies: data.companies,
        existingCollaborators: data.collaborators,
        actorRegistration: access.context.matricula
      });
      toast.notify(formatImportSummary(summary), 'success');
      setPreview(null);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao confirmar importação.', 'danger');
    } finally {
      setConfirming(false);
    }
  }

  async function handleClearImported() {
    try {
      await clearImportedTimeRecords(access.context.matricula);
      toast.notify('Base de registros importados foi limpa.', 'success');
      setConfirmClear(false);
      data.reload();
    } catch (error) {
      toast.notify(error instanceof Error ? error.message : 'Falha ao limpar base importada.', 'danger');
    }
  }

  if (!canImport) {
    return (
      <PageContent title="Upload de Arquivos" description="Importação de cartão-ponto (CSV, TXT, PDF ou JSON).">
        <EmptyState message="Seu perfil não possui permissão para importar dados. Solicite acesso de Administrador ou Desenvolvedor." />
      </PageContent>
    );
  }

  return (
    <PageContent
      title="Upload de Arquivos"
      description="Importe cartões-ponto em CSV, TXT, PDF (texto selecionável) ou uma base JSON exportada anteriormente."
      actions={
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          Limpar base importada
        </Button>
      }
    >
      {!preview && (
        <div className="card">
          <UploadDropzone onFilesSelected={handleFiles} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
              Lançamento manual
            </Button>
          </div>
          {processing && <p className="small-text" style={{ marginTop: 10 }}>Processando arquivo…</p>}
        </div>
      )}

      {preview && (
        <ImportPreview preview={preview} onConfirm={handleConfirm} onCancel={() => setPreview(null)} confirming={confirming} />
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <h2 className="section-title">Histórico de importações</h2>
        {!data.imports.length ? (
          <EmptyState message="Nenhuma importação registrada ainda." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Arquivo</th>
                  <th>Tipo</th>
                  <th>Linhas lidas</th>
                  <th>Registros</th>
                  <th>Colab. criados</th>
                  <th>Colab. atualizados</th>
                  <th>Duplicados</th>
                  <th>Ignorados</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((imp) => (
                  <tr key={imp.id}>
                    <td>{formatDateTime(imp.created_at)}</td>
                    <td>{imp.filename}</td>
                    <td>{imp.file_type}</td>
                    <td className="mono">{imp.rows_read}</td>
                    <td className="mono">{imp.records_inserted}</td>
                    <td className="mono">{imp.collaborators_created}</td>
                    <td className="mono">{imp.collaborators_updated}</td>
                    <td className="mono">{imp.duplicate_records}</td>
                    <td className="mono">{imp.skipped_rows}</td>
                    <td>{imp.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ManualImportModal open={manualOpen} onClose={() => setManualOpen(false)} onSubmit={handleManualSubmit} />

      <ConfirmDialog
        open={confirmClear}
        title="Limpar base importada"
        message="Esta ação remove todos os registros de ponto (time_records) importados. Colaboradores, gestores e folgas não são afetados. Esta ação não pode ser desfeita."
        confirmLabel="Limpar registros"
        danger
        onConfirm={handleClearImported}
        onCancel={() => setConfirmClear(false)}
      />
    </PageContent>
  );
}
