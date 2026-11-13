import { describe, expect, it } from 'vitest';
import { isOfficeStudioDocument } from './studio-model';
import { studioPatchCells } from './studio-sheet-model';
import {
  studioApplyBorders,
  studioDefaultCellFormat,
  studioFindSheetCells,
  studioReplaceSheetCells,
  studioSetColumnWidths,
  type StudioSheetSearchOptions,
} from './studio-sheet-editing';
import type { StudioExcelDocument } from './studio-types';

function fixture(): StudioExcelDocument {
  return {
    version: 1,
    id: 'editing',
    kind: 'excel',
    name: '编辑.xlsx',
    activeSheetId: 'a',
    sheets: [
      {
        id: 'a',
        name: '明细',
        rowCount: 20,
        columnCount: 30,
        cells: {
          A1: { input: 'Alpha alpha' },
          B1: { input: '1000', numberFormat: '#,##0' },
          A2: { input: 'alpha' },
          B2: { input: '=SUM(B1,2)' },
          C3: { input: 'a*b?' },
        },
      },
      { id: 'b', name: '汇总', rowCount: 10, columnCount: 3, cells: { A1: { input: 'ALPHA' } } },
    ],
  };
}
const options: StudioSheetSearchOptions = {
  query: 'alpha',
  scope: 'sheet',
  sheetId: 'a',
  lookIn: 'formulas',
};

describe('sheet Office editing behavior', () => {
  it('searches frozen rectangular ranges, case, whole cells and workbook scan order', () => {
    const document = fixture();
    expect(studioFindSheetCells(document, options).map((match) => match.address)).toEqual([
      'A1',
      'A2',
    ]);
    expect(
      studioFindSheetCells(document, { ...options, wholeCell: true, matchCase: true }).map(
        (match) => match.address
      )
    ).toEqual(['A2']);
    expect(
      studioFindSheetCells(document, { ...options, scope: 'workbook' }).map(
        (match) => match.sheetId
      )
    ).toEqual(['a', 'a', 'b']);
    expect(
      studioFindSheetCells(document, {
        ...options,
        scope: 'selection',
        selection: { anchor: { row: 2, col: 1 }, focus: { row: 4, col: 2 } },
      }).map((match) => match.address)
    ).toEqual(['A2']);
    expect(
      studioFindSheetCells(document, { ...options, query: '*', order: 'columns' }).map(
        (match) => match.address
      )
    ).toEqual(['A1', 'A2', 'B1', 'B2', 'C3']);
  });

  it('supports literal regex punctuation, escaped wildcards and Unicode single characters', () => {
    const document = fixture();
    document.sheets[0].cells.D1 = { input: '😀x.txt' };
    expect(
      studioFindSheetCells(document, { ...options, query: 'a~*b~?', wholeCell: true }).map(
        (match) => match.address
      )
    ).toEqual(['C3']);
    expect(
      studioFindSheetCells(document, { ...options, query: '?x.txt', wholeCell: true }).map(
        (match) => match.address
      )
    ).toEqual(['D1']);
    expect(
      studioFindSheetCells(document, { ...options, query: 'SUM(B1,2)' }).map(
        (match) => match.address
      )
    ).toEqual(['B2']);
    expect(
      studioFindSheetCells(document, { ...options, query: 'a*ha', wholeCell: true }).map(
        (match) => match.address
      )
    ).toEqual(['A1', 'A2']);
    expect(() => studioFindSheetCells(document, { ...options, query: '?'.repeat(257) })).toThrow(
      /复杂/
    );
  });

  it('replaces all occurrences literally and treats replacement dollars as text', () => {
    const document = fixture();
    const result = studioReplaceSheetCells(document, { ...options, scope: 'workbook' }, '$&');
    expect(result.changed).toBe(3);
    expect(result.document.sheets[0].cells.A1.input).toBe('$& $&');
    expect(result.document.sheets[1].cells.A1.input).toBe('$&');
    expect(document.sheets[0].cells.A1.input).toBe('Alpha alpha');
    expect(result.document.activeSheetId).toBe('a');
    expect(
      studioReplaceSheetCells(document, options, 'beta', { sheetId: 'a', address: 'A2' }).changed
    ).toBe(1);
  });

  it('never replaces calculated values inside formulas and reports formatted number skips', () => {
    const document = fixture();
    const formula = studioReplaceSheetCells(
      document,
      { ...options, query: '1002', lookIn: 'values' },
      '0'
    );
    expect(formula.changed).toBe(0);
    expect(formula.skipped).toBe(1);
    expect(formula.document).toBe(document);
    const numeric = studioReplaceSheetCells(
      document,
      { ...options, query: '1,000', lookIn: 'values' },
      '0'
    );
    expect(numeric.changed).toBe(0);
    expect(numeric.skipped).toBe(1);
    expect(
      studioReplaceSheetCells(document, { ...options, query: 'SUM', lookIn: 'formulas' }, 'MAX')
        .document.sheets[0].cells.B2.input
    ).toBe('=MAX(B1,2)');
  });

  it('preserves leading apostrophe text and allows empty replacements', () => {
    const document = fixture();
    document.sheets[0].cells.A2.input = "'alpha";
    expect(studioReplaceSheetCells(document, options, '=1').document.sheets[0].cells.A2.input).toBe(
      "'=1"
    );
    expect(
      studioReplaceSheetCells(document, { ...options, wholeCell: true }, '').document.sheets[0]
        .cells.A2.input
    ).toBe("'");
  });

  it('keeps original string offsets when Unicode case folding expands a character', () => {
    const document = fixture();
    document.sheets[0].cells.D1 = { input: 'İ😀tail' };
    const result = studioReplaceSheetCells(document, { ...options, query: 'İ😀' }, 'X');
    expect(result.document.sheets[0].cells.D1.input).toBe('Xtail');
  });

  it('cancels all replacements when any destination validation fails', () => {
    const document = fixture();
    document.sheets[1].dataValidations = [
      {
        id: 'list',
        range: 'A1',
        type: 'list',
        values: ['ALPHA', 'BETA'],
        showErrorMessage: true,
        errorStyle: 'stop',
      },
    ];
    expect(() =>
      studioReplaceSheetCells(document, { ...options, scope: 'workbook' }, 'invalid')
    ).toThrow(/全部替换已取消/);
    expect(document.sheets[0].cells.A2.input).toBe('alpha');
    expect(document.sheets[1].cells.A1.input).toBe('ALPHA');
  });

  it('validates dependent list sources against the final workbook', () => {
    const document = fixture();
    document.sheets[1].cells.A1.input = 'alpha';
    document.sheets[1].dataValidations = [
      {
        id: 'source',
        range: 'A1',
        type: 'list',
        source: "'明细'!$A$2",
        showErrorMessage: true,
        errorStyle: 'stop',
      },
    ];
    const result = studioReplaceSheetCells(document, { ...options, scope: 'workbook' }, 'beta');
    expect(result.document.sheets[1].cells.A1.input).toBe('beta');
    expect(result.document.sheets[0].cells.A2.input).toBe('beta');
  });

  it('rejects batch limits and oversized replacement cells before changing source content', () => {
    const document = fixture();
    expect(() => studioReplaceSheetCells(document, options, 'x'.repeat(32768))).toThrow(/32,767/);
    expect(document.sheets[0].cells.A2.input).toBe('alpha');
  });

  it('applies outer edges and expands clicked merged cells before formatting', () => {
    const document = fixture();
    document.sheets[0].merges = ['D4:E5'];
    const updated = studioApplyBorders(
      document,
      'a',
      { anchor: { row: 4, col: 4 }, focus: { row: 4, col: 4 } },
      'outer',
      { style: 'double', color: '#ff0000' }
    );
    expect(updated.sheets[0].cells.D4.borders).toEqual({
      top: { style: 'double', color: '#ff0000' },
      left: { style: 'double', color: '#ff0000' },
    });
    expect(updated.sheets[0].cells.E5.borders).toEqual({
      bottom: { style: 'double', color: '#ff0000' },
      right: { style: 'double', color: '#ff0000' },
    });
    const cleared = studioApplyBorders(
      updated,
      'a',
      { anchor: { row: 4, col: 4 }, focus: { row: 5, col: 5 } },
      'none',
      undefined
    );
    expect(cleared.sheets[0].cells.E5.borders).toEqual({});
    expect(document.sheets[0].cells.D4).toBeUndefined();
  });

  it('clears formats while retaining contents, hyperlinks and rules', () => {
    const document = fixture();
    document.sheets[0].cells.A2 = {
      input: 'alpha',
      bold: true,
      align: 'center',
      background: '#ff0000',
      borders: { bottom: { style: 'thick' } },
    };
    document.sheets[0].hyperlinks = [{ id: 'link', ref: 'A2', target: 'https://example.com' }];
    const updated = studioPatchCells(document, 'a', { A2: studioDefaultCellFormat() });
    expect(updated.sheets[0].cells.A2).toMatchObject({
      input: 'alpha',
      bold: false,
      align: 'general',
      background: 'none',
      borders: {},
    });
    expect(updated.sheets[0].hyperlinks).toEqual(document.sheets[0].hyperlinks);
    expect(isOfficeStudioDocument(updated)).toBe(true);
  });

  it('rejects malformed border models in editing and persisted documents', () => {
    const document = fixture();
    const bad = { borders: { top: { style: 'thin', color: 'red;position:fixed' } } } as never;
    expect(() => studioPatchCells(document, 'a', { A1: bad })).toThrow(/边框/);
    document.sheets[0].cells.A1 = { input: '', ...(bad as object) };
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('sets character-derived widths on columns beyond the initial extent without losing other widths', () => {
    const document = fixture();
    document.sheets[0].columnWidths = { A: 200 };
    const updated = studioSetColumnWidths(document, 'a', { AA: 145, AZ: 12 });
    expect(updated.sheets[0].columnCount).toBe(52);
    expect(updated.sheets[0].columnWidths).toEqual({ A: 200, AA: 145, AZ: 12 });
    expect(isOfficeStudioDocument(updated)).toBe(true);
    expect(() => studioSetColumnWidths(document, 'a', { A: 0 })).toThrow(/列宽/);
    expect(() => studioSetColumnWidths(document, 'a', { IW: 100 })).toThrow(/列宽/);
    expect(studioSetColumnWidths(updated, 'a', { AA: 145 })).toBe(updated);
  });
});
