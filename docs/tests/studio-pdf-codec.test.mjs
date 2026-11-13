import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { trueTypeFromWoff } from '../../scripts/office-fonts.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const {
  PDFDocument,
  PDFArray,
  PDFRawStream,
  PDFName,
  PDFString,
  StandardFonts,
  degrees,
  decodePDFRawStream,
} = require('pdf-lib');
const file = new URL(
  '../src/pages/collaboration/office-studio/studio-pdf-codec.ts',
  import.meta.url
);
const compiled = ts.transpileModule(
  readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', "'/test-base/'"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }
).outputText;

function codec(
  fetch = async () => {
    throw new Error('Unexpected network request');
  }
) {
  const exports = {};
  const requests = [];
  runInNewContext(compiled, {
    exports,
    require,
    Blob,
    Uint8Array,
    ArrayBuffer,
    Error,
    crypto: webcrypto,
    fetch: async (...args) => {
      requests.push(args[0]);
      return fetch(...args);
    },
  });
  return { ...exports, requests };
}

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function blob(pdf) {
  return new Blob(
    [new Uint8Array(await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }))],
    { type: 'application/pdf' }
  );
}

async function original() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([480, 640]);
  page.setCropBox(30, 40, 400, 560);
  page.setRotation(degrees(90));
  const second = pdf.addPage([300, 400]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Original page content', { x: 70, y: 550, size: 16, font });
  second.drawText('Original second page', { x: 40, y: 350, size: 14, font });
  const form = pdf.getForm();
  const name = form.createTextField('name');
  name.setText('Original');
  name.addToPage(page, { x: 70, y: 450, width: 180, height: 26, font });
  const confirmed = form.createCheckBox('confirmed');
  confirmed.addToPage(page, { x: 70, y: 400, width: 18, height: 18 });
  confirmed.addToPage(second, { x: 40, y: 280, width: 18, height: 18 });
  const status = form.createDropdown('status');
  status.addOptions(['Draft', 'Approved']);
  status.select('Draft');
  status.addToPage(page, { x: 110, y: 400, width: 150, height: 24, font });
  const choice = form.createRadioGroup('choice');
  choice.addOptionToPage('A', page, { x: 70, y: 350, width: 16, height: 16 });
  choice.addOptionToPage('B', page, { x: 110, y: 350, width: 16, height: 16 });
  choice.addOptionToPage('C', second, { x: 40, y: 250, width: 16, height: 16 });
  choice.select('A');
  const notes = form.createTextField('notes');
  notes.enableMultiline();
  notes.setText('Line 1\nLine 2');
  notes.addToPage(page, { x: 70, y: 270, width: 180, height: 54, font });
  const reference = form.createTextField('reference');
  reference.setText('LOCKED');
  reference.enableReadOnly();
  reference.addToPage(page, { x: 70, y: 220, width: 100, height: 24, font });
  form.updateFieldAppearances(font);
  return blob(pdf);
}

function streams(pdf, index) {
  const contents = pdf.getPages()[index].node.Contents();
  if (!contents) return [];
  const entries = contents instanceof PDFArray ? contents.asArray() : [contents];
  return entries
    .map((entry) => pdf.context.lookup(entry))
    .filter((entry) => entry instanceof PDFRawStream);
}
const streamHashes = (pdf, index) =>
  streams(pdf, index).map((stream) => digest(stream.getContents()));
const pageInstructions = (pdf, index) =>
  streams(pdf, index)
    .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString())
    .join('\n');

test('imports original AcroForm values, real widget rectangles, pages, radio options and read-only metadata', async () => {
  const c = codec();
  const source = await original();
  const document = await c.importStudioPdf(source, 'Contract.pdf');
  assert.equal(document.kind, 'pdf');
  assert.equal(document.pageCount, 2);
  assert.equal(document.name, 'Contract.pdf');
  assert.deepEqual(Array.from(document.marks), []);
  const name = document.fields.find((field) => field.name === 'name');
  assert.equal(name.value, 'Original');
  assert.equal(name.widgets[0].page, 0);
  assert.equal(name.widgets[0].x, 69.5);
  assert.equal(name.widgets[0].y, 449.5);
  assert.equal(name.widgets[0].width, 181);
  assert.equal(name.widgets[0].height, 27);
  assert.equal(name.widgets[0].rotation, 0);
  const choice = document.fields.find((field) => field.name === 'choice');
  assert.equal(choice.value, 'A');
  assert.deepEqual(
    Array.from(choice.widgets, (widget) => [widget.page, widget.option]),
    [
      [0, 'A'],
      [0, 'B'],
      [1, 'C'],
    ]
  );
  assert.deepEqual(
    Array.from(
      document.fields.find((field) => field.name === 'confirmed').widgets,
      (widget) => widget.page
    ),
    [0, 1]
  );
  assert.equal(document.fields.find((field) => field.name === 'notes').multiline, true);
  assert.equal(document.fields.find((field) => field.name === 'reference').readOnly, true);
  assert.equal(c.requests.length, 0);
});

test('unchanged PDF exports return the exact source without reserialization or a font request', async () => {
  const c = codec();
  const source = await original();
  const document = await c.importStudioPdf(source, 'Original.pdf');
  document.rotations = { 0: 360 };
  // JSON producers may reorder object keys without changing widget geometry.
  document.fields = document.fields.map((field) => ({
    ...field,
    widgets: field.widgets.map(({ page, x, y, width, height, rotation, option }) => ({
      x,
      y,
      width,
      height,
      page,
      rotation,
      ...(option === undefined ? {} : { option }),
    })),
  }));
  assert.equal(await c.exportStudioPdf(document, source), source);
  assert.equal(c.requests.length, 0);
});

test('exports real text, transparent highlight, additional rotation and editable native forms while preserving every original page stream', async () => {
  const c = codec();
  const source = await original();
  const beforeBytes = Buffer.from(await source.arrayBuffer());
  const before = await PDFDocument.load(beforeBytes);
  const document = await c.importStudioPdf(source, 'Changed.pdf');
  document.marks = [
    {
      id: 'text',
      page: 0,
      type: 'text',
      x: 70,
      y: 120,
      text: 'Added annotation\nSecond line',
      size: 14,
      color: '#253044',
    },
    {
      id: 'highlight',
      page: 0,
      type: 'highlight',
      x: 100,
      y: 180,
      text: '',
      size: 16,
      width: 64,
      height: 18,
      color: '#f5c542',
    },
  ];
  document.rotations = { 0: 90, 1: 270 };
  const values = {
    name: 'Alice',
    confirmed: true,
    status: 'Approved',
    choice: 'B',
    notes: 'New\nLines',
  };
  document.fields = document.fields.map((field) =>
    field.name in values ? { ...field, value: values[field.name] } : field
  );
  const output = await c.exportStudioPdf(document, source);
  assert.equal(output.type, 'application/pdf');
  const reopened = await PDFDocument.load(await output.arrayBuffer());
  assert.equal(reopened.getPages()[0].getRotation().angle, 180);
  assert.equal(reopened.getPages()[1].getRotation().angle, 270);
  const form = reopened.getForm();
  assert.equal(form.getTextField('name').getText(), 'Alice');
  assert.equal(form.getCheckBox('confirmed').isChecked(), true);
  assert.deepEqual(form.getDropdown('status').getSelected(), ['Approved']);
  assert.equal(form.getRadioGroup('choice').getSelected(), 'B');
  assert.equal(form.getTextField('notes').getText(), 'New\nLines');
  assert.equal(form.getTextField('reference').getText(), 'LOCKED');
  assert.equal(form.getTextField('reference').isReadOnly(), true);
  assert.equal(form.getFields().length, before.getForm().getFields().length);
  for (const index of [0, 1])
    for (const hash of streamHashes(before, index))
      assert.ok(
        streamHashes(reopened, index).includes(hash),
        `original stream on page ${index + 1} survives`
      );
  const instructions = pageInstructions(reopened, 0);
  assert.match(instructions, new RegExp(Buffer.from('Added annotation').toString('hex'), 'i'));
  assert.match(instructions, /1 0 0 1 100 180 cm/);
  const states = reopened.getPages()[0].node.Resources().lookup(PDFName.of('ExtGState'));
  assert.ok(
    states.entries().some(([, state]) => state.lookup(PDFName.of('ca')).asNumber() === 0.3)
  );
  assert.equal(digest(Buffer.from(await source.arrayBuffer())), digest(beforeBytes));
  assert.equal(c.requests.length, 0);
  const model = await c.importStudioPdf(output, 'Reopened.pdf');
  assert.equal(model.fields.find((field) => field.name === 'name').value, 'Alice');
  assert.equal(model.fields.find((field) => field.name === 'confirmed').widgets.length, 2);
});

test('uses the bundled full Chinese font and retries a failed font load without changing the source', async () => {
  const fontRoot = new URL(
    '../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff',
    import.meta.url
  );
  const font = trueTypeFromWoff(readFileSync(fontRoot));
  let attempts = 0;
  const c = codec(async () => {
    attempts += 1;
    return attempts === 1
      ? { ok: false }
      : {
          ok: true,
          arrayBuffer: async () =>
            font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
        };
  });
  const source = await original();
  const hash = digest(Buffer.from(await source.arrayBuffer()));
  const document = await c.importStudioPdf(source, 'Chinese.pdf');
  document.marks = [
    { id: 'chinese', page: 0, type: 'text', x: 70, y: 100, text: '中文标注', size: 16 },
  ];
  document.fields = document.fields.map((field) =>
    field.name === 'name' ? { ...field, value: '中文确认' } : field
  );
  await assert.rejects(c.exportStudioPdf(document, source), /中文字体加载失败/);
  const output = await c.exportStudioPdf(document, source);
  const reopened = await PDFDocument.load(await output.arrayBuffer());
  assert.equal(reopened.getForm().getTextField('name').getText(), '中文确认');
  assert.ok(output.size > 100_000, 'the full CJK font, including outlines, is embedded');
  assert.equal(c.requests.length, 2);
  assert.equal(c.requests[0], '/test-base/office-pdf-assets/NotoSansSC.ttf');
  assert.equal(digest(Buffer.from(await source.arrayBuffer())), hash);
});

test('validates crop-box offsets, native field structure, readonly values, choices and finite annotation/rotation data', async () => {
  const c = codec();
  const source = await original();
  const originalDocument = await c.importStudioPdf(source, 'Validation.pdf');
  const baseMark = {
    id: 'test',
    page: 0,
    type: 'highlight',
    x: 30,
    y: 40,
    size: 16,
    text: '',
    width: 10,
    height: 10,
  };
  const cases = [
    { ...originalDocument, marks: [{ ...baseMark, x: 29 }] },
    { ...originalDocument, marks: [{ ...baseMark, y: 39 }] },
    { ...originalDocument, marks: [{ ...baseMark, x: 429, width: 2 }] },
    { ...originalDocument, marks: [{ ...baseMark, y: 599, height: 2 }] },
    { ...originalDocument, marks: [{ ...baseMark, width: -1 }] },
    { ...originalDocument, marks: [{ ...baseMark, x: NaN }] },
    { ...originalDocument, marks: [{ ...baseMark, size: Infinity }] },
    { ...originalDocument, marks: [{ ...baseMark, color: 'yellow' }] },
    { ...originalDocument, marks: [{ ...baseMark, page: 2 }] },
    { ...originalDocument, marks: [baseMark, baseMark] },
    { ...originalDocument, rotations: { 0: 45 } },
    { ...originalDocument, rotations: { '01': 90 } },
    { ...originalDocument, rotations: { 2: 90 } },
    { ...originalDocument, pageCount: 3 },
    { ...originalDocument, fields: originalDocument.fields.slice(1) },
    {
      ...originalDocument,
      fields: originalDocument.fields.map((field) =>
        field.name === 'reference' ? { ...field, value: 'CHANGED' } : field
      ),
    },
    {
      ...originalDocument,
      fields: originalDocument.fields.map((field) =>
        field.name === 'status' ? { ...field, value: 'Unknown' } : field
      ),
    },
    {
      ...originalDocument,
      fields: originalDocument.fields.map((field) =>
        field.name === 'confirmed' ? { ...field, value: 'true' } : field
      ),
    },
    {
      ...originalDocument,
      fields: originalDocument.fields.map((field) =>
        field.name === 'name' ? { ...field, readOnly: true } : field
      ),
    },
    {
      ...originalDocument,
      fields: originalDocument.fields.map((field) =>
        field.name === 'name' ? { ...field, widgets: [{ ...field.widgets[0], x: 100 }] } : field
      ),
    },
  ];
  for (const document of cases) await assert.rejects(c.exportStudioPdf(document, source));
  const fitting = { ...originalDocument, marks: [baseMark] };
  assert.equal((await c.exportStudioPdf(fitting, source)).type, 'application/pdf');
  await assert.rejects(
    c.exportStudioPdf(
      {
        ...originalDocument,
        marks: [{ ...baseMark, type: 'text', x: 425, text: 'Too wide', size: 14 }],
      },
      source
    ),
    /文字标注超出/
  );
  const native = await PDFDocument.load(await source.arrayBuffer());
  native.getForm().getTextField('name').setMaxLength(8);
  const maxSource = await blob(native);
  const maxDocument = await c.importStudioPdf(maxSource, 'Maximum.pdf');
  maxDocument.fields = maxDocument.fields.map((field) =>
    field.name === 'name' ? { ...field, value: 'Longer than limit' } : field
  );
  await assert.rejects(c.exportStudioPdf(maxDocument, maxSource), /允许的文字长度/);
});

test('rejects encrypted PDFs, XFA, signatures, buttons, lists and field modes the model cannot preserve', async () => {
  const c = codec();
  const mutations = [
    (pdf) => {
      pdf.getForm().acroForm.dict.set(PDFName.of('XFA'), PDFString.of('<xfa/>'));
    },
    (pdf) => {
      pdf.getForm().createOptionList('list');
    },
    (pdf) => {
      pdf.getForm().createButton('button');
    },
    (pdf) => {
      pdf.getForm().getTextField('name').acroField.dict.set(PDFName.of('FT'), PDFName.of('Sig'));
    },
    (pdf) => {
      pdf.getForm().getTextField('name').enableRichFormatting();
    },
    (pdf) => {
      pdf.getForm().getTextField('name').enablePassword();
    },
    (pdf) => {
      pdf.getForm().getTextField('name').enableFileSelection();
    },
    (pdf) => {
      pdf.getForm().getDropdown('status').enableMultiselect();
    },
    (pdf) => {
      pdf.getForm().getDropdown('status').enableEditing();
    },
    (pdf) => {
      const field = pdf.getForm().getDropdown('status');
      field.acroField.setOptions([
        { value: PDFString.of('draft-id'), display: PDFString.of('Draft') },
      ]);
      field.acroField.dict.set(PDFName.of('V'), PDFString.of('draft-id'));
    },
    (pdf) => {
      pdf.getForm().getTextField('name').setText('Single\nLine');
    },
  ];
  const source = await original();
  for (const mutate of mutations) {
    const pdf = await PDFDocument.load(await source.arrayBuffer());
    mutate(pdf);
    await assert.rejects(
      c.importStudioPdf(await blob(pdf), 'Unsupported.pdf'),
      /不支持|不受支持|无法完整/
    );
  }
  const encrypted = await PDFDocument.load(await source.arrayBuffer());
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(
    encrypted.context.obj({ Filter: PDFName.of('Standard'), V: 1, R: 2, P: -4 })
  );
  const protectedSource = await blob(encrypted);
  await assert.rejects(c.importStudioPdf(protectedSource, 'Protected.pdf'), /已加密/);
  await assert.rejects(
    c.exportStudioPdf(await c.importStudioPdf(source, 'Original.pdf'), protectedSource),
    /已加密/
  );
  await assert.rejects(c.importStudioPdf(new Blob(['not a PDF']), 'Broken.pdf'), /损坏|格式/);
  await assert.rejects(c.importStudioPdf(new Blob([]), 'Empty.pdf'), /非空/);
  const oversized = await PDFDocument.create();
  for (let page = 0; page < 201; page += 1) oversized.addPage([100, 100]);
  await assert.rejects(c.importStudioPdf(await blob(oversized), 'Too many.pdf'), /200 页/);
});

test('exports rectangles and handwritten signatures as native vector instructions without replacing original page streams', async () => {
  const c = codec();
  const source = await original();
  const before = await PDFDocument.load(await source.arrayBuffer());
  const document = await c.importStudioPdf(source, 'Signed.pdf');
  document.marks = [
    {
      id: 'box',
      page: 0,
      type: 'rectangle',
      x: 100,
      y: 180,
      width: 64,
      height: 36,
      text: '',
      size: 16,
      lineWidth: 3,
      color: '#336699',
    },
    {
      id: 'signature',
      page: 1,
      type: 'ink',
      x: 50,
      y: 180,
      points: [
        [50, 200],
        [80, 180],
        [95, 205],
      ],
      text: '',
      size: 16,
      lineWidth: 2.5,
      color: '#253044',
    },
  ];
  const output = await c.exportStudioPdf(document, source);
  const after = await PDFDocument.load(await output.arrayBuffer());
  assert.equal(after.getPageCount(), 2);
  assert.equal(after.getPages()[0].getRotation().angle, 90);
  for (const index of [0, 1])
    for (const hash of streamHashes(before, index))
      assert.ok(streamHashes(after, index).includes(hash));
  const rectangle = pageInstructions(after, 0);
  assert.match(rectangle, /3 w/);
  assert.match(rectangle, /0\.2 0\.4 0\.6 RG/);
  const signature = pageInstructions(after, 1);
  assert.match(signature, /2\.5 w/);
  assert.match(signature, /1 J/);
  assert.match(signature, /1 j/);
  assert.match(signature, /50 200 m\s+80 180 l\s+95 205 l\s+S/);
  assert.equal(
    c.requests.length,
    0,
    'vector annotations do not request fonts or upload source files'
  );
  const reopened = await c.importStudioPdf(output, 'Reopened.pdf');
  assert.equal(reopened.fields.find((field) => field.name === 'name').value, 'Original');
  assert.equal(
    await c.exportStudioPdf(reopened, output),
    output,
    'reopening does not apply vector annotations a second time'
  );
});

test('rejects invalid signature points, drawing widths and strokes extending outside the visible crop box', async () => {
  const c = codec();
  const source = await original();
  const document = await c.importStudioPdf(source, 'Invalid drawing.pdf');
  const base = {
    id: 'ink',
    page: 0,
    type: 'ink',
    x: 70,
    y: 180,
    points: [
      [70, 180],
      [100, 200],
    ],
    text: '',
    size: 16,
    lineWidth: 2,
    color: '#253044',
  };
  const invalid = [
    { ...base, points: [] },
    { ...base, points: [[70, 180]] },
    {
      ...base,
      points: [
        [70, 180],
        [NaN, 200],
      ],
    },
    {
      ...base,
      points: [
        [70, 180],
        [30, 200],
      ],
    },
    {
      ...base,
      points: [
        [70, 180],
        [100, 601],
      ],
    },
    { ...base, points: Array.from({ length: 10001 }, () => [70, 180]) },
    { ...base, lineWidth: 0 },
    { ...base, lineWidth: 0.25 },
    { ...base, lineWidth: 41 },
    { ...base, type: 'rectangle', x: 30, width: 50, height: 20 },
    { ...base, type: 'rectangle', width: 400, height: 20 },
    { ...base, type: 'rectangle', width: -5, height: 20 },
  ];
  for (const mark of invalid)
    await assert.rejects(c.exportStudioPdf({ ...document, marks: [mark] }, source));
  assert.equal(
    (await c.exportStudioPdf({ ...document, marks: [base] }, source)).type,
    'application/pdf'
  );
  const tooMany = Array.from({ length: 11 }, (_, index) => ({
    ...base,
    id: `signature-${index}`,
    points: Array.from({ length: 10000 }, () => [70, 180]),
  }));
  await assert.rejects(c.exportStudioPdf({ ...document, marks: tooMany }, source), /100,000/);
});
