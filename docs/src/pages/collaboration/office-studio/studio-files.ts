import {
  createOfficeStudioDocument,
  type OfficeStudioDocument,
  type OfficeStudioKind,
} from '@zui/react';

export const STUDIO_FILE_LIMIT = 20 * 1024 * 1024;

export async function importStudioFile(file: File): Promise<OfficeStudioDocument> {
  if (!file.size || file.size > STUDIO_FILE_LIMIT)
    throw new Error('请导入非空的 DOCX、XLSX 或 PDF 文件，最大 20 MB。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'docx')
    return (await import('./studio-word-codec')).importStudioWord(file, file.name);
  if (extension === 'xlsx')
    return (await import('./studio-excel-codec')).importStudioExcel(file, file.name);
  if (extension === 'pdf')
    return (await import('./studio-pdf-codec')).importStudioPdf(file, file.name);
  throw new Error('首版支持 .docx、.xlsx 和 .pdf，请先将其他格式转换为这些文件。');
}

export async function exportStudioFile(
  document: OfficeStudioDocument,
  source?: Blob
): Promise<Blob> {
  if (document.kind === 'word')
    return (await import('./studio-word-codec')).exportStudioWord(document);
  if (document.kind === 'excel')
    return (await import('./studio-excel-codec')).exportStudioExcel(document, source);
  if (!source) throw new Error('PDF 原始文件不可用，请重新导入文档。');
  return (await import('./studio-pdf-codec')).exportStudioPdf(document, source);
}

export async function createStudioFile(
  kind: OfficeStudioKind
): Promise<{ document: OfficeStudioDocument; source: Blob }> {
  if (kind === 'pdf') {
    const source = await (await import('../office/samples')).officeSample('pdf');
    const document = await (
      await import('./studio-pdf-codec')
    ).importStudioPdf(source, source.name);
    return { document, source };
  }
  const document = createOfficeStudioDocument(kind);
  const source = await exportStudioFile(document);
  return { document, source };
}

export function downloadStudioFile(blob: Blob, document: OfficeStudioDocument) {
  const extension = document.kind === 'word' ? 'docx' : document.kind === 'excel' ? 'xlsx' : 'pdf';
  const cleanName = [...document.name]
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('');
  const base =
    cleanName
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\.(?:docx|xlsx|pdf)$/i, '')
      .trim() || '文档';
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = `${base}.${extension}`;
  anchor.hidden = true;
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
