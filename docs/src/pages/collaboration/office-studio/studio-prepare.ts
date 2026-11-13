import type { OfficeStudioDocument } from '@zui/react';
import type { StudioStoredFile } from './studio-storage';

/** Restore missing source metadata for the document entering an editor or history preview. */
export async function prepareStudioFile(file: StudioStoredFile): Promise<OfficeStudioDocument> {
  const document = file.document;
  if (document.kind !== 'excel') return document;
  const missingLayout =
    !!file.source &&
    document.sheets.some(
      (sheet) =>
        /^xlsx-sheet-\d+$/.test(sheet.id) &&
        (sheet.defaultRowHeight === undefined ||
          sheet.rowHeights === undefined ||
          sheet.hiddenRows === undefined)
    );
  if (!missingLayout && document.sheets.every((sheet) => sheet.hyperlinks !== undefined))
    return document;
  const importedXlsx = document.sheets.some((sheet) => /^xlsx-sheet-\d+$/.test(sheet.id));
  if (!file.source || !importedXlsx) {
    return {
      ...document,
      sheets: document.sheets.map((sheet) =>
        sheet.hyperlinks === undefined ? { ...sheet, hyperlinks: [] } : sheet
      ),
    };
  }
  const mime = file.source.type.split(';', 1)[0].trim().toLowerCase();
  if (
    /^(?:text|image|audio|video|font)\//.test(mime) ||
    /^(?:application\/(?:pdf|(?:[a-z0-9.-]+\+)?json|xml|msword|rtf|vnd\.openxmlformats-officedocument\.(?:wordprocessingml|presentationml)\.[a-z0-9.]+)|[^/]+\/[^/]+\+(?:json|xml))$/.test(
      mime
    )
  )
    throw new Error('此工作簿的源文件类型不匹配，文档已保留。');
  const { hydrateStudioExcelHyperlinks } = await import('./studio-excel-codec');
  return hydrateStudioExcelHyperlinks(document, file.source);
}
