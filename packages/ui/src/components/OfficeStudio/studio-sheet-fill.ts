import {
  STUDIO_SHEET_LIMITS,
  studioCellAddress,
  studioInputValue,
  studioParseRange,
  studioPatchCells,
  studioSelectionAddresses,
  studioSelectionBounds,
  studioTranslateFormula,
  type SheetPosition,
  type SheetSelection,
} from './studio-sheet-model';
import { studioSheetHyperlinksAt } from './studio-sheet-hyperlinks';
import type {
  StudioCell,
  StudioExcelDocument,
  StudioSheet,
  StudioSheetHyperlink,
} from './studio-types';

export type StudioFillDirection = 'down' | 'right';

export interface StudioFillSeriesOptions {
  direction: StudioFillDirection;
  type: 'number' | 'date' | 'text';
  step?: number;
  seedCount?: 1 | 2;
}

const DAY = 86400000;
const FIRST_ISO_DAY = Date.parse('0001-01-01T00:00:00.000Z') / DAY;
const LAST_ISO_DAY = Date.parse('9999-12-31T00:00:00.000Z') / DAY;
const LAST_SERIAL_DAY = 2958466;

function fillContext(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  direction: StudioFillDirection
) {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (direction !== 'down' && direction !== 'right') throw new Error('填充方向无效。');
  for (const position of [selection.anchor, selection.focus]) {
    if (
      !Number.isInteger(position.row) ||
      !Number.isInteger(position.col) ||
      position.row < 1 ||
      position.col < 1 ||
      position.row > STUDIO_SHEET_LIMITS.rows ||
      position.col > STUDIO_SHEET_LIMITS.columns
    )
      throw new Error('填充区域超出 10,000 行、256 列的支持范围。');
  }
  studioSelectionAddresses(selection);
  const bounds = studioSelectionBounds(selection);
  const rows = bounds.lastRow - bounds.firstRow + 1;
  const columns = bounds.lastCol - bounds.firstCol + 1;
  return {
    sheet,
    bounds,
    length: direction === 'down' ? rows : columns,
    tracks: direction === 'down' ? columns : rows,
    position(track: number, index: number): SheetPosition {
      return {
        row: bounds.firstRow + (direction === 'down' ? index : track),
        col: bounds.firstCol + (direction === 'down' ? track : index),
      };
    },
  };
}

function rejectMergedRange(sheet: StudioSheet, bounds: ReturnType<typeof studioSelectionBounds>) {
  for (const entry of sheet.merges ?? []) {
    const range = studioParseRange(entry);
    if (!range) throw new Error('合并区域无效，请先修复工作表。');
    if (
      range.firstRow <= bounds.lastRow &&
      range.lastRow >= bounds.firstRow &&
      range.firstCol <= bounds.lastCol &&
      range.lastCol >= bounds.firstCol
    )
      throw new Error('填充区域中有合并单元格，请先拆分。');
  }
}

function fillBatch() {
  const updates: Record<string, StudioCell> = {};
  const hyperlinks: Record<string, StudioSheetHyperlink[]> = {};
  let inputLength = 0;
  let hyperlinkCoverage = 0;
  return {
    updates,
    hyperlinks,
    add(position: SheetPosition, cell: StudioCell, links: StudioSheetHyperlink[]) {
      if (cell.input.length > 32767) throw new Error('每个单元格的填充内容最多 32,767 个字符。');
      inputLength += cell.input.length;
      if (inputLength > 5000000) throw new Error('填充内容过大，请缩小选区或分批填充。');
      hyperlinkCoverage += links.length;
      if (hyperlinkCoverage > 500000) throw new Error('填充的超链接范围组合过多，请缩小选区。');
      updates[studioCellAddress(position.row, position.col)] = cell;
      hyperlinks[studioCellAddress(position.row, position.col)] = links;
    },
  };
}

/** Each column/row copies its top/left cell from the original snapshot. */
export function studioFillCells(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  direction: StudioFillDirection
): StudioExcelDocument {
  const context = fillContext(document, sheetId, selection, direction);
  if (context.length === 1) return document;
  rejectMergedRange(context.sheet, context.bounds);
  const batch = fillBatch();
  for (let track = 0; track < context.tracks; track++) {
    const origin = context.position(track, 0);
    const source = context.sheet.cells[studioCellAddress(origin.row, origin.col)] ?? {
      input: '',
    };
    const hyperlinks = studioSheetHyperlinksAt(
      context.sheet,
      studioCellAddress(origin.row, origin.col)
    );
    for (let index = 1; index < context.length; index++) {
      const target = context.position(track, index);
      batch.add(
        target,
        {
          ...source,
          input: studioTranslateFormula(
            source.input,
            target.row - origin.row,
            target.col - origin.col
          ),
        },
        hyperlinks
      );
    }
  }
  return studioPatchCells(document, sheetId, batch.updates, {
    replace: true,
    hyperlinks: batch.hyperlinks,
  });
}

function numericSeed(cell: StudioCell): number {
  const value = studioInputValue(cell.input, cell.numberFormat);
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('数字序列需要有效数字种子，不能使用公式或文本。');
  return value;
}

function decimalPlaces(value: number): number {
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

function numberSeries(seeds: StudioCell[], step?: number): (offset: number) => string {
  const values = seeds.map(numericSeed);
  const increment = step ?? (values.length === 2 ? values[1] - values[0] : 1);
  if (!Number.isFinite(increment)) throw new Error('序列步长超出有效数字范围。');
  const last = values[values.length - 1];
  // Derive decimal precision from the entered seeds, not a noisy inferred difference.
  const scale = 10 ** Math.max(...values.map(decimalPlaces), decimalPlaces(step ?? 1));
  return (offset) => {
    const value = last + increment * offset;
    if (!Number.isFinite(value)) throw new Error('序列结果超出有效数字范围。');
    const rounded = Number.isFinite(value * scale) ? Math.round(value * scale) / scale : value;
    return String(rounded);
  };
}

function dateSeed(cell: StudioCell): { value: number; format: 'iso' | 'serial' } {
  const value = studioInputValue(cell.input, cell.numberFormat);
  if (typeof value === 'number' && value >= 0 && value < LAST_SERIAL_DAY)
    return { value, format: 'serial' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (
      Number.isFinite(timestamp) &&
      timestamp / DAY >= FIRST_ISO_DAY &&
      new Date(timestamp).toISOString().slice(0, 10) === value
    )
      return { value: timestamp / DAY, format: 'iso' };
  }
  throw new Error('日期序列需要有效 YYYY-MM-DD 日期或 Excel 日期序号。');
}

function dateSeries(seeds: StudioCell[], step?: number): (offset: number) => string {
  const values = seeds.map(dateSeed);
  if (values.some((value) => value.format !== values[0].format))
    throw new Error('日期种子必须使用相同的日期表示。');
  const increment = step ?? (values.length === 2 ? values[1].value - values[0].value : 1);
  if (!Number.isInteger(increment)) throw new Error('日期序列的步长必须为整数天。');
  const last = values[values.length - 1];
  return (offset) => {
    const value = last.value + increment * offset;
    if (
      !Number.isFinite(value) ||
      (last.format === 'serial'
        ? value < 0 || value >= LAST_SERIAL_DAY
        : value < FIRST_ISO_DAY || value > LAST_ISO_DAY)
    )
      throw new Error('日期序列超出支持的日期范围。');
    return last.format === 'serial'
      ? String(value)
      : new Date(value * DAY).toISOString().slice(0, 10);
  };
}

function textSeries(seeds: StudioCell[], step?: number): (offset: number) => string {
  const values = seeds.map((cell) => {
    const match = cell.input.startsWith('=') ? null : /^(.*?)(\d+)$/s.exec(cell.input);
    if (!match || !Number.isSafeInteger(Number(match[2])))
      throw new Error('文本序列需要带有有效整数尾数的文本种子。');
    return { prefix: match[1], value: Number(match[2]), width: match[2].length };
  });
  if (values.some((value) => value.prefix !== values[0].prefix))
    throw new Error('文本种子的前缀必须相同。');
  const increment = step ?? (values.length === 2 ? values[1].value - values[0].value : 1);
  if (!Number.isSafeInteger(increment)) throw new Error('文本序列的步长必须为有效整数。');
  const last = values[values.length - 1];
  const width = Math.max(...values.map((value) => value.width));
  return (offset) => {
    const value = last.value + increment * offset;
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('文本序列的尾数超出有效非负整数范围。');
    return `${last.prefix}${String(value).padStart(width, '0')}`;
  };
}

/** Seeds stay unchanged; generated values and direct styles commit as one batch. */
export function studioFillSeries(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  options: StudioFillSeriesOptions
): StudioExcelDocument {
  const seedCount = options.seedCount ?? 1;
  if (seedCount !== 1 && seedCount !== 2) throw new Error('序列填充支持一个或两个种子。');
  if (!['number', 'date', 'text'].includes(options.type)) throw new Error('序列类型无效。');
  if (options.step !== undefined && !Number.isFinite(options.step))
    throw new Error('序列步长必须为有效数字。');
  const context = fillContext(document, sheetId, selection, options.direction);
  if (context.length < seedCount) throw new Error('选区没有足够的序列种子。');
  if (context.length === seedCount) return document;
  rejectMergedRange(context.sheet, context.bounds);
  const batch = fillBatch();
  for (let track = 0; track < context.tracks; track++) {
    const seeds = Array.from({ length: seedCount }, (_, index) => {
      const position = context.position(track, index);
      return context.sheet.cells[studioCellAddress(position.row, position.col)] ?? { input: '' };
    });
    const generate =
      options.type === 'number'
        ? numberSeries(seeds, options.step)
        : options.type === 'date'
          ? dateSeries(seeds, options.step)
          : textSeries(seeds, options.step);
    for (let index = seedCount; index < context.length; index++) {
      const position = context.position(track, index);
      const source = seeds[index % seedCount];
      const origin = context.position(track, index % seedCount);
      const input = generate(index - seedCount + 1);
      const cell = { ...source, input };
      // Pure digit identifiers remain text when their padding reaches e.g. 099 -> 100.
      if (options.type === 'text' && typeof studioInputValue(input, cell.numberFormat) !== 'string')
        cell.numberFormat = '@';
      batch.add(
        position,
        cell,
        studioSheetHyperlinksAt(context.sheet, studioCellAddress(origin.row, origin.col))
      );
    }
  }
  return studioPatchCells(document, sheetId, batch.updates, {
    replace: true,
    hyperlinks: batch.hyperlinks,
  });
}
