/**
 * DeepL 适配器（/v2/translate）—— 见 CONTRACTS-V3 §2。零重依赖：只用 fetch。
 * apiKey 为 DeepL Auth Key；指定代理 endpoint 时可由代理在服务端注入密钥。
 */
import type { TranslateProviderOptions, TranslateRequest } from '../useAutoTranslate.js';

const DEFAULT_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

/** 通用语言码 → DeepL 语言码（大写；zh → ZH、en-US → EN-US） */
export function toDeepLLang(code: string): string {
  const [base, region] = code.split('-');
  return region ? `${base.toUpperCase()}-${region.toUpperCase()}` : base.toUpperCase();
}

/** DeepL 批量翻译 */
export async function translateWithDeepL(
  request: TranslateRequest,
  options: TranslateProviderOptions = {}
): Promise<string[]> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `DeepL-Auth-Key ${options.apiKey}` } : {}),
    },
    body: JSON.stringify({
      text: request.texts,
      source_lang: toDeepLLang(request.sourceLang),
      target_lang: toDeepLLang(request.targetLang),
    }),
  });
  if (!res.ok) throw new Error(`DeepL 翻译失败：HTTP ${res.status}`);
  const data = (await res.json()) as { translations?: { text: string }[] };
  const translations = data.translations;
  if (!Array.isArray(translations) || translations.length < request.texts.length) {
    throw new Error('DeepL 翻译失败：响应缺少 translations');
  }
  return translations.slice(0, request.texts.length).map((item) => item.text);
}
