import { describe, expect, it } from 'vitest';
import { isOfficeStudioDocument } from './studio-model';
import { studioCalculate } from './studio-sheet-model';
import {
  studioCellValidation,
  studioConditionalCellStyle,
  studioSetConditionalFormat,
  studioSetDataValidation,
} from './studio-sheet-rules';
import {
  studioChangeSheetStructure,
  studioTransformSheetIndex,
  studioTransformSheetRange,
} from './studio-sheet-structure';
import type { StudioExcelDocument, StudioSheetStructureEdit } from './studio-types';

function fixture(): StudioExcelDocument {
  return {
    version: 1,
    id: 'book',
    name: '预算.xlsx',
    kind: 'excel',
    activeSheetId: 'other',
    sheets: [
      {
        id: 'main',
        name: 'Sheet1',
        rowCount: 8,
        columnCount: 6,
        cells: {
          A1: { input: '标题' },
          A2: { input: '10', bold: true, color: '#123456' },
          A4: { input: '20' },
          B2: { input: '=SUM(A2:A4)' },
          C2: { input: '=B2+$A$2' },
          D5: { input: '末尾' },
        },
        columnWidths: { B: 140, F: 96 },
      },
      {
        id: 'other',
        name: '汇总',
        rowCount: 8,
        columnCount: 6,
        cells: {
          A1: { input: '=Sheet1!$C$2+SUM(Sheet1!A2:A4)+A2', italic: true },
          A2: { input: '3' },
        },
      },
      {
        id: 'untouched',
        name: '保留',
        rowCount: 8,
        columnCount: 6,
        cells: { A1: { input: '保留' } },
      },
    ],
  };
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

function metadataFixture() {
  const document = fixture();
  Object.assign(document.sheets[0], {
    merges: ['A2:B3', 'D5:F5'],
    freeze: { rows: 1, columns: 0 },
    filter: {
      range: 'A1:C7',
      columns: {
        B: { operator: 'contains', value: '通过' },
        C: { operator: 'greater', value: '10' },
      },
    },
    charts: [{ id: 'chart', type: 'bar', title: '趋势', range: 'D1:F4' }],
  });
  document.sheets[0].cells = {
    A1: { input: '标题' },
    A2: { input: '合并内容', bold: true },
    A3: { input: '', background: '#abcdef' },
    D5: { input: '第二个合并区域' },
  };
  document.sheets[1].cells = { A1: { input: '不含公式' } };
  return document;
}

describe('Office Studio row and column structure', () => {
  it('preserves point-size fonts across row and column insertion and deletion', () => {
    const original = fixture();
    original.sheets[0].cells.A2 = {
      ...original.sheets[0].cells.A2,
      fontFamily: 'Custom "Font";\\Family',
      fontSize: 11.5,
    };
    freezeDeep(original);
    const rows = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 1,
    });
    const columns = studioChangeSheetStructure(rows, 'main', {
      axis: 'column',
      type: 'insert',
      index: 1,
      count: 1,
    });
    expect(columns.sheets[0].cells.B3).toEqual(original.sheets[0].cells.A2);
    const deleteRow = studioChangeSheetStructure(columns, 'main', {
      axis: 'row',
      type: 'delete',
      index: 1,
      count: 1,
    });
    const deleteColumn = studioChangeSheetStructure(deleteRow, 'main', {
      axis: 'column',
      type: 'delete',
      index: 1,
      count: 1,
    });
    expect(deleteColumn.sheets[0].cells.A2).toEqual(original.sheets[0].cells.A2);
    expect(original.sheets[0].cells.A2.fontSize).toBe(11.5);
    expect(isOfficeStudioDocument(deleteColumn)).toBe(true);
  });

  it('inserts rows immutably and retains calculations across sheets and absolute references', () => {
    const original = freezeDeep(fixture());
    const before = studioCalculate(original).values.get('other:A1');
    const edit = freezeDeep<StudioSheetStructureEdit>({
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 2,
    });
    const result = studioChangeSheetStructure(original, 'main', edit);
    const sheet = result.sheets[0];
    expect(sheet.rowCount).toBe(10);
    expect(sheet.cells.A2).toBeUndefined();
    expect(sheet.cells.A4).toEqual({ input: '10', bold: true, color: '#123456' });
    expect(sheet.cells.A6.input).toBe('20');
    expect(sheet.cells.B4.input).toBe('=SUM(A4:A6)');
    expect(sheet.cells.C4.input).toBe('=B4+$A$4');
    expect(sheet.cells.D7.input).toBe('末尾');
    expect(result.sheets[1].cells.A1).toEqual({
      input: '=Sheet1!$C$4+SUM(Sheet1!A4:A6)+A2',
      italic: true,
    });
    expect(studioCalculate(result).values.get('other:A1')).toBe(before);
    expect(result.activeSheetId).toBe('other');
    expect(result.sheets[2]).toBe(original.sheets[2]);
    expect(sheet.columnWidths).toBe(original.sheets[0].columnWidths);
    expect(sheet.structureEdits).toEqual([edit]);
    expect(sheet.structureEdits![0]).not.toBe(edit);
    expect(original.sheets[0].rowCount).toBe(8);
    expect(original.sheets[0].cells.A2.input).toBe('10');
    expect(original.sheets[0]).not.toHaveProperty('structureEdits');
    expect(isOfficeStudioDocument(result)).toBe(true);
  });

  it('inserts columns and moves widths and references, including blank trailing columns', () => {
    const original = freezeDeep(fixture());
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'column',
      type: 'insert',
      index: 2,
      count: 2,
    });
    expect(result.sheets[0].columnCount).toBe(8);
    expect(result.sheets[0].cells.B2).toBeUndefined();
    expect(result.sheets[0].cells.D2.input).toBe('=SUM(A2:A4)');
    expect(result.sheets[0].cells.E2.input).toBe('=D2+$A$2');
    expect(result.sheets[0].columnWidths).toEqual({ D: 140, H: 96 });
    expect(result.sheets[1].cells.A1.input).toBe('=Sheet1!$E$2+SUM(Sheet1!A2:A4)+A2');
    expect(original.sheets[0].columnWidths).toEqual({ B: 140, F: 96 });
    const appended = studioChangeSheetStructure(result, 'main', {
      axis: 'column',
      type: 'insert',
      index: 9,
      count: 1,
    });
    expect(appended.sheets[0].columnCount).toBe(9);
    expect(appended.sheets[0].columnWidths).toEqual({ D: 140, H: 96 });
    expect(appended.sheets[1]).toBe(result.sheets[1]);
  });

  it('deletes rows, shrinks referenced ranges, and replaces deleted absolute cells with REF errors', () => {
    const original = freezeDeep(fixture());
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 2,
    });
    expect(result.sheets[0].rowCount).toBe(6);
    expect(result.sheets[0].cells.A2.input).toBe('20');
    expect(result.sheets[0].cells.B2).toBeUndefined();
    expect(result.sheets[0].cells.D3.input).toBe('末尾');
    expect(result.sheets[1].cells.A1.input).toBe('=#REF!+SUM(Sheet1!A2:A2)+A2');
    expect(original.sheets[1].cells.A1.input).toBe('=Sheet1!$C$2+SUM(Sheet1!A2:A4)+A2');
  });

  it('deletes column widths rather than copying deleted widths into surviving columns', () => {
    const result = studioChangeSheetStructure(freezeDeep(fixture()), 'main', {
      axis: 'column',
      type: 'delete',
      index: 2,
      count: 2,
    });
    expect(result.sheets[0].columnCount).toBe(4);
    expect(result.sheets[0].columnWidths).toEqual({ D: 96 });
    expect(result.sheets[0].cells.B5.input).toBe('末尾');
    expect(result.sheets[1].cells.A1.input).toBe('=#REF!+SUM(Sheet1!A2:A4)+A2');
    const original = fixture();
    original.sheets[0].columnWidths = { B: 140 };
    expect(
      studioChangeSheetStructure(original, 'main', {
        axis: 'column',
        type: 'delete',
        index: 2,
        count: 1,
      }).sheets[0]
    ).not.toHaveProperty('columnWidths');
  });

  it('preserves escaped sheet names, escaped string quotes, lowercase names, and function names', () => {
    const document = fixture();
    document.sheets[0].name = "预算 O'Brien";
    document.sheets[0].cells = {
      A1: { input: '10' },
      B6: {
        input:
          '=IF(A1>0,"他说""A1""和[Table] OFFSET R1C1 A:A",LOG10 (A1)+$B$2+\'预算 O\'\'Brien\'!C$3)',
      },
    };
    document.sheets[1].cells = {
      A1: { input: "=SUM('预算 O''Brien'!$A2:$A$5)+'预算 o''brien'!B2+A2" },
    };
    const result = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 2,
    });
    expect(result.sheets[0].cells.B8.input).toBe(
      '=IF(A1>0,"他说""A1""和[Table] OFFSET R1C1 A:A",LOG10 (A1)+$B$4+\'预算 O\'\'Brien\'!C$5)'
    );
    expect(result.sheets[1].cells.A1.input).toBe(
      "=SUM('预算 O''Brien'!$A4:$A$7)+'预算 o''brien'!B4+A2"
    );
  });

  it('preserves reversed range direction and each dollar marker when deletion trims an endpoint', () => {
    const document = fixture();
    document.sheets[0].cells = { F8: { input: '=SUM($D$6:$A$2)+SUM($A$2:$D6)' } };
    document.sheets[1].cells = {};
    const row = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'delete',
      index: 3,
      count: 3,
    });
    expect(row.sheets[0].cells.F5.input).toBe('=SUM($D$3:$A$2)+SUM($A$2:$D3)');
    const column = studioChangeSheetStructure(row, 'main', {
      axis: 'column',
      type: 'delete',
      index: 2,
      count: 3,
    });
    expect(column.sheets[0].cells.C5.input).toBe('=SUM($A$3:$A$2)+SUM($A$2:$A3)');
    expect(column.sheets[0].structureEdits).toHaveLength(2);
    expect(isOfficeStudioDocument(column)).toBe(true);
  });

  it('uses REF for completely deleted ranges while retaining existing error tokens on subsequent edits', () => {
    const document = fixture();
    document.sheets[0].cells = {};
    document.sheets[1].cells = {
      A1: { input: '=SUM(Sheet1!$A$2:$B$3)+IFERROR(Sheet1!#REF!,0)+#DIV/0!' },
    };
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 2,
    });
    expect(result.sheets[1].cells.A1.input).toBe('=SUM(#REF!)+IFERROR(Sheet1!#REF!,0)+#DIV/0!');
    expect(
      studioChangeSheetStructure(result, 'main', {
        axis: 'row',
        type: 'insert',
        index: 1,
        count: 1,
      }).sheets[1]
    ).toBe(result.sheets[1]);
  });

  it('adjusts legal Excel references beyond the rendered sheet without expanding actual dimensions', () => {
    const document = fixture();
    document.sheets[0].cells = { A1: { input: '=COUNTBLANK(A1:A500)' } };
    document.sheets[1].cells = {};
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].cells.A1.input).toBe('=COUNTBLANK(A1:A501)');
    expect(result.sheets[0].rowCount).toBe(9);
  });

  it('retains numeric constants, boolean constants, scientific notation and function identifiers', () => {
    const document = fixture();
    document.sheets[0].cells = { F8: { input: '=IF(TRUE,ATAN2(A2,1E+3)+LOG10(A2)+1e3+.5,FALSE)' } };
    document.sheets[1].cells = {};
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].cells.F9.input).toBe('=IF(TRUE,ATAN2(A3,1E+3)+LOG10(A3)+1e3+.5,FALSE)');
  });

  it('retains comparison operators in conditional formulas during structural changes', () => {
    const document = fixture();
    document.sheets[0].cells = { F8: { input: '=IF(A2>0,IF(B2>=1,C2<=3),IF(D2<>0,E2<5,FALSE))' } };
    document.sheets[1].cells = {};
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].cells.F9.input).toBe('=IF(A3>0,IF(B3>=1,C3<=3),IF(D3<>0,E3<5,FALSE))');
  });

  it('adjusts whole-column formulas and cross-sheet ranges while preserving absolute markers', () => {
    const document = fixture();
    document.sheets[0].cells = { F8: { input: '=SUM($B:$D)+SUM(A:A)+COUNT($1:$3)' } };
    document.sheets[1].cells = { A1: { input: "=SUM(Sheet1!$B:$D)+SUM('Sheet1'!A:C)+SUM(A:C)" } };
    const inserted = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'column',
      type: 'insert',
      index: 3,
      count: 1,
    });
    expect(inserted.sheets[0].cells.G8.input).toBe('=SUM($B:$E)+SUM(A:A)+COUNT($1:$3)');
    expect(inserted.sheets[1].cells.A1.input).toBe("=SUM(Sheet1!$B:$E)+SUM('Sheet1'!A:D)+SUM(A:C)");
    const deleted = studioChangeSheetStructure(inserted, 'main', {
      axis: 'column',
      type: 'delete',
      index: 2,
      count: 4,
    });
    expect(deleted.sheets[0].cells.C8.input).toBe('=SUM(#REF!)+SUM(A:A)+COUNT($1:$3)');
    expect(deleted.sheets[1].cells.A1.input).toBe("=SUM(#REF!)+SUM('Sheet1'!A:A)+SUM(A:C)");
  });

  it('shrinks reversed whole-row formulas and handles quoted cross-sheet row ranges', () => {
    const document = fixture();
    document.sheets[0].name = "预算 O'Brien";
    document.sheets[0].cells = { F8: { input: '=SUM($6:$2)+COUNT($2:$4)' } };
    document.sheets[1].cells = { A1: { input: "=SUM('预算 O''Brien'!$1:$6)+SUM($1:$6)" } };
    const result = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 3,
    });
    expect(result.sheets[0].cells.F5.input).toBe('=SUM($3:$2)+COUNT(#REF!)');
    expect(result.sheets[1].cells.A1.input).toBe("=SUM('预算 O''Brien'!$1:$3)+SUM($1:$6)");
  });
});

describe('Office Studio structural metadata', () => {
  it('expands merges, chart data and filters when inserting inside their ranges', () => {
    const original = freezeDeep(metadataFixture());
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'insert',
      index: 3,
      count: 2,
    });
    expect(result.sheets[0].merges).toEqual(['A2:B5', 'D7:F7']);
    expect(result.sheets[0].filter?.range).toBe('A1:C9');
    expect(result.sheets[0].charts?.[0].range).toBe('D1:F6');
    expect(result.sheets[0].freeze).toEqual({ rows: 1, columns: 0 });
    expect(result.sheets[1]).toBe(original.sheets[1]);
    expect(original.sheets[0].merges).toEqual(['A2:B3', 'D5:F5']);
  });

  it('moves filter conditions and chart ranges when inserting columns', () => {
    const result = studioChangeSheetStructure(freezeDeep(metadataFixture()), 'main', {
      axis: 'column',
      type: 'insert',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].merges).toEqual(['A2:C3', 'E5:G5']);
    expect(result.sheets[0].filter).toEqual({
      range: 'A1:D7',
      columns: {
        C: { operator: 'contains', value: '通过' },
        D: { operator: 'greater', value: '10' },
      },
    });
    expect(result.sheets[0].charts?.[0].range).toBe('E1:G4');
  });

  it('shrinks a merge after deleting its master without transferring deleted content', () => {
    const result = studioChangeSheetStructure(freezeDeep(metadataFixture()), 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].merges).toEqual(['A2:B2', 'D4:F4']);
    expect(result.sheets[0].cells.A2).toEqual({ input: '', background: '#abcdef' });
    expect(result.sheets[0].filter?.range).toBe('A1:C6');
    expect(result.sheets[0].charts?.[0].range).toBe('D1:F3');
    expect(result.sheets[0].freeze).toEqual({ rows: 1, columns: 0 });
  });

  it('removes merges that become a single cell or disappear completely', () => {
    const single = fixture();
    single.sheets[0].merges = ['A2:B2'];
    single.sheets[0].cells = { A2: { input: '合并主格' }, F8: { input: '保留' } };
    const collapsed = studioChangeSheetStructure(freezeDeep(single), 'main', {
      axis: 'column',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(collapsed.sheets[0]).not.toHaveProperty('merges');
    const entire = fixture();
    entire.sheets[0].merges = ['A2:B3'];
    entire.sheets[0].cells = { A2: { input: '合并主格' }, F8: { input: '保留' } };
    expect(
      studioChangeSheetStructure(freezeDeep(entire), 'main', {
        axis: 'row',
        type: 'delete',
        index: 2,
        count: 2,
      }).sheets[0]
    ).not.toHaveProperty('merges');
  });

  it('clears a filter or chart when its header row is deleted', () => {
    const result = studioChangeSheetStructure(freezeDeep(metadataFixture()), 'main', {
      axis: 'row',
      type: 'delete',
      index: 1,
      count: 1,
    });
    expect(result.sheets[0]).not.toHaveProperty('filter');
    expect(result.sheets[0]).not.toHaveProperty('charts');
  });

  it('clears charts when their category column or all series are deleted', () => {
    const document = freezeDeep(metadataFixture());
    expect(
      studioChangeSheetStructure(document, 'main', {
        axis: 'column',
        type: 'delete',
        index: 4,
        count: 1,
      }).sheets[0]
    ).not.toHaveProperty('charts');
    expect(
      studioChangeSheetStructure(document, 'main', {
        axis: 'column',
        type: 'delete',
        index: 5,
        count: 2,
      }).sheets[0]
    ).not.toHaveProperty('charts');
  });

  it('drops deleted filter rules and clears filters with no data or no columns', () => {
    const document = freezeDeep(metadataFixture());
    expect(
      studioChangeSheetStructure(document, 'main', {
        axis: 'column',
        type: 'delete',
        index: 2,
        count: 1,
      }).sheets[0].filter
    ).toEqual({
      range: 'A1:B7',
      columns: { B: { operator: 'greater', value: '10' } },
    });
    expect(
      studioChangeSheetStructure(document, 'main', {
        axis: 'column',
        type: 'delete',
        index: 1,
        count: 3,
      }).sheets[0]
    ).not.toHaveProperty('filter');
    expect(
      studioChangeSheetStructure(document, 'main', {
        axis: 'row',
        type: 'delete',
        index: 2,
        count: 6,
      }).sheets[0]
    ).not.toHaveProperty('filter');
  });

  it('moves freeze boundaries and always leaves a visible scrollable row', () => {
    const document = fixture();
    document.sheets[0].freeze = { rows: 2, columns: 0 };
    const inserted = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'insert',
      index: 1,
      count: 2,
    });
    expect(inserted.sheets[0].freeze).toEqual({ rows: 4, columns: 0 });
    const deleted = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 1,
      count: 2,
    });
    expect(deleted.sheets[0].freeze).toEqual({ rows: 0, columns: 0 });
    const tail = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 3,
      count: 6,
    });
    expect(tail.sheets[0].freeze).toEqual({ rows: 1, columns: 0 });
  });

  it('rejects freeze expansion above the supported row and column budgets', () => {
    const rows = fixture();
    rows.sheets[0].rowCount = 101;
    rows.sheets[0].freeze = { rows: 100, columns: 0 };
    freezeDeep(rows);
    expect(() =>
      studioChangeSheetStructure(rows, 'main', {
        axis: 'row',
        type: 'insert',
        index: 1,
        count: 1,
      })
    ).toThrow('冻结范围超过');
    expect(
      studioChangeSheetStructure(rows, 'main', {
        axis: 'row',
        type: 'insert',
        index: 101,
        count: 1,
      }).sheets[0].freeze
    ).toEqual({ rows: 100, columns: 0 });
    const columns = fixture();
    columns.sheets[0].columnCount = 21;
    columns.sheets[0].freeze = { rows: 0, columns: 20 };
    freezeDeep(columns);
    expect(() =>
      studioChangeSheetStructure(columns, 'main', {
        axis: 'column',
        type: 'insert',
        index: 1,
        count: 1,
      })
    ).toThrow('冻结范围超过');
    expect(columns.sheets[0].columnCount).toBe(21);
  });

  it('rejects deletion that would move a freeze boundary through a surviving merge', () => {
    const document = fixture();
    document.sheets[0].freeze = { rows: 2, columns: 0 };
    document.sheets[0].merges = ['A1:B2'];
    document.sheets[0].cells = { A1: { input: '全部冻结的合并区域' }, D5: { input: '未冻结' } };
    freezeDeep(document);
    expect(() =>
      studioChangeSheetStructure(document, 'main', {
        axis: 'row',
        type: 'delete',
        index: 3,
        count: 6,
      })
    ).toThrow('冻结边界穿过合并');
    expect(document.sheets[0].rowCount).toBe(8);
    expect(document.sheets[0].freeze).toEqual({ rows: 2, columns: 0 });
  });

  it('rejects expansions beyond merge and native chart budgets atomically', () => {
    const merge = fixture();
    merge.sheets[0].rowCount = 5000;
    merge.sheets[0].cells = { A1: { input: '合并' } };
    merge.sheets[0].merges = ['A1:B5000'];
    expect(() =>
      studioChangeSheetStructure(freezeDeep(merge), 'main', {
        axis: 'row',
        type: 'insert',
        index: 2,
        count: 1,
      })
    ).toThrow('合并区域超过');
    expect(merge.sheets[0].rowCount).toBe(5000);
    const chart = fixture();
    chart.sheets[0].rowCount = 302;
    chart.sheets[0].columnCount = 10;
    chart.sheets[0].charts = [{ id: 'chart', type: 'line', title: '', range: 'A1:I301' }];
    expect(() =>
      studioChangeSheetStructure(freezeDeep(chart), 'main', {
        axis: 'row',
        type: 'insert',
        index: 2,
        count: 1,
      })
    ).toThrow('图表超过');
    expect(() =>
      studioChangeSheetStructure(chart, 'main', {
        axis: 'column',
        type: 'insert',
        index: 2,
        count: 1,
      })
    ).toThrow('图表超过');
  });
});

describe('Office Studio safe structure boundaries', () => {
  it.each([
    { axis: 'row', type: 'insert', index: 0, count: 1 },
    { axis: 'row', type: 'insert', index: 2, count: 0 },
    { axis: 'row', type: 'insert', index: 2, count: -1 },
    { axis: 'column', type: 'delete', index: 1.5, count: 1 },
    { axis: 'row', type: 'insert', index: 10, count: 1 },
    { axis: 'row', type: 'insert', index: 2, count: 10000 },
    { axis: 'column', type: 'insert', index: 1, count: 256 },
    { axis: 'row', type: 'delete', index: 1, count: 8 },
    { axis: 'column', type: 'delete', index: 1, count: 6 },
    { axis: 'row', type: 'delete', index: 7, count: 3 },
  ] as StudioSheetStructureEdit[])('rejects invalid or out-of-bounds edits: %j', (edit) => {
    const document = freezeDeep(fixture());
    expect(() => studioChangeSheetStructure(document, 'main', edit)).toThrow();
    expect(document.sheets[0].rowCount).toBe(8);
    expect(document.sheets[0]).not.toHaveProperty('structureEdits');
  });

  it.each([
    '=SUM(Sheet1:Sheet2!A1)',
    "=SUM('Sheet1:Sheet2'!A1)",
    "='[Budget.xlsx]Sheet1'!A1",
    '=SUM(Table1[Amount])',
    '=INDIRECT("Sheet1!A2")',
    '=OFFSET(Sheet1!A1,0,0)',
    '=_xlfn.INDIRECT("Sheet1!A2")',
    '=Sheet1!R1C1',
    '=A1#',
    '=@A1',
    '=SUM(A1:Sheet1!A2)',
    '=SUM(A:Sheet1!C)',
    '=NamedArea+1',
  ])('rejects unsafe retained formulas without a partial edit: %s', (input) => {
    const document = fixture();
    document.sheets[1].cells.B1 = { input };
    freezeDeep(document);
    expect(() =>
      studioChangeSheetStructure(document, 'main', {
        axis: 'row',
        type: 'insert',
        index: 2,
        count: 1,
      })
    ).toThrow('无法安全调整');
    expect(document.sheets[0].cells.A2.input).toBe('10');
    expect(document.sheets[1].cells.A1.input).toBe('=Sheet1!$C$2+SUM(Sheet1!A2:A4)+A2');
  });

  it.each(['=XFD1', '=A1048576'])(
    'rejects structural reference overflow atomically: %s',
    (input) => {
      const document = fixture();
      document.sheets[1].cells.B1 = { input: `=Sheet1!${input.slice(1)}` };
      freezeDeep(document);
      expect(() =>
        studioChangeSheetStructure(document, 'main', {
          axis: input.includes('XFD') ? 'column' : 'row',
          type: 'insert',
          index: 1,
          count: 1,
        })
      ).toThrow('超出 Excel 引用范围');
      expect(document.sheets[0].cells.A1.input).toBe('标题');
    }
  );

  it('permits deletion of an unsupported formula when that entire formula cell is removed', () => {
    const document = fixture();
    document.sheets[0].cells.A2 = { input: '=INDIRECT("A1")' };
    const result = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].cells.A2).toBeUndefined();
    expect(result.sheets[0].structureEdits).toHaveLength(1);
  });

  it('retains snapshot log history and rejects edit 501 without adding a log entry', () => {
    const document = fixture();
    document.sheets[0].structureEdits = Array.from({ length: 499 }, (_, index) => ({
      axis: 'row',
      type: index % 2 === 0 ? 'insert' : 'delete',
      index: 1,
      count: 1,
    }));
    freezeDeep(document);
    expect(isOfficeStudioDocument(document)).toBe(true);
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 1,
      count: 1,
    });
    expect(result.sheets[0].structureEdits).toHaveLength(500);
    expect(document.sheets[0].structureEdits).toHaveLength(499);
    expect(isOfficeStudioDocument(result)).toBe(true);
    expect(() =>
      studioChangeSheetStructure(result, 'main', {
        axis: 'row',
        type: 'insert',
        index: 1,
        count: 1,
      })
    ).toThrow('500');
    expect(result.sheets[0].structureEdits).toHaveLength(500);
  });

  it('rejects unknown sheets and invalid input workbooks', () => {
    const document = fixture();
    const edit: StudioSheetStructureEdit = { axis: 'row', type: 'insert', index: 1, count: 1 };
    expect(() => studioChangeSheetStructure(document, 'missing', edit)).toThrow('工作表不存在');
    document.sheets[0].rowCount = 0;
    expect(() => studioChangeSheetStructure(document, 'main', edit)).toThrow('模型无效');
  });
});

describe('Office Studio codec coordinate replay', () => {
  it('maps scalar cell positions sequentially and removes deleted positions', () => {
    const inserted: StudioSheetStructureEdit = { axis: 'row', type: 'insert', index: 2, count: 2 };
    const deleted: StudioSheetStructureEdit = { axis: 'row', type: 'delete', index: 4, count: 2 };
    expect(studioTransformSheetIndex(1, inserted)).toBe(1);
    expect(studioTransformSheetIndex(3, inserted)).toBe(5);
    expect(studioTransformSheetIndex(5, deleted)).toBeUndefined();
    expect(studioTransformSheetIndex(studioTransformSheetIndex(6, inserted)!, deleted)).toBe(6);
  });

  it('maps absolute print areas, single cells, and reversed ranges with partial deletion', () => {
    const edit: StudioSheetStructureEdit = { axis: 'row', type: 'delete', index: 2, count: 3 };
    expect(studioTransformSheetRange('$A$1:$D$6', edit)).toBe('$A$1:$D$3');
    expect(studioTransformSheetRange('$D$6:$A$2', edit)).toBe('$D$3:$A$2');
    expect(studioTransformSheetRange('A2:B4', edit)).toBeUndefined();
    expect(studioTransformSheetRange('$A$2', edit)).toBeUndefined();
    expect(studioTransformSheetRange('$A$6', edit)).toBe('$A$3');
  });

  it('maps print-title whole rows and columns independently of the other axis', () => {
    const rows: StudioSheetStructureEdit = { axis: 'row', type: 'delete', index: 1, count: 2 };
    const columns: StudioSheetStructureEdit = {
      axis: 'column',
      type: 'insert',
      index: 2,
      count: 2,
    };
    expect(studioTransformSheetRange('$1:$3', rows)).toBe('$1:$1');
    expect(studioTransformSheetRange('$1:$2', rows)).toBeUndefined();
    expect(studioTransformSheetRange('$A:$D', rows)).toBe('$A:$D');
    expect(studioTransformSheetRange('$A:$D', columns)).toBe('$A:$F');
    expect(studioTransformSheetRange('$1:$3', columns)).toBe('$1:$3');
    expect(() => studioTransformSheetRange('Sheet1!A1:A3', rows)).toThrow();
    expect(() => studioTransformSheetRange('A1:A3&&C1:C3', rows)).toThrow();
  });
});

function ruleFixture(): StudioExcelDocument {
  let document = fixture();
  document = studioSetConditionalFormat(document, 'main', {
    id: 'expression',
    range: 'B2:D5',
    type: 'expression',
    formula: '=AND(B2>$A$1,Sheet1!A2>0,LEN("A2")=2)',
    priority: 1,
    style: { bold: true },
  });
  document = studioSetConditionalFormat(document, 'main', {
    id: 'numeric',
    range: 'A2:A4',
    type: 'cellIs',
    operator: 'between',
    formulae: ['=$A$2', '=A4'],
    priority: 2,
    style: { italic: true },
  });
  document = studioSetConditionalFormat(document, 'main', {
    id: 'scale',
    range: 'A2:A4',
    type: 'colorScale',
    colors: ['#ff0000', '#00ff00'],
    priority: 3,
  });
  document = studioSetDataValidation(document, 'main', {
    id: 'source',
    range: 'E2:E5',
    type: 'list',
    source: '=Sheet1!$A$2:$A$4',
  });
  document = studioSetDataValidation(document, 'main', {
    id: 'custom',
    range: 'F2:F5',
    type: 'custom',
    formula: '=F2>Sheet1!$A$2',
  });
  document = studioSetConditionalFormat(document, 'other', {
    id: 'external',
    range: 'B2:B3',
    type: 'expression',
    formula: '=Sheet1!$A$2>0',
    priority: 1,
  });
  document = studioSetDataValidation(document, 'other', {
    id: 'source',
    range: 'C2:C3',
    type: 'list',
    source: '=Sheet1!$A$2:$A$4',
  });
  return document;
}

describe('Office Studio rule metadata across row and column structure', () => {
  it('moves local rule ranges and all-sheet formula references while preserving strings and style metadata', () => {
    const original = freezeDeep(ruleFixture());
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 2,
    });
    expect(result.sheets[0].conditionalFormats).toEqual([
      {
        id: 'expression',
        range: 'B4:D7',
        type: 'expression',
        formula: '=AND(B4>$A$1,Sheet1!A4>0,LEN("A2")=2)',
        priority: 1,
        style: { bold: true },
      },
      {
        id: 'numeric',
        range: 'A4:A6',
        type: 'cellIs',
        operator: 'between',
        formulae: ['=$A$4', '=A6'],
        priority: 2,
        style: { italic: true },
      },
      {
        id: 'scale',
        range: 'A4:A6',
        type: 'colorScale',
        colors: ['#ff0000', '#00ff00'],
        priority: 3,
      },
    ]);
    expect(result.sheets[0].dataValidations).toEqual([
      { id: 'source', range: 'E4:E7', type: 'list', source: '=Sheet1!$A$4:$A$6' },
      { id: 'custom', range: 'F4:F7', type: 'custom', formula: '=F4>Sheet1!$A$4' },
    ]);
    expect(result.sheets[1].conditionalFormats![0]).toMatchObject({
      range: 'B2:B3',
      formula: '=Sheet1!$A$4>0',
    });
    expect(result.sheets[1].dataValidations![0]).toMatchObject({
      range: 'C2:C3',
      source: '=Sheet1!$A$4:$A$6',
    });
    expect(result.sheets[2]).toBe(original.sheets[2]);
    expect(original.sheets[0].conditionalFormats![0].range).toBe('B2:D5');
    expect(isOfficeStudioDocument(JSON.parse(JSON.stringify(result)))).toBe(true);
  });

  it('shrinks partially deleted rule and source ranges without losing order or numeric threshold literals', () => {
    const original = freezeDeep(ruleFixture());
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'delete',
      index: 3,
      count: 1,
    });
    expect(result.sheets[0].conditionalFormats![0]).toMatchObject({
      range: 'B2:D4',
      priority: 1,
      formula: '=AND(B2>$A$1,Sheet1!A2>0,LEN("A2")=2)',
    });
    expect(result.sheets[0].conditionalFormats![1]).toMatchObject({
      range: 'A2:A3',
      formulae: ['=$A$2', '=A3'],
    });
    expect(result.sheets[0].dataValidations![0]).toMatchObject({
      range: 'E2:E4',
      source: '=Sheet1!$A$2:$A$3',
    });
    expect(result.sheets[1].dataValidations![0]).toMatchObject({
      range: 'C2:C3',
      source: '=Sheet1!$A$2:$A$3',
    });
    expect(result.sheets[0].structureEdits).toEqual([
      {
        axis: 'row',
        type: 'delete',
        index: 3,
        count: 1,
      },
    ]);
  });

  it('rebases a deleted top-left rule origin before transforming relative references and leaves deleted dollars broken', () => {
    let document = fixture();
    document.sheets[0].cells = {
      A1: { input: '5' },
      A2: { input: '10' },
      B2: { input: '10' },
      B3: { input: '20' },
      B4: { input: '30' },
      E1: { input: '1' },
      D2: { input: '1' },
      D3: { input: '2' },
      D4: { input: '3' },
    };
    document.sheets[1].cells = {};
    document = studioSetConditionalFormat(document, 'main', {
      id: 'relative',
      range: 'B2:B4',
      type: 'expression',
      formula: '=B2>$A$1',
      priority: 1,
      style: { bold: true },
    });
    document = studioSetConditionalFormat(document, 'main', {
      id: 'absolute',
      range: 'B2:B4',
      type: 'expression',
      formula: '=B2+$A$2>0',
      priority: 2,
      style: { italic: true },
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'custom',
      range: 'D2:D4',
      type: 'custom',
      formula: '=D2>$E$1',
    });
    const original = freezeDeep(document);
    const result = studioChangeSheetStructure(original, 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].conditionalFormats![0]).toMatchObject({
      range: 'B2:B3',
      formula: '=B2>$A$1',
    });
    expect(result.sheets[0].conditionalFormats![1]).toMatchObject({
      range: 'B2:B3',
      formula: '=B2+#REF!>0',
    });
    expect(result.sheets[0].dataValidations![0]).toMatchObject({
      range: 'D2:D3',
      formula: '=D2>$E$1',
    });
    const calculation = studioCalculate(result);
    expect(studioConditionalCellStyle(result.sheets[0], 'B2', calculation)).toEqual({ bold: true });
    expect(studioCellValidation(result.sheets[0], 'D2', calculation)?.valid).toBe(true);
    expect(original.sheets[0].conditionalFormats![0]).toMatchObject({
      range: 'B2:B4',
      formula: '=B2>$A$1',
    });
  });

  it('rebases a deleted left-column origin and shrinks horizontal list sources', () => {
    let document = fixture();
    document.sheets[0].cells = {
      A1: { input: '1' },
      C1: { input: '10' },
      D1: { input: '20' },
      E1: { input: '30' },
      C3: { input: '10' },
      D3: { input: '20' },
      E3: { input: '30' },
    };
    document.sheets[1].cells = {};
    document = studioSetConditionalFormat(document, 'main', {
      id: 'relative',
      range: 'C3:E3',
      type: 'expression',
      formula: '=C3>$A$1',
      priority: 1,
      style: { bold: true },
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'source',
      range: 'F3:F5',
      type: 'list',
      source: '=Sheet1!$C$1:$E$1',
    });
    const result = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'column',
      type: 'delete',
      index: 3,
      count: 1,
    });
    expect(result.sheets[0].conditionalFormats![0]).toMatchObject({
      range: 'C3:D3',
      formula: '=C3>$A$1',
    });
    expect(result.sheets[0].dataValidations![0]).toMatchObject({
      range: 'E3:E5',
      source: '=Sheet1!$C$1:$D$1',
    });
    expect(studioConditionalCellStyle(result.sheets[0], 'C3', studioCalculate(result))).toEqual({
      bold: true,
    });
  });

  it('removes completely deleted rules and keeps broken external list sources explicit', () => {
    let document = fixture();
    document.sheets[1].cells = {};
    document = studioSetConditionalFormat(document, 'main', {
      id: 'deleted',
      range: 'B2:C2',
      type: 'containsText',
      text: 'value',
      priority: 1,
    });
    document = studioSetDataValidation(document, 'main', {
      id: 'deleted',
      range: 'E2:F2',
      type: 'whole',
      operator: 'greaterThan',
      formula1: '0',
    });
    document = studioSetDataValidation(document, 'other', {
      id: 'source',
      range: 'C2:C3',
      type: 'list',
      source: '=Sheet1!$A$2:$B$2',
    });
    const result = studioChangeSheetStructure(freezeDeep(document), 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].conditionalFormats).toBeUndefined();
    expect(result.sheets[0].dataValidations).toBeUndefined();
    expect(result.sheets[1].dataValidations![0]).toMatchObject({
      range: 'C2:C3',
      source: '=#REF!',
    });
    expect(studioCellValidation(result.sheets[1], 'C2', studioCalculate(result))).toMatchObject({
      valid: false,
      blocking: true,
      options: [],
    });
    expect(isOfficeStudioDocument(result)).toBe(true);
  });

  it('rejects expanded rule coverage and list candidate overflow without modifying source metadata', () => {
    let document = fixture();
    document.sheets[1].cells = {};
    for (let index = 0; index < 100; index++)
      document = studioSetConditionalFormat(document, 'main', {
        id: 'rule-' + index,
        range: 'A1:F8',
        priority: index + 1,
        type: 'aboveAverage',
      });
    const original = freezeDeep(document);
    expect(() =>
      studioChangeSheetStructure(original, 'main', {
        axis: 'row',
        type: 'insert',
        index: 2,
        count: 2000,
      })
    ).toThrow('模型限制');
    expect(original.sheets[0].rowCount).toBe(8);
    expect(original.sheets[0].conditionalFormats![0].range).toBe('A1:F8');
    expect(original.sheets[0].structureEdits).toBeUndefined();
    let source = fixture();
    source.sheets[0].rowCount = 1000;
    source.sheets[1].cells = {};
    source = studioSetDataValidation(source, 'other', {
      id: 'source',
      range: 'A1',
      type: 'list',
      source: '=Sheet1!$A$1:$A$1000',
    });
    const frozen = freezeDeep(source);
    expect(() =>
      studioChangeSheetStructure(frozen, 'main', {
        axis: 'row',
        type: 'insert',
        index: 2,
        count: 1,
      })
    ).toThrow('模型限制');
    expect(frozen.sheets[1].dataValidations![0]).toMatchObject({ source: '=Sheet1!$A$1:$A$1000' });
  });
});
