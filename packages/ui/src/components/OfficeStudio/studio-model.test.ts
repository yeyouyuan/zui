import { describe, expect, it } from 'vitest';
import { createOfficeStudioDocument, isOfficeStudioDocument } from './studio-model';
import type { StudioExcelDocument, StudioPdfDocument, StudioWordDocument } from './studio-types';

describe('persisted OfficeStudio models', () => {
  it('keeps multiline Unicode rule messages and refuses characters that cannot round-trip through XLSX XML', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const originalName = sheet.name;
    for (const text of ['control\u0001', 'surrogate\ud800', 'noncharacter\ufffe']) {
      sheet.conditionalFormats = [
        {
          id: 'text',
          range: 'A1:A1',
          type: 'containsText',
          priority: 1,
          text,
          style: { bold: true },
        },
      ];
      expect(isOfficeStudioDocument(document)).toBe(false);
      sheet.conditionalFormats = [
        {
          id: 'formula',
          range: 'A1:A1',
          type: 'expression',
          priority: 1,
          formula: `=A1="${text}"`,
        },
      ];
      expect(isOfficeStudioDocument(document)).toBe(false);
      delete sheet.conditionalFormats;
      sheet.dataValidations = [
        {
          id: 'number',
          range: 'A1:A1',
          type: 'whole',
          operator: 'greaterThan',
          formula1: '0',
          errorMessage: text,
        },
      ];
      expect(isOfficeStudioDocument(document)).toBe(false);
      delete sheet.dataValidations;
      sheet.name = text;
      sheet.dataValidations = [
        {
          id: 'source',
          range: 'A1:A1',
          type: 'list',
          source: `='${text}'!A1:A3`,
        },
      ];
      expect(isOfficeStudioDocument(document)).toBe(false);
      delete sheet.dataValidations;
    }
    sheet.name = originalName;
    sheet.conditionalFormats = [
      {
        id: 'text',
        range: 'A1:A1',
        type: 'containsText',
        priority: 1,
        text: '第一行\n第二行\t✅',
        style: { numberFormat: '"单位 & 数量"0.00' },
      },
    ];
    sheet.dataValidations = [
      {
        id: 'number',
        range: 'A1:A1',
        type: 'whole',
        operator: 'greaterThan',
        formula1: '0',
        inputMessage: '数量\t必须为正数\n可填写整数',
        errorMessage: '第一行\r\n第二行 ✅',
      },
    ];
    expect(isOfficeStudioDocument(document)).toBe(true);
  });

  it('accepts all three real default documents', () => {
    for (const kind of ['word', 'excel', 'pdf'] as const)
      expect(isOfficeStudioDocument(createOfficeStudioDocument(kind))).toBe(true);
  });

  it('accepts absent fonts, unknown font names and fractional Excel point sizes while rejecting malformed fonts', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const input = sheet.cells.A1.input;
    expect(isOfficeStudioDocument(document)).toBe(true);
    for (const fontFamily of ['Calibri', '新宋体', 'Custom "Font";\\Family', 'a'.repeat(255)]) {
      for (const fontSize of [1, 11.5, 409]) {
        sheet.cells.A1 = { input, fontFamily, fontSize };
        expect(isOfficeStudioDocument(document)).toBe(true);
      }
    }
    for (const font of [
      { fontFamily: '' },
      { fontFamily: '   ' },
      { fontFamily: 'a'.repeat(256) },
      { fontFamily: 'invalid\u0000' },
      { fontFamily: 'invalid\ud800' },
      { fontFamily: null },
      { fontFamily: 12 },
      { fontSize: 0 },
      { fontSize: 409.1 },
      { fontSize: Number.NaN },
      { fontSize: Number.POSITIVE_INFINITY },
      { fontSize: '12' },
      { fontSize: null },
    ]) {
      sheet.cells.A1 = { input, ...font } as unknown as typeof sheet.cells.A1;
      expect(isOfficeStudioDocument(document)).toBe(false);
    }
    sheet.cells.A1 = { input };
    expect(isOfficeStudioDocument(document)).toBe(true);
  });

  it('recovers embedded images and header/footer rich documents while rejecting remote image fetches', () => {
    const document = createOfficeStudioDocument('word') as StudioWordDocument;
    const image = {
      type: 'image',
      attrs: { src: 'data:image/png;base64,aGVsbG8=', width: 100, height: 80 },
    };
    document.content.content?.[0].content?.push(image);
    document.header = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '部门文档' }] }],
    };
    document.footer = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'pageNumber', attrs: { kind: 'current' } }] },
      ],
    };
    document.pageNumbers = true;
    expect(isOfficeStudioDocument(document)).toBe(true);
    image.attrs.src = 'https://example.com/tracking.png';
    expect(isOfficeStudioDocument(document)).toBe(false);
    image.attrs.src = 'data:image/svg+xml;base64,aGVsbG8=';
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('rejects malformed headers and oversized image dimensions before mounting an editor', () => {
    const document = createOfficeStudioDocument('word') as StudioWordDocument;
    document.header = { type: 'paragraph' };
    expect(isOfficeStudioDocument(document)).toBe(false);
    delete document.header;
    document.content.content?.push({
      type: 'image',
      attrs: { src: 'data:image/jpeg;base64,aGVsbG8=', width: Infinity },
    });
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('preserves merged regions, frozen panes, filter rules, charts and supported cell formatting', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    sheet.merges = ['A1:D1'];
    sheet.freeze = { rows: 3, columns: 0 };
    sheet.filter = {
      range: 'A3:D6',
      columns: {
        A: { operator: 'contains', value: '设计' },
        D: { operator: 'greater', value: '1000' },
      },
    };
    sheet.charts = [{ id: 'budget-chart', type: 'bar', title: '项目小计', range: 'A3:D6' }];
    sheet.cells.A1 = { ...sheet.cells.A1, underline: true, wrap: true };
    expect(isOfficeStudioDocument(document)).toBe(true);
    sheet.merges.push('C1:D2');
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('rejects out-of-range metadata and duplicate worksheet names that cannot round-trip in XLSX', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    sheet.filter = { range: 'A3:D6', columns: { F: { operator: 'equals', value: '1' } } };
    expect(isOfficeStudioDocument(document)).toBe(false);
    delete sheet.filter;
    sheet.charts = [{ id: 'bad', type: 'line', title: '图表', range: 'A3:A6' }];
    expect(isOfficeStudioDocument(document)).toBe(false);
    delete sheet.charts;
    document.sheets[1].name = sheet.name;
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('rejects persisted frozen panes that exceed codec limits or cut through merged cells', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    sheet.rowCount = 200;
    sheet.columnCount = 30;
    sheet.freeze = { rows: 100, columns: 20 };
    expect(isOfficeStudioDocument(document)).toBe(true);
    sheet.freeze = { rows: 101, columns: 0 };
    expect(isOfficeStudioDocument(document)).toBe(false);
    sheet.freeze = { rows: 0, columns: 21 };
    expect(isOfficeStudioDocument(document)).toBe(false);
    sheet.freeze = { rows: 1, columns: 0 };
    sheet.merges = ['A1:A2'];
    expect(isOfficeStudioDocument(document)).toBe(false);
    sheet.freeze = { rows: 0, columns: 1 };
    sheet.merges = ['A1:B1'];
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('recovers valid source structure edits and rejects logs that cannot reproduce the saved dimensions', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    sheet.rowCount += 2;
    sheet.columnCount -= 1;
    sheet.structureEdits = [
      { axis: 'row', type: 'insert', index: 4, count: 2 },
      { axis: 'column', type: 'delete', index: 16, count: 1 },
    ];
    expect(isOfficeStudioDocument(JSON.parse(JSON.stringify(document)))).toBe(true);
    const valid = structuredClone(sheet.structureEdits);
    for (const invalid of [
      { axis: 'row', type: 'insert', index: 1, count: 62 },
      { axis: 'column', type: 'delete', index: 257, count: 1 },
      { axis: 'row', type: 'insert', index: 1.5, count: 1 },
      { axis: 'row', type: 'delete', index: 1, count: 0 },
    ] as const) {
      sheet.structureEdits = [invalid];
      expect(isOfficeStudioDocument(document)).toBe(false);
    }
    sheet.structureEdits = valid;
    expect(isOfficeStudioDocument(document)).toBe(true);
  });

  it('restores conditional formatting and validation rules from saved JSON', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    sheet.conditionalFormats = [
      {
        id: 'high',
        range: 'D4:D7',
        priority: 1,
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['100'],
        style: { bold: true, background: '#FEF3C7' },
      },
      {
        id: 'formula',
        range: 'A4:D7',
        priority: 2,
        type: 'expression',
        formula: '=$D4>1000',
        stopIfTrue: true,
        style: { color: '#B91C1C' },
      },
      {
        id: 'scale',
        range: 'D4:D7',
        priority: 3,
        type: 'colorScale',
        colors: ['#F87171', '#FDE68A', '#4ADE80'],
      },
      { id: 'duplicate', range: 'A4:A7', priority: 4, type: 'duplicateValues' },
      { id: 'unique', range: 'A4:A7', priority: 5, type: 'uniqueValues' },
      { id: 'rank', range: 'D4:D7', priority: 6, type: 'top10', rank: 10, percent: true },
      { id: 'average', range: 'D4:D7', priority: 7, type: 'aboveAverage', aboveAverage: false },
      { id: 'text', range: 'A4:A7', priority: 8, type: 'containsText', text: '材料' },
    ];
    sheet.dataValidations = [
      {
        id: 'list',
        range: 'A4:A7',
        type: 'list',
        values: ['草稿', '完成'],
        allowBlank: true,
        showInputMessage: true,
        inputTitle: '状态',
        inputMessage: '选择进度',
        errorStyle: 'stop',
      },
      {
        id: 'count',
        range: 'B4:B7',
        type: 'whole',
        operator: 'between',
        formula1: '0',
        formula2: '100',
        errorTitle: '数量无效',
        errorMessage: '请输入 0 到 100 的整数',
      },
      { id: 'formula', range: 'C4:C7', type: 'custom', formula: '=$C4>=0' },
      {
        id: 'lookup',
        range: 'E4:E7',
        type: 'list',
        source: `='${document.sheets[1].name}'!$A$1:$A$3`,
        showErrorMessage: false,
      },
    ];
    expect(isOfficeStudioDocument(JSON.parse(JSON.stringify(document)))).toBe(true);
  });

  it.each(['whole', 'decimal', 'date', 'time', 'textLength'] as const)(
    'accepts %s validation with numeric and anchored formula limits',
    (type) => {
      const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
      document.sheets[0].dataValidations = [
        {
          id: 'limit',
          range: 'B4:B7',
          type,
          operator: 'between',
          formula1: '0',
          formula2: '=$D$8',
          errorStyle: 'warning',
        },
      ];
      expect(isOfficeStudioDocument(document)).toBe(true);
    }
  );

  it('rejects overlapping or oversized validation rules and lists that XLSX cannot represent', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const rule = { id: 'list', range: 'A1:A10', type: 'list' as const, values: ['草稿', '完成'] };
    sheet.dataValidations = [rule, { ...rule, id: 'overlap', range: 'A10:A12' }];
    expect(isOfficeStudioDocument(document)).toBe(false);
    sheet.dataValidations = [rule];
    for (const values of [
      [],
      ['含,逗号'],
      ['含"引号'],
      ['含\n换行'],
      ['含\t制表'],
      ['含\u0001控制'],
      ['含\u007f控制'],
      ['x'.repeat(256)],
    ]) {
      rule.values = values;
      expect(isOfficeStudioDocument(document)).toBe(false);
    }
    rule.values = ['草稿'];
    sheet.dataValidations = Array.from({ length: 101 }, (_, index) => ({
      ...rule,
      id: String(index),
      range: `A${index + 1}:A${index + 1}`,
    }));
    sheet.rowCount = 10000;
    expect(isOfficeStudioDocument(document)).toBe(false);
    sheet.dataValidations = [{ ...rule, range: 'A1:P10000' }];
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('rejects unsafe rule formulas, unsupported fields and malformed conditional styles', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const rule = {
      id: 'expression',
      range: 'A1:A10',
      type: 'expression' as const,
      priority: 1,
      formula: '=A1>0',
      style: { background: '#FEF3C7' },
    };
    sheet.conditionalFormats = [rule];
    expect(isOfficeStudioDocument(document)).toBe(true);
    for (const formula of [
      '=INDIRECT("A1")',
      '=OFFSET(A1,1,0)',
      '=[remote.xlsx]Sheet1!A1',
      '=SUM(A:A)',
      '=SUM(1:5)',
      '=Sheet1:Sheet2!A1',
      "='Sheet1:Sheet2'!A1",
      '=R1C1>0',
      '=A1#>0',
      '=Price>0',
      '=Price1>0',
      '=Table1[Total]>0',
      '=A1="unfinished',
      '=SUM(A1',
      '=SUM(A1))',
      '',
      '=',
    ]) {
      rule.formula = formula;
      expect(isOfficeStudioDocument(document)).toBe(false);
    }
    rule.formula = '=A1="literal [text]"';
    expect(isOfficeStudioDocument(document)).toBe(true);
    for (const formula of [
      '=AND($A1>1e3,TRUE)',
      "=SUM('销售预算'!$B$2:B3)>0",
      "='Review \"Plan'!$A$1>0",
      "='Tom''s Sheet'!$A$1>0",
      '=A1="R1C1# and ""quoted"" text"',
      '=IF(A1>0,TRUE,FALSE)',
      '=#REF!>0',
    ]) {
      rule.formula = formula;
      expect(isOfficeStudioDocument(document), formula).toBe(true);
    }
    rule.style.background = 'url(https://example.com/pixel)';
    expect(isOfficeStudioDocument(document)).toBe(false);
    rule.style.background = '#FEF3C7';
    expect(
      isOfficeStudioDocument({
        ...document,
        sheets: [
          { ...sheet, conditionalFormats: [{ ...rule, iconSet: '3Arrows' }] },
          document.sheets[1],
        ],
      })
    ).toBe(false);
    sheet.conditionalFormats = [
      {
        id: 'scale',
        range: 'A1:A10',
        priority: 1,
        type: 'colorScale',
        colors: ['#000000', '#FFFFFF'],
        style: { bold: true },
      },
    ];
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('rejects malformed comparisons, invalid priorities and conditional rule evaluation budgets', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const rule = {
      id: 'compare',
      range: 'A1:A10',
      priority: 1,
      type: 'cellIs' as const,
      operator: 'between' as const,
      formulae: ['0', '10'],
    };
    sheet.conditionalFormats = [rule];
    expect(isOfficeStudioDocument(document)).toBe(true);
    rule.formulae = ['0'];
    expect(isOfficeStudioDocument(document)).toBe(false);
    rule.formulae = ['0', 'Infinity'];
    expect(isOfficeStudioDocument(document)).toBe(false);
    rule.formulae = ['0', '10'];
    rule.priority = 0;
    expect(isOfficeStudioDocument(document)).toBe(false);
    rule.priority = 1;
    sheet.rowCount = 10000;
    rule.range = 'A1:J10000';
    expect(isOfficeStudioDocument(document)).toBe(true);
    sheet.conditionalFormats.push({ ...rule, id: 'too-many', range: 'A1:A1' });
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('checks validation list references across sheets and restores explicitly broken sources', () => {
    const document = createOfficeStudioDocument('excel') as StudioExcelDocument;
    const sheet = document.sheets[0];
    const rule = {
      id: 'source',
      range: 'A1:A10',
      type: 'list' as const,
      source: `='${document.sheets[1].name}'!$A$1:$A$3`,
    };
    sheet.dataValidations = [rule];
    expect(isOfficeStudioDocument(document)).toBe(true);
    for (const source of [
      "='不存在'!$A$1:$A$3",
      '=$A$1:$C$3',
      '=$A$1:$A$1001',
      '=$A$1:$A$500',
      '=INDIRECT("A1:A3")',
    ]) {
      rule.source = source;
      expect(isOfficeStudioDocument(document)).toBe(false);
    }
    rule.source = '=#REF!';
    expect(isOfficeStudioDocument(document)).toBe(true);
    sheet.dataValidations = [{ ...rule, values: ['value'] }];
    expect(isOfficeStudioDocument(document)).toBe(false);
  });

  it('accepts vector annotations and rejects invalid points, duplicate IDs and inaccessible PDF pages', () => {
    const document = createOfficeStudioDocument('pdf') as StudioPdfDocument;
    document.marks = [
      {
        id: 'signature',
        type: 'ink',
        page: 0,
        x: 10,
        y: 20,
        text: '',
        size: 12,
        lineWidth: 2,
        points: [
          [10, 20],
          [30, 45],
          [70, 25],
        ],
      },
    ];
    expect(isOfficeStudioDocument(document)).toBe(true);
    document.marks[0].points![1][0] = NaN;
    expect(isOfficeStudioDocument(document)).toBe(false);
    document.marks[0].points![1][0] = 30;
    document.marks.push({ ...document.marks[0] });
    expect(isOfficeStudioDocument(document)).toBe(false);
    document.marks.pop();
    document.marks[0].page = 1;
    expect(isOfficeStudioDocument(document)).toBe(false);
  });
});
