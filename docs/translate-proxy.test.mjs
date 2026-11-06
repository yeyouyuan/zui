import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createTranslateProxy } from './translate-proxy.mjs';

const { fetch } = globalThis;

const requests = [];
let upstream;
let proxy;
let url;

before(async () => {
  upstream = createServer(async (req, res) => {
    const body = await new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => resolve(JSON.parse(raw)));
    });
    requests.push({ authorization: req.headers.authorization, body });
    const text = body.messages[1].content;
    if (text === '失败') {
      res.writeHead(503).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: `EN:${text}` } }] }));
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => upstream.once('listening', resolve));
  proxy = createTranslateProxy({
    baseURL: `http://127.0.0.1:${upstream.address().port}/v1`,
    key: 'test-key',
    model: 'translate',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => proxy.once('listening', resolve));
  url = `http://127.0.0.1:${proxy.address().port}/api/translate`;
});

after(async () => {
  await Promise.all([
    new Promise((resolve) => proxy.close(resolve)),
    new Promise((resolve) => upstream.close(resolve)),
  ]);
});

test('translates a batch with context and keeps the key on the server', async () => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts: ['请选择', '关闭'],
      sourceLang: 'zh',
      targetLang: 'en',
      contexts: [{ component: 'Select', role: 'placeholder' }, { component: 'Modal' }],
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { translations: ['EN:请选择', 'EN:关闭'] });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].authorization, 'Bearer test-key');
  assert.equal(requests[0].body.model, 'translate');
  assert.match(requests[0].body.messages[0].content, /Select/);
});

test('rejects malformed requests and reports upstream failures', async () => {
  const malformed = await fetch(url, { method: 'POST', body: JSON.stringify({ texts: [] }) });
  assert.equal(malformed.status, 400);
  const upstreamFailure = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ texts: ['失败'], sourceLang: 'zh', targetLang: 'en' }),
  });
  assert.equal(upstreamFailure.status, 502);
});

test('rejects oversized bodies and mismatched context arrays', async () => {
  const oversized = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ texts: ['a'.repeat(64_001)], sourceLang: 'zh', targetLang: 'en' }),
  });
  assert.equal(oversized.status, 413);
  const mismatched = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ texts: ['请选择'], contexts: [], sourceLang: 'zh', targetLang: 'en' }),
  });
  assert.equal(mismatched.status, 400);
});

test('rejects URL credentials and query parameters', () => {
  for (const baseURL of ['https://user:pass@example.com/v1', 'https://example.com/v1?key=abc']) {
    assert.throws(() => createTranslateProxy({ baseURL, key: 'test-key', model: 'translate' }));
  }
});
