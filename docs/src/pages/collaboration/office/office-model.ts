export interface WordChanges {
  paragraphs: Record<string, string>;
}
export interface ExcelCellChange {
  value: string;
  bold?: boolean;
  numberFormat?: string;
}
export interface ExcelChanges {
  cells: Record<string, ExcelCellChange>;
}
export interface PdfMark {
  id: string;
  page: number;
  type: 'text' | 'highlight';
  x: number;
  y: number;
  text: string;
  size: number;
}
export interface PdfChanges {
  marks: PdfMark[];
  rotations: Record<string, number>;
  fields: Record<string, string | boolean>;
}
export type OfficeChanges = WordChanges | ExcelChanges | PdfChanges;
export interface OfficeDraft {
  kind: 'word' | 'excel' | 'pdf';
  baseRevision: number;
  changes: OfficeChanges;
}

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function validateOfficeDraft(value: unknown): OfficeDraft {
  if (
    !object(value) ||
    !Number.isSafeInteger(value.baseRevision) ||
    Number(value.baseRevision) < 1 ||
    !object(value.changes) ||
    new Blob([JSON.stringify(value)]).size > 5 * 1024 * 1024
  )
    throw new Error('Office 草稿无效或超过 5 MB。');
  const changes = value.changes;
  if (value.kind === 'word') {
    if (
      !object(changes.paragraphs) ||
      Object.keys(changes.paragraphs).length > 10000 ||
      Object.entries(changes.paragraphs).some(
        ([key, text]) => !/^\d+$/.test(key) || typeof text !== 'string' || text.length > 100000
      )
    )
      throw new Error('Word 草稿无效。');
  } else if (value.kind === 'excel') {
    if (
      !object(changes.cells) ||
      Object.keys(changes.cells).length > 10000 ||
      Object.entries(changes.cells).some(
        ([key, cell]) =>
          !/^\d+:[A-Z]{1,3}[1-9]\d{0,6}$/.test(key) ||
          !object(cell) ||
          typeof cell.value !== 'string' ||
          cell.value.length > 32767 ||
          (cell.bold !== undefined && typeof cell.bold !== 'boolean') ||
          (cell.numberFormat !== undefined &&
            (typeof cell.numberFormat !== 'string' || cell.numberFormat.length > 100))
      )
    )
      throw new Error('Excel 草稿无效。');
  } else if (value.kind === 'pdf') {
    if (
      !Array.isArray(changes.marks) ||
      changes.marks.length > 500 ||
      !object(changes.rotations) ||
      !object(changes.fields) ||
      Object.keys(changes.fields).length > 1000 ||
      Object.entries(changes.fields).some(
        ([key, entry]) =>
          key.length > 300 ||
          (typeof entry !== 'boolean' && (typeof entry !== 'string' || entry.length > 10000))
      ) ||
      Object.entries(changes.rotations).some(
        ([key, rotation]) => !/^\d+$/.test(key) || ![0, 90, 180, 270].includes(Number(rotation))
      ) ||
      changes.marks.some(
        (mark) =>
          !object(mark) ||
          typeof mark.id !== 'string' ||
          !Number.isSafeInteger(mark.page) ||
          Number(mark.page) < 0 ||
          !['text', 'highlight'].includes(String(mark.type)) ||
          typeof mark.text !== 'string' ||
          mark.text.length > 1000 ||
          ![mark.x, mark.y, mark.size].every(
            (number) => typeof number === 'number' && Number.isFinite(number)
          ) ||
          Number(mark.size) < 8 ||
          Number(mark.size) > 48
      )
    )
      throw new Error('PDF 草稿无效。');
  } else throw new Error('不支持此 Office 草稿。');
  return value as unknown as OfficeDraft;
}

export interface EditorProps<T> {
  source: Blob;
  changes: T;
  disabled: boolean;
  onChange: (changes: T) => void;
  onExporter: (exporter: (() => Promise<Blob>) | null) => void;
}
export function emptyChanges(kind: OfficeDraft['kind']): OfficeChanges {
  return kind === 'word'
    ? { paragraphs: {} }
    : kind === 'excel'
      ? { cells: {} }
      : { marks: [], rotations: {}, fields: {} };
}
