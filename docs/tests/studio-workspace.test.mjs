/* global Blob, structuredClone, URL, setTimeout, clearTimeout */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { officeRuleConsumerLines } from '../../scripts/office-consumer-fixture.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
const sourceModules = new Map();
function loadSource(source, overrides = {}, sourceUrl) {
  const localHelper = sourceUrl?.pathname.includes('/packages/ui/src/components/OfficeStudio/');
  if (localHelper && sourceModules.has(sourceUrl.href))
    return sourceModules.get(sourceUrl.href).exports;
  const module = { exports: {} };
  if (localHelper) sourceModules.set(sourceUrl.href, module);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      const override = overrides[name];
      if (override !== undefined) return override;
      if (sourceUrl && name.startsWith('.')) {
        const dependency = new URL(`${name}${name.endsWith('.ts') ? '' : '.ts'}`, sourceUrl);
        if (dependency.pathname.includes('/packages/ui/src/components/OfficeStudio/'))
          return load(dependency.href);
      }
      return (localHelper ? createRequire(sourceUrl) : require)(name);
    },
    Error,
    Blob,
    Date,
    Map,
    Set,
    URL,
    structuredClone,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
  });
  return module.exports;
}
function load(relative, overrides = {}) {
  const source = new URL(relative, import.meta.url);
  return loadSource(readFileSync(source, 'utf8'), overrides, source);
}
const models = load('../../packages/ui/src/components/OfficeStudio/studio-model.ts');
const { createStudioStorage, StudioStorageConflict } = load(
  '../src/pages/collaboration/office-studio/studio-storage.ts',
  { '@zui/react': models }
);
const { StudioWorkspace } = load('../src/pages/collaboration/office-studio/studio-workspace.ts');
const document = () => structuredClone(models.createOfficeStudioDocument('word'));
const excelDocument = () =>
  structuredClone(loadSource(officeRuleConsumerLines().join('\n')).officeRuleDocument);
const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function unpreparedExcel() {
  const doc = excelDocument();
  doc.sheets.forEach((sheet, index) => {
    sheet.id = `xlsx-sheet-${index + 1}`;
    delete sheet.hyperlinks;
  });
  doc.activeSheetId = doc.sheets[0].id;
  return doc;
}
function preparation(hydrate, onLoad = () => {}) {
  const overrides = {};
  Object.defineProperty(overrides, './studio-excel-codec', {
    get: () => {
      onLoad();
      return { hydrateStudioExcelHyperlinks: hydrate };
    },
  });
  return load('../src/pages/collaboration/office-studio/studio-prepare.ts', overrides)
    .prepareStudioFile;
}
function record(doc, revision = 1) {
  return {
    id: doc.id,
    document: doc,
    revision,
    source: new Blob(['original file']),
    savedAt: Date.now(),
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function memory(prepareDocument) {
  const files = new Map();
  const commits = [];
  let activeId = null;
  const f = {
    files,
    commits,
    beforeCommit: async () => {},
    beforeLoad: async () => {},
    beforeSelect: async () => {},
    fail: null,
  };
  f.storage = {
    list: async () => [...files.values()].map((file) => structuredClone(file)),
    load: async (id) => {
      await f.beforeLoad(id);
      return files.has(id) ? structuredClone(files.get(id)) : undefined;
    },
    activeId: async () => activeId,
    select: async (id) => {
      await f.beforeSelect(id);
      activeId = id;
    },
    commit: async (file, revision) => {
      commits.push(structuredClone(file));
      await f.beforeCommit(file);
      if (f.fail) throw f.fail;
      if ((files.get(file.id)?.revision ?? 0) !== revision) throw new StudioStorageConflict();
      files.set(file.id, structuredClone(file));
      activeId = file.id;
    },
  };
  f.workspace = new StudioWorkspace(f.storage, -1, prepareDocument);
  return f;
}

test('IndexedDB restores the real document JSON and Blob only after its commit, and rejects stale revisions', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const first = record(document());
  await storage.commit(first, 0);
  const restored = await storage.load(first.id);
  assert.equal(
    restored.document.content.content[1].content[0].text,
    first.document.content.content[1].content[0].text
  );
  assert.equal(await restored.source.text(), 'original file');
  assert.equal(restored.revision, 1);
  assert.equal(await storage.activeId(), first.id);
  await assert.rejects(
    storage.commit(
      { ...first, revision: 2, document: { ...first.document, name: 'old tab.docx' } },
      0
    ),
    /保存记录无效/
  );
  await storage.commit(
    { ...first, revision: 2, document: { ...first.document, name: 'new tab.docx' } },
    1
  );
  await assert.rejects(
    storage.commit(
      { ...first, revision: 2, document: { ...first.document, name: 'stale tab.docx' } },
      1
    ),
    /另一页面/
  );
  assert.equal((await storage.load(first.id)).document.name, 'new tab.docx');
});

test('concurrent IndexedDB writers cannot silently replace the same document revision', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const first = record(document());
  await storage.commit(first, 0);
  const outcomes = await Promise.allSettled([
    storage.commit({ ...first, revision: 2, document: { ...first.document, name: 'A.docx' } }, 1),
    storage.commit({ ...first, revision: 2, document: { ...first.document, name: 'B.docx' } }, 1),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  assert.equal((await storage.load(first.id)).revision, 2);
});

test('IndexedDB preserves every supported conditional-format and validation shape across saves and database reopen', async () => {
  const factory = new IDBFactory();
  const storage = createStudioStorage(factory);
  const first = { ...record(excelDocument()), source: new Blob(['rules-source-before']) };
  assert.equal(
    new Set(first.document.sheets[0].conditionalFormats.map((rule) => rule.type)).size,
    8
  );
  assert.equal(new Set(first.document.sheets[0].dataValidations.map((rule) => rule.type)).size, 7);
  await storage.commit(first, 0);
  const loaded = await storage.load(first.id);
  assert.deepEqual(loaded.document, first.document);
  assert.equal(await loaded.source.text(), 'rules-source-before');
  loaded.document.sheets[0].conditionalFormats[0].style.color = '#000000';
  loaded.document.sheets[0].dataValidations[0].values.push('detached value');
  assert.deepEqual((await storage.load(first.id)).document, first.document);

  const updated = structuredClone(first.document);
  updated.sheets[0].conditionalFormats[0].formulae[1] = '50';
  updated.sheets[0].dataValidations[2].formula2 = '50';
  updated.sheets[0].cells.C2.input = '25';
  await storage.commit(
    { ...first, revision: 2, document: updated, source: new Blob(['rules-source-after']) },
    1
  );
  const reopened = createStudioStorage(factory);
  const latest = await reopened.load(first.id);
  assert.deepEqual(latest.document, updated);
  assert.equal(await latest.source.text(), 'rules-source-after');
  const historical = await reopened.loadVersion(first.id, 1);
  assert.deepEqual(historical.document, first.document);
  assert.equal(await historical.source.text(), 'rules-source-before');
  assert.equal((await reopened.listVersions(first.id)).length, 1);
});

test('IndexedDB history restores all Excel rules as a new workbook while keeping the latest rules and original bytes', async () => {
  const factory = new IDBFactory();
  const storage = createStudioStorage(factory);
  const original = excelDocument();
  const current = structuredClone(original);
  current.name = 'current-rules.xlsx';
  current.sheets[0].conditionalFormats = [
    {
      ...current.sheets[0].conditionalFormats[0],
      id: 'current-rule',
      formulae: ['25', '75'],
    },
  ];
  current.sheets[0].dataValidations = [
    {
      id: 'current-limit',
      range: 'C2:C10',
      type: 'whole',
      operator: 'between',
      formula1: '25',
      formula2: '75',
      errorStyle: 'warning',
    },
  ];
  current.sheets[0].cells.C2.input = '50';
  await storage.commit({ ...record(original), source: new Blob(['historical-xlsx-bytes']) }, 0);
  await storage.commit({ ...record(current, 2), source: new Blob(['current-xlsx-bytes']) }, 1);
  const workspace = new StudioWorkspace(storage, -1);
  await workspace.start();
  assert.equal(workspace.getSnapshot().active.document.name, current.name);
  const version = await workspace.version(1);
  assert.deepEqual(version.document, original);
  assert.equal(await version.source.text(), 'historical-xlsx-bytes');
  await workspace.restoreVersion(1);
  const restored = workspace.getSnapshot().active;
  assert.notEqual(restored.id, original.id);
  assert.equal(restored.document.id, restored.id);
  assert.match(restored.document.name, /版本1\.xlsx$/);
  assert.deepEqual(restored.document.sheets, original.sheets);
  assert.equal(await restored.source.text(), 'historical-xlsx-bytes');
  const savedCopy = await storage.load(restored.id);
  assert.deepEqual(savedCopy.document.sheets, original.sheets);
  assert.equal(savedCopy.revision, 1);
  const savedCurrent = await storage.load(original.id);
  assert.deepEqual(savedCurrent.document, current);
  assert.equal(await savedCurrent.source.text(), 'current-xlsx-bytes');
  assert.deepEqual((await storage.loadVersion(original.id, 1)).document, original);
  assert.equal((await storage.listVersions(original.id)).length, 1);
  assert.equal(workspace.getSnapshot().files.length, 2);

  const reopened = new StudioWorkspace(createStudioStorage(factory), -1);
  await reopened.start();
  assert.equal(reopened.getSnapshot().active.id, restored.id);
  assert.deepEqual(reopened.getSnapshot().active.document.sheets, original.sheets);
  assert.equal(await reopened.getSnapshot().active.source.text(), 'historical-xlsx-bytes');
});

test('unsupported persisted Excel rules reject atomically without replacing the current model or writing history', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const first = record(excelDocument());
  await storage.commit(first, 0);
  const unknown = structuredClone(first.document);
  unknown.sheets[0].conditionalFormats[0].type = 'iconSet';
  const dynamic = structuredClone(first.document);
  dynamic.sheets[0].dataValidations[1].source = '=INDIRECT("Choices!A1:A3")';
  for (const invalid of [unknown, dynamic]) {
    await assert.rejects(
      storage.commit({ ...first, revision: 2, document: invalid }, 1),
      /保存记录无效/
    );
    assert.deepEqual((await storage.load(first.id)).document, first.document);
    assert.equal((await storage.load(first.id)).revision, 1);
    assert.equal((await storage.listVersions(first.id)).length, 0);
  }
});

test('save completion retains new input and the next save uses the committed revision', async () => {
  const f = memory();
  const original = document();
  await f.workspace.start();
  await f.workspace.add(original, new Blob(['source']));
  f.workspace.edit({ ...original, name: '第一次.docx' });
  const release = deferred();
  const started = deferred();
  f.beforeCommit = async () => {
    started.resolve();
    await release.promise;
  };
  const saving = f.workspace.save();
  await started.promise;
  f.workspace.edit({ ...original, name: '保存中的新输入.docx' });
  release.resolve();
  await saving;
  assert.equal(f.workspace.getSnapshot().active.document.name, '保存中的新输入.docx');
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(f.files.get(original.id).document.name, '第一次.docx');
  f.beforeCommit = async () => {};
  await f.workspace.flush();
  assert.equal(f.files.get(original.id).document.name, '保存中的新输入.docx');
  assert.equal(f.files.get(original.id).revision, 3);
  assert.equal(f.workspace.getSnapshot().saveState, 'saved');
});

test('switching waits for existing persistence and saves the next snapshot before replacing the canvas', async () => {
  const f = memory();
  const first = document();
  const second = document();
  await f.workspace.start();
  await f.workspace.add(first);
  await f.workspace.add(second);
  f.workspace.edit({ ...second, name: 'pending.docx' });
  const release = deferred();
  const started = deferred();
  f.beforeCommit = async () => {
    started.resolve();
    await release.promise;
  };
  const saving = f.workspace.save();
  await started.promise;
  const switching = f.workspace.select(first.id);
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
  release.resolve();
  await Promise.all([saving, switching]);
  assert.equal(f.files.get(second.id).document.name, 'pending.docx');
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
});

test('storage failure keeps editing data and source exportable; retry persists the newest content', async () => {
  const f = memory();
  const first = document();
  await f.workspace.start();
  await f.workspace.add(first, new Blob(['original PDF or XLSX bytes']));
  f.workspace.edit({ ...first, name: '不可丢失.docx' });
  f.fail = new Error('quota exceeded');
  await assert.rejects(f.workspace.flush(), /quota exceeded/);
  const snapshot = await f.workspace.exportSnapshot();
  assert.equal(snapshot.document.name, '不可丢失.docx');
  assert.equal(await snapshot.source.text(), 'original PDF or XLSX bytes');
  assert.equal(f.workspace.getSnapshot().saveState, 'error');
  await assert.rejects(f.workspace.add(document()), /quota exceeded/);
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  f.fail = null;
  f.workspace.edit({ ...first, name: '重试后的新内容.docx' });
  await f.workspace.flush();
  assert.equal(f.files.get(first.id).document.name, '重试后的新内容.docx');
});

test('explicit save copy resolves a cross-tab conflict without overwriting the other document', async () => {
  const f = memory();
  const first = document();
  await f.workspace.start();
  await f.workspace.add(first);
  f.files.set(first.id, {
    ...f.files.get(first.id),
    revision: 2,
    document: { ...first, name: '另一页面.docx' },
  });
  f.workspace.edit({ ...first, name: '我的修改.docx' });
  await assert.rejects(f.workspace.flush(), /另一页面/);
  await f.workspace.saveCopy();
  const copy = f.workspace.getSnapshot().active;
  assert.notEqual(copy.id, first.id);
  assert.equal(copy.document.name, '我的修改 - 副本.docx');
  assert.equal(f.files.get(first.id).document.name, '另一页面.docx');
  assert.equal(f.files.get(copy.id).revision, 1);
});

test('saved files restore their latest active document and remain independent from the old officeDrafts database', async () => {
  const f = memory();
  const first = document();
  await f.workspace.start();
  await f.workspace.add(first, new Blob(['file']));
  f.workspace.edit({ ...first, name: '恢复这份.docx' });
  await f.workspace.flush();
  const restored = new StudioWorkspace(f.storage, -1);
  await restored.start();
  assert.equal(restored.getSnapshot().active.document.name, '恢复这份.docx');
  assert.equal(await restored.getSnapshot().active.source.text(), 'file');
  assert.equal(restored.getSnapshot().files.length, 1);
});

test('failed restoration rejects initialization and a new start can recover the existing files', async () => {
  const f = memory();
  const first = record(document());
  f.files.set(first.id, first);
  await f.storage.select(first.id);
  const list = f.storage.list;
  let reads = 0;
  f.storage.list = async () => {
    if (++reads === 1) throw new Error('restore unavailable');
    return list();
  };
  let initialized = false;
  const starting = f.workspace.start();
  assert.equal(f.workspace.start(), starting);
  await assert.rejects(
    starting.then(() => {
      initialized = true;
    }),
    /restore unavailable/
  );
  assert.equal(initialized, false);
  assert.equal(f.workspace.getSnapshot().active, null);
  assert.equal(f.workspace.getSnapshot().saveState, 'error');
  assert.equal(f.files.size, 1);
  assert.equal(f.commits.length, 0);
  const retry = f.workspace.start();
  assert.equal(f.workspace.getSnapshot().status, 'loading');
  await retry;
  assert.equal(reads, 2);
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.workspace.getSnapshot().saveState, 'saved');
  assert.equal(f.workspace.getSnapshot().error, '');
  assert.equal(await f.workspace.getSnapshot().active.source.text(), 'original file');
  await f.workspace.start();
  assert.equal(reads, 2);
});

test('input entered while the next document loads stays dirty in the current canvas', async () => {
  const f = memory();
  const first = document();
  const second = document();
  await f.workspace.start();
  await f.workspace.add(first);
  await f.workspace.add(second);
  await f.workspace.select(first.id);
  const release = deferred();
  const loading = deferred();
  f.beforeLoad = async (id) => {
    if (id !== second.id) return;
    loading.resolve();
    await release.promise;
  };
  const switching = f.workspace.select(second.id);
  await loading.promise;
  f.workspace.edit({ ...first, name: '读取期间的新输入.docx' });
  const rejected = assert.rejects(switching, /切换期间有新输入/);
  release.resolve();
  await rejected;
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.workspace.getSnapshot().active.document.name, '读取期间的新输入.docx');
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.get(first.id).document.name, first.name);
  assert.equal((await f.workspace.exportSnapshot()).document.name, '读取期间的新输入.docx');
  await f.workspace.select(second.id);
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
  assert.equal(f.files.get(first.id).document.name, '读取期间的新输入.docx');
});

test('input entered during the active preference transaction cancels the switch and restores the preference', async () => {
  const f = memory();
  const first = document();
  const second = document();
  await f.workspace.start();
  await f.workspace.add(first);
  await f.workspace.add(second);
  await f.workspace.select(first.id);
  const release = deferred();
  const selecting = deferred();
  f.beforeSelect = async (id) => {
    if (id !== second.id) return;
    selecting.resolve();
    await release.promise;
  };
  const switching = f.workspace.select(second.id);
  await selecting.promise;
  f.workspace.edit({ ...first, name: '位置提交期间的新输入.docx' });
  const rejected = assert.rejects(switching, /切换期间有新输入/);
  release.resolve();
  await rejected;
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.workspace.getSnapshot().active.document.name, '位置提交期间的新输入.docx');
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.get(first.id).document.name, first.name);
  await f.workspace.select(second.id);
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
  assert.equal(f.files.get(first.id).document.name, '位置提交期间的新输入.docx');
});

test('concurrent file replacements reject without changing either canvas and release their lock afterward', async () => {
  const f = memory();
  const first = document();
  const second = document();
  const third = document();
  await f.workspace.start();
  await f.workspace.add(first);
  await f.workspace.add(second);
  await f.workspace.add(third);
  await f.workspace.select(first.id);
  const release = deferred();
  const loading = deferred();
  f.beforeLoad = async (id) => {
    if (id !== second.id) return;
    loading.resolve();
    await release.promise;
  };
  const switching = f.workspace.select(second.id);
  await loading.promise;
  await assert.rejects(f.workspace.select(third.id), /正在切换文档/);
  await assert.rejects(f.workspace.add(document()), /正在切换文档/);
  await assert.rejects(f.workspace.saveCopy(), /正在切换文档/);
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.files.size, 3);
  release.resolve();
  await switching;
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
  await f.workspace.select(third.id);
  assert.equal(f.workspace.getSnapshot().active.id, third.id);
});

test('an imported document remains exportable after its first commit fails and a retry leaves the old file intact', async () => {
  const f = memory();
  const first = document();
  const imported = document();
  await f.workspace.start();
  await f.workspace.add(first);
  f.fail = new Error('quota exceeded');
  await assert.rejects(f.workspace.add(imported, new Blob(['imported bytes'])), /quota exceeded/);
  const current = await f.workspace.exportSnapshot();
  assert.equal(current.id, imported.id);
  assert.equal(current.revision, 0);
  assert.equal(await current.source.text(), 'imported bytes');
  assert.equal(f.workspace.getSnapshot().saveState, 'error');
  assert.equal(f.files.has(imported.id), false);
  assert.equal(f.files.get(first.id).document.name, first.name);
  f.fail = null;
  await f.workspace.flush();
  assert.equal(f.files.get(imported.id).revision, 1);
  assert.equal(f.files.get(first.id).document.name, first.name);
});

test('history retains the twenty most recent committed models with their original bytes and ignores stale writers', async () => {
  const factory = new IDBFactory();
  const storage = createStudioStorage(factory);
  const first = record(document());
  await storage.commit(first, 0);
  for (let revision = 2; revision <= 25; revision++)
    await storage.commit(
      {
        ...first,
        revision,
        source: new Blob([`source-${revision}`]),
        document: { ...first.document, name: `修订${revision}.docx` },
      },
      revision - 1
    );
  const versions = await storage.listVersions(first.id);
  assert.equal(versions.length, 20);
  assert.equal(versions[0].revision, 24);
  assert.equal(versions.at(-1).revision, 5);
  const old = await storage.loadVersion(first.id, 24);
  assert.equal(old.document.name, '修订24.docx');
  assert.equal(await old.source.text(), 'source-24');
  assert.equal(await storage.loadVersion(first.id, 1), undefined);
  await assert.rejects(storage.commit({ ...first, revision: 25 }, 24), /另一页面/);
  assert.equal((await storage.load(first.id)).document.name, '修订25.docx');
  assert.equal((await storage.listVersions(first.id)).length, 20);
  const reopened = createStudioStorage(factory);
  assert.equal((await reopened.loadVersion(first.id, 24)).document.name, '修订24.docx');
});

test('version restoration creates a separate document while keeping the latest saved file and source intact', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const workspace = new StudioWorkspace(storage, -1);
  const first = document();
  await workspace.start();
  await workspace.add(first, new Blob(['original source']));
  workspace.edit({ ...first, name: '最新内容.docx' });
  await workspace.flush();
  assert.equal((await workspace.versions())[0].revision, 1);
  assert.equal((await workspace.version(1)).document.name, first.name);
  await workspace.restoreVersion(1);
  const restored = workspace.getSnapshot().active;
  assert.notEqual(restored.id, first.id);
  assert.equal(restored.document.id, restored.id);
  assert.match(restored.document.name, /版本1\.docx$/);
  assert.equal(await restored.source.text(), 'original source');
  assert.equal((await storage.load(first.id)).document.name, '最新内容.docx');
  assert.equal(workspace.getSnapshot().files.length, 2);
});

test('new input while loading a historical version cancels restoration without replacing the current canvas', async () => {
  const f = memory();
  const first = document();
  await f.workspace.start();
  await f.workspace.add(first);
  const release = deferred();
  const loading = deferred();
  f.storage.loadVersion = async () => {
    loading.resolve();
    await release.promise;
    return record(first);
  };
  const restoring = f.workspace.restoreVersion(1);
  await loading.promise;
  f.workspace.edit({ ...first, name: '读取历史期间输入.docx' });
  const rejected = assert.rejects(restoring, /历史版本期间有新输入/);
  release.resolve();
  await rejected;
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.workspace.getSnapshot().active.document.name, '读取历史期间输入.docx');
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(f.files.size, 1);
});

test('upgrading the original database preserves existing files and starts an empty history', async () => {
  const factory = new IDBFactory();
  const first = record(document());
  await new Promise((resolve, reject) => {
    const request = factory.open('zui-office-studio', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath: 'id' });
      request.result.createObjectStore('preferences');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files', 'preferences'], 'readwrite');
      transaction.objectStore('files').put(first);
      transaction.objectStore('preferences').put(first.id, 'active');
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onabort = () => reject(transaction.error);
    };
  });
  const storage = createStudioStorage(factory);
  assert.equal((await storage.load(first.id)).document.name, first.document.name);
  assert.equal((await storage.listVersions(first.id)).length, 0);
  await storage.commit({ ...first, revision: 2 }, 1);
  assert.equal((await storage.listVersions(first.id))[0].revision, 1);
});

test('a synchronously denied database open can be retried after permission changes', async () => {
  const factory = new IDBFactory();
  let attempts = 0;
  const storage = createStudioStorage({
    open: (...args) => {
      if (++attempts === 1) throw new Error('storage denied');
      return factory.open(...args);
    },
  });
  await assert.rejects(storage.list(), /storage denied/);
  assert.equal((await storage.list()).length, 0);
  assert.equal(attempts, 2);
});

test('a data clone failure aborts both history and current-file writes', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const first = record(document());
  await storage.commit(first, 0);
  const invalid = {
    ...first,
    revision: 2,
    document: {
      ...first.document,
      content: { type: 'doc', attrs: { broken: () => {} }, content: [{ type: 'paragraph' }] },
    },
  };
  await assert.rejects(storage.commit(invalid, 1), /cloned|clone|写入/);
  assert.equal((await storage.load(first.id)).revision, 1);
  assert.equal((await storage.listVersions(first.id)).length, 0);
});

test('the conflict-copy action respects the same document limit as new files and history restoration', async () => {
  const f = memory();
  for (let index = 0; index < 100; index++) {
    const file = record(document());
    f.files.set(file.id, file);
  }
  await f.workspace.start();
  const active = f.workspace.getSnapshot().active;
  await assert.rejects(f.workspace.saveCopy(), /100 份/);
  assert.equal(f.workspace.getSnapshot().active.id, active.id);
  assert.equal(f.files.size, 100);
  assert.equal(f.commits.length, 0);
});

test('workspace preparation visits only the active, selected, and newly added files before publishing them', async () => {
  const prepared = [];
  const f = memory(async (file) => {
    prepared.push({ id: file.id, source: await file.source.text() });
    return { ...file.document, name: `prepared-${file.document.name}` };
  });
  const first = record(document());
  const second = record(document());
  first.source = new Blob(['first-source']);
  second.source = new Blob(['second-source']);
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  await f.storage.select(first.id);
  await f.workspace.start();
  assert.deepEqual(prepared, [{ id: first.id, source: 'first-source' }]);
  assert.equal(f.workspace.getSnapshot().active.document.name, `prepared-${first.document.name}`);
  assert.equal(f.workspace.getSnapshot().files.length, 2);
  assert.equal(f.commits.length, 0);
  await f.workspace.select(first.id);
  assert.equal(prepared.length, 1);
  await f.workspace.select(second.id);
  assert.deepEqual(prepared.at(-1), { id: second.id, source: 'second-source' });
  assert.equal(f.workspace.getSnapshot().active.document.name, `prepared-${second.document.name}`);
  assert.equal(f.files.get(second.id).document.name, second.document.name);
  const added = document();
  await f.workspace.add(added, new Blob(['added-source']));
  assert.deepEqual(
    prepared.map((file) => file.id),
    [first.id, second.id, added.id]
  );
  assert.equal(f.workspace.getSnapshot().active.document.name, `prepared-${added.name}`);
  assert.equal(f.files.get(added.id).document.name, `prepared-${added.name}`);
  assert.equal(await f.files.get(added.id).source.text(), 'added-source');
  assert.equal(f.commits.length, 1);
});

test('new input during selected-file preparation cancels replacement and preserves its source and preference', async () => {
  const entered = deferred();
  const release = deferred();
  let delayedId;
  const f = memory(async (file) => {
    if (file.id === delayedId) {
      entered.resolve();
      await release.promise;
    }
    return { ...file.document, name: `prepared-${file.document.name}` };
  });
  const first = record(document());
  const second = record(document());
  first.source = new Blob(['current-source']);
  second.source = new Blob(['next-source']);
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  await f.storage.select(first.id);
  await f.workspace.start();
  const active = f.workspace.getSnapshot().active;
  delayedId = second.id;
  const selecting = f.workspace.select(second.id);
  await entered.promise;
  f.workspace.edit({ ...active.document, name: '准备期间的新输入.docx' });
  const rejected = assert.rejects(selecting, /切换期间有新输入/);
  release.resolve();
  await rejected;
  const latest = await f.workspace.exportSnapshot();
  assert.equal(latest.id, first.id);
  assert.equal(latest.document.name, '准备期间的新输入.docx');
  assert.equal(await latest.source.text(), 'current-source');
  assert.equal(f.workspace.getSnapshot().active.source, active.source);
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.get(first.id).document.name, first.document.name);
  assert.equal(f.commits.length, 0);
  delayedId = undefined;
  await f.workspace.select(second.id);
  assert.equal(f.files.get(first.id).document.name, '准备期间的新输入.docx');
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
});

test('new input during import preparation cancels the import before committing or replacing the old draft', async () => {
  const entered = deferred();
  const release = deferred();
  let delayedId;
  const f = memory(async (file) => {
    if (file.id === delayedId) {
      entered.resolve();
      await release.promise;
    }
    return file.document;
  });
  const first = record(document());
  first.source = new Blob(['old-source']);
  f.files.set(first.id, first);
  await f.storage.select(first.id);
  await f.workspace.start();
  const imported = document();
  delayedId = imported.id;
  const adding = f.workspace.add(imported, new Blob(['import-source']));
  await entered.promise;
  f.workspace.edit({ ...first.document, name: '导入准备期间的新输入.docx' });
  const rejected = assert.rejects(adding, /准备文档期间有新输入/);
  release.resolve();
  await rejected;
  const snapshot = await f.workspace.exportSnapshot();
  assert.equal(snapshot.id, first.id);
  assert.equal(snapshot.document.name, '导入准备期间的新输入.docx');
  assert.equal(await snapshot.source.text(), 'old-source');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.has(imported.id), false);
  assert.equal(f.commits.length, 0);
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  delayedId = undefined;
  await f.workspace.add(imported, new Blob(['import-source']));
  assert.equal(f.files.get(first.id).document.name, '导入准备期间的新输入.docx');
  assert.equal(f.workspace.getSnapshot().active.id, imported.id);
  assert.equal(await f.workspace.getSnapshot().active.source.text(), 'import-source');
});

test('failed initial preparation retains stored files and the active preference, then retries the same file', async () => {
  let fail = true;
  const prepared = [];
  const f = memory(async (file) => {
    prepared.push(file.id);
    if (fail) throw new Error('hyperlink preparation failed');
    return file.document;
  });
  const first = record(document());
  const second = record(document());
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  await f.storage.select(first.id);
  await assert.rejects(f.workspace.start(), /hyperlink preparation failed/);
  assert.equal(f.workspace.getSnapshot().active, null);
  assert.equal(f.workspace.getSnapshot().saveState, 'error');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.size, 2);
  assert.equal(f.commits.length, 0);
  assert.equal(await f.files.get(first.id).source.text(), 'original file');
  fail = false;
  await f.workspace.start();
  assert.deepEqual(prepared, [first.id, first.id]);
  assert.equal(f.workspace.getSnapshot().active.id, first.id);
  assert.equal(f.workspace.getSnapshot().saveState, 'saved');
  assert.equal(f.workspace.getSnapshot().files.length, 2);
});

test('preparation failures during selection, import, preview and restoration keep the old active file recoverable', async () => {
  let failingId;
  const f = memory(async (file) => {
    if (file.id === failingId) throw new Error('cannot restore source hyperlinks');
    return file.document;
  });
  const first = record(document());
  const second = record(document());
  first.source = new Blob(['active-source']);
  second.source = new Blob(['other-source']);
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  await f.storage.select(first.id);
  await f.workspace.start();
  f.workspace.edit({ ...first.document, name: '已保留的新内容.docx' });
  failingId = second.id;
  await assert.rejects(f.workspace.select(second.id), /cannot restore source hyperlinks/);
  const active = f.workspace.getSnapshot().active;
  assert.equal(active.document.name, '已保留的新内容.docx');
  assert.equal(f.files.get(first.id).document.name, '已保留的新内容.docx');
  assert.equal(f.workspace.getSnapshot().saveState, 'saved');
  const imported = document();
  failingId = imported.id;
  await assert.rejects(
    f.workspace.add(imported, new Blob(['failed-import-source'])),
    /cannot restore source hyperlinks/
  );
  f.storage.loadVersion = async () => ({ ...first, source: new Blob(['historical-source']) });
  failingId = first.id;
  await assert.rejects(f.workspace.version(1), /cannot restore source hyperlinks/);
  await assert.rejects(f.workspace.restoreVersion(1), /cannot restore source hyperlinks/);
  assert.equal(f.workspace.getSnapshot().active, active);
  assert.equal(await (await f.workspace.exportSnapshot()).source.text(), 'active-source');
  assert.equal(await f.storage.activeId(), first.id);
  assert.equal(f.files.has(imported.id), false);
  assert.equal(f.files.size, 2);
  assert.equal(f.commits.length, 1);
  assert.equal(f.files.get(second.id).document.name, second.document.name);
  failingId = undefined;
  await f.workspace.select(second.id);
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
});

test('prepared document id or kind mismatches reject selection, import and history without publishing invalid data', async () => {
  let mismatch;
  let targetId;
  const f = memory(async (file) => {
    if (file.id !== targetId || !mismatch) return file.document;
    return { ...file.document, [mismatch]: mismatch === 'id' ? 'wrong-record' : 'pdf' };
  });
  const first = record(document());
  const second = record(document());
  first.source = new Blob(['identity-source']);
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  await f.storage.select(first.id);
  await f.workspace.start();
  const active = f.workspace.getSnapshot().active;
  f.storage.loadVersion = async () => first;
  for (const property of ['id', 'kind']) {
    mismatch = property;
    targetId = second.id;
    await assert.rejects(f.workspace.select(second.id), /准备后的文档.*不匹配/);
    const imported = document();
    targetId = imported.id;
    await assert.rejects(f.workspace.add(imported), /准备后的文档.*不匹配/);
    targetId = first.id;
    await assert.rejects(f.workspace.version(1), /准备后的文档.*不匹配/);
    await assert.rejects(f.workspace.restoreVersion(1), /准备后的文档.*不匹配/);
    assert.equal(f.workspace.getSnapshot().active, active);
    assert.equal(await f.storage.activeId(), first.id);
    assert.equal(f.files.size, 2);
    assert.equal(f.commits.length, 0);
    assert.equal(await (await f.workspace.exportSnapshot()).source.text(), 'identity-source');
  }
  mismatch = undefined;
  await f.workspace.select(second.id);
  assert.equal(f.workspace.getSnapshot().active.id, second.id);
});

test('IndexedDB history preview and restoration publish prepared links while preserving original versions and bytes', async () => {
  const storage = createStudioStorage(new IDBFactory());
  const original = unpreparedExcel();
  const current = structuredClone(original);
  current.name = 'current-with-cleared-links.xlsx';
  current.sheets.forEach((sheet) => {
    sheet.hyperlinks = [];
    sheet.defaultRowHeight = 18;
    sheet.rowHeights = {};
    sheet.hiddenRows = [];
  });
  const nativeLinks = [
    {
      id: 'source-report',
      ref: 'A1',
      target: 'https://example.com/report?a=1&b=2',
      location: 'Totals!A1',
      tooltip: 'Historical source',
      display: 'Source report',
    },
  ];
  const hydrated = {
    ...original,
    sheets: original.sheets.map((sheet, index) => ({
      ...sheet,
      hyperlinks: index === 0 ? nativeLinks : [],
      defaultRowHeight: 18, rowHeights: {}, hiddenRows: [],
    })),
  };
  const calls = [];
  const prepare = preparation(async (doc, source) => {
    calls.push({ id: doc.id, source: await source.text() });
    assert.deepEqual(doc, original);
    return structuredClone(hydrated);
  });
  await storage.commit(
    { ...record(original), source: new Blob(['historical-xlsx'], { type: xlsxType }) },
    0
  );
  await storage.commit(
    { ...record(current, 2), source: new Blob(['current-xlsx'], { type: xlsxType }) },
    1
  );
  const workspace = new StudioWorkspace(storage, -1, prepare);
  await workspace.start();
  const active = workspace.getSnapshot().active;
  assert.equal(calls.length, 0);
  assert.deepEqual(active.document, current);
  const preview = await workspace.version(1);
  assert.deepEqual(preview.document, hydrated);
  assert.equal(preview.id, original.id);
  assert.equal(preview.revision, 1);
  assert.equal(await preview.source.text(), 'historical-xlsx');
  assert.equal(workspace.getSnapshot().active, active);
  assert.deepEqual((await storage.loadVersion(original.id, 1)).document, original);
  await workspace.restoreVersion(1);
  const copy = workspace.getSnapshot().active;
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.document.id, copy.id);
  assert.equal(copy.revision, 1);
  assert.match(copy.document.name, /版本1\.xlsx$/);
  assert.deepEqual(copy.document.sheets, hydrated.sheets);
  assert.equal(await copy.source.text(), 'historical-xlsx');
  assert.deepEqual((await storage.load(copy.id)).document.sheets, hydrated.sheets);
  assert.deepEqual((await storage.load(original.id)).document, current);
  assert.equal(await (await storage.load(original.id)).source.text(), 'current-xlsx');
  assert.deepEqual((await storage.loadVersion(original.id, 1)).document, original);
  assert.equal((await storage.listVersions(original.id)).length, 1);
  assert.equal(workspace.getSnapshot().files.length, 2);
  assert.deepEqual(calls, [
    { id: original.id, source: 'historical-xlsx' },
    { id: original.id, source: 'historical-xlsx' },
  ]);
  const reopened = new StudioWorkspace(storage, -1, prepare);
  await reopened.start();
  assert.equal(reopened.getSnapshot().active.id, copy.id);
  assert.deepEqual(reopened.getSnapshot().active.document.sheets, hydrated.sheets);
  assert.equal(calls.length, 2);
});

test('new input while preparing a historical workbook cancels restoration and retains cleared links in the current draft', async () => {
  const entered = deferred();
  const release = deferred();
  let delayHistory = false;
  const original = unpreparedExcel();
  const current = structuredClone(original);
  current.name = 'latest.xlsx';
  current.sheets.forEach((sheet) => {
    sheet.hyperlinks = [];
  });
  const f = memory(async (file) => {
    if (delayHistory && file.revision === 1) {
      entered.resolve();
      await release.promise;
    }
    if (file.revision !== 1) return file.document;
    return {
      ...file.document,
      sheets: file.document.sheets.map((sheet, index) => ({
        ...sheet,
        hyperlinks:
          index === 0 ? [{ id: 'old-link', ref: 'A1', target: 'https://example.com/old' }] : [],
      })),
    };
  });
  const saved = { ...record(current, 2), source: new Blob(['current-source']) };
  const historical = { ...record(original), source: new Blob(['historical-source']) };
  f.files.set(saved.id, saved);
  f.storage.loadVersion = async () => historical;
  await f.storage.select(saved.id);
  await f.workspace.start();
  const active = f.workspace.getSnapshot().active;
  delayHistory = true;
  const restoring = f.workspace.restoreVersion(1);
  await entered.promise;
  f.workspace.edit({ ...active.document, name: '历史准备期间的新输入.xlsx' });
  const rejected = assert.rejects(restoring, /准备历史版本期间有新输入/);
  release.resolve();
  await rejected;
  const snapshot = await f.workspace.exportSnapshot();
  assert.equal(snapshot.id, saved.id);
  assert.equal(snapshot.document.name, '历史准备期间的新输入.xlsx');
  assert.deepEqual(snapshot.document.sheets, current.sheets);
  assert.equal(await snapshot.source.text(), 'current-source');
  assert.equal(f.workspace.getSnapshot().active.source, active.source);
  assert.equal(f.workspace.getSnapshot().saveState, 'unsaved');
  assert.equal(await f.storage.activeId(), saved.id);
  assert.equal(f.files.size, 1);
  assert.equal(f.commits.length, 0);
  assert.deepEqual(historical.document, original);
  delayHistory = false;
  await f.workspace.restoreVersion(1);
  assert.notEqual(f.workspace.getSnapshot().active.id, saved.id);
  assert.equal(f.workspace.getSnapshot().active.document.sheets[0].hyperlinks[0].id, 'old-link');
  assert.equal(f.files.get(saved.id).document.name, '历史准备期间的新输入.xlsx');
});

test('a delayed history preview rejects after another file opens and cannot replace its active canvas or source', async () => {
  const entered = deferred();
  const release = deferred();
  let delayHistory = false;
  const first = record(document(), 2);
  const second = record(document());
  const historical = { ...first, revision: 1, source: new Blob(['old-version-source']) };
  second.source = new Blob(['selected-source']);
  const f = memory(async (file) => {
    if (delayHistory && file.id === first.id && file.revision === 1) {
      entered.resolve();
      await release.promise;
    }
    return file.document;
  });
  f.files.set(first.id, first);
  f.files.set(second.id, second);
  f.storage.loadVersion = async () => historical;
  await f.storage.select(first.id);
  await f.workspace.start();
  delayHistory = true;
  const previewing = f.workspace.version(1);
  await entered.promise;
  await f.workspace.select(second.id);
  const active = f.workspace.getSnapshot().active;
  const rejected = assert.rejects(previewing, /当前文档已切换/);
  release.resolve();
  await rejected;
  assert.equal(f.workspace.getSnapshot().active, active);
  assert.equal(active.id, second.id);
  assert.equal(await active.source.text(), 'selected-source');
  assert.equal(await f.storage.activeId(), second.id);
  assert.equal(f.commits.length, 0);
});

test('file preparation keeps non-Excel documents and explicit native empty arrays by reference without loading a parser', async () => {
  let loads = 0;
  const prepare = preparation(
    async () => {
      assert.fail('source parser must remain lazy');
    },
    () => {
      loads++;
    }
  );
  for (const kind of ['word', 'pdf']) {
    const doc = models.createOfficeStudioDocument(kind);
    assert.equal(await prepare({ ...record(doc), source: new Blob(['unused-source']) }), doc);
  }
  const cleared = unpreparedExcel();
  cleared.sheets.forEach((sheet) => {
    sheet.hyperlinks = [];
    sheet.defaultRowHeight = 18;
    sheet.rowHeights = {};
    sheet.hiddenRows = [];
  });
  const prepared = await prepare({
    ...record(cleared),
    source: new Blob(['unused-source'], { type: 'application/pdf' }),
  });
  assert.equal(prepared, cleared);
  assert.equal(prepared.sheets[0], cleared.sheets[0]);
  assert.equal(prepared.sheets[0].hyperlinks, cleared.sheets[0].hyperlinks);
  assert.equal(loads, 0);
});

test('file preparation marks missing links empty for CSV and source-free workbooks while preserving known sheets and the old model', async () => {
  let loads = 0;
  const prepare = preparation(
    async () => {
      assert.fail('CSV and source-free workbooks have no XLSX source to hydrate');
    },
    () => {
      loads++;
    }
  );
  const csv = excelDocument();
  const csvResult = await prepare({
    ...record(csv),
    source: new Blob(['name,value\nA,1'], { type: 'text/csv' }),
  });
  assert.notEqual(csvResult, csv);
  assert.equal(csvResult.id, csv.id);
  assert.equal(csvResult.sheets[0], csv.sheets[0]);
  assert.equal(csvResult.sheets[0].hyperlinks, csv.sheets[0].hyperlinks);
  assert.deepEqual([...csvResult.sheets[1].hyperlinks], []);
  assert.equal(csv.sheets[1].hyperlinks, undefined);
  const local = unpreparedExcel();
  const localResult = await prepare({ ...record(local), source: undefined });
  assert.notEqual(localResult, local);
  assert.ok(
    localResult.sheets.every(
      (sheet) => Array.isArray(sheet.hyperlinks) && sheet.hyperlinks.length === 0
    )
  );
  assert.ok(local.sheets.every((sheet) => sheet.hyperlinks === undefined));
  assert.equal(loads, 0);
});

test('file preparation dispatches source hydration by XLSX sheet identity and rejects known incompatible MIME types before decoding', async () => {
  const original = unpreparedExcel();
  const marker = structuredClone(original);
  marker.sheets.forEach((sheet) => {
    sheet.hyperlinks = [];
  });
  const calls = [];
  const prepare = preparation(async (doc, source) => {
    calls.push({ doc, source });
    return marker;
  });
  for (const type of [
    xlsxType,
    'application/octet-stream',
    'application/zip',
    '',
    'application/x-unknown',
  ]) {
    const source = new Blob(['xlsx-source'], { type });
    assert.equal(await prepare({ ...record(original), source }), marker);
    assert.equal(calls.at(-1).doc, original);
    assert.equal(calls.at(-1).source, source);
  }
  const allowedCalls = calls.length;
  for (const type of [
    'text/csv',
    'text/plain',
    'application/pdf',
    'application/pdf; charset=binary',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/json',
    'image/png',
  ]) {
    await assert.rejects(
      prepare({ ...record(original), source: new Blob(['incompatible-source'], { type }) }),
      /源文件类型不匹配/,
      type
    );
    assert.equal(calls.length, allowedCalls, type);
  }
  assert.ok(original.sheets.every((sheet) => sheet.hyperlinks === undefined));
});
