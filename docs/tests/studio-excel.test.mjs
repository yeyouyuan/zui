import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const uiRequire = createRequire(new URL('../../packages/ui/package.json', import.meta.url));
const { JSDOM } = uiRequire('jsdom');
const dom = new JSDOM();
function compiledModule(url, resolve = require) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(code, {
    exports: module.exports,
    module,
    require: resolve,
    Blob,
    Uint8Array,
    Date,
    URL,
    Map,
    Set,
    Error,
    crypto: webcrypto,
    DOMParser: dom.window.DOMParser,
  });
  return module.exports;
}
const studioModules = new Map();
function resolveStudioModule(id) {
  const name =
    /(?:^|\/)(studio-model|studio-cell-style|studio-sheet-(?:model|structure|rules|fill|hyperlinks|editing))$/.exec(
      id
    )?.[1];
  if (!name) return require(id);
  if (!studioModules.has(name))
    studioModules.set(
      name,
      compiledModule(
        new URL(`../../packages/ui/src/components/OfficeStudio/${name}.ts`, import.meta.url),
        resolveStudioModule
      )
    );
  return studioModules.get(name);
}
const model = resolveStudioModule('studio-sheet-model');
const studioModel = resolveStudioModule('studio-model');
const structure = resolveStudioModule('studio-sheet-structure');
const hyperlinks = resolveStudioModule('studio-sheet-hyperlinks');
const fill = resolveStudioModule('studio-sheet-fill');
const editing = resolveStudioModule('studio-sheet-editing');
const codec = compiledModule(
  new URL('../src/pages/collaboration/office-studio/studio-excel-codec.ts', import.meta.url),
  resolveStudioModule
);

async function asBlob(workbook) {
  return new Blob([await workbook.xlsx.writeBuffer()]);
}
async function readWorkbook(blob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

test('Office cell formatting and explicit default widths survive repeated native XLSX saves', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('编辑细节');
  sheet.getCell('A1').value = 123;
  sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFF0000' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
  sheet.getCell('A1').numFmt = '#,##0.00';
  sheet.getCell('A1').border = { bottom: { style: 'double', color: { argb: 'FF123456' } } };
  sheet.getCell('B1').value = { formula: 'A1+1' };
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 30;
  sheet.getCell('C2').value = '合并区域';
  sheet.mergeCells('C2:D3');
  let source = await asBlob(workbook);
  let document = await codec.importStudioExcel(source, '编辑细节.xlsx');
  assert.equal(document.sheets[0].cells.A1.verticalAlign, 'top');
  assert.equal(document.sheets[0].cells.A1.borders.bottom.style, 'double');
  assert.equal(document.sheets[0].cells.A1.borders.bottom.color.toLowerCase(), '#123456');
  const sheetId = document.sheets[0].id;
  document = model.studioPatchCells(document, sheetId, {
    A1: editing.studioDefaultCellFormat(),
    B1: { verticalAlign: 'middle', borders: { top: { style: 'dashed', color: '#00aa88' } } },
  });
  document = editing.studioSetColumnWidths(document, sheetId, { A: 112, B: 148.5 });
  document = editing.studioApplyBorders(
    document,
    sheetId,
    { anchor: { row: 2, col: 3 }, focus: { row: 2, col: 3 } },
    'outer',
    { style: 'thick', color: '#cc3300' }
  );
  for (let pass = 0; pass < 2; pass++) {
    source = await codec.exportStudioExcel(document, source);
    const opened = await readWorkbook(source);
    const target = opened.getWorksheet('编辑细节');
    assert.equal(target.getCell('A1').value, 123);
    assert.equal(!!target.getCell('A1').font.bold, false);
    assert.equal(target.getCell('A1').font.name, 'Calibri');
    assert.equal(target.getCell('A1').alignment.horizontal, undefined);
    assert.equal(target.getCell('A1').alignment.vertical, 'bottom');
    assert.equal(target.getCell('A1').fill.pattern, 'none');
    assert.equal(target.getCell('A1').numFmt ?? 'General', 'General');
    assert.equal(Object.keys(target.getCell('A1').border ?? {}).length, 0);
    assert.equal(target.getCell('B1').formula, 'A1+1');
    assert.equal(target.getCell('B1').alignment.vertical, 'middle');
    assert.equal(target.getCell('B1').border.top.style, 'dashed');
    assert.ok(Math.abs(target.getColumn(1).width * 7 + 5 - 112) < 0.01);
    assert.ok(Math.abs(target.getColumn(2).width * 7 + 5 - 148.5) < 0.01);
    // Inspect native XML because ExcelJS aliases all merged cells to the master style on load.
    const zip = await JSZip.loadAsync(await source.arrayBuffer());
    const xml = new dom.window.DOMParser().parseFromString(
      await zip.file('xl/worksheets/sheet1.xml').async('string'),
      'application/xml'
    );
    const styles = new dom.window.DOMParser().parseFromString(
      await zip.file('xl/styles.xml').async('string'),
      'application/xml'
    );
    for (const [address, sides] of [
      ['C2', ['top', 'left']],
      ['D3', ['bottom', 'right']],
    ]) {
      const cell = Array.from(xml.getElementsByTagName('c')).find(
        (cell) => cell.getAttribute('r') === address
      );
      const xf = styles.getElementsByTagName('cellXfs')[0].children[Number(cell.getAttribute('s'))];
      const border =
        styles.getElementsByTagName('borders')[0].children[Number(xf.getAttribute('borderId'))];
      for (const side of sides)
        assert.equal(border.getElementsByTagName(side)[0]?.getAttribute('style'), 'thick');
    }
    document = await codec.importStudioExcel(source, '重开.xlsx');
  }
});

test('XLSX replacement retains formulas, selected scope, original workbook and native hyperlink formatting', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('替换');
  sheet.getCell('A1').value = 'alpha alpha';
  sheet.getCell('A1').border = { right: { style: 'thin', color: { theme: 4 } } };
  sheet.getCell('A2').value = 'alpha';
  sheet.getCell('B1').value = { formula: '1+2' };
  const source = await asBlob(workbook);
  const imported = await codec.importStudioExcel(source, '替换.xlsx');
  const result = editing.studioReplaceSheetCells(
    imported,
    {
      query: 'alpha',
      lookIn: 'formulas',
      scope: 'selection',
      sheetId: imported.activeSheetId,
      selection: { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } },
    },
    'beta'
  );
  const opened = await readWorkbook(await codec.exportStudioExcel(result.document, source));
  assert.equal(opened.getWorksheet('替换').getCell('A1').value, 'beta beta');
  assert.equal(opened.getWorksheet('替换').getCell('A2').value, 'alpha');
  assert.equal(opened.getWorksheet('替换').getCell('B1').formula, '1+2');
  assert.equal(opened.getWorksheet('替换').getCell('A1').border.right.color.theme, 4);
  assert.equal(imported.sheets[0].cells.A1.input, 'alpha alpha');
});
async function fixture() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '原作者';
  workbook.views = [
    { x: 0, y: 0, width: 1200, height: 800, firstSheet: 0, activeTab: 1, visibility: 'visible' },
  ];
  const main = workbook.addWorksheet('销售');
  main.getCell('A1').value = '数量';
  main.getCell('A2').value = 3;
  main.getCell('B2').value = 12.5;
  main.getCell('C2').value = { formula: 'A2*B2', result: 999 };
  main.getCell('B2').font = { bold: true, italic: true, color: { argb: 'FF0F766E' } };
  main.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  main.getCell('B2').numFmt = '¥#,##0.00';
  main.getCell('B2').alignment = { horizontal: 'right' };
  main.getCell('B2').border = { bottom: { style: 'thin' } };
  main.getCell('A5').value = '00123';
  main.getCell('A6').value = '123';
  main.getCell('A7').value = '=SUM(A2)';
  main.getCell('A8').value = { error: '#REF!' };
  main.getCell('A9').value = new Date('2026-11-12T00:00:00Z');
  main.getCell('A9').numFmt = 'yyyy-mm-dd';
  main.getCell('A11').value = { text: '说明', hyperlink: 'https://example.com/docs' };
  main.getColumn(2).width = 18;
  main.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  main.pageSetup = { orientation: 'landscape', paperSize: 9 };
  main.headerFooter.oddHeader = '销售报表';
  workbook.addWorksheet('汇总').getCell('A1').value = { formula: "'销售'!C2+1", result: 999 };
  return { source: await asBlob(workbook), workbook };
}

function xmlLiteral(value) {
  return String(value).replace(
    /[<>&"'\n\r\t]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
        '\n': '&#10;',
        '\r': '&#13;',
        '\t': '&#9;',
      })[character]
  );
}

async function readNativeFonts(blob) {
  const { worksheet, styles } = await readRuleXml(blob);
  for (const xml of [worksheet, styles])
    assert.equal(xml.getElementsByTagName('parsererror').length, 0);
  const children = (parent, name) =>
    Array.from(parent?.children ?? []).filter(
      (node) => node.namespaceURI === sheetNamespace && node.localName === name
    );
  const fonts = children(styles.getElementsByTagNameNS(sheetNamespace, 'fonts')[0], 'font');
  const cellXfs = children(styles.getElementsByTagNameNS(sheetNamespace, 'cellXfs')[0], 'xf');
  const cells = new Map(
    Array.from(worksheet.getElementsByTagNameNS(sheetNamespace, 'c')).map((node) => [
      node.getAttribute('r'),
      node,
    ])
  );
  const columns = Array.from(worksheet.getElementsByTagNameNS(sheetNamespace, 'col'));
  const fontAt = (styleId) => {
    assert.ok(Number.isInteger(styleId) && styleId >= 0, `invalid native style ${styleId}`);
    const xf = cellXfs[styleId];
    assert.ok(xf, `missing native cellXf ${styleId}`);
    const fontId = Number(xf.getAttribute('fontId') ?? 0);
    const node = fonts[fontId];
    assert.ok(node, `missing native font ${fontId}`);
    const attribute = (name) => children(node, name)[0]?.getAttribute('val') ?? undefined;
    const size = attribute('sz');
    const bold = children(node, 'b')[0];
    return {
      node,
      fontId,
      name: attribute('name'),
      size: size === undefined ? undefined : Number(size),
      bold: !!bold && !['0', 'false'].includes(bold.getAttribute('val')),
      scheme: attribute('scheme'),
    };
  };
  const columnStyle = (col) => {
    const node = [...columns]
      .reverse()
      .find(
        (entry) =>
          Number(entry.getAttribute('min')) <= col &&
          col <= Number(entry.getAttribute('max')) &&
          entry.hasAttribute('style')
      );
    return node?.getAttribute('style');
  };
  return {
    worksheet,
    styles,
    cells,
    fonts,
    cellXfs,
    fontAt,
    cellFont(address) {
      const cell = cells.get(address);
      assert.ok(cell, `missing native cell ${address}`);
      const style =
        cell.getAttribute('s') ??
        cell.parentElement.getAttribute('s') ??
        columnStyle(model.studioParseAddress(address).col) ??
        0;
      return fontAt(Number(style));
    },
    rowFont(row) {
      const node = Array.from(worksheet.getElementsByTagNameNS(sheetNamespace, 'row')).find(
        (entry) => Number(entry.getAttribute('r')) === row
      );
      assert.ok(node?.hasAttribute('s'), `missing native row style ${row}`);
      return fontAt(Number(node.getAttribute('s')));
    },
    columnFont(col) {
      const style = columnStyle(col);
      assert.notEqual(style, undefined, `missing native column style ${col}`);
      return fontAt(Number(style));
    },
  };
}

test('font names and point sizes survive editing and repeated source-based or standalone XLSX saves', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '字体原作者';
  const sheet = workbook.addWorksheet('字体');
  sheet.getCell('A1').value = { text: '查看字体', hyperlink: 'https://example.com/fonts' };
  sheet.getCell('A1').font = {
    name: 'Calibri',
    size: 12.5,
    scheme: 'minor',
    family: 2,
    charset: 134,
    bold: true,
    italic: true,
    underline: true,
    color: { argb: 'FF113355' },
  };
  sheet.getCell('A1').border = { bottom: { style: 'thin' } };
  sheet.getCell('A2').value = '保留原字体';
  sheet.getCell('A2').font = { name: 'Times New Roman', size: 14, scheme: 'major' };
  sheet.getCell('B1').value = 12.5;
  sheet.getCell('B1').numFmt = '0.00';
  const source = await asBlob(workbook);
  const imported = await codec.importStudioExcel(source, '字体.xlsx');
  assert.equal(imported.sheets[0].cells.A1.fontFamily, 'Calibri');
  assert.equal(imported.sheets[0].cells.A1.fontSize, 12.5);
  const unknownFont = 'Imported "Serif"; \\Mono & <tag>';
  for (const mode of ['source', 'standalone']) {
    let document = model.studioPatchCells(imported, imported.sheets[0].id, {
      A1: { fontFamily: 'Arial', fontSize: 16.5 },
      B1: { fontSize: 409 },
      D1: { fontFamily: unknownFont, fontSize: 1 },
    });
    let currentSource = source;
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        mode === 'source' ? currentSource : undefined
      );
      const reopened = await readWorkbook(output);
      const native = await readNativeFonts(output);
      const actual = reopened.getWorksheet('字体');
      const font = actual.getCell('A1').font;
      assert.equal(font.name, 'Arial');
      assert.equal(native.cellFont('A1').size, 16.5);
      assert.equal(font.scheme, undefined);
      assert.equal(font.bold, true);
      assert.equal(font.italic, true);
      assert.ok(font.underline);
      assert.equal(font.color.argb, 'FF113355');
      assert.equal(actual.getCell('A1').value.text, '查看字体');
      assert.equal(actual.getCell('A1').value.hyperlink, 'https://example.com/fonts');
      assert.equal(actual.getCell('B1').value, 12.5);
      assert.equal(actual.getCell('B1').numFmt, '0.00');
      assert.equal(native.cellFont('B1').size, 409);
      assert.equal(actual.getCell('D1').font.name, unknownFont);
      assert.equal(native.cellFont('D1').size, 1);
      assert.equal(actual.getCell('A2').font.name, 'Times New Roman');
      assert.equal(native.cellFont('A2').size, 14);
      if (mode === 'source') {
        assert.equal(font.family, 2);
        assert.equal(font.charset, 134);
        assert.equal(actual.getCell('A1').border.bottom.style, 'thin');
        assert.equal(actual.getCell('A2').font.scheme, 'major');
        assert.equal(reopened.creator, '字体原作者');
      }
      document = await codec.importStudioExcel(output, document.name);
      assert.equal(document.sheets[0].cells.A1.fontFamily, 'Arial');
      assert.equal(document.sheets[0].cells.A1.fontSize, 16.5);
      assert.equal(document.sheets[0].cells.A1.bold, true);
      assert.equal(document.sheets[0].cells.A1.italic, true);
      assert.equal(document.sheets[0].cells.A1.underline, true);
      assert.equal(document.sheets[0].cells.A1.color, '#113355');
      assert.equal(document.sheets[0].cells.B1.input, '12.5');
      assert.equal(document.sheets[0].cells.B1.fontSize, 409);
      assert.equal(document.sheets[0].cells.A2.fontFamily, 'Times New Roman');
      assert.equal(document.sheets[0].cells.A2.fontSize, 14);
      assert.equal(document.sheets[0].cells.D1.fontFamily, unknownFont);
      assert.equal(document.sheets[0].cells.D1.fontSize, 1);
      assert.equal(studioModel.isOfficeStudioDocument(document), true);
      currentSource = output;
    }
  }
});

async function nativeFontInheritanceFixture() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '原生字体继承作者';
  workbook.addWorksheet('原生字体继承').getCell('A1').value = 1;
  const zip = await JSZip.loadAsync(await (await asBlob(workbook)).arrayBuffer());
  const styles = await zip.file('xl/styles.xml').async('string');
  const fonts =
    '<fonts count="5">' +
    '<font><b/><sz val="9.5"/><name val="Tahoma"/><color rgb="FF224466"/><family val="2"/></font>' +
    '<font><name val="No Size Font"/></font>' +
    '<font><b/><sz val="14.5"/><name val="Arial"/><scheme val="major"/><family val="2"/></font>' +
    '<font><b val="0"/><i/><sz val="10.5"/><name val="Courier New"/><scheme val="minor"/></font>' +
    '<font><b val="0"/><i/><u/><sz val="12.5"/><name val="Georgia"/><color rgb="FF335577"/></font>' +
    '</fonts>';
  const xfs =
    '<cellXfs count="4">' +
    [0, 2, 3, 4]
      .map(
        (fontId) =>
          `<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
      )
      .join('') +
    '</cellXfs>';
  zip.file(
    'xl/styles.xml',
    styles
      .replace(/<fonts\b[^>]*(?:\/>|>[\s\S]*?<\/fonts>)/, fonts)
      .replace(/<cellXfs\b[^>]*(?:\/>|>[\s\S]*?<\/cellXfs>)/, xfs)
  );
  const sheetData =
    '<sheetData>' +
    '<row r="1" s="1" customFormat="1">' +
    '<c r="A1"><v>101</v></c><c r="B1"><v>202</v></c>' +
    '<c r="C1" s="3"><v>303</v></c><c r="D1" s="0"><v>404</v></c>' +
    '<c r="E1"><f>SUM(A1:D1)</f><v>1010</v></c><c r="F1" s="3"/>' +
    '</row>' +
    '<row r="2">' +
    '<c r="A2" t="inlineStr"><is><t>默认字体</t></is></c><c r="B2"><v>505</v></c>' +
    '<c r="C2" s="0"><v>606</v></c><c r="D2" s="3"/>' +
    '<c r="E2" t="inlineStr"><is><t>默认链接</t></is></c>' +
    '</row>' +
    '<row r="3"><c r="A3"><f>IF(TRUE,A1,0)</f><v>101</v></c></row>' +
    '<row r="4" s="1" customFormat="1"><c r="A4"/></row>' +
    '<row r="5"><c r="B5"/></row><row r="6"><c r="A6"/></row>' +
    '</sheetData>';
  const worksheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  zip.file(
    'xl/worksheets/sheet1.xml',
    worksheet
      .replace(/<dimension\b[^>]*\/>/, '<dimension ref="A1:F6"/>')
      .replace(
        /<sheetData\b[^>]*>[\s\S]*?<\/sheetData>/,
        '<cols><col min="2" max="3" width="14" customWidth="1" style="2"/></cols>' + sheetData
      )
  );
  const source = await withNativeHyperlinks(
    new Blob([await zip.generateAsync({ type: 'uint8array' })]),
    [{ ref: 'E2', target: 'https://example.com/native-fonts', tooltip: '保留字体链接' }]
  );
  const defaultFont = { fontFamily: 'Tahoma', fontSize: 9.5, bold: true };
  const rowFont = { fontFamily: 'Arial', fontSize: 14.5, bold: true };
  const columnFont = { fontFamily: 'Courier New', fontSize: 10.5, bold: false };
  const explicitFont = { fontFamily: 'Georgia', fontSize: 12.5, bold: false };
  return {
    source,
    expected: {
      A1: { ...rowFont, input: '101' },
      B1: { ...rowFont, input: '202' },
      C1: { ...explicitFont, input: '303' },
      D1: { ...defaultFont, input: '404' },
      E1: { ...rowFont, input: '=SUM(A1:D1)' },
      F1: { ...explicitFont, input: '' },
      A2: { ...defaultFont, input: '默认字体' },
      B2: { ...columnFont, input: '505' },
      C2: { ...defaultFont, input: '606' },
      D2: { ...explicitFont, input: '' },
      E2: { ...defaultFont, input: '默认链接' },
      A3: { ...defaultFont, input: '=IF(TRUE,A1,0)' },
      A4: { ...rowFont, input: '' },
      B5: { ...columnFont, input: '' },
      A6: { ...defaultFont, input: '' },
    },
  };
}

function assertFontSamples(document, expected, { exactKeys = true } = {}) {
  const cells = document.sheets[0].cells;
  if (exactKeys) assert.deepEqual(Object.keys(cells).sort(), Object.keys(expected).sort());
  assert.ok(Object.keys(cells).length < 50, 'font inheritance must not expand the blank grid');
  for (const [address, font] of Object.entries(expected)) {
    assert.equal(cells[address]?.fontFamily, font.fontFamily, `${address} font family`);
    assert.equal(cells[address]?.fontSize, font.fontSize, `${address} point size`);
    assert.equal(!!cells[address]?.bold, font.bold, `${address} bold`);
    assert.equal(cells[address]?.input, font.input, `${address} input`);
  }
  assert.equal(studioModel.isOfficeStudioDocument(document), true);
}

function assertNativeFontSamples(native, expected) {
  assert.ok(native.cells.size < 50, 'native font export must not expand the blank grid');
  for (const [address, font] of Object.entries(expected)) {
    const actual = native.cellFont(address);
    assert.equal(actual.name, font.fontFamily, `${address} native font name`);
    assert.equal(actual.size, font.fontSize, `${address} native point size`);
    assert.equal(actual.bold, font.bold, `${address} native bold`);
  }
}

test('native cell, row and column font inheritance preserves fractional sizes and explicit style zero across repeated XLSX saves', async () => {
  const { source, expected } = await nativeFontInheritanceFixture();
  const original = await readNativeFonts(source);
  for (const address of ['A1', 'B1', 'B2', 'E1', 'A2', 'A3', 'A4', 'B5', 'A6'])
    assert.equal(original.cells.get(address).hasAttribute('s'), false, `${address} truly inherits`);
  assert.equal(original.cells.get('D1').getAttribute('s'), '0');
  assert.equal(original.cells.get('C2').getAttribute('s'), '0');
  assert.equal(original.fontAt(0).fontId, 0);
  assert.equal(original.fontAt(0).name, 'Tahoma');
  assert.equal(original.fontAt(0).size, 9.5);
  assert.equal(original.fonts.length, 5);
  assert.equal(original.fontAt(3).fontId, 4, 'fonts without sz must not shift fontId indices');
  assertNativeFontSamples(original, expected);
  for (const mode of ['source', 'standalone']) {
    let currentSource = source;
    let document = await codec.importStudioExcel(source, '原生字体继承.xlsx');
    assertFontSamples(document, expected);
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        mode === 'source' ? currentSource : undefined
      );
      const native = await readNativeFonts(output);
      assertNativeFontSamples(native, expected);
      if (mode === 'source') {
        assert.equal(native.rowFont(1).size, 14.5);
        assert.equal(native.rowFont(4).size, 14.5);
        assert.equal(native.columnFont(2).size, 10.5);
        assert.equal(native.columnFont(3).size, 10.5);
      }
      const actual = (await readWorkbook(output)).getWorksheet('原生字体继承');
      assert.equal(actual.getCell('E1').formula, 'SUM(A1:D1)');
      assert.equal(actual.getCell('E1').result, 1010);
      assert.equal(actual.getCell('A3').formula, 'IF(TRUE,A1,0)');
      assert.equal(actual.getCell('A3').result, 101);
      assert.equal(actual.getCell('E2').value.text, '默认链接');
      assert.equal(actual.getCell('E2').value.hyperlink, 'https://example.com/native-fonts');
      document = await codec.importStudioExcel(output, document.name);
      assertFontSamples(document, expected);
      assert.equal(document.sheets[0].cells.C1.italic, true);
      assert.equal(document.sheets[0].cells.C1.underline, true);
      assert.equal(document.sheets[0].cells.C1.color, '#335577');
      assert.equal(document.sheets[0].cells.B2.italic, true);
      currentSource = output;
    }
  }
});

test('changing only a fractional point size preserves the source font name, scheme, bold and links', async () => {
  const { source } = await nativeFontInheritanceFixture();
  let document = await codec.importStudioExcel(source, '只改字号.xlsx');
  document = model.studioPatchCells(document, document.sheets[0].id, { A1: { fontSize: 18.5 } });
  let currentSource = source;
  for (let round = 0; round < 3; round++) {
    const output = await codec.exportStudioExcel(document, currentSource);
    const native = await readNativeFonts(output);
    assert.equal(native.cellFont('A1').name, 'Arial');
    assert.equal(native.cellFont('A1').size, 18.5);
    assert.equal(native.cellFont('A1').scheme, 'major');
    assert.equal(native.cellFont('A1').bold, true);
    const actual = (await readWorkbook(output)).getWorksheet('原生字体继承');
    assert.equal(actual.getCell('A1').value, 101);
    assert.equal(actual.getCell('A1').font.name, 'Arial');
    assert.equal(actual.getCell('A1').font.bold, true);
    assert.equal(actual.getCell('A1').font.scheme, 'major');
    assert.equal(actual.getCell('E2').value.hyperlink, 'https://example.com/native-fonts');
    document = await codec.importStudioExcel(output, document.name);
    assert.equal(document.sheets[0].cells.A1.fontSize, 18.5);
    assert.equal(document.sheets[0].cells.A1.fontFamily, 'Arial');
    assert.equal(document.sheets[0].cells.A1.bold, true);
    currentSource = output;
  }
});

test('source row and column edits retain fractional font overrides, inherited fonts and formula caches', async () => {
  const { source, expected } = await nativeFontInheritanceFixture();
  let initial = await codec.importStudioExcel(source, '字体结构编辑.xlsx');
  const id = initial.sheets[0].id;
  initial = structure.studioChangeSheetStructure(initial, id, {
    axis: 'row',
    type: 'insert',
    index: 1,
    count: 1,
  });
  initial = structure.studioChangeSheetStructure(initial, id, {
    axis: 'column',
    type: 'insert',
    index: 1,
    count: 1,
  });
  const shifted = Object.fromEntries(
    Object.entries(expected).map(([address, font]) => {
      const position = model.studioParseAddress(address);
      return [`${model.studioColumnLabel(position.col + 1)}${position.row + 1}`, { ...font }];
    })
  );
  shifted.F2.input = '=SUM(B2:E2)';
  shifted.B4.input = '=IF(TRUE,B2,0)';
  assertFontSamples(initial, shifted);
  for (const mode of ['source', 'standalone']) {
    let document = initial;
    let currentSource = source;
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        mode === 'source' ? currentSource : undefined
      );
      const native = await readNativeFonts(output);
      assertNativeFontSamples(native, shifted);
      if (mode === 'source') {
        assert.equal(native.rowFont(2).size, 14.5);
        assert.equal(native.columnFont(3).size, 10.5);
      }
      const actual = (await readWorkbook(output)).getWorksheet('原生字体继承');
      assert.equal(actual.getCell('F2').formula, 'SUM(B2:E2)');
      assert.equal(actual.getCell('F2').result, 1010);
      assert.equal(actual.getCell('B4').formula, 'IF(TRUE,B2,0)');
      assert.equal(actual.getCell('B4').result, 101);
      assert.equal(actual.getCell('F3').value.hyperlink, 'https://example.com/native-fonts');
      document = await codec.importStudioExcel(output, document.name);
      assertFontSamples(document, shifted, { exactKeys: false });
      assert.equal(document.sheets[0].structureEdits, undefined);
      currentSource = output;
    }
  }
});

test('older drafts without font fields preserve source fonts until explicitly edited', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('旧草稿');
  sheet.getCell('A1').value = 5;
  sheet.getCell('A1').font = { name: 'Times New Roman', size: 24.5, scheme: 'major', bold: true };
  const source = await asBlob(workbook);
  let document = await codec.importStudioExcel(source, '旧草稿.xlsx');
  let currentSource = source;
  for (let round = 0; round < 3; round++) {
    delete document.sheets[0].cells.A1.fontFamily;
    delete document.sheets[0].cells.A1.fontSize;
    const edited = model.studioPatchCells(document, document.sheets[0].id, { A1: { input: '9' } });
    const output = await codec.exportStudioExcel(edited, currentSource);
    const native = await readNativeFonts(output);
    const actual = (await readWorkbook(output)).getWorksheet('旧草稿').getCell('A1');
    assert.equal(actual.value, 9);
    assert.equal(actual.font.name, 'Times New Roman');
    assert.equal(native.cellFont('A1').size, 24.5);
    assert.equal(actual.font.scheme, 'major');
    assert.equal(actual.font.bold, true);
    document = await codec.importStudioExcel(output, document.name);
    assert.equal(document.sheets[0].cells.A1.fontFamily, 'Times New Roman');
    assert.equal(document.sheets[0].cells.A1.fontSize, 24.5);
    assert.equal(document.sheets[0].cells.A1.bold, true);
    assert.equal(document.sheets[0].cells.A1.input, '9');
    currentSource = output;
  }
});

test('invalid font names and point sizes are rejected before XLSX export', async () => {
  const { source } = await fixture();
  const document = await codec.importStudioExcel(source, '无效字体.xlsx');
  for (const invalid of [
    { fontFamily: '' },
    { fontFamily: 'x'.repeat(256) },
    { fontFamily: 'Bad\u0001Font' },
    { fontSize: 0 },
    { fontSize: 410 },
    { fontSize: NaN },
    { fontSize: Infinity },
  ]) {
    const changed = {
      ...document,
      sheets: document.sheets.map((sheet, index) =>
        index
          ? sheet
          : {
              ...sheet,
              cells: { ...sheet.cells, A1: { ...sheet.cells.A1, ...invalid } },
            }
      ),
    };
    await assert.rejects(codec.exportStudioExcel(changed, source), /无效/);
  }
});

const sheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRelationshipNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';

function plainHyperlinks(sheet) {
  return JSON.parse(JSON.stringify((sheet.hyperlinks ?? []).map(({ id: _id, ...link }) => link)));
}

async function withNativeHyperlinks(source, links) {
  const zip = await JSZip.loadAsync(await source.arrayBuffer());
  const relPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  let relations = zip.file(relPath)
    ? await zip.file(relPath).async('string')
    : `<Relationships xmlns="${packageRelationshipNamespace}"></Relationships>`;
  const additions = [];
  const nodes = links.map((link, index) => {
    let attributes = ` ref="${xmlLiteral(link.ref)}"`;
    if (link.target !== undefined) {
      const id = `rIdNativeLink${index + 1}`;
      attributes += ` r:id="${id}"`;
      additions.push(
        `<Relationship Id="${id}" Type="${relationshipNamespace}/hyperlink" Target="${xmlLiteral(link.target)}"${link.ref === 'A5' ? '' : ' TargetMode="External"'}/>`
      );
    }
    for (const name of ['location', 'tooltip', 'display'])
      if (link[name] !== undefined) attributes += ` ${name}="${xmlLiteral(link[name])}"`;
    return `<hyperlink${attributes}/>`;
  });
  relations = relations.replace('</Relationships>', `${additions.join('')}</Relationships>`);
  const worksheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  zip.file(
    'xl/worksheets/sheet1.xml',
    worksheet.replace(
      /(?=<(?:printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|drawing|legacyDrawing|extLst)\b|<\/worksheet>)/,
      `<hyperlinks>${nodes.join('')}</hyperlinks>`
    )
  );
  zip.file(relPath, relations);
  return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
}

async function readNativeHyperlinks(blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const worksheetText = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const relPart = zip.file('xl/worksheets/_rels/sheet1.xml.rels');
  const relText = relPart
    ? await relPart.async('string')
    : `<Relationships xmlns="${packageRelationshipNamespace}"/>`;
  const parser = new dom.window.DOMParser();
  const worksheet = parser.parseFromString(worksheetText, 'application/xml');
  const relationshipXml = parser.parseFromString(relText, 'application/xml');
  assert.equal(worksheet.getElementsByTagName('parsererror').length, 0);
  assert.equal(relationshipXml.getElementsByTagName('parsererror').length, 0);
  const relations = Array.from(relationshipXml.documentElement.children).map((node) => ({
    id: node.getAttribute('Id'),
    type: node.getAttribute('Type'),
    target: node.getAttribute('Target'),
    mode: node.getAttribute('TargetMode'),
  }));
  const targets = new Map(relations.map((relation) => [relation.id, relation.target]));
  const nodes = Array.from(worksheet.getElementsByTagNameNS(sheetNamespace, 'hyperlink'));
  const links = nodes.map((node) => {
    const target = targets.get(node.getAttributeNS(relationshipNamespace, 'id'));
    const link = { ref: node.getAttribute('ref') };
    if (target !== undefined) link.target = target;
    for (const name of ['location', 'tooltip', 'display'])
      if (node.hasAttribute(name)) link[name] = node.getAttribute(name);
    return link;
  });
  return { worksheet, worksheetText, relations, links };
}

async function nativeHyperlinkFixture({ fullRange = true } = {}) {
  const workbook = new ExcelJS.Workbook();
  const main = workbook.addWorksheet("链接 O'Brien");
  const cells = {
    A1: 42,
    A2: { formula: 'A1+1', result: 999 },
    A3: true,
    A4: 60.123456789,
    A5: '00123',
    A6: '123',
    A7: '=SUM(A1)',
    A8: 0,
    A9: false,
    A10: { error: '#REF!' },
    B1: { formula: 'IF(A9,1,0)', result: 999 },
    B2: { formula: 'IF(A3,"通过","失败")', result: '旧缓存' },
    B3: { formula: 'A1=42', result: false },
    B4: { formula: 'A1/0', result: { error: '#DIV/0!' } },
    B5: { formula: 'A4+0.25', result: 999 },
    B7: {
      formula: 'HYPERLINK("https://example.com/formula?x=1&y=2","公式标签")',
      result: '旧缓存',
    },
    B8: { formula: 'HYPERLINK("javascript:alert(1)","保留但不打开")', result: '旧缓存' },
    C1: '命名目标',
    C2: '未解析地址',
    C3: '当前表目标',
    C4: 'TRUE',
    C5: 'FALSE',
    C6: '#REF!',
    E1: '原始备注',
  };
  for (const [address, value] of Object.entries(cells)) main.getCell(address).value = value;
  main.getCell('A4').numFmt = 'yyyy-mm-dd hh:mm:ss.000';
  main.getCell('B5').numFmt = 'yyyy-mm-dd hh:mm:ss.000';
  main.getCell('E1').note = '包含超链接的工作表仍应保存这个备注';
  workbook.addWorksheet("目标 O'Brien").getCell('A1').value = 7;
  const links = [
    {
      ref: 'A1',
      target: 'https://example.com/path?q=A&B=中文',
      tooltip: '费用 "收入" & 研发\n下一行\r\t末尾',
      display: '数据说明&"文档"',
    },
    { ref: 'A2', target: 'mailto:finance@example.com?subject=费用&body=a', tooltip: '公式链接' },
    { ref: 'A3', target: 'javascript:window.alert("x")', display: '布尔值' },
    { ref: 'A4', target: 'file:///C:/财务/预算.xlsx', tooltip: '日期原值' },
    { ref: 'A5', target: '..\\原始\\预算.xlsx?raw#Sheet1!A1' },
    { ref: 'A6', location: "'目标 O''Brien'!$B$2:$C$3", display: '内部跳转' },
    { ref: 'A7', target: "#'目标 O''Brien'!$A$1" },
    { ref: 'A8', target: 'https://example.com/zero', tooltip: '' },
    { ref: 'A9', target: 'mailto:false@example.com', display: '' },
    { ref: 'A10', location: "'已删除'!A1" },
    ...['B1', 'B2', 'B3', 'B4', 'B5'].map((ref) => ({
      ref,
      target: `https://example.com/cache/${ref}`,
    })),
    { ref: 'B6', target: 'odd+custom:预算\nnext\r\t&"file"', tooltip: '保留未知协议' },
    { ref: 'B7', target: 'https://example.com/native-over-formula', display: '原生链接与公式同存' },
    { ref: 'C1', location: 'UnresolvedNamedRange', tooltip: '未解析名称仍可保存' },
    { ref: 'C2', location: "'目标 O''Brien'!InvalidAddress", display: '待修复目标' },
    { ref: 'C3', target: "#'链接 O''Brien'!$A$2" },
    ...['C4', 'C5', 'C6'].map((ref) => ({ ref, target: `https://example.com/text/${ref}` })),
    {
      ref: 'D10:F12',
      target: 'https://example.com/range',
      location: "'目标 O''Brien'!A1",
      tooltip: '外部工作簿内位置',
    },
    { ref: 'D11:E13', target: 'mailto:overlap@example.com', tooltip: '重叠范围' },
    ...(fullRange ? [{ ref: 'XFD1048576', target: 'ftp://archive.example.com/book.xlsx' }] : []),
  ];
  return { source: await withNativeHyperlinks(await asBlob(workbook), links), links };
}

async function withNativeRuleParts(source, conditional = '', validation = '', dxfs) {
  const zip = await JSZip.loadAsync(await source.arrayBuffer());
  let worksheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  worksheet = worksheet.replace(
    /<(?:conditionalFormatting|dataValidations)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:conditionalFormatting|dataValidations)>)/g,
    ''
  );
  worksheet = worksheet.replace(
    /(?=<(?:hyperlinks|pageMargins|pageSetup|headerFooter|drawing|legacyDrawing|extLst)\b|<\/worksheet>)/,
    conditional + validation
  );
  zip.file('xl/worksheets/sheet1.xml', worksheet);
  if (dxfs) {
    const styles = await zip.file('xl/styles.xml').async('string');
    zip.file('xl/styles.xml', styles.replace(/<dxfs\b[^>]*(?:\/>|>[\s\S]*?<\/dxfs>)/, dxfs));
  }
  return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
}

function plainRules(sheet) {
  return JSON.parse(
    JSON.stringify({
      conditionalFormats: (sheet.conditionalFormats ?? []).map(({ id: _id, ...rule }) => rule),
      dataValidations: (sheet.dataValidations ?? []).map(({ id: _id, ...rule }) => rule),
    })
  );
}

async function readRuleXml(blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const parse = async (path) =>
    new dom.window.DOMParser().parseFromString(
      await zip.file(path).async('string'),
      'application/xml'
    );
  return {
    worksheet: await parse('xl/worksheets/sheet1.xml'),
    styles: await parse('xl/styles.xml'),
  };
}

async function nativeRuleFixture(configure) {
  const { workbook } = await fixture();
  workbook.addWorksheet("选项 O'Brien").addRows([['研发'], ['测试'], ['费用&收益']]);
  configure?.(workbook);
  const style = {
    bold: false,
    italic: true,
    underline: false,
    color: '#113355',
    background: '#eef4ff',
    numberFormat: '0.00"件&数"',
  };
  const expected = { conditionalFormats: [], dataValidations: [] };
  const conditional = [];
  const addCf = (rule, formula = '') => {
    const priority = conditional.length + 1;
    expected.conditionalFormats.push({ range: 'A2:A5', priority, style, ...rule });
    conditional.push(
      `<conditionalFormatting sqref="${xmlLiteral(rule.range ?? '$A$2:$A$5')}"><cfRule type="${rule.type}" priority="${priority}"${rule.type === 'colorScale' ? '' : ' dxfId="0"'}${formula}</cfRule></conditionalFormatting>`
    );
  };
  for (const operator of [
    'equal',
    'notEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'between',
    'notBetween',
  ]) {
    const between = ['between', 'notBetween'].includes(operator);
    addCf(
      {
        type: 'cellIs',
        operator,
        stopIfTrue: false,
        formulae: between ? ['-1.5', '=$A$2+10'] : ['-1.5'],
      },
      ` operator="${operator}" stopIfTrue="0"><formula>-1.5</formula>${between ? '<formula>$A$2+10</formula>' : ''}`
    );
  }
  addCf(
    {
      type: 'expression',
      range: 'A500:A501',
      stopIfTrue: true,
      formula: '=A500>\n\tAVERAGE($A$2:$A$5)',
    },
    ' stopIfTrue="1"><formula>A500&gt;&#10;&#9;AVERAGE($A$2:$A$5)</formula>'
  );
  const text = '研发 & "成本" ~*?\n新行\r\t尾';
  const searched = text.replace(/~/g, '~~').replace(/[?*]/g, '~$&').replace(/"/g, '""');
  addCf(
    { type: 'containsText', text },
    ` operator="containsText" text="${xmlLiteral(text)}"><formula>${xmlLiteral(`NOT(ISERROR(SEARCH("${searched}",A2)))`)}</formula>`
  );
  addCf({ type: 'duplicateValues' }, '>');
  addCf({ type: 'uniqueValues' }, '>');
  addCf(
    { type: 'top10', rank: 2, bottom: true, percent: false },
    ' rank="2" bottom="1" percent="0">'
  );
  addCf(
    { type: 'top10', rank: 50, bottom: false, percent: true },
    ' rank="50" bottom="0" percent="1">'
  );
  addCf({ type: 'aboveAverage' }, '>');
  addCf({ type: 'aboveAverage', aboveAverage: false }, ' aboveAverage="false">');
  for (const colors of [
    ['#f8696b', '#63be7b'],
    ['#f8696b', '#ffeb84', '#63be7b'],
  ]) {
    addCf(
      { type: 'colorScale', colors, style: undefined },
      `><colorScale><cfvo type="min" val="0"/>${colors.length === 3 ? '<cfvo type="percentile" val="50"/>' : ''}<cfvo type="max" val="0"/>${colors.map((color) => `<color rgb="FF${color.slice(1).toUpperCase()}"/>`).join('')}</colorScale>`
    );
  }
  const validation = [];
  const addDv = (rule, attributes, first, second) => {
    expected.dataValidations.push(rule);
    validation.push(
      `<dataValidation type="${rule.type}" sqref="${rule.range}"${attributes ?? ''}><formula1>${xmlLiteral(first)}</formula1>${second === undefined ? '' : `<formula2>${xmlLiteral(second)}</formula2>`}</dataValidation>`
    );
  };
  addDv(
    {
      type: 'list',
      range: 'B2:B4',
      values: ['研发', '测试', '费用&收益'],
      allowBlank: false,
      showInputMessage: true,
      inputTitle: '选择 &\t类别',
      inputMessage: '第一行\n第二行\r\t & 答案',
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: '类别\r提示',
      errorMessage: '请使用列表中的值。\r\n\t确认 & 重试',
    },
    ' allowBlank="0" showInputMessage="1" promptTitle="选择 &amp;&#9;类别" prompt="第一行&#10;第二行&#13;&#9; &amp; 答案" showErrorMessage="true" errorStyle="warning" errorTitle="类别&#13;提示" error="请使用列表中的值。&#13;&#10;&#9;确认 &amp; 重试"',
    '"研发,测试,费用&收益"'
  );
  addDv(
    { type: 'list', range: 'C2:C4', source: "='选项 O''Brien'!$A$1:$A$3" },
    '',
    "'选项 O''Brien'!$A$1:$A$3"
  );
  addDv(
    { type: 'list', range: 'D2:D4', source: "='选项 O''Brien'!$A$250:$A$260" },
    '',
    "'选项 O''Brien'!$A$250:$A$260"
  );
  addDv({ type: 'list', range: 'E2:E4', source: '=#REF!' }, '', '#REF!');
  addDv(
    {
      type: 'whole',
      range: 'F2:F4',
      operator: 'between',
      formula1: '-2',
      formula2: '10',
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: 'stop',
    },
    ' allowBlank="1" showErrorMessage="1" errorStyle="stop"',
    '-2',
    '10'
  );
  addDv(
    { type: 'decimal', range: 'G2:G4', operator: 'notBetween', formula1: '0.25', formula2: '0.75' },
    ' operator="notBetween"',
    '0.25',
    '0.75'
  );
  addDv(
    { type: 'date', range: 'H2:H4', operator: 'greaterThanOrEqual', formula1: '45000' },
    ' operator="greaterThanOrEqual"',
    '45000'
  );
  addDv(
    {
      type: 'time',
      range: 'I2:I4',
      operator: 'between',
      formula1: '0.25',
      formula2: '0.75',
      showErrorMessage: false,
      errorStyle: 'information',
    },
    ' showErrorMessage="0" errorStyle="information"',
    '0.25',
    '0.75'
  );
  addDv(
    { type: 'textLength', range: 'J2:J4', operator: 'lessThanOrEqual', formula1: '20' },
    ' operator="lessThanOrEqual"',
    '20'
  );
  addDv(
    { type: 'custom', range: 'K2:K4', formula: '=AND(LEN(K2)>0,K2<>A2)' },
    '',
    'AND(LEN(K2)>0,K2<>A2)'
  );
  for (const [column, operator, value] of [
    ['L', 'equal', 'SUM($A$2:$A$3)'],
    ['M', 'notEqual', '0'],
    ['N', 'greaterThan', '0.5'],
    ['O', 'lessThan', '1.5'],
  ]) {
    const type = ['N', 'O'].includes(column) ? 'decimal' : 'whole';
    addDv(
      {
        type,
        range: `${column}2:${column}4`,
        operator,
        formula1: column === 'L' ? `=${value}` : value,
      },
      ` operator="${operator}"`,
      value
    );
  }
  addDv(
    { type: 'whole', range: 'Z900:Z900', operator: 'greaterThan', formula1: '0' },
    ' operator="greaterThan"',
    '0'
  );
  const dxfs =
    '<dxfs count="1"><dxf><font><b val="0"/><i/><u val="none"/><color rgb="FF113355"/></font><numFmt numFmtId="999" formatCode="0.00&quot;件&amp;数&quot;"/><fill><patternFill patternType="solid"><fgColor rgb="FFEEF4FF"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>';
  return {
    source: await withNativeRuleParts(
      await asBlob(workbook),
      conditional.join(''),
      `<dataValidations count="${validation.length}">${validation.join('')}</dataValidations>`,
      dxfs
    ),
    expected: JSON.parse(JSON.stringify(expected)),
  };
}

test('native hyperlink metadata, original value types, formula caches and date precision survive repeated real XLSX saves', async () => {
  const { source, links } = await nativeHyperlinkFixture();
  const initial = await codec.importStudioExcel(source, '原生超链接.xlsx');
  const first = initial.sheets[0];
  assert.deepEqual(plainHyperlinks(first), links);
  assert.equal(new Set(first.hyperlinks.map((link) => link.id)).size, links.length);
  assert.deepEqual(JSON.parse(JSON.stringify(initial.sheets[1].hyperlinks)), []);
  const inputs = {
    A1: '42',
    A2: '=A1+1',
    A3: 'true',
    A4: '60.123456789',
    A5: '00123',
    A6: "'123",
    A7: "'=SUM(A1)",
    A8: '0',
    A9: 'false',
    A10: '#REF!',
    B1: '=IF(A9,1,0)',
    B2: '=IF(A3,"通过","失败")',
    B3: '=A1=42',
    B4: '=A1/0',
    B5: '=A4+0.25',
    B7: '=HYPERLINK("https://example.com/formula?x=1&y=2","公式标签")',
    B8: '=HYPERLINK("javascript:alert(1)","保留但不打开")',
    C4: "'TRUE",
    C5: "'FALSE",
    C6: "'#REF!",
  };
  for (const [address, input] of Object.entries(inputs))
    assert.equal(first.cells[address].input, input, address);
  for (const [ref, kind] of [
    ['A1', 'external'],
    ['A2', 'external'],
    ['A3', 'blocked'],
    ['A4', 'blocked'],
    ['A5', 'blocked'],
    ['A6', 'internal'],
    ['A7', 'internal'],
    ['A10', 'blocked'],
    ['B6', 'blocked'],
    ['C1', 'blocked'],
    ['C2', 'blocked'],
    ['XFD1048576', 'blocked'],
  ]) {
    const link = first.hyperlinks.find((entry) => entry.ref === ref);
    assert.equal(hyperlinks.studioResolveSheetHyperlink(initial, first.id, link).kind, kind, ref);
  }
  const cacheValues = {
    A2: '43',
    B1: '0',
    B2: '通过',
    B3: '1',
    B4: '#DIV/0!',
    B5: '60.373456789',
    B7: '公式标签',
    B8: '保留但不打开',
  };
  for (const preserveSource of [true, false]) {
    let document = initial;
    let currentSource = source;
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        preserveSource ? currentSource : undefined
      );
      const native = await readNativeHyperlinks(output);
      assert.deepEqual(native.links, links);
      const ids = native.relations.map((relation) => relation.id);
      assert.equal(ids.length, new Set(ids).size);
      assert.equal(
        native.relations.filter((relation) => relation.type.endsWith('/hyperlink')).length,
        links.filter((link) => link.target !== undefined).length
      );
      assert.ok(
        native.relations
          .filter((relation) => relation.type.endsWith('/hyperlink'))
          .every((relation) => relation.mode === 'External')
      );
      const children = Array.from(native.worksheet.documentElement.children).map(
        (node) => node.localName
      );
      assert.ok(children.indexOf('hyperlinks') > children.indexOf('sheetData'));
      assert.ok(children.indexOf('hyperlinks') < children.indexOf('pageMargins'));
      const cell = (address) =>
        Array.from(native.worksheet.getElementsByTagNameNS(sheetNamespace, 'c')).find(
          (node) => node.getAttribute('r') === address
        );
      assert.equal(cell('A1').getAttribute('t'), null);
      assert.equal(cell('A3').getAttribute('t'), 'b');
      assert.equal(cell('A9').getAttribute('t'), 'b');
      assert.equal(
        cell('A4').getElementsByTagNameNS(sheetNamespace, 'v')[0].textContent,
        '60.123456789'
      );
      assert.equal(cell('A5').getAttribute('t'), 's');
      assert.equal(cell('A6').getAttribute('t'), 's');
      assert.equal(cell('A7').getAttribute('t'), 's');
      assert.equal(cell('A10').getAttribute('t'), 'e');
      for (const [address, value] of Object.entries(cacheValues)) {
        assert.equal(
          cell(address).getElementsByTagNameNS(sheetNamespace, 'f')[0].textContent,
          inputs[address].slice(1)
        );
        assert.equal(
          cell(address).getElementsByTagNameNS(sheetNamespace, 'v')[0].textContent,
          value,
          address
        );
      }
      assert.equal(cell('B2').getAttribute('t'), 'str');
      assert.equal(cell('B3').getAttribute('t'), 'b');
      assert.equal(cell('B4').getAttribute('t'), 'e');
      assert.equal(cell('B7').getAttribute('t'), 'str');
      assert.equal(cell('B8').getAttribute('t'), 'str');
      for (const address of ['C4', 'C5', 'C6']) assert.equal(cell(address).getAttribute('t'), 's');
      if (preserveSource)
        assert.equal(
          (await readWorkbook(output)).worksheets[0].getCell('E1').note,
          '包含超链接的工作表仍应保存这个备注'
        );
      document = await codec.importStudioExcel(output, '原生超链接.xlsx');
      assert.ok(studioModel.isOfficeStudioDocument(document));
      assert.deepEqual(plainHyperlinks(document.sheets[0]), links);
      for (const [address, input] of Object.entries(inputs))
        assert.equal(document.sheets[0].cells[address].input, input, address);
      currentSource = output;
    }
  }
});

test('native hyperlinks can be added, edited and explicitly removed without dropping source comments or changing linked values', async () => {
  const { source } = await nativeHyperlinkFixture();
  const initial = await codec.importStudioExcel(source, '链接编辑.xlsx');
  const id = initial.sheets[0].id;
  for (const preserveSource of [true, false]) {
    let document = initial;
    const original = document.sheets[0].hyperlinks.find((link) => link.ref === 'A1');
    document = hyperlinks.studioSetSheetHyperlink(document, id, {
      ...original,
      target: 'https://example.com/new?q=中文&cost=2',
      tooltip: '更新\n说明\r\t',
      display: '更新名称',
    });
    document = model.studioPatchCells(document, id, { A1: { input: '84' } });
    document = hyperlinks.studioSetSheetHyperlink(document, id, {
      id: 'new-range-link',
      ref: 'Y30:Z32',
      location: "'目标 O''Brien'!A1",
      tooltip: '空白范围',
    });
    document = hyperlinks.studioRemoveSheetHyperlink(
      document,
      id,
      document.sheets[0].hyperlinks.find((link) => link.ref === 'A2').id
    );
    const expected = plainHyperlinks(document.sheets[0]);
    let currentSource = source;
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        preserveSource ? currentSource : undefined
      );
      assert.deepEqual((await readNativeHyperlinks(output)).links, expected);
      document = await codec.importStudioExcel(output, '链接编辑.xlsx');
      assert.deepEqual(plainHyperlinks(document.sheets[0]), expected);
      assert.equal(document.sheets[0].cells.A1.input, '84');
      assert.equal(document.sheets[0].cells.A2.input, '=A1+1');
      assert.equal(model.studioCalculate(document).values.get(`${document.sheets[0].id}:A2`), 85);
      currentSource = output;
    }
    const cleared = {
      ...document,
      sheets: document.sheets.map((sheet) => ({ ...sheet, hyperlinks: [] })),
    };
    const output = await codec.exportStudioExcel(
      cleared,
      preserveSource ? currentSource : undefined
    );
    const native = await readNativeHyperlinks(output);
    assert.deepEqual(native.links, []);
    assert.equal(native.worksheet.getElementsByTagNameNS(sheetNamespace, 'hyperlinks').length, 0);
    assert.equal(
      native.relations.filter((relation) => relation.type.endsWith('/hyperlink')).length,
      0
    );
    const restored = await codec.importStudioExcel(output, '已删除链接.xlsx');
    assert.deepEqual(plainHyperlinks(restored.sheets[0]), []);
    assert.equal(restored.sheets[0].cells.A2.input, '=A1+1');
    if (preserveSource) {
      assert.ok(native.relations.some((relation) => relation.type.endsWith('/comments')));
      assert.equal(
        (await readWorkbook(output)).worksheets[0].getCell('E1').note,
        '包含超链接的工作表仍应保存这个备注'
      );
    }
  }
});

test('legacy hyperlink hydration follows source identities, structure logs and renames while preserving edited cells and explicit metadata', async () => {
  const { source } = await nativeHyperlinkFixture({ fullRange: false });
  const imported = await codec.importStudioExcel(source, '旧工作区.xlsx');
  const mainId = imported.sheets[0].id;
  const targetId = imported.sheets[1].id;
  let legacy = JSON.parse(JSON.stringify(imported));
  delete legacy.sheets[0].hyperlinks;
  legacy = model.studioPatchCells(legacy, mainId, {
    A1: { input: '99', bold: true, numberFormat: '#,##0.00' },
  });
  legacy = structure.studioChangeSheetStructure(legacy, mainId, {
    axis: 'row',
    type: 'insert',
    index: 2,
    count: 2,
  });
  legacy = structure.studioChangeSheetStructure(legacy, targetId, {
    axis: 'column',
    type: 'insert',
    index: 2,
    count: 1,
  });
  legacy = model.studioRenameSheet(legacy, mainId, '新主表');
  legacy = model.studioRenameSheet(legacy, targetId, '新目标');
  const main = legacy.sheets[0];
  const target = legacy.sheets[1];
  main.conditionalFormats = [
    {
      id: 'preserved-cf',
      range: 'E3:E6',
      priority: 1,
      type: 'expression',
      formula: '=A1>0',
      style: { bold: false, background: '#112233' },
    },
  ];
  main.dataValidations = [
    {
      id: 'preserved-dv',
      range: 'F3:F6',
      type: 'whole',
      operator: 'between',
      formula1: '1',
      formula2: '10',
      allowBlank: true,
    },
  ];
  target.hyperlinks = [
    {
      id: 'already-edited-link',
      ref: 'D2',
      target: 'https://manual.example.com/current',
      tooltip: '保留显式数组',
    },
  ];
  const newSheet = {
    ...target,
    id: 'created-later',
    name: '新增表',
    cells: { A1: { input: '新增内容' } },
  };
  delete newSheet.hyperlinks;
  legacy = { ...legacy, sheets: [target, newSheet, main] };
  const before = JSON.stringify(legacy);
  const hydrated = await codec.hydrateStudioExcelHyperlinks(legacy, source);
  assert.equal(JSON.stringify(legacy), before);
  const restoredMain = hydrated.sheets.find((sheet) => sheet.id === mainId);
  assert.equal(restoredMain.cells, main.cells);
  assert.equal(restoredMain.conditionalFormats, main.conditionalFormats);
  assert.equal(restoredMain.dataValidations, main.dataValidations);
  assert.equal(restoredMain.structureEdits, main.structureEdits);
  assert.equal(hydrated.sheets[0], target);
  assert.equal(hydrated.sheets[0].hyperlinks, target.hyperlinks);
  assert.deepEqual(JSON.parse(JSON.stringify(hydrated.sheets[1].hyperlinks)), []);
  assert.equal(
    restoredMain.hyperlinks.find((link) => link.ref === 'A8').location,
    "'新目标'!$C$2:$D$3"
  );
  assert.equal(restoredMain.hyperlinks.find((link) => link.ref === 'C5').target, "#'新主表'!$A$4");
  assert.equal(
    restoredMain.hyperlinks.find((link) => link.ref === 'D12:F14').location,
    "'目标 O''Brien'!A1"
  );
  assert.equal(
    await codec.hydrateStudioExcelHyperlinks(hydrated, new Blob(['no source read needed'])),
    hydrated
  );
  const output = await codec.exportStudioExcel(legacy, source);
  const restored = await codec.importStudioExcel(output, '旧工作区.xlsx');
  assert.equal(restored.sheets.find((sheet) => sheet.id === restored.activeSheetId).name, '新主表');
  assert.deepEqual(
    plainHyperlinks(restored.sheets.find((sheet) => sheet.name === '新主表')),
    plainHyperlinks(restoredMain)
  );
  assert.deepEqual(
    plainHyperlinks(restored.sheets.find((sheet) => sheet.name === '新目标')),
    plainHyperlinks(target)
  );
  assert.equal(restored.sheets.find((sheet) => sheet.name === '新主表').cells.A1.input, '99');
  const zip = await JSZip.loadAsync(await output.arrayBuffer());
  const mainXml = new dom.window.DOMParser().parseFromString(
    await zip.file('xl/worksheets/sheet1.xml').async('string'),
    'application/xml'
  );
  const children = Array.from(mainXml.documentElement.children).map((node) => node.localName);
  assert.ok(children.indexOf('conditionalFormatting') < children.indexOf('dataValidations'));
  assert.ok(children.indexOf('dataValidations') < children.indexOf('hyperlinks'));
  assert.ok(children.indexOf('hyperlinks') < children.indexOf('pageMargins'));
});

test('legacy hyperlink hydration handles sheet-name swaps, removed destinations and explicitly cleared source metadata', async () => {
  const { source } = await nativeHyperlinkFixture({ fullRange: false });
  const imported = await codec.importStudioExcel(source, '原始链接.xlsx');
  const targetId = imported.sheets[1].id;
  const swapped = JSON.parse(JSON.stringify(imported));
  [swapped.sheets[0].name, swapped.sheets[1].name] = [
    swapped.sheets[1].name,
    swapped.sheets[0].name,
  ];
  delete swapped.sheets[0].hyperlinks;
  delete swapped.sheets[1].hyperlinks;
  const hydratedSwap = await codec.hydrateStudioExcelHyperlinks(swapped, source);
  assert.equal(
    hydratedSwap.sheets[0].hyperlinks.find((link) => link.ref === 'A6').location,
    "'链接 O''Brien'!$B$2:$C$3"
  );
  assert.equal(
    hydratedSwap.sheets[0].hyperlinks.find((link) => link.ref === 'C3').target,
    "#'目标 O''Brien'!$A$2"
  );
  const swapOutput = await codec.exportStudioExcel(swapped, source);
  assert.deepEqual(
    (await readNativeHyperlinks(swapOutput)).links,
    plainHyperlinks(hydratedSwap.sheets[0])
  );
  let removed = JSON.parse(JSON.stringify(imported));
  delete removed.sheets[0].hyperlinks;
  removed = model.studioDeleteSheet(removed, targetId);
  const hydratedRemoval = await codec.hydrateStudioExcelHyperlinks(removed, source);
  assert.equal(
    hydratedRemoval.sheets[0].hyperlinks.find((link) => link.ref === 'A6').location,
    '#REF!'
  );
  assert.equal(
    hydratedRemoval.sheets[0].hyperlinks.find((link) => link.ref === 'A7').target,
    '#REF!'
  );
  assert.equal(
    hydratedRemoval.sheets[0].hyperlinks.find((link) => link.ref === 'D10:F12').location,
    "'目标 O''Brien'!A1"
  );
  const removedOutput = await codec.exportStudioExcel(removed, source);
  assert.deepEqual(
    (await readNativeHyperlinks(removedOutput)).links,
    plainHyperlinks(hydratedRemoval.sheets[0])
  );
  assert.equal(
    (await codec.importStudioExcel(removedOutput, '已删除工作表.xlsx')).sheets.length,
    1
  );
  const cleared = {
    ...removed,
    sheets: removed.sheets.map((sheet) => ({ ...sheet, hyperlinks: [] })),
  };
  assert.equal(await codec.hydrateStudioExcelHyperlinks(cleared, source), cleared);
  assert.deepEqual(
    (await readNativeHyperlinks(await codec.exportStudioExcel(cleared, source))).links,
    []
  );
  const nonexistent = {
    ...removed,
    activeSheetId: 'xlsx-sheet-999',
    sheets: [{ ...removed.sheets[0], id: 'xlsx-sheet-999' }],
  };
  await assert.rejects(codec.hydrateStudioExcelHyperlinks(nonexistent, source), /原工作表不存在/);
  const wrongIdentity = {
    ...removed,
    activeSheetId: 'independent-sheet',
    sheets: [{ ...removed.sheets[0], id: 'independent-sheet' }],
  };
  const independent = await codec.hydrateStudioExcelHyperlinks(wrongIdentity, source);
  assert.deepEqual(JSON.parse(JSON.stringify(independent.sheets[0].hyperlinks)), []);
  assert.equal(independent.sheets[0].cells, wrongIdentity.sheets[0].cells);
  assert.equal(independent.sheets[0].id, 'independent-sheet');
});

test('modern hyperlink metadata migrates once and copied, filled or pasted links survive real XLSX round-trips', async () => {
  const { source } = await nativeHyperlinkFixture({ fullRange: false });
  const initial = await codec.importStudioExcel(source, '结构填充粘贴.xlsx');
  const id = initial.sheets[0].id;
  const targetId = initial.sheets[1].id;
  const removedLinkId = initial.sheets[0].hyperlinks.find((link) => link.ref === 'A2').id;
  for (const preserveSource of [true, false]) {
    let document = initial;
    document = structure.studioChangeSheetStructure(document, id, {
      axis: 'row',
      type: 'insert',
      index: 2,
      count: 2,
    });
    document = structure.studioChangeSheetStructure(document, id, {
      axis: 'column',
      type: 'insert',
      index: 2,
      count: 1,
    });
    document = structure.studioChangeSheetStructure(document, id, {
      axis: 'row',
      type: 'delete',
      index: 4,
      count: 1,
    });
    document = structure.studioChangeSheetStructure(document, targetId, {
      axis: 'row',
      type: 'insert',
      index: 1,
      count: 1,
    });
    document = model.studioRenameSheet(document, id, '工作主表');
    document = model.studioRenameSheet(document, targetId, '工作目标');
    assert.equal(
      document.sheets[0].hyperlinks.some((link) => link.id === removedLinkId),
      false
    );
    assert.equal(
      document.sheets[0].hyperlinks.find((link) => link.ref === 'A7').location,
      "'工作目标'!$B$3:$C$4"
    );
    assert.equal(document.sheets[0].hyperlinks.find((link) => link.ref === 'D4').target, '#REF!');
    assert.equal(
      document.sheets[0].hyperlinks.find((link) => link.ref === 'E11:G13').location,
      "'目标 O''Brien'!A1"
    );
    document = model.studioPatchCells(document, id, {
      H20: { input: '=A1+5' },
      I20: { input: '3' },
    });
    document = hyperlinks.studioSetSheetHyperlink(document, id, {
      id: 'fill-source-external',
      ref: 'H20',
      target: 'https://example.com/fill',
      tooltip: '复制提示',
    });
    document = hyperlinks.studioSetSheetHyperlink(document, id, {
      id: 'fill-source-internal',
      ref: 'I20',
      location: "'工作目标'!A2",
    });
    const selection = { anchor: { row: 20, col: 8 }, focus: { row: 22, col: 9 } };
    document = fill.studioFillCells(document, id, selection, 'down');
    assert.equal(
      hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'H22').target,
      'https://example.com/fill'
    );
    assert.equal(
      hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'I22').location,
      "'工作目标'!A2"
    );
    const text = model.studioCopyTsv(document.sheets[0], selection);
    const payload = model.studioCopySheetClipboard(document, document.sheets[0].id, selection);
    const origin = model.studioClipboardOrigin(payload, text);
    for (const address of ['H20', 'H21', 'H22', 'I20', 'I21', 'I22']) {
      const copied = hyperlinks.studioSheetHyperlinkAt(
        { ...document.sheets[0], hyperlinks: origin.hyperlinks },
        address
      );
      assert.ok(copied, address);
      if (address.startsWith('H')) assert.equal(copied.target, 'https://example.com/fill');
      else assert.equal(copied.location, "'工作目标'!A2");
    }
    document = model.studioPasteCells(document, id, { row: 30, col: 11 }, text, origin).document;
    assert.equal(document.sheets[0].cells.K30.input, '=D11+5');
    assert.equal(
      hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'K30').target,
      'https://example.com/fill'
    );
    assert.equal(
      hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'L30').location,
      "'工作目标'!A2"
    );
    document = model.studioPasteCells(document, id, { row: 31, col: 11 }, 'replacement').document;
    assert.equal(hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'K31'), undefined);
    const overlapSelection = { anchor: { row: 12, col: 5 }, focus: { row: 13, col: 6 } };
    const overlapText = model.studioCopyTsv(document.sheets[0], overlapSelection);
    const overlapOrigin = model.studioClipboardOrigin(
      model.studioCopySheetClipboard(document, document.sheets[0].id, overlapSelection),
      overlapText
    );
    document = model.studioPasteCells(
      document,
      id,
      { row: 40, col: 23 },
      overlapText,
      overlapOrigin
    ).document;
    const overlapping = hyperlinks.studioSheetHyperlinksAt(document.sheets[0], 'W40');
    assert.equal(overlapping.length, 2);
    assert.deepEqual(
      new Set(overlapping.map((link) => link.target)),
      new Set(['https://example.com/range', 'mailto:overlap@example.com'])
    );
    const expected = plainHyperlinks(document.sheets[0]);
    let currentSource = source;
    for (let round = 0; round < 3; round++) {
      const output = await codec.exportStudioExcel(
        document,
        preserveSource ? currentSource : undefined
      );
      assert.deepEqual((await readNativeHyperlinks(output)).links, expected);
      document = await codec.importStudioExcel(output, '结构填充粘贴.xlsx');
      assert.deepEqual(plainHyperlinks(document.sheets[0]), expected);
      assert.equal(document.sheets[0].cells.A5.input, '60.123456789');
      assert.equal(document.sheets[0].cells.K30.input, '=D11+5');
      assert.equal(hyperlinks.studioSheetHyperlinkAt(document.sheets[0], 'K31'), undefined);
      currentSource = output;
    }
  }
});

test('all supported native CF and DV rules, styles, operators and prompts survive source-based and standalone XLSX round-trips', async () => {
  const { source, expected } = await nativeRuleFixture();
  const imported = await codec.importStudioExcel(source, '原生规则.xlsx');
  assert.deepEqual(plainRules(imported.sheets[0]), expected);
  assert.equal(imported.sheets[0].rowCount, 900);
  assert.equal(imported.sheets.find((sheet) => sheet.name === "选项 O'Brien").rowCount, 260);
  assert.equal(studioModel.isOfficeStudioDocument(imported), true);
  const assertNative = async (output) => {
    const { worksheet, styles } = await readRuleXml(output);
    const rules = Array.from(worksheet.getElementsByTagName('cfRule'));
    assert.equal(rules.length, 18);
    assert.ok(rules.some((rule) => rule.getAttribute('type') === 'duplicateValues'));
    assert.ok(rules.some((rule) => rule.getAttribute('type') === 'uniqueValues'));
    assert.equal(
      rules.find((rule) => rule.getAttribute('type') === 'expression').getAttribute('stopIfTrue'),
      '1'
    );
    assert.equal(styles.getElementsByTagName('dxf').length, 1);
    const validations = Array.from(worksheet.getElementsByTagName('dataValidation'));
    assert.equal(validations.length, 15);
    assert.equal(
      validations
        .find((rule) => rule.getAttribute('type') === 'date')
        .getElementsByTagName('formula1')[0].textContent,
      '45000'
    );
    assert.equal(
      validations
        .find((rule) => rule.getAttribute('type') === 'time')
        .getElementsByTagName('formula1')[0].textContent,
      '0.25'
    );
    const parts = Array.from(worksheet.documentElement.children).map(
      (element) => element.localName
    );
    assert.ok(parts.indexOf('conditionalFormatting') < parts.indexOf('dataValidations'));
    assert.ok(parts.indexOf('dataValidations') < parts.indexOf('hyperlinks'));
    const printing = parts.findIndex((part) =>
      ['pageMargins', 'pageSetup', 'headerFooter'].includes(part)
    );
    assert.ok(printing > parts.indexOf('hyperlinks'), JSON.stringify(parts));
    const numberFormat = styles.getElementsByTagName('dxf')[0].getElementsByTagName('numFmt')[0];
    assert.ok(
      Array.from(styles.getElementsByTagName('numFmts')[0].children).some(
        (element) =>
          element.getAttribute('numFmtId') === numberFormat.getAttribute('numFmtId') &&
          element.getAttribute('formatCode') === '0.00"件&数"'
      )
    );
    assert.deepEqual(
      plainRules((await codec.importStudioExcel(output, imported.name)).sheets[0]),
      expected
    );
  };
  const first = await codec.exportStudioExcel(imported, source);
  await assertNative(first);
  await assertNative(await codec.exportStudioExcel(imported, source));
  const reopened = await codec.importStudioExcel(first, imported.name);
  await assertNative(await codec.exportStudioExcel(reopened, first));
  const standalone = await codec.exportStudioExcel(imported);
  assert.deepEqual(
    plainRules((await codec.importStudioExcel(standalone, imported.name)).sheets[0]),
    expected
  );
  const workbook = await readWorkbook(first);
  assert.equal(workbook.getWorksheet('销售').getCell('I2').dataValidation.type, 'time');
  assert.equal(workbook.getWorksheet('销售').getCell('C2').formula, 'A2*B2');
  assert.equal(workbook.getWorksheet('销售').getCell('B2').border.bottom.style, 'thin');
});

test('native rule coordinates migrate once after row or column edits and removed rules leave no old XLSX objects', async () => {
  const { source } = await nativeRuleFixture();
  let document = await codec.importStudioExcel(source, '规则迁移.xlsx');
  const id = document.sheets[0].id;
  document = structure.studioChangeSheetStructure(document, id, {
    axis: 'row',
    type: 'insert',
    index: 2,
    count: 1,
  });
  document = structure.studioChangeSheetStructure(document, id, {
    axis: 'column',
    type: 'insert',
    index: 2,
    count: 1,
  });
  const options = document.sheets.find((sheet) => sheet.name === "选项 O'Brien");
  document = structure.studioChangeSheetStructure(document, options.id, {
    axis: 'row',
    type: 'insert',
    index: 2,
    count: 1,
  });
  const expected = plainRules(document.sheets[0]);
  assert.equal(expected.conditionalFormats[0].range, 'A3:A6');
  assert.equal(expected.conditionalFormats[6].formulae[1], '=$A$3+10');
  assert.equal(expected.dataValidations[0].range, 'C3:C5');
  assert.equal(expected.dataValidations[1].source, "='选项 O''Brien'!$A$1:$A$4");
  const output = await codec.exportStudioExcel(document, source);
  const reopened = await codec.importStudioExcel(output, document.name);
  assert.deepEqual(plainRules(reopened.sheets[0]), expected);
  assert.equal(reopened.sheets[0].structureEdits, undefined);
  assert.deepEqual(
    plainRules(
      (
        await codec.importStudioExcel(
          await codec.exportStudioExcel(document, source),
          document.name
        )
      ).sheets[0]
    ),
    expected
  );
  assert.deepEqual(
    plainRules(
      (
        await codec.importStudioExcel(
          await codec.exportStudioExcel(reopened, output),
          document.name
        )
      ).sheets[0]
    ),
    expected
  );
  const { worksheet } = await readRuleXml(output);
  assert.match(worksheet.getElementsByTagName('cfRule')[9].textContent, /,A3\)\)\)$/);
  const cleared = {
    ...reopened,
    sheets: reopened.sheets.map((sheet) =>
      sheet.id === id ? { ...sheet, conditionalFormats: [], dataValidations: [] } : sheet
    ),
  };
  const cleanOutput = await codec.exportStudioExcel(cleared, output);
  const clean = await readRuleXml(cleanOutput);
  assert.equal(clean.worksheet.getElementsByTagName('conditionalFormatting').length, 0);
  assert.equal(clean.worksheet.getElementsByTagName('dataValidations').length, 0);
  assert.equal(clean.styles.getElementsByTagName('dxf').length, 0);
  assert.deepEqual(
    plainRules((await codec.importStudioExcel(cleanOutput, document.name)).sheets[0]),
    { conditionalFormats: [], dataValidations: [] }
  );
});

test('rules and formula date/time criteria coexist with native filters, merges, charts, comments and print breaks', async () => {
  const { source } = await nativeRuleFixture((workbook) => {
    const sheet = workbook.getWorksheet('销售');
    sheet.getCell('B1').value = '单价';
    sheet.getCell('A3').value = 4;
    sheet.getCell('B3').value = 10;
    sheet.getCell('A3').note = '规则批注 & 日期';
    sheet.getCell('D8').value = '合并说明';
    sheet.mergeCells('D8:F8');
    sheet.getRow(3).addPageBreak(0, 26);
  });
  let document = await codec.importStudioExcel(source, '组合规则.xlsx');
  const id = document.sheets[0].id;
  document = model.studioSetFilter(document, id, {
    range: 'A1:C4',
    columns: { A: { operator: 'greater', value: '3' } },
  });
  document = model.studioAddChart(document, id, 'A1:B3', 'bar');
  document.sheets[0].dataValidations.push(
    {
      id: 'date-formula',
      type: 'date',
      range: 'P2:P2',
      operator: 'between',
      formula1: '=DATE(2023,3,15)',
      formula2: '=DATE(2026,11,12)',
    },
    {
      id: 'time-formula',
      type: 'time',
      range: 'Q2:Q2',
      operator: 'greaterThanOrEqual',
      formula1: '=TIME(6,0,0)',
    },
    {
      id: 'relative-formula',
      type: 'decimal',
      range: 'R2:R2',
      operator: 'lessThanOrEqual',
      formula1: '=$B$2/2',
    }
  );
  const expected = plainRules(document.sheets[0]);
  const first = await codec.exportStudioExcel(document, source);
  const reopened = await codec.importStudioExcel(first, document.name);
  for (const output of [first, await codec.exportStudioExcel(reopened, first)]) {
    const { worksheet } = await readRuleXml(output);
    const parts = Array.from(worksheet.documentElement.children).map(
      (element) => element.localName
    );
    const positions = [
      'autoFilter',
      'mergeCells',
      'conditionalFormatting',
      'dataValidations',
      'hyperlinks',
      'rowBreaks',
      'drawing',
      'legacyDrawing',
    ].map((part) => parts.indexOf(part));
    assert.ok(
      positions.every((position) => position >= 0),
      JSON.stringify(parts)
    );
    assert.deepEqual(
      positions,
      [...positions].sort((left, right) => left - right)
    );
    const rules = Array.from(worksheet.getElementsByTagName('dataValidation'));
    assert.equal(
      rules.find((rule) => rule.getAttribute('sqref') === 'P2:P2').textContent,
      'DATE(2023,3,15)DATE(2026,11,12)'
    );
    assert.equal(
      rules.find((rule) => rule.getAttribute('sqref') === 'Q2:Q2').textContent,
      'TIME(6,0,0)'
    );
    const workbook = await readWorkbook(output);
    const main = workbook.getWorksheet('销售');
    const note = main.getCell('A3').note;
    assert.equal(
      typeof note === 'string' ? note : note?.texts?.map((part) => part.text).join(''),
      '规则批注 & 日期'
    );
    assert.equal(main.getCell('D8').isMerged, true);
    assert.equal(main.getCell('F8').value, '合并说明');
    assert.equal(main.getRow(2).hidden, true);
    assert.equal(main.views[0].ySplit, 1);
    const imported = await codec.importStudioExcel(output, document.name);
    assert.equal(imported.sheets[0].charts.length, 1);
    assert.deepEqual(plainRules(imported.sheets[0]), expected);
  }
});

test('Office DXF background colours and standard generated contains-text formulas import without flattening their rules', async () => {
  const { source } = await fixture();
  const conditional =
    '<conditionalFormatting sqref="A1"><cfRule type="containsText" operator="containsText" priority="1" dxfId="0"><formula>ISNUMBER(SEARCH("销售",A1))</formula></cfRule></conditionalFormatting>';
  const dxfs =
    '<dxfs count="1"><dxf><font><b/><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>';
  const native = await withNativeRuleParts(source, conditional, '', dxfs);
  const imported = await codec.importStudioExcel(native, 'Office原生高亮.xlsx');
  const rules = plainRules(imported.sheets[0]);
  assert.deepEqual(rules.conditionalFormats[0], {
    range: 'A1:A1',
    priority: 1,
    type: 'containsText',
    text: '销售',
    style: { bold: true, color: '#9c0006', background: '#ffc7ce' },
  });
  assert.equal(imported.sheets[0].cells.A1.background, undefined);
  assert.deepEqual(
    plainRules(
      (
        await codec.importStudioExcel(
          await codec.exportStudioExcel(imported, native),
          imported.name
        )
      ).sheets[0]
    ),
    rules
  );
});

test('unsupported native rules, extensions, differential styles and overlapping validations are explicitly refused', async () => {
  const { source } = await fixture();
  const cases = [
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="iconSet" priority="1"><iconSet/></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="dataBar" priority="1"><dataBar/></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="timePeriod" timePeriod="today" priority="1"/></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2 C1:C2"><cfRule type="expression" priority="1"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="expression" priority="1" dxfId="0"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
      '',
      '<dxfs count="1"><dxf><border><bottom style="thin"/></border></dxf></dxfs>',
    ],
    ...[
      '<font><name val="Arial"/><sz val="14"/></font>',
      '<font><color theme="1"/></font>',
      '<font><color rgb="80113355"/></font>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF113355"/><bgColor indexed="64"/><bgColor indexed="64"/></patternFill></fill>',
    ].map((style) => [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="expression" priority="1" dxfId="0"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
      '',
      `<dxfs count="1"><dxf>${style}</dxf></dxfs>`,
    ]),
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="duplicateValues" priority="1e2"/></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="min"/><cfvo type="num" val="50"/><cfvo type="max"/><color rgb="FFFF0000"/><color rgb="FFFFFF00"/><color rgb="FF00FF00"/></colorScale></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="containsText" text="成本" priority="1"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '<conditionalFormatting sqref="A1:A2"><cfRule type="expression" priority="1"><formula>INDIRECT("A1")&gt;0</formula></cfRule></conditionalFormatting>',
      '',
    ],
    [
      '',
      '<dataValidations count="1"><dataValidation type="any" sqref="A1:A1"><formula1>0</formula1></dataValidation></dataValidations>',
    ],
    [
      '',
      '<dataValidations count="1"><dataValidation type="list" showDropDown="1" sqref="A1:A1"><formula1>"A,B"</formula1></dataValidation></dataValidations>',
    ],
    [
      '',
      '<dataValidations count="1"><dataValidation type="list" imeMode="hiragana" sqref="A1:A1"><formula1>"A,B"</formula1></dataValidation></dataValidations>',
    ],
    [
      '',
      '<dataValidations count="1"><dataValidation type="list" sqref="A1:A1"><formula1>[Book.xlsx]Options!A1:A3</formula1></dataValidation></dataValidations>',
    ],
    ...['Options', '$A$1:$B$3', '$A$1:$A$1001'].map((reference) => [
      '',
      `<dataValidations count="1"><dataValidation type="list" sqref="A1:A1"><formula1>${reference}</formula1></dataValidation></dataValidations>`,
    ]),
    [
      '',
      '<dataValidations count="2"><dataValidation type="whole" sqref="A1:A3"><formula1>0</formula1><formula2>10</formula2></dataValidation><dataValidation type="whole" sqref="A3:A4"><formula1>0</formula1><formula2>10</formula2></dataValidation></dataValidations>',
    ],
    [
      '',
      '<dataValidations count="1"><dataValidation type="list" sqref="A1:A1"><formula1>"A,,B"</formula1></dataValidation></dataValidations>',
    ],
    [
      '',
      '<x14:dataValidations xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"/>',
    ],
  ];
  const ordinary = await codec.importStudioExcel(source, '普通.xlsx');
  for (const [conditional, validation, dxfs] of cases) {
    const native = await withNativeRuleParts(source, conditional, validation, dxfs);
    await assert.rejects(
      codec.importStudioExcel(native, '复杂规则.xlsx'),
      /条件|验证|不支持|不受支持|区域|色阶|支持范围/,
      conditional + validation + (dxfs ?? '')
    );
    await assert.rejects(
      codec.exportStudioExcel(ordinary, native),
      /条件|验证|不支持|不受支持|区域|色阶|支持范围/,
      conditional + validation + (dxfs ?? '')
    );
  }
});

test('native rule budgets are checked before ExcelJS allocation and invalid drafts are rejected before source rewriting', async () => {
  const { source } = await fixture();
  const accepted = await withNativeRuleParts(
    source,
    '<conditionalFormatting sqref="A1:J10000"><cfRule type="expression" priority="1"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
    '<dataValidations count="1"><dataValidation type="whole" operator="greaterThan" sqref="A1:J10000"><formula1>0</formula1></dataValidation></dataValidations>'
  );
  assert.equal(
    (await codec.importStudioExcel(accepted, '范围预算.xlsx')).sheets[0].rowCount,
    10000
  );
  for (const conditional of [
    '<conditionalFormatting sqref="A1:K10000"><cfRule type="expression" priority="1"><formula>A1&gt;0</formula></cfRule></conditionalFormatting>',
    `<conditionalFormatting sqref="A1:A1">${Array.from({ length: 101 }, (_, index) => `<cfRule type="duplicateValues" priority="${index + 1}"/>`).join('')}</conditionalFormatting>`,
  ])
    await assert.rejects(
      codec.importStudioExcel(await withNativeRuleParts(source, conditional), '超预算.xlsx'),
      /预算|最多|100/
    );
  for (const validation of [
    '<dataValidations count="1"><dataValidation type="whole" operator="greaterThan" sqref="A1:K10000"><formula1>0</formula1></dataValidation></dataValidations>',
    `<dataValidations count="101">${Array.from({ length: 101 }, (_, index) => `<dataValidation type="whole" operator="greaterThan" sqref="A${index + 1}:A${index + 1}"><formula1>0</formula1></dataValidation>`).join('')}</dataValidations>`,
  ])
    await assert.rejects(
      codec.importStudioExcel(await withNativeRuleParts(source, '', validation), '超验证预算.xlsx'),
      /预算|最多|100/
    );
  const imported = await codec.importStudioExcel(source, '无效草稿.xlsx');
  for (const conditionalFormats of [
    [{ id: 'unknown', range: 'A1:A1', priority: 1, type: 'iconSet' }],
    [
      {
        id: 'complex',
        range: 'A1:A1',
        priority: 1,
        type: 'expression',
        formula: '=INDIRECT("A1")>0',
      },
    ],
    [
      {
        id: 'style',
        range: 'A1:A1',
        priority: 1,
        type: 'duplicateValues',
        style: { border: 'thin' },
      },
    ],
  ])
    await assert.rejects(
      codec.exportStudioExcel(
        {
          ...imported,
          sheets: [{ ...imported.sheets[0], conditionalFormats }, ...imported.sheets.slice(1)],
        },
        source
      ),
      /属性无效|支持范围/
    );
  for (const rules of [
    {
      conditionalFormats: [
        { id: 'control', range: 'A1:A1', priority: 1, type: 'containsText', text: '坏\u0000字符' },
      ],
    },
    {
      conditionalFormats: [
        { id: 'control', range: 'A1:A1', priority: 1, type: 'expression', formula: '=A1>\u00000' },
      ],
    },
    {
      dataValidations: [{ id: 'control', range: 'A1:A1', type: 'custom', formula: '=A1>\u00000' }],
    },
    {
      dataValidations: [
        {
          id: 'control',
          range: 'A1:A1',
          type: 'whole',
          operator: 'equal',
          formula1: '0',
          inputMessage: '坏\u0000提示',
        },
      ],
    },
  ])
    await assert.rejects(
      codec.exportStudioExcel(
        { ...imported, sheets: [{ ...imported.sheets[0], ...rules }, ...imported.sheets.slice(1)] },
        source
      ),
      /XML字符|XML 字符|属性无效/
    );
});

test('row and column edits move original styles, notes, dimensions, print ranges and native objects across real XLSX round-trips', async () => {
  const { workbook } = await fixture();
  const main = workbook.getWorksheet('销售');
  main.getCell('B1').value = '金额';
  const currencyFont = main.getCell('B2').font;
  main.getRow(2).font = { name: '等线', size: 12 };
  main.getCell('B2').font = currencyFont;
  main.getRow(2).height = 33;
  main.getRow(9).hidden = true;
  main.getRow(9).outlineLevel = 2;
  main.getColumn(2).hidden = true;
  main.getColumn(2).outlineLevel = 1;
  main.getColumn(2).style = { font: { name: 'Arial', size: 10 } };
  main.getCell('B2').note = '保留金额批注';
  main.getCell('D4').value = '删除的行';
  main.getCell('D4').note = '删除行的批注';
  main.getCell('E3').value = '删除的列';
  main.getCell('E3').note = '删除列的批注';
  main.getCell('F2').value = '合并标题';
  main.mergeCells('F2:G3');
  main.getCell('G3').style = {
    border: { bottom: { style: 'double', color: { argb: 'FF9A3412' } } },
  };
  main.pageSetup.printArea = 'A2:B3&&F9:G11';
  main.pageSetup.printTitlesRow = '2:3';
  main.pageSetup.printTitlesColumn = 'B:D';
  main.getRow(3).addPageBreak(2, 4);
  main.getRow(9).addPageBreak(1, 16384);
  const initialZip = await JSZip.loadAsync(await (await asBlob(workbook)).arrayBuffer());
  const initialXml = await initialZip.file('xl/worksheets/sheet1.xml').async('string');
  initialZip.file(
    'xl/worksheets/sheet1.xml',
    initialXml.replace(
      /(?=<legacyDrawing\b|<\/worksheet>)/,
      '<colBreaks count="1" manualBreakCount="1"><brk id="2" min="0" max="1048575" man="1"/></colBreaks>'
    )
  );
  const initial = new Blob([await initialZip.generateAsync({ type: 'uint8array' })]);
  let document = await codec.importStudioExcel(initial, '结构编辑.xlsx');
  const id = document.sheets[0].id;
  document = model.studioSetFreeze(document, id, 3, 2);
  document = model.studioSetFilter(document, id, {
    range: 'A1:B5',
    columns: { A: { operator: 'equals', value: '3' } },
  });
  document = model.studioAddChart(document, id, 'A1:B5', 'bar');
  const source = await codec.exportStudioExcel(document, initial);
  document = await codec.importStudioExcel(source, document.name);
  for (const edit of [
    { axis: 'row', type: 'insert', index: 2, count: 1 },
    { axis: 'column', type: 'insert', index: 2, count: 1 },
    { axis: 'row', type: 'delete', index: 5, count: 1 },
    { axis: 'column', type: 'delete', index: 6, count: 1 },
  ])
    document = structure.studioChangeSheetStructure(document, id, edit);
  const assertWorkbook = (result) => {
    const sheet = result.getWorksheet('销售');
    assert.equal(sheet.getCell('A3').value, 3);
    assert.equal(sheet.getCell('C3').value, 12.5);
    assert.equal(sheet.getCell('D3').formula, 'A3*C3');
    assert.equal(sheet.getCell('D3').result, 37.5);
    assert.equal(result.getWorksheet('汇总').getCell('A1').formula, "'销售'!D3+1");
    assert.equal(result.getWorksheet('汇总').getCell('A1').result, 38.5);
    assert.equal(sheet.getCell('C3').font.bold, true);
    assert.equal(sheet.getCell('C3').font.italic, true);
    assert.equal(sheet.getCell('C3').font.color.argb, 'FF0F766E');
    assert.equal(sheet.getCell('C3').border.bottom.style, 'thin');
    assert.equal(sheet.getCell('C3').fill.fgColor.argb, 'FFEFF6FF');
    assert.equal(sheet.getCell('C3').numFmt, '¥#,##0.00');
    assert.match(JSON.stringify(sheet.getCell('C3').note), /保留金额批注/);
    assert.equal(sheet.getRow(3).height, 33);
    assert.equal(sheet.getRow(3).font.name, '等线');
    assert.equal(sheet.getRow(3).font.size, 12);
    assert.equal(sheet.getCell('B3').font.name, '等线');
    assert.equal(sheet.getColumn(3).width, 18);
    assert.equal(sheet.getColumn(3).hidden, true);
    assert.equal(sheet.getColumn(3).outlineLevel, 1);
    assert.equal(sheet.getColumn(3).font.name, 'Arial');
    assert.equal(!!sheet.getColumn(2).hidden, false);
    assert.equal(sheet.getColumn(2).outlineLevel, 0);
    assert.equal(sheet.getRow(9).hidden, true);
    assert.equal(sheet.getRow(9).outlineLevel, 2);
    assert.equal(sheet.getCell('A9').value.toISOString(), '2026-11-12T00:00:00.000Z');
    assert.equal(sheet.getCell('A11').hyperlink, 'https://example.com/docs');
    assert.deepEqual(sheet.model.merges, ['F3:G4']);
    assert.equal(sheet.getCell('F3').value, '合并标题');
    assert.equal(sheet.getCell('G4').border.bottom.style, 'double');
    assert.equal(sheet.views[0].xSplit, 3);
    assert.equal(sheet.views[0].ySplit, 4);
    assert.equal(sheet.autoFilter, 'A1:C5');
    assert.equal(sheet.getRow(3).hidden, false);
    assert.equal(sheet.pageSetup.printArea, 'A3:C4&&F9:G11');
    assert.equal(sheet.pageSetup.printTitlesRow, '3:4');
    assert.equal(sheet.pageSetup.printTitlesColumn, 'C:E');
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    assert.equal(sheet.headerFooter.oddHeader, '销售报表');
    assert.doesNotMatch(JSON.stringify(sheet.model), /删除的行|删除的列|删除行的批注|删除列的批注/);
  };
  const assertPrintBreaks = async (blob) => {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = new dom.window.DOMParser().parseFromString(
      await zip.file('xl/worksheets/sheet1.xml').async('string'),
      'application/xml'
    );
    const parts = Array.from(xml.documentElement.children).map((entry) => entry.localName);
    assert.ok(parts.indexOf('rowBreaks') < parts.indexOf('colBreaks'));
    assert.ok(parts.indexOf('colBreaks') < parts.indexOf('drawing'));
    assert.ok(parts.indexOf('drawing') < parts.indexOf('legacyDrawing'));
    const vml = await zip.file('xl/drawings/vmlDrawing1.vml').async('string');
    assert.match(vml, /<x:Row>2<\/x:Row>/);
    assert.match(vml, /<x:Column>2<\/x:Column>/);
    const breaks = (name) =>
      Array.from(xml.getElementsByTagName(name)[0].getElementsByTagName('brk')).map((entry) => ({
        id: Number(entry.getAttribute('id')),
        min: Number(entry.getAttribute('min')),
        max: Number(entry.getAttribute('max')),
      }));
    assert.deepEqual(breaks('rowBreaks'), [
      { id: 4, min: 2, max: 4 },
      { id: 9, min: 0, max: 16383 },
    ]);
    assert.deepEqual(breaks('colBreaks'), [{ id: 3, min: 0, max: 1048575 }]);
  };
  const output = await codec.exportStudioExcel(document, source);
  assertWorkbook(await readWorkbook(output));
  await assertPrintBreaks(output);
  assertWorkbook(await readWorkbook(await codec.exportStudioExcel(document, source)));
  const imported = await codec.importStudioExcel(output, document.name);
  assert.equal(imported.sheets[0].structureEdits, undefined);
  assert.equal(imported.sheets[0].charts[0].range, 'A1:C5');
  assert.equal(imported.sheets[0].filter.columns.A.operator, 'equals');
  const secondOutput = await codec.exportStudioExcel(imported, output);
  assertWorkbook(await readWorkbook(secondOutput));
  await assertPrintBreaks(secondOutput);
  const reopened = await codec.importStudioExcel(secondOutput, document.name);
  assert.equal(reopened.sheets[0].charts[0].range, 'A1:C5');
  assert.equal(studioModel.isOfficeStudioDocument(reopened), true);
});

test('deleting trailing source rows or columns leaves no old cells or notes and clears filters whose header is deleted', async () => {
  const { source } = await fixture();
  const document = await codec.importStudioExcel(source, '尾部删除.xlsx');
  const id = document.sheets[0].id;
  let changed = structure.studioChangeSheetStructure(document, id, {
    axis: 'row',
    type: 'delete',
    index: 10,
    count: 191,
  });
  changed = structure.studioChangeSheetStructure(changed, id, {
    axis: 'column',
    type: 'delete',
    index: 3,
    count: 24,
  });
  const workbook = await readWorkbook(await codec.exportStudioExcel(changed, source));
  const main = workbook.getWorksheet('销售');
  assert.equal(main.getCell('A11').value, null);
  assert.equal(main.getCell('C2').value, null);
  assert.equal(main.getCell('A2').value, 3);
  assert.equal(main.getCell('B2').border.bottom.style, 'thin');
  assert.equal(workbook.getWorksheet('汇总').getCell('A1').formula, '#REF!+1');
  assert.deepEqual(workbook.getWorksheet('汇总').getCell('A1').result, { error: '#REF!' });

  let filtered = model.studioSetFilter(document, id, {
    range: 'A1:B5',
    columns: { A: { operator: 'equals', value: '3' } },
  });
  filtered = model.studioSetFreeze(filtered, id, 1, 0);
  const filteredSource = await codec.exportStudioExcel(filtered, source);
  filtered = await codec.importStudioExcel(filteredSource, document.name);
  filtered = structure.studioChangeSheetStructure(filtered, id, {
    axis: 'row',
    type: 'delete',
    index: 1,
    count: 1,
  });
  assert.equal(filtered.sheets[0].filter, undefined);
  const result = (
    await readWorkbook(await codec.exportStudioExcel(filtered, filteredSource))
  ).getWorksheet('销售');
  assert.equal(result.autoFilter, undefined);
  assert.equal(result.views[0].state, 'normal');
  for (let row = 1; row <= 4; row++) assert.equal(!!result.getRow(row).hidden, false);
});

test('real XLSX source round-trip clears cells, recalculates cached formulas and preserves untouched workbook settings', async () => {
  const { source } = await fixture();
  const document = await codec.importStudioExcel(source, '销售.xlsx');
  const mainId = document.sheets[0].id;
  assert.equal(document.activeSheetId, document.sheets[1].id);
  assert.equal(document.sheets[0].cells.A6.input, "'123");
  assert.equal(document.sheets[0].cells.A7.input, "'=SUM(A2)");
  let changed = model.studioPatchCells(document, mainId, {
    A2: { input: '5' },
    B2: { input: '', bold: false },
  });
  changed = model.studioRenameSheet(changed, mainId, '销售新版');
  const output = await codec.exportStudioExcel(changed, source);
  assert.equal(output.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const workbook = await readWorkbook(output);
  const main = workbook.getWorksheet('销售新版');
  assert.equal(main.getCell('A2').value, 5);
  assert.equal(main.getCell('B2').value, null);
  assert.equal(!!main.getCell('B2').font.bold, false);
  assert.equal(main.getCell('B2').font.italic, true);
  assert.equal(main.getCell('B2').font.color.argb, 'FF0F766E');
  assert.equal(main.getCell('B2').border.bottom.style, 'thin');
  assert.equal(main.getCell('B2').fill.fgColor.argb, 'FFEFF6FF');
  assert.equal(main.getCell('B2').numFmt, '¥#,##0.00');
  assert.equal(main.getCell('C2').formula, 'A2*B2');
  assert.equal(main.getCell('C2').result, 0);
  assert.equal(workbook.getWorksheet('汇总').getCell('A1').formula, "'销售新版'!C2+1");
  assert.equal(workbook.getWorksheet('汇总').getCell('A1').result, 1);
  assert.equal(main.getCell('A6').value, '123');
  assert.equal(main.getCell('A7').value, '=SUM(A2)');
  assert.equal(main.getCell('A9').value.toISOString(), '2026-11-12T00:00:00.000Z');
  assert.equal(main.getCell('A11').value.hyperlink, 'https://example.com/docs');
  assert.equal(main.getColumn(2).width, 18);
  assert.equal(main.views[0].state, 'frozen');
  assert.equal(main.pageSetup.orientation, 'landscape');
  assert.equal(main.headerFooter.oddHeader, '销售报表');
  assert.equal(workbook.creator, '原作者');
  const outputArchive = await JSZip.loadAsync(await output.arrayBuffer());
  const workbookXml = await outputArchive.file('xl/workbook.xml').async('string');
  assert.match(workbookXml, /fullCalcOnLoad="1"/);
  const reopened = await codec.importStudioExcel(output, '销售新版.xlsx');
  assert.equal(reopened.sheets[0].cells.B2.input, '');
  assert.equal(model.studioCalculate(reopened).values.get(`${reopened.sheets[1].id}:A1`), 1);
});

test('native numeric dates preserve serial 0, 1, 59, 60, 61 and fractional-day precision across repeated source and standalone XLSX saves', async () => {
  const serials = [
    0, 1, 59, 60, 61, 0.5, 1.25, 59.5, 60.75, 61.25, 60.123456789, 60.1234567890123,
    45351.123456789,
  ];
  const format = 'yyyy-mm-dd hh:mm:ss.000';
  const workbook = new ExcelJS.Workbook();
  const native = workbook.addWorksheet('日期序号');
  for (const [index, value] of serials.entries()) {
    const cell = native.getCell(`A${index + 1}`);
    cell.value = value;
    cell.numFmt = format;
    cell.font = { bold: true, color: { argb: 'FF113355' } };
  }
  native.getCell('B1').value = { formula: 'A1+1', result: 999 };
  native.getCell('B2').value = { formula: 'A4+0.123456789', result: 999 };
  native.getCell('B1').numFmt = format;
  native.getCell('B2').numFmt = format;
  const source = await asBlob(workbook);
  for (const useSource of [true, false]) {
    let currentSource = source;
    let document = await codec.importStudioExcel(source, '日期序号.xlsx');
    for (let round = 0; round < 3; round++) {
      for (const [index, value] of serials.entries()) {
        const cell = document.sheets[0].cells[`A${index + 1}`];
        assert.equal(cell.input, String(value), `import ${useSource}/${round}/${index}`);
        assert.equal(cell.numberFormat, format);
        assert.equal(cell.bold, true);
        assert.equal(cell.color, '#113355');
      }
      assert.equal(document.sheets[0].cells.B1.input, '=A1+1');
      assert.equal(document.sheets[0].cells.B2.input, '=A4+0.123456789');
      document = model.studioPatchCells(document, document.sheets[0].id, {
        C1: { input: `保存 ${round + 1}` },
      });
      const output = await codec.exportStudioExcel(document, useSource ? currentSource : undefined);
      const { worksheet } = await readRuleXml(output);
      const cells = new Map(
        Array.from(worksheet.getElementsByTagName('c')).map((cell) => [
          cell.getAttribute('r'),
          cell,
        ])
      );
      for (const [index, value] of serials.entries()) {
        const cell = cells.get(`A${index + 1}`);
        assert.equal(
          cell.getElementsByTagName('v')[0].textContent,
          String(value),
          `saved XML ${useSource}/${round}/${index}`
        );
        assert.equal(cell.hasAttribute('t'), false);
        assert.ok(Number(cell.getAttribute('s')) > 0);
      }
      assert.equal(cells.get('B1').getElementsByTagName('f')[0].textContent, 'A1+1');
      assert.equal(cells.get('B1').getElementsByTagName('v')[0].textContent, '1');
      assert.equal(cells.get('B2').getElementsByTagName('v')[0].textContent, '60.123456789');
      const loaded = (await readWorkbook(output)).getWorksheet('日期序号');
      assert.equal(loaded.getCell('A1').numFmt, format);
      assert.equal(loaded.getCell('A11').numFmt, format);
      document = await codec.importStudioExcel(output, '日期序号.xlsx');
      currentSource = output;
    }
    const changed = model.studioPatchCells(document, document.sheets[0].id, {
      A11: { input: '60.987654321' },
    });
    const output = await codec.exportStudioExcel(changed, useSource ? currentSource : undefined);
    const reopened = await codec.importStudioExcel(output, '编辑后的日期.xlsx');
    assert.equal(reopened.sheets[0].cells.A11.input, '60.987654321');
    assert.equal(reopened.sheets[0].cells.A11.numberFormat, format);
  }
});

test('native ISO date cells use Gregorian days before the fictitious Excel leap day and retain their serials on subsequent saves', async () => {
  const dates = [
    ['1899-12-31T00:00:00.000Z', 0],
    ['1900-01-01T00:00:00.000Z', 1],
    ['1900-02-28T00:00:00.000Z', 59],
    ['1900-03-01T00:00:00.000Z', 61],
    ['1900-02-28T12:00:00.000Z', 59.5],
  ];
  const workbook = new ExcelJS.Workbook();
  const native = workbook.addWorksheet('ISO日期');
  for (const [index] of dates.entries()) {
    native.getCell(`A${index + 1}`).value = 0;
    native.getCell(`A${index + 1}`).numFmt = 'yyyy-mm-dd hh:mm';
  }
  const zip = await JSZip.loadAsync(await (await asBlob(workbook)).arrayBuffer());
  const xml = new dom.window.DOMParser().parseFromString(
    await zip.file('xl/worksheets/sheet1.xml').async('string'),
    'application/xml'
  );
  for (const [index, cell] of Array.from(xml.getElementsByTagName('c')).entries()) {
    cell.setAttribute('t', 'd');
    cell.getElementsByTagName('v')[0].textContent = dates[index][0];
  }
  zip.file('xl/worksheets/sheet1.xml', new dom.window.XMLSerializer().serializeToString(xml));
  const source = new Blob([await zip.generateAsync({ type: 'uint8array' })]);
  for (const useSource of [true, false]) {
    let currentSource = source;
    let document = await codec.importStudioExcel(source, 'ISO日期.xlsx');
    for (let round = 0; round < 3; round++) {
      for (const [index, [, serial]] of dates.entries())
        assert.equal(document.sheets[0].cells[`A${index + 1}`].input, String(serial));
      const output = await codec.exportStudioExcel(document, useSource ? currentSource : undefined);
      const { worksheet } = await readRuleXml(output);
      for (const [index, cell] of Array.from(worksheet.getElementsByTagName('c')).entries())
        assert.equal(cell.getElementsByTagName('v')[0].textContent, String(dates[index][1]));
      document = await codec.importStudioExcel(output, 'ISO日期.xlsx');
      currentSource = output;
    }
  }
});

test('new XLSX documents export multiple worksheets, text format and native formulas', async () => {
  const document = {
    version: 1,
    id: 'new',
    kind: 'excel',
    name: '新工作簿.xlsx',
    activeSheetId: 'totals',
    sheets: [
      {
        id: 'data',
        name: '数据',
        rowCount: 200,
        columnCount: 26,
        cells: {
          A1: { input: '7', numberFormat: '@' },
          A2: { input: '6' },
          B1: { input: '=SUM(A1:A2)' },
        },
      },
      {
        id: 'totals',
        name: '汇总',
        rowCount: 200,
        columnCount: 26,
        cells: {
          A1: { input: "='数据'!B1*2", bold: true },
          A2: { input: '=UNKNOWNFUNCTION(1)' },
          A3: { input: '=A3+1' },
        },
      },
    ],
  };
  const output = await codec.exportStudioExcel(document);
  const workbook = await readWorkbook(output);
  assert.equal(workbook.worksheets.length, 2);
  assert.equal(workbook.getWorksheet('数据').getCell('A1').value, '7');
  assert.equal(workbook.getWorksheet('数据').getCell('B1').result, 6);
  assert.equal(workbook.getWorksheet('汇总').getCell('A1').result, 12);
  assert.equal(workbook.getWorksheet('汇总').getCell('A2').result.error, '#NAME?');
  assert.equal(workbook.getWorksheet('汇总').getCell('A3').result, undefined);
  assert.equal(workbook.views[0].activeTab, 1);
});

test('version 3 Paste Special results survive a standalone XLSX round-trip', async () => {
  let document = {
    version: 1,
    id: 'paste-special',
    kind: 'excel',
    name: '选择性粘贴.xlsx',
    activeSheetId: 'main',
    sheets: [
      {
        id: 'main',
        name: '粘贴',
        rowCount: 20,
        columnCount: 20,
        columnWidths: { A: 144, B: 92 },
        merges: ['A3:B3'],
        hyperlinks: [
          { id: 'transpose-link', ref: 'A4:B4', target: 'https://example.com/transpose' },
        ],
        cells: {
          A1: {
            input: '=A2*2',
            bold: true,
            numberFormat: '0.00',
            borders: { top: { style: 'thick', color: '#c00000' } },
          },
          A2: { input: '7' },
          B1: { input: "'001", background: '#fff2cc' },
          A3: { input: '标题', bold: true },
          A4: { input: '左侧' },
          B4: { input: '=A4' },
          D4: { input: '旧值', background: '#eeeeee' },
          E4: { input: '旧文本' },
          G4: { input: '保留', italic: true },
          H4: { input: '也保留' },
        },
      },
    ],
  };
  const valueSelection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 2 } };
  const valueText = model.studioCopyTsv(document.sheets[0], valueSelection);
  const valueOrigin = model.studioClipboardOrigin(
    model.studioCopySheetClipboard(document, 'main', valueSelection),
    valueText
  );
  document = model.studioPasteCells(
    document,
    'main',
    { row: 4, col: 4 },
    valueText,
    valueOrigin,
    'values'
  ).document;
  document = model.studioPasteCells(
    document,
    'main',
    { row: 4, col: 7 },
    valueText,
    valueOrigin,
    'formats'
  ).document;
  document = model.studioPasteCells(
    document,
    'main',
    { row: 4, col: 10 },
    valueText,
    valueOrigin,
    'column-widths'
  ).document;
  const transposeSelection = { anchor: { row: 3, col: 1 }, focus: { row: 4, col: 2 } };
  const transposeText = model.studioCopyTsv(document.sheets[0], transposeSelection);
  const transposeOrigin = model.studioClipboardOrigin(
    model.studioCopySheetClipboard(document, 'main', transposeSelection),
    transposeText
  );
  document = model.studioPasteCells(
    document,
    'main',
    { row: 8, col: 13 },
    transposeText,
    transposeOrigin,
    'transpose'
  ).document;

  const imported = await codec.importStudioExcel(
    await codec.exportStudioExcel(document),
    '选择性粘贴.xlsx'
  );
  const sheet = imported.sheets[0];
  assert.equal(sheet.cells.D4.input, '14');
  assert.equal(sheet.cells.D4.background.toLowerCase(), '#eeeeee');
  assert.equal(sheet.cells.E4.input, '001');
  assert.equal(sheet.cells.G4.input, '保留');
  assert.equal(sheet.cells.G4.bold, true);
  assert.equal(!!sheet.cells.G4.italic, false);
  assert.equal(sheet.cells.G4.numberFormat, '0.00');
  assert.equal(sheet.columnWidths.J, 144);
  assert.equal(sheet.columnWidths.K, 92);
  assert.ok(sheet.merges.includes('M8:M9'));
  assert.equal(sheet.cells.N8.input, '左侧');
  assert.equal(sheet.cells.N9.input, '=M9');
  assert.equal(
    hyperlinks.studioSheetHyperlinkAt(sheet, 'N8').target,
    'https://example.com/transpose'
  );
  assert.equal(
    hyperlinks.studioSheetHyperlinkAt(sheet, 'N9').target,
    'https://example.com/transpose'
  );
});

test('changing an existing numeric cell to text format changes its stored XLSX value type', async () => {
  const { source } = await fixture();
  const document = await codec.importStudioExcel(source, '销售.xlsx');
  const changed = model.studioPatchCells(document, document.sheets[0].id, {
    A2: { numberFormat: '@' },
  });
  const workbook = await readWorkbook(await codec.exportStudioExcel(changed, source));
  assert.equal(workbook.getWorksheet('销售').getCell('A2').value, '3');
  assert.equal(workbook.getWorksheet('销售').getCell('A2').numFmt, '@');
});

test('refuses unsupported source objects before importing or exporting them', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.getCell('A1').value = '合并标题';
  sheet.mergeCells('A1:B1');
  const source = await asBlob(workbook);
  const merged = await codec.importStudioExcel(source, '合并.xlsx');
  assert.deepEqual(Array.from(merged.sheets[0].merges), ['A1:B1']);
  const { source: ordinary } = await fixture();
  const document = await codec.importStudioExcel(ordinary, '销售.xlsx');
  await assert.rejects(codec.exportStudioExcel(document, source), /工作表不存在/);
  const zip = await JSZip.loadAsync(await ordinary.arrayBuffer());
  zip.file('xl/charts/chart1.xml', '<chart/>');
  const withChart = new Blob([await zip.generateAsync({ type: 'uint8array' })]);
  await assert.rejects(codec.importStudioExcel(withChart, '图表.xlsx'), /图表/);
  const protectedWorkbook = new ExcelJS.Workbook();
  const protectedSheet = protectedWorkbook.addWorksheet('Sheet1');
  protectedSheet.getCell('A1').value = '受保护';
  await protectedSheet.protect('secret', { spinCount: 1 });
  await assert.rejects(
    codec.importStudioExcel(await asBlob(protectedWorkbook), '保护.xlsx'),
    /受保护/
  );
});

test('rejects out-of-range drafts rather than silently omitting data', async () => {
  const { source } = await fixture();
  const document = await codec.importStudioExcel(source, '销售.xlsx');
  document.sheets[0].cells.A10001 = { input: '超出范围' };
  await assert.rejects(codec.exportStudioExcel(document, source), /超出/);
});

test('imports and exports an entirely empty worksheet', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('空白表');
  const source = await asBlob(workbook);
  const document = await codec.importStudioExcel(source, '空白.xlsx');
  assert.equal(document.sheets[0].name, '空白表');
  assert.equal(Object.keys(document.sheets[0].cells).length, 0);
  const reopened = await readWorkbook(await codec.exportStudioExcel(document, source));
  assert.equal(reopened.worksheets.length, 1);
  assert.equal(reopened.getWorksheet('空白表').actualRowCount, 0);
});

test('deleted worksheets are absent from the actual XLSX source-based export and workbook view indices stay valid', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.views = [
    { x: 0, y: 0, width: 900, height: 600, firstSheet: 1, activeTab: 1, visibility: 'visible' },
  ];
  workbook.addWorksheet('保留').getCell('A1').value = 7;
  workbook.addWorksheet('删除').getCell('A1').value = 8;
  const source = await asBlob(workbook);
  const imported = await codec.importStudioExcel(source, '工作表.xlsx');
  const changed = model.studioDeleteSheet(imported, imported.sheets[1].id);
  const output = await codec.exportStudioExcel(changed, source);
  const loaded = await readWorkbook(output);
  assert.equal(loaded.worksheets.length, 1);
  assert.equal(loaded.worksheets[0].name, '保留');
  assert.equal(loaded.worksheets[0].getCell('A1').value, 7);
  assert.equal(loaded.views[0].activeTab, 0);
  assert.equal(loaded.views[0].firstSheet, 0);
  const reopened = await codec.importStudioExcel(output, '重开.xlsx');
  assert.equal(reopened.sheets.length, 1);
  assert.equal(reopened.activeSheetId, reopened.sheets[0].id);
  assert.equal(studioModel.isOfficeStudioDocument(reopened), true);
  assert.equal(imported.sheets.length, 2);
});

test('native merges, frozen panes, filter conditions and charts survive two actual XLSX exports and reimports', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('销售 & 预算');
  sheet.addRows([
    ['项目', '金额', '小计'],
    ['开发', 20, { formula: 'B2*2', result: 40 }],
    ['设计', 10, { formula: 'B3*2', result: 20 }],
    ['验证', 30, { formula: 'B4*2', result: 60 }],
  ]);
  sheet.getCell('F1').value = '预算标题';
  sheet.mergeCells('F1:H2');
  sheet.getCell('H2').border = { right: { style: 'thin' }, bottom: { style: 'thin' } };
  sheet.getCell('B2').border = { bottom: { style: 'thin' } };
  sheet.getCell('A7').value = { text: '说明', hyperlink: 'https://example.com/report' };
  const source = await asBlob(workbook);
  let document = await codec.importStudioExcel(source, '高级工作簿.xlsx');
  const id = document.sheets[0].id;
  assert.equal(document.sheets[0].cells.G1, undefined);
  document = model.studioSetFreeze(document, id, 2, 1);
  document = model.studioSetFilter(document, id, {
    range: 'A1:C4',
    columns: { B: { operator: 'greater', value: '15' } },
  });
  document = model.studioPatchCells(document, id, { B2: { underline: true, wrap: true } });
  document = model.studioAddChart(document, id, 'A1:C4', 'bar');
  document.sheets[0].charts[0].title = '季度报表 & "预算"';
  const firstFile = await codec.exportStudioExcel(document, source);
  const firstZip = await JSZip.loadAsync(await firstFile.arrayBuffer());
  const chartPaths = Object.keys(firstZip.files).filter((path) =>
    /^xl\/charts\/[^/]+\.xml$/.test(path)
  );
  assert.equal(chartPaths.length, 1);
  const nativeChart = await firstZip.file(chartPaths[0]).async('string');
  assert.match(nativeChart, /<c:barChart>/);
  assert.match(nativeChart, /销售 &amp; 预算/);
  assert.match(nativeChart, /<c:v>40<\/c:v>/);
  const worksheetXml = await firstZip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(
    worksheetXml,
    /<filterColumn colId="1"><customFilters><customFilter operator="greaterThan" val="15"/
  );
  assert.match(worksheetXml, /<drawing r:id="rIdZuiDrawing"/);
  assert.match(await firstZip.file('[Content_Types].xml').async('string'), /drawingml.chart\+xml/);
  const loaded = await readWorkbook(firstFile);
  assert.equal(loaded.worksheets[0].getCell('F1').isMerged, true);
  assert.equal(loaded.worksheets[0].getCell('H2').border.right.style, 'thin');
  assert.equal(loaded.worksheets[0].getCell('H2').border.bottom.style, 'thin');
  assert.equal(loaded.worksheets[0].views[0].ySplit, 2);
  assert.equal(loaded.worksheets[0].views[0].xSplit, 1);
  assert.equal(loaded.worksheets[0].getRow(3).hidden, true);
  assert.equal(loaded.worksheets[0].getCell('B2').font.underline, true);
  assert.equal(loaded.worksheets[0].getCell('B2').alignment.wrapText, true);
  assert.equal(loaded.worksheets[0].getCell('B2').border.bottom.style, 'thin');
  assert.equal(loaded.worksheets[0].getCell('A7').value.hyperlink, 'https://example.com/report');
  const imported = await codec.importStudioExcel(firstFile, '重开.xlsx');
  assert.deepEqual(Array.from(imported.sheets[0].merges), ['F1:H2']);
  assert.equal(imported.sheets[0].filter.columns.B.operator, 'greater');
  assert.equal(imported.sheets[0].filter.columns.B.value, '15');
  assert.equal(imported.sheets[0].charts[0].range, 'A1:C4');
  assert.equal(imported.sheets[0].charts[0].title, '季度报表 & "预算"');
  assert.equal(studioModel.isOfficeStudioDocument(imported), true);
  imported.sheets[0].charts[0].type = 'line';
  const cleared = model.studioSetFilter(imported, imported.sheets[0].id);
  const secondFile = await codec.exportStudioExcel(cleared, firstFile);
  const reopened = await codec.importStudioExcel(secondFile, '再次重开.xlsx');
  assert.equal(reopened.sheets[0].charts.length, 1);
  assert.equal(reopened.sheets[0].charts[0].type, 'line');
  assert.equal(reopened.sheets[0].charts[0].title, '季度报表 & "预算"');
  assert.equal(reopened.sheets[0].filter, undefined);
  assert.equal((await readWorkbook(secondFile)).worksheets[0].getRow(3).hidden, false);
  assert.equal(reopened.sheets[0].cells.C3.input, '=B3*2');
});

test('contains filter escaping and Unicode series labels survive XLSX while complex charts are refused', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('数据').addRows([
    ['标签', '金额'],
    ['a*b?', 1],
    ['其他', 2],
  ]);
  let document = await codec.importStudioExcel(await asBlob(workbook), '筛选.xlsx');
  const id = document.sheets[0].id;
  document = model.studioSetFilter(document, id, {
    range: 'A1:B3',
    columns: { A: { operator: 'contains', value: 'a*b?' } },
  });
  document = model.studioAddChart(document, id, 'A1:B3', 'bar');
  const output = await codec.exportStudioExcel(document);
  const reopened = await codec.importStudioExcel(output, '重开.xlsx');
  assert.equal(reopened.sheets[0].filter.columns.A.value, 'a*b?');
  const archive = await JSZip.loadAsync(await output.arrayBuffer());
  const path = Object.keys(archive.files).find((entry) => /^xl\/charts\/[^/]+\.xml$/.test(entry));
  const xml = await archive.file(path).async('string');
  archive.file(path, xml.replace('<c:barDir val="col"/>', '<c:barDir val="bar"/>'));
  await assert.rejects(
    codec.importStudioExcel(
      new Blob([await archive.generateAsync({ type: 'uint8array' })]),
      '复杂图表.xlsx'
    ),
    /柱状图/
  );
  archive.file(path, xml.replace('<c:plotArea>', '<c:plotArea><c:pieChart/>'));
  await assert.rejects(
    codec.importStudioExcel(
      new Blob([await archive.generateAsync({ type: 'uint8array' })]),
      '组合图表.xlsx'
    ),
    /复杂图表/
  );
});

test('empty chart titles survive reopening and huge implicit merge areas are refused before ExcelJS allocation', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('数据').addRows([
    ['项目', '数值'],
    ['甲', 1],
    ['乙', 2],
  ]);
  let document = await codec.importStudioExcel(await asBlob(workbook), '数据.xlsx');
  document = model.studioAddChart(document, document.sheets[0].id, 'A1:B3', 'bar');
  document.sheets[0].charts[0].title = '';
  const output = await codec.exportStudioExcel(document);
  assert.equal((await codec.importStudioExcel(output, '重开.xlsx')).sheets[0].charts[0].title, '');
  document.sheets[0].charts[0].title = '无效\u0001文字';
  await assert.rejects(codec.exportStudioExcel(document), /无效 XML 字符/);
  const source = await asBlob(workbook);
  const archive = await JSZip.loadAsync(await source.arrayBuffer());
  const xml = await archive.file('xl/worksheets/sheet1.xml').async('string');
  archive.file(
    'xl/worksheets/sheet1.xml',
    xml.replace(
      '</worksheet>',
      '<mergeCells count="1"><mergeCell ref="A1:IV10000"/></mergeCells></worksheet>'
    )
  );
  await assert.rejects(
    codec.importStudioExcel(
      new Blob([await archive.generateAsync({ type: 'uint8array' })]),
      '过大合并.xlsx'
    ),
    /合并占位/
  );
});

test('the default Office Studio budget demo survives export, import and source-based re-export with valid root models', async () => {
  const document = studioModel.createOfficeStudioDocument('excel');
  assert.equal(studioModel.isOfficeStudioDocument(document), true);
  const firstFile = await codec.exportStudioExcel(document);
  const firstWorkbook = await readWorkbook(firstFile);
  assert.equal(firstWorkbook.getWorksheet('预算').getCell('D8').formula, 'SUM(D4:D6)');
  assert.equal(firstWorkbook.getWorksheet('预算').getCell('D8').result, 20600);
  assert.equal(firstWorkbook.getWorksheet('汇总').getCell('B3').formula, "'预算'!D8");
  assert.equal(firstWorkbook.getWorksheet('汇总').getCell('B3').result, 20600);
  const imported = await codec.importStudioExcel(firstFile, document.name);
  assert.equal(studioModel.isOfficeStudioDocument(imported), true);
  assert.equal(
    imported.sheets.find((sheet) => sheet.name === '预算').cells.D8.input,
    '=SUM(D4:D6)'
  );
  assert.equal(imported.sheets.find((sheet) => sheet.name === '汇总').cells.B3.input, "='预算'!D8");
  const secondFile = await codec.exportStudioExcel(imported, firstFile);
  const reopenedWorkbook = await readWorkbook(secondFile);
  assert.equal(reopenedWorkbook.getWorksheet('预算').getCell('D8').result, 20600);
  assert.equal(reopenedWorkbook.getWorksheet('汇总').getCell('B3').formula, "'预算'!D8");
  assert.equal(reopenedWorkbook.getWorksheet('汇总').getCell('B3').result, 20600);
  const reopenedModel = await codec.importStudioExcel(secondFile, document.name);
  assert.equal(studioModel.isOfficeStudioDocument(reopenedModel), true);
  const values = model.studioCalculate(reopenedModel).values;
  assert.equal(
    values.get(`${reopenedModel.sheets.find((sheet) => sheet.name === '预算').id}:D8`),
    20600
  );
  assert.equal(
    values.get(`${reopenedModel.sheets.find((sheet) => sheet.name === '汇总').id}:B3`),
    20600
  );
});

test('row point heights and manual hides survive source and independent XLSX exports, edits and resets', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('行布局');
  sheet.properties.defaultRowHeight = 18.75;
  sheet.addRows([['标题'], ['换行\n内容'], ['保留隐藏'], ['末行']]);
  sheet.getRow(1).height = 30.75;
  sheet.getRow(2).height = 44.5;
  sheet.getRow(3).height = 27;
  sheet.getRow(3).hidden = true;
  const source = new Blob([await workbook.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const imported = await codec.importStudioExcel(source, '行布局.xlsx');
  assert.equal(imported.sheets[0].defaultRowHeight, 18.75);
  assert.deepEqual({ ...imported.sheets[0].rowHeights }, { 1: 30.75, 2: 44.5, 3: 27 });
  assert.deepEqual([...imported.sheets[0].hiddenRows], [3]);
  const inserted = structure.studioChangeSheetStructure(imported, imported.sheets[0].id, {
    axis: 'row',
    type: 'insert',
    index: 2,
    count: 1,
  });
  assert.equal(inserted.sheets[0].rowHeights['3'], 44.5);
  assert.deepEqual([...inserted.sheets[0].hiddenRows], [4]);
  const edited = model.studioSetRowHeight(
    inserted,
    inserted.sheets[0].id,
    { firstRow: 2, lastRow: 2 },
    60.25
  );
  for (const base of [source, undefined]) {
    const output = await codec.exportStudioExcel(edited, base);
    const reopened = await codec.importStudioExcel(output, '重开.xlsx');
    assert.equal(reopened.sheets[0].defaultRowHeight, 18.75);
    assert.deepEqual({ ...reopened.sheets[0].rowHeights }, { 1: 30.75, 2: 60.25, 3: 44.5, 4: 27 });
    assert.deepEqual([...reopened.sheets[0].hiddenRows], [4]);
    const native = (await readWorkbook(output)).worksheets[0];
    assert.equal(native.getRow(4).hidden, true);
    const reset = model.studioSetRowHeight(
      reopened,
      reopened.sheets[0].id,
      { firstRow: 1, lastRow: 5 },
      undefined
    );
    const cleared = await codec.importStudioExcel(
      await codec.exportStudioExcel(reset, output),
      '默认.xlsx'
    );
    assert.deepEqual({ ...cleared.sheets[0].rowHeights }, {});
    assert.deepEqual([...cleared.sheets[0].hiddenRows], []);
  }
  const legacy = globalThis.structuredClone(inserted);
  delete legacy.sheets[0].defaultRowHeight;
  delete legacy.sheets[0].rowHeights;
  delete legacy.sheets[0].hiddenRows;
  const hydrated = await codec.hydrateStudioExcelHyperlinks(legacy, source);
  assert.equal(hydrated.sheets[0].rowHeights['3'], 44.5);
  assert.deepEqual([...hydrated.sheets[0].hiddenRows], [4]);
  assert.equal(legacy.sheets[0].rowHeights, undefined);
});
