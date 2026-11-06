'use client';

/**
 * @zui/i18n —— ZUI 组件内置文案自动翻译（CONTRACTS-V3 §2）。
 *
 * 核心：useAutoTranslate（t / tSync / isLoading / error / clearCache）
 * provider 适配：openai / deepl / youdao / custom（fetch 实现，零重依赖）
 * 缓存：localStorage，按语言、provider 和文案上下文隔离
 */

export {
  useAutoTranslate,
  createProviderTranslator,
  type TranslateProvider,
  type TranslateContext,
  type TranslateConfig,
  type TranslateRequest,
  type TranslateProviderOptions,
  type TranslateFn,
  type AutoTranslateResult,
} from './useAutoTranslate.js';

export {
  createTranslationCache,
  createMemoryStorage,
  resolveCacheStorage,
  hashKey,
  DEFAULT_CACHE_KEY,
  MAX_CACHE_ENTRIES,
  type TranslationCache,
  type TranslationCacheStorage,
} from './cache.js';

export { translateWithOpenAI, buildSystemPrompt, describeContext } from './providers/openai.js';
export { translateWithDeepL, toDeepLLang } from './providers/deepl.js';
export { translateWithYoudao, toYoudaoLang, computeYoudaoSign, sha256Hex } from './providers/youdao.js';
export { translateWithCustom } from './providers/custom.js';
