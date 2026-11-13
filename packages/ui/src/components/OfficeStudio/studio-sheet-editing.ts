import type { StudioCell, StudioExcelDocument, StudioSheet } from './studio-types';
import {
  studioCalculate,
  studioDisplayCell,
  studioColumnLabel,
  studioParseAddress,
  studioPatchCells,
  studioMergedRange,
  studioSelectionAddresses,
  studioSelectionBounds,
  type SheetSelection,
} from './studio-sheet-model';
import { studioCellValidation } from './studio-sheet-rules';
import { studioBorderSides } from './studio-cell-style';

export interface StudioSheetSearchOptions {
  query: string;
  matchCase?: boolean;
  wholeCell?: boolean;
  lookIn: 'values' | 'formulas';
  order?: 'rows' | 'columns';
  scope: 'sheet' | 'workbook' | 'selection';
  sheetId: string;
  selection?: SheetSelection;
}
export interface StudioSheetMatch {
  sheetId: string;
  address: string;
  text: string;
  replaceable: boolean;
}

/** Wildcards use a bounded state machine, avoiding regex backtracking on cell contents. */
function searchSpan(
  text: string,
  options: StudioSheetSearchOptions
): { start: number; end: number } | undefined {
  const chars = Array.from(options.query);
  const tokens: Array<{ kind: 'literal' | 'star' | 'any'; value: string }> = [];
  for (let i = 0; i < chars.length; i++) {
    let char = chars[i];
    const escaped = char === '~' && ['*', '?', '~'].includes(chars[i + 1]);
    if (escaped) char = chars[++i];
    const kind = !escaped && char === '*' ? 'star' : !escaped && char === '?' ? 'any' : 'literal';
    if (kind === 'star' && tokens.at(-1)?.kind === 'star') continue;
    tokens.push({ kind, value: options.matchCase ? char : char.toLocaleLowerCase() });
  }
  const folded = options.matchCase
    ? text
    : Array.from(text, (char) => char.toLocaleLowerCase()).join('');
  if (!tokens.some((token) => token.kind !== 'literal') && folded.length === text.length) {
    const needle = tokens.map((token) => token.value).join('');
    const value = folded;
    const start = value.indexOf(needle);
    if (start < 0 || (options.wholeCell && (start !== 0 || needle.length !== value.length))) return;
    return { start, end: start + needle.length };
  }
  if (tokens.length > 256 || tokens.length * (Array.from(text).length + 1) > 2000000)
    throw new Error('通配符查找内容过于复杂，请缩短条件。');
  let states = new Int32Array(tokens.length + 1).fill(-1);
  let offset = 0;
  let best: { start: number; end: number } | undefined;
  const closure = () => {
    if (!options.wholeCell || offset === 0) {
      if (states[0] < 0) states[0] = offset;
    }
    for (let i = 0; i < tokens.length; i++)
      if (
        tokens[i].kind === 'star' &&
        states[i] >= 0 &&
        (states[i + 1] < 0 || states[i] < states[i + 1])
      )
        states[i + 1] = states[i];
    const start = states[tokens.length];
    if (
      start >= 0 &&
      (!options.wholeCell || offset === text.length) &&
      (!best || start <= best.start)
    )
      best = { start, end: offset };
  };
  closure();
  for (const char of text) {
    const next = new Int32Array(tokens.length + 1).fill(-1);
    for (let i = 0; i < tokens.length; i++) {
      if (states[i] < 0) continue;
      const token = tokens[i];
      if (
        token.kind === 'literal' &&
        token.value !== (options.matchCase ? char : char.toLocaleLowerCase())
      )
        continue;
      const index = token.kind === 'star' ? i : i + 1;
      if (next[index] < 0 || states[i] < next[index]) next[index] = states[i];
    }
    states = next;
    offset += char.length;
    closure();
  }
  return best;
}

function replaceSearchText(text: string, options: StudioSheetSearchOptions, replacement: string) {
  let remaining = text;
  let output = '';
  while (remaining) {
    const span = searchSpan(remaining, options);
    if (!span) return output + remaining;
    output += remaining.slice(0, span.start) + replacement;
    if (span.start === span.end) {
      const char = Array.from(remaining.slice(span.end))[0] ?? '';
      output += char;
      remaining = remaining.slice(span.end + char.length);
    } else remaining = remaining.slice(span.end);
    if (options.wholeCell) break;
  }
  return output + remaining;
}

export function studioFindSheetCells(
  document: StudioExcelDocument,
  options: StudioSheetSearchOptions
): StudioSheetMatch[] {
  if (!options.query) return [];
  if (options.query.length > 32767) throw new Error('查找内容过长。');
  const bounds = options.selection && studioSelectionBounds(options.selection);
  const calculation = options.lookIn === 'values' ? studioCalculate(document) : undefined;
  const matches: StudioSheetMatch[] = [];
  for (const sheet of document.sheets) {
    if (options.scope !== 'workbook' && sheet.id !== options.sheetId) continue;
    const entries = Object.entries(sheet.cells).sort(([a], [b]) => {
      const left = studioParseAddress(a)!;
      const right = studioParseAddress(b)!;
      return options.order === 'columns'
        ? left.col - right.col || left.row - right.row
        : left.row - right.row || left.col - right.col;
    });
    for (const [address, cell] of entries) {
      const position = studioParseAddress(address)!;
      if (
        options.scope === 'selection' &&
        (!bounds ||
          position.row < bounds.firstRow ||
          position.row > bounds.lastRow ||
          position.col < bounds.firstCol ||
          position.col > bounds.lastCol)
      )
        continue;
      const merge = studioMergedRange(sheet, position);
      if (merge && (merge.firstRow !== position.row || merge.firstCol !== position.col)) continue;
      if (!cell.input) continue;
      const key = `${sheet.id}:${address}`;
      const text =
        options.lookIn === 'formulas'
          ? cell.input.replace(/^'/, '')
          : studioDisplayCell(cell, calculation!.values.get(key), calculation!.errors.get(key));
      if (searchSpan(text, options))
        matches.push({
          sheetId: sheet.id,
          address,
          text,
          replaceable: options.lookIn === 'formulas' || !cell.input.startsWith('='),
        });
    }
  }
  return matches;
}

export function studioReplaceSheetCells(
  document: StudioExcelDocument,
  options: StudioSheetSearchOptions,
  replacement: string,
  only?: Pick<StudioSheetMatch, 'sheetId' | 'address'>
) {
  if (replacement.length > 32767)
    throw new Error('单元格内容最多支持 32,767 个字符，请缩短替换内容。');
  const matches = studioFindSheetCells(document, options).filter(
    (match) => !only || (only.sheetId === match.sheetId && only.address === match.address)
  );
  const usable = matches.filter((match) => match.replaceable);
  if (usable.length > 10000) throw new Error('一次最多替换 10,000 个单元格，请缩小范围。');
  let next = document;
  let changed = 0;
  let generatedCharacters = 0;
  let skipped = matches.length - usable.length;
  const changedAddresses = new Map<string, string[]>();
  for (const sheet of document.sheets) {
    const updates: Record<string, Partial<StudioCell>> = {};
    for (const match of usable.filter((item) => item.sheetId === sheet.id)) {
      const cell = sheet.cells[match.address];
      // Search displayed values, but replace stored text; numbers use their raw value.
      const input = cell.input.replace(/^'/, '');
      if (!searchSpan(input, options)) {
        skipped++;
        continue;
      }
      const value = replaceSearchText(input, options, replacement);
      const updated = cell.input.startsWith("'") ? `'${value}` : value;
      if (updated === cell.input) continue;
      updates[match.address] = { input: updated };
      generatedCharacters += updated.length;
      if (generatedCharacters > 5000000)
        throw new Error('替换后的内容过大，一次最多生成 5,000,000 个字符。');
      changed++;
    }
    if (Object.keys(updates).length) {
      next = studioPatchCells(next, sheet.id, updates, { deferValidation: true });
      changedAddresses.set(sheet.id, Object.keys(updates));
    }
  }
  const calculation = studioCalculate(next);
  for (const [sheetId, addresses] of changedAddresses) {
    const sheet = next.sheets.find((item) => item.id === sheetId)!;
    for (const address of addresses) {
      const validation = studioCellValidation(sheet, address, calculation);
      if (validation?.blocking)
        throw new Error(`${sheet.name}!${address}：${validation.message}；全部替换已取消。`);
    }
  }
  if (next !== document) next = { ...next, activeSheetId: document.activeSheetId };
  return { document: next, changed, skipped };
}

export function studioSetColumnWidths(
  document: StudioExcelDocument,
  sheetId: string,
  widths: Record<string, number>
) {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  let columns = sheet.columnCount;
  for (const [label, width] of Object.entries(widths)) {
    const position = studioParseAddress(`${label}1`);
    if (
      !/^[A-Z]{1,3}$/.test(label) ||
      !position ||
      position.col > 256 ||
      !Number.isFinite(width) ||
      width < 12 ||
      width > 1790
    )
      throw new Error('列宽须为 1–255 个字符。');
    columns = Math.max(columns, position.col);
  }
  if (
    columns === sheet.columnCount &&
    Object.entries(widths).every(([label, width]) => sheet.columnWidths?.[label] === width)
  )
    return document;
  return {
    ...document,
    sheets: document.sheets.map((item) =>
      item.id === sheetId
        ? { ...item, columnCount: columns, columnWidths: { ...item.columnWidths, ...widths } }
        : item
    ),
  };
}

/** Selecting any part of a merge formats its complete visual cell. */
export function studioFormattingSelection(
  sheet: StudioSheet,
  selection: SheetSelection
): SheetSelection {
  const bounds = studioSelectionBounds(selection);
  let changed = true;
  while (changed) {
    changed = false;
    for (const input of sheet.merges ?? []) {
      const [start, end] = input.split(':').map(studioParseAddress);
      if (!start || !end) continue;
      if (
        start.row > bounds.lastRow ||
        end.row < bounds.firstRow ||
        start.col > bounds.lastCol ||
        end.col < bounds.firstCol
      )
        continue;
      const expanded = {
        firstRow: Math.min(bounds.firstRow, start.row),
        lastRow: Math.max(bounds.lastRow, end.row),
        firstCol: Math.min(bounds.firstCol, start.col),
        lastCol: Math.max(bounds.lastCol, end.col),
      };
      if (
        Object.keys(expanded).some(
          (key) => expanded[key as keyof typeof expanded] !== bounds[key as keyof typeof bounds]
        )
      ) {
        Object.assign(bounds, expanded);
        changed = true;
      }
    }
  }
  return {
    anchor: { row: bounds.firstRow, col: bounds.firstCol },
    focus: { row: bounds.lastRow, col: bounds.lastCol },
  };
}

export function studioApplyBorders(
  document: StudioExcelDocument,
  sheetId: string,
  selection: SheetSelection,
  preset: 'all' | 'outer' | 'none',
  border: NonNullable<StudioCell['borders']>['top']
) {
  const sheet = document.sheets.find((item) => item.id === sheetId)!;
  const expanded = studioFormattingSelection(sheet, selection);
  const bounds = studioSelectionBounds(expanded);
  const updates: Record<string, Partial<StudioCell>> = {};
  for (const address of studioSelectionAddresses(expanded)) {
    const pos = studioParseAddress(address)!;
    const borders: StudioCell['borders'] =
      preset === 'none' ? {} : { ...sheet.cells[address]?.borders };
    for (const side of studioBorderSides) {
      const outer =
        side === 'top'
          ? pos.row === bounds.firstRow
          : side === 'bottom'
            ? pos.row === bounds.lastRow
            : side === 'left'
              ? pos.col === bounds.firstCol
              : pos.col === bounds.lastCol;
      if (preset === 'all' || (preset === 'outer' && outer)) borders[side] = border;
    }
    updates[address] = { borders };
  }
  return studioPatchCells(document, sheetId, updates);
}

export function studioDefaultCellFormat(): Omit<StudioCell, 'input'> {
  return {
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
}

export function studioColumnCharacterWidth(pixels: number) {
  return (pixels - 5) / 7;
}
export function studioColumnPixelWidth(characters: number) {
  return characters * 7 + 5;
}
export { studioColumnLabel };
