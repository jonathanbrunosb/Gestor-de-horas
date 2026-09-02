import * as pdfjsLib from 'pdfjs-dist';
// Worker instalado via npm (pdfjs-dist), nunca via CDN — empacotado pelo Vite.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { ImportedRecord, ImportValidationMessage } from '../types/imports';
import { groupPdfItemsIntoRows, parsePdfRows, type PdfRow, type PdfTextItem } from './pdfTimeCardLayout';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfParseResult {
  hasSelectableText: boolean;
  records: ImportedRecord[];
  messages: ImportValidationMessage[];
}

/**
 * Extrai texto de um PDF de cartão-ponto usando pdfjs-dist (instalado via npm).
 * Se o PDF não tiver texto selecionável, retorna hasSelectableText=false para
 * que a UI acione o assistente de lançamento manual — nunca trava a aplicação.
 *
 * A interpretação do layout fica em pdfTimeCardLayout.ts, que trabalha só com
 * os itens de texto já extraídos e por isso é testável sem o pdfjs.
 */
export async function parseTimeCardPdf(file: File, today: Date = new Date()): Promise<PdfParseResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const rows: PdfRow[] = [];
  let totalChars = 0;
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as PdfTextItem[];
    totalChars += items.reduce((sum, item) => sum + (item.str?.length || 0), 0);
    rows.push(...groupPdfItemsIntoRows(items));
  }

  if (totalChars < 20) {
    return {
      hasSelectableText: false,
      records: [],
      messages: [{ level: 'warning', message: 'PDF sem texto selecionável (provavelmente digitalizado/imagem). Use o lançamento manual.' }]
    };
  }

  try {
    const { records, messages } = parsePdfRows(rows, file.name, today);
    return { hasSelectableText: true, records, messages };
  } catch (error) {
    return {
      hasSelectableText: false,
      records: [],
      messages: [{ level: 'error', message: error instanceof Error ? error.message : 'Falha ao interpretar o PDF.' }]
    };
  }
}
