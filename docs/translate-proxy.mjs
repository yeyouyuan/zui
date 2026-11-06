import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';

const { URL, fetch, AbortSignal } = globalThis;

const MAX_BODY_BYTES = 64_000;
const MAX_TEXTS = 20;
const MAX_CONCURRENT_REQUESTS = 3;

function upstreamURL(baseURL) {
  const url = new URL(baseURL);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('TRANSLATE_BASE_URL must use HTTP or HTTPS');
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new Error(
      'TRANSLATE_BASE_URL must be an API root without query, fragment or credentials'
    );
  }
  const base = baseURL.replace(/\/+$/, '');
  return `${base}${url.pathname === '/' ? '/v1' : ''}/chat/completions`;
}

function validRequest(input) {
  return (
    input &&
    Array.isArray(input.texts) &&
    input.texts.length > 0 &&
    input.texts.length <= MAX_TEXTS &&
    input.texts.every(
      (text) => typeof text === 'string' && text.length > 0 && text.length <= 2_000
    ) &&
    typeof input.sourceLang === 'string' &&
    /^[a-zA-Z-]{2,20}$/.test(input.sourceLang) &&
    typeof input.targetLang === 'string' &&
    /^[a-zA-Z-]{2,20}$/.test(input.targetLang) &&
    (input.contexts === undefined ||
      (Array.isArray(input.contexts) &&
        input.contexts.length === input.texts.length &&
        input.contexts.every(
          (context) =>
            context == null ||
            (typeof context === 'object' &&
              ['component', 'role'].every(
                (field) =>
                  context[field] === undefined ||
                  (typeof context[field] === 'string' && context[field].length <= 100)
              ))
        )))
  );
}

async function translateBatch(input, config) {
  const translations = new Array(input.texts.length);
  let next = 0;
  let firstError;
  const worker = async () => {
    while (!firstError && next < input.texts.length) {
      const index = next++;
      const context = input.contexts?.[index];
      try {
        const response = await fetch(config.upstream, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.key}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: 'system',
                content: `将 UI 文案从 ${input.sourceLang} 翻译为 ${input.targetLang}。只输出译文，保留 {变量}。组件：${context?.component ?? ''}；用途：${context?.role ?? ''}`,
              },
              { role: 'user', content: input.texts[index] },
            ],
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim())
          throw new Error('invalid upstream response');
        translations[index] = content.trim();
      } catch (error) {
        firstError = error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, input.texts.length) }, worker)
  );
  if (firstError) throw firstError;
  return translations;
}

export function createTranslateProxy(config) {
  if (!config.baseURL || !config.key || !config.model) {
    throw new Error('请配置 TRANSLATE_BASE_URL、TRANSLATE_API_KEY、TRANSLATE_MODEL');
  }
  const upstream = upstreamURL(config.baseURL);
  return createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/translate') {
      res.writeHead(404).end();
      return;
    }
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
          res.writeHead(413).end('请求过大');
          return;
        }
      }
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        res.writeHead(400).end('无效 JSON');
        return;
      }
      if (!validRequest(input)) {
        res.writeHead(400).end('无效翻译请求');
        return;
      }
      const translations = await translateBatch(input, {
        upstream,
        key: config.key,
        model: config.model,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ translations }));
    } catch {
      res.writeHead(502).end('翻译服务暂时不可用');
    }
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  createTranslateProxy({
    baseURL: process.env.TRANSLATE_BASE_URL,
    key: process.env.TRANSLATE_API_KEY,
    model: process.env.TRANSLATE_MODEL,
  }).listen(8787, '127.0.0.1');
}
