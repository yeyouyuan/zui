import { isOfficeStudioDocument } from './studio-model';
import type {
  StudioCell,
  StudioExcelDocument,
  StudioSheet,
  StudioSheetComparisonOperator,
  StudioSheetConditionalFormat,
  StudioSheetConditionalStyle,
  StudioSheetDataValidation,
} from './studio-types';

export type StudioSheetRuleValue = string | number | boolean;
export interface StudioSheetRuleResult {
  value?: StudioSheetRuleValue | (StudioSheetRuleValue | null)[][];
  error?: string;
}
interface RulePosition {
  row: number;
  col: number;
}
/** A calculation supplied by the lazy sheet module; this module never loads a parser. */
export interface StudioSheetRuleCalculation {
  read(sheetId: string, address: string): StudioSheetRuleResult;
  evaluate(
    sheetId: string,
    formula: string,
    position: RulePosition,
    origin?: RulePosition,
    allowArray?: boolean
  ): StudioSheetRuleResult;
}
export interface StudioSheetValidationResult {
  rule: StudioSheetDataValidation;
  valid: boolean;
  message: string;
  severity: 'stop' | 'warning' | 'information';
  blocking: boolean;
  options?: string[];
  sheetId: string;
  address: string;
}

const numberLiteral = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const dayMilliseconds = 86400000;

function position(address: string): RulePosition | undefined {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(address.trim());
  if (!match) return undefined;
  const col = [...match[1].toUpperCase()].reduce(
    (total, character) => total * 26 + character.charCodeAt(0) - 64,
    0
  );
  const row = Number(match[2]);
  return row <= 1048576 && col <= 16384 ? { row, col } : undefined;
}

function columnLabel(column: number): string {
  let label = '';
  for (let rest = column; rest > 0; rest = Math.floor((rest - 1) / 26))
    label = String.fromCharCode(65 + ((rest - 1) % 26)) + label;
  return label;
}

function addressAt(row: number, col: number): string {
  return `${columnLabel(col)}${row}`;
}

function rangeBounds(range: string) {
  const parts = range.trim().split(':');
  if (parts.length > 2) return undefined;
  const first = position(parts[0]);
  const last = position(parts[1] ?? parts[0]);
  if (!first || !last) return undefined;
  return {
    firstRow: Math.min(first.row, last.row),
    lastRow: Math.max(first.row, last.row),
    firstCol: Math.min(first.col, last.col),
    lastCol: Math.max(first.col, last.col),
  };
}

function normalizedRange(range: string): string {
  const bounds = rangeBounds(range);
  if (!bounds) throw new Error('规则需要有效的 A1 单元格范围。');
  return `${addressAt(bounds.firstRow, bounds.firstCol)}:${addressAt(bounds.lastRow, bounds.lastCol)}`;
}

function contains(range: string, cell: RulePosition): boolean {
  const bounds = rangeBounds(range);
  return (
    !!bounds &&
    cell.row >= bounds.firstRow &&
    cell.row <= bounds.lastRow &&
    cell.col >= bounds.firstCol &&
    cell.col <= bounds.lastCol
  );
}

function normalizeFormula(formula: string, numeric = false): string {
  const text = formula.trim();
  return numeric && numberLiteral.test(text) ? text : text.startsWith('=') ? text : `=${text}`;
}

function checkedDocument(document: StudioExcelDocument): StudioExcelDocument {
  if (!isOfficeStudioDocument(document))
    throw new Error('规则无效：请检查范围、公式、样式、候选列表及规则数量；数据验证范围不能重叠。');
  return document;
}

function replaceRules(
  document: StudioExcelDocument,
  sheetId: string,
  replacement: (sheet: StudioSheet) => StudioSheet
): StudioExcelDocument {
  if (!document.sheets.some((sheet) => sheet.id === sheetId)) throw new Error('工作表不存在。');
  return checkedDocument({
    ...document,
    sheets: document.sheets.map((sheet) => (sheet.id === sheetId ? replacement(sheet) : sheet)),
  });
}

export function studioSetConditionalFormat(
  document: StudioExcelDocument,
  sheetId: string,
  rule: StudioSheetConditionalFormat
): StudioExcelDocument {
  const normalized = { ...rule, range: normalizedRange(rule.range) };
  if (normalized.style) normalized.style = { ...normalized.style };
  if (normalized.type === 'cellIs')
    normalized.formulae = normalized.formulae.map((formula) => normalizeFormula(formula, true));
  else if (normalized.type === 'expression')
    normalized.formula = normalizeFormula(normalized.formula);
  else if (normalized.type === 'colorScale') normalized.colors = [...normalized.colors];
  return replaceRules(document, sheetId, (sheet) => {
    const rules = [...(sheet.conditionalFormats ?? [])];
    const index = rules.findIndex((item) => item.id === normalized.id);
    if (index < 0) rules.push(normalized);
    else rules[index] = normalized;
    return { ...sheet, conditionalFormats: rules };
  });
}

export function studioRemoveConditionalFormat(
  document: StudioExcelDocument,
  sheetId: string,
  ruleId: string
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (!sheet.conditionalFormats?.some((rule) => rule.id === ruleId)) return document;
  return replaceRules(document, sheetId, (item) => {
    const next = { ...item };
    next.conditionalFormats = item.conditionalFormats!.filter((rule) => rule.id !== ruleId);
    if (!next.conditionalFormats.length) delete next.conditionalFormats;
    return next;
  });
}

export function studioSetDataValidation(
  document: StudioExcelDocument,
  sheetId: string,
  rule: StudioSheetDataValidation
): StudioExcelDocument {
  const normalized = { ...rule, range: normalizedRange(rule.range) };
  if (normalized.type === 'list') {
    if (normalized.values) normalized.values = [...normalized.values];
    if (normalized.source !== undefined) normalized.source = normalizeFormula(normalized.source);
  } else if (normalized.type === 'custom')
    normalized.formula = normalizeFormula(normalized.formula);
  else {
    normalized.formula1 = normalizeFormula(normalized.formula1, true);
    if (normalized.formula2 !== undefined)
      normalized.formula2 = normalizeFormula(normalized.formula2, true);
  }
  return replaceRules(document, sheetId, (sheet) => {
    const rules = [...(sheet.dataValidations ?? [])];
    const index = rules.findIndex((item) => item.id === normalized.id);
    if (index < 0) rules.push(normalized);
    else rules[index] = normalized;
    return { ...sheet, dataValidations: rules };
  });
}

export function studioRemoveDataValidation(
  document: StudioExcelDocument,
  sheetId: string,
  ruleId: string
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (!sheet.dataValidations?.some((rule) => rule.id === ruleId)) return document;
  return replaceRules(document, sheetId, (item) => {
    const next = { ...item };
    next.dataValidations = item.dataValidations!.filter((rule) => rule.id !== ruleId);
    if (!next.dataValidations.length) delete next.dataValidations;
    return next;
  });
}

/** The caller supplies the same safe rewrite used for cell formulas. */
export function studioMapSheetRuleFormulae(
  sheet: StudioSheet,
  rewrite: (
    formula: string,
    rule: StudioSheetConditionalFormat | StudioSheetDataValidation
  ) => string
): StudioSheet {
  let changed = false;
  const map = (
    formula: string,
    rule: StudioSheetConditionalFormat | StudioSheetDataValidation,
    numeric = false
  ) => {
    if (numeric && numberLiteral.test(formula)) return formula;
    const next = rewrite(normalizeFormula(formula), rule);
    changed ||= next !== formula;
    return next;
  };
  const conditionalFormats = sheet.conditionalFormats?.map((rule) => {
    if (rule.type === 'expression') return { ...rule, formula: map(rule.formula, rule) };
    if (rule.type === 'cellIs')
      return { ...rule, formulae: rule.formulae.map((value) => map(value, rule, true)) };
    return rule;
  });
  const dataValidations = sheet.dataValidations?.map((rule) => {
    if (rule.type === 'list')
      return rule.source === undefined ? rule : { ...rule, source: map(rule.source, rule) };
    if (rule.type === 'custom') return { ...rule, formula: map(rule.formula, rule) };
    return {
      ...rule,
      formula1: map(rule.formula1, rule, true),
      ...(rule.formula2 === undefined ? {} : { formula2: map(rule.formula2, rule, true) }),
    };
  });
  return changed
    ? {
        ...sheet,
        ...(conditionalFormats ? { conditionalFormats } : {}),
        ...(dataValidations ? { dataValidations } : {}),
      }
    : sheet;
}

export function studioSheetRuleFormulae(sheet: StudioSheet): string[] {
  const formulae: string[] = [];
  studioMapSheetRuleFormulae(sheet, (formula) => {
    formulae.push(formula);
    return formula;
  });
  return formulae;
}

function scalar(result: StudioSheetRuleResult): StudioSheetRuleValue | undefined {
  return result.error || Array.isArray(result.value) ? undefined : result.value;
}

function formulaAt(
  sheet: StudioSheet,
  range: string,
  formula: string,
  cell: RulePosition,
  calculation: StudioSheetRuleCalculation
): StudioSheetRuleValue | undefined {
  if (numberLiteral.test(formula)) return Number(formula);
  const bounds = rangeBounds(range);
  if (!bounds) return undefined;
  return scalar(
    calculation.evaluate(sheet.id, normalizeFormula(formula), cell, {
      row: bounds.firstRow,
      col: bounds.firstCol,
    })
  );
}

function compare(
  value: StudioSheetRuleValue,
  operator: StudioSheetComparisonOperator,
  first: StudioSheetRuleValue,
  second?: StudioSheetRuleValue
): boolean {
  const equal = (left: StudioSheetRuleValue, right: StudioSheetRuleValue) =>
    typeof left === typeof right &&
    (typeof left === 'string'
      ? left.toLocaleLowerCase() === String(right).toLocaleLowerCase()
      : left === right);
  if (operator === 'equal') return equal(value, first);
  if (operator === 'notEqual') return !equal(value, first);
  if (typeof value !== 'number' || typeof first !== 'number') return false;
  switch (operator) {
    case 'greaterThan':
      return value > first;
    case 'greaterThanOrEqual':
      return value >= first;
    case 'lessThan':
      return value < first;
    case 'lessThanOrEqual':
      return value <= first;
    case 'between':
      return typeof second === 'number' && value >= first && value <= second;
    case 'notBetween':
      return typeof second === 'number' && (value < first || value > second);
  }
}

function truthy(value: StudioSheetRuleValue | undefined): boolean {
  return value === true || (typeof value === 'number' && value !== 0);
}

interface RangeStatistics {
  numbers: number[];
  mean: number;
  duplicates: Map<string, number>;
}
const statisticsCache = new WeakMap<
  StudioSheetRuleCalculation,
  WeakMap<StudioSheet, Map<string, RangeStatistics>>
>();

function valueKey(value: StudioSheetRuleValue): string {
  return `${typeof value}:${typeof value === 'string' ? value.toLocaleLowerCase() : value}`;
}

function statistics(
  sheet: StudioSheet,
  range: string,
  calculation: StudioSheetRuleCalculation
): RangeStatistics {
  let sheetCache = statisticsCache.get(calculation);
  if (!sheetCache) {
    sheetCache = new WeakMap();
    statisticsCache.set(calculation, sheetCache);
  }
  let rangeCache = sheetCache.get(sheet);
  if (!rangeCache) {
    rangeCache = new Map();
    sheetCache.set(sheet, rangeCache);
  }
  const cached = rangeCache.get(range);
  if (cached) return cached;
  const result: RangeStatistics = { numbers: [], mean: 0, duplicates: new Map() };
  const bounds = rangeBounds(range);
  if (bounds)
    for (let row = bounds.firstRow; row <= bounds.lastRow; row++)
      for (let col = bounds.firstCol; col <= bounds.lastCol; col++) {
        const value = scalar(calculation.read(sheet.id, addressAt(row, col)));
        if (value === undefined || value === '') continue;
        const key = valueKey(value);
        result.duplicates.set(key, (result.duplicates.get(key) ?? 0) + 1);
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        result.numbers.push(value);
        const count = result.numbers.length;
        result.mean = result.mean * ((count - 1) / count) + value / count;
      }
  result.numbers.sort((left, right) => left - right);
  rangeCache.set(range, result);
  return result;
}

function gradientColor(first: string, last: string, ratio: number): string {
  const weight = Math.max(0, Math.min(1, ratio));
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      parseInt(first.slice(offset, offset + 2), 16) * (1 - weight) +
        parseInt(last.slice(offset, offset + 2), 16) * weight
    )
      .toString(16)
      .padStart(2, '0')
  );
  return `#${channels.join('')}`;
}

function scaleRatio(value: number, first: number, last: number): number {
  const difference = last - first;
  return Number.isFinite(difference)
    ? (value - first) / difference
    : (value / 2 - first / 2) / (last / 2 - first / 2);
}

/** Derived formatting never writes conditional styles into the direct cell model. */
export function studioConditionalCellStyle(
  sheet: StudioSheet,
  address: string,
  calculation: StudioSheetRuleCalculation
): StudioSheetConditionalStyle {
  const cell = position(address);
  if (!cell || !sheet.conditionalFormats?.length) return {};
  const value = scalar(calculation.read(sheet.id, addressAt(cell.row, cell.col)));
  const resolved: StudioSheetConditionalStyle = {};
  const rules = [...sheet.conditionalFormats].sort((left, right) => left.priority - right.priority);
  for (const rule of rules) {
    if (!contains(rule.range, cell)) continue;
    let matched = false;
    let style = rule.style;
    switch (rule.type) {
      case 'expression':
        matched = truthy(formulaAt(sheet, rule.range, rule.formula, cell, calculation));
        break;
      case 'cellIs': {
        if (value === undefined || value === '') break;
        const first = formulaAt(sheet, rule.range, rule.formulae[0], cell, calculation);
        const second =
          rule.formulae[1] === undefined
            ? undefined
            : formulaAt(sheet, rule.range, rule.formulae[1], cell, calculation);
        matched = first !== undefined && compare(value, rule.operator, first, second);
        break;
      }
      case 'containsText':
        matched =
          value !== undefined &&
          String(value).toLocaleLowerCase().includes(rule.text.toLocaleLowerCase());
        break;
      case 'duplicateValues':
      case 'uniqueValues': {
        if (value === undefined || value === '') break;
        const count =
          statistics(sheet, rule.range, calculation).duplicates.get(valueKey(value)) ?? 0;
        matched = rule.type === 'duplicateValues' ? count > 1 : count === 1;
        break;
      }
      case 'aboveAverage':
        if (typeof value === 'number') {
          const data = statistics(sheet, rule.range, calculation);
          matched =
            data.numbers.length > 0 &&
            (rule.aboveAverage === false ? value < data.mean : value > data.mean);
        }
        break;
      case 'top10': {
        if (typeof value !== 'number') break;
        const numbers = statistics(sheet, rule.range, calculation).numbers;
        const count = Math.min(
          numbers.length,
          rule.percent ? Math.ceil((numbers.length * rule.rank) / 100) : rule.rank
        );
        if (!count) break;
        const threshold = numbers[rule.bottom ? count - 1 : numbers.length - count];
        matched = rule.bottom ? value <= threshold : value >= threshold;
        break;
      }
      case 'colorScale': {
        if (typeof value !== 'number') break;
        const numbers = statistics(sheet, rule.range, calculation).numbers;
        if (!numbers.length) break;
        const first = numbers[0];
        const last = numbers[numbers.length - 1];
        let background = rule.colors[0];
        if (value > first && last > first) {
          if (rule.colors.length === 2)
            background = gradientColor(
              rule.colors[0],
              rule.colors[1],
              scaleRatio(value, first, last)
            );
          else {
            const middle =
              numbers.length % 2
                ? numbers[Math.floor(numbers.length / 2)]
                : numbers[numbers.length / 2 - 1] / 2 + numbers[numbers.length / 2] / 2;
            background =
              value <= middle && middle > first
                ? gradientColor(rule.colors[0], rule.colors[1], scaleRatio(value, first, middle))
                : gradientColor(
                    rule.colors[1],
                    rule.colors[2],
                    middle < last ? scaleRatio(value, middle, last) : 1
                  );
          }
        }
        matched = true;
        style = { background };
        break;
      }
    }
    if (!matched) continue;
    if (style)
      for (const key of Object.keys(style) as (keyof StudioSheetConditionalStyle)[])
        if (style[key] !== undefined && resolved[key] === undefined)
          Object.assign(resolved, { [key]: style[key] });
    if (rule.stopIfTrue) break;
  }
  return resolved;
}

function validationRule(
  sheet: StudioSheet,
  address: string
): StudioSheetDataValidation | undefined {
  const cell = position(address);
  return cell && sheet.dataValidations?.find((rule) => contains(rule.range, cell));
}

type ListValidation = Extract<StudioSheetDataValidation, { type: 'list' }>;
interface ListValues {
  values: string[];
  error?: string;
}
const validationListCache = new WeakMap<
  StudioSheetRuleCalculation,
  WeakMap<StudioSheet, WeakMap<ListValidation, ListValues>>
>();

function listValues(
  sheet: StudioSheet,
  address: string,
  rule: ListValidation,
  calculation: StudioSheetRuleCalculation
): ListValues {
  const cached = validationListCache.get(calculation)?.get(sheet)?.get(rule);
  if (cached) return { ...cached, values: [...cached.values] };
  // Fixed list sources repeat across every visible validation cell. Relative
  // sources depend on the destination and are evaluated without a growing cache.
  const cacheable =
    rule.values !== undefined ||
    rule.source === '=#REF!' ||
    /^=(?:(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?\$[A-Z]{1,3}\$[1-9]\d*(?::\$[A-Z]{1,3}\$[1-9]\d*)?$/iu.test(
      rule.source ?? ''
    );
  const finish = (result: ListValues): ListValues => {
    if (cacheable) {
      let sheetCache = validationListCache.get(calculation);
      if (!sheetCache) {
        sheetCache = new WeakMap();
        validationListCache.set(calculation, sheetCache);
      }
      let ruleCache = sheetCache.get(sheet);
      if (!ruleCache) {
        ruleCache = new WeakMap();
        sheetCache.set(sheet, ruleCache);
      }
      ruleCache.set(rule, result);
    }
    return { ...result, values: [...result.values] };
  };
  if (rule.values) return finish({ values: [...new Set(rule.values)] });
  const cell = position(address)!;
  const bounds = rangeBounds(rule.range)!;
  const result = calculation.evaluate(
    sheet.id,
    normalizeFormula(rule.source ?? '#REF!'),
    cell,
    { row: bounds.firstRow, col: bounds.firstCol },
    true
  );
  if (result.error) return finish({ values: [], error: result.error });
  const candidates = Array.isArray(result.value) ? result.value.flat() : [result.value];
  if (candidates.length > 1000) return finish({ values: [], error: '#LIMIT!' });
  const values = candidates
    .filter(
      (value): value is StudioSheetRuleValue =>
        value !== null && value !== undefined && value !== ''
    )
    .map((value) => (typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value)));
  return finish({ values: [...new Set(values)] });
}

export function studioValidationListValues(
  sheet: StudioSheet,
  address: string,
  calculation: StudioSheetRuleCalculation
): string[] {
  const rule = validationRule(sheet, address);
  return rule?.type === 'list' ? listValues(sheet, address, rule, calculation).values : [];
}

export function studioCellValidation(
  sheet: StudioSheet,
  address: string,
  calculation: StudioSheetRuleCalculation
): StudioSheetValidationResult | undefined {
  const rule = validationRule(sheet, address);
  const cell = position(address);
  if (!rule || !cell) return undefined;
  const result = calculation.read(sheet.id, addressAt(cell.row, cell.col));
  const value = scalar(result);
  let valid = false;
  let options: string[] | undefined;
  if (rule.type === 'list') {
    const list = listValues(sheet, address, rule, calculation);
    options = list.values;
    const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value ?? '');
    valid =
      !result.error &&
      !list.error &&
      options.some((option) => option.toLocaleLowerCase() === text.toLocaleLowerCase());
  } else if (rule.type === 'custom')
    valid = truthy(formulaAt(sheet, rule.range, rule.formula, cell, calculation));
  else if (value !== undefined && !result.error && value !== '') {
    let candidate: StudioSheetRuleValue = value;
    if (rule.type === 'textLength') candidate = String(value).length;
    const first = formulaAt(sheet, rule.range, rule.formula1, cell, calculation);
    const second =
      rule.formula2 === undefined
        ? undefined
        : formulaAt(sheet, rule.range, rule.formula2, cell, calculation);
    valid =
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      (rule.type !== 'whole' || Number.isInteger(candidate)) &&
      (rule.type !== 'date' || (candidate >= 0 && candidate <= 2958465)) &&
      (rule.type !== 'time' || (candidate >= 0 && candidate < 1)) &&
      typeof first === 'number' &&
      compare(candidate, rule.operator, first, second);
  }
  if (value === '' && !result.error && rule.allowBlank === true) valid = true;
  const severity = rule.errorStyle ?? 'stop';
  return {
    rule,
    valid,
    message: valid ? '' : rule.errorMessage || '输入不符合该单元格的数据验证规则。',
    severity,
    blocking: !valid && severity === 'stop' && rule.showErrorMessage !== false,
    ...(options ? { options } : {}),
    sheetId: sheet.id,
    address: addressAt(cell.row, cell.col),
  };
}

/** ISO input is converted only for a date/time validation; identifiers stay text. */
export function studioNormalizeValidationInput(
  sheet: StudioSheet,
  address: string,
  cell: StudioCell
): StudioCell {
  const rule = validationRule(sheet, address);
  if (
    !rule ||
    cell.input.startsWith('=') ||
    cell.input.startsWith("'") ||
    cell.numberFormat === '@'
  )
    return cell;
  if (rule.type === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cell.input);
    if (!match) return cell;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    if (
      year < 1900 ||
      year > 9999 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      return cell;
    let serial = (date.getTime() - Date.UTC(1899, 11, 31)) / dayMilliseconds;
    if (serial >= 60) serial++;
    return {
      ...cell,
      input: String(serial),
      numberFormat:
        !cell.numberFormat || cell.numberFormat === 'General' ? 'yyyy-mm-dd' : cell.numberFormat,
    };
  }
  if (rule.type === 'time') {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(cell.input);
    if (!match) return cell;
    const serial =
      (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0)) / 86400;
    return {
      ...cell,
      input: String(serial),
      numberFormat:
        !cell.numberFormat || cell.numberFormat === 'General'
          ? match[3]
            ? 'hh:mm:ss'
            : 'hh:mm'
          : cell.numberFormat,
    };
  }
  return cell;
}
