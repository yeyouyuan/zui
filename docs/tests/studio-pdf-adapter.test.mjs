import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const { AbortController, DOMException } = globalThis;

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const file = new URL(
  '../src/pages/collaboration/office-studio/studio-pdf-adapter.ts',
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
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture(options = {}) {
  const draws = [];
  const renders = [];
  const getPages = [];
  const viewports = [];
  const temporary = [];
  const ownerDocument = {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => (options.noTemporaryContext ? null : {}),
      };
      temporary.push(canvas);
      return canvas;
    },
  };
  const canvas = {
    width: 7,
    height: 9,
    ownerDocument,
    getContext: () =>
      options.noDestinationContext ? null : { drawImage: (image) => draws.push(image) },
  };
  const page = {
    rotate: options.pageRotation ?? 90,
    getViewport: ({ scale, rotation }) => {
      viewports.push({ scale, rotation });
      return {
        width: (options.width ?? 300) * scale,
        height: (options.height ?? 400) * scale,
        convertToPdfPoint: (x, y) => [40 + x / scale, 420 - y / scale],
        convertToViewportPoint: (x, y) => [(x - 40) * scale, (420 - y) * scale],
      };
    },
    render: (parameters) => {
      const pending = deferred();
      const record = { ...pending, parameters, cancellations: 0 };
      renders.push(record);
      return {
        promise: pending.promise,
        cancel: () => {
          record.cancellations += 1;
        },
      };
    },
    getTextContent: () =>
      options.textPromise ?? Promise.resolve(options.textContent ?? { items: [], styles: {} }),
  };
  const pdf = {
    numPages: options.pageCount ?? 2,
    getPage: (number) => {
      getPages.push(number);
      return options.pagePromise ?? Promise.resolve(page);
    },
  };
  let destroys = 0;
  const requests = [];
  const settings = {};
  const loading = {
    promise: options.loadError ? Promise.reject(options.loadError) : Promise.resolve(pdf),
    destroy: async () => {
      destroys += 1;
    },
  };
  const api = {
    GlobalWorkerOptions: settings,
    getDocument: (request) => {
      requests.push(request);
      return loading;
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Blob,
    Uint8Array,
    ArrayBuffer,
    Error,
    DOMException,
    devicePixelRatio: options.pixelRatio ?? 2,
    require: (name) =>
      name === 'pdfjs-dist'
        ? api
        : name.includes('pdf.worker')
          ? '/local-worker.mjs'
          : require(name),
  });
  return {
    ...exports,
    canvas,
    draws,
    renders,
    getPages,
    viewports,
    temporary,
    settings,
    requests,
    page,
    destroyCount: () => destroys,
  };
}
const source = () => new Blob(['%PDF-test'], { type: 'application/pdf' });
const next = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('loads local worker/assets and maps original plus additional rotation with CSS-pixel coordinates at device resolution', async () => {
  const f = fixture();
  const session = await f.studioPdfRenderer.load(source());
  assert.equal(session.pageCount, 2);
  assert.equal(f.settings.workerSrc, '/local-worker.mjs');
  assert.equal(f.requests[0].cMapUrl, '/test-base/office-pdf-assets/cmaps/');
  assert.equal(f.requests[0].wasmUrl, '/test-base/office-pdf-assets/wasm/');
  const pending = session.render(0, f.canvas, { scale: 1, rotation: 90 });
  await next();
  assert.deepEqual(f.getPages, [1]);
  assert.deepEqual(f.viewports, [{ scale: 1, rotation: 180 }]);
  assert.equal(f.temporary[0].width, 600);
  assert.equal(f.temporary[0].height, 800);
  assert.equal(f.draws.length, 0);
  f.renders[0].resolve();
  const result = await pending;
  assert.equal(f.canvas.width, 600);
  assert.equal(f.canvas.height, 800);
  assert.equal(result.width, 300);
  assert.equal(result.height, 400);
  assert.deepEqual(Array.from(result.toPdfPoint(100, 200)), [140, 220]);
  assert.deepEqual(Array.from(result.toViewportPoint(140, 220)), [100, 200]);
  await session.destroy();
  await session.destroy();
  assert.equal(f.destroyCount(), 1);
});

test('a late completed old render cannot overwrite the newer page on the same destination canvas', async () => {
  const f = fixture();
  const session = await f.studioPdfRenderer.load(source());
  const first = session.render(0, f.canvas, { scale: 1, rotation: 0 });
  const firstRejected = assert.rejects(first, { name: 'AbortError' });
  await next();
  const second = session.render(1, f.canvas, { scale: 1.5, rotation: 0 });
  await next();
  assert.equal(f.renders[0].cancellations, 1);
  f.renders[1].resolve();
  const result = await second;
  assert.equal(result.width, 450);
  assert.equal(f.draws.length, 1);
  assert.equal(f.draws[0], f.temporary[1]);
  f.renders[0].resolve();
  await firstRejected;
  assert.equal(f.draws.length, 1);
  assert.equal(f.canvas.width, 900);
  await session.destroy();
});

test('independent thumbnail and page canvases do not cancel each other, and cancelling a thumbnail leaves the main render active', async () => {
  const f = fixture();
  const session = await f.studioPdfRenderer.load(source());
  const thumbnailDraws = [];
  const thumbnail = {
    ...f.canvas,
    getContext: () => ({ drawImage: (image) => thumbnailDraws.push(image) }),
  };
  const controller = new AbortController();
  const main = session.render(0, f.canvas, { scale: 1, rotation: 0 });
  const preview = session.render(1, thumbnail, {
    scale: 0.25,
    rotation: 0,
    signal: controller.signal,
  });
  const rejected = assert.rejects(preview, { name: 'AbortError' });
  await next();
  assert.equal(f.renders[0].cancellations, 0);
  assert.equal(f.renders[1].cancellations, 0);
  assert.notEqual(f.renders[0].parameters.canvas, f.renders[1].parameters.canvas);
  controller.abort();
  assert.equal(f.renders[0].cancellations, 0);
  assert.equal(f.renders[1].cancellations, 1);
  f.renders[1].resolve();
  await rejected;
  assert.equal(thumbnailDraws.length, 0);
  f.renders[0].resolve();
  assert.equal((await main).width, 300);
  assert.equal(f.draws.length, 1);
  await session.destroy();
});

test('aborting during page loading prevents task creation; disposal cancels pending tasks and prevents canvas writes', async () => {
  const pageWait = deferred();
  const f = fixture({ pagePromise: pageWait.promise });
  const session = await f.studioPdfRenderer.load(source());
  const controller = new AbortController();
  const first = session.render(0, f.canvas, { scale: 1, rotation: 0, signal: controller.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  pageWait.resolve(f.page);
  await rejected;
  assert.equal(f.renders.length, 0);
  const second = session.render(1, f.canvas, { scale: 1, rotation: 0 });
  const cancelled = assert.rejects(second, { name: 'AbortError' });
  await next();
  await session.destroy();
  assert.equal(f.renders[0].cancellations, 1);
  f.renders[0].resolve();
  await cancelled;
  assert.equal(f.draws.length, 0);
  assert.equal(f.canvas.width, 7);
  await assert.rejects(session.render(0, f.canvas, { scale: 1, rotation: 0 }), {
    name: 'AbortError',
  });
});

test('rejects invalid page, zoom, rotation, page dimensions and unavailable contexts before committing a canvas', async () => {
  const f = fixture();
  const session = await f.studioPdfRenderer.load(source());
  for (const [page, scale, rotation] of [
    [-1, 1, 0],
    [2, 1, 0],
    [0.5, 1, 0],
    [0, NaN, 0],
    [0, 0.1, 0],
    [0, 1, 45],
  ])
    await assert.rejects(session.render(page, f.canvas, { scale, rotation }));
  assert.equal(f.getPages.length, 0);
  await session.destroy();
  for (const options of [
    { width: 20000 },
    { height: Infinity },
    { width: 5000, height: 5000 },
    { noTemporaryContext: true },
  ]) {
    const guarded = fixture(options);
    const loaded = await guarded.studioPdfRenderer.load(source());
    await assert.rejects(loaded.render(0, guarded.canvas, { scale: 1, rotation: 0 }));
    assert.equal(guarded.draws.length, 0);
    assert.equal(guarded.canvas.width, 7);
    await loaded.destroy();
  }
  const destination = fixture({ noDestinationContext: true });
  const loaded = await destination.studioPdfRenderer.load(source());
  const rendering = loaded.render(0, destination.canvas, { scale: 1, rotation: 0 });
  const rejected = assert.rejects(rendering, /无法显示 PDF 画布/);
  await next();
  destination.renders[0].resolve();
  await rejected;
  assert.equal(destination.canvas.width, 7);
  await loaded.destroy();
});

test('encrypted loading errors and unsupported page counts dispose the PDF.js loading task', async () => {
  const error = new Error('Password required');
  error.name = 'PasswordException';
  const protectedPdf = fixture({ loadError: error });
  await assert.rejects(protectedPdf.studioPdfRenderer.load(source()), /已加密/);
  assert.equal(protectedPdf.destroyCount(), 1);
  const tooMany = fixture({ pageCount: 201 });
  await assert.rejects(tooMany.studioPdfRenderer.load(source()), /200 页/);
  assert.equal(tooMany.destroyCount(), 1);
  const empty = fixture();
  await assert.rejects(empty.studioPdfRenderer.load(new Blob([])), /非空/);
  assert.equal(empty.requests.length, 0);
});

test('finds text across formatting runs and returns original PDF rectangles for horizontal and rotated text', async () => {
  const f = fixture({
    textContent: {
      items: [
        {
          str: 'Re',
          width: 12,
          height: 12,
          transform: [12, 0, 0, 12, 40, 200],
          fontName: 'normal',
          hasEOL: false,
        },
        {
          str: 'view',
          width: 24,
          height: 12,
          transform: [12, 0, 0, 12, 52, 200],
          fontName: 'bold',
          hasEOL: true,
        },
        {
          str: 'Budget',
          width: 36,
          height: 12,
          transform: [0, 12, -12, 0, 200, 40],
          fontName: 'normal',
          hasEOL: true,
        },
      ],
      styles: { normal: { ascent: 0.8, descent: -0.2 }, bold: { ascent: 0.8, descent: -0.2 } },
    },
  });
  const session = await f.studioPdfRenderer.load(source());
  const matches = await session.search('ＲＥＶＩＥＷ');
  assert.equal(matches.length, 2);
  assert.deepEqual(
    Array.from(matches, (result) => result.page),
    [0, 1]
  );
  assert.equal(matches[0].rect.x, 40);
  assert.ok(Math.abs(matches[0].rect.y - 197.6) < 0.001);
  assert.equal(matches[0].rect.width, 36);
  assert.equal(matches[0].rect.height, 12);
  const rotated = await session.search('budget');
  assert.equal(rotated.length, 2);
  assert.ok(Math.abs(rotated[0].rect.x - 190.4) < 0.001);
  assert.equal(rotated[0].rect.y, 40);
  assert.equal(rotated[0].rect.width, 12);
  assert.equal(rotated[0].rect.height, 36);
  assert.equal(f.getPages.length, 2, 'the second query reuses successfully extracted text');
  assert.equal(f.renders.length, 0, 'search does not render or overwrite any canvas');
  await session.destroy();
});

test('aborting or destroying a search during extraction prevents stale results and further page loads', async () => {
  for (const mode of ['abort', 'destroy']) {
    const extraction = deferred();
    const f = fixture({ textPromise: extraction.promise });
    const session = await f.studioPdfRenderer.load(source());
    const controller = new AbortController();
    const searching = session.search('word', { signal: controller.signal });
    const rejected = assert.rejects(searching, { name: 'AbortError' });
    await next();
    if (mode === 'abort') controller.abort();
    else await session.destroy();
    extraction.resolve({
      items: [
        { str: 'word', width: 24, height: 12, transform: [12, 0, 0, 12, 40, 200], fontName: 'F' },
      ],
      styles: {},
    });
    await rejected;
    assert.equal(f.getPages.length, 1);
    assert.equal(f.renders.length, 0);
    await session.destroy();
    await assert.rejects(session.search('word'), { name: 'AbortError' });
  }
});

test('limits queries, extraction and result counts without rendering or loading unnecessary pages', async () => {
  const f = fixture({
    textContent: {
      items: [
        {
          str: 'x '.repeat(1500),
          width: 100,
          height: 12,
          transform: [12, 0, 0, 12, 40, 200],
          fontName: 'F',
        },
      ],
      styles: {},
    },
  });
  const session = await f.studioPdfRenderer.load(source());
  assert.deepEqual(Array.from(await session.search('   ')), []);
  await assert.rejects(session.search('x'.repeat(257)), /256/);
  assert.equal(f.getPages.length, 0);
  const results = await session.search('x');
  assert.equal(results.length, 1000);
  assert.equal(f.getPages.length, 1);
  assert.equal(f.renders.length, 0);
  await session.destroy();
  const tooLarge = fixture({
    textContent: {
      items: [
        {
          str: 'a'.repeat(1_000_001),
          width: 100,
          height: 12,
          transform: [12, 0, 0, 12, 40, 200],
          fontName: 'F',
        },
      ],
      styles: {},
    },
  });
  const guarded = await tooLarge.studioPdfRenderer.load(source());
  await assert.rejects(guarded.search('word'), /页面文字过多/);
  await guarded.destroy();
});

test('searches actual PDF.js extracted page text from a real generated PDF', async () => {
  globalThis.DOMMatrix ??= class DOMMatrix {};
  Promise.withResolvers ??= function () {
    let resolve;
    let reject;
    const promise = new this((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([400, 600]);
  first.drawText('Review packet', { x: 40, y: 500, size: 14, font });
  const second = pdf.addPage([400, 600]);
  second.setRotation(degrees(90));
  second.drawText('Another review', { x: 70, y: 300, size: 18, font });
  const actualSource = new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Blob,
    Uint8Array,
    ArrayBuffer,
    Error,
    DOMException,
    require: (name) =>
      name === 'pdfjs-dist'
        ? {
            GlobalWorkerOptions: pdfjs.GlobalWorkerOptions,
            getDocument: (options) =>
              pdfjs.getDocument({ ...options, useSystemFonts: true, isEvalSupported: false }),
          }
        : name.includes('pdf.worker')
          ? new URL(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'file:').href
          : require(name),
  });
  const session = await exports.studioPdfRenderer.load(actualSource);
  const results = await session.search('review');
  assert.equal(results.length, 2);
  assert.deepEqual(
    Array.from(results, (result) => result.page),
    [0, 1]
  );
  assert.equal(results[0].rect.x, 40);
  assert.equal(results[1].rect.x, 70, 'page rotation does not alter the stored PDF coordinates');
  assert.ok(results[0].rect.width > 20 && results[0].rect.height > 10);
  assert.ok(results[1].rect.y < 300 && results[1].rect.y + results[1].rect.height > 300);
  await session.destroy();
});
