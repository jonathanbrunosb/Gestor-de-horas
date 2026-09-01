import type { ImportPreviewResult } from '../../types/imports';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../utils/dates';

interface ImportPreviewProps {
  preview: ImportPreviewResult;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

export function ImportPreview({ preview, onConfirm, onCancel, confirming }: ImportPreviewProps) {
  const errors = preview.messages.filter((m) => m.level === 'error');
  const warnings = preview.messages.filter((m) => m.level === 'warning');

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            Prévia da importação — {preview.fileName}
          </h2>
          <p className="section-subtitle" style={{ margin: '2px 0 0' }}>
            {preview.rowsRead} linha(s) lida(s) · {preview.records.length} registro(s) válido(s)
          </p>
        </div>
        <div className="kpi-row" style={{ marginTop: 0 }}>
          <Badge label={`${preview.records.length} válidos`} tone="success" />
          {warnings.length > 0 && <Badge label={`${warnings.length} avisos`} tone="warning" />}
          {errors.length > 0 && <Badge label={`${errors.length} erros`} tone="danger" />}
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="list" style={{ marginBottom: 14 }}>
          {[...errors, ...warnings].slice(0, 20).map((message, idx) => (
            <div key={idx} className="list-item" style={{ borderColor: message.level === 'error' ? 'var(--danger-border)' : 'var(--warning-border)' }}>
              <span className="small-text">{message.message}</span>
              <Badge label={message.level === 'error' ? 'Erro' : 'Aviso'} tone={message.level === 'error' ? 'danger' : 'warning'} />
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Matrícula</th>
              <th>Empresa</th>
              <th>Data</th>
              <th>Ocorrência</th>
              <th>Trab.</th>
              <th>Crd BH</th>
              <th>Deb BH</th>
            </tr>
          </thead>
          <tbody>
            {preview.records.slice(0, 100).map((record, idx) => (
              <tr key={idx}>
                <td>{record.collaboratorName}</td>
                <td className="mono">{record.collaboratorRegistration || '-'}</td>
                <td>{record.companyName || '-'}</td>
                <td>{formatDate(record.date)}</td>
                <td>{record.occurrence || '-'}</td>
                <td className="mono">{record.workedTime || '-'}</td>
                <td className="mono">{record.creditBhTime || '-'}</td>
                <td className="mono">{record.debitBhTime || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="modal-foot" style={{ borderTop: 'none', paddingTop: 14 }}>
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>
          Cancelar importação
        </Button>
        <Button onClick={onConfirm} disabled={confirming || !preview.records.length}>
          {confirming ? 'Importando…' : 'Confirmar importação'}
        </Button>
      </div>
    </div>
  );
}
