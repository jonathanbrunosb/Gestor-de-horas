export function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

/** Formata número em Real brasileiro, ex.: "R 1.234,56" (espaço fino como no legado). */
export function formatBRL(value: number): string {
  return `R ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|\s)([a-zà-ú])/gi, (match) => match.toUpperCase());
}

/** Gera o texto de conclusão de importação (seção 19 do escopo). */
export function formatImportSummary(summary: {
  recordsInserted: number;
  collaboratorsCreated: number;
  collaboratorsUpdated: number;
  duplicateRecords: number;
  skippedRows: number;
}): string {
  return (
    `Importação concluída: ${summary.recordsInserted} registro(s), ` +
    `${summary.collaboratorsCreated} colaborador(es) criado(s), ` +
    `${summary.collaboratorsUpdated} atualizado(s), ` +
    `${summary.duplicateRecords} duplicado(s), ` +
    `${summary.skippedRows} ignorado(s).`
  );
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Converte um array de objetos em CSV com `;` como separador (Excel BR). */
export function toCSV(rows: Array<Record<string, string | number>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => {
    const text = String(value ?? '');
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(';'), ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(';'))];
  return lines.join('\n');
}
