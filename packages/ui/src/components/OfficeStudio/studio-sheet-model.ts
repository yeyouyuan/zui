import FormulaParser from 'fast-formula-parser';
import { studioCellFontIssue } from './studio-model';
import { studioCellStyleIssue } from './studio-cell-style';
import {
  studioCopySheetHyperlinks,
  studioDeleteSheetHyperlinks,
  studioIsSheetHyperlink,
  studioPatchSheetHyperlinks,
  studioRenameSheetHyperlinks,
  studioSheetHyperlinkAt,
  studioSheetHyperlinksAt,
} from './studio-sheet-hyperlinks';
import {
  studioCellValidation,
  studioMapSheetRuleFormulae,
  studioNormalizeValidationInput,
  studioSheetRuleFormulae,
} from './studio-sheet-rules';
import type { StudioSheetRuleCalculation, StudioSheetRuleResult } from './studio-sheet-rules';
import type {
  StudioCell,
  StudioExcelDocument,
  StudioSheet,
  StudioSheetHyperlink,
} from './studio-types';

export const STUDIO_SHEET_LIMITS = {
  rows: 10000,
  columns: 256,
  sheets: 32,
  storedCells: 100000,
  clipboardCells: 10000,
  defaultRowHeight: 18,
  rowHeight: 409.5,
} as const;

export interface SheetPosition {
  row: number;
  col: number;
}

export const STUDIO_SHEET_CLIPBOARD_TYPE = 'application/x-zui-studio-sheet-range';

export type StudioSheetPasteMode =
  | 'all'
  | 'formulas'
  | 'values'
  | 'formats'
  | 'formulas-number-format'
  | 'values-number-format'
  | 'source-formatting'
  | 'without-borders'
  | 'column-widths'
  | 'transpose';

export type StudioSheetClipboardValue =
  | { type: 'blank' }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'string' | 'error'; value: string };

export interface StudioSheetClipboardOrigin extends SheetPosition {
  rows?: number;
  columns?: number;
  cells?: StudioCell[];
  values?: StudioSheetClipboardValue[];
  columnWidths?: number[];
  merges?: StudioRange[];
  hyperlinks?: StudioSheetHyperlink[];
}

const clipboardCellKeys = new Set([
  'input',
  'bold',
  'italic',
  'underline',
  'fontFamily',
  'fontSize',
  'wrap',
  'color',
  'background',
  'numberFormat',
  'align',
  'verticalAlign',
  'borders',
]);
const clipboardBooleanCellKeys = ['bold', 'italic', 'underline', 'wrap'] as const;
const clipboardFormatDefaults: Omit<StudioCell, 'input'> = {
  bold: false,
  italic: false,
  underline: false,
  fontFamily: 'Calibri',
  fontSize: 11,
  wrap: false,
  color: '#000000',
  background: 'none',
  numberFormat: 'General',
  align: 'general',
  verticalAlign: 'bottom',
  borders: {},
};

function cloneClipboardCell(cell: StudioCell): StudioCell {
  return {
    ...cell,
    ...(cell.borders
      ? {
          borders: Object.fromEntries(
            Object.entries(cell.borders).map(([side, border]) => [
              side,
              border ? { ...border } : border,
            ])
          ) as StudioCell['borders'],
        }
      : {}),
  };
}

function clipboardCell(value: unknown): StudioCell | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const cell = value as Record<string, unknown>;
  if (Object.keys(cell).some((key) => !clipboardCellKeys.has(key))) return;
  if (typeof cell.input !== 'string' || cell.input.length > 32767) return;
  if (clipboardBooleanCellKeys.some((key) => key in cell && typeof cell[key] !== 'boolean')) return;
  if (
    ('color' in cell && (typeof cell.color !== 'string' || !/^#[\da-f]{6}$/i.test(cell.color))) ||
    ('background' in cell &&
      (typeof cell.background !== 'string' || !/^(?:none|#[\da-f]{6})$/i.test(cell.background))) ||
    ('numberFormat' in cell &&
      (typeof cell.numberFormat !== 'string' ||
        cell.numberFormat.length > 1024 ||
        // 这里就是要匹配控制字符本身（XML 不可表示字符校验），关闭该规则。
        // eslint-disable-next-line no-control-regex
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cell.numberFormat))) ||
    ('align' in cell && !['left', 'center', 'right', 'general'].includes(String(cell.align)))
  )
    return;
  const candidate = cloneClipboardCell(cell as unknown as StudioCell);
  if (studioCellFontIssue(candidate) || studioCellStyleIssue(candidate)) return;
  return candidate;
}

function clipboardValue(value: unknown): StudioSheetClipboardValue | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const entry = value as Record<string, unknown>;
  if (entry.type === 'blank' && Object.keys(entry).length === 1) return { type: 'blank' };
  if (
    entry.type === 'number' &&
    Object.keys(entry).length === 2 &&
    typeof entry.value === 'number' &&
    Number.isFinite(entry.value)
  )
    return { type: 'number', value: entry.value };
  if (
    entry.type === 'boolean' &&
    Object.keys(entry).length === 2 &&
    typeof entry.value === 'boolean'
  )
    return { type: 'boolean', value: entry.value };
  if (
    (entry.type === 'string' || entry.type === 'error') &&
    Object.keys(entry).length === 2 &&
    typeof entry.value === 'string' &&
    entry.value.length <= 32767
  )
    return { type: entry.type, value: entry.value };
}

function clipboardRange(value: unknown, rows: number, columns: number): StudioRange | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const range = value as Record<string, unknown>;
  if (
    Object.keys(range).some(
      (key) => !['firstRow', 'lastRow', 'firstCol', 'lastCol'].includes(key)
    ) ||
    !['firstRow', 'lastRow', 'firstCol', 'lastCol'].every((key) => Number.isInteger(range[key]))
  )
    return;
  const checked = range as unknown as StudioRange;
  if (
    checked.firstRow < 0 ||
    checked.firstCol < 0 ||
    (checked.firstRow === checked.lastRow && checked.firstCol === checked.lastCol) ||
    checked.lastRow < checked.firstRow ||
    checked.lastCol < checked.firstCol ||
    checked.lastRow >= rows ||
    checked.lastCol >= columns
  )
    return;
  return { ...checked };
}

function validSheetPosition(position: SheetPosition): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 1 &&
    position.row <= STUDIO_SHEET_LIMITS.rows &&
    position.col >= 1 &&
    position.col <= STUDIO_SHEET_LIMITS.columns
  );
}

/** Custom clipboard metadata is optional. Plain TSV from other apps keeps its original formulas. */
export function studioClipboardOrigin(
  payload: string,
  text: string
): StudioSheetClipboardOrigin | undefined {
  if (!payload || payload.length > 10000200) return undefined;
  try {
    const value = JSON.parse(payload);
    if (!value || ![1, 2, 3].includes(value.version) || value.text !== text) return undefined;
    const position = { row: value.row, col: value.col };
    if (!validSheetPosition(position)) return undefined;
    if (value.version === 1) return position;
    if (
      !Array.isArray(value.hyperlinks) ||
      value.hyperlinks.length > STUDIO_SHEET_LIMITS.clipboardCells ||
      !value.hyperlinks.every(studioIsSheetHyperlink) ||
      new Set(value.hyperlinks.map((link: StudioSheetHyperlink) => link.id)).size !==
        value.hyperlinks.length
    )
      return undefined;
    const parsedRows = studioParseTsv(text);
    const width = Math.max(...parsedRows.map((row) => row.length));
    if (
      !validSheetPosition({
        row: position.row + parsedRows.length - 1,
        col: position.col + width - 1,
      })
    )
      return undefined;
    for (const link of value.hyperlinks as StudioSheetHyperlink[]) {
      const range = studioParseRange(link.ref)!;
      if (
        range.firstRow < position.row ||
        range.firstCol < position.col ||
        range.lastRow >= position.row + parsedRows.length
      )
        return undefined;
      for (let row = range.firstRow; row <= range.lastRow; row++)
        if (range.lastCol >= position.col + parsedRows[row - position.row].length) return undefined;
    }
    if (value.version === 2)
      return {
        ...position,
        hyperlinks: (value.hyperlinks as StudioSheetHyperlink[]).map((link) => ({ ...link })),
      };
    if (
      !Number.isInteger(value.rows) ||
      !Number.isInteger(value.columns) ||
      value.rows < 1 ||
      value.columns < 1 ||
      value.rows * value.columns > STUDIO_SHEET_LIMITS.clipboardCells ||
      parsedRows.length !== value.rows ||
      parsedRows.some((row) => row.length !== value.columns) ||
      !Array.isArray(value.cells) ||
      value.cells.length !== value.rows * value.columns ||
      !Array.isArray(value.values) ||
      value.values.length !== value.cells.length ||
      !Array.isArray(value.columnWidths) ||
      value.columnWidths.length !== value.columns ||
      value.columnWidths.some(
        (widthValue: unknown) =>
          typeof widthValue !== 'number' ||
          !Number.isFinite(widthValue) ||
          widthValue < 12 ||
          widthValue > 1790
      ) ||
      !Array.isArray(value.merges) ||
      value.merges.length > STUDIO_SHEET_LIMITS.clipboardCells
    )
      return undefined;
    const cells = value.cells.map(clipboardCell);
    const values = value.values.map(clipboardValue);
    const merges = value.merges.map((entry: unknown) =>
      clipboardRange(entry, value.rows, value.columns)
    );
    if (
      cells.some((cell: StudioCell | undefined) => !cell) ||
      values.some((entry: StudioSheetClipboardValue | undefined) => !entry)
    )
      return undefined;
    if (
      cells.some(
        (cell: StudioCell | undefined, index: number) =>
          cell!.input !== parsedRows[Math.floor(index / value.columns)][index % value.columns]
      )
    )
      return undefined;
    if (merges.some((range: StudioRange | undefined) => !range)) return undefined;
    for (let index = 0; index < merges.length; index++)
      for (let other = index + 1; other < merges.length; other++)
        if (intersects(merges[index]!, merges[other]!)) return undefined;
    for (const range of merges as StudioRange[])
      for (let row = range.firstRow; row <= range.lastRow; row++)
        for (let col = range.firstCol; col <= range.lastCol; col++)
          if (
            (row !== range.firstRow || col !== range.firstCol) &&
            cells[row * value.columns + col]!.input !== ''
          )
            return undefined;
    return {
      ...position,
      rows: value.rows,
      columns: value.columns,
      cells: cells as StudioCell[],
      values: values as StudioSheetClipboardValue[],
      columnWidths: [...value.columnWidths],
      merges: merges as StudioRange[],
      hyperlinks: (value.hyperlinks as StudioSheetHyperlink[]).map((link) => ({ ...link })),
    };
  } catch {
    return undefined;
  }
}

export interface SheetSelection {
  anchor: SheetPosition;
  focus: SheetPosition;
}

export type SheetValue = string | number | boolean;

export interface SheetCalculation extends StudioSheetRuleCalculation {
  values: Map<string, SheetValue>;
  errors: Map<string, string>;
  /** Native links remain on the sheet; only reliable root HYPERLINK calls live here. */
  hyperlinks: Map<string, StudioSheetHyperlink>;
}

const numericInput = /^[+-]?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const errorPattern = /#(?:CYCLE!|LIMIT!|REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|ERROR!)/;

export function studioColumnLabel(column: number): string {
  if (!Number.isInteger(column) || column < 1 || column > 16384) return '';
  let remaining = column;
  let label = '';
  while (remaining > 0) {
    remaining--;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }
  return label;
}

export function studioCellAddress(row: number, col: number): string {
  return `${studioColumnLabel(col)}${row}`;
}

export function studioParseAddress(address: string): SheetPosition | undefined {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(address.trim());
  if (!match) return undefined;
  const col = [...match[1].toUpperCase()].reduce(
    (total, char) => total * 26 + char.charCodeAt(0) - 64,
    0
  );
  const row = Number(match[2]);
  if (row > 1048576 || col > 16384) return undefined;
  return { row, col };
}

export function studioSelectionBounds(selection: SheetSelection) {
  return {
    firstRow: Math.min(selection.anchor.row, selection.focus.row),
    lastRow: Math.max(selection.anchor.row, selection.focus.row),
    firstCol: Math.min(selection.anchor.col, selection.focus.col),
    lastCol: Math.max(selection.anchor.col, selection.focus.col),
  };
}

export function studioSelectionAddresses(selection: SheetSelection): string[] {
  const { firstRow, lastRow, firstCol, lastCol } = studioSelectionBounds(selection);
  const count = (lastRow - firstRow + 1) * (lastCol - firstCol + 1);
  if (count > STUDIO_SHEET_LIMITS.clipboardCells)
    throw new Error('一次最多编辑或复制 10,000 个单元格，请缩小选区。');
  const addresses: string[] = [];
  for (let row = firstRow; row <= lastRow; row++)
    for (let col = firstCol; col <= lastCol; col++) addresses.push(studioCellAddress(row, col));
  return addresses;
}

/** Blank values stay explicit so exporting against the source can clear a cell. */
export function studioPatchCells(
  document: StudioExcelDocument,
  sheetId: string,
  updates: Record<string, Partial<StudioCell>>,
  options: {
    replace?: boolean;
    /** Workbook-wide edits must validate every changed cell against the final document. */
    deferValidation?: boolean;
    /** Formatting-only commands can keep the target's exact stored input. */
    preserveInput?: boolean;
    hyperlinks?: Record<string, StudioSheetHyperlink | StudioSheetHyperlink[] | null>;
  } = {}
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (Object.keys(updates).length > STUDIO_SHEET_LIMITS.clipboardCells)
    throw new Error('一次最多编辑 10,000 个单元格，请缩小选区。');
  const cells = { ...sheet.cells };
  const valueUpdates = new Set<string>();
  let changed = false;
  let rows = sheet.rowCount;
  let columns = sheet.columnCount;
  const hyperlinkUpdates: NonNullable<typeof options.hyperlinks> = {};
  const clearLinkRefs: string[] = [];
  for (const [address, links] of Object.entries(options.hyperlinks ?? {})) {
    const position = studioParseAddress(address);
    if (!position || !validSheetPosition(position))
      throw new Error('超链接位置超出 10,000 行、256 列范围。');
    hyperlinkUpdates[studioCellAddress(position.row, position.col)] = links;
    if (links && (!Array.isArray(links) || links.length)) {
      rows = Math.max(rows, position.row);
      columns = Math.max(columns, position.col);
    }
  }
  if (Object.keys(hyperlinkUpdates).length > STUDIO_SHEET_LIMITS.clipboardCells)
    throw new Error('一次最多编辑 10,000 个单元格，请缩小选区。');
  for (const [address, update] of Object.entries(updates)) {
    const position = studioParseAddress(address);
    if (
      !position ||
      position.row > STUDIO_SHEET_LIMITS.rows ||
      position.col > STUDIO_SHEET_LIMITS.columns
    )
      throw new Error('首版支持每张工作表最多 10,000 行、256 列。');
    const key = studioCellAddress(position.row, position.col);
    if ((update.input === '' || options.replace) && !(key in hyperlinkUpdates))
      hyperlinkUpdates[key] = null;
    const merge = studioMergedRange(sheet, position);
    if (
      update.input !== undefined &&
      merge &&
      (position.row !== merge.firstRow || position.col !== merge.firstCol)
    )
      throw new Error('合并单元格只能修改左上角的内容，请先拆分该区域。');
    if (merge && (update.input === '' || key in hyperlinkUpdates))
      clearLinkRefs.push(studioRangeAddress(merge));
    const previous = cells[key];
    let next: StudioCell =
      !options.replace && previous ? { ...previous, ...update } : { input: '', ...update };
    for (const key of Object.keys(next) as (keyof StudioCell)[])
      if (next[key] === undefined) delete next[key];
    const fontIssue = studioCellFontIssue(next);
    if (fontIssue) throw new Error(fontIssue);
    const styleIssue = studioCellStyleIssue(next);
    if (styleIssue) throw new Error(styleIssue);
    if (typeof next.input !== 'string' || next.input.length > 32767)
      throw new Error('单元格内容最多支持 32,767 个字符，请缩短内容。');
    if (update.input !== undefined || options.replace || 'numberFormat' in update) {
      if (!options.preserveInput) next = studioNormalizeValidationInput(sheet, key, next);
      valueUpdates.add(key);
    }
    if (
      [...new Set([...Object.keys(next), ...Object.keys(previous ?? {})])].every(
        (key) => previous?.[key as keyof StudioCell] === next[key as keyof StudioCell]
      )
    )
      continue;
    cells[key] = next;
    changed = true;
    rows = Math.max(rows, position.row);
    columns = Math.max(columns, position.col);
  }
  const metadata = studioPatchSheetHyperlinks(sheet, hyperlinkUpdates, clearLinkRefs);
  changed ||= metadata !== sheet;
  if (!changed && !(sheet.dataValidations?.length && valueUpdates.size)) return document;
  const stored = document.sheets.reduce((total, item) => total + Object.keys(item.cells).length, 0);
  if (
    stored - Object.keys(sheet.cells).length + Object.keys(cells).length >
    STUDIO_SHEET_LIMITS.storedCells
  )
    throw new Error('首版支持一个工作簿最多 100,000 个已使用单元格。');
  if (
    document.sheets.reduce(
      (total, item) =>
        total +
        (item.id === sheetId ? (metadata.hyperlinks?.length ?? 0) : (item.hyperlinks?.length ?? 0)),
      0
    ) > STUDIO_SHEET_LIMITS.storedCells
  )
    throw new Error('每个工作簿最多支持 100,000 条超链接记录。');
  const next: StudioExcelDocument = changed
    ? {
        ...document,
        activeSheetId: sheetId,
        sheets: document.sheets.map((item) =>
          item.id === sheetId ? { ...metadata, cells, rowCount: rows, columnCount: columns } : item
        ),
      }
    : document;
  if (!options.deferValidation && sheet.dataValidations?.length && valueUpdates.size) {
    const calculation = studioCalculate(next);
    const updatedSheet = next.sheets.find((item) => item.id === sheetId)!;
    for (const address of valueUpdates) {
      const validation = studioCellValidation(updatedSheet, address, calculation);
      if (validation?.blocking) throw new Error(`${address}：${validation.message}`);
    }
  }
  return next;
}

/** TSV quoting follows Excel's clipboard rules, including embedded newlines. */
export function studioParseTsv(text: string): string[][] {
  if (text.length > 5000000) throw new Error('粘贴内容过大，请分批粘贴。');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let atStart = true;
  let cells = 0;
  const pushCell = () => {
    if (++cells > STUDIO_SHEET_LIMITS.clipboardCells)
      throw new Error('一次最多粘贴 10,000 个单元格，请分批粘贴。');
    row.push(value);
    value = '';
    atStart = true;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && (atStart || quoted)) {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
      atStart = false;
    } else if (!quoted && char === '\t') pushCell();
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      pushCell();
      rows.push(row);
      row = [];
    } else {
      value += char;
      atStart = false;
    }
  }
  if (quoted) throw new Error('粘贴内容中的引号未闭合。');
  if (value !== '' || row.length || rows.length === 0) {
    pushCell();
    rows.push(row);
  }
  return rows;
}

function clipboardCellFormat(cell: StudioCell): Omit<StudioCell, 'input'> {
  const { input: _input, ...format } = cloneClipboardCell(cell);
  return {
    ...clipboardFormatDefaults,
    ...format,
    borders: format.borders ?? {},
  };
}

function clipboardValueInput(value: StudioSheetClipboardValue): string {
  if (value.type === 'blank') return '';
  if (value.type === 'number') return Object.is(value.value, -0) ? '0' : String(value.value);
  if (value.type === 'boolean') return value.value ? 'TRUE' : 'FALSE';
  if (value.type === 'error') return `=${value.value}`;
  const prefix =
    value.value === '' ||
    value.value.startsWith('=') ||
    value.value.startsWith("'") ||
    /^(?:true|false)$/i.test(value.value) ||
    numericInput.test(value.value);
  if (prefix && value.value.length >= 32767)
    throw new Error('值粘贴后的文本超过 32,767 个字符，已取消操作。');
  return prefix ? `'${value.value}` : value.value;
}

function rangeContains(container: StudioRange, candidate: StudioRange): boolean {
  return (
    candidate.firstRow >= container.firstRow &&
    candidate.lastRow <= container.lastRow &&
    candidate.firstCol >= container.firstCol &&
    candidate.lastCol <= container.lastCol
  );
}

function clearPasteMerges(
  document: StudioExcelDocument,
  sheetId: string,
  target: StudioRange
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const retained: string[] = [];
  let changed = false;
  for (const entry of sheet.merges ?? []) {
    const range = studioParseRange(entry)!;
    if (!intersects(range, target)) retained.push(entry);
    else if (rangeContains(target, range)) changed = true;
    else throw new Error('粘贴区域与目标合并单元格部分重叠，请先拆分该区域。');
  }
  if (!changed) return document;
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId ? { ...item, merges: retained } : item
    ),
  };
}

function pastedMerge(merge: StudioRange, start: SheetPosition, transpose: boolean): StudioRange {
  return transpose
    ? {
        firstRow: start.row + merge.firstCol,
        lastRow: start.row + merge.lastCol,
        firstCol: start.col + merge.firstRow,
        lastCol: start.col + merge.lastRow,
      }
    : {
        firstRow: start.row + merge.firstRow,
        lastRow: start.row + merge.lastRow,
        firstCol: start.col + merge.firstCol,
        lastCol: start.col + merge.lastCol,
      };
}

function pasteColumnWidths(
  document: StudioExcelDocument,
  sheetId: string,
  start: SheetPosition,
  widths: number[]
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const updates = Object.fromEntries(
    widths.map((width, index) => [studioColumnLabel(start.col + index), width])
  );
  if (Object.entries(updates).every(([label, width]) => sheet.columnWidths?.[label] === width))
    return document;
  return {
    ...document,
    activeSheetId: sheetId,
    sheets: document.sheets.map((item) =>
      item.id === sheetId
        ? {
            ...item,
            columnCount: Math.max(item.columnCount, start.col + widths.length - 1),
            columnWidths: { ...item.columnWidths, ...updates },
          }
        : item
    ),
  };
}

export function studioPasteCells(
  document: StudioExcelDocument,
  sheetId: string,
  start: SheetPosition,
  text: string,
  source?: StudioSheetClipboardOrigin,
  mode: StudioSheetPasteMode = 'all'
): { document: StudioExcelDocument; selection: SheetSelection; addresses: string[] } {
  const parsedRows = studioParseTsv(text);
  const parsedWidth = Math.max(...parsedRows.map((row) => row.length));
  const rich = !!(
    source?.cells &&
    source.values &&
    source.rows &&
    source.columns &&
    source.columnWidths &&
    source.merges
  );
  if (mode !== 'all' && !rich)
    throw new Error('选择性粘贴需要先在 OfficeStudio 中复制单元格区域。');
  const sourceRows = rich ? source!.rows! : parsedRows.length;
  const sourceColumns = rich ? source!.columns! : parsedWidth;
  const transpose = mode === 'transpose';
  const targetRows = transpose ? sourceColumns : sourceRows;
  const targetColumns = transpose ? sourceRows : sourceColumns;
  const last = { row: start.row + targetRows - 1, col: start.col + targetColumns - 1 };
  if (!validSheetPosition(start) || !validSheetPosition(last))
    throw new Error('粘贴区域超出 10,000 行、256 列的支持范围。');
  if (
    source &&
    (!validSheetPosition(source) ||
      !validSheetPosition({
        row: source.row + sourceRows - 1,
        col: source.col + sourceColumns - 1,
      }))
  )
    throw new Error('复制来源区域无效，请重新复制单元格。');
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (mode === 'column-widths') {
    return {
      document: pasteColumnWidths(document, sheetId, start, source!.columnWidths!),
      selection: { anchor: start, focus: last },
      addresses: [],
    };
  }
  const copiesMergeState =
    rich && ['all', 'source-formatting', 'without-borders', 'transpose'].includes(mode);
  const targetRange = {
    firstRow: start.row,
    lastRow: last.row,
    firstCol: start.col,
    lastCol: last.col,
  };
  let next = copiesMergeState ? clearPasteMerges(document, sheetId, targetRange) : document;
  const updates: Record<string, Partial<StudioCell>> = {};
  const addresses: string[] = [];
  const hyperlinks: Record<string, StudioSheetHyperlink[] | null> = {};
  const clipboardSheet = source?.hyperlinks
    ? { ...sheet, hyperlinks: source.hyperlinks }
    : undefined;
  const copiesHyperlinks = ['all', 'source-formatting', 'without-borders', 'transpose'].includes(
    mode
  );
  let hyperlinkCoverage = 0;
  for (let row = 0; row < sourceRows; row++) {
    const columns = rich ? sourceColumns : parsedRows[row].length;
    for (let col = 0; col < columns; col++) {
      const destination = transpose
        ? { row: start.row + col, col: start.col + row }
        : { row: start.row + row, col: start.col + col };
      const address = studioCellAddress(destination.row, destination.col);
      addresses.push(address);
      const sourcePosition = source ? { row: source.row + row, col: source.col + col } : undefined;
      const index = row * sourceColumns + col;
      const sourceCell = rich
        ? source!.cells![index]
        : ({ input: parsedRows[row][col] } satisfies StudioCell);
      const translated = sourcePosition
        ? studioTranslateFormula(
            sourceCell.input,
            destination.row - sourcePosition.row,
            destination.col - sourcePosition.col
          )
        : sourceCell.input;
      const targetCell = sheet.cells[address];
      if (mode === 'values' || mode === 'values-number-format') {
        updates[address] = {
          input: clipboardValueInput(source!.values![index]),
          ...(mode === 'values-number-format'
            ? { numberFormat: sourceCell.numberFormat ?? 'General' }
            : {}),
        };
      } else if (mode === 'formats') updates[address] = clipboardCellFormat(sourceCell);
      else if (mode === 'formulas' || mode === 'formulas-number-format') {
        updates[address] = {
          input: translated,
          ...(mode === 'formulas-number-format'
            ? { numberFormat: sourceCell.numberFormat ?? 'General' }
            : {}),
        };
      } else if (mode === 'without-borders') {
        updates[address] = {
          ...cloneClipboardCell(sourceCell),
          input: translated,
          borders: targetCell?.borders
            ? cloneClipboardCell({ input: '', borders: targetCell.borders }).borders
            : undefined,
        };
      } else updates[address] = { ...cloneClipboardCell(sourceCell), input: translated };
      if (copiesHyperlinks) {
        hyperlinks[address] =
          clipboardSheet && sourcePosition
            ? studioSheetHyperlinksAt(
                clipboardSheet,
                studioCellAddress(sourcePosition.row, sourcePosition.col)
              )
            : null;
        hyperlinkCoverage += hyperlinks[address]?.length ?? 0;
        if (hyperlinkCoverage > 500000) throw new Error('粘贴的超链接范围组合过多，请缩小选区。');
      }
    }
  }
  const replace = ['all', 'source-formatting', 'without-borders', 'transpose'].includes(mode);
  next = studioPatchCells(next, sheetId, updates, {
    replace,
    preserveInput: mode === 'formats',
    ...(copiesHyperlinks ? { hyperlinks } : {}),
  });
  if (copiesMergeState)
    for (const merge of source!.merges!) {
      const range = pastedMerge(merge, start, transpose);
      next = studioMergeCells(next, sheetId, {
        anchor: { row: range.firstRow, col: range.firstCol },
        focus: { row: range.lastRow, col: range.lastCol },
      });
    }
  return { document: next, selection: { anchor: start, focus: last }, addresses };
}

export function studioCopyTsv(sheet: StudioSheet, selection: SheetSelection): string {
  studioSelectionAddresses(selection);
  const { firstRow, lastRow, firstCol, lastCol } = studioSelectionBounds(selection);
  const rows: string[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const values: string[] = [];
    for (let col = firstCol; col <= lastCol; col++) {
      const input = sheet.cells[studioCellAddress(row, col)]?.input ?? '';
      values.push(/[\t\r\n"]/.test(input) ? `"${input.replace(/"/g, '""')}"` : input);
    }
    rows.push(values.join('\t'));
  }
  const text = rows.join('\n');
  if (text.length > 5000000) throw new Error('复制内容过大，请缩小选区。');
  return text;
}

export function studioCopySheetClipboard(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection
): string {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const text = studioCopyTsv(sheet, selection);
  const bounds = studioSelectionBounds(selection);
  const rows = bounds.lastRow - bounds.firstRow + 1;
  const columns = bounds.lastCol - bounds.firstCol + 1;
  const calculation = studioCalculate(document);
  const cells: StudioCell[] = [];
  const values: StudioSheetClipboardValue[] = [];
  for (let row = bounds.firstRow; row <= bounds.lastRow; row++) {
    for (let col = bounds.firstCol; col <= bounds.lastCol; col++) {
      const address = studioCellAddress(row, col);
      const cell = sheet.cells[address] ?? { input: '' };
      cells.push(cloneClipboardCell(cell));
      if (!cell.input) values.push({ type: 'blank' });
      else if (cell.input.startsWith('=')) {
        const error = calculation.errors.get(`${sheet.id}:${address}`);
        if (error) values.push({ type: 'error', value: error });
        else {
          const value = calculation.values.get(`${sheet.id}:${address}`) ?? '';
          values.push({ type: typeof value, value } as StudioSheetClipboardValue);
        }
      } else {
        const value = studioInputValue(cell.input, cell.numberFormat);
        values.push({ type: typeof value, value } as StudioSheetClipboardValue);
      }
    }
  }
  const hyperlinks = studioCopySheetHyperlinks(sheet, studioRangeAddress(bounds));
  if (hyperlinks.length > STUDIO_SHEET_LIMITS.clipboardCells)
    throw new Error('复制的超链接记录过多，请缩小选区。');
  const merges = (sheet.merges ?? [])
    .map(studioParseRange)
    .filter((range): range is StudioRange => !!range && rangeContains(bounds, range))
    .map((range) => ({
      firstRow: range.firstRow - bounds.firstRow,
      lastRow: range.lastRow - bounds.firstRow,
      firstCol: range.firstCol - bounds.firstCol,
      lastCol: range.lastCol - bounds.firstCol,
    }));
  const payload = JSON.stringify({
    version: 3,
    row: bounds.firstRow,
    col: bounds.firstCol,
    rows,
    columns,
    text,
    cells,
    values,
    columnWidths: Array.from(
      { length: columns },
      (_, index) => sheet.columnWidths?.[studioColumnLabel(bounds.firstCol + index)] ?? 112
    ),
    merges,
    hyperlinks,
  });
  if (payload.length > 10000200) throw new Error('复制内容、格式和超链接元数据过大，请缩小选区。');
  return payload;
}

export function studioInputValue(input: string, numberFormat?: string): SheetValue {
  if (input.startsWith("'")) return input.slice(1);
  if (numberFormat === '@') return input;
  if (/^(true|false)$/i.test(input)) return input.toLowerCase() === 'true';
  if (numericInput.test(input) && Number.isFinite(Number(input))) return Number(input);
  return input;
}

function formulaErrorLabel(error: unknown): string {
  // The parser wraps callback errors. Inspect details before the generic #ERROR!.
  if (error && typeof error === 'object') {
    const record = error as { details?: unknown; message?: string };
    if (record.details && record.details !== error) {
      const nested = formulaErrorLabel(record.details);
      if (nested !== '#ERROR!') return nested;
    }
    const message = errorPattern.exec(record.message ?? '');
    if (message) return message[0];
  }
  return errorPattern.exec(String(error))?.[0] ?? '#ERROR!';
}

function checkFormulaSize(input: string): void {
  if (input.length > 4096) throw new Error('#LIMIT!');
  let depth = 0;
  let inString = false;
  for (const char of input) {
    if (char === '"') inString = !inString;
    if (!inString && char === '(' && ++depth > 80) throw new Error('#LIMIT!');
    if (!inString && char === ')') depth--;
  }
}

function rootHyperlink(input: string): boolean {
  const formula = input.slice(1).trim();
  const head = /^(?:_xlfn\.)?HYPERLINK\s*\(/i.exec(formula);
  if (!head) return false;
  let depth = 1;
  let quote = '';
  for (let index = head[0].length; index < formula.length; index++) {
    const character = formula[index];
    if (quote) {
      if (character === quote) {
        if (formula[index + 1] === quote) index++;
        else quote = '';
      }
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '(') depth++;
    else if (character === ')' && --depth === 0) return index === formula.length - 1;
  }
  return false;
}

const formulaCalendar = FormulaParser as typeof FormulaParser & {
  FormulaError: { NUM: Error };
  FormulaHelpers: { accept(argument: unknown, type: number | null): unknown };
  Types: { NUMBER: number; STRING: number; BOOLEAN: number };
  SSF: {
    parse_date_code(serial: number): { y: number; m: number; d: number } | null;
  };
};
const CALENDAR_DAY = 86400000;
const CALENDAR_START = Date.UTC(1900, 0, 1);
const CALENDAR_MARCH = Date.UTC(1900, 2, 1);

function calendarSerial(timestamp: number) {
  return (
    Math.floor((timestamp - CALENDAR_START) / CALENDAR_DAY) + (timestamp >= CALENDAR_MARCH ? 2 : 1)
  );
}

export function studioCalculate(document: StudioExcelDocument): SheetCalculation {
  const values = new Map<string, SheetValue>();
  const errors = new Map<string, string>();
  const hyperlinks = new Map<string, StudioSheetHyperlink>();
  const hyperlinkFrames: ({ target?: string } | undefined)[] = [];
  const rangeOrigins = new WeakMap<object, { from: SheetPosition; to: SheetPosition }>();
  const visiting = new Set<string>();
  const sheets = new Map(document.sheets.map((sheet) => [sheet.name.toLocaleLowerCase(), sheet]));
  const parserPool: FormulaParser[] = [];
  let dateTextParser: FormulaParser | undefined;
  let dateText = '';
  const dateValue = (argument: unknown): number => {
    const text = String(
      formulaCalendar.FormulaHelpers.accept(argument, formulaCalendar.Types.STRING)
    );
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
    if (iso) {
      const [year, month, day] = iso.slice(1).map(Number);
      if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31)
        throw FormulaParser.FormulaError.VALUE;
      if (year === 1900 && month === 2 && day === 29) return 60;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      )
        throw FormulaParser.FormulaError.VALUE;
      return calendarSerial(date.getTime());
    }
    // Keep the library's existing text-date formats on an isolated parser. The
    // constant expression reads a scalar and never interprets the supplied text.
    dateText = text;
    dateTextParser ??= new FormulaParser({ onCell: () => dateText, onRange: () => [[dateText]] });
    const result = dateTextParser.parse('DATEVALUE(A1)', { sheet: 'Date', row: 1, col: 1 });
    if (typeof result !== 'number' || !Number.isFinite(result) || result < 0 || result > 2958465)
      throw FormulaParser.FormulaError.VALUE;
    return result === 60 && Date.parse(`${text} UTC`) === CALENDAR_MARCH && !/\b29\b/.test(text)
      ? 61
      : result;
  };
  const datePart = (argumentsList: unknown[], part: 'y' | 'm' | 'd') => {
    if (argumentsList.length !== 1) throw FormulaParser.FormulaError.VALUE;
    let serial: number;
    try {
      serial = Number(
        formulaCalendar.FormulaHelpers.accept(argumentsList[0], formulaCalendar.Types.NUMBER)
      );
    } catch (error) {
      if (formulaErrorLabel(error) !== '#VALUE!') throw error;
      serial = dateValue(argumentsList[0]);
    }
    const parsed = formulaCalendar.SSF.parse_date_code(serial);
    if (!parsed) throw formulaCalendar.FormulaError.NUM;
    return parsed[part];
  };
  let reads = 0;
  const read = (sheetName: string, row: number, col: number): SheetValue => {
    const sheet = sheets.get(sheetName.toLocaleLowerCase());
    if (!sheet || row < 1 || col < 1 || row > 1048576 || col > 16384)
      throw FormulaParser.FormulaError.REF;
    const address = studioCellAddress(row, col);
    const key = `${sheet.id}:${address}`;
    if (values.has(key)) return values.get(key)!;
    if (errors.has(key)) throw new Error(errors.get(key));
    if (visiting.has(key)) throw new Error('#CYCLE!');
    if (visiting.size >= 80 || ++reads > 200000) throw new Error('#LIMIT!');
    const input = sheet.cells[address]?.input ?? '';
    if (!input.startsWith('=')) {
      if (errorPattern.test(input) && input.startsWith('#')) throw new Error(input);
      const value = studioInputValue(input, sheet.cells[address]?.numberFormat);
      values.set(key, value);
      return value;
    }
    visiting.add(key);
    const poolIndex = visiting.size - 1;
    let hyperlinkFrame: { target?: string } | undefined;
    try {
      checkFormulaSize(input);
      hyperlinkFrame = rootHyperlink(input) ? {} : undefined;
      hyperlinkFrames[poolIndex] = hyperlinkFrame;
      // A parser has mutable grammar state; each dependency depth needs its own
      // instance so nested formula references cannot overwrite the caller.
      const result = parserAt(poolIndex).parse(input.slice(1), { sheet: sheet.name, row, col });
      if (result instanceof Error || (typeof result === 'object' && result !== null)) throw result;
      if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('#NUM!');
      if (typeof result === 'string' && result.length > 100000) throw new Error('#LIMIT!');
      const value =
        result === null
          ? 0
          : typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean'
            ? result
            : '';
      values.set(key, value);
      if (hyperlinkFrame?.target !== undefined)
        hyperlinks.set(key, {
          id: `formula:${sheet.id}:${address}`.slice(0, 128),
          ref: address,
          target: hyperlinkFrame.target,
        });
      return value;
    } catch (error) {
      const label = formulaErrorLabel(error);
      errors.set(key, label);
      throw new Error(label);
    } finally {
      hyperlinkFrames[poolIndex] = undefined;
      visiting.delete(key);
    }
  };
  // Empty cells differ from empty text: arithmetic treats a blank as zero while
  // AVERAGE/COUNT ignore it. The formula parser represents a blank as null.
  const referenceValue = (
    sheetName: string,
    row: number,
    col: number
  ): SheetValue | null | Error => {
    try {
      const value = read(sheetName, row, col);
      const target = sheets.get(sheetName.toLocaleLowerCase());
      return (target?.cells[studioCellAddress(row, col)]?.input ?? '') === '' ? null : value;
    } catch (error) {
      const label = formulaErrorLabel(error);
      const names: Record<string, string> = {
        '#REF!': 'REF',
        '#DIV/0!': 'DIV0',
        '#VALUE!': 'VALUE',
        '#NAME?': 'NAME',
        '#N/A': 'NA',
        '#NUM!': 'NUM',
        '#NULL!': 'NULL',
      };
      const parserErrors = FormulaParser.FormulaError as unknown as Record<string, Error>;
      if (names[label] && parserErrors[names[label]]) return parserErrors[names[label]];
      throw error;
    }
  };
  const parserAt = (poolIndex: number): FormulaParser => {
    parserPool[poolIndex] ??= new FormulaParser({
      functions: {
        IF: (context, ...argumentsList) => {
          if (argumentsList.length < 1 || argumentsList.length > 3)
            throw FormulaParser.FormulaError.VALUE;
          // IF keeps raw references to avoid reading its unused branch. The
          // library's built-in implementation also leaves the test as {ref},
          // which is truthy even when that cell contains FALSE or zero.
          const parser = context as unknown as { retrieveRef(value: unknown): unknown };
          const argument = argumentsList[0];
          let test =
            argument == null ||
            (typeof argument === 'object' && 'omitted' in argument && argument.omitted)
              ? 0
              : parser.retrieveRef(argument);
          if (Array.isArray(test)) test = test[0]?.[0];
          if (typeof test === 'string' && /^(true|false)$/i.test(test.trim()))
            test = test.trim().toLowerCase() === 'true';
          const logical = formulaCalendar.FormulaHelpers.accept(
            { value: test ?? 0 },
            formulaCalendar.Types.BOOLEAN
          );
          const selected = argumentsList[logical ? 1 : 2];
          if (selected === undefined) return Boolean(logical);
          if (
            selected === null ||
            (selected && typeof selected === 'object' && 'omitted' in selected && selected.omitted)
          )
            return 0;
          return formulaCalendar.FormulaHelpers.accept(selected, null);
        },
        HYPERLINK: (...argumentsList) => {
          if (argumentsList.length < 1 || argumentsList.length > 2)
            throw FormulaParser.FormulaError.VALUE;
          const scalar = (argument: unknown, blank: SheetValue = 0): SheetValue => {
            let value = formulaCalendar.FormulaHelpers.accept(argument, null);
            if (
              argument &&
              typeof argument === 'object' &&
              'omitted' in argument &&
              argument.omitted
            )
              return blank;
            if (value && typeof value === 'object' && 'value' in value) value = value.value;
            if (Array.isArray(value)) {
              const origin = rangeOrigins.get(value);
              if (
                origin &&
                argument &&
                typeof argument === 'object' &&
                'isRangeRef' in argument &&
                argument.isRangeRef
              ) {
                const position = (parserPool[poolIndex] as unknown as { position: SheetPosition })
                  .position;
                if (
                  origin.from.col === origin.to.col &&
                  position.row >= origin.from.row &&
                  position.row <= origin.to.row
                )
                  value = value[position.row - origin.from.row]?.[0];
                else if (
                  origin.from.row === origin.to.row &&
                  position.col >= origin.from.col &&
                  position.col <= origin.to.col
                )
                  value = value[0]?.[position.col - origin.from.col];
                else throw FormulaParser.FormulaError.VALUE;
              } else value = value[0]?.[0];
            }
            if (
              value instanceof Error ||
              (value &&
                typeof value === 'object' &&
                'error' in value &&
                typeof value.error === 'string' &&
                errorPattern.test(value.error)) ||
              (value &&
                typeof value === 'object' &&
                'message' in value &&
                typeof value.message === 'string' &&
                errorPattern.test(value.message))
            )
              throw value;
            if (value === null || value === undefined) return blank;
            if (
              typeof value !== 'string' &&
              typeof value !== 'number' &&
              typeof value !== 'boolean'
            )
              throw FormulaParser.FormulaError.VALUE;
            return value;
          };
          const location = scalar(argumentsList[0], '');
          const target =
            typeof location === 'boolean' ? (location ? 'TRUE' : 'FALSE') : String(location);
          const friendly = argumentsList.length === 1 ? target : scalar(argumentsList[1]);
          const frame = hyperlinkFrames[poolIndex];
          if (frame && target.length <= 32767) frame.target = target;
          return friendly;
        },
        DATE: (...argumentsList) => {
          if (argumentsList.length !== 3) throw FormulaParser.FormulaError.VALUE;
          const [rawYear, rawMonth, rawDay] = argumentsList.map((argument) =>
            Number(formulaCalendar.FormulaHelpers.accept(argument, formulaCalendar.Types.NUMBER))
          );
          if (
            ![rawYear, rawMonth, rawDay].every(Number.isFinite) ||
            rawYear < 0 ||
            rawYear >= 10000
          )
            throw formulaCalendar.FormulaError.NUM;
          const year =
            Math.trunc(rawYear) < 1900 ? Math.trunc(rawYear) + 1900 : Math.trunc(rawYear);
          // Add days to the month's first serial so overflows include Excel's
          // virtual 1900-02-29, including DATE(1900,3,0) and DATE(1900,1,61).
          const result =
            calendarSerial(Date.UTC(year, Math.trunc(rawMonth) - 1, 1)) + Math.trunc(rawDay) - 1;
          if (!Number.isFinite(result) || result < 0 || result > 2958465)
            throw formulaCalendar.FormulaError.NUM;
          return result;
        },
        DATEVALUE: (...argumentsList) => {
          if (argumentsList.length !== 1) throw FormulaParser.FormulaError.VALUE;
          return dateValue(argumentsList[0]);
        },
        DAY: (...argumentsList) => datePart(argumentsList, 'd'),
        MONTH: (...argumentsList) => datePart(argumentsList, 'm'),
        YEAR: (...argumentsList) => datePart(argumentsList, 'y'),
        WEBSERVICE: () => {
          throw FormulaParser.FormulaError.NAME;
        },
        REPT: (textArgument, countArgument) => {
          const unwrap = (argument: unknown) =>
            argument && typeof argument === 'object' && 'value' in argument
              ? argument.value
              : argument;
          const text = String(unwrap(textArgument) ?? '');
          const repeat = Number(unwrap(countArgument));
          if (!Number.isFinite(repeat) || repeat < 0) throw FormulaParser.FormulaError.VALUE;
          if (repeat > 100000 || text.length * repeat > 100000) throw new Error('#LIMIT!');
          return text.repeat(Math.trunc(repeat));
        },
        COUNTBLANK: (...argumentsList) => {
          if (argumentsList.length !== 1) throw FormulaParser.FormulaError.VALUE;
          const argument = argumentsList[0];
          const value =
            argument && typeof argument === 'object' && 'value' in argument
              ? argument.value
              : argument;
          const cells = Array.isArray(value) ? value.flat() : [value];
          return cells.filter((cell) => cell === '' || cell === null || cell === undefined).length;
        },
      },
      onCell: ({ sheet, row, col }) => referenceValue(sheet, row, col),
      onRange: (range) => {
        const target = sheets.get(range.sheet.toLocaleLowerCase());
        if (!target) throw FormulaParser.FormulaError.REF;
        const lastRow = range.to.row;
        const lastCol = range.to.col;
        if (range.from.row < 1 || range.from.col < 1 || lastRow > 1048576 || lastCol > 16384)
          throw FormulaParser.FormulaError.REF;
        const count = (lastRow - range.from.row + 1) * (lastCol - range.from.col + 1);
        if (count > 100000) throw new Error('#LIMIT!');
        const result: (SheetValue | null | Error)[][] = [];
        for (let r = range.from.row; r <= lastRow; r++) {
          const cells: (SheetValue | null | Error)[] = [];
          for (let c = range.from.col; c <= lastCol; c++)
            cells.push(referenceValue(target.name, r, c));
          result.push(cells);
        }
        if (result.length) {
          rangeOrigins.set(result, { from: range.from, to: range.to });
          return result;
        }
        return [[null]];
      },
    });
    return parserPool[poolIndex];
  };

  const publicRead = (sheetId: string, address: string): StudioSheetRuleResult => {
    const sheet = document.sheets.find((item) => item.id === sheetId);
    const cell = studioParseAddress(address);
    if (!sheet || !cell) return { error: '#REF!' };
    try {
      return { value: read(sheet.name, cell.row, cell.col) };
    } catch (error) {
      return { error: formulaErrorLabel(error) };
    }
  };
  let evaluations = 0;
  const evaluate: StudioSheetRuleCalculation['evaluate'] = (
    sheetId,
    formula,
    position,
    origin,
    allowArray = false
  ) => {
    const sheet = document.sheets.find((item) => item.id === sheetId);
    if (
      !sheet ||
      !Number.isInteger(position.row) ||
      !Number.isInteger(position.col) ||
      position.row < 1 ||
      position.col < 1 ||
      position.row > 1048576 ||
      position.col > 16384
    )
      return { error: '#REF!' };
    const key = '#rule:' + ++evaluations;
    try {
      if (evaluations > 200000 || visiting.size >= 80) throw new Error('#LIMIT!');
      const source = formula.trim().startsWith('=') ? formula.trim() : '=' + formula.trim();
      const input = studioTranslateFormula(
        source,
        origin ? position.row - origin.row : 0,
        origin ? position.col - origin.col : 0
      );
      checkFormulaSize(input);
      // Rule evaluation also owns a parser depth while its cell dependencies run.
      visiting.add(key);
      hyperlinkFrames[visiting.size - 1] = undefined;
      const parser = parserAt(visiting.size - 1);
      const parse = parser.parse as (
        formula: string,
        position: { sheet: string; row: number; col: number },
        allowReturnArray?: boolean
      ) => unknown;
      const result = parse.call(
        parser,
        input.slice(1),
        { sheet: sheet.name, ...position },
        allowArray
      );
      const checkedScalar = (value: unknown): SheetValue | null => {
        if (value instanceof Error || (typeof value === 'object' && value !== null)) throw value;
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('#NUM!');
        if (typeof value === 'string' && value.length > 100000) throw new Error('#LIMIT!');
        return value === null
          ? null
          : typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
            ? value
            : '';
      };
      if (allowArray && Array.isArray(result)) {
        if (result.some((row) => !Array.isArray(row))) throw new Error('#VALUE!');
        return {
          value: (result as unknown[][]).map((row) => row.map(checkedScalar)),
        };
      }
      return { value: checkedScalar(result) ?? 0 };
    } catch (error) {
      return { error: formulaErrorLabel(error) };
    } finally {
      visiting.delete(key);
    }
  };
  for (const sheet of document.sheets) {
    for (const [address, cell] of Object.entries(sheet.cells)) {
      const position = studioParseAddress(address);
      if (!position || !cell.input.startsWith('=')) continue;
      try {
        read(sheet.name, position.row, position.col);
      } catch {
        /* Keep the formula and its displayed error. */
      }
    }
  }
  return { values, errors, hyperlinks, read: publicRead, evaluate };
}

export function studioDisplayCell(
  cell: StudioCell | undefined,
  value?: SheetValue,
  error?: string
): string {
  if (error) return error;
  if (!cell) return '';
  const result = value ?? studioInputValue(cell.input, cell.numberFormat);
  if (typeof result === 'boolean') return result ? 'TRUE' : 'FALSE';
  if (typeof result === 'number' && cell.numberFormat && cell.numberFormat !== 'General') {
    try {
      const formatter = FormulaParser as typeof FormulaParser & {
        SSF: { format(format: string, value: number): string };
      };
      return formatter.SSF.format(cell.numberFormat, result);
    } catch {
      /* Preserve the raw value if a custom format is unsupported. */
    }
  }
  return String(result);
}

export function studioSheetNameIssue(
  document: StudioExcelDocument,
  sheetId: string,
  name: string
): string {
  if (
    !name.trim() ||
    name.length > 31 ||
    /[\\/:*?[\]]/.test(name) ||
    name.startsWith("'") ||
    name.endsWith("'")
  )
    return '工作表名称需为 1–31 个字符，不能包含 \\ / : * ? [ ]，或以单引号开头、结尾。';
  if (
    document.sheets.some(
      (sheet) => sheet.id !== sheetId && sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
  )
    return '工作表名称已存在，请使用其他名称。';
  return '';
}

export function studioRenameSheet(
  document: StudioExcelDocument,
  sheetId: string,
  name: string
): StudioExcelDocument {
  const current = document.sheets.find((sheet) => sheet.id === sheetId);
  if (!current) throw new Error('工作表不存在。');
  const issue = studioSheetNameIssue(document, sheetId, name);
  if (issue) throw new Error(issue);
  if (name === current.name) return document;
  const referenceToken = /"(?:[^"]|"")*"|(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!/gu;
  const replacement = `'${name.replace(/'/g, "''")}'!`;
  const renameFormula = (input: string) =>
    input.replace(referenceToken, (token) => {
      if (token.startsWith('"')) return token;
      const raw = token.slice(0, -1);
      const referenced = raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
      return referenced.toLocaleLowerCase() === current.name.toLocaleLowerCase()
        ? replacement
        : token;
    });
  return {
    ...document,
    sheets: document.sheets.map((sheet) => {
      const cells = { ...sheet.cells };
      for (const [address, cell] of Object.entries(cells)) {
        if (!cell.input.startsWith('=')) continue;
        const input = renameFormula(cell.input);
        if (input !== cell.input) cells[address] = { ...cell, input };
      }
      return {
        ...studioRenameSheetHyperlinks(
          studioMapSheetRuleFormulae(sheet, renameFormula),
          current.name,
          name
        ),
        name: sheet.id === sheetId ? name : sheet.name,
        cells,
      };
    }),
  };
}

/** Deleting a sheet must not silently invalidate formulas on a retained sheet. */
export function studioDeleteSheet(
  document: StudioExcelDocument,
  sheetId: string
): StudioExcelDocument {
  const index = document.sheets.findIndex((sheet) => sheet.id === sheetId);
  if (index < 0) throw new Error('工作表不存在。');
  if (document.sheets.length <= 1) throw new Error('工作簿至少需要保留一张工作表。');
  const removed = document.sheets[index];
  const sheets = document.sheets.filter((sheet) => sheet.id !== sheetId);
  for (const sheet of sheets) {
    for (const formula of [
      ...Object.values(sheet.cells).map((cell) => cell.input),
      ...studioSheetRuleFormulae(sheet),
    ]) {
      if (!formula.startsWith('=')) continue;
      const structure = formula.replace(/"(?:[^"]|"")*"/g, '');
      if (/\bINDIRECT\s*\(/i.test(structure) || /\[[^\]]*\]/.test(structure))
        throw new Error('其他工作表包含动态或外部引用，不能安全删除工作表。');
      const qualifiers = structure.matchAll(/('(?:[^']|'')+'|[\p{L}\p{N}_][\p{L}\p{N}_.]*)!/gu);
      for (const match of qualifiers) {
        const raw = match[1];
        const name = raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
        if (name.includes(':') || /:\s*$/.test(structure.slice(0, match.index)))
          throw new Error('其他工作表包含跨工作表范围引用，不能安全删除工作表。');
        if (name.toLocaleLowerCase() === removed.name.toLocaleLowerCase())
          throw new Error(`其他工作表仍引用“${removed.name}”，请先调整公式后再删除。`);
      }
    }
  }
  const activeSheetId =
    document.activeSheetId === sheetId
      ? (sheets[index] ?? sheets[index - 1]).id
      : document.activeSheetId;
  return {
    ...document,
    sheets: sheets.map((sheet) => studioDeleteSheetHyperlinks(sheet, removed)),
    activeSheetId,
  };
}

export interface StudioRange {
  firstRow: number;
  lastRow: number;
  firstCol: number;
  lastCol: number;
}

/** A zero height hides the row while preserving its last visible height. */
export function studioSetRowHeight(
  document: StudioExcelDocument,
  sheetId: string,
  range: Pick<StudioRange, 'firstRow' | 'lastRow'>,
  height: number | undefined
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (
    !Number.isInteger(range.firstRow) ||
    !Number.isInteger(range.lastRow) ||
    range.firstRow < 1 ||
    range.lastRow < range.firstRow ||
    range.lastRow > sheet.rowCount
  )
    throw new Error('行高设置范围无效。');
  if (
    height !== undefined &&
    (!Number.isFinite(height) || height < 0 || height > STUDIO_SHEET_LIMITS.rowHeight)
  )
    throw new Error('行高需要在 0–409.5 磅之间，0 表示隐藏。');
  const rowHeights = { ...sheet.rowHeights };
  const hidden = new Set(sheet.hiddenRows ?? []);
  let changed = false;
  for (let row = range.firstRow; row <= range.lastRow; row++) {
    const key = String(row);
    if (height === 0) {
      if (!hidden.has(row)) {
        hidden.add(row);
        changed = true;
      }
    } else {
      if (hidden.delete(row)) changed = true;
      if (height === undefined) {
        if (key in rowHeights) {
          delete rowHeights[key];
          changed = true;
        }
      } else if (rowHeights[key] !== height) {
        rowHeights[key] = height;
        changed = true;
      }
    }
  }
  if (!changed) return document;
  const next = { ...sheet, rowHeights, hiddenRows: [...hidden].sort((a, b) => a - b) };
  return {
    ...document,
    activeSheetId: sheetId,
    sheets: document.sheets.map((item) => (item.id === sheetId ? next : item)),
  };
}

export function studioParseRange(input: string): StudioRange | undefined {
  const parts = input.trim().split(':');
  if (parts.length > 2) return;
  const first = studioParseAddress(parts[0]);
  const last = studioParseAddress(parts[1] ?? parts[0]);
  if (!first || !last) return;
  return studioSelectionBounds({ anchor: first, focus: last });
}

export function studioRangeAddress(range: StudioRange): string {
  return `${studioCellAddress(range.firstRow, range.firstCol)}:${studioCellAddress(range.lastRow, range.lastCol)}`;
}

function rangeWithin(sheet: StudioSheet, range: StudioRange | undefined): range is StudioRange {
  return !!range && range.lastRow <= sheet.rowCount && range.lastCol <= sheet.columnCount;
}

function intersects(first: StudioRange, second: StudioRange): boolean {
  return (
    first.firstRow <= second.lastRow &&
    first.lastRow >= second.firstRow &&
    first.firstCol <= second.lastCol &&
    first.lastCol >= second.firstCol
  );
}

export function studioMergedRange(
  sheet: StudioSheet,
  position: SheetPosition
): StudioRange | undefined {
  return sheet.merges
    ?.map(studioParseRange)
    .find(
      (range) =>
        range &&
        position.row >= range.firstRow &&
        position.row <= range.lastRow &&
        position.col >= range.firstCol &&
        position.col <= range.lastCol
    );
}

export function studioMergeCells(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  split = false
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const range = studioSelectionBounds(selection);
  if (!rangeWithin(sheet, range)) throw new Error('合并区域超出工作表范围。');
  const overlap = (sheet.merges ?? []).filter((entry) =>
    intersects(studioParseRange(entry)!, range)
  );
  if (split) {
    if (!overlap.length) return document;
    return {
      ...document,
      sheets: document.sheets.map((item) =>
        item.id === sheetId
          ? { ...item, merges: (item.merges ?? []).filter((entry) => !overlap.includes(entry)) }
          : item
      ),
    };
  }
  if (range.firstRow === range.lastRow && range.firstCol === range.lastCol)
    throw new Error('请选择至少两个单元格进行合并。');
  const area = (range.lastRow - range.firstRow + 1) * (range.lastCol - range.firstCol + 1);
  const mergedCells = document.sheets.reduce(
    (total, item) =>
      total +
      (item.merges ?? []).reduce((count, entry) => {
        const merged = studioParseRange(entry)!;
        return (
          count + (merged.lastRow - merged.firstRow + 1) * (merged.lastCol - merged.firstCol + 1)
        );
      }, 0),
    0
  );
  if (
    area > STUDIO_SHEET_LIMITS.clipboardCells ||
    mergedCells + area > STUDIO_SHEET_LIMITS.storedCells
  )
    throw new Error('单个合并区域最多 10,000 个单元格，整个工作簿最多 100,000 个合并占位单元格。');
  if (overlap.length) throw new Error('选区与已有合并区域重叠，请先拆分。');
  if (
    sheet.freeze &&
    ((range.firstRow <= sheet.freeze.rows && range.lastRow > sheet.freeze.rows) ||
      (range.firstCol <= sheet.freeze.columns && range.lastCol > sheet.freeze.columns))
  )
    throw new Error('合并区域不能跨越冻结边界，请先取消冻结。');
  if (sheet.filter && intersects(range, studioParseRange(sheet.filter.range)!))
    throw new Error('筛选区域中不能合并单元格，请先清除筛选。');
  const anchorLink = studioSheetHyperlinkAt(
    sheet,
    studioCellAddress(range.firstRow, range.firstCol)
  );
  for (const link of sheet.hyperlinks ?? []) {
    const linked = studioParseRange(link.ref)!;
    if (!intersects(range, linked) || link.id === anchorLink?.id) continue;
    const firstRow = Math.max(range.firstRow, linked.firstRow);
    const lastRow = Math.min(range.lastRow, linked.lastRow);
    const firstCol = Math.max(range.firstCol, linked.firstCol);
    const lastCol = Math.min(range.lastCol, linked.lastCol);
    if (
      firstRow !== range.firstRow ||
      lastRow !== range.firstRow ||
      firstCol !== range.firstCol ||
      lastCol !== range.firstCol
    )
      throw new Error('合并会覆盖其他单元格的超链接，请先移除或移走非左上角的链接。');
  }
  for (const [address, cell] of Object.entries(sheet.cells)) {
    const position = studioParseAddress(address)!;
    if (
      cell.input !== '' &&
      position.row >= range.firstRow &&
      position.row <= range.lastRow &&
      position.col >= range.firstCol &&
      position.col <= range.lastCol &&
      (position.row !== range.firstRow || position.col !== range.firstCol)
    )
      throw new Error('合并会覆盖其他单元格的内容，请先移走非左上角的内容。');
  }
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId
        ? { ...item, merges: [...(item.merges ?? []), studioRangeAddress(range)] }
        : item
    ),
  };
}

export function studioSetFreeze(
  document: StudioExcelDocument,
  sheetId: string,
  rows: number,
  columns: number
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (
    !sheet ||
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 0 ||
    columns < 0 ||
    rows > Math.min(100, sheet.rowCount - 1) ||
    columns > Math.min(20, sheet.columnCount - 1)
  )
    throw new Error('冻结范围无效，最多冻结 100 行、20 列。');
  for (const entry of sheet.merges ?? []) {
    const range = studioParseRange(entry)!;
    if (
      (range.firstRow <= rows && range.lastRow > rows) ||
      (range.firstCol <= columns && range.lastCol > columns)
    )
      throw new Error('冻结边界不能穿过合并单元格。');
  }
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId ? { ...item, freeze: { rows, columns } } : item
    ),
  };
}

export function studioSetFilter(
  document: StudioExcelDocument,
  sheetId: string,
  filter?: StudioSheet['filter']
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (filter) {
    const range = studioParseRange(filter.range);
    if (!rangeWithin(sheet, range) || range.firstRow === range.lastRow)
      throw new Error('筛选区域需包含标题行及至少一行数据。');
    if (sheet.merges?.some((entry) => intersects(studioParseRange(entry)!, range)))
      throw new Error('筛选区域不能包含合并单元格，请先拆分。');
    for (const [label, condition] of Object.entries(filter.columns)) {
      const col = studioParseAddress(`${label}1`)?.col;
      if (
        !col ||
        col < range.firstCol ||
        col > range.lastCol ||
        !['contains', 'equals', 'greater', 'less'].includes(condition.operator) ||
        typeof condition.value !== 'string' ||
        condition.value.length > 1000 ||
        (['greater', 'less'].includes(condition.operator) && !numericInput.test(condition.value))
      )
        throw new Error('筛选条件无效，数值比较需填写有效数字。');
    }
  }
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId
        ? {
            ...item,
            filter: filter
              ? { ...filter, range: studioRangeAddress(studioParseRange(filter.range)!) }
              : undefined,
          }
        : item
    ),
  };
}

/** Returns original row numbers. Filtering never removes source cells or shifts formulas. */
export function studioFilteredRows(sheet: StudioSheet, calculation: SheetCalculation): Set<number> {
  const hidden = new Set<number>();
  const range = sheet.filter && studioParseRange(sheet.filter.range);
  if (!range || !sheet.filter) return hidden;
  for (let row = range.firstRow + 1; row <= range.lastRow; row++) {
    for (const [label, condition] of Object.entries(sheet.filter.columns)) {
      const address = `${label}${row}`;
      const cell = sheet.cells[address];
      const result =
        calculation.values.get(`${sheet.id}:${address}`) ??
        studioInputValue(cell?.input ?? '', cell?.numberFormat);
      const text = String(result).toLocaleLowerCase();
      const expected = condition.value.toLocaleLowerCase();
      const matches =
        condition.operator === 'contains'
          ? text.includes(expected)
          : condition.operator === 'equals'
            ? text === expected
            : typeof result === 'number' &&
              (condition.operator === 'greater'
                ? result > Number(condition.value)
                : result < Number(condition.value));
      if (!matches || calculation.errors.has(`${sheet.id}:${address}`)) {
        hidden.add(row);
        break;
      }
    }
  }
  return hidden;
}

/** Manual visibility and filter visibility are separate persisted decisions. */
export function studioHiddenRows(sheet: StudioSheet, calculation: SheetCalculation): Set<number> {
  const hidden = studioFilteredRows(sheet, calculation);
  for (const row of sheet.hiddenRows ?? []) hidden.add(row);
  return hidden;
}

/** Only A1 references are translated; formula strings and absolute components are preserved. */
export function studioTranslateFormula(input: string, rows: number, columns: number): string {
  if (!input.startsWith('=')) return input;
  if (!Number.isInteger(rows) || !Number.isInteger(columns))
    throw new Error('公式移动距离必须为整数。');
  const unsafeMove = () => {
    throw new Error('该公式包含结构化、动态、三维或溢出引用，不能安全移动。');
  };
  const structure = input.replace(/"(?:[^"]|"")*"|'(?:[^']|'')+'!/g, (token) => {
    if (token.startsWith('"')) return '';
    if (/[:[\]]/.test(token)) unsafeMove();
    return 'SHEET!';
  });
  if (structure.includes('"') || structure.includes("'"))
    throw new Error('公式的字符串或工作表名称未闭合，不能安全移动。');
  if (
    /\[[^\]]*\]|(?:^|[^\p{L}\p{N}_])(?:\$?[A-Z]{1,3}\s*:\s*\$?[A-Z]{1,3}|\$?[1-9]\d*\s*:\s*\$?[1-9]\d*)(?:[^\p{L}\p{N}_]|$)/iu.test(
      structure
    )
  )
    throw new Error('该公式包含结构化引用、整行或整列引用，不能安全移动。');
  if (
    /\b(?:INDIRECT|OFFSET)\s*\(|\bR[1-9]\d*C[1-9]\d*\b|@/i.test(structure) ||
    /:\s*[\p{L}_][\p{L}\p{N}_.]*!/u.test(structure) ||
    structure
      .replace(/#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|ERROR!|CYCLE!|LIMIT!)/gi, '')
      .includes('#')
  )
    unsafeMove();
  const token =
    /"(?:[^"]|"")*"|((?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)(?![\p{L}\p{N}_.(])/giu;
  return input.replace(
    token,
    (
      match,
      sheet: string | undefined,
      fixedCol: string,
      column: string,
      fixedRow: string,
      row: string,
      offset: number
    ) => {
      if (
        match.startsWith('"') ||
        /[\p{L}\p{N}_.]/u.test(input[offset - 1] ?? '') ||
        /^\s*\(/.test(input.slice(offset + match.length))
      )
        return match;
      const original = studioParseAddress(`${column}${row}`);
      // Identifiers outside Excel's A1 address space can be named expressions.
      if (!original) return match;
      const nextRow = original.row + (fixedRow ? 0 : rows);
      const nextCol = original.col + (fixedCol ? 0 : columns);
      if (nextRow < 1 || nextCol < 1 || nextRow > 1048576 || nextCol > 16384)
        throw new Error('移动后公式引用会超出工作表，已取消操作。');
      return `${sheet ?? ''}${fixedCol}${studioColumnLabel(nextCol)}${fixedRow}${nextRow}`;
    }
  );
}

function sortFormula(
  input: string,
  sourceRow: number,
  targetRow: number,
  sheetName: string,
  range: StudioRange
): string {
  if (!input.startsWith('=')) return input;
  if (sourceRow === targetRow) return input;
  // Sorting moves records. References to other sheets stay attached to their
  // original cells; complex local dependencies are refused rather than redirected.
  studioTranslateFormula(input, 0, 0);
  const token =
    /"(?:[^"]|"")*"|((?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)(?![\p{L}\p{N}_.(])/giu;
  return input.replace(
    token,
    (
      match,
      sheet: string | undefined,
      fixedCol: string,
      column: string,
      fixedRow: string,
      row: string,
      offset: number
    ) => {
      if (
        match.startsWith('"') ||
        /[\p{L}\p{N}_.]/u.test(input[offset - 1] ?? '') ||
        /^\s*\(/.test(input.slice(offset + match.length))
      )
        return match;
      if (sheet) {
        const raw = sheet.slice(0, -1);
        const target = raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
        if (target.toLocaleLowerCase() !== sheetName.toLocaleLowerCase()) return match;
      }
      if (fixedRow) return match;
      const position = studioParseAddress(`${column}${row}`);
      if (!position) return match;
      if (
        position.row !== sourceRow ||
        position.col < range.firstCol ||
        position.col > range.lastCol
      )
        throw new Error('排序公式包含跨行或选区外的相对引用，请扩大选区或使用固定行引用后重试。');
      return `${sheet ?? ''}${fixedCol}${column}${targetRow}`;
    }
  );
}

export function studioSortRange(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  column: number,
  direction: 'asc' | 'desc',
  header = true
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const range = studioSelectionBounds(selection);
  if (
    !rangeWithin(sheet, range) ||
    column < range.firstCol ||
    column > range.lastCol ||
    range.lastRow <= range.firstRow
  )
    throw new Error('请选择至少两行数据，排序列应位于选区内。');
  studioSelectionAddresses(selection);
  if (sheet.merges?.some((entry) => intersects(studioParseRange(entry)!, range)))
    throw new Error('排序区域包含合并单元格，请先拆分。');
  const calculation = studioCalculate(document);
  const first = range.firstRow + (header ? 1 : 0);
  const rows = Array.from({ length: range.lastRow - first + 1 }, (_, index) => first + index);
  const valueAt = (row: number) => {
    const address = studioCellAddress(row, column);
    const cell = sheet.cells[address];
    if (calculation.errors.has(`${sheetId}:${address}`))
      throw new Error('排序列含公式错误，请先修正。');
    return (
      calculation.values.get(`${sheetId}:${address}`) ??
      studioInputValue(cell?.input ?? '', cell?.numberFormat)
    );
  };
  rows.sort((a, b) => {
    const left = valueAt(a);
    const right = valueAt(b);
    // Empty cells remain last for both directions.
    if (left === '' || right === '') return left === right ? a - b : left === '' ? 1 : -1;
    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
    return (direction === 'asc' ? compared : -compared) || a - b;
  });
  const updates: Record<string, Partial<StudioCell>> = {};
  const hyperlinks: Record<string, StudioSheetHyperlink[] | null> = {};
  let hyperlinkCoverage = 0;
  rows.forEach((sourceRow, index) => {
    const targetRow = first + index;
    for (let col = range.firstCol; col <= range.lastCol; col++) {
      const source = sheet.cells[studioCellAddress(sourceRow, col)];
      const address = studioCellAddress(targetRow, col);
      updates[address] = source
        ? { ...source, input: sortFormula(source.input, sourceRow, targetRow, sheet.name, range) }
        : { input: '' };
      hyperlinks[address] = studioSheetHyperlinksAt(sheet, studioCellAddress(sourceRow, col));
      hyperlinkCoverage += hyperlinks[address]?.length ?? 0;
      if (hyperlinkCoverage > 500000) throw new Error('排序的超链接范围组合过多，请缩小选区。');
    }
  });
  return studioPatchCells(document, sheetId, updates, { replace: true, hyperlinks });
}

export function studioAddChart(
  document: StudioExcelDocument,
  sheetId: string,
  input: string,
  type: 'bar' | 'line'
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  const range = studioParseRange(input);
  if (
    !sheet ||
    !rangeWithin(sheet, range) ||
    range.firstRow === range.lastRow ||
    range.firstCol === range.lastCol ||
    range.lastRow - range.firstRow > 300 ||
    range.lastCol - range.firstCol > 8
  )
    throw new Error('图表区域需包含首行系列名、首列分类与数字数据，最多 300 个分类、8 个系列。');
  if ((sheet.charts?.length ?? 0) >= 20) throw new Error('每张工作表最多插入 20 个图表。');
  if (sheet.merges?.some((entry) => intersects(studioParseRange(entry)!, range)))
    throw new Error('图表数据区域不能包含合并单元格。');
  const calculation = studioCalculate(document);
  for (let row = range.firstRow + 1; row <= range.lastRow; row++)
    for (let col = range.firstCol + 1; col <= range.lastCol; col++) {
      const address = studioCellAddress(row, col);
      const cell = sheet.cells[address];
      const value =
        calculation.values.get(`${sheetId}:${address}`) ??
        studioInputValue(cell?.input ?? '', cell?.numberFormat);
      if (
        value !== '' &&
        (typeof value !== 'number' || calculation.errors.has(`${sheetId}:${address}`))
      )
        throw new Error('图表数据需为数字或空白，请检查所选区域。');
    }
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `chart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId
        ? {
            ...item,
            charts: [
              ...(item.charts ?? []),
              {
                id,
                type,
                title: type === 'bar' ? '柱状图' : '折线图',
                range: studioRangeAddress(range),
              },
            ],
          }
        : item
    ),
  };
}

export function studioChartData(
  sheet: StudioSheet,
  chart: NonNullable<StudioSheet['charts']>[number],
  calculation: SheetCalculation,
  includeHidden = false
) {
  const range = studioParseRange(chart.range)!;
  const hidden = includeHidden ? new Set<number>() : studioHiddenRows(sheet, calculation);
  const rows = Array.from(
    { length: range.lastRow - range.firstRow },
    (_, index) => range.firstRow + index + 1
  ).filter((row) => !hidden.has(row));
  const read = (row: number, col: number) => {
    const address = studioCellAddress(row, col);
    const cell = sheet.cells[address];
    return (
      calculation.values.get(`${sheet.id}:${address}`) ??
      studioInputValue(cell?.input ?? '', cell?.numberFormat)
    );
  };
  return {
    categories: rows.map((row) => String(read(row, range.firstCol))),
    series: Array.from({ length: range.lastCol - range.firstCol }, (_, index) => ({
      name: String(read(range.firstRow, range.firstCol + index + 1)),
      values: rows.map((row) => {
        const value = read(row, range.firstCol + index + 1);
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      }),
    })),
  };
}
