import { describe, expect, it, vi } from 'vitest';
import { isOfficeStudioDocument } from './studio-model';
import {
  studioCalculate,
  studioDeleteSheet,
  studioDisplayCell,
  studioPasteCells,
  studioPatchCells,
  studioRenameSheet,
  studioSortRange,
} from './studio-sheet-model';
import {
  studioCellValidation,
  studioConditionalCellStyle,
  studioMapSheetRuleFormulae,
  studioRemoveConditionalFormat,
  studioRemoveDataValidation,
  studioSetConditionalFormat,
  studioSetDataValidation,
  studioValidationListValues,
} from './studio-sheet-rules';
import type {
  StudioExcelDocument,
  StudioSheetComparisonOperator,
  StudioSheetConditionalFormat,
  StudioSheetDataValidation,
} from './studio-types';

function fixture(): StudioExcelDocument {
  return {
    version: 1,
    kind: 'excel',
    id: 'rules',
    name: '规则.xlsx',
    activeSheetId: 'main',
    sheets: [
      { id: 'main', name: '数据', rowCount: 1000, columnCount: 26, cells: {} },
      {
        id: 'limits',
        name: "限额 O'Brien",
        rowCount: 1000,
        columnCount: 26,
        cells: { A1: { input: '5' }, A2: { input: '10' }, A3: { input: '20' } },
      },
    ],
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

const numericRule = (
  overrides: Partial<
    Extract<
      StudioSheetDataValidation,
      { type: 'whole' | 'decimal' | 'date' | 'time' | 'textLength' }
    >
  > = {}
): StudioSheetDataValidation => ({
  id: 'numeric',
  range: 'A1:A5',
  type: 'whole',
  operator: 'between',
  formula1: '1',
  formula2: '10',
  ...overrides,
});

describe('Office Studio sheet rule CRUD', () => {
  it('normalizes ranges/formulas, replaces IDs, and detaches caller styles and thresholds', () => {
    const original = freeze(fixture());
    const rule: StudioSheetConditionalFormat = {
      id: 'cf',
      range: '$B$3:a1',
      type: 'cellIs',
      operator: 'greaterThan',
      formulae: [' A1 '],
      priority: 1,
      style: { bold: true, background: '#ff0000' },
    };
    const next = studioSetConditionalFormat(original, 'main', rule);
    rule.formulae[0] = '999';
    rule.style!.bold = false;
    expect(next.sheets[0].conditionalFormats).toEqual([
      {
        ...rule,
        range: 'A1:B3',
        formulae: ['=A1'],
        style: { bold: true, background: '#ff0000' },
      },
    ]);
    const replaced = studioSetConditionalFormat(next, 'main', {
      id: 'cf',
      range: 'A1',
      type: 'expression',
      formula: 'A1>5',
      priority: 3,
      style: { italic: true },
    });
    expect(replaced.sheets[0].conditionalFormats).toHaveLength(1);
    expect(replaced.sheets[0].conditionalFormats![0]).toMatchObject({
      range: 'A1:A1',
      formula: '=A1>5',
    });
    expect(original.sheets[0].conditionalFormats).toBeUndefined();
    expect(next.sheets[1]).toBe(original.sheets[1]);
    expect(isOfficeStudioDocument(JSON.parse(JSON.stringify(replaced)))).toBe(true);
  });

  it('adds validation without discarding existing invalid data and removes empty rule metadata', () => {
    const original = fixture();
    original.sheets[0].cells.A1 = { input: '99' };
    const next = studioSetDataValidation(freeze(original), 'main', numericRule());
    expect(next.sheets[0].cells.A1.input).toBe('99');
    expect(studioCellValidation(next.sheets[0], 'A1', studioCalculate(next))).toMatchObject({
      valid: false,
      blocking: true,
      severity: 'stop',
    });
    const removed = studioRemoveDataValidation(next, 'main', 'numeric');
    expect(removed.sheets[0].dataValidations).toBeUndefined();
    expect(studioRemoveDataValidation(removed, 'main', 'numeric')).toBe(removed);
    const cf = studioSetConditionalFormat(removed, 'main', {
      id: 'color',
      range: 'A1',
      type: 'colorScale',
      colors: ['#ff0000', '#00ff00'],
      priority: 1,
    });
    expect(
      studioRemoveConditionalFormat(cf, 'main', 'color').sheets[0].conditionalFormats
    ).toBeUndefined();
    expect(() => studioRemoveConditionalFormat(cf, 'missing', 'color')).toThrow('不存在');
  });

  it('rejects overlapping validations and native-unrepresentable lists atomically', () => {
    const original = studioSetDataValidation(fixture(), 'main', numericRule());
    expect(() =>
      studioSetDataValidation(original, 'main', { ...numericRule(), id: 'overlap', range: 'A3:B6' })
    ).toThrow('重叠');
    for (const values of [['a,b'], ['a"b'], ['a\nb'], ['x'.repeat(256)]])
      expect(() =>
        studioSetDataValidation(original, 'main', { id: 'list', range: 'B1', type: 'list', values })
      ).toThrow('规则无效');
    expect(() =>
      studioSetDataValidation(original, 'main', {
        id: 'source',
        range: 'B1',
        type: 'list',
        source: 'A1:A1001',
      })
    ).toThrow('规则无效');
    expect(original.sheets[0].dataValidations).toHaveLength(1);
  });

  it('enforces per-kind rule and coverage budgets before changing any cells', () => {
    let document = fixture();
    for (let index = 0; index < 100; index++)
      document = studioSetConditionalFormat(document, 'main', {
        id: 'cf-' + index,
        range: 'A1',
        priority: index + 1,
        type: 'containsText',
        text: 'x',
      });
    expect(() =>
      studioSetConditionalFormat(document, 'main', {
        id: 'overflow',
        range: 'A1',
        priority: 101,
        type: 'containsText',
        text: 'x',
      })
    ).toThrow('规则无效');
    let covered = fixture();
    covered = studioSetConditionalFormat(covered, 'main', {
      id: 'first',
      range: 'A1:Z1000',
      priority: 1,
      type: 'aboveAverage',
    });
    covered = studioSetConditionalFormat(covered, 'main', {
      id: 'second',
      range: 'A1:Z1000',
      priority: 2,
      type: 'aboveAverage',
    });
    covered = studioSetConditionalFormat(covered, 'main', {
      id: 'third',
      range: 'A1:Z1000',
      priority: 3,
      type: 'aboveAverage',
    });
    expect(() =>
      studioSetConditionalFormat(covered, 'main', {
        id: 'fourth',
        range: 'A1:Z1000',
        priority: 4,
        type: 'aboveAverage',
      })
    ).toThrow('规则无效');
  });
});

describe('Office Studio conditional formatting evaluation', () => {
  it.each([
    ['equal', ['5'], true],
    ['notEqual', ['5'], false],
    ['greaterThan', ['4'], true],
    ['greaterThanOrEqual', ['5'], true],
    ['lessThan', ['6'], true],
    ['lessThanOrEqual', ['5'], true],
    ['between', ['5', '10'], true],
    ['notBetween', ['6', '10'], true],
  ] as [StudioSheetComparisonOperator, string[], boolean][])(
    'evaluates %s with calculated scalar values',
    (operator, formulae, matched) => {
      const original = fixture();
      original.sheets[0].cells.A1 = { input: '=2+3', color: '#000000' };
      const document = studioSetConditionalFormat(original, 'main', {
        id: 'numeric',
        range: 'A1',
        type: 'cellIs',
        operator,
        formulae,
        priority: 1,
        style: { bold: true },
      });
      expect(
        studioConditionalCellStyle(document.sheets[0], 'A1', studioCalculate(document))
      ).toEqual(matched ? { bold: true } : {});
      expect(document.sheets[0].cells.A1).toEqual(original.sheets[0].cells.A1);
    }
  );

  it('uses each rule top-left as the relative origin, preserves dollars, and supplies ROW/COLUMN position', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '5' },
      B2: { input: '10' },
      C2: { input: '20' },
      B3: { input: '3' },
      C3: { input: '30' },
    };
    const document = studioSetConditionalFormat(original, 'main', {
      id: 'relative',
      range: 'B2:C3',
      type: 'expression',
      formula: '=AND(B2>$A$1,ROW()>=2,COLUMN()>=2)',
      priority: 1,
      style: { background: '#00ff00' },
    });
    const calculation = studioCalculate(document);
    expect(studioConditionalCellStyle(document.sheets[0], 'B2', calculation)).toEqual({
      background: '#00ff00',
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'B3', calculation)).toEqual({});
    expect(studioConditionalCellStyle(document.sheets[0], 'C3', calculation)).toEqual({
      background: '#00ff00',
    });
    expect(calculation.read('main', '$c$3')).toEqual({ value: 30 });
  });

  it('evaluates relative thresholds and escaped cross-sheet references without changing formula strings', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A2: { input: '5' },
      A3: { input: '20' },
      B2: { input: '10' },
      B3: { input: '10' },
    };
    let document = studioSetConditionalFormat(original, 'main', {
      id: 'relative',
      range: 'B2:B3',
      type: 'cellIs',
      operator: 'greaterThan',
      formulae: ['=A2'],
      priority: 1,
      style: { bold: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'external',
      range: 'B2:B3',
      type: 'expression',
      formula: "=AND(B2>'限额 O''Brien'!$A$1,LEN(\"B2\")=2)",
      priority: 2,
      style: { italic: true },
    });
    const calculation = studioCalculate(document);
    expect(studioConditionalCellStyle(document.sheets[0], 'B2', calculation)).toEqual({
      bold: true,
      italic: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'B3', calculation)).toEqual({
      italic: true,
    });
  });

  it('matches case-insensitive text, duplicates and unique values while ignoring blanks and errors', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: 'Alpha' },
      A2: { input: 'ALPHA' },
      A3: { input: 'Beta' },
      A4: { input: '' },
      A5: { input: '=1/0' },
    };
    let document = studioSetConditionalFormat(original, 'main', {
      id: 'duplicates',
      range: 'A1:A5',
      type: 'duplicateValues',
      priority: 1,
      style: { bold: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'unique',
      range: 'A1:A5',
      type: 'uniqueValues',
      priority: 2,
      style: { italic: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'contains',
      range: 'A1:A5',
      type: 'containsText',
      text: 'PH',
      priority: 3,
      style: { underline: true },
    });
    const calculation = studioCalculate(document);
    expect(studioConditionalCellStyle(document.sheets[0], 'A1', calculation)).toEqual({
      bold: true,
      underline: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A3', calculation)).toEqual({
      italic: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A4', calculation)).toEqual({});
    expect(studioConditionalCellStyle(document.sheets[0], 'A5', calculation)).toEqual({});
  });

  it('includes rank cutoff ties, percentages and above/below averages of numeric data', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '1' },
      A2: { input: '2' },
      A3: { input: '5' },
      A4: { input: '=2+3' },
      A5: { input: 'text' },
    };
    let document = studioSetConditionalFormat(original, 'main', {
      id: 'top',
      range: 'A1:A5',
      type: 'top10',
      rank: 1,
      priority: 1,
      style: { bold: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'bottom',
      range: 'A1:A5',
      type: 'top10',
      rank: 50,
      percent: true,
      bottom: true,
      priority: 2,
      style: { italic: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'above',
      range: 'A1:A5',
      type: 'aboveAverage',
      priority: 3,
      style: { underline: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'below',
      range: 'A1:A5',
      type: 'aboveAverage',
      aboveAverage: false,
      priority: 4,
      style: { color: '#ff0000' },
    });
    const calculation = studioCalculate(document);
    expect(studioConditionalCellStyle(document.sheets[0], 'A3', calculation)).toEqual({
      bold: true,
      underline: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A4', calculation)).toEqual({
      bold: true,
      underline: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A1', calculation)).toEqual({
      italic: true,
      color: '#ff0000',
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A5', calculation)).toEqual({});
  });

  it('interpolates two/three-color min, percentile50 and max without mutating direct styles', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '0' },
      A2: { input: '50', background: '#0000ff' },
      A3: { input: '100' },
    };
    const two = studioSetConditionalFormat(freeze(original), 'main', {
      id: 'scale',
      range: 'A1:A3',
      type: 'colorScale',
      colors: ['#ff0000', '#00ff00'],
      priority: 1,
    });
    const calculation = studioCalculate(two);
    expect(studioConditionalCellStyle(two.sheets[0], 'A1', calculation)).toEqual({
      background: '#ff0000',
    });
    expect(studioConditionalCellStyle(two.sheets[0], 'A2', calculation)).toEqual({
      background: '#808000',
    });
    expect(studioConditionalCellStyle(two.sheets[0], 'A3', calculation)).toEqual({
      background: '#00ff00',
    });
    const three = studioSetConditionalFormat(two, 'main', {
      id: 'scale',
      range: 'A1:A3',
      type: 'colorScale',
      colors: ['#ff0000', '#ffff00', '#00ff00'],
      priority: 1,
    });
    expect(studioConditionalCellStyle(three.sheets[0], 'A2', studioCalculate(three))).toEqual({
      background: '#ffff00',
    });
    expect(original.sheets[0].cells.A2.background).toBe('#0000ff');
  });

  it('resolves each style field by priority and honors stopIfTrue even with an empty style', () => {
    let document = fixture();
    document.sheets[0].cells.A1 = { input: '10', bold: true };
    document = studioSetConditionalFormat(document, 'main', {
      id: 'first',
      range: 'A1',
      type: 'expression',
      formula: '=TRUE',
      priority: 1,
      style: { bold: false, background: '#ff0000' },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'second',
      range: 'A1',
      type: 'expression',
      formula: '=TRUE',
      priority: 2,
      style: { bold: true, background: '#00ff00', color: '#ffffff' },
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A1', studioCalculate(document))).toEqual(
      { bold: false, background: '#ff0000', color: '#ffffff' }
    );
    document = studioSetConditionalFormat(document, 'main', {
      id: 'first',
      range: 'A1',
      type: 'expression',
      formula: '=TRUE',
      priority: 1,
      stopIfTrue: true,
    });
    expect(studioConditionalCellStyle(document.sheets[0], 'A1', studioCalculate(document))).toEqual(
      {}
    );
  });

  it('keeps rule errors separate from cell calculation errors and refreshes aggregate caches after edits', () => {
    let document = fixture();
    document.sheets[0].cells = { A1: { input: '1' }, A2: { input: '2' }, B1: { input: '=A1+A2' } };
    document = studioSetConditionalFormat(document, 'main', {
      id: 'error',
      range: 'B1',
      type: 'expression',
      formula: '=1/0',
      priority: 1,
      style: { bold: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'rank',
      range: 'A1:A2',
      type: 'top10',
      rank: 1,
      priority: 2,
      style: { bold: true },
    });
    const before = studioCalculate(document);
    expect(studioConditionalCellStyle(document.sheets[0], 'B1', before)).toEqual({});
    expect(before.values.get('main:B1')).toBe(3);
    expect(before.errors.has('main:B1')).toBe(false);
    expect(studioConditionalCellStyle(document.sheets[0], 'A2', before)).toEqual({ bold: true });
    const after = studioPatchCells(document, 'main', { A1: { input: '5' } });
    const calculation = studioCalculate(after);
    expect(studioConditionalCellStyle(after.sheets[0], 'A1', calculation)).toEqual({ bold: true });
    expect(studioConditionalCellStyle(after.sheets[0], 'A2', calculation)).toEqual({});
    expect(before.values.get('main:B1')).toBe(3);
  });

  it('uses finite gradient and average calculations for extreme finite numbers', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '-1e308' },
      A2: { input: '0' },
      A3: { input: '1e308' },
    };
    const next = studioSetConditionalFormat(document, 'main', {
      id: 'scale',
      range: 'A1:A3',
      type: 'colorScale',
      colors: ['#ff0000', '#00ff00'],
      priority: 1,
    });
    expect(studioConditionalCellStyle(next.sheets[0], 'A2', studioCalculate(next))).toEqual({
      background: '#808000',
    });
  });
});

describe('Office Studio data validation evaluation and transactions', () => {
  it.each([
    ['whole', '5', true],
    ['whole', '5.5', false],
    ['decimal', '5.5', true],
    ['decimal', "'5", false],
    ['date', '5', true],
    ['date', '-1', false],
    ['time', '0.5', true],
    ['time', '1', false],
    ['textLength', 'hello', true],
    ['textLength', 'longer text', false],
  ] as [
    Extract<
      StudioSheetDataValidation,
      { type: 'whole' | 'decimal' | 'date' | 'time' | 'textLength' }
    >['type'],
    string,
    boolean,
  ][])('checks %s input %s against typed calculated values', (type, input, valid) => {
    const original = fixture();
    original.sheets[0].cells.A1 = { input };
    const rule = numericRule({
      type,
      formula1: type === 'time' ? '0' : '1',
      formula2: type === 'time' ? '0.9' : '10',
    });
    const next = studioSetDataValidation(original, 'main', rule);
    expect(studioCellValidation(next.sheets[0], 'A1', studioCalculate(next))?.valid).toBe(valid);
    expect(studioCellValidation(next.sheets[0], 'B1', studioCalculate(next))).toBeUndefined();
  });

  it('checks inline/source lists without coercing identifiers and returns all deduplicated choices', () => {
    let document = fixture();
    document.sheets[0].cells = { A1: { input: 'YES' }, B1: { input: '001' }, C1: { input: '10' } };
    document = studioSetDataValidation(document, 'main', {
      id: 'literal',
      range: 'A1',
      type: 'list',
      values: ['yes', 'yes', 'no'],
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'identifier',
      range: 'B1',
      type: 'list',
      values: ['001', '002'],
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'C1',
      type: 'list',
      source: "='限额 O''Brien'!$A$1:$A$3",
    });
    const calculation = studioCalculate(document);
    expect(studioCellValidation(document.sheets[0], 'A1', calculation)).toMatchObject({
      valid: true,
      options: ['yes', 'no'],
    });
    expect(studioCellValidation(document.sheets[0], 'B1', calculation)?.valid).toBe(true);
    expect(studioValidationListValues(document.sheets[0], 'C1', calculation)).toEqual([
      '5',
      '10',
      '20',
    ]);
    expect(studioCellValidation(document.sheets[0], 'C1', calculation)?.valid).toBe(true);
    expect(calculation.read('main', 'C1')).toEqual({ value: 10 });
  });

  it('reads source list formulas and shifts relative single-row/column sources from the validation origin', () => {
    let document = fixture();
    document.sheets[0].cells = {
      A1: { input: 'one' },
      A2: { input: '=IF(A1="one","two","")' },
      A3: { input: 'three' },
      B2: { input: 'one' },
      B3: { input: 'one' },
    };
    document = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'B2:B3',
      type: 'list',
      source: '=A1:A2',
    });
    const calculation = studioCalculate(document);
    expect(studioCellValidation(document.sheets[0], 'B2', calculation)).toMatchObject({
      valid: true,
      options: ['one', 'two'],
    });
    expect(studioCellValidation(document.sheets[0], 'B3', calculation)).toMatchObject({
      valid: false,
      options: ['two', 'three'],
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'B2:B3',
      type: 'list',
      source: '=$A$1:$A$3',
    });
    expect(studioCellValidation(document.sheets[0], 'B3', studioCalculate(document))?.valid).toBe(
      true
    );
  });

  it('allows blanks explicitly and keeps stop/warning/information/showErrorMessage policies distinct', () => {
    for (const [errorStyle, showErrorMessage, blocking] of [
      ['stop', undefined, true],
      ['warning', undefined, false],
      ['information', undefined, false],
      ['stop', false, false],
    ] as ['stop' | 'warning' | 'information', boolean | undefined, boolean][]) {
      const document = studioSetDataValidation(fixture(), 'main', {
        ...numericRule(),
        errorStyle,
        showErrorMessage,
        errorMessage: '请输入 1 至 10。',
      });
      expect(
        studioCellValidation(document.sheets[0], 'A1', studioCalculate(document))
      ).toMatchObject({
        valid: false,
        blocking,
        severity: errorStyle,
        message: '请输入 1 至 10。',
      });
      if (blocking)
        expect(() => studioPatchCells(document, 'main', { A1: { input: '99' } })).toThrow(
          '请输入 1 至 10'
        );
      else
        expect(
          studioPatchCells(document, 'main', { A1: { input: '99' } }).sheets[0].cells.A1.input
        ).toBe('99');
    }
    const blanks = studioSetDataValidation(fixture(), 'main', {
      ...numericRule(),
      allowBlank: true,
    });
    expect(studioCellValidation(blanks.sheets[0], 'A1', studioCalculate(blanks))?.valid).toBe(true);
  });

  it('validates an explicit unchanged invalid write without rejecting unrelated formatting or creating a new snapshot', () => {
    const original = fixture();
    original.sheets[0].cells.A1 = { input: '20' };
    const stopped = studioSetDataValidation(original, 'main', numericRule());
    expect(() => studioPatchCells(stopped, 'main', { A1: { input: '20' } })).toThrow('A1');
    expect(() =>
      studioPatchCells(stopped, 'main', { A1: { input: '20' } }, { replace: true })
    ).toThrow('A1');
    expect(studioPatchCells(stopped, 'main', { A1: { bold: true } }).sheets[0].cells.A1).toEqual({
      input: '20',
      bold: true,
    });
    const warning = studioSetDataValidation(
      stopped,
      'main',
      numericRule({ errorStyle: 'warning' })
    );
    expect(studioPatchCells(warning, 'main', { A1: { input: '20' } })).toBe(warning);
    const permitted = studioSetDataValidation(
      stopped,
      'main',
      numericRule({ showErrorMessage: false })
    );
    expect(studioPatchCells(permitted, 'main', { A1: { input: '20' } })).toBe(permitted);
    expect(stopped.sheets[0].cells.A1).toEqual({ input: '20' });
  });

  it('validates custom/relative formula rules against the entire prospective paste atomically', () => {
    const original = fixture();
    original.sheets[0].cells = { A2: { input: '1' }, A3: { input: '2' } };
    const document = studioSetDataValidation(freeze(original), 'main', {
      id: 'pair',
      range: 'A2',
      type: 'custom',
      formula: '=A2<A3',
    });
    const valid = studioPasteCells(document, 'main', { row: 2, col: 1 }, '8\n9').document;
    expect(valid.sheets[0].cells.A2.input).toBe('8');
    expect(() => studioPasteCells(document, 'main', { row: 2, col: 1 }, '9\n8')).toThrow('A2');
    expect(document.sheets[0].cells.A2.input).toBe('1');
    expect(document.sheets[0].cells.A3.input).toBe('2');
    expect(studioCellValidation(valid.sheets[0], 'A2', studioCalculate(valid))?.valid).toBe(true);
  });

  it('resolves relative numeric thresholds and custom formula/error results correctly', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A2: { input: '5' },
      A3: { input: '20' },
      B2: { input: '10' },
      B3: { input: '=5+5' },
      C2: { input: '=1/0' },
    };
    let document = studioSetDataValidation(original, 'main', {
      id: 'threshold',
      range: 'B2:B3',
      type: 'decimal',
      operator: 'greaterThan',
      formula1: '=A2',
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'error',
      range: 'C2',
      type: 'custom',
      formula: '=ISERROR(C2)',
    });
    const calculation = studioCalculate(document);
    expect(studioCellValidation(document.sheets[0], 'B2', calculation)?.valid).toBe(true);
    expect(studioCellValidation(document.sheets[0], 'B3', calculation)?.valid).toBe(false);
    expect(studioCellValidation(document.sheets[0], 'C2', calculation)?.valid).toBe(true);
    const broken = studioSetDataValidation(document, 'main', {
      id: 'error',
      range: 'C2',
      type: 'custom',
      formula: '=1/0',
    });
    expect(studioCellValidation(broken.sheets[0], 'C2', studioCalculate(broken))?.valid).toBe(
      false
    );
  });

  it('converts ISO dates including Excel 1900 boundary and validates invalid Gregorian dates', () => {
    const document = studioSetDataValidation(
      freeze(fixture()),
      'main',
      numericRule({
        type: 'date',
        formula1: '1',
        formula2: '2958465',
      })
    );
    const next = studioPatchCells(document, 'main', {
      A1: { input: '1900-01-01' },
      A2: { input: '1900-02-28' },
      A3: { input: '1900-03-01' },
      A4: { input: '2024-02-29' },
    });
    expect(next.sheets[0].cells.A1).toEqual({ input: '1', numberFormat: 'yyyy-mm-dd' });
    expect(next.sheets[0].cells.A2.input).toBe('59');
    expect(next.sheets[0].cells.A3.input).toBe('61');
    expect(studioDisplayCell(next.sheets[0].cells.A4)).toBe('2024-02-29');
    expect(() => studioPatchCells(document, 'main', { A1: { input: '1900-02-29' } })).toThrow('A1');
    expect(() => studioPatchCells(document, 'main', { A1: { input: '2024-02-30' } })).toThrow('A1');
    expect(() => studioPatchCells(document, 'main', { A1: { input: "'2024-02-29" } })).toThrow(
      'A1'
    );
    expect(document.sheets[0].cells.A1).toBeUndefined();
  });

  it('validates ISO date input against DATE and DATEVALUE thresholds on the same 1900 calendar', () => {
    for (const formula1 of ['=DATE(1900,3,1)', '=DATEVALUE("1900-03-01")']) {
      const document = studioSetDataValidation(freeze(fixture()), 'main', {
        id: 'march',
        range: 'A1:A1',
        type: 'date',
        operator: 'equal',
        formula1,
      });
      const next = studioPatchCells(document, 'main', { A1: { input: '1900-03-01' } });
      expect(next.sheets[0].cells.A1).toEqual({ input: '61', numberFormat: 'yyyy-mm-dd' });
      expect(studioCellValidation(next.sheets[0], 'A1', studioCalculate(next))?.valid).toBe(true);
      expect(() => studioPatchCells(document, 'main', { A1: { input: '1900-02-28' } })).toThrow(
        'A1'
      );
      expect(document.sheets[0].cells.A1).toBeUndefined();
    }
  });

  it('normalizes pasted HH:mm:ss time values and preserves explicit formats and text opt-outs', () => {
    const document = studioSetDataValidation(
      fixture(),
      'main',
      numericRule({
        type: 'time',
        formula1: '0',
        formula2: '0.99999999',
      })
    );
    const next = studioPasteCells(document, 'main', { row: 1, col: 1 }, '09:30\n23:59:59').document;
    expect(Number(next.sheets[0].cells.A1.input)).toBeCloseTo(9.5 / 24);
    expect(next.sheets[0].cells.A1.numberFormat).toBe('hh:mm');
    expect(studioDisplayCell(next.sheets[0].cells.A2)).toBe('23:59:59');
    const formatted = studioPatchCells(document, 'main', {
      A1: { input: '09:30', numberFormat: 'h:mm AM/PM' },
    });
    expect(formatted.sheets[0].cells.A1.numberFormat).toBe('h:mm AM/PM');
    expect(() => studioPatchCells(document, 'main', { A1: { input: '24:00' } })).toThrow('A1');
    expect(() =>
      studioPatchCells(document, 'main', { A1: { input: '09:30', numberFormat: '@' } })
    ).toThrow('A1');
  });

  it('clears all direct formatting on replacement and validates sorting at the destination rules', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '1' },
      B1: { input: '10', bold: true, background: '#ff0000' },
      A2: { input: '2' },
      B2: { input: '20', italic: true },
    };
    const replaced = studioPatchCells(original, 'main', { B1: { input: '10' } }, { replace: true });
    expect(replaced.sheets[0].cells.B1).toEqual({ input: '10' });
    const document = studioSetDataValidation(original, 'main', {
      id: 'destination',
      range: 'B1',
      type: 'whole',
      operator: 'lessThanOrEqual',
      formula1: '10',
    });
    expect(() =>
      studioSortRange(
        document,
        'main',
        {
          anchor: { row: 1, col: 1 },
          focus: { row: 2, col: 2 },
        },
        1,
        'desc',
        false
      )
    ).toThrow('B1');
    expect(document.sheets[0].cells.B1.input).toBe('10');
    expect(document.sheets[0].dataValidations![0].range).toBe('B1:B1');
  });

  it('keeps broken list sources explicit and never truncates the supported 1000 choices', () => {
    const original = fixture();
    for (let row = 1; row <= 1000; row++)
      original.sheets[1].cells['A' + row] = { input: 'choice-' + row };
    const document = studioSetDataValidation(original, 'main', {
      id: 'source',
      range: 'A1',
      type: 'list',
      source: "='限额 O''Brien'!$A$1:$A$1000",
    });
    const values = studioValidationListValues(document.sheets[0], 'A1', studioCalculate(document));
    expect(values).toHaveLength(1000);
    expect(values[999]).toBe('choice-1000');
    const broken = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'A1',
      type: 'list',
      source: '=#REF!',
    });
    expect(studioCellValidation(broken.sheets[0], 'A1', studioCalculate(broken))).toMatchObject({
      valid: false,
      options: [],
      blocking: true,
    });
  });

  it('reads a fixed 1000-choice source once per calculation and refreshes it without exposing mutable cached arrays', () => {
    const original = fixture();
    for (let row = 1; row <= 1000; row++)
      original.sheets[1].cells['A' + row] = { input: 'choice-' + row };
    const document = studioSetDataValidation(original, 'main', {
      id: 'source',
      range: 'A1:B5',
      type: 'list',
      source: "='限额 O''Brien'!$A$1:$A$1000",
    });
    const calculation = studioCalculate(document);
    const evaluate = vi.spyOn(calculation, 'evaluate');
    const options = studioValidationListValues(document.sheets[0], 'A1', calculation);
    options[0] = 'changed outside the document';
    options.pop();
    expect(studioValidationListValues(document.sheets[0], 'B5', calculation)).toHaveLength(1000);
    expect(studioCellValidation(document.sheets[0], 'A2', calculation)?.options?.[0]).toBe(
      'choice-1'
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    const changed = studioPatchCells(document, 'limits', { A1000: { input: 'new last choice' } });
    const refreshed = studioValidationListValues(changed.sheets[0], 'A1', studioCalculate(changed));
    expect(refreshed[999]).toBe('new last choice');
    expect(document.sheets[1].cells.A1000.input).toBe('choice-1000');
  });

  it('evaluates mixed absolute and relative list endpoints separately for each destination', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '1' },
      A2: { input: '2' },
      A3: { input: '3' },
    };
    const document = studioSetDataValidation(original, 'main', {
      id: 'source',
      range: 'D2:D3',
      type: 'list',
      source: '=$A$1:$A2',
    });
    const calculation = studioCalculate(document);
    expect(studioValidationListValues(document.sheets[0], 'D2', calculation)).toEqual(['1', '2']);
    expect(studioValidationListValues(document.sheets[0], 'D3', calculation)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});

describe('Office Studio rules across worksheet operations', () => {
  it('renames all rule formula fields, including list sources, while preserving literal strings', () => {
    let document = fixture();
    document = studioSetConditionalFormat(document, 'main', {
      id: 'expression',
      range: 'A1',
      type: 'expression',
      formula: "=IF(1,\"限额 O'Brien!A1\",'限额 O''Brien'!A1)>0",
      priority: 1,
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'bounds',
      range: 'B1',
      type: 'cellIs',
      operator: 'between',
      formulae: ["='限额 O''Brien'!$A$1", "='限额 O''Brien'!$A$2"],
      priority: 2,
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'C1',
      type: 'list',
      source: "='限额 O''Brien'!$A$1:$A$3",
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'custom',
      range: 'D1',
      type: 'custom',
      formula: "='限额 O''Brien'!$A$1>D1",
    });
    const renamed = studioRenameSheet(freeze(document), 'limits', "新限额 O'Brien");
    expect(renamed.sheets[0].conditionalFormats![0]).toMatchObject({
      formula: "=IF(1,\"限额 O'Brien!A1\",'新限额 O''Brien'!A1)>0",
    });
    expect(renamed.sheets[0].conditionalFormats![1]).toMatchObject({
      formulae: ["='新限额 O''Brien'!$A$1", "='新限额 O''Brien'!$A$2"],
    });
    expect(renamed.sheets[0].dataValidations![0]).toMatchObject({
      source: "='新限额 O''Brien'!$A$1:$A$3",
    });
    expect(renamed.sheets[0].dataValidations![1]).toMatchObject({
      formula: "='新限额 O''Brien'!$A$1>D1",
    });
    expect(isOfficeStudioDocument(renamed)).toBe(true);
  });

  it('refuses deletion when retained rule references depend on the removed sheet', () => {
    for (const add of [
      (doc: StudioExcelDocument) =>
        studioSetDataValidation(doc, 'main', {
          id: 'source',
          range: 'A1',
          type: 'list',
          source: "='限额 O''Brien'!$A$1:$A$3",
        }),
      (doc: StudioExcelDocument) =>
        studioSetConditionalFormat(doc, 'main', {
          id: 'expr',
          range: 'A1',
          priority: 1,
          type: 'expression',
          formula: "='限额 O''Brien'!A1>0",
        }),
      (doc: StudioExcelDocument) =>
        studioSetDataValidation(doc, 'main', {
          id: 'threshold',
          range: 'A1',
          type: 'decimal',
          operator: 'lessThan',
          formula1: "='限额 O''Brien'!A1",
        }),
    ]) {
      const document = freeze(add(fixture()));
      expect(() => studioDeleteSheet(document, 'limits')).toThrow('仍引用');
      expect(document.sheets).toHaveLength(2);
    }
    const harmless = studioSetConditionalFormat(fixture(), 'main', {
      id: 'literal',
      range: 'A1',
      priority: 1,
      type: 'expression',
      formula: '=LEN("限额 O\'Brien!A1")>0',
    });
    expect(studioDeleteSheet(harmless, 'limits').sheets).toHaveLength(1);
  });

  it('returns unchanged rule snapshots when a rewrite has no effect', () => {
    const document = studioSetConditionalFormat(fixture(), 'main', {
      id: 'threshold',
      range: 'A1',
      priority: 1,
      type: 'cellIs',
      operator: 'greaterThan',
      formulae: ['10'],
    });
    const sheet = document.sheets[0];
    expect(studioMapSheetRuleFormulae(sheet, (formula) => formula)).toBe(sheet);
  });
});
