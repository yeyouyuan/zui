/* global fetch, Response */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { URL, URLSearchParams } from 'node:url';
import { createOfficeBridge, signJwt, verifyJwt } from '../../services/office-bridge/server.mjs';

const SECRET = 'office-bridge-tests-use-a-separate-secret';
const ORIGIN = 'http://127.0.0.1:5173';
const PUBLIC_DOCS = 'http://localhost:65531';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// The bridge validates signatures and preserves bytes; ZIP parsing belongs to Docs.
const archive = (text) => Buffer.concat([Buffer.from([80, 75, 3, 4]), Buffer.from(text)]);
const original = archive('original-content');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return 'http://127.0.0.1:' + server.address().port;
}

async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

async function fixture(t, options = {}) {
  const fixture = {
    dataDir: await mkdtemp(join(tmpdir(), 'zui-office-bridge-test-')),
    generated: new Map(),
    downloads: [],
    commands: [],
    mockErrors: [],
    commandError: 0,
    commandVersionError: 0,
    infoAvailable: true,
    healthAvailable: true,
  };
  fixture.mock = http.createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url, 'http://mock-docs');
      if (url.pathname === '/healthcheck') {
        response.end(fixture.healthAvailable ? 'true' : 'false');
        return;
      }
      if (url.pathname === '/info/info.json') {
        if (!fixture.infoAvailable) {
          response.writeHead(403);
          response.end('Version metadata requires authentication');
          return;
        }
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ version: '10.0.0-test' }));
        return;
      }
      if (url.pathname === '/command') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const claims = verifyJwt(body.token, SECRET);
        assert.equal(request.headers.authorization, 'Bearer ' + body.token);
        assert.equal(claims.operation, 'command');
        assert.equal(claims.c, body.c);
        assert.equal(claims.key, body.key);
        assert.equal(claims.userdata, body.userdata);
        fixture.commands.push(body);
        if (body.c === 'version')
          response.end(
            JSON.stringify({
              error: fixture.commandVersionError,
              version: '10.0.0-test',
            })
          );
        else if (fixture.commandHook) await fixture.commandHook(body, response);
        else response.end(JSON.stringify({ error: fixture.commandError, key: body.key }));
        return;
      }
      const generated = fixture.generated.get(url.pathname);
      if (generated) {
        const token = request.headers.authorization?.replace(/^Bearer /, '');
        const claims = verifyJwt(token, SECRET);
        assert.equal(claims.operation, 'download');
        assert.equal(claims.url, fixture.mockOrigin + request.url);
        fixture.downloads.push(url.pathname);
        if (generated.redirect) {
          response.writeHead(302, { Location: generated.redirect });
          response.end();
        } else {
          response.writeHead(generated.status ?? 200, generated.headers ?? {});
          if (generated.chunked) response.write(generated.bytes.subarray(0, 1));
          response.end(generated.chunked ? generated.bytes.subarray(1) : generated.bytes);
        }
        return;
      }
      response.writeHead(404);
      response.end();
    })().catch((error) => {
      fixture.mockErrors.push(error);
      if (!response.headersSent) response.writeHead(500);
      response.end('Mock Docs failed');
    });
  });
  fixture.mockOrigin = await listen(fixture.mock);
  fixture.bridgeOptions = {
    jwtSecret: SECRET,
    dataDir: fixture.dataDir,
    documentServerInternalUrl: fixture.mockOrigin,
    documentServerUrl: PUBLIC_DOCS,
    bridgeInternalUrl: 'http://bridge:8790',
    fetchTimeoutMs: 2000,
    ...options,
  };
  fixture.restart = async () => {
    await close(fixture.bridge);
    fixture.bridge = await createOfficeBridge(fixture.bridgeOptions);
    fixture.origin = await listen(fixture.bridge);
  };
  t.after(async () => {
    await close(fixture.bridge);
    await close(fixture.mock);
    await rm(fixture.dataDir, { recursive: true, force: true });
    assert.deepEqual(fixture.mockErrors, []);
  });
  await fixture.restart();
  fixture.upload = (query = {}, bytes = original, headers = {}) => {
    const params = new URLSearchParams({
      workspaceId: 'workspace-test',
      fileId: 'file-test',
      name: '测试文档.docx',
      revision: '1',
      mode: 'edit',
      ...query,
    });
    return fetch(fixture.origin + '/api/office/sessions?' + params, {
      method: 'POST',
      headers: { Origin: ORIGIN, ...headers },
      body: bytes,
    });
  };
  fixture.create = async (query = {}, bytes = original) => {
    const response = await fixture.upload(query, bytes);
    assert.equal(response.status, 201);
    return response.json();
  };
  fixture.request = (session, suffix = '', init = {}) =>
    fetch(fixture.origin + '/api/office/sessions/' + session.id + suffix, {
      ...init,
      headers: { Origin: ORIGIN, 'X-Office-Session-Token': session.accessToken, ...init.headers },
    });
  fixture.state = async (session) => {
    const response = await fixture.request(session);
    assert.equal(response.status, 200);
    return response.json();
  };
  fixture.force = async (session, requestId = randomUUID()) => {
    const response = await fixture.request(session, '/force-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    return { status: response.status, body: await response.json() };
  };
  fixture.ack = (session, result, revision) =>
    fixture.request(session, '/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: result.sequence, hash: result.hash, revision }),
    });
  fixture.callback = (session, payload, overrides = {}) => {
    const body = { key: session.key, ...payload };
    const token =
      overrides.token ??
      signJwt(
        overrides.flat
          ? { ...body, operation: 'callback' }
          : { payload: body, operation: 'callback' },
        SECRET
      );
    const url = new URL(session.config.editorConfig.callbackUrl);
    if (overrides.cap) url.searchParams.set('cap', overrides.cap);
    return fetch(fixture.origin + url.pathname + url.search, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(overrides.headerToken ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        ...body,
        ...(overrides.headerToken ? {} : { token }),
        ...overrides.raw,
      }),
    });
  };
  fixture.output = async (session, sequence) => {
    const response = await fixture.request(session, '/results/' + sequence);
    assert.equal(response.status, 200);
    return Buffer.from(await response.arrayBuffer());
  };
  fixture.source = async (session, init = {}) => {
    const url = new URL(session.config.document.url);
    const response = await fetch(fixture.origin + url.pathname + url.search, init);
    assert.equal(response.status, 200);
    return Buffer.from(await response.arrayBuffer());
  };
  fixture.saveResult = async (session, bytes, payload = {}) => {
    const path = '/generated/' + randomUUID() + '.bin';
    fixture.generated.set(path, { bytes });
    const callback = { status: 6, url: fixture.mockOrigin + path, ...payload };
    const response = await fixture.callback(session, callback);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { error: 0 });
    return { state: await fixture.state(session), callback };
  };
  return fixture;
}

test('JWT verification rejects malformed headers, signatures, lifetimes and operations', () => {
  const signed = signJwt({ operation: 'callback', payload: { status: 1 } }, SECRET);
  assert.equal(verifyJwt(signed, SECRET).payload.status, 1);
  const forge = (header, body) => {
    const parts = [header, body].map((value) =>
      Buffer.from(JSON.stringify(value)).toString('base64url')
    );
    const unsigned = parts.join('.');
    return unsigned + '.' + createHmac('sha256', SECRET).update(unsigned).digest('base64url');
  };
  for (const invalid of [
    signed + 'wrong',
    'not-a-token',
    signJwt({}, SECRET, -1),
    signJwt({ nbf: Math.floor(Date.now() / 1000) + 100 }, SECRET),
    forge(null, {}),
    forge({ alg: 'none' }, {}),
    forge({ alg: 'HS256' }, []),
  ]) {
    assert.throws(
      () => verifyJwt(invalid, SECRET),
      (error) => error.status === 401
    );
  }
  assert.throws(
    () => verifyJwt(signed, 'a-different-secret'),
    (error) => error.status === 401
  );
});

test('health checks the configured engine and reports its public address', async (t) => {
  const f = await fixture(t);
  const response = await fetch(f.origin + '/api/office/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    available: true,
    documentServerUrl: PUBLIC_DOCS,
    version: '10.0.0-test',
    error: '',
  });
  f.healthAvailable = false;
  await f.restart();
  const unavailable = await (await fetch(f.origin + '/api/office/health')).json();
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.version, null);
});

test('health obtains authenticated version metadata when the info endpoint is restricted', async (t) => {
  const f = await fixture(t);
  f.infoAvailable = false;
  const authenticated = await (await fetch(f.origin + '/api/office/health')).json();
  assert.equal(authenticated.available, true);
  assert.equal(authenticated.version, '10.0.0-test');
  assert.equal(f.commands.length, 1);
  assert.equal(f.commands[0].c, 'version');
  f.commandVersionError = 6;
  f.bridgeOptions.documentServerVersion = 'configured-version';
  await f.restart();
  const configured = await (await fetch(f.origin + '/api/office/health')).json();
  assert.equal(configured.available, true);
  assert.equal(configured.version, 'configured-version');
  delete f.bridgeOptions.documentServerVersion;
  await f.restart();
  const missing = await (await fetch(f.origin + '/api/office/health')).json();
  assert.equal(missing.available, true);
  assert.equal(missing.version, null);
});

test('Word, spreadsheet and PDF sessions have signed editor configurations and immutable originals', async (t) => {
  const f = await fixture(t);
  for (const [name, bytes, documentType] of [
    ['报告.DOCX', original, 'word'],
    ['预算.xlsx', archive('spreadsheet-original'), 'cell'],
    ['合同.pdf', Buffer.from('%PDF-1.7\npdf-original'), 'pdf'],
  ]) {
    const session = await f.create({ name, revision: '7' }, bytes);
    const claims = verifyJwt(session.config.token, SECRET);
    assert.equal(claims.document.key, session.key);
    assert.equal(session.config.documentType, documentType);
    assert.equal(session.config.editorConfig.lang, 'zh-CN');
    assert.equal(session.config.document.permissions.edit, true);
    if (documentType === 'pdf') assert.equal(session.config.document.isForm, false);
    assert.deepEqual(await f.source(session), bytes);
    const state = await f.state(session);
    assert.equal(state.baseRevision, 7);
    assert.equal(state.ackRevision, 7);
    assert.equal(state.ackSequence, 0);
    assert.equal(state.fileId, 'file-test');
    const manifest = await readFile(join(f.dataDir, session.id, 'manifest.json'), 'utf8');
    assert.ok(!manifest.includes(session.accessToken));
    assert.equal(JSON.parse(manifest).sourceHash, sha256(bytes));
  }
});

test('invalid uploads, legacy extensions and file-size overflow are rejected before session creation', async (t) => {
  const f = await fixture(t, { maxFileBytes: 64 });
  for (const query of [
    { name: '../escape.docx' },
    { name: 'legacy.doc' },
    { name: 'legacy.xls' },
    { name: 'prototype.constructor' },
    { name: 'bad.pdf' },
    { revision: '0' },
    { revision: '1.5' },
    { mode: 'unknown' },
    { workspaceId: '' },
  ]) {
    const response = await f.upload(query);
    assert.equal(response.status, 400);
    await response.text();
  }
  const invalid = await f.upload({}, Buffer.from('not-a-zip'));
  assert.equal(invalid.status, 400);
  await invalid.text();
  const oversized = await f.upload({}, archive('x'.repeat(100)));
  assert.equal(oversized.status, 413);
  await oversized.text();
  assert.deepEqual(await readdir(f.dataDir), []);
});

test('browser mutations require local Origin and every session read requires its own access token', async (t) => {
  const f = await fixture(t);
  for (const origin of ['https://example.test', 'null', 'http://localhost:5173/path']) {
    const response = await f.upload({}, original, { Origin: origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    await response.text();
  }
  const params = new URLSearchParams({
    workspaceId: 'ws',
    fileId: 'file',
    name: 'a.docx',
    revision: '1',
    mode: 'edit',
  });
  const noOrigin = await fetch(f.origin + '/api/office/sessions?' + params, {
    method: 'POST',
    body: original,
  });
  assert.equal(noOrigin.status, 403);
  await noOrigin.text();
  const session = await f.create();
  const another = await f.create({ fileId: 'another-file' });
  for (const token of ['', 'invalid-token', another.accessToken]) {
    const denied = await f.request(session, '', { headers: { 'X-Office-Session-Token': token } });
    assert.equal(denied.status, 401);
    await denied.text();
  }
  const preflight = await f.request(session, '/force-save', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  assert.ok(
    preflight.headers.get('access-control-allow-headers').includes('X-Office-Session-Token')
  );
  const wrongCap = new URL(session.config.document.url);
  wrongCap.searchParams.set('cap', 'wrong');
  const deniedSource = await fetch(f.origin + wrongCap.pathname + wrongCap.search);
  assert.equal(deniedSource.status, 401);
  await deniedSource.text();
  const source = new URL(session.config.document.url);
  const wrongPurpose = await fetch(f.origin + source.pathname + source.search, {
    headers: { Authorization: 'Bearer ' + signJwt({ operation: 'command' }, SECRET) },
  });
  assert.equal(wrongPurpose.status, 401);
  await wrongPurpose.text();
});

test('callback capabilities, signed payload matching and read-only sessions prevent unauthorized writes', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const payload = { status: 1 };
  for (const overrides of [
    { cap: 'wrong' },
    { token: signJwt({ payload: { key: session.key, status: 1 }, operation: 'command' }, SECRET) },
    { raw: { status: 2, url: 'https://example.test/file' } },
    { token: 'invalid-jwt' },
  ]) {
    const response = await f.callback(session, payload, overrides);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 1);
  }
  const flat = await f.callback(session, payload, { flat: true, headerToken: true });
  assert.equal(flat.status, 200);
  await flat.text();
  const viewer = await f.create({ mode: 'view' });
  assert.equal(viewer.config.document.permissions.edit, false);
  assert.equal(viewer.config.editorConfig.mode, 'view');
  assert.equal((await f.force(viewer)).status, 403);
  const write = await f.callback(viewer, { status: 6, url: f.mockOrigin + '/generated/file' });
  assert.equal(write.status, 403);
  await write.text();
  assert.equal((await f.state(viewer)).sequence, 0);
  assert.deepEqual(await f.source(viewer), original);
});

test('force-save correlates a requestId, deduplicates requests and preserves saving through status 1', async (t) => {
  const f = await fixture(t);
  const session = await f.create({ revision: '7' });
  const requestId = randomUUID();
  const [first, duplicate] = await Promise.all([
    f.force(session, requestId),
    f.force(session, requestId),
  ]);
  assert.equal(first.status, 200);
  assert.deepEqual(first, duplicate);
  assert.equal(first.body.forceSaveId, requestId);
  assert.equal(first.body.noChanges, false);
  assert.equal(f.commands.length, 1);
  assert.equal(f.commands[0].userdata, requestId);
  const editing = await f.callback(session, { status: 1 });
  assert.equal(editing.status, 200);
  await editing.text();
  assert.equal((await f.state(session)).state, 'saving');
  assert.equal((await f.force(session)).status, 409);
  const bytes = archive('changed-by-office');
  const path = '/generated/saved.docx';
  f.generated.set(path, { bytes });
  const callback = {
    status: 6,
    userdata: requestId,
    forcesavetime: 1800000000,
    url: PUBLIC_DOCS + path,
  };
  const saved = await f.callback(session, callback);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { error: 0 });
  const state = await f.state(session);
  assert.equal(state.state, 'saved');
  assert.equal(state.result.requestId, requestId);
  assert.equal(state.sequence, 1);
  assert.equal(state.ackSequence, 0);
  assert.deepEqual(await f.output(session, 1), bytes);
  assert.deepEqual(await f.source(session), bytes);
  assert.deepEqual(await readFile(join(f.dataDir, session.id, 'source.docx')), original);
  const ack = await f.ack(session, state.result, 8);
  assert.equal(ack.status, 200);
  assert.equal((await ack.json()).ackRevision, 8);
  const duplicateCallback = await f.callback(session, callback);
  assert.equal(duplicateCallback.status, 200);
  await duplicateCallback.text();
  assert.equal(f.downloads.length, 1);
  assert.equal((await f.force(session, requestId)).status, 200);
  assert.equal(f.commands.length, 1);
  assert.equal((await f.state(session)).key, session.key);
});

test('same-byte force-save updates requestId without incrementing the generated sequence', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const firstId = randomUUID();
  await f.force(session, firstId);
  const bytes = archive('same-generated-bytes');
  const first = await f.saveResult(session, bytes, { status: 6, userdata: firstId });
  const ack = await f.ack(session, first.state.result, 2);
  assert.equal(ack.status, 200);
  await ack.text();
  const secondId = randomUUID();
  await f.force(session, secondId);
  const second = await f.saveResult(session, bytes, { status: 6, userdata: secondId });
  assert.equal(second.state.sequence, 1);
  assert.equal(second.state.result.requestId, secondId);
  assert.equal(second.state.ackSequence, 1);
  const stale = await f.saveResult(session, archive('stale-command-bytes'), {
    status: 6,
    userdata: firstId,
    forcesavetime: 1900000000,
  });
  assert.equal(stale.state.sequence, 1);
  assert.equal(stale.state.result.requestId, secondId);
  assert.deepEqual(await f.output(session, 1), bytes);
});

test('unmarked autosave results stay pending until the matching force-save callback confirms them', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const requestId = randomUUID();
  await f.force(session, requestId);
  const bytes = archive('unmarked-autosave');
  const unmarked = await f.saveResult(session, bytes);
  assert.equal(unmarked.state.sequence, 1);
  assert.equal(unmarked.state.state, 'saving');
  assert.equal(unmarked.state.result.requestId, undefined);
  assert.equal((await f.force(session)).status, 409);
  const confirmed = await f.saveResult(session, bytes, { status: 6, userdata: requestId });
  assert.equal(confirmed.state.sequence, 1);
  assert.equal(confirmed.state.result.requestId, requestId);
  assert.equal(confirmed.state.state, 'saved');
});

test('generated versions are retained and ACKs cannot falsify or roll back workspace revisions', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const firstBytes = archive('version-one');
  const first = await f.saveResult(session, firstBytes);
  for (const [result, revision] of [
    [{ ...first.state.result, hash: '0'.repeat(64) }, 2],
    [first.state.result, 1],
    [{ ...first.state.result, sequence: 999 }, 2],
  ]) {
    const denied = await f.ack(session, result, revision);
    assert.equal(denied.status, 409);
    await denied.text();
  }
  const ackOne = await f.ack(session, first.state.result, 2);
  assert.equal(ackOne.status, 200);
  await ackOne.text();
  const secondBytes = archive('version-two');
  const second = await f.saveResult(session, secondBytes);
  assert.equal(second.state.sequence, 2);
  const sameRevision = await f.ack(session, second.state.result, 2);
  assert.equal(sameRevision.status, 409);
  await sameRevision.text();
  const ackTwo = await f.ack(session, second.state.result, 3);
  assert.equal(ackTwo.status, 200);
  await ackTwo.text();
  const rollback = await f.ack(session, first.state.result, 4);
  assert.equal(rollback.status, 409);
  await rollback.text();
  const repeated = await f.ack(session, second.state.result, 3);
  assert.equal(repeated.status, 200);
  await repeated.text();
  const inconsistent = await f.ack(session, second.state.result, 4);
  assert.equal(inconsistent.status, 409);
  await inconsistent.text();
  assert.deepEqual(await f.output(session, 1), firstBytes);
  assert.deepEqual(await f.output(session, 2), secondBytes);
  assert.deepEqual(await readFile(join(f.dataDir, session.id, 'source.docx')), original);
});

test('command error 4 reports noChanges while leaving unacknowledged output visible', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  f.commandError = 4;
  const requestId = randomUUID();
  const first = await f.force(session, requestId);
  assert.equal(first.status, 200);
  assert.equal(first.body.noChanges, true);
  assert.equal(first.body.accepted, false);
  assert.equal(first.body.sequence, 0);
  assert.equal((await f.force(session, requestId)).body.noChanges, true);
  assert.equal(f.commands.length, 1);
  await f.saveResult(session, archive('unacknowledged-office-version'));
  const next = await f.force(session);
  assert.equal(next.body.noChanges, true);
  assert.equal(next.body.sequence, 1);
  const state = await f.state(session);
  assert.equal(state.ackSequence, 0);
  assert.equal(state.sequence, 1);
});

test('external result URLs and redirects are rejected while allowed relative redirects succeed', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const external = await f.callback(session, {
    status: 2,
    url: 'https://example.test/generated.docx',
  });
  assert.equal(external.status, 400);
  await external.text();
  assert.equal(f.downloads.length, 0);
  f.generated.set('/generated/unsafe', { redirect: 'http://localhost:65532/private' });
  const redirected = await f.callback(session, {
    status: 2,
    url: f.mockOrigin + '/generated/unsafe',
  });
  assert.equal(redirected.status, 400);
  await redirected.text();
  assert.deepEqual(f.downloads, ['/generated/unsafe']);
  const bytes = archive('redirected-office-version');
  f.generated.set('/generated/safe', { redirect: '/generated/target' });
  f.generated.set('/generated/target', { bytes });
  const allowed = await f.callback(session, { status: 2, url: PUBLIC_DOCS + '/generated/safe' });
  assert.equal(allowed.status, 200);
  await allowed.text();
  assert.deepEqual(await f.output(session, 1), bytes);
});

test('public generated file ports are cleared when the internal Docs address uses its default port', async (t) => {
  const f = await fixture(t, {
    documentServerInternalUrl: 'http://documentserver',
    documentServerUrl: 'http://127.0.0.1:8082',
  });
  const session = await f.create();
  const nativeFetch = globalThis.fetch;
  const bytes = archive('default-internal-port-result');
  const downloads = [];
  t.after(() => {
    globalThis.fetch = nativeFetch;
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'documentserver') {
      downloads.push(url.href);
      assert.equal(url.href, 'http://documentserver/generated/default-port.docx');
      return new Response(bytes);
    }
    return nativeFetch(input, init);
  };
  const saved = await f.callback(session, {
    status: 6,
    url: 'http://127.0.0.1:8082/generated/default-port.docx',
  });
  assert.equal(saved.status, 200);
  await saved.text();
  assert.deepEqual(downloads, ['http://documentserver/generated/default-port.docx']);
  assert.deepEqual(await f.output(session, 1), bytes);
});

test('oversized, invalid and failed outputs preserve the source and previously generated versions', async (t) => {
  const f = await fixture(t, { maxFileBytes: 64 });
  const session = await f.create();
  const firstBytes = archive('valid-version');
  await f.saveResult(session, firstBytes);
  for (const [path, generated, expected] of [
    [
      '/generated/large-header',
      { bytes: archive('x'.repeat(100)), headers: { 'Content-Length': '104' } },
      413,
    ],
    ['/generated/large-stream', { bytes: archive('x'.repeat(100)), chunked: true }, 413],
    ['/generated/invalid', { bytes: Buffer.from('<html>conversion failed</html>') }, 502],
    ['/generated/failed', { bytes: Buffer.from('failed'), status: 503 }, 502],
  ]) {
    f.generated.set(path, generated);
    const response = await f.callback(session, { status: 2, url: f.mockOrigin + path });
    assert.equal(response.status, expected);
    assert.equal((await response.json()).error, 1);
    assert.equal((await f.state(session)).sequence, 1);
    assert.deepEqual(await f.output(session, 1), firstBytes);
    assert.deepEqual(await readFile(join(f.dataDir, session.id, 'source.docx')), original);
  }
});

test('late unmarked callbacks cannot replace a result with an earlier save timestamp', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const latestBytes = archive('latest-timestamp-version');
  await f.saveResult(session, latestBytes, { lastsave: '2027-01-15T08:00:00.000Z' });
  const older = await f.saveResult(session, archive('older-version'), {
    forcesavetime: Date.parse('2027-01-14T08:00:00.000Z') / 1000,
  });
  assert.equal(older.state.sequence, 1);
  assert.deepEqual(await f.output(session, 1), latestBytes);
});

test('manifest failures never expose uncommitted sequence numbers and retain generated bytes for retry', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const firstBytes = archive('committed-version');
  const first = await f.saveResult(session, firstBytes);
  const folder = join(f.dataDir, session.id);
  const manifest = join(folder, 'manifest.json');
  const backup = join(folder, 'manifest-before-test.json');
  await rename(manifest, backup);
  await mkdir(manifest);
  const pendingBytes = archive('generated-before-manifest-error');
  const path = '/generated/persistence-failure';
  f.generated.set(path, { bytes: pendingBytes });
  const callback = { status: 2, url: f.mockOrigin + path };
  const failed = await f.callback(session, callback);
  assert.equal(failed.status, 500);
  await failed.text();
  const unchanged = await f.state(session);
  assert.equal(unchanged.sequence, 1);
  assert.equal(unchanged.result.hash, first.state.result.hash);
  assert.deepEqual(await f.output(session, 1), firstBytes);
  assert.deepEqual(await readFile(join(folder, 'source.docx')), original);
  const retained = (await readdir(folder)).find(
    (name) => name === 'result-2-' + sha256(pendingBytes) + '.docx'
  );
  assert.ok(retained);
  assert.deepEqual(await readFile(join(folder, retained)), pendingBytes);
  await rm(manifest, { recursive: true });
  await rename(backup, manifest);
  const retried = await f.callback(session, callback);
  assert.equal(retried.status, 200);
  await retried.text();
  assert.equal((await f.state(session)).sequence, 2);
});

test('restart restores sessions, request confirmations, ACKs and the latest recoverable source', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const requestId = randomUUID();
  await f.force(session, requestId);
  const bytes = archive('recovered-version');
  const saved = await f.saveResult(session, bytes, { status: 6, userdata: requestId });
  const ack = await f.ack(session, saved.state.result, 2);
  assert.equal(ack.status, 200);
  await ack.text();
  const invalidId = randomUUID();
  const invalidFolder = join(f.dataDir, invalidId);
  await mkdir(invalidFolder);
  const invalidManifest = JSON.parse(
    await readFile(join(f.dataDir, session.id, 'manifest.json'), 'utf8')
  );
  invalidManifest.id = invalidId;
  invalidManifest.results[0].filename = '../../unrelated-file.docx';
  await writeFile(join(invalidFolder, 'manifest.json'), JSON.stringify(invalidManifest));
  await f.restart();
  const state = await f.state(session);
  assert.equal(state.key, session.key);
  assert.equal(state.ackRevision, 2);
  assert.equal(state.ackSequence, 1);
  assert.equal(state.result.requestId, requestId);
  assert.deepEqual(await f.output(session, 1), bytes);
  assert.deepEqual(await f.source(session), bytes);
  assert.equal((await f.force(session, requestId)).status, 200);
  assert.equal(f.commands.length, 1);
  const invalid = await f.request({ ...session, id: invalidId });
  assert.equal(invalid.status, 404);
  await invalid.text();
  assert.ok(await readFile(join(invalidFolder, 'manifest.json'), 'utf8'));
});

test('command failures can be retried with a fresh request without losing successful callback data', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  f.commandError = 1;
  const failedId = randomUUID();
  assert.equal((await f.force(session, failedId)).status, 502);
  assert.equal((await f.state(session)).state, 'error');
  assert.equal((await f.force(session, failedId)).status, 502);
  assert.equal(f.commands.length, 1);
  f.commandHook = async (body, response) => {
    await f.saveResult(session, archive('callback-before-command-response'), {
      status: 6,
      userdata: body.userdata,
    });
    response.writeHead(503);
    response.end('Command response lost');
  };
  const success = await f.force(session);
  assert.equal(success.status, 200);
  assert.equal(success.body.accepted, true);
  const state = await f.state(session);
  assert.equal(state.state, 'saved');
  assert.equal(state.result.requestId, success.body.requestId);
  assert.deepEqual(await readFile(join(f.dataDir, session.id, 'source.docx')), original);
});

test('force-save rejects missing or malformed requestId before sending a Docs command', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  for (const body of ['{}', '{"requestId":"arbitrary"}', '[]', 'not-json']) {
    const response = await f.request(session, '/force-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.equal(response.status, 400);
    await response.text();
  }
  assert.equal(f.commands.length, 0);
  assert.equal((await f.state(session)).state, 'opening');
});

test('final-save and no-change close callbacks end sessions while force-save callbacks keep them open', async (t) => {
  const f = await fixture(t);
  const session = await f.create();
  const live = await f.saveResult(session, archive('live-force-saved-version'));
  assert.equal(live.state.state, 'saved');
  const finalBytes = archive('final-closed-version');
  const final = await f.saveResult(session, finalBytes, { status: 2 });
  assert.equal(final.state.state, 'closed');
  assert.equal(final.state.sequence, 2);
  assert.equal((await f.force(session)).status, 409);
  const late = await f.saveResult(session, archive('late-force-save'));
  assert.equal(late.state.state, 'closed');
  assert.equal(late.state.sequence, 2);
  assert.deepEqual(await f.output(session, 2), finalBytes);
  const editing = await f.callback(session, { status: 1 });
  assert.equal(editing.status, 200);
  await editing.text();
  assert.equal((await f.state(session)).state, 'closed');
  const noChanges = await f.create({ fileId: 'closed-without-changes' });
  const closed = await f.callback(noChanges, { status: 4 });
  assert.equal(closed.status, 200);
  await closed.text();
  const state = await f.state(noChanges);
  assert.equal(state.state, 'closed');
  assert.equal(state.sequence, 0);
  assert.deepEqual(await f.source(noChanges), original);
});
