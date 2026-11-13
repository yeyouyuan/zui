import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL, URLSearchParams } from 'node:url';
import { runInNewContext } from 'node:vm';

const { AbortSignal, Headers, queueMicrotask, Response } = globalThis;
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceUrl = new URL('../src/pages/collaboration/office/office-client.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const credentialsKey = 'zui-office-sessions-v1';
const mimeTypes = {
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};
const extensions = { word: 'docx', excel: 'xlsx', pdf: 'pdf' };
const digest = async (blob) =>
  createHash('sha256')
    .update(Buffer.from(await blob.arrayBuffer()))
    .digest('hex');
const jsonResponse = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Each VM owns the client's session maps and timers. The fixture models a CAS
// write and its durable confirmation independently from the bridge's ACK.
function fixture(options = {}) {
  const kind = options.kind ?? 'word';
  const original = new Blob(['original document'], { type: mimeTypes[kind] });
  const file = {
    id: 'file-test',
    name: `测试文件.${extensions[kind]}`,
    kind,
    mime: original.type,
    size: original.size,
    revision: options.revision ?? 1,
    assetKey: 'original-asset',
    blocks: [],
    updatedAt: '2026-11-12T00:00:00.000Z',
  };
  const f = {
    data: { files: [file], officeDrafts: options.draft ? { [file.id]: options.draft } : {} },
    assets: new Map([[file.assetKey, original]]),
    storage: new Map(
      options.credentials ? [[credentialsKey, JSON.stringify(options.credentials)]] : []
    ),
    requests: [],
    uploads: [],
    commits: [],
    confirmations: [],
    acknowledgments: [],
    exports: [],
    states: new Map(),
    resultFiles: new Map(),
    tokens: new Map(),
    intervals: [],
    delays: [],
    windowListeners: new Map(),
    events: [],
    forceCalls: [],
    resultDownloads: [],
    ackFailures: 0,
    ackResponseLosses: 0,
    now: 0,
    uuid: 0,
    created: 0,
  };
  f.latest = () => f.data.files.find((entry) => entry.id === file.id);
  f.addSession = (details = {}) => {
    const id = details.id ?? 'recovered-session';
    const state = {
      id,
      key: `${id}-key`,
      fileId: file.id,
      mode: 'edit',
      sequence: 0,
      ackSequence: 0,
      baseRevision: 1,
      ackRevision: 1,
      state: 'editing',
      config: {
        documentType: kind === 'excel' ? 'cell' : kind,
        document: { key: `${id}-key` },
        editorConfig: {},
        token: 'config-token',
        type: 'desktop',
      },
      ...details,
    };
    f.states.set(id, state);
    f.tokens.set(id, details.accessToken ?? `${id}-token`);
    return state;
  };
  f.produceResult = async (id, details = {}) => {
    const state = f.states.get(id);
    assert.ok(state, 'the mock session exists before producing a result');
    const blob =
      details.blob ?? new Blob([details.text ?? 'edited document'], { type: mimeTypes[kind] });
    const sequence = details.sequence ?? state.sequence + 1;
    state.sequence = sequence;
    state.result = {
      sequence,
      size: blob.size,
      hash: details.hash ?? (await digest(blob)),
      ...(details.requestId ? { requestId: details.requestId } : {}),
    };
    f.resultFiles.set(`${id}:${sequence}`, blob);
    return state.result;
  };
  const store = {
    getSnapshot: () => ({ data: f.data, status: f.workspaceConflict ? 'conflict' : 'saved' }),
    asset: async (key) => {
      assert.ok(f.assets.has(key), 'requested workspace asset exists');
      return f.assets.get(key);
    },
    commitOfficeFile: async (fileId, blob, expectedRevision) => {
      f.events.push('commit-start');
      f.commits.push({ fileId, blob, expectedRevision });
      if (f.workspaceConflict || f.latest()?.revision !== expectedRevision)
        throw new Error('文件已被另一个编辑会话修改，服务端副本已保留。');
      await f.beforeCommit?.();
      const current = f.latest();
      const revision = current.revision + 1;
      const assetKey = `committed-${revision}`;
      const drafts = { ...f.data.officeDrafts };
      delete drafts[fileId];
      f.assets.set(assetKey, blob);
      f.data = {
        ...f.data,
        officeDrafts: drafts,
        files: f.data.files.map((entry) =>
          entry.id === fileId ? { ...entry, assetKey, revision, size: blob.size } : entry
        ),
      };
      f.events.push('commit-written');
      await store.confirmOfficeFile(fileId, revision);
      return revision;
    },
    confirmOfficeFile: async (fileId, revision) => {
      f.confirmations.push({ fileId, revision });
      await f.beforeConfirm?.();
      assert.equal(f.latest().revision, revision);
      f.events.push('commit-confirmed');
    },
  };
  const fetchMock = async (input, init = {}) => {
    const url = new URL(input, 'http://workspace.test');
    const path = url.pathname.replace(/^\/api\/office/, '');
    const method = init.method ?? 'GET';
    const request = { path, method, body: init.body, query: url.searchParams };
    f.requests.push(request);
    if (path === '/health')
      return jsonResponse({ available: true, documentServerUrl: 'http://docs.test' });
    if (path === '/sessions' && method === 'POST') {
      f.events.push('session-created');
      f.uploads.push(request);
      const id = `created-${++f.created}`;
      const state = f.addSession({
        id,
        mode: url.searchParams.get('mode'),
        baseRevision: Number(url.searchParams.get('revision')),
        ackRevision: Number(url.searchParams.get('revision')),
        state: 'opening',
      });
      return jsonResponse({
        id,
        key: state.key,
        accessToken: f.tokens.get(id),
        config: state.config,
      });
    }
    const match = /^\/sessions\/([^/]+)(.*)$/.exec(path);
    assert.ok(match, `unexpected office request: ${method} ${path}`);
    const [, id, suffix] = match;
    const state = f.states.get(id);
    if (!state) return jsonResponse({ error: '会话不存在。' }, 404);
    assert.equal(new Headers(init.headers).get('x-office-session-token'), f.tokens.get(id));
    if (!suffix && method === 'GET') {
      await f.beforeState?.(state);
      return jsonResponse(state);
    }
    if (suffix === '/force-save' && method === 'POST') {
      const body = JSON.parse(init.body);
      f.forceCalls.push(body);
      if (f.onForce) return f.onForce(state, body);
      if (!state.result) return jsonResponse({ noChanges: true });
      state.result.requestId = body.requestId;
      return jsonResponse({});
    }
    const resultMatch = /^\/results\/(\d+)$/.exec(suffix);
    if (resultMatch && method === 'GET') {
      f.resultDownloads.push(`${id}:${resultMatch[1]}`);
      const blob = f.resultFiles.get(`${id}:${resultMatch[1]}`);
      return blob ? new Response(blob) : new Response(null, { status: 404 });
    }
    if (suffix === '/ack' && method === 'POST') {
      const body = JSON.parse(init.body);
      f.events.push('ack');
      f.acknowledgments.push(body);
      if (f.ackFailures > 0) {
        f.ackFailures--;
        return jsonResponse({ error: 'ACK 暂时失败。' }, 503);
      }
      state.ackSequence = body.sequence;
      state.ackRevision = body.revision;
      if (f.ackResponseLosses > 0) {
        f.ackResponseLosses--;
        throw new Error('ACK 响应连接中断。');
      }
      return jsonResponse({ ok: true });
    }
    assert.fail(`unexpected office request: ${method} ${path}`);
  };
  const localStorage = {
    getItem: (key) => f.storage.get(key) ?? null,
    setItem: (key, value) => f.storage.set(key, String(value)),
  };
  const exportModule = (exportKind, name) => ({
    [name]: async (blob, changes) => {
      f.events.push('draft-exported');
      f.exports.push({ kind: exportKind, blob, changes });
      return new Blob(['migrated draft'], { type: mimeTypes[exportKind] });
    },
  });
  const module = { exports: {} };
  runInNewContext(
    compiled,
    {
      module,
      exports: module.exports,
      require: (id) => {
        if (id === '../workspace-store') return { workspaceStore: store };
        if (id === './word-document') return exportModule('word', 'exportWord');
        if (id === './excel-document') return exportModule('excel', 'exportExcel');
        if (id === './pdf-document') return exportModule('pdf', 'exportPdf');
        assert.fail(`unexpected office-client import: ${id}`);
      },
      Blob,
      Headers,
      AbortSignal,
      URLSearchParams,
      Error,
      Promise,
      localStorage,
      fetch: fetchMock,
      crypto: {
        subtle: webcrypto.subtle,
        randomUUID: () => `00000000-0000-4000-8000-${String(++f.uuid).padStart(12, '0')}`,
      },
      Date: class extends Date {
        static now() {
          return f.now;
        }
      },
      setInterval: (callback, duration) => {
        f.intervals.push({ callback, duration });
        return f.intervals.length;
      },
      setTimeout: (callback, duration) => {
        f.delays.push(duration);
        queueMicrotask(() => {
          f.now += duration;
          callback();
        });
        return f.delays.length;
      },
      window: { addEventListener: (name, callback) => f.windowListeners.set(name, callback) },
    },
    { filename: sourceUrl.pathname }
  );
  f.api = module.exports;
  f.open = (disabled = false, draft) => f.api.openOfficeSession(file, disabled, draft);
  f.markChanged = (session) => {
    f.api.officeDocumentChanged(session, true);
    f.api.officeDocumentChanged(session, false);
  };
  f.storedCredentials = () => JSON.parse(f.storage.get(credentialsKey) ?? '[]');
  return f;
}

test('同一文件和模式并发打开复用同一 Promise，旧草稿只迁移并创建一次会话', async () => {
  const draft = { kind: 'word', baseRevision: 1, changes: { paragraphs: { 0: '旧草稿内容' } } };
  const f = fixture({ draft });
  const started = deferred();
  const release = deferred();
  f.beforeCommit = () => {
    started.resolve();
    return release.promise;
  };

  const first = f.open(false, draft);
  const second = f.open(false, draft);
  assert.equal(second, first);
  await started.promise;
  assert.equal(f.open(false, draft), first);
  assert.equal(f.exports.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.confirmations.length, 0);
  assert.equal(f.uploads.length, 0);
  assert.equal(f.latest().revision, 1);
  assert.equal(f.data.officeDrafts['file-test'], draft);

  release.resolve();
  const [session, concurrent] = await Promise.all([first, second]);
  assert.equal(concurrent, session);
  assert.equal(f.api.currentOfficeSession('file-test'), session);
  assert.equal(f.created, 1);
  assert.equal(f.exports.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.uploads[0].query.get('revision'), '2');
  assert.equal(await f.uploads[0].body.text(), 'migrated draft');
  assert.equal(f.latest().revision, 2);
  assert.equal(f.data.officeDrafts['file-test'], undefined);
  assert.equal(session.baseRevision, 2);
  assert.equal(f.storedCredentials().length, 1);
  assert.equal(f.storedCredentials()[0].id, session.id);
  assert.ok(f.events.indexOf('commit-confirmed') < f.events.indexOf('session-created'));
});

test('重新打开存活会话时同步新版本，再读取最新工作区文件而不误报冲突', async () => {
  const f = fixture();
  const session = await f.open();
  await f.produceResult(session.id, { text: 'saved during reopening' });

  // f.open deliberately retains the original revision-1 file object. The live
  // refresh writes revision 2 while the new opening operation is in progress.
  const reopened = await f.open();
  assert.equal(reopened, session);
  assert.equal(session.error, '');
  assert.equal(session.sequence, 1);
  assert.equal(session.revision, 2);
  assert.equal(f.latest().revision, session.revision);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'saved during reopening');
  assert.equal(f.commits.length, 1);
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(f.acknowledgments[0].revision, 2);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.created, 1);
});

test('并发轮询与显式保存只回写一次，并等待同一事务确认后 ACK', async () => {
  const f = fixture();
  const session = await f.open();
  await f.produceResult(session.id);
  f.markChanged(session);
  const started = deferred();
  const release = deferred();
  f.beforeCommit = () => {
    started.resolve();
    return release.promise;
  };
  const polling = f.api.refreshOfficeSession(session);
  assert.equal(f.api.refreshOfficeSession(session), polling);
  await started.promise;
  const saving = f.api.saveOfficeSession(session);
  assert.equal(f.api.saveOfficeSession(session), saving);
  assert.equal(f.acknowledgments.length, 0);
  release.resolve();
  await Promise.all([polling, saving]);
  assert.equal(f.commits.length, 1);
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(f.resultDownloads.length, 1);
  assert.ok(f.events.indexOf('commit-confirmed') < f.events.indexOf('ack'));
  assert.equal(session.revision, 2);
  assert.equal(session.sequence, 1);
  assert.equal(session.dirty, false);
  assert.equal(session.error, '');
  assert.equal(session.pendingSave, undefined);
});

for (const failure of ['ackFailures', 'ackResponseLosses']) {
  test(`ACK ${failure === 'ackFailures' ? '被拒绝' : '成功但响应丢失'} 后重试不重复增加文件版本`, async () => {
    const f = fixture();
    const session = await f.open();
    const result = await f.produceResult(session.id);
    f[failure] = 1;
    await f.api.refreshOfficeSession(session);
    assert.match(session.error, /ACK/);
    assert.equal(session.sequence, 0);
    assert.equal(f.latest().revision, 2);
    await f.api.refreshOfficeSession(session);
    assert.equal(session.error, '');
    assert.equal(session.sequence, 1);
    assert.equal(session.revision, 2);
    assert.equal(f.latest().revision, 2);
    assert.equal(f.commits.length, 1);
    assert.equal(f.confirmations.length, 2);
    assert.equal(f.acknowledgments.at(-1).hash, result.hash);
    assert.equal(f.acknowledgments.at(-1).revision, 2);
  });
}

test('ACK 响应丢失后工作区版本已变化时拒绝覆盖后来的文件', async () => {
  const f = fixture();
  const session = await f.open();
  await f.produceResult(session.id);
  f.ackResponseLosses = 1;
  await f.api.refreshOfficeSession(session);
  const later = new Blob(['another editor changed this file'], { type: mimeTypes.word });
  f.assets.set('later-edit', later);
  f.data.files = f.data.files.map((entry) => ({ ...entry, revision: 3, assetKey: 'later-edit' }));
  await f.api.refreshOfficeSession(session);
  assert.match(session.error, /已确认文件与工作区版本不一致/);
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(f.latest().revision, 3);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'another editor changed this file');
  assert.equal(session.sequence, 0);
});

test('浏览器持久化失败时不 ACK，重试确认原回写而不新建版本', async () => {
  const f = fixture();
  const session = await f.open();
  await f.produceResult(session.id);
  f.beforeConfirm = () => {
    throw new Error('浏览器存储写入失败。');
  };
  await f.api.refreshOfficeSession(session);
  assert.match(session.error, /存储/);
  assert.equal(f.latest().revision, 2);
  assert.equal(f.acknowledgments.length, 0);
  await f.api.refreshOfficeSession(session);
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 0);
  f.beforeConfirm = undefined;
  await f.api.refreshOfficeSession(session);
  assert.equal(session.revision, 2);
  assert.equal(session.sequence, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 1);
});

test('本次 requestId 即使复用已确认的 sequence 也立即完成保存', async () => {
  const f = fixture();
  const session = await f.open();
  await f.produceResult(session.id);
  await f.api.refreshOfficeSession(session);
  f.markChanged(session);
  await f.api.saveOfficeSession(session);
  assert.equal(session.dirty, false);
  assert.equal(session.error, '');
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(f.forceCalls.length, 1);
  assert.equal(f.delays.length, 0);
  assert.equal(f.states.get(session.id).result.requestId, f.forceCalls[0].requestId);
});

test('保存过程中产生的新输入仍保持待保存状态', async () => {
  const f = fixture();
  const session = await f.open();
  f.markChanged(session);
  f.onForce = async (state, { requestId }) => {
    f.markChanged(session);
    await f.produceResult(state.id, { requestId });
    return jsonResponse({});
  };
  await f.api.saveOfficeSession(session);
  assert.equal(session.dirty, true);
  assert.equal(session.inputVersion, 2);
  assert.equal(f.latest().revision, 2);
  assert.equal(session.saving, false);
});

test('切换前保存等待期间新增输入继续回写，全部完成后才返回', async () => {
  const f = fixture();
  const session = await f.open();
  f.markChanged(session);
  f.onForce = async (state, { requestId }) => {
    if (f.forceCalls.length === 1) f.markChanged(session);
    await f.produceResult(state.id, {
      requestId,
      text: `native input saved in request ${f.forceCalls.length}`,
    });
    return jsonResponse({});
  };

  await f.api.saveAllOfficeSessions();

  assert.equal(f.forceCalls.length, 2);
  assert.equal(f.commits.length, 2);
  assert.equal(f.acknowledgments.length, 2);
  assert.equal(f.latest().revision, 3);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'native input saved in request 2');
  assert.equal(session.dirty, false);
  assert.equal(session.saving, false);
  assert.equal(session.pendingSave, undefined);
});

test('切换前持续新增输入时有界结束并拒绝切换，保留最新已回写副本', async () => {
  const f = fixture();
  const session = await f.open();
  f.markChanged(session);
  f.onForce = async (state, { requestId }) => {
    // Fail promptly if the implementation retries without a bound.
    assert.ok(f.forceCalls.length <= 3, 'continuous editing must not retry indefinitely');
    f.markChanged(session);
    await f.produceResult(state.id, {
      requestId,
      text: `saved while editing ${f.forceCalls.length}`,
    });
    return jsonResponse({});
  };

  await assert.rejects(f.api.saveAllOfficeSessions(), /仍有新输入.*暂停编辑后重试/);

  assert.equal(f.forceCalls.length, 3);
  assert.equal(f.commits.length, 3);
  assert.equal(f.acknowledgments.length, 3);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'saved while editing 3');
  assert.equal(session.dirty, true);
  assert.equal(session.saving, false);
  assert.equal(session.pendingSave, undefined);
  assert.equal(f.created, 1);
});

test('切换前等待已有保存请求，即使当前 dirty=false 也不能提前返回', async () => {
  const f = fixture();
  const session = await f.open();
  const started = deferred();
  const release = deferred();
  let released = false;
  f.beforeState = () => {
    assert.equal(released, true, 'draining must await the existing save before refreshing');
  };
  f.onForce = async (state, { requestId }) => {
    started.resolve();
    await release.promise;
    await f.produceResult(state.id, { requestId, text: 'completed pending save' });
    return jsonResponse({});
  };
  const saving = f.api.saveOfficeSession(session);
  await started.promise;
  assert.equal(session.dirty, false);
  assert.equal(session.saving, true);
  const draining = f.api.saveAllOfficeSessions();
  // Preserve a rejection until the final await if an old implementation
  // incorrectly refreshes before the in-flight save has finished.
  void draining.catch(() => {});
  released = true;
  release.resolve();
  await Promise.all([saving, draining]);

  assert.equal(f.forceCalls.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'completed pending save');
  assert.equal(session.saving, false);
  assert.equal(session.pendingSave, undefined);
});

test('没有内容变化的显式保存仍刷新状态并清除已保存标记', async () => {
  const f = fixture();
  const session = await f.open();
  f.markChanged(session);
  await f.api.saveOfficeSession(session);
  assert.equal(f.forceCalls.length, 1);
  assert.equal(
    f.requests.filter(
      (request) => request.path === `/sessions/${session.id}` && request.method === 'GET'
    ).length,
    1
  );
  assert.equal(f.commits.length, 0);
  assert.equal(session.dirty, false);
  assert.equal(session.saving, false);
});

test('关闭编辑器的最终结果仍回写，后续显式保存不再调用 force-save', async () => {
  const f = fixture();
  const session = await f.open();
  f.markChanged(session);
  await f.produceResult(session.id);
  f.states.get(session.id).state = 'closed';
  await f.api.saveAllOfficeSessions();
  assert.equal(f.latest().revision, 2);
  assert.equal(session.closed, true);
  assert.equal(session.dirty, false);
  assert.equal(session.editorDirty, false);
  const forces = f.forceCalls.length;
  await f.api.saveOfficeSession(session);
  assert.equal(f.forceCalls.length, forces);
  assert.equal(f.commits.length, 1);
  assert.equal(session.saving, false);
});

test('Word、Excel、PDF 的旧草稿在创建编辑会话前导出并持久化', async (t) => {
  const changes = {
    word: { paragraphs: { 0: '修改内容' } },
    excel: { cells: { '0:A1': { value: '42' } } },
    pdf: { marks: [], rotations: { 0: 90 }, fields: {} },
  };
  for (const kind of ['word', 'excel', 'pdf']) {
    await t.test(kind, async () => {
      const draft = { kind, baseRevision: 1, changes: changes[kind] };
      const f = fixture({ kind, draft });
      const session = await f.open();
      assert.equal(f.exports.length, 1);
      assert.equal(f.exports[0].kind, kind);
      assert.equal(f.exports[0].changes, draft.changes);
      assert.equal(f.commits.length, 1);
      assert.equal(f.uploads[0].query.get('revision'), '2');
      assert.equal(await f.uploads[0].body.text(), 'migrated draft');
      assert.equal(f.data.officeDrafts['file-test'], undefined);
      assert.ok(f.events.indexOf('commit-confirmed') < f.events.indexOf('session-created'));
      assert.equal(session.baseRevision, 2);
    });
  }
});

test('迁移草稿已删除后以旧文件和旧草稿重新打开，保留后续原生编辑内容', async () => {
  const draft = { kind: 'word', baseRevision: 1, changes: { paragraphs: { 0: '迁移前草稿' } } };
  const f = fixture({ draft });
  const session = await f.open(false, draft);
  assert.equal(f.latest().revision, 2);
  assert.equal(f.data.officeDrafts['file-test'], undefined);

  await f.produceResult(session.id, { text: 'native edit after migration' });
  await f.api.refreshOfficeSession(session);
  assert.equal(f.latest().revision, 3);
  assert.equal(session.error, '');
  f.states.get(session.id).state = 'closed';
  await f.api.refreshOfficeSession(session);
  assert.equal(session.closed, true);

  // Both arguments still refer to revision 1, even though the stored draft has
  // been removed and the workspace now contains a later native editor result.
  const reopened = await f.open(false, draft);
  assert.notEqual(reopened.id, session.id);
  assert.notEqual(reopened.key, session.key);
  assert.equal(f.api.currentOfficeSession('file-test'), reopened);
  assert.equal(f.exports.length, 1);
  assert.equal(f.commits.length, 2);
  assert.equal(f.confirmations.length, 2);
  assert.equal(f.uploads.length, 2);
  assert.equal(f.created, 2);
  assert.equal(f.uploads[1].query.get('revision'), '3');
  assert.equal(await f.uploads[1].body.text(), 'native edit after migration');
  assert.equal(f.latest().revision, 3);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'native edit after migration');
  assert.equal(f.data.officeDrafts['file-test'], undefined);
  assert.equal(reopened.baseRevision, 3);
  assert.equal(reopened.revision, 3);
  assert.equal(f.storedCredentials().length, 1);
  assert.equal(f.storedCredentials()[0].id, reopened.id);
});

test('旧草稿类型或基础版本不匹配时保留草稿并拒绝创建会话', async (t) => {
  for (const draft of [
    { kind: 'excel', baseRevision: 1, changes: { cells: {} } },
    { kind: 'word', baseRevision: 2, changes: { paragraphs: {} } },
  ]) {
    for (const persisted of [true, false]) {
      await t.test(
        `${draft.kind}/${draft.baseRevision}/${persisted ? 'persisted' : 'passed'}`,
        async () => {
          const f = fixture(persisted ? { draft } : {});
          await assert.rejects(
            f.open(false, persisted ? undefined : draft),
            /草稿与文件版本不一致/
          );
          assert.equal(f.exports.length, 0);
          assert.equal(f.commits.length, 0);
          assert.equal(f.uploads.length, 0);
          assert.deepEqual(f.storedCredentials(), []);
          if (persisted) assert.equal(f.data.officeDrafts['file-test'], draft);
        }
      );
    }
  }
});

test('草稿持久化失败时不创建会话或替换保存凭据', async () => {
  const draft = { kind: 'word', baseRevision: 1, changes: { paragraphs: { 0: '草稿' } } };
  const f = fixture({ draft });
  f.workspaceConflict = true;
  await assert.rejects(f.open(), /另一个编辑会话/);
  assert.equal(f.uploads.length, 0);
  assert.equal(f.data.officeDrafts['file-test'], draft);
  assert.deepEqual(f.storedCredentials(), []);
});

test('恢复会话遇到 CAS 冲突时保留原凭据和可下载副本，不创建新会话', async () => {
  const previous = {
    id: 'previous',
    accessToken: 'previous-token',
    fileId: 'file-test',
    mode: 'edit',
  };
  const f = fixture({ revision: 2, credentials: [previous] });
  f.addSession({ id: previous.id, accessToken: previous.accessToken });
  await f.produceResult(previous.id, { text: 'recoverable server edit' });
  await assert.rejects(f.open(), /另一个编辑会话/);
  assert.equal(f.uploads.length, 0);
  assert.equal(f.latest().revision, 2);
  assert.deepEqual(f.storedCredentials(), [previous]);
  const recovered = f.api.currentOfficeSession(previous.fileId);
  assert.ok(recovered);
  assert.match(recovered.error, /另一个编辑会话/);
  assert.equal(await (await f.api.downloadOfficeCopy(recovered)).text(), 'recoverable server edit');
  await assert.rejects(f.open(), /另一个编辑会话/);
  assert.equal(f.uploads.length, 0);
  assert.deepEqual(f.storedCredentials(), [previous]);
});

test('恢复结果的哈希不一致时不回写和 ACK，仍保留恢复凭据', async () => {
  const previous = {
    id: 'previous',
    accessToken: 'previous-token',
    fileId: 'file-test',
    mode: 'edit',
  };
  const f = fixture({ credentials: [previous] });
  f.addSession({ id: previous.id, accessToken: previous.accessToken });
  await f.produceResult(previous.id, { hash: '0'.repeat(64) });
  await assert.rejects(f.open(), /校验未通过/);
  assert.equal(f.commits.length, 0);
  assert.equal(f.acknowledgments.length, 0);
  assert.equal(f.uploads.length, 0);
  assert.deepEqual(f.storedCredentials(), [previous]);
});

test('只读预览与编辑会话分别保存，忽略修改事件和显式保存请求', async () => {
  const f = fixture();
  const editing = await f.open();
  const viewing = await f.open(true);
  assert.equal(f.api.currentOfficeSession('file-test'), editing);
  assert.equal(f.api.currentOfficeSession('file-test', true), viewing);
  assert.equal(f.uploads[1].query.get('mode'), 'view');
  f.api.officeDocumentChanged(viewing, true);
  await f.api.saveOfficeSession(viewing);
  assert.equal(viewing.dirty, false);
  assert.equal(viewing.editorDirty, false);
  assert.equal(viewing.inputVersion, 0);
  assert.equal(f.forceCalls.length, 0);
  assert.equal(f.commits.length, 0);
  assert.equal(f.storedCredentials().length, 2);
});

test('预览旧草稿只导出预览文件，保留工作区的草稿和版本', async () => {
  const draft = { kind: 'word', baseRevision: 1, changes: { paragraphs: { 0: '待保存内容' } } };
  const f = fixture({ draft });
  const viewing = await f.open(true);
  assert.equal(await f.uploads[0].body.text(), 'migrated draft');
  assert.equal(f.uploads[0].query.get('revision'), '1');
  assert.equal(f.latest().revision, 1);
  assert.equal(f.commits.length, 0);
  assert.equal(f.data.officeDrafts['file-test'], draft);
  assert.equal(viewing.mode, 'view');
});

test('空闲自动保存等待静默窗口，超过窗口后回写并清除待保存状态', async () => {
  const f = fixture();
  // 结果按需产出：force-save 之前任何轮询都不会抢先提交结果。
  f.onForce = async (state, { requestId }) => {
    await f.produceResult(state.id, { requestId });
    return jsonResponse({});
  };
  const session = await f.open();
  session.ready = true;
  f.markChanged(session);
  assert.equal(f.api.OFFICE_AUTOSAVE_IDLE_MS > 0, true);
  const tick = f.intervals[0].callback;

  // 轮询发生在静默窗口内：不触发 force-save。
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS - 500;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 0);
  assert.equal(f.commits.length, 0);

  // 新输入会重置计时：再次进入窗口内仍不保存。
  f.markChanged(session);
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS - 500;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 0);
  assert.equal(f.commits.length, 0);

  // 超过空闲窗口后由轮询器自动保存。
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(f.acknowledgments.length, 1);
  assert.equal(session.dirty, false);
  assert.equal(session.saving, false);
  assert.equal(session.error, '');
});

test('自动保存开关持久化：关闭时不自动回写，手动保存不受影响，重新开启后恢复', async () => {
  const f = fixture();
  let produced = 0;
  f.onForce = async (state, { requestId }) => {
    await f.produceResult(state.id, {
      requestId,
      text: `auto document ${++produced}`,
    });
    return jsonResponse({});
  };
  const session = await f.open();
  session.ready = true;
  f.markChanged(session);
  const tick = f.intervals[0].callback;

  f.api.setOfficeAutoSaveEnabled(false);
  assert.equal(f.storage.get('zui-office-autosave-v1'), '0');
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 0);
  assert.equal(session.dirty, true);

  await f.api.saveOfficeSession(session);
  assert.equal(f.forceCalls.length, 1);
  assert.equal(f.commits.length, 1);
  assert.equal(session.dirty, false);

  f.markChanged(session);
  f.api.setOfficeAutoSaveEnabled(true);
  assert.equal(f.storage.get('zui-office-autosave-v1'), '1');
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS - 100;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 1);
  f.now += 100;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 2);
  assert.equal(f.commits.length, 2);
  assert.equal(session.dirty, false);
  assert.equal(await f.assets.get(f.latest().assetKey).text(), 'auto document 2');
});

test('自动保存默认开启，存储写入失败时开关调用不中断保存', async () => {
  const f = fixture();
  assert.equal(f.api.isOfficeAutoSaveEnabled(), true);
  f.onForce = async (state, { requestId }) => {
    await f.produceResult(state.id, { requestId });
    return jsonResponse({});
  };
  const session = await f.open();
  session.ready = true;
  f.markChanged(session);
  // localStorage 的写入最终落到这个 Map；让 Map.set 失败模拟存储不可用。
  f.storage.set = () => {
    throw new Error('存储写入失败');
  };
  f.api.setOfficeAutoSaveEnabled(false);
  const tick = f.intervals[0].callback;
  f.now += f.api.OFFICE_AUTOSAVE_IDLE_MS;
  await tick();
  await session.pendingSave;
  assert.equal(f.forceCalls.length, 1);
  assert.equal(f.commits.length, 1);
});
