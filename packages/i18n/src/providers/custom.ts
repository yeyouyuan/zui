/**
 * 自定义端点适配器 —— POST endpoint { texts, sourceLang, targetLang } → { translations: string[] }，
 * 见 CONTRACTS-V3 §2。零重依赖：只用 fetch。
 */
import type { TranslateProviderOptions, TranslateRequest } from '../useAutoTranslate.js';

/** 自定义端点批量翻译 */
export async function translateWithCustom(
  request: TranslateRequest,
  options: TranslateProviderOptions = {}
): Promise<string[]> {
  if (!options.endpoint) {
    throw new Error(
      'custom provider 需要提供 endpoint（POST { texts, sourceLang, targetLang } → { translations }）'
    );
  }
  const res = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    },
    body: JSON.stringify({
      texts: request.texts,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      contexts: request.contexts,
    }),
  });
  if (!res.ok) throw new Error(`自定义端点翻译失败：HTTP ${res.status}`);
  const data = (await res.json()) as { translations?: string[] };
  const translations = data.translations;
  if (!Array.isArray(translations) || translations.length < request.texts.length) {
    throw new Error('自定义端点翻译失败：响应缺少 translations');
  }
  return translations.slice(0, request.texts.length);
}
