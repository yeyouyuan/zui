import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
  studioCalculate,
  studioCopySheetClipboard,
  studioCopyTsv,
  studioClipboardOrigin,
  studioDisplayCell,
  studioInputValue,
  studioParseAddress,
  studioParseTsv,
  studioPasteCells,
  studioPatchCells,
  studioRenameSheet,
  studioDeleteSheet,
  studioMergeCells,
  studioSetFreeze,
  studioSetFilter,
  studioFilteredRows,
  studioSortRange,
  studioTranslateFormula,
  studioAddChart,
  studioChartData,
} from './studio-sheet-model';
import type { StudioCell, StudioExcelDocument } from './studio-types';
import { studioCellHyperlink, studioResolveSheetHyperlink } from './studio-sheet-hyperlinks';

function fixture(): StudioExcelDocument {
  return {
    version: 1,
    id: 'book',
    name: '预算.xlsx',
    kind: 'excel',
    activeSheetId: 'main',
    sheets: [
      {
        id: 'main',
        name: 'Sheet1',
        rowCount: 200,
        columnCount: 26,
        cells: {
          A1: { input: '10', bold: true },
          A2: { input: '20' },
          B1: { input: '=SUM(A1:A2)' },
          B2: { input: '=AVERAGE(A1:A2)' },
          C1: { input: '=B1*2+A1' },
          C2: { input: '=IF(B2>12,"通过","待定")' },
          D1: { input: "='报价 表'!A1+Sheet1!A1" },
        },
      },
      {
        id: 'other',
        name: '报价 表',
        rowCount: 200,
        columnCount: 26,
        cells: { A1: { input: '=Sheet1!B2+1' } },
      },
    ],
  };
}

describe('Office Studio sheet calculations', () => {
  it('preserves real parser errors and scalar labels when each source module uses a separate realm', () => {
    const require = createRequire(import.meta.url);
    const typescript = require('typescript') as typeof import('typescript');
    const modules = new Map<string, { exports: Record<string, unknown> }>();
    const compiled = (source: URL): Record<string, unknown> => {
      const cached = modules.get(source.href);
      if (cached) return cached.exports;
      const module = { exports: {} as Record<string, unknown> };
      modules.set(source.href, module);
      const output = typescript.transpileModule(readFileSync(source, 'utf8'), {
        compilerOptions: {
          target: typescript.ScriptTarget.ES2022,
          module: typescript.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      }).outputText;
      runInNewContext(output, {
        module,
        exports: module.exports,
        URL,
        require: (id: string) =>
          id.startsWith('.') ? compiled(new URL(`${id}.ts`, source)) : require(id),
      });
      return module.exports;
    };
    const isolated = compiled(pathToFileURL(require.resolve('./studio-sheet-model.ts'))) as {
      studioCalculate: typeof studioCalculate;
    };
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: 'false' },
      A2: { input: '=IF(A1,1,0)' },
      A3: { input: '=HYPERLINK("https://example.com/",1/0)' },
      A4: { input: '=HYPERLINK(NA(),"标签")' },
      A5: { input: '=DATE(1900,3,1)' },
      A6: { input: '=DAY(60)' },
      A7: { input: '=HYPERLINK("https://example.com/",FALSE)' },
      A8: { input: '=""' },
      A9: { input: '=HYPERLINK("https://example.com/",A8)' },
    };
    const calculation = isolated.studioCalculate(document);
    expect(calculation.errors.get('main:A3')).toBe('#DIV/0!');
    expect(calculation.errors.get('main:A4')).toBe('#N/A');
    expect(calculation.values.get('main:A2')).toBe(0);
    expect(calculation.values.get('main:A5')).toBe(61);
    expect(calculation.values.get('main:A6')).toBe(29);
    expect(calculation.values.get('main:A7')).toBe(false);
    expect(calculation.values.get('main:A9')).toBe('');
    expect(calculation.hyperlinks.has('main:A3')).toBe(false);
    expect(calculation.hyperlinks.has('main:A4')).toBe(false);
  });

  it('uses actual boolean and numeric references in IF while leaving the unselected reference unread', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: 'false' },
      A2: { input: 'true' },
      A3: { input: '0' },
      A4: { input: '42' },
      B1: { input: '=IF(A1,1,0)' },
      B2: { input: '=IF(A2,"通过","失败")' },
      B3: { input: '=IF(A3,1,0)' },
      B4: { input: '=IF(A4,1,0)' },
      B5: { input: '=IF(A5,1,0)' },
      B6: { input: '=IF(A1,B6,8)' },
      B7: { input: '=IF(A2,A4,A6)' },
      B8: { input: '=IF(A1,A6,A4)' },
      B9: { input: '=IF("FALSE",1,0)' },
      B10: { input: '=IF(TRUE)' },
      B11: { input: '=IF(FALSE)' },
      B12: { input: '=IF(TRUE,,8)' },
      B13: { input: '=A4=42' },
      B14: { input: '=IF(A1,1)' },
      A6: { input: '=1/0' },
    };
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    const expected = [0, '通过', 0, 1, 0, 8, 42, 42, 0, true, false, 0, true, false];
    expected.forEach((value, index) =>
      expect(calculation.values.get(`main:B${index + 1}`)).toBe(value)
    );
    expect(calculation.errors.get('main:A6')).toBe('#DIV/0!');
    expect(calculation.errors.size).toBe(1);
  });

  it('keeps HYPERLINK friendly scalar types, blank values and formula text intact', () => {
    const document = fixture();
    const target = 'https://example.com/report';
    document.sheets[0].cells = {
      A1: { input: target },
      A2: { input: '42' },
      A3: { input: 'false' },
      B1: { input: `=HYPERLINK("${target}",7)` },
      B2: { input: `=HYPERLINK("${target}",TRUE)` },
      B3: { input: `=HYPERLINK("${target}",FALSE)` },
      B4: { input: `=HYPERLINK("${target}","")` },
      B5: { input: `=HYPERLINK("${target}","文字")` },
      B6: { input: `=HYPERLINK("${target}",A2)` },
      B7: { input: `=HYPERLINK("${target}",A3)` },
      B8: { input: `=HYPERLINK("${target}",A4)` },
      B9: { input: '=HYPERLINK(A1)' },
      B10: { input: '=HYPERLINK(42)' },
      B11: { input: '=HYPERLINK(TRUE)' },
      B12: { input: '=HYPERLINK(A4)' },
      B13: { input: `=HYPERLINK("${target}",)` },
      B14: { input: `=HYPERLINK("${target}",{2,3})` },
    };
    document.sheets[1].cells = {};
    const before = JSON.stringify(document);
    const calculation = studioCalculate(document);
    const expected = [7, true, false, '', '文字', 42, false, 0, target, '42', 'TRUE', '', 0, 2];
    expected.forEach((value, index) =>
      expect(calculation.values.get(`main:B${index + 1}`)).toBe(value)
    );
    expect(calculation.errors.size).toBe(0);
    expect(calculation.hyperlinks.size).toBe(expected.length);
    expect(studioCellHyperlink(document, 'main', 'B1', calculation)).toEqual({
      id: 'formula:main:B1',
      ref: 'B1',
      target,
    });
    expect(
      studioResolveSheetHyperlink(document, 'main', calculation.hyperlinks.get('main:B10')!).kind
    ).toBe('blocked');
    expect(JSON.stringify(document)).toBe(before);
  });

  it('associates only the complete root HYPERLINK call with the outermost computed target', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '=HYPERLINK("https://source.example/","https://outer.example/")' },
      B1: { input: '=HYPERLINK("https://outer.example/",HYPERLINK("https://inner.example/",8))' },
      B2: { input: '=HYPERLINK(HYPERLINK("https://inner.example/","https://outer.example/"),8)' },
      B3: { input: '=HYPERLINK(A1,8)' },
      B4: {
        input: '=IF(FALSE,HYPERLINK("https://one.example/",8),HYPERLINK("https://two.example/",9))',
      },
      B5: { input: '=HYPERLINK("https://one.example/",8)+1' },
      B6: { input: '=CONCATENATE(HYPERLINK("https://one.example/","字"),"尾")' },
      B7: { input: '=SUM(HYPERLINK("https://one.example/",8),1)' },
      B8: {
        input:
          '=HYPERLINK("https://outer.example/",IF(FALSE,HYPERLINK("https://inner.example/",8),7))',
      },
      B9: { input: '= HYPERLINK("https://outer.example/path?q=(1)", "括号 ) 和引号 "" )") ' },
    };
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    expect(calculation.errors.size).toBe(0);
    for (const address of ['B1', 'B2', 'B3', 'B8']) {
      expect(calculation.hyperlinks.get(`main:${address}`)?.target).toBe('https://outer.example/');
      expect(calculation.values.get(`main:${address}`)).toBe(address === 'B8' ? 7 : 8);
    }
    for (const address of ['B4', 'B5', 'B6', 'B7'])
      expect(studioCellHyperlink(document, 'main', address, calculation)).toBeUndefined();
    expect(calculation.values.get('main:B4')).toBe(9);
    expect(calculation.values.get('main:B5')).toBe(9);
    expect(calculation.values.get('main:B6')).toBe('字尾');
    expect(calculation.hyperlinks.get('main:B9')?.target).toBe('https://outer.example/path?q=(1)');
    expect(calculation.values.get('main:B9')).toBe('括号 ) 和引号 " )');
    const count = calculation.hyperlinks.size;
    expect(
      calculation.evaluate('main', '=HYPERLINK("https://rule.example/",10)', { row: 40, col: 1 })
        .value
    ).toBe(10);
    expect(calculation.hyperlinks.size).toBe(count);
  });

  it('preserves HYPERLINK argument errors and does not create a link for failed calls', () => {
    const document = fixture();
    const examples: [string, string][] = [
      ['HYPERLINK()', '#VALUE!'],
      ['HYPERLINK("url",1,2)', '#VALUE!'],
      ['HYPERLINK(A1,"标签")', '#DIV/0!'],
      ['HYPERLINK("url",A1)', '#DIV/0!'],
      ['HYPERLINK("url",NA())', '#N/A'],
      ['HYPERLINK("url",1/0)', '#DIV/0!'],
    ];
    document.sheets[0].cells = {
      A1: { input: '=1/0' },
      ...Object.fromEntries(
        examples.map(([formula], index) => [`B${index + 1}`, { input: `=${formula}` }])
      ),
    };
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    examples.forEach(([formula, error], index) =>
      expect(calculation.errors.get(`main:B${index + 1}`), formula).toBe(error)
    );
    expect(calculation.hyperlinks.size).toBe(0);
  });

  it('matches ONLYOFFICE implicit intersection for reference ranges while literal arrays use their first item', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: 'https://one.example/' },
      A2: { input: 'https://two.example/' },
      A3: { input: 'https://three.example/' },
      C1: { input: '10' },
      C2: { input: '20' },
      C3: { input: '30' },
      D1: { input: '40' },
      E1: { input: '50' },
      B2: { input: '=HYPERLINK(A1:A3,C1:C3)' },
      D2: { input: '=HYPERLINK("https://target.example/",C1:E1)' },
      B4: { input: '=HYPERLINK("https://target.example/",C1:C3)' },
      E2: { input: '=HYPERLINK("https://target.example/",{8;9})' },
      F2: { input: '=HYPERLINK("https://target.example/",C1:D3)' },
    };
    document.sheets[1].cells = {
      A1: { input: '11' },
      A2: { input: '22' },
      B2: { input: '=HYPERLINK("https://target.example/",\'报价 表\'!A1:A2)' },
    };
    const calculation = studioCalculate(document);
    expect(calculation.values.get('main:B2')).toBe(20);
    expect(calculation.hyperlinks.get('main:B2')?.target).toBe('https://two.example/');
    expect(calculation.values.get('main:D2')).toBe(40);
    expect(calculation.values.get('main:E2')).toBe(8);
    expect(calculation.values.get('other:B2')).toBe(22);
    expect(calculation.errors.get('main:B4')).toBe('#VALUE!');
    expect(calculation.errors.get('main:F2')).toBe('#VALUE!');
  });

  it('keeps date construction and extraction on the Excel 1900 calendar, including overflow and text dates', () => {
    const document = fixture();
    const examples: [string, number][] = [
      ['DATE(1900,1,1)', 1],
      ['DATE(1900,2,28)', 59],
      ['DATE(1900,2,29)', 60],
      ['DATE(1900,3,1)', 61],
      ['DATE(1900,3,2)', 62],
      ['DATE(1900,3,0)', 60],
      ['DATE(1900,1,60)', 60],
      ['DATE(1900,1,61)', 61],
      ['DATE(1900,2,30)', 61],
      ['DATE(1900,0,32)', 1],
      ['DATE(0,1,1)', 1],
      ['DATE(2024,2,29)', 45351],
      ['DATE(2024,2,30)', 45352],
      ['DATE(2024.9,2.9,29.9)', 45351],
      ['DATEVALUE("1900-03-01")', 61],
      ['DATEVALUE("03/01/1900")', 61],
      ['DATEVALUE("March 1, 1900")', 61],
      ['DATEVALUE("29-Feb-1900")', 60],
      ['DATEVALUE("1900-02-29")', 60],
      ['DATEVALUE("2024-02-29")', 45351],
      ['DAY(60)', 29],
      ['MONTH(60)', 2],
      ['YEAR(60)', 1900],
      ['DAY(60.5)', 29],
      ['DAY(0)', 0],
      ['MONTH(0)', 1],
      ['YEAR(0)', 1900],
      ['DAY(DATE(1900,3,1))', 1],
      ['DAY("2024-02-29")', 29],
      ['MONTH("2024-02-29")', 2],
      ['YEAR("2024-02-29")', 2024],
    ];
    document.sheets[0].cells = Object.fromEntries(
      examples.map(([formula], index) => [`A${index + 1}`, { input: `=${formula}` }])
    );
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    expect(calculation.errors.size).toBe(0);
    examples.forEach(([formula, expected], index) =>
      expect(calculation.values.get(`main:A${index + 1}`), formula).toBe(expected)
    );
    for (const [serial, display] of [
      [1, '1900-01-01'],
      [59, '1900-02-28'],
      [60, '1900-02-29'],
      [61, '1900-03-01'],
    ] as const)
      expect(studioDisplayCell({ input: String(serial), numberFormat: 'yyyy-mm-dd' })).toBe(
        display
      );
  });

  it('rejects invalid date parameters and preserves formula errors passed through date arguments', () => {
    const document = fixture();
    const examples: [string, string][] = [
      ['DATE(-1,1,1)', '#NUM!'],
      ['DATE(10000,1,1)', '#NUM!'],
      ['DATE(9999,12,32)', '#NUM!'],
      ['DATE("x",1,1)', '#VALUE!'],
      ['DATE(1900,1)', '#VALUE!'],
      ['DATEVALUE("2024-02-30")', '#VALUE!'],
      ['DATEVALUE("not date")', '#VALUE!'],
      ['DAY(-1)', '#NUM!'],
      ['MONTH(2958466)', '#NUM!'],
      ['DAY("not date")', '#VALUE!'],
      ['DATE(A1,1,1)', '#DIV/0!'],
      ['DAY(A1)', '#DIV/0!'],
      ['DATEVALUE(A1)', '#DIV/0!'],
    ];
    document.sheets[0].cells = {
      A1: { input: '=1/0' },
      ...Object.fromEntries(
        examples.map(([formula], index) => [`B${index + 1}`, { input: `=${formula}` }])
      ),
    };
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    examples.forEach(([formula, expected], index) =>
      expect(calculation.errors.get(`main:B${index + 1}`), formula).toBe(expected)
    );
  });

  it('calculates dependency chains, functions and quoted cross-sheet references without overwriting the caller parser', () => {
    const calculation = studioCalculate(fixture());
    expect(calculation.errors.size).toBe(0);
    expect(calculation.values.get('main:B1')).toBe(30);
    expect(calculation.values.get('main:B2')).toBe(15);
    expect(calculation.values.get('main:C1')).toBe(70);
    expect(calculation.values.get('main:C2')).toBe('通过');
    expect(calculation.values.get('other:A1')).toBe(16);
    expect(calculation.values.get('main:D1')).toBe(26);
  });

  it('surfaces cycles, invalid functions, arithmetic errors and evaluation limits', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '=B1+1' },
      B1: { input: '=A1+1' },
      A2: { input: '=1/0' },
      A3: { input: '=UNKNOWNFUNCTION(1)' },
      A4: { input: '=SUM(A1:IV10000)' },
      A5: { input: '=REPT("x",1000000000)' },
      A6: { input: "='Missing'!A1" },
    };
    document.sheets[1].cells = {};
    const { errors } = studioCalculate(document);
    expect(errors.get('main:A1')).toBe('#CYCLE!');
    expect(errors.get('main:B1')).toBe('#CYCLE!');
    expect(errors.get('main:A2')).toBe('#DIV/0!');
    expect(errors.get('main:A3')).toBe('#NAME?');
    expect(errors.get('main:A4')).toBe('#LIMIT!');
    expect(errors.get('main:A5')).toBe('#LIMIT!');
    expect(errors.get('main:A6')).toBe('#REF!');
  });

  it('counts blank cells in the requested range rather than truncating at the populated rows', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '1' },
      B1: { input: '=COUNTBLANK(A1:A500)' },
      B2: { input: '=AVERAGE(A1:A500)' },
      B3: { input: '=A1*A2' },
      B4: { input: '=A2' },
    };
    document.sheets[1].cells = {};
    const calculated = studioCalculate(document);
    expect(calculated.values.get('main:B1')).toBe(499);
    expect(calculated.values.get('main:B2')).toBe(1);
    expect(calculated.values.get('main:B3')).toBe(0);
    expect(calculated.values.get('main:B4')).toBe(0);
  });

  it('keeps identifiers and text-formatted values as text and renders Excel number formats', () => {
    expect(studioInputValue('00123')).toBe('00123');
    expect(studioInputValue("'123")).toBe('123');
    expect(studioInputValue('123', '@')).toBe('123');
    expect(studioInputValue('-.5')).toBe(-0.5);
    expect(studioInputValue('+3.')).toBe(3);
    expect(studioDisplayCell({ input: '0.125', numberFormat: '0.00%' })).toBe('12.50%');
    expect(studioDisplayCell({ input: '12345.5', numberFormat: '#,##0.00' })).toBe('12,345.50');
  });

  it('allows IFERROR to handle a referenced formula error while retaining the original error', () => {
    const document = fixture();
    document.sheets[0].cells = { A1: { input: '=1/0' }, B1: { input: '=IFERROR(A1,0)' } };
    document.sheets[1].cells = {};
    const calculated = studioCalculate(document);
    expect(calculated.errors.get('main:A1')).toBe('#DIV/0!');
    expect(calculated.values.get('main:B1')).toBe(0);
    expect(calculated.errors.has('main:B1')).toBe(false);
  });
});

describe('Office Studio sheet changes', () => {
  it('patches immutably, preserves cell formatting on clear, and normalizes addresses', () => {
    const original = fixture();
    const result = studioPatchCells(original, 'main', {
      $A$1: { input: '' },
      A500: { input: '新行' },
    });
    expect(result.id).toBe(original.id);
    expect(result.name).toBe(original.name);
    expect(original.sheets[0].cells.A1.input).toBe('10');
    expect(result.sheets[0].cells.A1).toEqual({ input: '', bold: true });
    expect(result.sheets[0].cells.$A$1).toBeUndefined();
    expect(result.sheets[0].rowCount).toBe(500);
    expect(result.sheets[1]).toBe(original.sheets[1]);
  });

  it('changes and resets fonts without changing values, calculations, hyperlinks or validation metadata', () => {
    const original = fixture();
    const sheet = original.sheets[0];
    sheet.hyperlinks = [{ id: 'font-link', ref: 'A1', target: 'https://example.com/' }];
    sheet.dataValidations = [
      { id: 'valid', range: 'A1:A1', type: 'whole', operator: 'lessThan', formula1: '5' },
    ];
    const changed = studioPatchCells(original, 'main', {
      $a$1: { fontFamily: '新宋体', fontSize: 11.5 },
      B1: { fontFamily: 'Custom "Font";\\Family', fontSize: 409 },
    });
    expect(changed.sheets[0].cells.A1).toEqual({
      input: '10',
      bold: true,
      fontFamily: '新宋体',
      fontSize: 11.5,
    });
    expect(changed.sheets[0].hyperlinks).toBe(sheet.hyperlinks);
    expect(changed.sheets[0].dataValidations).toBe(sheet.dataValidations);
    expect(studioCalculate(changed).values.get('main:B1')).toBe(30);
    expect(
      studioPatchCells(changed, 'main', { A1: { fontFamily: '新宋体', fontSize: 11.5 } })
    ).toBe(changed);
    const reset = studioPatchCells(changed, 'main', {
      A1: { fontFamily: undefined, fontSize: undefined },
    });
    expect(reset.sheets[0].cells.A1).toEqual(sheet.cells.A1);
    expect(reset.sheets[0].hyperlinks).toBe(sheet.hyperlinks);
    expect(original.sheets[0].cells.A1).toEqual({ input: '10', bold: true });
  });

  it('rejects invalid font patches atomically and retains the original workbook', () => {
    const original = fixture();
    const snapshot = JSON.stringify(original);
    for (const font of [
      { fontFamily: '' },
      { fontFamily: 'a'.repeat(256) },
      { fontFamily: 'invalid\u0000' },
      { fontFamily: null },
      { fontSize: 0 },
      { fontSize: 409.1 },
      { fontSize: Number.NaN },
      { fontSize: Number.POSITIVE_INFINITY },
      { fontSize: '12' },
    ]) {
      expect(() =>
        studioPatchCells(original, 'main', {
          A1: { fontFamily: 'Calibri', fontSize: 12 },
          A2: font as unknown as Partial<StudioCell>,
        })
      ).toThrow(/字体|字号/);
      expect(JSON.stringify(original)).toBe(snapshot);
    }
  });

  it('round-trips quoted TSV and makes a batch paste one document change', () => {
    const original = fixture();
    const text = '名称\t数值\n"带\t制表符"\t3\n"带\n换行和""引号"""\t=SUM(B2:B3)';
    const result = studioPasteCells(original, 'main', { row: 1, col: 1 }, text);
    expect(result.document.sheets[0].cells.A2.input).toBe('带\t制表符');
    expect(result.document.sheets[0].cells.A3.input).toBe('带\n换行和"引号"');
    expect(studioCopyTsv(result.document.sheets[0], result.selection)).toBe(text);
    expect(studioParseTsv('1\t2\r\n3\t4\r\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
    const ragged = studioPasteCells(original, 'main', { row: 20, col: 1 }, '1\t2\n3');
    expect(ragged.selection).toEqual({ anchor: { row: 20, col: 1 }, focus: { row: 21, col: 2 } });
    expect(ragged.addresses).toEqual(['A20', 'B20', 'A21']);
    expect(() => studioPasteCells(original, 'main', { row: 10000, col: 1 }, 'a\nb')).toThrow(
      '超出'
    );
    expect(original.sheets[0].cells.A1.input).toBe('10');
  });

  it('relocates copied formulas only with matching and valid source clipboard metadata', () => {
    const original = fixture();
    const formula = "=IF(A2>0,\"A2\",$B2+C$2+$D$2+'预算 O''Brien'!A2)";
    const payload = JSON.stringify({ version: 1, row: 5, col: 3, text: formula });
    const source = studioClipboardOrigin(payload, formula);
    expect(source).toEqual({ row: 5, col: 3 });
    const moved = studioPasteCells(original, 'main', { row: 8, col: 4 }, formula, source);
    expect(moved.document.sheets[0].cells.D8.input).toBe(
      "=IF(B5>0,\"A2\",$B5+D$2+$D$2+'预算 O''Brien'!B5)"
    );
    expect(
      studioPasteCells(original, 'main', { row: 8, col: 4 }, formula).document.sheets[0].cells.D8
        .input
    ).toBe(formula);
    expect(studioClipboardOrigin(payload, 'different text')).toBeUndefined();
    expect(studioClipboardOrigin('{broken', formula)).toBeUndefined();
    expect(
      studioClipboardOrigin(JSON.stringify({ version: 1, row: 0, col: 3, text: formula }), formula)
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({ version: 1, row: 5.5, col: 3, text: formula }),
        formula
      )
    ).toBeUndefined();
    expect(original.sheets[0].cells.D8).toBeUndefined();
  });

  it('cancels an entire copied range when any relocated reference or source position is invalid', () => {
    const original = fixture();
    expect(() =>
      studioPasteCells(original, 'main', { row: 1, col: 1 }, 'new\t=A1', { row: 3, col: 3 })
    ).toThrow('超出工作表');
    expect(() =>
      studioPasteCells(original, 'main', { row: 1, col: 1 }, 'new\nnext', { row: 10000, col: 1 })
    ).toThrow('复制来源');
    expect(() => studioPasteCells(original, 'main', { row: 0, col: 1 }, 'new')).toThrow('超出');
    expect(original.sheets[0].cells.A1.input).toBe('10');
    expect(original.sheets[0].cells.B1.input).toBe('=SUM(A1:A2)');
  });

  it('captures a version 3 clipboard snapshot and applies every non-transpose paste mode', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: {
        input: '=A2*2',
        bold: true,
        color: '#c00000',
        numberFormat: '0.00',
        borders: { top: { style: 'thick', color: '#c00000' } },
      },
      A2: { input: '7' },
      B1: { input: "'001", italic: true, background: '#fff2cc', numberFormat: '@' },
      D4: {
        input: 'keep',
        italic: true,
        background: '#eeeeee',
        numberFormat: '@',
        borders: { bottom: { style: 'double', color: '#0000ff' } },
      },
      E4: { input: 'keep too', underline: true },
      F4: { input: '2026-01-02', numberFormat: 'yyyy-mm-dd' },
    };
    original.sheets[0].dataValidations = [
      {
        id: 'date-target',
        range: 'F4:F4',
        type: 'date',
        operator: 'between',
        formula1: '1',
        formula2: '2958465',
        showErrorMessage: false,
      },
    ];
    original.sheets[0].columnWidths = { A: 144, B: 92, D: 61, E: 62 };
    original.sheets[0].hyperlinks = [
      { id: 'source-link', ref: 'A1', target: 'https://example.com/source' },
    ];
    const selection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 2 } };
    const text = studioCopyTsv(original.sheets[0], selection);
    const payload = studioCopySheetClipboard(original, 'main', selection);
    const serialized = JSON.parse(payload);
    expect(serialized).toMatchObject({
      version: 3,
      rows: 1,
      columns: 2,
      columnWidths: [144, 92],
      merges: [],
      values: [
        { type: 'number', value: 14 },
        { type: 'string', value: '001' },
      ],
    });
    const source = studioClipboardOrigin(payload, text)!;
    const paste = (mode: Parameters<typeof studioPasteCells>[5], document = original) =>
      studioPasteCells(document, 'main', { row: 4, col: 4 }, text, source, mode).document;

    const all = paste('all');
    expect(all.sheets[0].cells.D4).toMatchObject({
      input: '=D5*2',
      bold: true,
      color: '#c00000',
      numberFormat: '0.00',
      borders: { top: { style: 'thick', color: '#c00000' } },
    });
    expect(studioCellHyperlink(all, 'main', 'D4')?.target).toBe('https://example.com/source');

    const formulas = paste('formulas');
    expect(formulas.sheets[0].cells.D4).toMatchObject({
      input: '=D5*2',
      italic: true,
      background: '#eeeeee',
      numberFormat: '@',
    });
    const values = paste('values');
    expect(values.sheets[0].cells.D4).toMatchObject({
      input: '14',
      italic: true,
      background: '#eeeeee',
      numberFormat: '@',
    });
    expect(values.sheets[0].cells.E4.input).toBe('001');
    expect(studioCellHyperlink(values, 'main', 'D4')).toBeUndefined();

    const formats = paste('formats');
    expect(formats.sheets[0].cells.D4).toMatchObject({
      input: 'keep',
      bold: true,
      italic: false,
      color: '#c00000',
      numberFormat: '0.00',
      borders: { top: { style: 'thick', color: '#c00000' } },
    });
    expect(
      studioPasteCells(original, 'main', { row: 4, col: 6 }, text, source, 'formats').document
        .sheets[0].cells.F4.input
    ).toBe('2026-01-02');
    expect(paste('formulas-number-format').sheets[0].cells.D4).toMatchObject({
      input: '=D5*2',
      background: '#eeeeee',
      numberFormat: '0.00',
    });
    expect(paste('values-number-format').sheets[0].cells.D4).toMatchObject({
      input: '14',
      background: '#eeeeee',
      numberFormat: '0.00',
    });
    expect(paste('source-formatting').sheets[0].cells.D4).toEqual(all.sheets[0].cells.D4);
    expect(paste('without-borders').sheets[0].cells.D4).toMatchObject({
      input: '=D5*2',
      bold: true,
      borders: { bottom: { style: 'double', color: '#0000ff' } },
    });

    const widths = paste('column-widths');
    expect(widths.sheets[0].columnWidths).toMatchObject({ D: 144, E: 92 });
    expect(widths.sheets[0].cells.D4.input).toBe('keep');

    const changedSource = studioPatchCells(original, 'main', { A2: { input: '100' } });
    expect(paste('values', changedSource).sheets[0].cells.D4.input).toBe('14');
    expect(original.sheets[0].cells.D4.input).toBe('keep');
  });

  it('transposes cells, formulas, links and fully selected merged regions', () => {
    const original = fixture();
    original.sheets[0].cells = {
      A1: { input: '标题', bold: true },
      A2: { input: '左侧' },
      B2: { input: '=A2' },
    };
    original.sheets[0].merges = ['A1:B1'];
    original.sheets[0].hyperlinks = [
      { id: 'source-range', ref: 'A2:B2', target: 'https://example.com/range' },
    ];
    const selection = { anchor: { row: 1, col: 1 }, focus: { row: 2, col: 2 } };
    const text = studioCopyTsv(original.sheets[0], selection);
    const source = studioClipboardOrigin(
      studioCopySheetClipboard(original, 'main', selection),
      text
    )!;
    const result = studioPasteCells(
      original,
      'main',
      { row: 4, col: 4 },
      text,
      source,
      'transpose'
    );
    expect(result.selection).toEqual({ anchor: { row: 4, col: 4 }, focus: { row: 5, col: 5 } });
    expect(result.document.sheets[0].cells.D4).toMatchObject({ input: '标题', bold: true });
    expect(result.document.sheets[0].cells.E4.input).toBe('左侧');
    expect(result.document.sheets[0].cells.E5.input).toBe('=D5');
    expect(result.document.sheets[0].merges).toContain('D4:D5');
    expect(studioCellHyperlink(result.document, 'main', 'E4')?.target).toBe(
      'https://example.com/range'
    );
    expect(studioCellHyperlink(result.document, 'main', 'E5')?.target).toBe(
      'https://example.com/range'
    );
  });

  it('rejects malformed rich clipboard data and partial target merges without a partial edit', () => {
    const original = fixture();
    const selection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 2 } };
    const text = studioCopyTsv(original.sheets[0], selection);
    const payload = JSON.parse(studioCopySheetClipboard(original, 'main', selection));
    expect(
      studioClipboardOrigin(
        JSON.stringify({ ...payload, cells: [{ input: 7 }, payload.cells[1]] }),
        text
      )
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({ ...payload, cells: [{ input: 'different' }, payload.cells[1]] }),
        text
      )
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({
          ...payload,
          merges: [{ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 }],
        }),
        text
      )
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({
          ...payload,
          merges: [
            { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 },
            { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 },
          ],
        }),
        text
      )
    ).toBeUndefined();

    const legacy = studioClipboardOrigin(
      JSON.stringify({ version: 2, row: 1, col: 1, text, hyperlinks: [] }),
      text
    );
    expect(() =>
      studioPasteCells(original, 'main', { row: 4, col: 4 }, text, legacy, 'values')
    ).toThrow('OfficeStudio');

    const rich = studioClipboardOrigin(JSON.stringify(payload), text)!;
    const mergedTarget = structuredClone(original);
    mergedTarget.sheets[0].merges = ['D4:E4'];
    mergedTarget.sheets[0].cells.D4 = { input: '目标' };
    delete mergedTarget.sheets[0].cells.E4;
    const snapshot = JSON.stringify(mergedTarget);
    expect(() =>
      studioPasteCells(mergedTarget, 'main', { row: 4, col: 5 }, text, rich, 'all')
    ).toThrow('部分重叠');
    expect(JSON.stringify(mergedTarget)).toBe(snapshot);
  });

  it('renames references while preserving quoted formula strings and escaped apostrophes', () => {
    const document = fixture();
    document.sheets[0].cells.E1 = { input: '=IF(A1>0,"Sheet1!A1",Sheet1!A1)' };
    const result = studioRenameSheet(document, 'main', "预算 O'Brien");
    expect(result.sheets[0].cells.E1.input).toBe("=IF(A1>0,\"Sheet1!A1\",'预算 O''Brien'!A1)");
    expect(result.sheets[1].cells.A1.input).toBe("='预算 O''Brien'!B2+1");
    expect(studioCalculate(result).values.get('other:A1')).toBe(16);
    expect(() => studioRenameSheet(result, 'main', '报价 表')).toThrow('已存在');
    expect(studioParseAddress('IW1')).toEqual({ row: 1, col: 257 });
    expect(() => studioPatchCells(result, 'main', { IW1: { input: '越界' } })).toThrow('256');
  });

  it('deletes an unreferenced sheet immutably, selects a retained neighbor and keeps a sheet in every workbook', () => {
    const original = fixture();
    original.sheets[0].cells = { A1: { input: '=IF(1,"报价 表!A1","文本")' } };
    original.activeSheetId = 'other';
    const changed = studioDeleteSheet(original, 'other');
    expect(changed.sheets).toHaveLength(1);
    expect(changed.activeSheetId).toBe('main');
    expect(changed.sheets[0]).toBe(original.sheets[0]);
    expect(original.sheets).toHaveLength(2);
    expect(() => studioDeleteSheet(changed, 'main')).toThrow('至少');
    expect(() => studioDeleteSheet(original, 'missing')).toThrow('不存在');
  });

  it('refuses sheet deletion when retained formulas use direct, escaped, dynamic or cross-sheet range references', () => {
    const original = fixture();
    expect(() => studioDeleteSheet(original, 'other')).toThrow('仍引用');
    const renamed = studioRenameSheet(original, 'other', "预算 O'Brien");
    expect(() => studioDeleteSheet(renamed, 'other')).toThrow("预算 O'Brien");
    for (const input of ['=INDIRECT("报价 表!A1")', '=Sheet1:Sheet3!A1', "='Sheet1:Sheet3'!A1"]) {
      original.sheets[0].cells = { A1: { input } };
      expect(() => studioDeleteSheet(original, 'other')).toThrow('不能安全删除');
      expect(original.sheets).toHaveLength(2);
    }
  });
});

describe('Office Studio advanced sheet operations', () => {
  function dataFixture(): StudioExcelDocument {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '项目' },
      B1: { input: '金额' },
      C1: { input: '小计' },
      A2: { input: '开发' },
      B2: { input: '20' },
      C2: { input: '=B2*2' },
      A3: { input: '设计' },
      B3: { input: '10' },
      C3: { input: '=B3*2' },
      A4: { input: '验证' },
      B4: { input: '30' },
      C4: { input: '=B4*2' },
      F1: { input: '合并标题', bold: true },
    };
    document.sheets[1].cells = {};
    return document;
  }
  const selection = { anchor: { row: 1, col: 1 }, focus: { row: 4, col: 3 } };

  it('merges only empty descendants, prevents overlap and cross-freeze merging, then splits without deleting content', () => {
    const original = dataFixture();
    const merged = studioMergeCells(original, 'main', {
      anchor: { row: 1, col: 6 },
      focus: { row: 2, col: 8 },
    });
    expect(merged.sheets[0].merges).toEqual(['F1:H2']);
    expect(() => studioPatchCells(merged, 'main', { G2: { input: '隐蔽内容' } })).toThrow('左上角');
    expect(() =>
      studioMergeCells(merged, 'main', { anchor: { row: 1, col: 7 }, focus: { row: 3, col: 9 } })
    ).toThrow('重叠');
    expect(() => studioSetFreeze(merged, 'main', 1, 0)).toThrow('合并');
    expect(() => studioMergeCells(original, 'main', selection)).toThrow('覆盖');
    const split = studioMergeCells(
      merged,
      'main',
      { anchor: { row: 2, col: 7 }, focus: { row: 2, col: 7 } },
      true
    );
    expect(split.sheets[0].merges).toEqual([]);
    expect(split.sheets[0].cells.F1).toEqual({ input: '合并标题', bold: true });
    expect(original.sheets[0].merges).toBeUndefined();
  });

  it('filters calculated values without modifying data, and chart data follows the visible rows', () => {
    let document = dataFixture();
    document = studioAddChart(document, 'main', 'A1:C4', 'bar');
    document = studioSetFilter(document, 'main', {
      range: 'A1:C4',
      columns: { C: { operator: 'greater', value: '30' } },
    });
    const calculation = studioCalculate(document);
    expect([...studioFilteredRows(document.sheets[0], calculation)]).toEqual([3]);
    expect(studioChartData(document.sheets[0], document.sheets[0].charts![0], calculation)).toEqual(
      {
        categories: ['开发', '验证'],
        series: [
          { name: '金额', values: [20, 30] },
          { name: '小计', values: [40, 60] },
        ],
      }
    );
    expect(document.sheets[0].cells.C3.input).toBe('=B3*2');
    expect(() =>
      studioSetFilter(document, 'main', {
        range: 'A1:B4',
        columns: { C: { operator: 'contains', value: '2' } },
      })
    ).toThrow('筛选条件');
    expect(studioFilteredRows(studioSetFilter(document, 'main').sheets[0], calculation).size).toBe(
      0
    );
  });

  it('sorts complete rows by calculated values, relocates relative formulas, and preserves absolute references and formula strings', () => {
    const original = dataFixture();
    const sorted = studioSortRange(original, 'main', selection, 2, 'asc');
    expect(sorted.sheets[0].cells.A1.input).toBe('项目');
    expect(sorted.sheets[0].cells.A2.input).toBe('设计');
    expect(sorted.sheets[0].cells.C2.input).toBe('=B2*2');
    expect(studioCalculate(sorted).values.get('main:C2')).toBe(20);
    expect(sorted.sheets[0].cells.A4.input).toBe('验证');
    expect(original.sheets[0].cells.A2.input).toBe('开发');
    expect(studioTranslateFormula('=IF(A2>0,"A2",$B2+C$2+$D$2+\'报价 表\'!A2)', 3, 1)).toBe(
      '=IF(B5>0,"A2",$B5+D$2+$D$2+\'报价 表\'!B5)'
    );
    expect(studioTranslateFormula('=LOG10(A1)', 1, 0)).toBe('=LOG10(A2)');
    expect(() => studioTranslateFormula('=SUM(A:A)', 1, 0)).toThrow('不能安全移动');
  });

  it('preserves whitespace-separated function names and non-address identifiers while validating reference limits', () => {
    expect(studioTranslateFormula('=LOG10 (A1)+ZZZ1+XFE1+A1048577', 1, 1)).toBe(
      '=LOG10 (B2)+ZZZ1+XFE1+A1048577'
    );
    expect(studioTranslateFormula('=IF(A1>0,"say ""A1""",\'A1 表\'!$B2)', 1, 1)).toBe(
      '=IF(B2>0,"say ""A1""",\'A1 表\'!$B3)'
    );
    expect(() => studioTranslateFormula('=XFD1048576', 1, 0)).toThrow('超出工作表');
    expect(() => studioTranslateFormula('=A1', 0, -1)).toThrow('超出工作表');
    expect(() => studioTranslateFormula('=A1', 0.5, 0)).toThrow('整数');
    for (const formula of [
      '=SUM($A:$B)',
      '=SUM(A : $B)',
      '=SUM($1 : $3)',
      '=SUM([Book.xlsx]Sheet1!A1)',
    ])
      expect(() => studioTranslateFormula(formula, 1, 1)).toThrow('不能安全移动');
  });

  it('validates native chart inputs and does not mutate the document when data is invalid', () => {
    const original = dataFixture();
    expect(() => studioAddChart(original, 'main', 'A1:A4', 'bar')).toThrow('图表区域');
    original.sheets[0].cells.C3.input = '未填';
    expect(() => studioAddChart(original, 'main', 'A1:C4', 'bar')).toThrow('数字');
    expect(original.sheets[0].charts).toBeUndefined();
  });

  it('keeps cross-sheet record references attached while sorting and refuses unsafe cross-row dependencies', () => {
    const document = dataFixture();
    document.sheets[1].cells = { A2: { input: '100' }, A3: { input: '200' } };
    document.sheets[0].cells.C2.input = "='报价 表'!A2+B2";
    document.sheets[0].cells.C3.input = "='报价 表'!A3+B3";
    const sorted = studioSortRange(document, 'main', selection, 2, 'asc');
    expect(sorted.sheets[0].cells.C2.input).toBe("='报价 表'!A3+B2");
    expect(studioCalculate(sorted).values.get('main:C2')).toBe(210);
    document.sheets[0].cells.C3.input = '=B2+B3';
    expect(() => studioSortRange(document, 'main', selection, 2, 'asc')).toThrow('跨行');
    expect(document.sheets[0].cells.A2.input).toBe('开发');
    expect(studioTranslateFormula('=IF(A1>0,"A:A",B1)', 1, 0)).toBe('=IF(A2>0,"A:A",B2)');
  });
});

describe('Office Studio rule calculation and guarded changes', () => {
  it('reads calculated scalar values and missing cells without putting invalid rule addresses in the cell error map', () => {
    const calculation = studioCalculate(fixture());
    expect(calculation.read('main', '$B$1')).toEqual({ value: 30 });
    expect(calculation.read('other', 'A1')).toEqual({ value: 16 });
    expect(calculation.read('main', 'A3')).toEqual({ value: '' });
    expect(calculation.read('missing', 'A1')).toEqual({ error: '#REF!' });
    expect(calculation.read('main', 'A0')).toEqual({ error: '#REF!' });
    expect(calculation.errors.size).toBe(0);
  });

  it('evaluates relative rule formulas at their origin and keeps rule errors separate from cell errors', () => {
    const calculation = studioCalculate(fixture());
    const position = { row: 2, col: 3 };
    expect(calculation.evaluate('main', '=B1*2+$A$1', position, { row: 1, col: 3 })).toEqual({
      value: 40,
    });
    expect(calculation.evaluate('main', 'ROW()+COLUMN()', { row: 7, col: 3 })).toEqual({
      value: 10,
    });
    expect(calculation.evaluate('main', "=SUM('报价 表'!A1,Sheet1!B1)", position)).toEqual({
      value: 46,
    });
    expect(calculation.evaluate('main', '=1/0', position)).toEqual({ error: '#DIV/0!' });
    expect(calculation.evaluate('main', '=REPT("x",1000000000)', position)).toEqual({
      error: '#LIMIT!',
    });
    expect(calculation.evaluate('main', '=B1*2+$A$1', position)).toEqual({ value: 70 });
    expect(calculation.evaluate('missing', '=1', position)).toEqual({ error: '#REF!' });
    expect(calculation.evaluate('main', '=1', { row: 0, col: 1 })).toEqual({ error: '#REF!' });
    expect(calculation.errors.size).toBe(0);
    expect(calculation.values.get('main:C1')).toBe(70);
  });

  it('returns complete source arrays with real blanks, rejects source errors and recovers the evaluation parser', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '10' },
      A2: { input: '=A1*2' },
      A4: { input: '=1/0' },
    };
    document.sheets[1].cells = {};
    const calculation = studioCalculate(document);
    const position = { row: 1, col: 2 };
    expect(calculation.evaluate('main', '=$A$1:$A$3', position, undefined, true)).toEqual({
      value: [[10], [20], [null]],
    });
    expect(calculation.evaluate('main', '=$A$1:$A$4', position, undefined, true)).toEqual({
      error: '#DIV/0!',
    });
    expect(calculation.evaluate('main', '=ISERROR(A4)', position)).toEqual({ value: true });
    expect(calculation.evaluate('main', '=SUM(A1:A3)', position)).toEqual({ value: 30 });
    expect(calculation.errors).toEqual(new Map([['main:A4', '#DIV/0!']]));
  });

  it('rejects late oversized or malformed input and oversized batches without changing earlier cells', () => {
    const original = fixture();
    for (const input of ['x'.repeat(32768), 123 as unknown as string])
      expect(() =>
        studioPatchCells(original, 'main', {
          A1: { input: 'new first value' },
          A2: { input },
        })
      ).toThrow('32,767');
    const maximum = studioPatchCells(original, 'main', { A2: { input: 'x'.repeat(32767) } });
    expect(maximum.sheets[0].cells.A2.input).toHaveLength(32767);
    const updates = Object.fromEntries(
      Array.from({ length: 10001 }, (_, index) => ['A' + (index + 1), { input: 'value' }])
    );
    expect(() => studioPatchCells(original, 'main', updates)).toThrow('10,000');
    expect(original.sheets[0].cells.A1).toEqual({ input: '10', bold: true });
    expect(original.sheets[0].cells.A2.input).toBe('20');
  });

  it('replaces all direct formats while preserving complete metadata and returns the original for a no-op', () => {
    const original = fixture();
    original.sheets[0].cells.A1 = {
      input: '10',
      bold: true,
      italic: true,
      underline: true,
      fontFamily: 'Calibri',
      fontSize: 12,
      color: '#ff0000',
      background: '#ffffff',
      numberFormat: '@',
      align: 'right',
    };
    original.sheets[0].conditionalFormats = [
      {
        id: 'format',
        range: 'A1:A1',
        priority: 1,
        type: 'containsText',
        text: '10',
        style: { background: '#00ff00' },
      },
    ];
    const replaced = studioPatchCells(original, 'main', { A1: { input: '10' } }, { replace: true });
    expect(replaced.sheets[0].cells.A1).toEqual({ input: '10' });
    expect(replaced.sheets[0].conditionalFormats).toBe(original.sheets[0].conditionalFormats);
    expect(studioPatchCells(replaced, 'main', { A1: { input: '10' } })).toBe(replaced);
    expect(original.sheets[0].cells.A1.numberFormat).toBe('@');
  });

  it.each([
    '=INDIRECT("A1")',
    '=OFFSET(A1,1,0)',
    '=_xlfn.INDIRECT("A1")',
    '=SUM(Sheet1:Sheet2!A1)',
    "=SUM('Sheet1:Sheet2'!A1)",
    "='[Book.xlsx]Sheet1'!A1",
    '=A1#',
    '=@A1',
    '=Sheet1!R1C1',
    '=IF(A1>0,"open',
    "='open!A1",
    '=SUM(A1:Sheet1!A2)',
  ])('refuses unsafe copied formulas: %s', (formula) => {
    expect(() => studioTranslateFormula(formula, 1, 1)).toThrow('不能安全移动');
  });

  it('ignores formula-like string contents and double quotes within valid sheet names and cancels a late unsafe paste', () => {
    expect(
      studioTranslateFormula(
        '=IF(A1>0,"INDIRECT(A1) A1# @A1 R1C1 Sheet1:Sheet2!A1",\'Review "Plan\'!A1+#REF!)',
        1,
        1
      )
    ).toBe('=IF(B2>0,"INDIRECT(A1) A1# @A1 R1C1 Sheet1:Sheet2!A1",\'Review "Plan\'!B2+#REF!)');
    const original = fixture();
    expect(() =>
      studioPasteCells(original, 'main', { row: 2, col: 1 }, 'new\t=OFFSET(A1,1,0)', {
        row: 1,
        col: 1,
      })
    ).toThrow('不能安全移动');
    expect(original.sheets[0].cells.A2.input).toBe('20');
    expect(original.sheets[0].cells.B2.input).toBe('=AVERAGE(A1:A2)');
  });
});
