import { isOfficeStudioDocument } from './studio-model';
import {
  STUDIO_SHEET_LIMITS,
  studioCellAddress,
  studioColumnLabel,
  studioParseAddress,
  studioParseRange,
  studioTranslateFormula,
} from './studio-sheet-model';
import { studioMapSheetRuleFormulae } from './studio-sheet-rules';
import { studioTransformSheetHyperlinks } from './studio-sheet-hyperlinks';
import type {
  StudioCell,
  StudioExcelDocument,
  StudioSheet,
  StudioSheetStructureEdit,
} from './studio-types';

const STRUCTURE_LOG_LIMIT = 500;
const EXCEL_ROWS = 1048576;
const EXCEL_COLUMNS = 16384;
const identifierCharacter = /[\p{L}\p{N}\p{M}_.\\]/u;
const identifier = /^[\p{L}\p{N}\p{M}_.\\]+/u;
const cellToken = /^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)/i;
const formulaError =
  /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|ERROR!|CYCLE!|LIMIT!|SPILL!|CALC!|BUSY!|GETTING_DATA)/i;

function validEdit(edit: StudioSheetStructureEdit) {
  if (
    !edit ||
    !['row', 'column'].includes(edit.axis) ||
    !['insert', 'delete'].includes(edit.type) ||
    !Number.isSafeInteger(edit.index) ||
    !Number.isSafeInteger(edit.count) ||
    edit.index < 1 ||
    edit.count < 1 ||
    !Number.isSafeInteger(edit.index + edit.count)
  )
    throw new Error('行列结构变更需要有效的操作、起始位置和正整数数量。');
}

/** Internal codec helper: replay each operation against the previous coordinate. */
export function studioTransformSheetIndex(
  index: number,
  edit: StudioSheetStructureEdit
): number | undefined {
  validEdit(edit);
  const limit = edit.axis === 'row' ? EXCEL_ROWS : EXCEL_COLUMNS;
  if (!Number.isSafeInteger(index) || index < 1 || index > limit)
    throw new Error('单元格位置无效。');
  if (edit.type === 'insert') {
    const moved = index < edit.index ? index : index + edit.count;
    if (moved > limit) throw new Error('结构变更后的单元格位置超出 Excel 引用范围。');
    return moved;
  }
  if (index < edit.index) return index;
  if (index < edit.index + edit.count) return undefined;
  return index - edit.count;
}

function transformInterval(
  first: number,
  last: number,
  edit: StudioSheetStructureEdit
): [number, number] | undefined {
  const lower = Math.min(first, last);
  const upper = Math.max(first, last);
  let start: number;
  let end: number;
  if (edit.type === 'insert') {
    start = lower >= edit.index ? lower + edit.count : lower;
    end = upper >= edit.index ? upper + edit.count : upper;
  } else {
    const deletedEnd = edit.index + edit.count - 1;
    if (lower >= edit.index && upper <= deletedEnd) return undefined;
    start = lower < edit.index ? lower : Math.max(lower, deletedEnd + 1) - edit.count;
    end = upper > deletedEnd ? upper - edit.count : Math.min(upper, edit.index - 1);
  }
  return first <= last ? [start, end] : [end, start];
}

interface Reference {
  row: number;
  col: number;
  absoluteRow: string;
  absoluteColumn: string;
  lowercaseColumn: boolean;
  qualifier: string;
  sheetName?: string;
  raw: string;
  end: number;
}

interface WholeRangeReference {
  first: number;
  last: number;
  axis: 'row' | 'column';
  leftQualifier: string;
  rightQualifier: string;
  leftSheet?: string;
  rightSheet?: string;
  leftDollar: string;
  rightDollar: string;
  leftLowercase: boolean;
  rightLowercase: boolean;
  separator: string;
  raw: string;
  end: number;
}

function unsafeReference(reason: string): never {
  throw new Error(`公式包含无法安全调整的引用（${reason}），请先简化公式。`);
}

function readQualifier(formula: string, index: number) {
  if (formula[index] === "'") {
    let end = index + 1;
    let name = '';
    while (end < formula.length) {
      if (formula[end] !== "'") {
        name += formula[end++];
        continue;
      }
      if (formula[end + 1] === "'") {
        name += "'";
        end += 2;
        continue;
      }
      if (formula[end + 1] !== '!') return undefined;
      end += 2;
      while (/\s/.test(formula[end] ?? '') && end < formula.length) end++;
      if (!name || /[:[\]]/.test(name)) unsafeReference('工作表范围或外部工作簿');
      return { name, end, raw: formula.slice(index, end) };
    }
    return undefined;
  }
  const word = identifier.exec(formula.slice(index));
  if (!word || formula[index + word[0].length] !== '!') return undefined;
  let end = index + word[0].length + 1;
  while (/\s/.test(formula[end] ?? '') && end < formula.length) end++;
  return { name: word[0], end, raw: formula.slice(index, end) };
}

function readReference(formula: string, index: number): Reference | undefined {
  if (index > 0 && identifierCharacter.test(formula[index - 1])) return undefined;
  const qualifier = readQualifier(formula, index);
  const start = qualifier?.end ?? index;
  const match = cellToken.exec(formula.slice(start));
  if (!match) {
    if (qualifier) unsafeReference('命名区域或非 A1 引用');
    return undefined;
  }
  const end = start + match[0].length;
  if (identifierCharacter.test(formula[end] ?? '')) {
    if (qualifier) unsafeReference('非 A1 引用');
    return undefined;
  }
  // LOG10 and ATAN2 can look like cell addresses. Function names are never moved.
  if (/^\s*\(/.test(formula.slice(end))) return undefined;
  const position = studioParseAddress(match[0]);
  if (!position) {
    if (qualifier || match[1] || match[3]) unsafeReference('超出 Excel 引用范围');
    return undefined;
  }
  return {
    ...position,
    absoluteColumn: match[1],
    absoluteRow: match[3],
    lowercaseColumn: match[2] === match[2].toLowerCase(),
    qualifier: qualifier?.raw ?? '',
    sheetName: qualifier?.name,
    raw: formula.slice(index, end),
    end,
  };
}

function readWholeRange(formula: string, index: number): WholeRangeReference | undefined {
  if (index > 0 && identifierCharacter.test(formula[index - 1])) return undefined;
  const leftQualifier = readQualifier(formula, index);
  const leftStart = leftQualifier?.end ?? index;
  const left = /^(\$?)([A-Z]{1,3}|[1-9]\d*)/i.exec(formula.slice(leftStart));
  if (!left) return undefined;
  const leftEnd = leftStart + left[0].length;
  if (identifierCharacter.test(formula[leftEnd] ?? '')) return undefined;
  const separator = /^\s*:\s*/.exec(formula.slice(leftEnd));
  if (!separator) return undefined;
  const rightStart = leftEnd + separator[0].length;
  const rightQualifier = readQualifier(formula, rightStart);
  const rightCellStart = rightQualifier?.end ?? rightStart;
  const right = /^(\$?)([A-Z]{1,3}|[1-9]\d*)/i.exec(formula.slice(rightCellStart));
  const end = rightCellStart + (right?.[0].length ?? 0);
  const rows = /^\d/.test(left[2]);
  if (!right || identifierCharacter.test(formula[end] ?? '') || rows !== /^\d/.test(right[2]))
    unsafeReference('整行或整列范围无效');
  const first = rows ? Number(left[2]) : studioParseAddress(`${left[2]}1`)?.col;
  const last = rows ? Number(right[2]) : studioParseAddress(`${right[2]}1`)?.col;
  if (
    !first ||
    !last ||
    first > (rows ? EXCEL_ROWS : EXCEL_COLUMNS) ||
    last > (rows ? EXCEL_ROWS : EXCEL_COLUMNS)
  )
    unsafeReference('超出 Excel 引用范围');
  return {
    first,
    last,
    axis: rows ? 'row' : 'column',
    leftQualifier: leftQualifier?.raw ?? '',
    rightQualifier: rightQualifier?.raw ?? '',
    leftSheet: leftQualifier?.name,
    rightSheet: rightQualifier?.name,
    leftDollar: left[1],
    rightDollar: right[1],
    leftLowercase: left[2] === left[2].toLowerCase(),
    rightLowercase: right[2] === right[2].toLowerCase(),
    separator: separator[0],
    raw: formula.slice(index, end),
    end,
  };
}

function renderWholeRange(reference: WholeRangeReference, edit: StudioSheetStructureEdit) {
  if (reference.axis !== edit.axis) return reference.raw;
  const moved = transformInterval(reference.first, reference.last, edit);
  if (!moved) return '#REF!';
  const limit = reference.axis === 'row' ? EXCEL_ROWS : EXCEL_COLUMNS;
  if (moved.some((position) => position < 1 || position > limit))
    unsafeReference('变更后超出 Excel 引用范围');
  if (moved[0] === reference.first && moved[1] === reference.last) return reference.raw;
  let first = reference.axis === 'row' ? String(moved[0]) : studioColumnLabel(moved[0]);
  let last = reference.axis === 'row' ? String(moved[1]) : studioColumnLabel(moved[1]);
  if (reference.leftLowercase) first = first.toLowerCase();
  if (reference.rightLowercase) last = last.toLowerCase();
  return `${reference.leftQualifier}${reference.leftDollar}${first}${reference.separator}${reference.rightQualifier}${reference.rightDollar}${last}`;
}

function renderReference(reference: Reference, row: number, col: number) {
  if (row < 1 || row > EXCEL_ROWS || col < 1 || col > EXCEL_COLUMNS)
    unsafeReference('变更后超出 Excel 引用范围');
  if (reference.row === row && reference.col === col) return reference.raw;
  let label = studioColumnLabel(col);
  if (reference.lowercaseColumn) label = label.toLowerCase();
  return `${reference.qualifier}${reference.absoluteColumn}${label}${reference.absoluteRow}${row}`;
}

/**
 * Internal codec helper for one A1, whole-row or whole-column range. Qualifiers
 * and multiple print areas must be split by the codec before calling this.
 * Dollar markers remain present but do not prevent a structural move.
 */
export function studioTransformSheetRange(
  range: string,
  edit: StudioSheetStructureEdit
): string | undefined {
  validEdit(edit);
  const text = range.trim();
  const whole = /^(\$?)([A-Z]{1,3}|[1-9]\d*)(\s*:\s*)(\$?)([A-Z]{1,3}|[1-9]\d*)$/i.exec(text);
  if (whole) {
    const rows = /^\d/.test(whole[2]);
    if (rows !== /^\d/.test(whole[5])) throw new Error('范围必须使用同一种行列地址。');
    const first = rows ? Number(whole[2]) : studioParseAddress(`${whole[2]}1`)?.col;
    const last = rows ? Number(whole[5]) : studioParseAddress(`${whole[5]}1`)?.col;
    const limit = rows ? EXCEL_ROWS : EXCEL_COLUMNS;
    if (!first || !last || first > limit || last > limit) throw new Error('范围超出 Excel 限制。');
    if (edit.axis !== (rows ? 'row' : 'column')) return text;
    const moved = transformInterval(first, last, edit);
    if (!moved) return undefined;
    if (moved.some((position) => position < 1 || position > limit))
      throw new Error('结构变更后的范围超出 Excel 限制。');
    return `${whole[1]}${rows ? moved[0] : studioColumnLabel(moved[0])}${whole[3]}${whole[4]}${rows ? moved[1] : studioColumnLabel(moved[1])}`;
  }
  const left = readReference(text, 0);
  if (!left || left.qualifier) throw new Error('需要单个不含工作表名称的 A1 范围。');
  const separator = /^\s*:\s*/.exec(text.slice(left.end));
  if (!separator) {
    if (left.end !== text.length) throw new Error('A1 范围无效。');
    const moved = studioTransformSheetIndex(edit.axis === 'row' ? left.row : left.col, edit);
    return moved === undefined
      ? undefined
      : renderReference(
          left,
          edit.axis === 'row' ? moved : left.row,
          edit.axis === 'column' ? moved : left.col
        );
  }
  const right = readReference(text, left.end + separator[0].length);
  if (!right || right.qualifier || right.end !== text.length) throw new Error('A1 范围无效。');
  const moved = transformInterval(
    edit.axis === 'row' ? left.row : left.col,
    edit.axis === 'row' ? right.row : right.col,
    edit
  );
  if (!moved) return undefined;
  return `${renderReference(left, edit.axis === 'row' ? moved[0] : left.row, edit.axis === 'column' ? moved[0] : left.col)}${separator[0]}${renderReference(right, edit.axis === 'row' ? moved[1] : right.row, edit.axis === 'column' ? moved[1] : right.col)}`;
}

function rewriteFormula(
  formula: string,
  currentSheet: StudioSheet,
  affectedSheet: StudioSheet,
  edit: StudioSheetStructureEdit
) {
  const affected = affectedSheet.name.toLocaleLowerCase();
  const pieces: string[] = [];
  let index = 0;
  while (index < formula.length) {
    if (formula[index] === '"') {
      const start = index++;
      let closed = false;
      while (index < formula.length) {
        if (formula[index++] !== '"') continue;
        if (formula[index] === '"') index++;
        else {
          closed = true;
          break;
        }
      }
      if (!closed) unsafeReference('未闭合的字符串');
      pieces.push(formula.slice(start, index));
      continue;
    }
    const qualifier = readQualifier(formula, index);
    const errorStart = qualifier?.end ?? index;
    const error = formulaError.exec(formula.slice(errorStart));
    if (error) {
      const end = errorStart + error[0].length;
      pieces.push(formula.slice(index, end));
      index = end;
      continue;
    }
    const whole = readWholeRange(formula, index);
    if (whole) {
      const sheetName = (whole.leftSheet ?? currentSheet.name).toLocaleLowerCase();
      const rightSheet = (
        whole.rightSheet ??
        whole.leftSheet ??
        currentSheet.name
      ).toLocaleLowerCase();
      if (sheetName !== rightSheet) unsafeReference('跨工作表的范围');
      pieces.push(sheetName === affected ? renderWholeRange(whole, edit) : whole.raw);
      index = whole.end;
      continue;
    }
    const left = readReference(formula, index);
    if (left) {
      const sheetName = (left.sheetName ?? currentSheet.name).toLocaleLowerCase();
      const separator = /^\s*:\s*/.exec(formula.slice(left.end));
      if (separator) {
        const right = readReference(formula, left.end + separator[0].length);
        if (!right) unsafeReference('非矩形 A1 范围');
        const rightSheet = (
          right.sheetName ??
          left.sheetName ??
          currentSheet.name
        ).toLocaleLowerCase();
        if (sheetName !== rightSheet) unsafeReference('跨工作表的范围');
        if (sheetName !== affected) pieces.push(formula.slice(index, right.end));
        else {
          const moved = transformInterval(
            edit.axis === 'row' ? left.row : left.col,
            edit.axis === 'row' ? right.row : right.col,
            edit
          );
          pieces.push(
            moved
              ? `${renderReference(left, edit.axis === 'row' ? moved[0] : left.row, edit.axis === 'column' ? moved[0] : left.col)}${separator[0]}${renderReference(right, edit.axis === 'row' ? moved[1] : right.row, edit.axis === 'column' ? moved[1] : right.col)}`
              : '#REF!'
          );
        }
        index = right.end;
      } else {
        const moved =
          sheetName === affected
            ? studioTransformSheetIndex(edit.axis === 'row' ? left.row : left.col, edit)
            : edit.axis === 'row'
              ? left.row
              : left.col;
        pieces.push(
          moved === undefined
            ? '#REF!'
            : renderReference(
                left,
                edit.axis === 'row' ? moved : left.row,
                edit.axis === 'column' ? moved : left.col
              )
        );
        index = left.end;
      }
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/.exec(formula.slice(index));
    if (number) {
      pieces.push(number[0]);
      index += number[0].length;
      continue;
    }
    const word = identifier.exec(formula.slice(index));
    if (word) {
      const following = formula.slice(index + word[0].length);
      const name = word[0].split('.').at(-1)?.toUpperCase();
      if (/^\s*\(/.test(following)) {
        if (name === 'INDIRECT' || name === 'OFFSET') unsafeReference('动态引用函数');
      } else if (!['TRUE', 'FALSE'].includes(word[0].toUpperCase())) {
        unsafeReference('命名区域或非 A1 引用');
      }
      pieces.push(word[0]);
      index += word[0].length;
      continue;
    }
    if (!/[\s=<>+\-*/^&%(),;{}]/.test(formula[index])) unsafeReference('三维、结构化或动态引用');
    pieces.push(formula[index++]);
  }
  return pieces.join('');
}

function rewriteSheetFormulas(
  sheet: StudioSheet,
  affectedSheet: StudioSheet,
  edit: StudioSheetStructureEdit
): StudioSheet {
  let cells: Record<string, StudioCell> | undefined;
  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (!cell.input.startsWith('=')) continue;
    const input = rewriteFormula(cell.input, sheet, affectedSheet, edit);
    if (input === cell.input) continue;
    cells ??= { ...sheet.cells };
    cells[address] = { ...cell, input };
  }
  const next = studioMapSheetRuleFormulae(sheet, (formula) =>
    rewriteFormula(formula, sheet, affectedSheet, edit)
  );
  return cells ? { ...next, cells } : next;
}

function transformMetadata(sheet: StudioSheet, edit: StudioSheetStructureEdit): StudioSheet {
  const next = {
    ...studioMapSheetRuleFormulae(sheet, (formula, rule) => {
      if (edit.type !== 'delete' || !studioTransformSheetRange(rule.range, edit)) return formula;
      const bounds = studioParseRange(rule.range)!;
      const first = edit.axis === 'row' ? bounds.firstRow : bounds.firstCol;
      if (first < edit.index || first >= edit.index + edit.count) return formula;
      // The old first cell is gone. Evaluate the retained rule from the first
      // surviving old cell before translating references into the new sheet.
      const delta = edit.index + edit.count - first;
      return studioTranslateFormula(
        formula,
        edit.axis === 'row' ? delta : 0,
        edit.axis === 'column' ? delta : 0
      );
    }),
  };
  for (const field of ['conditionalFormats', 'dataValidations'] as const) {
    const rules = next[field];
    if (!rules) continue;
    const mapped = rules.flatMap((rule) => {
      const range = studioTransformSheetRange(rule.range, edit);
      return range ? [{ ...rule, range }] : [];
    });
    if (!mapped.length) delete next[field];
    else if (field === 'conditionalFormats')
      next.conditionalFormats = mapped as NonNullable<StudioSheet['conditionalFormats']>;
    else next.dataValidations = mapped as NonNullable<StudioSheet['dataValidations']>;
  }
  if (sheet.columnWidths && edit.axis === 'column') {
    const widths: Record<string, number> = {};
    for (const [label, width] of Object.entries(sheet.columnWidths)) {
      const position = studioParseAddress(`${label}1`);
      if (!position) throw new Error('列宽地址无效。');
      const moved = studioTransformSheetIndex(position.col, edit);
      if (moved !== undefined) widths[studioColumnLabel(moved)] = width;
    }
    if (Object.keys(widths).length) next.columnWidths = widths;
    else delete next.columnWidths;
  }
  if (sheet.rowHeights && edit.axis === 'row') {
    const heights: Record<string, number> = {};
    for (const [row, height] of Object.entries(sheet.rowHeights)) {
      const moved = studioTransformSheetIndex(Number(row), edit);
      if (moved !== undefined) heights[String(moved)] = height;
    }
    next.rowHeights = heights;
  }
  if (sheet.hiddenRows && edit.axis === 'row') {
    const hidden = sheet.hiddenRows.flatMap((row) => {
      const moved = studioTransformSheetIndex(row, edit);
      return moved === undefined ? [] : [moved];
    });
    next.hiddenRows = hidden;
  }
  if (sheet.merges) {
    const merges = sheet.merges.flatMap((range) => {
      const mapped = studioTransformSheetRange(range, edit);
      const bounds = mapped && studioParseRange(mapped);
      return bounds && (bounds.firstRow !== bounds.lastRow || bounds.firstCol !== bounds.lastCol)
        ? [mapped!]
        : [];
    });
    const mergedCells = merges.reduce((total, range) => {
      const bounds = studioParseRange(range)!;
      const size = (bounds.lastRow - bounds.firstRow + 1) * (bounds.lastCol - bounds.firstCol + 1);
      if (size > STUDIO_SHEET_LIMITS.clipboardCells)
        throw new Error('结构变更后的合并区域超过 10,000 个单元格。');
      return total + size;
    }, 0);
    if (mergedCells > STUDIO_SHEET_LIMITS.storedCells)
      throw new Error('结构变更后的合并区域总量超过 100,000 个单元格。');
    if (merges.length) next.merges = merges;
    else delete next.merges;
  }
  if (sheet.freeze) {
    const key = edit.axis === 'row' ? 'rows' : 'columns';
    const frozen = sheet.freeze[key];
    const boundary = frozen ? (transformInterval(1, frozen, edit)?.[1] ?? 0) : 0;
    const dimension = edit.axis === 'row' ? sheet.rowCount : sheet.columnCount;
    const freeze = { ...sheet.freeze, [key]: Math.min(boundary, dimension - 1) };
    if (freeze.rows > 100 || freeze.columns > 20)
      throw new Error('结构变更后的冻结范围超过 100 行、20 列，请先取消冻结。');
    if (
      next.merges?.some((range) => {
        const bounds = studioParseRange(range)!;
        return (
          (bounds.firstRow <= freeze.rows && freeze.rows < bounds.lastRow) ||
          (bounds.firstCol <= freeze.columns && freeze.columns < bounds.lastCol)
        );
      })
    )
      throw new Error('结构变更后的冻结边界穿过合并单元格，请先取消冻结。');
    next.freeze = freeze;
  }
  if (sheet.filter) {
    const bounds = studioParseRange(sheet.filter.range)!;
    const headerDeleted =
      edit.axis === 'row' && studioTransformSheetIndex(bounds.firstRow, edit) === undefined;
    const range = studioTransformSheetRange(sheet.filter.range, edit);
    const moved = range && studioParseRange(range);
    if (headerDeleted || !moved || moved.firstRow === moved.lastRow) delete next.filter;
    else {
      const columns: NonNullable<StudioSheet['filter']>['columns'] = {};
      for (const [label, rule] of Object.entries(sheet.filter.columns)) {
        const position = studioParseAddress(`${label}1`)!;
        const column =
          edit.axis === 'column' ? studioTransformSheetIndex(position.col, edit) : position.col;
        if (column !== undefined) columns[studioColumnLabel(column)] = { ...rule };
      }
      next.filter = { range: range!, columns };
    }
  }
  if (sheet.charts) {
    const charts = sheet.charts.flatMap((chart) => {
      const bounds = studioParseRange(chart.range)!;
      const titleIndex = edit.axis === 'row' ? bounds.firstRow : bounds.firstCol;
      if (studioTransformSheetIndex(titleIndex, edit) === undefined) return [];
      const range = studioTransformSheetRange(chart.range, edit);
      const moved = range && studioParseRange(range);
      if (!moved || moved.firstRow === moved.lastRow || moved.firstCol === moved.lastCol) return [];
      if (moved.lastRow - moved.firstRow > 300 || moved.lastCol - moved.firstCol > 8)
        throw new Error('结构变更后的图表超过 300 个分类或 8 个系列。');
      return [{ ...chart, range: range! }];
    });
    if (charts.length) next.charts = charts;
    else delete next.charts;
  }
  return next;
}

/** Structural changes are atomic; unsupported formulas never partially move cells. */
export function studioChangeSheetStructure(
  document: StudioExcelDocument,
  sheetId: string,
  edit: StudioSheetStructureEdit
): StudioExcelDocument {
  validEdit(edit);
  if (!isOfficeStudioDocument(document)) throw new Error('工作簿模型无效，无法调整行列结构。');
  const original = document.sheets.find((sheet) => sheet.id === sheetId);
  if (!original) throw new Error('工作表不存在。');
  if ((original.structureEdits?.length ?? 0) >= STRUCTURE_LOG_LIMIT)
    throw new Error('每张工作表最多记录 500 次结构变更，请导出并重新导入后继续。');
  const dimension = edit.axis === 'row' ? original.rowCount : original.columnCount;
  const limit = edit.axis === 'row' ? STUDIO_SHEET_LIMITS.rows : STUDIO_SHEET_LIMITS.columns;
  const nextDimension = dimension + (edit.type === 'insert' ? edit.count : -edit.count);
  if (
    (edit.type === 'insert'
      ? edit.index > dimension + 1
      : edit.index + edit.count - 1 > dimension) ||
    nextDimension < 1 ||
    nextDimension > limit
  )
    throw new Error('结构变更超出工作表范围或 10,000 行、256 列限制；至少需要保留一行一列。');
  const cells: Record<string, StudioCell> = {};
  for (const [address, cell] of Object.entries(original.cells)) {
    const position = studioParseAddress(address)!;
    const moved = studioTransformSheetIndex(
      edit.axis === 'row' ? position.row : position.col,
      edit
    );
    if (moved === undefined) continue;
    cells[
      studioCellAddress(
        edit.axis === 'row' ? moved : position.row,
        edit.axis === 'column' ? moved : position.col
      )
    ] = cell;
  }
  const changed = transformMetadata(
    {
      ...original,
      cells,
      rowCount: edit.axis === 'row' ? nextDimension : original.rowCount,
      columnCount: edit.axis === 'column' ? nextDimension : original.columnCount,
      structureEdits: [...(original.structureEdits ?? []), { ...edit }],
    },
    edit
  );
  const next: StudioExcelDocument = {
    ...document,
    sheets: document.sheets.map((sheet) =>
      studioTransformSheetHyperlinks(
        rewriteSheetFormulas(sheet.id === sheetId ? changed : sheet, original, edit),
        original,
        edit
      )
    ),
  };
  if (!isOfficeStudioDocument(next))
    throw new Error('结构变更后的工作簿超过模型限制，请缩小变更范围。');
  return next;
}
