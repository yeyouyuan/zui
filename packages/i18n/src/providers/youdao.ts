/**
 * 有道适配器（有道智云文本翻译 /api）—— 见 CONTRACTS-V3 §2。零重依赖：只用 fetch + WebCrypto。
 * 鉴权（signType v3）：sign = sha256(appKey + truncate(q) + salt + curtime + appSecret)。
 */
import type { TranslateProviderOptions, TranslateRequest } from '../useAutoTranslate.js';

const DEFAULT_ENDPOINT = 'https://openapi.youdao.com/api';

/** 通用语言码 → 有道语言码（zh / zh-CHS、en） */
export function toYoudaoLang(code: string): string {
  const normalized = code.toLowerCase();
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans') return 'zh-CHS';
  return code;
}

/** 有道 input 字段：≤20 字符取原文，否则 sha256(原文) */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 有道鉴权签名：sha256(appKey + truncate(q) + salt + curtime + appSecret) */
export async function computeYoudaoSign(
  q: string,
  appKey: string,
  salt: string,
  curtime: string,
  appSecret: string
): Promise<string> {
  const input = q.length <= 20 ? q : `${q.slice(0, 10)}${q.length}${q.slice(-10)}`;
  return sha256Hex(`${appKey}${input}${salt}${curtime}${appSecret}`);
}

/** 有道批量翻译（逐条请求；有道 /api 为单条接口） */
export async function translateWithYoudao(
  request: TranslateRequest,
  options: TranslateProviderOptions = {}
): Promise<string[]> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const appKey = options.apiKey ?? '';
  const appSecret = options.appSecret ?? '';
  const results: string[] = [];
  for (const q of request.texts) {
    const salt = globalThis.crypto.randomUUID();
    const curtime = String(Math.floor(Date.now() / 1000));
    const sign = await computeYoudaoSign(q, appKey, salt, curtime, appSecret);
    const form = new URLSearchParams({
      q,
      from: toYoudaoLang(request.sourceLang),
      to: toYoudaoLang(request.targetLang),
      appKey,
      salt,
      sign,
      signType: 'v3',
      curtime,
    });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`有道翻译失败：HTTP ${res.status}`);
    const data = (await res.json()) as { errorCode?: string; translation?: string[] };
    if (data.errorCode && data.errorCode !== '0') {
      throw new Error(`有道翻译失败：errorCode ${data.errorCode}`);
    }
    const translation = data.translation?.[0];
    if (typeof translation !== 'string' || translation.length === 0) {
      throw new Error('有道翻译失败：响应缺少 translation');
    }
    results.push(translation);
  }
  return results;
}
