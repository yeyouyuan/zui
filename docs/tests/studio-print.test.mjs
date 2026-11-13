import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { clearTimeout, setTimeout } from 'node:timers';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const uiRequire = createRequire(new URL('../../packages/ui/package.json', import.meta.url));
const { JSDOM } = uiRequire('jsdom');
const dom = new JSDOM('', { url: 'http://127.0.0.1:5174/' });
const sourceModules = new Map();
function compiled(relative, overrides = {}, environment = {}) {
  const source = new URL(relative, import.meta.url);
  const localHelper = source.pathname.includes('/packages/ui/src/components/OfficeStudio/');
  if (localHelper && sourceModules.has(source.href)) return sourceModules.get(source.href).exports;
  const module = { exports: {} };
  if (localHelper) sourceModules.set(source.href, module);
  const output = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id) => {
      if (overrides[id] !== undefined) return overrides[id];
      if (id.startsWith('.')) {
        const dependency = new URL(`${id}${id.endsWith('.ts') ? '' : '.ts'}`, source);
        if (dependency.pathname.includes('/packages/ui/src/components/OfficeStudio/'))
          return compiled(dependency.href);
      }
      return require(id);
    },
    Blob,
    crypto: webcrypto,
    document: dom.window.document,
    URL,
    setTimeout,
    clearTimeout,
    Map,
    Set,
    Error,
    ...environment,
  });
  return module.exports;
}
const models = compiled('../../packages/ui/src/components/OfficeStudio/studio-model.ts');
const rules = compiled('../../packages/ui/src/components/OfficeStudio/studio-sheet-rules.ts', {
  './studio-model': models,
});
const sheets = compiled('../../packages/ui/src/components/OfficeStudio/studio-sheet-model.ts', {
  './studio-sheet-rules': rules,
});
const print = compiled('../src/pages/collaboration/office-studio/studio-print.ts', {
  '@zui/react': models,
  '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model': sheets,
  '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-rules': rules,
  './studio-files': {
    exportStudioFile: async () => {
      throw new Error('unused');
    },
  },
});

test('sheet print respects widths, vertical alignment, blank border-only cells and merged outer edges', () => {
  const document = {
    version: 1,
    id: 'print-office',
    kind: 'excel',
    name: '打印.xlsx',
    activeSheetId: 'a',
    sheets: [
      {
        id: 'a',
        name: '明细',
        rowCount: 5,
        columnCount: 28,
        columnWidths: { A: 180, AA: 250 },
        merges: ['B2:C3'],
        cells: {
          A1: {
            input: '顶端',
            verticalAlign: 'top',
            borders: { bottom: { style: 'double', color: '#123456' } },
          },
          B2: {
            input: '合并',
            verticalAlign: 'middle',
            borders: {
              top: { style: 'thick', color: '#cc3300' },
              left: { style: 'thick', color: '#cc3300' },
            },
          },
          C2: { input: '', borders: { right: { style: 'thick', color: '#cc3300' } } },
          B3: { input: '', borders: { bottom: { style: 'thick', color: '#cc3300' } } },
          AA5: { input: '', borders: { bottom: { style: 'thin' } } },
        },
      },
    ],
  };
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.equal(rendered.querySelector('colgroup col').style.width, '180px');
  assert.equal(rendered.querySelectorAll('colgroup col')[26].style.width, '250px');
  const first = rendered.querySelector('td');
  assert.equal(first.style.verticalAlign, 'top');
  assert.equal(first.style.borderBottomStyle, 'double');
  const merged = rendered.querySelector('td[colspan="2"]');
  assert.equal(merged.style.verticalAlign, 'middle');
  assert.equal(merged.style.borderRightWidth, '3px');
  assert.equal(merged.style.borderBottomWidth, '3px');
  assert.equal(rendered.querySelectorAll('tr').length, 5);
});

test('Word print content repeats headers for explicit pages, preserves page fields and safely embeds images', () => {
  const document = models.createOfficeStudioDocument('word');
  document.header = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '项目评审' }] }],
  };
  document.footer = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'pageNumber', attrs: { kind: 'current' } },
          { type: 'text', text: '/' },
          { type: 'pageNumber', attrs: { kind: 'total' } },
        ],
      },
    ],
  };
  document.content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '第一页' },
          {
            type: 'image',
            attrs: { src: 'data:image/png;base64,aGVsbG8=', width: 100, height: 80, alt: '参考图' },
          },
        ],
      },
      { type: 'pageBreak' },
      { type: 'paragraph', content: [{ type: 'text', text: '第二页' }] },
    ],
  };
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.equal(rendered.querySelectorAll('.studio-print-page').length, 2);
  assert.equal(rendered.querySelectorAll('header')[1].textContent, '项目评审');
  assert.deepEqual(
    [...rendered.querySelectorAll('footer')].map((footer) => footer.textContent),
    ['1/2', '2/2']
  );
  assert.equal(rendered.querySelector('img').getAttribute('alt'), '参考图');
  assert.equal(rendered.querySelector('img').getAttribute('width'), '100');
});

test('document text, hyperlinks, labels and style attributes cannot inject script into printable HTML', () => {
  const document = models.createOfficeStudioDocument('word');
  document.name = '<img src=x onerror=alert(1)>.docx';
  document.content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '<script>alert(1)</script>',
            marks: [
              { type: 'link', attrs: { href: 'javascript:alert(1)' } },
              {
                type: 'textStyle',
                attrs: {
                  fontFamily: 'Arial; background:url(https://example.com)',
                  color: 'red;position:fixed',
                  fontSize: '12px" onclick="alert(1)',
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.equal(rendered.querySelector('script'), null);
  assert.equal(rendered.querySelector('a'), null);
  assert.equal(rendered.querySelector('[onclick]'), null);
  assert.equal(rendered.querySelector('img'), null);
  assert.equal(rendered.querySelector('article').textContent, '<script>alert(1)</script>');
  assert.match(
    rendered.querySelector('[http-equiv]').getAttribute('content'),
    /default-src 'none'/
  );
});

test('Excel print uses computed values, filters and merged cells, and includes the actual chart series', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '销售',
      rowCount: 20,
      columnCount: 6,
      cells: {
        A1: { input: '类型' },
        B1: { input: '金额' },
        A2: { input: '产品' },
        B2: { input: '10' },
        A3: { input: '服务' },
        B3: { input: '=B2+15', numberFormat: '0.00' },
        A5: { input: '备注', underline: true, wrap: true },
      },
      merges: ['A5:B5'],
      filter: { range: 'A1:B3', columns: { A: { operator: 'equals', value: '服务' } } },
      charts: [{ id: 'sales-chart', type: 'bar', title: '金额分布', range: 'A1:B3' }],
    },
  ];
  document.activeSheetId = 'main';
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const table = rendered.querySelector('table');
  assert.match(table.textContent, /25\.00/);
  assert.doesNotMatch(table.textContent, /产品/);
  assert.equal(table.querySelector('[colspan="2"]').textContent, '备注');
  assert.equal(rendered.querySelector('svg').getAttribute('aria-label'), '金额分布');
  assert.match(rendered.querySelector('figure').textContent, /服务/);
  assert.doesNotMatch(rendered.querySelector('figure').textContent, /产品/);
});

test('Excel cell fonts retain point sizes, formulas and conditional styling while legacy cells inherit defaults', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '字体',
      rowCount: 2,
      columnCount: 4,
      cells: {
        A1: { input: '12.5', fontFamily: 'Calibri', fontSize: 11.5, numberFormat: '0.00' },
        B1: { input: '=A1*2', fontFamily: 'Times New Roman', fontSize: 1 },
        C1: { input: '中文', fontFamily: '未知字体, serif', fontSize: 409 },
        D1: { input: '旧文档' },
        A2: { input: '', fontFamily: '宋体', fontSize: 24 },
      },
      conditionalFormats: [
        {
          id: 'amount',
          range: 'A1:A1',
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['5'],
          priority: 1,
          style: { bold: true, color: '#123456', numberFormat: '0.000' },
        },
      ],
      hyperlinks: [
        { id: 'number', ref: 'A1', target: 'https://example.com/amount', display: '金额' },
        { id: 'blank', ref: 'A2', target: 'https://example.com/blank', display: '空白链接' },
      ],
    },
  ];
  document.activeSheetId = 'main';
  const original = JSON.stringify(document);
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const rows = rendered.querySelectorAll('tbody tr');
  const cells = rows[0].querySelectorAll('td');
  assert.equal(cells[0].querySelector('a').textContent, '12.500');
  assert.equal(cells[0].style.fontFamily, '"Calibri"');
  assert.equal(cells[0].style.fontSize, '11.5pt');
  assert.equal(cells[0].style.fontWeight, '700');
  assert.equal(cells[0].style.color, 'rgb(18, 52, 86)');
  assert.equal(cells[1].textContent, '25');
  assert.equal(cells[1].style.fontFamily, '"Times New Roman"');
  assert.equal(cells[1].style.fontSize, '1pt');
  assert.equal(cells[2].style.fontFamily, '"未知字体, serif"');
  assert.equal(cells[2].style.fontSize, '409pt');
  assert.equal(cells[3].style.fontFamily, '');
  assert.equal(cells[3].style.fontSize, '');
  const blank = rows[1].querySelector('td');
  assert.equal(blank.querySelector('a').textContent, '空白链接');
  assert.equal(blank.style.fontFamily, '"宋体"');
  assert.equal(blank.style.fontSize, '24pt');
  assert.equal(JSON.stringify(document), original);
});

test('unknown Excel font names cannot create CSS declarations or HTML even with quotes and XML whitespace', () => {
  const document = models.createOfficeStudioDocument('excel');
  const names = [
    'Noto Sans "预算" \'regular\'',
    'Arial; color: red; --injected: true; background-image:url(https://example.com/font)',
    'Arial";color:red;--injected:true;font-family:"',
    'Font\\name\tTabbed\nNext\rReturned\\',
    'Font"><img src=x onerror=alert(1)><script>alert(1)</script>',
  ];
  const sheet = document.sheets[0];
  document.sheets = [sheet];
  document.activeSheetId = sheet.id;
  sheet.cells = Object.fromEntries(
    names.map((fontFamily, index) => [
      `${String.fromCharCode(65 + index)}1`,
      { input: `字体 ${index + 1}`, fontFamily, fontSize: 11.5 },
    ])
  );
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const cells = rendered.querySelectorAll('td');
  assert.equal(cells.length, names.length);
  assert.equal(rendered.querySelectorAll('img, script, [onerror], [onclick]').length, 0);
  for (const [index, cell] of [...cells].entries()) {
    assert.equal(cell.textContent, `字体 ${index + 1}`);
    assert.equal(cell.attributes.length, 1);
    assert.equal(cell.style.length, 3);
    assert.equal(cell.style.verticalAlign, 'bottom');
    assert.ok(cell.style.fontFamily);
    assert.equal(cell.style.fontSize, '11.5pt');
    assert.equal(cell.style.color, '');
    assert.equal(cell.style.backgroundImage, '');
    assert.equal(cell.style.getPropertyValue('--injected'), '');
  }
});

test('invalid Excel font controls and out-of-range point sizes fail the print model gate', () => {
  for (const fontFamily of ['非法\u0000字体', '非法\u000b字体', '非法\ud800字体']) {
    const document = models.createOfficeStudioDocument('excel');
    document.sheets[0].cells = { A1: { input: '文字', fontFamily } };
    assert.throws(() => print.createStudioPrintHtml(document), /文档模型无效/);
  }
  for (const fontSize of [0, 0.5, 409.1, Infinity, NaN, '12pt']) {
    const document = models.createOfficeStudioDocument('excel');
    document.sheets[0].cells = { A1: { input: '文字', fontSize } };
    assert.throws(() => print.createStudioPrintHtml(document), /文档模型无效/);
  }
});

test('Excel print escapes native hyperlink text, tooltip and validated external destinations', () => {
  const document = models.createOfficeStudioDocument('excel');
  const target = 'https://example.com/report?search="<report>"&owner=one';
  const text = '<img src=x onerror=alert(1)> & "原值"';
  const tooltip = '<script>alert(1)</script> & "详细说明"';
  document.sheets = [
    {
      id: 'main',
      name: '链接',
      rowCount: 1,
      columnCount: 2,
      cells: { A1: { input: text }, B1: { input: '报告邮箱' } },
      hyperlinks: [
        { id: 'web', ref: 'A1', target, tooltip, display: '不应覆盖原值' },
        { id: 'mail', ref: 'B1', target: 'mailto:reports@example.com?subject=Report&body=Hello' },
      ],
    },
  ];
  document.activeSheetId = 'main';
  const html = print.createStudioPrintHtml(document);
  const rendered = new JSDOM(html).window.document;
  const links = rendered.querySelectorAll('a');
  assert.equal(links.length, 2);
  assert.equal(links[0].textContent, text);
  assert.equal(links[0].getAttribute('title'), tooltip);
  assert.equal(links[0].getAttribute('href'), new URL(target).href);
  assert.equal(links[0].getAttribute('target'), '_blank');
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(
    links[1].getAttribute('href'),
    'mailto:reports@example.com?subject=Report&body=Hello'
  );
  assert.match(html, /&amp;owner=one/);
  assert.equal(rendered.querySelector('script,img,[onerror],[onclick]'), null);
});

test('Excel print preserves unsupported protocols, paths and workbook locations as plain text', () => {
  const document = models.createOfficeStudioDocument('excel');
  const targets = [
    'javascript:alert(1)',
    'data:text/html,<svg onload=alert(1)>',
    'file:///Users/reports/2026.xlsx',
    'C:\\reports\\2026.xlsx',
    '\\\\server\\share\\2026.xlsx',
    '../2026.xlsx',
    '//example.com/report',
    'ftp://example.com/report',
    'https://',
  ];
  const sheet = {
    id: 'main',
    name: '链接',
    rowCount: targets.length + 1,
    columnCount: 1,
    cells: {},
    hyperlinks: targets.map((target, index) => ({
      id: `blocked-${index}`,
      ref: `A${index + 1}`,
      target,
      tooltip: '保留 <原始信息>',
    })),
  };
  sheet.hyperlinks.push({ id: 'internal', ref: `A${targets.length + 1}`, location: '链接!$A$1' });
  document.sheets = [sheet];
  document.activeSheetId = sheet.id;
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.deepEqual(
    [...rendered.querySelectorAll('td')].map((cell) => cell.textContent),
    [...targets, '链接!$A$1']
  );
  assert.equal(rendered.querySelector('a,[href],script,img,svg,[onload]'), null);
});

test('Excel hyperlinks retain typed values, formatted formula results and empty or failing formulas', () => {
  const document = models.createOfficeStudioDocument('excel');
  const addresses = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'];
  document.sheets = [
    {
      id: 'main',
      name: '原值',
      rowCount: 1,
      columnCount: 6,
      cells: {
        A1: { input: '12.5', numberFormat: '0.00' },
        B1: { input: '=A1*2', numberFormat: '0.000' },
        C1: { input: '=1=1' },
        D1: { input: '00123' },
        E1: { input: '=""' },
        F1: { input: '=1/0' },
      },
      hyperlinks: addresses.map((ref, index) => ({
        id: `typed-${index}`,
        ref,
        target: 'https://example.com/report',
        display: `原生标签${index}`,
        tooltip: `原生提示${index}`,
      })),
    },
  ];
  document.activeSheetId = 'main';
  const before = JSON.stringify(document);
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.deepEqual(
    [...rendered.querySelectorAll('td')].map((cell) => cell.textContent),
    ['12.50', '25.000', 'TRUE', '00123', '', '#DIV/0!']
  );
  assert.equal(rendered.querySelectorAll('a').length, addresses.length);
  assert.equal(JSON.stringify(document), before);
});

test('blank hyperlinks stay printable from a frozen read-only snapshot without adding editing controls', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '只读',
      rowCount: 4,
      columnCount: 4,
      cells: { B2: { input: '' } },
      hyperlinks: [
        { id: 'bare', ref: 'A1', target: 'https://example.com/blank' },
        {
          id: 'label',
          ref: 'B2',
          target: 'https://example.com/label',
          display: '<空白链接> & 标签',
        },
        { id: 'file', ref: 'C3', target: 'file:///reports/2026.xlsx' },
        { id: 'internal', ref: 'D4', location: '只读!$A$1', display: '内部位置' },
      ],
    },
  ];
  document.activeSheetId = 'main';
  const before = JSON.stringify(document);
  const freeze = (value) => {
    for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
    Object.freeze(value);
  };
  freeze(document);
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const rows = rendered.querySelectorAll('tbody tr');
  assert.equal(rows.length, 4);
  assert.equal(rows[0].querySelector('td').textContent, 'https://example.com/blank');
  assert.equal(rows[1].querySelectorAll('td')[1].textContent, '<空白链接> & 标签');
  assert.equal(rows[2].querySelectorAll('td')[2].textContent, 'file:///reports/2026.xlsx');
  assert.equal(rows[3].querySelectorAll('td')[3].textContent, '内部位置');
  assert.equal(rendered.querySelectorAll('a').length, 2);
  assert.equal(rendered.querySelector('input,button,textarea,[contenteditable],img'), null);
  assert.equal(JSON.stringify(document), before);
});

test('Excel print resolves top-level HYPERLINK formulas while preserving calculated labels', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '公式链接',
      rowCount: 1,
      columnCount: 3,
      cells: {
        A1: { input: '=HYPERLINK("https://example.com/report?a=1&b=2","打开 <报告>")' },
        B1: { input: '=HYPERLINK("javascript:alert(1)","危险 & 链接")' },
        C1: { input: '=HYPERLINK("https://example.com/number",12.5)', numberFormat: '0.00' },
      },
    },
  ];
  document.activeSheetId = 'main';
  const rendered = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const cells = rendered.querySelectorAll('td');
  assert.equal(cells[0].textContent, '打开 <报告>');
  assert.equal(
    cells[0].querySelector('a').getAttribute('href'),
    'https://example.com/report?a=1&b=2'
  );
  assert.equal(cells[1].textContent, '危险 & 链接');
  assert.equal(cells[1].querySelector('a'), null);
  assert.equal(cells[2].textContent, '12.50');
  assert.equal(cells[2].querySelector('a').getAttribute('href'), 'https://example.com/number');
  assert.equal(rendered.querySelector('script,img,[onclick]'), null);
});

test('a hyperlink outside populated cells cannot bypass the print area limit', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '远端链接',
      rowCount: 5000,
      columnCount: 11,
      cells: {},
      hyperlinks: [{ id: 'far', ref: 'K5000', target: 'https://example.com/report' }],
    },
  ];
  document.activeSheetId = 'main';
  assert.throws(() => print.createStudioPrintHtml(document), /打印区域过大/);
});

test('oversized print regions and invalid models fail before constructing a printable frame', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets[0].rowCount = 10000;
  document.sheets[0].columnCount = 256;
  document.sheets[0].cells.IV10000 = { input: '最后一格' };
  assert.throws(() => print.createStudioPrintHtml(document), /打印区域过大/);
  assert.throws(() => print.createStudioPrintHtml({ kind: 'word' }), /模型无效/);
  assert.throws(
    () => print.createStudioPrintHtml(models.createOfficeStudioDocument('pdf')),
    /原生 PDF/
  );
});

test('printing calls the document frame and releases it after the print dialog ends', async () => {
  const task = print.printStudioFile(models.createOfficeStudioDocument('word'));
  const frame = dom.window.document.querySelector('iframe');
  assert.ok(frame);
  let calls = 0;
  frame.contentWindow.focus = () => {};
  frame.contentWindow.print = () => {
    calls++;
  };
  frame.dispatchEvent(new dom.window.Event('load'));
  await task;
  try {
    assert.equal(calls, 1);
    assert.ok(dom.window.document.querySelector('iframe'));
  } finally {
    frame.contentWindow.dispatchEvent(new dom.window.Event('afterprint'));
  }
  assert.equal(dom.window.document.querySelector('iframe'), null);
});

test('Excel print renders recalculated conditional styles and number formats, including styled empty cells', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '规则',
      rowCount: 3,
      columnCount: 4,
      cells: { A1: { input: '8.5' }, B1: { input: '=2*A1', bold: true, background: '#FFFF00' } },
      hyperlinks: [
        { id: 'amount-link', ref: 'A1', target: 'https://example.com/amount', display: '金额标签' },
        { id: 'total-link', ref: 'B1', target: 'https://example.com/total', display: '总额标签' },
        { id: 'empty-link', ref: 'D2', target: 'https://example.com/empty', display: '空白链接' },
      ],
      conditionalFormats: [
        {
          id: 'amount',
          range: 'A1:A1',
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['5'],
          priority: 1,
          style: { bold: true, background: '#FFCCDD', numberFormat: '0.000' },
        },
        {
          id: 'total',
          range: 'B1:B1',
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['10'],
          priority: 2,
          style: { bold: false, italic: true, color: '#123456' },
        },
        {
          id: 'empty',
          range: 'D2:D2',
          type: 'expression',
          formula: '=1=1',
          priority: 3,
          style: { background: '#00AA00' },
        },
      ],
    },
  ];
  document.activeSheetId = 'main';
  const printed = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  const rows = printed.querySelectorAll('tbody tr');
  assert.equal(rows.length, 2);
  const first = rows[0].querySelectorAll('td');
  assert.equal(first[0].textContent, '8.500');
  assert.equal(first[0].querySelector('a').textContent, '8.500');
  assert.equal(first[0].style.fontWeight, '700');
  assert.equal(first[0].style.backgroundColor, 'rgb(255, 204, 221)');
  assert.equal(first[1].textContent, '17');
  assert.equal(first[1].querySelector('a').textContent, '17');
  assert.equal(first[1].style.fontWeight, '');
  assert.equal(first[1].style.fontStyle, 'italic');
  assert.equal(first[1].style.backgroundColor, 'rgb(255, 255, 0)');
  assert.equal(rows[1].querySelectorAll('td')[3].style.backgroundColor, 'rgb(0, 170, 0)');
  assert.equal(rows[1].querySelectorAll('td')[3].querySelector('a').textContent, '空白链接');
  document.sheets[0].cells.A1.input = '4';
  const updated = new JSDOM(print.createStudioPrintHtml(document)).window.document;
  assert.equal(updated.querySelector('td').textContent, '4');
  assert.equal(updated.querySelector('td').style.backgroundColor, '');
  assert.equal(updated.querySelectorAll('td')[1].style.fontStyle, '');
});

test('conditional formatting cannot silently extend printing beyond its cell budget', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets[0].rowCount = 5000;
  document.sheets[0].conditionalFormats = [
    {
      id: 'large',
      range: 'A1:K5000',
      type: 'expression',
      formula: '=TRUE',
      priority: 1,
      style: { background: '#FFEEDD' },
    },
  ];
  assert.throws(() => print.createStudioPrintHtml(document), /打印区域过大/);
});

test('PDF printing uses the exported file and releases its object URL after printing', async () => {
  const pdf = await require('pdf-lib').PDFDocument.create();
  pdf.addPage([300, 400]);
  const source = new Blob([await pdf.save()], { type: 'application/pdf' });
  const document = models.createOfficeStudioDocument('pdf');
  const revoked = [];
  let exported = 0;
  const isolated = compiled(
    '../src/pages/collaboration/office-studio/studio-print.ts',
    {
      '@zui/react': models,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model': sheets,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-rules': rules,
      './studio-files': {
        exportStudioFile: async (snapshot, original) => {
          assert.equal(snapshot, document);
          assert.equal(original, source);
          exported++;
          return source;
        },
      },
    },
    {
      URL: {
        createObjectURL: (file) => {
          assert.equal(file, source);
          return URL.createObjectURL(file);
        },
        revokeObjectURL: (url) => {
          revoked.push(url);
          URL.revokeObjectURL(url);
        },
      },
    }
  );
  const task = isolated.printStudioFile(document, source);
  await nextTurn();
  const frame = dom.window.document.querySelector('iframe');
  assert.ok(frame);
  const url = frame.src;
  assert.match(url, /^blob:/);
  const view = frame.contentWindow;
  let calls = 0;
  view.focus = () => {};
  view.print = () => {
    calls++;
  };
  frame.dispatchEvent(new dom.window.Event('load'));
  await task;
  try {
    assert.equal(exported, 1);
    assert.equal(calls, 1);
    assert.equal(revoked.length, 0);
  } finally {
    view.dispatchEvent(new dom.window.Event('afterprint'));
  }
  assert.deepEqual(revoked, [url]);
  view.dispatchEvent(new dom.window.Event('afterprint'));
  assert.equal(revoked.length, 1);
  assert.equal(dom.window.document.querySelector('iframe'), null);
});

test('a failed PDF print preview cleans up its file and ignores a late load event', async () => {
  const revoked = [];
  const source = new Blob(['PDF source'], { type: 'application/pdf' });
  const isolated = compiled(
    '../src/pages/collaboration/office-studio/studio-print.ts',
    {
      '@zui/react': models,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model': sheets,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-rules': rules,
      './studio-files': { exportStudioFile: async () => source },
    },
    {
      URL: {
        createObjectURL: () => 'blob:print-failed',
        revokeObjectURL: (url) => revoked.push(url),
      },
    }
  );
  const task = isolated.printStudioFile(models.createOfficeStudioDocument('pdf'), source);
  const rejected = assert.rejects(task, /打印预览无法加载/);
  await nextTurn();
  const frame = dom.window.document.querySelector('iframe');
  let calls = 0;
  frame.contentWindow.print = () => {
    calls++;
  };
  frame.dispatchEvent(new dom.window.Event('error'));
  await rejected;
  frame.dispatchEvent(new dom.window.Event('load'));
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.deepEqual(revoked, ['blob:print-failed']);
  assert.equal(dom.window.document.querySelector('iframe'), null);
});

test('a timed-out print preview never starts printing when a late font load completes', async () => {
  const callbacks = [];
  const isolated = compiled(
    '../src/pages/collaboration/office-studio/studio-print.ts',
    {
      '@zui/react': models,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model': sheets,
      '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-rules': rules,
      './studio-files': {},
    },
    {
      setTimeout: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      clearTimeout: () => {},
    }
  );
  let completeFonts;
  const fontsReady = new Promise((resolve) => {
    completeFonts = resolve;
  });
  const task = isolated.printStudioFile(models.createOfficeStudioDocument('word'));
  const rejected = assert.rejects(task, /加载超时/);
  const frame = dom.window.document.querySelector('iframe');
  let prints = 0;
  frame.contentWindow.print = () => {
    prints++;
  };
  Object.defineProperty(frame.contentWindow.document, 'fonts', {
    value: { ready: fontsReady },
    configurable: true,
  });
  frame.dispatchEvent(new dom.window.Event('load'));
  callbacks[0]();
  await rejected;
  assert.equal(dom.window.document.querySelector('iframe'), null);
  completeFonts();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(prints, 0);
});

test('Sheet print uses actual row sizes and keeps merged content whose original row is hidden', () => {
  const document = models.createOfficeStudioDocument('excel');
  document.sheets = [
    {
      id: 'main',
      name: '行高',
      rowCount: 10,
      columnCount: 3,
      defaultRowHeight: 18.75,
      rowHeights: { 1: 30.75, 2: 44.5, 3: 27 },
      hiddenRows: [1],
      merges: ['A1:A3'],
      cells: { A1: { input: '合并内容' }, B2: { input: '第二行' }, B3: { input: '第三行' } },
    },
  ];
  document.activeSheetId = 'main';
  const html = print.createStudioPrintHtml(document);
  const rendered = new JSDOM(html).window.document;
  const rows = [...rendered.querySelectorAll('tr')];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].style.height, '44.5pt');
  assert.equal(rows[1].style.height, '27pt');
  const merged = rows[0].querySelector('td');
  assert.equal(merged.rowSpan, 2);
  assert.match(merged.textContent, /合并内容/);
  assert.equal(
    merged.querySelector('.studio-print-cell').style.maxHeight,
    `${((44.5 + 27) * 4) / 3 - 4}px`
  );
});
