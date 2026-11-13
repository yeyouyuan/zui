import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../package.json', import.meta.url));
const uiRequire = createRequire(new URL('../../packages/ui/package.json', import.meta.url));
const { JSDOM } = uiRequire('jsdom');
const JSZip = require('jszip');
const ts = require('typescript');
const xml = new JSDOM().window;
const exports = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/pages/collaboration/office-studio/studio-word-codec.ts', import.meta.url),
      'utf8'
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }
  ).outputText,
  {
    exports,
    require,
    Blob,
    crypto: webcrypto,
    DOMParser: xml.DOMParser,
    URL,
    Uint8Array,
    ArrayBuffer,
  }
);
const { importStudioWord, exportStudioWord } = exports;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y3nRmwAAAAASUVORK5CYII=';
const JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDn6KKK++PngooooA//2Q==';
const image = (attrs = {}) => ({
  type: 'image',
  attrs: {
    src: `data:image/png;base64,${PNG}`,
    width: 300,
    height: 150,
    alt: '项目示意图',
    ...attrs,
  },
});
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const p = (...content) => ({ type: 'paragraph', content });
const cell = (value, attrs = {}, type = 'tableCell') => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, ...attrs },
  content: [p(text(value))],
});
const model = (content) => ({
  version: 1,
  id: 'word-test',
  kind: 'word',
  name: '往返验证.docx',
  page: { size: 'A4', orientation: 'landscape', margin: 20 },
  content: { type: 'doc', content },
});
const flatten = (node) => (node.text || '') + (node.content || []).map(flatten).join('');
const find = (node, type) => [
  ...(node.type === type ? [node] : []),
  ...(node.content || []).flatMap((child) => find(child, type)),
];
const findText = (node, value) => find(node, 'text').find((item) => item.text === value);
const attrs = (node, mark) => node.marks?.find((item) => item.type === mark)?.attrs;
const parse = (value) => new xml.DOMParser().parseFromString(value, 'application/xml');

async function fixture(body, parts = {}) {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1134" w:right="1134"/></w:sectPr></w:body></w:document>`
  );
  for (const [name, value] of Object.entries(parts)) zip.file(name, value);
  return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
}

test('DOCX roundtrip keeps headings, rich text, link, hard/page breaks and page configuration', async () => {
  const source = model([
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [text('项目评审')] },
    {
      type: 'paragraph',
      attrs: {
        indentLeft: 18,
        indentFirstLine: 12,
        spaceBefore: 6,
        spaceAfter: 12,
        lineHeight: 1.5,
      },
      content: [
        text('重点说明', [
          { type: 'bold' },
          { type: 'italic' },
          { type: 'underline' },
          { type: 'strike' },
          {
            type: 'textStyle',
            attrs: {
              fontFamily: 'SimSun',
              fontSize: '14pt',
              color: '#185adb',
              backgroundColor: '#ffff00',
            },
          },
        ]),
        { type: 'hardBreak' },
        text('下一行'),
        text('官网', [
          { type: 'link', attrs: { href: 'https://zui.test/docs?lang=zh&view=word' } },
        ]),
      ],
    },
    { type: 'pageBreak' },
    p(text('第二页')),
    { type: 'horizontalRule' },
    { type: 'blockquote', content: [p(text('评审备注'))] },
  ]);
  const blob = await exportStudioWord(source);
  assert.match(blob.type, /wordprocessingml/);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(zip.file('[Content_Types].xml'));
  const doc = parse(await zip.file('word/document.xml').async('string'));
  const size = doc.getElementsByTagNameNS(W, 'pgSz')[0];
  assert.equal(size.getAttributeNS(W, 'orient'), 'landscape');
  assert.equal(size.getAttributeNS(W, 'w'), '16838');
  assert.equal(doc.getElementsByTagNameNS(W, 'br').length, 2);
  const restored = await importStudioWord(blob, source.name);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.page)), source.page);
  assert.equal(flatten(restored.content), '项目评审重点说明下一行官网第二页评审备注');
  const heading = find(restored.content, 'heading')[0];
  assert.equal(heading.attrs.level, 2);
  assert.equal(heading.attrs.textAlign, 'center');
  const marked = findText(restored.content, '重点说明');
  for (const kind of ['bold', 'italic', 'underline', 'strike'])
    assert.ok(marked.marks.some((mark) => mark.type === kind));
  assert.equal(attrs(marked, 'textStyle').fontFamily, 'SimSun');
  assert.equal(attrs(marked, 'textStyle').fontSize, '14pt');
  assert.equal(attrs(marked, 'textStyle').color, '#185adb');
  assert.equal(attrs(marked, 'textStyle').backgroundColor, '#ffff00');
  assert.equal(
    attrs(findText(restored.content, '官网'), 'link').href,
    'https://zui.test/docs?lang=zh&view=word'
  );
  const paragraph = find(restored.content, 'paragraph').find((item) =>
    flatten(item).includes('重点说明')
  );
  assert.equal(paragraph.attrs.indentLeft, 18);
  assert.equal(paragraph.attrs.indentFirstLine, 12);
  assert.equal(paragraph.attrs.lineHeight, 1.5);
  assert.equal(find(restored.content, 'pageBreak').length, 1);
  assert.equal(find(restored.content, 'horizontalRule').length, 1);
  assert.equal(find(restored.content, 'blockquote').length, 1);
});

test('DOCX list import preserves nested mixed lists, sequence and non-default starts', async () => {
  const source = model([
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        {
          type: 'listItem',
          content: [
            p(text('第三项')),
            { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('子项'))] }] },
          ],
        },
        { type: 'listItem', content: [p(text('第四项'))] },
      ],
    },
    p(text('分隔段落')),
    {
      type: 'orderedList',
      attrs: { start: 7 },
      content: [{ type: 'listItem', content: [p(text('第七项'))] }],
    },
  ]);
  const restored = await importStudioWord(await exportStudioWord(source), source.name);
  const lists = find(restored.content, 'orderedList');
  assert.equal(lists.length, 2);
  assert.equal(lists[0].attrs.start, 3);
  assert.equal(lists[1].attrs.start, 7);
  assert.equal(lists[0].content.length, 2);
  assert.equal(lists[0].content[0].content[1].type, 'bulletList');
  assert.equal(flatten(restored.content), '第三项子项第四项分隔段落第七项');
});

test('DOCX table roundtrip retains row/column merges, headings and cell background', async () => {
  const source = model([
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            cell(
              '标题',
              { colspan: 2, colwidth: [160, 180], backgroundColor: '#dbeafe' },
              'tableHeader'
            ),
          ],
        },
        {
          type: 'tableRow',
          content: [
            cell('合并内容', { rowspan: 2, colwidth: [160] }),
            cell('上部', { colwidth: [180] }),
          ],
        },
        { type: 'tableRow', content: [cell('下部', { colwidth: [180] })] },
      ],
    },
  ]);
  const blob = await exportStudioWord(source);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const doc = parse(await zip.file('word/document.xml').async('string'));
  assert.equal(doc.getElementsByTagNameNS(W, 'vMerge').length, 2);
  const restored = await importStudioWord(blob, source.name);
  const table = find(restored.content, 'table')[0];
  assert.equal(table.content.length, 3);
  assert.equal(table.content[0].content[0].type, 'tableHeader');
  assert.equal(table.content[0].content[0].attrs.colspan, 2);
  assert.equal(table.content[0].content[0].attrs.backgroundColor, '#dbeafe');
  assert.equal(table.content[1].content[0].attrs.rowspan, 2);
  assert.equal(table.content[2].content.length, 1);
  assert.equal(flatten(table), '标题合并内容上部下部');
  const repeated = await importStudioWord(await exportStudioWord(restored), source.name);
  assert.equal(flatten(repeated.content), flatten(restored.content));
  assert.equal(find(repeated.content, 'table')[0].content[1].content[0].attrs.rowspan, 2);
});

test('DOCX import resolves inherited paragraph and character styles', async () => {
  const blob = await fixture(
    '<w:p><w:pPr><w:pStyle w:val="Custom"/></w:pPr><w:r><w:rPr><w:rStyle w:val="Emphasis"/><w:b w:val="0"/></w:rPr><w:t>继承样式</w:t></w:r></w:p>',
    {
      'word/styles.xml': `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:styleId="Base"><w:rPr><w:b/><w:color w:val="125ABC"/></w:rPr><w:pPr><w:jc w:val="right"/></w:pPr></w:style><w:style w:styleId="Custom"><w:basedOn w:val="Base"/><w:rPr><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="character" w:styleId="Emphasis"><w:rPr><w:i/></w:rPr></w:style></w:styles>`,
    }
  );
  const restored = await importStudioWord(blob, '样式.docx');
  const paragraph = restored.content.content[0];
  const run = findText(paragraph, '继承样式');
  assert.equal(paragraph.attrs.textAlign, 'right');
  assert.ok(run.marks.some((mark) => mark.type === 'italic'));
  assert.ok(!run.marks.some((mark) => mark.type === 'bold'));
  assert.equal(attrs(run, 'textStyle').color, '#125abc');
  assert.equal(attrs(run, 'textStyle').fontSize, '16pt');
});

test('DOCX import resolves theme fonts and colors instead of dropping them', async () => {
  const blob = await fixture(
    '<w:p><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:color w:themeColor="accent1"/></w:rPr><w:t>主题内容</w:t></w:r></w:p>',
    {
      'word/theme/theme1.xml':
        '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme name="Test"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:clrScheme name="Test"><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme></a:themeElements></a:theme>',
    }
  );
  const restored = await importStudioWord(blob, '主题.docx');
  const style = attrs(findText(restored.content, '主题内容'), 'textStyle');
  assert.equal(style.fontFamily, 'Calibri');
  assert.equal(style.color, '#4472c4');
  await assert.rejects(
    importStudioWord(
      await fixture(
        '<w:p><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr><w:t>缺少主题</w:t></w:r></w:p>'
      ),
      '不完整.docx'
    ),
    /主题字体/
  );
});

test('the published studio Word sample can export, reopen and export again', async () => {
  const sourceModules = new Map();
  function sourceModule(url) {
    if (sourceModules.has(url.href)) return sourceModules.get(url.href).exports;
    const module = { exports: {} };
    // Cache the live exports before loading dependencies, including circular imports.
    sourceModules.set(url.href, module);
    runInNewContext(
      ts.transpileModule(readFileSync(url, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      {
        exports: module.exports,
        module,
        require: (id) =>
          id.startsWith('.') ? sourceModule(new URL(`${id}.ts`, url)) : uiRequire(id),
        crypto: webcrypto,
        Date,
        Error,
        URL,
      }
    );
    return module.exports;
  }
  const sampleExports = sourceModule(
    new URL('../../packages/ui/src/components/OfficeStudio/studio-model.ts', import.meta.url)
  );
  const source = sampleExports.createOfficeStudioDocument('word');
  assert.equal(sampleExports.isOfficeStudioDocument(source), true);
  const reopened = await importStudioWord(await exportStudioWord(source), source.name);
  assert.equal(flatten(reopened.content), flatten(source.content));
  assert.equal(find(reopened.content, 'table').length, 1);
  assert.equal(find(reopened.content, 'heading').length, 3);
  const second = await importStudioWord(await exportStudioWord(reopened), source.name);
  assert.equal(flatten(second.content), flatten(source.content));
});

test('DOCX import refuses unsupported drawings, tracked changes, broken header references and embedded objects', async () => {
  for (const body of [
    '<w:p><w:r><w:drawing/></w:r></w:p>',
    '<w:p><w:ins><w:r><w:t>修订</w:t></w:r></w:ins></w:p>',
    '<w:p><w:r><w:fldChar/></w:r></w:p>',
    '<w:sectPr><w:headerReference/></w:sectPr>',
  ]) {
    await assert.rejects(importStudioWord(await fixture(body), '未支持.docx'), /避免内容丢失/);
  }
  await assert.rejects(
    importStudioWord(
      await fixture('<w:p/>', { 'word/embeddings/document.xlsx': 'embedded' }),
      '嵌入.docx'
    ),
    /嵌入文件/
  );
});

test('DOCX import refuses unsafe hyperlinks and merged cells containing hidden text', async () => {
  const link = await fixture(
    '<w:p><w:hyperlink r:id="link"><w:r><w:t>脚本</w:t></w:r></w:hyperlink></w:p>',
    {
      'word/_rels/document.xml.rels':
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>',
    }
  );
  await assert.rejects(importStudioWord(link, '链接.docx'), /链接协议/);
  const merged = await fixture(
    '<w:tbl><w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p/></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p><w:r><w:t>隐藏</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
  );
  await assert.rejects(importStudioWord(merged, '合并.docx'), /隐藏文字/);
});

test('DOCX export fails explicitly for unsupported nodes, marks and inline layout', async () => {
  await assert.rejects(
    exportStudioWord(model([{ type: 'image', attrs: { src: 'photo.png' } }])),
    /image/
  );
  await assert.rejects(
    exportStudioWord(model([p(text('未知', [{ type: 'unknownMark' }]))])),
    /unknownMark/
  );
  await assert.rejects(
    exportStudioWord(model([p(text('行距', [{ type: 'textStyle', attrs: { lineHeight: '3' } }]))])),
    /lineHeight/
  );
  await assert.rejects(
    exportStudioWord(
      model([
        {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [p(text('首段')), p(text('第二段'))] }],
        },
      ])
    ),
    /Shift\+Enter/
  );
});

test('DOCX embeds raster images and retains body, default header/footer, fields and distances over repeated exports', async () => {
  const source = model([
    p(
      text('插图前'),
      { ...image(), marks: [{ type: 'link', attrs: { href: 'https://zui.test/picture' } }] },
      text('插图后')
    ),
  ]);
  source.header = {
    type: 'doc',
    content: [
      p(text('项目机密', [{ type: 'bold' }])),
      p(image({ width: 80, height: 40, alt: '页眉徽标' })),
    ],
  };
  source.footer = {
    type: 'doc',
    content: [
      p(
        text('第 '),
        { type: 'pageNumber', attrs: { kind: 'current' } },
        text(' 页，共 '),
        { type: 'pageNumber', attrs: { kind: 'total' } },
        text(' 页')
      ),
    ],
  };
  source.pageNumbers = true;
  source.page.headerDistance = 10;
  source.page.footerDistance = 11.5;
  const blob = await exportStudioWord(source);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(Object.keys(zip.files).some((path) => /^word\/media\/.*\.png$/.test(path)));
  assert.ok(Object.keys(zip.files).some((path) => /^word\/header\d+\.xml$/.test(path)));
  assert.ok(Object.keys(zip.files).some((path) => /^word\/footer\d+\.xml$/.test(path)));
  const xmlText = await zip.file('word/document.xml').async('string');
  assert.match(xmlText, /headerReference/);
  assert.match(xmlText, /footerReference/);
  const restored = await importStudioWord(blob, source.name);
  assert.equal(flatten(restored.content), '插图前插图后');
  const picture = find(restored.content, 'image')[0];
  assert.equal(picture.attrs.src, `data:image/png;base64,${PNG}`);
  assert.equal(picture.attrs.width, 300);
  assert.equal(picture.attrs.height, 150);
  assert.equal(picture.attrs.alt, '项目示意图');
  assert.equal(attrs(picture, 'link').href, 'https://zui.test/picture');
  assert.equal(flatten(restored.header), '项目机密');
  assert.equal(find(restored.header, 'image')[0].attrs.alt, '页眉徽标');
  assert.equal(
    findText(restored.header, '项目机密').marks.some((mark) => mark.type === 'bold'),
    true
  );
  assert.equal(flatten(restored.footer), '第  页，共  页');
  assert.equal(find(restored.footer, 'pageNumber').length, 2);
  assert.equal(find(restored.footer, 'pageNumber')[0].attrs.kind, 'current');
  assert.equal(find(restored.footer, 'pageNumber')[1].attrs.kind, 'total');
  assert.equal(restored.pageNumbers, true);
  assert.equal(restored.page.headerDistance, 10);
  assert.equal(restored.page.footerDistance, 11.5);
  const second = await importStudioWord(await exportStudioWord(restored), source.name);
  assert.equal(find(second.footer, 'pageNumber').length, 2);
  assert.equal(find(second.content, 'image')[0].attrs.src, picture.attrs.src);
  assert.equal(flatten(second.header), flatten(restored.header));
});

test('DOCX imports simple PAGE and NUMPAGES fields without their cached values becoming editable text', async () => {
  const blob = await fixture(
    '<w:p><w:r><w:t>第</w:t></w:r><w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "><w:r><w:rPr><w:b/></w:rPr><w:t>3</w:t></w:r></w:fldSimple><w:r><w:t>页，共</w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>8</w:t></w:r></w:fldSimple><w:r><w:t>页</w:t></w:r></w:p>'
  );
  const restored = await importStudioWord(blob, '域.docx');
  assert.equal(flatten(restored.content), '第页，共页');
  const fields = find(restored.content, 'pageNumber');
  assert.equal(fields.length, 2);
  assert.equal(fields[0].attrs.kind, 'current');
  assert.ok(fields[0].marks.some((mark) => mark.type === 'bold'));
  assert.equal(fields[1].attrs.kind, 'total');
  const second = await importStudioWord(await exportStudioWord(restored), '域.docx');
  assert.equal(find(second.content, 'pageNumber').length, 2);
  assert.ok(find(second.content, 'pageNumber')[0].marks.some((mark) => mark.type === 'bold'));
  await assert.rejects(
    importStudioWord(
      await fixture(
        '<w:p><w:fldSimple w:instr=" PAGE "><w:r><w:t>XV</w:t></w:r></w:fldSimple></w:p>'
      ),
      '罗马缓存.docx'
    ),
    /非阿拉伯页码缓存/
  );
  await assert.rejects(
    importStudioWord(
      await fixture(
        '<w:p><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t><w:drawing/></w:r></w:fldSimple></w:p>'
      ),
      '缓存图片.docx'
    ),
    /页码域缓存中的对象/
  );
  await assert.rejects(
    importStudioWord(
      await fixture(
        '<w:p><w:fldSimple w:instr=" DATE "><w:r><w:t>2026</w:t></w:r></w:fldSimple></w:p>'
      ),
      '日期域.docx'
    ),
    /页码以外的域/
  );
});

test('DOCX adds a native page field to a populated footer without duplicating it on reopening', async () => {
  const source = model([p(text('正文'))]);
  source.footer = { type: 'doc', content: [p(text('版权说明'))] };
  source.pageNumbers = true;
  const restored = await importStudioWord(await exportStudioWord(source), source.name);
  assert.equal(flatten(restored.footer), '版权说明');
  assert.equal(find(restored.footer, 'pageNumber').length, 1);
  const second = await importStudioWord(await exportStudioWord(restored), source.name);
  assert.equal(find(second.footer, 'pageNumber').length, 1);
  assert.equal(flatten(second.footer), '版权说明');
});

test('DOCX retains text after a complex field in the same run and refuses nested fields', async () => {
  const body =
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:fldChar w:fldCharType="begin"/><w:instrText> PAGE </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>3</w:t><w:fldChar w:fldCharType="end"/><w:t> 页尾文本</w:t></w:r></w:p>';
  const restored = await importStudioWord(await fixture(body), '复杂域.docx');
  assert.equal(flatten(restored.content), ' 页尾文本');
  assert.equal(find(restored.content, 'pageNumber').length, 1);
  assert.ok(find(restored.content, 'pageNumber')[0].marks.some((mark) => mark.type === 'bold'));
  assert.ok(findText(restored.content, ' 页尾文本').marks.some((mark) => mark.type === 'bold'));
  const second = await importStudioWord(await exportStudioWord(restored), '复杂域.docx');
  assert.equal(flatten(second.content), ' 页尾文本');
  assert.ok(find(second.content, 'pageNumber')[0].marks.some((mark) => mark.type === 'bold'));
  await assert.rejects(
    importStudioWord(
      await fixture(
        body.replace('<w:instrText>', '<w:fldChar w:fldCharType="begin"/><w:instrText>')
      ),
      '嵌套域.docx'
    ),
    /嵌套域/
  );
});

test('DOCX embeds JPEG bytes unchanged and retains configured header/footer distances before regions are created', async () => {
  const source = model([
    p(image({ src: `data:image/jpeg;base64,${JPEG}`, width: 32, height: 16, alt: '实图' })),
  ]);
  source.page.headerDistance = 8.5;
  source.page.footerDistance = 6;
  const blob = await exportStudioWord(source);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const media = Object.keys(zip.files).find((name) => /^word\/media\/.*\.jpg$/.test(name));
  assert.ok(media);
  assert.equal(Buffer.from(await zip.file(media).async('uint8array')).toString('base64'), JPEG);
  const restored = await importStudioWord(blob, source.name);
  assert.equal(find(restored.content, 'image')[0].attrs.src, `data:image/jpeg;base64,${JPEG}`);
  assert.equal(find(restored.content, 'image')[0].attrs.width, 32);
  assert.equal(find(restored.content, 'image')[0].attrs.height, 16);
  assert.equal(restored.header, undefined);
  assert.equal(restored.footer, undefined);
  assert.equal(restored.page.headerDistance, 8.5);
  assert.equal(restored.page.footerDistance, 6);
});

test('DOCX refuses image layout that cannot be preserved and external image links', async () => {
  const exported = await exportStudioWord(model([p(image())]));
  const variants = [
    [(value) => value.replace(/wp:inline/g, 'wp:anchor'), /浮动/],
    [(value) => value.replace('<a:xfrm>', '<a:xfrm rot="5400000">'), /旋转/],
    [(value) => value.replace('<a:stretch>', '<a:srcRect l="5000"/><a:stretch>'), /裁剪/],
    [(value) => value.replace('prst="rect"', 'prst="roundRect"'), /非矩形图片/],
    [(value) => value.replace('<a:fillRect/>', '<a:fillRect r="1000"/>'), /裁剪/],
    [
      (value) =>
        value.replace(
          /<a:blip ([^>]*)\/>/,
          '<a:blip $1><a:extLst><a:ext uri="svg"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main"/></a:ext></a:extLst></a:blip>'
        ),
      /SVG/,
    ],
    [(value) => value.replace('r:embed=', 'r:link='), /外部链接图片/],
  ];
  for (const [modify, message] of variants) {
    const zip = await JSZip.loadAsync(await exported.arrayBuffer());
    const original = await zip.file('word/document.xml').async('string');
    const modified = modify(original);
    assert.notEqual(modified, original);
    zip.file('word/document.xml', modified);
    await assert.rejects(
      importStudioWord(
        new Blob([await zip.generateAsync({ type: 'uint8array' })]),
        '复杂图片.docx'
      ),
      message
    );
  }
  await assert.rejects(
    exportStudioWord(model([p(image({ src: 'https://zui.test/photo.png' }))])),
    /外部图片地址/
  );
  await assert.rejects(
    exportStudioWord(model([p(image({ src: `data:image/jpeg;base64,${PNG}` }))])),
    /类型与内容不一致/
  );
  const headerSource = model([p(text('正文'))]);
  headerSource.header = { type: 'doc', content: [p(text('页眉'))] };
  const zip = await JSZip.loadAsync(await (await exportStudioWord(headerSource)).arrayBuffer());
  zip.file(
    'word/document.xml',
    (await zip.file('word/document.xml').async('string')).replace(
      'w:type="default"',
      'w:type="first"'
    )
  );
  await assert.rejects(
    importStudioWord(new Blob([await zip.generateAsync({ type: 'uint8array' })]), '不同首页.docx'),
    /不同首页/
  );
});

test('DOCX roundtrip retains superscript and subscript independently', async () => {
  const source = model([
    p(
      text('x'),
      text('2', [{ type: 'superscript' }]),
      text(' H'),
      text('2', [{ type: 'subscript' }]),
      text('O')
    ),
  ]);
  const restored = await importStudioWord(await exportStudioWord(source), source.name);
  assert.equal(flatten(restored.content), 'x2 H2O');
  const scripts = find(restored.content, 'text').filter((node) => node.text === '2');
  assert.ok(scripts[0].marks.some((mark) => mark.type === 'superscript'));
  assert.ok(scripts[1].marks.some((mark) => mark.type === 'subscript'));
});

test('DOCX import rejects old DOC, corrupt XML and unequal margins instead of flattening', async () => {
  await assert.rejects(importStudioWord(new Blob(['binary']), '旧版.doc'), /\.docx/);
  await assert.rejects(importStudioWord(new Blob(['broken']), '损坏.docx'), /无法打开/);
  const bad = await fixture('<w:p><w:r><w:t>bad</w:p>');
  await assert.rejects(importStudioWord(bad, '格式.docx'), /XML 无法解析/);
  const zip = await JSZip.loadAsync(await (await fixture('<w:p/>')).arrayBuffer());
  zip.file(
    'word/document.xml',
    (await zip.file('word/document.xml').async('string')).replace('w:left="1134"', 'w:left="1440"')
  );
  await assert.rejects(
    importStudioWord(new Blob([await zip.generateAsync({ type: 'uint8array' })]), '页边距.docx'),
    /不等宽页边距/
  );
});

test('typed Word font names and 1pt to 300pt half-point sizes survive repeated DOCX saves', async () => {
  const font = 'Custom "Font"; & \\Family';
  const source = model([
    p(
      ...[1, 17.5, 300].map((size) =>
        text(`字号${size}`, [
          { type: 'textStyle', attrs: { fontFamily: font, fontSize: `${size}pt` } },
        ])
      )
    ),
  ]);
  let current = source;
  for (let round = 0; round < 2; round++) {
    const output = await exportStudioWord(current);
    current = await importStudioWord(output, '字体.docx');
    for (const size of [1, 17.5, 300]) {
      const marked = findText(current.content, `字号${size}`);
      assert.equal(attrs(marked, 'textStyle').fontFamily, font);
      assert.equal(attrs(marked, 'textStyle').fontSize, `${size}pt`);
    }
  }
});
