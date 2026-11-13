import { describe, expect, it } from 'vitest';
import { isOfficeStudioDocument } from './studio-model';
import {
  studioCellHyperlink,
  studioCopySheetHyperlinks,
  studioDeleteSheetHyperlinks,
  studioIsSheetHyperlink,
  studioRemoveSheetHyperlink,
  studioRemoveSheetHyperlinks,
  studioRenameSheetHyperlinks,
  studioResolveSheetHyperlink,
  studioSetSheetHyperlink,
  studioSheetHyperlinkAt,
  studioSheetHyperlinksAt,
  studioTransformSheetHyperlinks,
  studioPatchSheetHyperlinks,
} from './studio-sheet-hyperlinks';
import {
  studioCalculate,
  studioClipboardOrigin,
  studioCopySheetClipboard,
  studioCopyTsv,
  studioDeleteSheet,
  studioMergeCells,
  studioParseAddress,
  studioPasteCells,
  studioPatchCells,
  studioRenameSheet,
  studioSortRange,
} from './studio-sheet-model';
import { studioFillCells, studioFillSeries } from './studio-sheet-fill';
import { studioChangeSheetStructure } from './studio-sheet-structure';
import type { StudioExcelDocument, StudioSheetHyperlink } from './studio-types';

function fixture(): StudioExcelDocument {
  return {
    version: 1,
    id: 'book',
    name: '超链接.xlsx',
    kind: 'excel',
    activeSheetId: 'main',
    sheets: [
      { id: 'main', name: 'Sheet1', cells: {}, rowCount: 20, columnCount: 10, hyperlinks: [] },
      {
        id: 'other',
        name: "预算 O'Brien",
        cells: {},
        rowCount: 20,
        columnCount: 10,
        hyperlinks: [],
      },
    ],
  };
}

function link(overrides: Partial<StudioSheetHyperlink> = {}): StudioSheetHyperlink {
  return { id: 'link', ref: 'A1', target: 'https://example.com/path', ...overrides };
}

function selection(first: string, last: string) {
  return { anchor: studioParseAddress(first)!, focus: studioParseAddress(last)! };
}

describe('Office Studio hyperlink metadata and safe resolution', () => {
  it.each([
    ['https://example.com/a?q=1', 'https://example.com/a?q=1'],
    ['http://example.com', 'http://example.com/'],
    [' HTTPS://EXAMPLE.COM/path ', 'https://example.com/path'],
    ['mailto:user@example.com?subject=Report', 'mailto:user@example.com?subject=Report'],
  ])('opens a complete supported URI %s', (target, href) => {
    expect(studioResolveSheetHyperlink(fixture(), 'main', link({ target }))).toEqual({
      kind: 'external',
      href,
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'vbscript:unsafe',
    'ftp://example.com/a',
    'file:///tmp/book.xlsx',
    '/tmp/book.xlsx',
    '../report.xlsx',
    '\\server\\book.xlsx',
    'http:example.com',
    'https:///example.com',
    'https://',
    'mailto:',
    'https://exam\nple.com',
    'https://example.com\u0000',
  ])('retains an opaque target %s without authorizing it to open', (target) => {
    const document = fixture();
    document.sheets[0].hyperlinks = [
      link({ target, location: 'Sheet1!$A$1', tooltip: '保留说明', display: '原标签' }),
    ];
    expect(isOfficeStudioDocument(document)).toBe(true);
    expect(
      studioResolveSheetHyperlink(document, 'main', document.sheets[0].hyperlinks[0]).kind
    ).toBe('blocked');
    expect(() =>
      studioSetSheetHyperlink(fixture(), 'main', document.sheets[0].hyperlinks![0])
    ).toThrow();
    const updated = studioSetSheetHyperlink(document, 'main', {
      ...document.sheets[0].hyperlinks[0],
      tooltip: '更新说明',
    });
    expect(updated.sheets[0].hyperlinks?.[0]).toEqual({
      ...document.sheets[0].hyperlinks[0],
      tooltip: '更新说明',
    });
    expect(document.sheets[0].hyperlinks[0].tooltip).toBe('保留说明');
  });

  it('resolves quoted worksheet names, escaped apostrophes, absolute cells and reversed rectangles', () => {
    const document = fixture();
    expect(
      studioResolveSheetHyperlink(
        document,
        'main',
        link({ target: undefined, location: "'预算 O''Brien'!$C$4:$A$2" })
      )
    ).toEqual({
      kind: 'internal',
      sheetId: 'other',
      ref: 'A2:C4',
      anchor: { row: 2, col: 1 },
      focus: { row: 4, col: 3 },
    });
    expect(studioResolveSheetHyperlink(document, 'other', link({ target: '#$A$1' }))).toMatchObject(
      { kind: 'internal', sheetId: 'other', ref: 'A1' }
    );
    expect(
      studioResolveSheetHyperlink(document, 'main', link({ target: '#sHeEt1!$B$2' }))
    ).toMatchObject({ kind: 'internal', sheetId: 'main', ref: 'B2' });
    expect(
      studioResolveSheetHyperlink(
        document,
        'main',
        link({ target: undefined, location: 'Sheet1!A10000' })
      )
    ).toMatchObject({ kind: 'internal', ref: 'A10000' });
  });

  it('keeps unparsed or inaccessible locations as metadata and validates every open again', () => {
    const document = fixture();
    for (const location of [
      'Missing!A1',
      'NamedRange',
      '#REF!',
      'Sheet1!A10001',
      'Sheet1!XFD1048576',
    ]) {
      const record = link({ target: undefined, location });
      expect(studioIsSheetHyperlink(record)).toBe(true);
      expect(studioResolveSheetHyperlink(document, 'main', record).kind).toBe('blocked');
    }
    const record = link();
    expect(studioResolveSheetHyperlink(document, 'main', record).kind).toBe('external');
    record.target = 'javascript:alert(1)';
    expect(studioResolveSheetHyperlink(document, 'main', record).kind).toBe('blocked');
  });

  it('distinguishes a deleted target marker from a quoted worksheet name containing #REF!', () => {
    const document = fixture();
    document.sheets[1].name = '#REF! Budget';
    expect(
      studioResolveSheetHyperlink(
        document,
        'main',
        link({ target: undefined, location: "'#REF! Budget'!$B$2:$C$3" })
      )
    ).toMatchObject({ kind: 'internal', sheetId: 'other', ref: 'B2:C3' });
    expect(
      studioResolveSheetHyperlink(
        document,
        'main',
        link({ target: undefined, location: ' #REF! ' })
      )
    ).toEqual({ kind: 'blocked', reason: '链接目标已删除。' });
  });

  it('combines an external fragment without treating it as a workbook reference', () => {
    const document = fixture();
    const record = link({ location: "'预算 O''Brien'!$A$1" });
    document.sheets[0].hyperlinks = [record];
    expect(studioRenameSheetHyperlinks(document.sheets[0], "预算 O'Brien", '新表')).toBe(
      document.sheets[0]
    );
    expect(studioDeleteSheetHyperlinks(document.sheets[0], document.sheets[1])).toBe(
      document.sheets[0]
    );
    const resolved = studioResolveSheetHyperlink(document, 'main', record);
    expect(resolved.kind).toBe('external');
    if (resolved.kind === 'external') expect(new URL(resolved.href).hash).toContain('$A$1');
  });

  it('preserves all overlapping records while choosing the first resolvable link for opening', () => {
    const document = fixture();
    const broken = link({ id: 'broken', ref: 'A1:B2', target: undefined, location: 'Missing!A1' });
    const safe = link({ id: 'safe' });
    const next = link({ id: 'next', target: 'https://second.example/' });
    document.sheets[0].hyperlinks = [broken, safe, next];
    expect(studioSheetHyperlinkAt(document.sheets[0], 'A1')).toBe(broken);
    expect(studioSheetHyperlinksAt(document.sheets[0], '$a$1')).toEqual([broken, safe, next]);
    expect(studioCellHyperlink(document, 'main', 'A1')).toBe(safe);
    const edited = studioSetSheetHyperlink(document, 'main', { ...safe, tooltip: '新说明' });
    expect(edited.sheets[0].hyperlinks?.map((record) => record.id)).toEqual([
      'broken',
      'safe',
      'next',
    ]);
    expect(edited.sheets[0].hyperlinks?.[0]).toBe(broken);
  });

  it('edits, relocates and removes metadata without replacing numeric values or style', () => {
    const original = fixture();
    original.sheets[0].cells.A1 = { input: '45351', numberFormat: 'yyyy-mm-dd', bold: true };
    const added = studioSetSheetHyperlink(original, 'main', link({ display: '标签' }));
    expect(added.sheets[0].cells).toBe(original.sheets[0].cells);
    const moved = studioSetSheetHyperlink(added, 'main', link({ ref: '$L$30', tooltip: '说明' }));
    expect(moved.sheets[0].rowCount).toBe(30);
    expect(moved.sheets[0].columnCount).toBe(12);
    expect(studioSheetHyperlinkAt(moved.sheets[0], 'A1')).toBeUndefined();
    expect(studioRemoveSheetHyperlink(moved, 'main', 'link').sheets[0].hyperlinks).toEqual([]);
    expect(studioRemoveSheetHyperlink(original, 'main', 'absent')).toBe(original);
  });

  it('splits only a cleared part of a rectangular link and retains its complete destination metadata', () => {
    const document = fixture();
    const source = link({
      ref: 'A1:C3',
      target: '../unknown.xlsx',
      location: 'Sheet1!D4',
      display: '原文字',
      tooltip: '原说明',
    });
    document.sheets[0].hyperlinks = [source];
    const updated = studioRemoveSheetHyperlinks(document, 'main', 'B2');
    expect(updated.sheets[0].hyperlinks).toHaveLength(4);
    expect(studioSheetHyperlinkAt(updated.sheets[0], 'B2')).toBeUndefined();
    for (const address of ['A1', 'C1', 'A2', 'C2', 'A3', 'B3', 'C3'])
      expect(studioSheetHyperlinkAt(updated.sheets[0], address)).toMatchObject({
        target: source.target,
        location: source.location,
        tooltip: source.tooltip,
        display: source.display,
      });
    expect(new Set(updated.sheets[0].hyperlinks?.map((record) => record.id)).size).toBe(4);
    expect(document.sheets[0].hyperlinks).toEqual([source]);
  });

  it('keeps legacy undefined distinct from an explicit empty array', () => {
    const document = fixture();
    delete document.sheets[0].hyperlinks;
    expect(isOfficeStudioDocument(document)).toBe(true);
    const edited = studioPatchCells(document, 'main', { A1: { input: '新内容' } });
    expect(edited.sheets[0].hyperlinks).toBeUndefined();
    expect(studioRemoveSheetHyperlinks(edited, 'main', 'A1')).toBe(edited);
    expect(() => studioSetSheetHyperlink(edited, 'main', link())).toThrow('补齐');
    edited.sheets[0].hyperlinks = [];
    expect(studioSetSheetHyperlink(edited, 'main', link()).sheets[0].hyperlinks).toHaveLength(1);
  });

  it('accepts full Excel refs while rejecting malformed records and duplicate IDs', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [link({ ref: 'A1:XFD1048576', target: '../original.xlsx' })];
    expect(isOfficeStudioDocument(document)).toBe(true);
    const edited = studioSetSheetHyperlink(document, 'main', {
      ...document.sheets[0].hyperlinks[0],
      tooltip: '保留完整范围',
    });
    expect(edited.sheets[0].rowCount).toBe(20);
    expect(edited.sheets[0].columnCount).toBe(10);
    expect(isOfficeStudioDocument(edited)).toBe(true);
    for (const invalid of [
      link({ id: '' }),
      link({ ref: 'XFE1' }),
      link({ ref: 'A1048577' }),
      link({ ref: 'A1 C2' }),
      { ...link(), tooltip: 10 },
    ])
      expect(studioIsSheetHyperlink(invalid)).toBe(false);
    document.sheets[0].hyperlinks.push(link());
    expect(isOfficeStudioDocument(document)).toBe(false);
  });
});

describe('Office Studio hyperlink editing batches', () => {
  it('keeps a link during ordinary input and format edits, and clears it with an explicit blank', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [link()];
    const edited = studioPatchCells(document, 'main', {
      A1: { input: '10', numberFormat: '0.00' },
    });
    expect(edited.sheets[0].hyperlinks).toBe(document.sheets[0].hyperlinks);
    const formatted = studioPatchCells(edited, 'main', { A1: { bold: true } });
    expect(formatted.sheets[0].hyperlinks).toBe(document.sheets[0].hyperlinks);
    expect(studioPatchCells(formatted, 'main', { A1: { input: '' } }).sheets[0].hyperlinks).toEqual(
      []
    );
    expect(studioPatchCells(document, 'main', { A1: { input: '' } }).sheets[0].hyperlinks).toEqual(
      []
    );
  });

  it('clears only the cells actually overwritten by ragged TSV', () => {
    const document = fixture();
    document.sheets[0].cells = { B2: { input: '未触及' }, C1: { input: '保留' } };
    document.sheets[0].hyperlinks = [link({ ref: 'A1:C2' })];
    const updated = studioPasteCells(document, 'main', { row: 1, col: 1 }, 'x\ty\nz').document;
    for (const address of ['A1', 'B1', 'A2'])
      expect(studioSheetHyperlinkAt(updated.sheets[0], address)).toBeUndefined();
    for (const address of ['B2', 'C1', 'C2'])
      expect(studioSheetHyperlinkAt(updated.sheets[0], address)?.target).toBe(
        'https://example.com/path'
      );
    expect(updated.sheets[0].cells.B2).toBe(document.sheets[0].cells.B2);
    expect(updated.sheets[0].cells.C1).toBe(document.sheets[0].cells.C1);
  });

  it('copies clipped rectangle metadata through clipboard v2 without rewriting destination strings', () => {
    const document = fixture();
    document.sheets[0].cells.B1 = { input: '=A1+$A$1' };
    const source = link({
      ref: 'A1:C2',
      target: '../original.xlsx',
      location: "'预算 O''Brien'!$D$4",
      display: '链接标签',
      tooltip: '说明\n第二行',
    });
    document.sheets[0].hyperlinks = [source];
    const copied = selection('B1', 'C2');
    expect(studioCopySheetHyperlinks(document.sheets[0], 'B1:C2')[0].ref).toBe('B1:C2');
    const text = studioCopyTsv(document.sheets[0], copied);
    const payload = studioCopySheetClipboard(document, document.sheets[0].id, copied);
    const origin = studioClipboardOrigin(payload, text)!;
    expect(origin.hyperlinks).toEqual([{ ...source, ref: 'B1:C2' }]);
    const updated = studioPasteCells(document, 'main', { row: 4, col: 4 }, text, origin).document;
    const pasted = studioSheetHyperlinkAt(updated.sheets[0], 'D4')!;
    expect(pasted).toMatchObject({ ...source, id: expect.any(String), ref: 'D4:E5' });
    expect(pasted.id).not.toBe(source.id);
    expect(updated.sheets[0].cells.D4.input).toBe('=C4+$A$1');
    expect(studioSheetHyperlinkAt(updated.sheets[0], 'E5')).toBe(pasted);
    expect(document.sheets[0].hyperlinks).toEqual([source]);
  });

  it('retains overlapping opaque and supported records during copy and fill', () => {
    const document = fixture();
    document.sheets[0].cells.A1 = { input: '1' };
    document.sheets[0].hyperlinks = [
      link({ id: 'opaque', target: 'file:///original.xlsx' }),
      link({ id: 'safe' }),
    ];
    const sourceSelection = selection('A1', 'A1');
    const text = studioCopyTsv(document.sheets[0], sourceSelection);
    const origin = studioClipboardOrigin(
      studioCopySheetClipboard(document, document.sheets[0].id, sourceSelection),
      text
    )!;
    const pasted = studioPasteCells(document, 'main', { row: 2, col: 2 }, text, origin).document;
    expect(studioSheetHyperlinksAt(pasted.sheets[0], 'B2').map((record) => record.target)).toEqual([
      'file:///original.xlsx',
      'https://example.com/path',
    ]);
    const filled = studioFillCells(document, 'main', selection('A1', 'A3'), 'down');
    expect(studioSheetHyperlinksAt(filled.sheets[0], 'A3').map((record) => record.target)).toEqual([
      'file:///original.xlsx',
      'https://example.com/path',
    ]);
    expect(studioCellHyperlink(filled, 'main', 'A3')?.target).toBe('https://example.com/path');
  });

  it('preserves overlap priority when a later range is encountered first during row traversal', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [
      link({ id: 'first', ref: 'B2:C3', target: 'https://first.example/' }),
      link({ id: 'second', ref: 'A1:C3', target: 'https://second.example/' }),
    ];
    const copied = selection('A1', 'C3');
    const text = studioCopyTsv(document.sheets[0], copied);
    const origin = studioClipboardOrigin(
      studioCopySheetClipboard(document, document.sheets[0].id, copied),
      text
    )!;
    const result = studioPasteCells(document, 'main', { row: 5, col: 5 }, text, origin).document;
    expect(studioSheetHyperlinksAt(result.sheets[0], 'F6').map((record) => record.target)).toEqual([
      'https://first.example/',
      'https://second.example/',
    ]);
    expect(studioCellHyperlink(result, 'main', 'F6')?.target).toBe('https://first.example/');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'E5')?.target).toBe('https://second.example/');
  });

  it('rejects inconsistent clipboard source ordering atomically and expands metadata-only assignments', () => {
    const document = fixture();
    const first = link({ id: 'first' }),
      second = link({ id: 'second' });
    const before = JSON.stringify(document);
    expect(() =>
      studioPatchSheetHyperlinks(document.sheets[0], { A1: [first, second], A2: [second, first] })
    ).toThrow('顺序不一致');
    expect(JSON.stringify(document)).toBe(before);
    const expanded = studioPatchCells(document, 'main', {}, { hyperlinks: { $l$30: first } });
    expect(expanded.sheets[0].rowCount).toBe(30);
    expect(expanded.sheets[0].columnCount).toBe(12);
    expect(studioSheetHyperlinkAt(expanded.sheets[0], 'L30')?.target).toBe(first.target);
  });

  it('accepts v1 clipboard origins and clears target links while preserving formula translation', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [link({ ref: 'B2' })];
    const text = '=A1+$B$1';
    const origin = studioClipboardOrigin(
      JSON.stringify({ version: 1, row: 1, col: 1, text }),
      text
    )!;
    expect(origin).toEqual({ row: 1, col: 1 });
    const result = studioPasteCells(document, 'main', { row: 2, col: 2 }, text, origin).document;
    expect(result.sheets[0].cells.B2.input).toBe('=B2+$B$1');
    expect(result.sheets[0].hyperlinks).toEqual([]);
    expect(
      studioClipboardOrigin(
        JSON.stringify({ version: 2, row: 1, col: 1, text, hyperlinks: [link({ ref: 'B1' })] }),
        text
      )
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({ version: 2, row: 1, col: 1, text: 'different', hyperlinks: [] }),
        text
      )
    ).toBeUndefined();
    expect(
      studioClipboardOrigin(
        JSON.stringify({
          version: 2,
          row: 1,
          col: 1,
          text: 'a\tb\nc',
          hyperlinks: [link({ ref: 'B2' })],
        }),
        'a\tb\nc'
      )
    ).toBeUndefined();
  });

  it('rolls back content and links together when validation blocks paste, clear, fill or sort', () => {
    const document = fixture();
    document.sheets[0].cells = { A1: { input: '2' }, A2: { input: '1' } };
    document.sheets[0].hyperlinks = [link({ ref: 'A1:A2' })];
    document.sheets[0].dataValidations = [
      {
        id: 'validation',
        range: 'A2:A3',
        type: 'whole',
        operator: 'equal',
        formula1: '1',
        allowBlank: false,
      },
    ];
    const before = JSON.stringify(document);
    expect(() => studioPasteCells(document, 'main', { row: 2, col: 1 }, '2\n1')).toThrow('A2');
    expect(() => studioPatchCells(document, 'main', { A2: { input: '' } })).toThrow('A2');
    expect(() => studioFillCells(document, 'main', selection('A1', 'A3'), 'down')).toThrow('A2');
    expect(() =>
      studioFillSeries(document, 'main', selection('A1', 'A3'), {
        direction: 'down',
        type: 'number',
      })
    ).toThrow('A2');
    expect(() => studioSortRange(document, 'main', selection('A1', 'A2'), 1, 'asc', false)).toThrow(
      'A2'
    );
    expect(JSON.stringify(document)).toBe(before);
  });

  it('inherits links by the two-seed series period and retains untouched links', () => {
    const document = fixture();
    document.sheets[0].cells = { A1: { input: '1' }, A2: { input: '2' } };
    document.sheets[0].hyperlinks = [
      link({ id: 'one', ref: 'A1', target: '#$B$1' }),
      link({ id: 'two', ref: 'A2', target: '../file.xlsx' }),
      link({ id: 'outside', ref: 'B7' }),
    ];
    const result = studioFillSeries(document, 'main', selection('A1', 'A6'), {
      direction: 'down',
      type: 'number',
      seedCount: 2,
    });
    for (const row of [3, 4, 5, 6]) {
      expect(result.sheets[0].cells[`A${row}`].input).toBe(String(row));
      expect(studioSheetHyperlinkAt(result.sheets[0], `A${row}`)?.target).toBe(
        row % 2 ? '#$B$1' : '../file.xlsx'
      );
    }
    expect(studioSheetHyperlinkAt(result.sheets[0], 'B7')).toBe(document.sheets[0].hyperlinks[2]);
  });

  it('moves links with their rows during sorting while keeping headers and untouched columns', () => {
    const document = fixture();
    document.sheets[0].cells = {
      A1: { input: '标题' },
      A2: { input: '20' },
      A3: { input: '10' },
      B2: { input: '第二行' },
      B3: { input: '第三行' },
    };
    document.sheets[0].hyperlinks = [
      link({ id: 'header' }),
      link({ id: 'second', ref: 'A2:B2', target: '#$C$2' }),
      link({ id: 'third', ref: 'B3', target: 'file:///third.xlsx' }),
      link({ id: 'untouched', ref: 'D2' }),
    ];
    const result = studioSortRange(document, 'main', selection('A1', 'B3'), 1, 'asc');
    expect(result.sheets[0].cells.A2.input).toBe('10');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'B2')?.target).toBe('file:///third.xlsx');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'A3')?.target).toBe('#$C$2');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'B3')?.target).toBe('#$C$2');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'A1')?.id).toBe('header');
    expect(studioSheetHyperlinkAt(result.sheets[0], 'D2')?.id).toBe('untouched');
  });

  it('rejects a merge that would hide a separate non-anchor link, and clears one merged visual cell completely', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [link({ id: 'anchor' }), link({ id: 'other', ref: 'B1' })];
    expect(() => studioMergeCells(document, 'main', selection('A1', 'B2'))).toThrow('超链接');
    document.sheets[0].hyperlinks = [link({ ref: 'A1:B2' })];
    const merged = studioMergeCells(document, 'main', selection('A1', 'B2'));
    expect(merged.sheets[0].hyperlinks).toBe(document.sheets[0].hyperlinks);
    expect(() => studioSetSheetHyperlink(merged, 'main', link({ id: 'new', ref: 'B2' }))).toThrow(
      '左上角'
    );
    expect(studioPatchCells(merged, 'main', { A1: { input: '' } }).sheets[0].hyperlinks).toEqual(
      []
    );
    const pasted = studioPatchCells(
      merged,
      'main',
      { A1: { input: '覆盖' } },
      { hyperlinks: { $a$1: null } }
    );
    expect(pasted.sheets[0].hyperlinks).toEqual([]);
  });
});

describe('Office Studio hyperlink query indexes', () => {
  it('indexes 100,000 overlapping rectangular records once and avoids materializing them for every visible cell', () => {
    const document = fixture();
    let reads = 0;
    document.sheets[0].hyperlinks = Array.from({ length: 100000 }, (_, index) => ({
      id: `link-${index}`,
      get ref() {
        reads++;
        return 'A1:IV10000';
      },
      target: index === 0 ? 'file:///opaque.xlsx' : 'https://example.com/',
    }));
    for (let row = 1; row <= 30; row++)
      for (let col = 1; col <= 26; col++)
        expect(
          studioCellHyperlink(document, 'main', `${String.fromCharCode(64 + col)}${row}`)?.id
        ).toBe('link-1');
    expect(reads).toBeLessThan(110000);
    expect(studioSheetHyperlinkAt(document.sheets[0], 'A1')?.id).toBe('link-0');
    expect(studioSheetHyperlinksAt(document.sheets[0], 'A1')).toHaveLength(100000);
  }, 15000);

  it('filters dense broken ranges once, retains their fallback and invalidates eligibility on workbook rename', () => {
    const document = fixture();
    let reads = 0;
    document.sheets[0].hyperlinks = Array.from({ length: 1000 }, (_, index) => ({
      id: `link-${index}`,
      ref: 'A1:IV10000',
      get location() {
        reads++;
        return 'Missing!A1';
      },
    }));
    expect(studioCellHyperlink(document, 'main', 'A1')?.id).toBe('link-0');
    const afterFirstQuery = reads;
    for (let row = 2; row <= 20; row++)
      expect(studioCellHyperlink(document, 'main', `B${row}`)?.id).toBe('link-0');
    expect(reads).toBe(afterFirstQuery);
    const renamed = {
      ...document,
      sheets: document.sheets.map((sheet) =>
        sheet.id === 'other' ? { ...sheet, name: 'Missing' } : sheet
      ),
    };
    expect(
      studioResolveSheetHyperlink(renamed, 'main', studioCellHyperlink(renamed, 'main', 'B2')!).kind
    ).toBe('internal');
    expect(reads).toBeGreaterThan(afterFirstQuery);
  });

  it('keeps point, reversed range and immutable replacement lookups in original metadata order', () => {
    const document = fixture();
    const sheet = document.sheets[0];
    sheet.hyperlinks = [link({ id: 'range', ref: 'C3:A1' }), link({ id: 'point', ref: '$B$2' })];
    expect(studioSheetHyperlinksAt(sheet, 'B2').map((record) => record.id)).toEqual([
      'range',
      'point',
    ]);
    expect(studioSheetHyperlinkAt(sheet, 'B2')?.id).toBe('range');
    const changed = { ...sheet, hyperlinks: [link({ id: 'new', ref: 'D4' })] };
    expect(studioSheetHyperlinkAt(changed, 'B2')).toBeUndefined();
    expect(studioSheetHyperlinkAt(changed, 'D4')?.id).toBe('new');
    expect(studioSheetHyperlinkAt(sheet, 'B2')?.id).toBe('range');
  });
});

describe('Office Studio hyperlink structural migration', () => {
  it('moves owner refs and workbook destinations once across all sheets, preserving external fragments', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [
      link({ id: 'local', ref: '$B$2:$C$4', target: undefined, location: 'Sheet1!$A$2:$B$4' }),
      link({ id: 'external', ref: 'D1', location: 'Sheet1!B2' }),
    ];
    document.sheets[1].hyperlinks = [link({ id: 'cross', target: '#sHeEt1!$B$2' })];
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'column',
      type: 'insert',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].hyperlinks?.[0]).toMatchObject({
      ref: '$C$2:$D$4',
      location: 'Sheet1!$A$2:$C$4',
    });
    expect(result.sheets[0].hyperlinks?.[1]).toMatchObject({
      ref: 'E1',
      location: 'Sheet1!B2',
      target: 'https://example.com/path',
    });
    expect(result.sheets[1].hyperlinks?.[0]).toMatchObject({ ref: 'A1', target: '#sHeEt1!$C$2' });
    expect(document.sheets[0].hyperlinks[0].ref).toBe('$B$2:$C$4');
    expect(result.sheets[0].structureEdits).toHaveLength(1);
    expect(isOfficeStudioDocument(result)).toBe(true);
  });

  it('removes deleted owners while preserving broken destination metadata with #REF!', () => {
    const document = fixture();
    document.sheets[0].hyperlinks = [
      link({ id: 'deletedOwner', ref: 'B2' }),
      link({ id: 'keptOwner', ref: 'C3', target: undefined, location: '$A$2', tooltip: '说明' }),
    ];
    document.sheets[1].hyperlinks = [link({ target: '#Sheet1!$A$2', display: '跳转' })];
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 2,
      count: 1,
    });
    expect(result.sheets[0].hyperlinks).toEqual([
      link({ id: 'keptOwner', ref: 'C2', target: undefined, location: '#REF!', tooltip: '说明' }),
    ]);
    expect(result.sheets[1].hyperlinks?.[0]).toMatchObject({ target: '#REF!', display: '跳转' });
    expect(
      studioResolveSheetHyperlink(result, 'other', result.sheets[1].hyperlinks![0])
    ).toMatchObject({ kind: 'blocked', reason: '链接目标已删除。' });
  });

  it('updates local sheet names and deleted sheet targets while keeping formula strings and external URLs', () => {
    const document = fixture();
    document.sheets[1].cells.A1 = { input: '=HYPERLINK("#Sheet1!A1","跳转")' };
    document.sheets[1].hyperlinks = [
      link({ id: 'local', target: '#Sheet1!$A$1:$B$2' }),
      link({
        id: 'external',
        ref: 'B1',
        target: 'https://example.com/Sheet1',
        location: 'Sheet1!A1',
      }),
    ];
    const renamed = studioRenameSheet(document, 'main', "新 O'Brien");
    expect(renamed.sheets[1].hyperlinks?.[0].target).toBe("#'新 O''Brien'!$A$1:$B$2");
    expect(renamed.sheets[1].hyperlinks?.[1]).toBe(document.sheets[1].hyperlinks[1]);
    expect(renamed.sheets[1].cells.A1.input).toBe(document.sheets[1].cells.A1.input);
    const deleted = studioDeleteSheet(renamed, 'main');
    expect(deleted.sheets[0].hyperlinks?.[0].target).toBe('#REF!');
    expect(deleted.sheets[0].hyperlinks?.[1]).toBe(document.sheets[1].hyperlinks[1]);
    expect(deleted.sheets[0].cells.A1.input).toBe(document.sheets[1].cells.A1.input);
  });

  it('keeps legacy unknown arrays and unparsed locations through pure structure helpers', () => {
    const document = fixture();
    const sheet = document.sheets[0];
    delete sheet.hyperlinks;
    expect(
      studioTransformSheetHyperlinks(sheet, sheet, {
        axis: 'row',
        type: 'insert',
        index: 1,
        count: 1,
      })
    ).toBe(sheet);
    expect(studioRenameSheetHyperlinks(sheet, 'Sheet1', 'New')).toBe(sheet);
    expect(studioDeleteSheetHyperlinks(sheet, document.sheets[1])).toBe(sheet);
    const opaque = {
      ...sheet,
      hyperlinks: [link({ ref: 'B2', target: undefined, location: 'NamedRange' })],
    };
    expect(
      studioTransformSheetHyperlinks(opaque, sheet, {
        axis: 'row',
        type: 'insert',
        index: 1,
        count: 1,
      }).hyperlinks?.[0]
    ).toMatchObject({ ref: 'B3', location: 'NamedRange' });
  });

  it('clips only the deleted part of rectangular workbook destinations', () => {
    const document = fixture();
    document.sheets[1].hyperlinks = [link({ target: undefined, location: 'Sheet1!$B$2:$D$5' })];
    const result = studioChangeSheetStructure(document, 'main', {
      axis: 'row',
      type: 'delete',
      index: 3,
      count: 2,
    });
    expect(result.sheets[1].hyperlinks?.[0].location).toBe('Sheet1!$B$2:$D$3');
    expect(
      studioResolveSheetHyperlink(result, 'other', result.sheets[1].hyperlinks![0])
    ).toMatchObject({ kind: 'internal', ref: 'B2:D3' });
  });

  it('keeps native hyperlink priority over formula-derived links', () => {
    const document = fixture();
    document.sheets[0].cells.A1 = { input: '=HYPERLINK("https://formula.example/",7)' };
    document.sheets[0].hyperlinks = [link({ target: 'file:///native.xlsx' })];
    expect(studioCellHyperlink(document, 'main', 'A1', studioCalculate(document))).toBe(
      document.sheets[0].hyperlinks[0]
    );
  });
});
