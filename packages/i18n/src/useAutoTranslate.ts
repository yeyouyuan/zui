'use client';

/**
 * useAutoTranslate —— ZUI 组件内置文案自动翻译（CONTRACTS-V3 §2）。
 *
 * - t(text, context)：异步翻译，context 注入组件上下文提示词（'这是 Select 组件的 placeholder'）
 * - tSync(text)：命中缓存同步返回译文；未命中返回原文并异步回填（回填后自动重渲染）
 * - isLoading / error / clearCache
 * - 缓存 localStorage，按语言、provider 和文案上下文隔离
 * - 错误回退：provider 失败返回原文（不抛给渲染层）
 *
 * 设计：tSync 在渲染期只「读」（缓存/会话表），网络请求延后到 effect 中发起，
 * 完成后 setState 触发重渲染，组件下次渲染即拿到译文。避免渲染期 setState。
 */
import * as React from 'react';
import { createTranslationCache, hashKey, type TranslationCacheStorage } from './cache.js';
import { translateWithOpenAI } from './providers/openai.js';
import { translateWithDeepL } from './providers/deepl.js';
import { translateWithYoudao } from './providers/youdao.js';
import { translateWithCustom } from './providers/custom.js';

/* ---------------------------------- 类型 ---------------------------------- */

export type TranslateProvider = 'openai' | 'deepl' | 'youdao' | 'custom';

/** 组件上下文（注入 provider 提示词） */
export interface TranslateContext {
  /** 组件名，如 'Select' */
  component?: string;
  /** 文案角色，如 'placeholder' | 'clear' | 'close' */
  role?: string;
}

export interface TranslateConfig {
  provider: TranslateProvider;
  /** OpenAI 兼容协议密钥；与已有 apiKey 等价，二者同时提供时优先使用 key。 */
  key?: string;
  apiKey?: string;
  /** OpenAI 兼容 API 根地址，如 https://example.com/v1；自动追加 /chat/completions。 */
  baseURL?: string;
  /** custom 必填；openai 可传完整 Chat Completions 地址，优先于 baseURL。 */
  endpoint?: string;
  /** openai 用，如 'gpt-4o-mini' */
  model?: string;
  /** 有道智云 appSecret（youdao 鉴权用；apiKey 为 appKey） */
  appSecret?: string;
  /** 默认 'zh' */
  sourceLang?: string;
  /** 必填，如 'en' */
  targetLang: string;
  /** 默认 true，localStorage */
  cache?: boolean;
  /** 默认 'zui-translate-cache' */
  cacheKey?: string;
  /** 测试注入：替换底层缓存存储（缺省 localStorage / 内存降级） */
  cacheStorage?: TranslationCacheStorage;
  /** 测试注入：替换 provider（mock provider 测缓存/并发/错误回退） */
  translateFn?: (request: TranslateRequest) => Promise<string[]>;
}

/** 批量翻译请求（provider 适配器输入） */
export interface TranslateRequest {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  /** 与 texts 一一对应的组件上下文（可缺省） */
  contexts?: (TranslateContext | undefined)[];
}

/** provider 适配器参数（fetch 实现） */
export interface TranslateProviderOptions {
  apiKey?: string;
  appSecret?: string;
  baseURL?: string;
  endpoint?: string;
  model?: string;
}

export type TranslateFn = (request: TranslateRequest) => Promise<string[]>;

/** useAutoTranslate 返回值 */
export interface AutoTranslateResult {
  /** 异步翻译；命中缓存立即 resolve；失败回退返回原文 */
  t: (text: string, context?: TranslateContext) => Promise<string>;
  /** 命中缓存同步返回译文，否则返回原文并异步回填 */
  tSync: (text: string, context?: TranslateContext) => string;
  /** 进行中的翻译批次数（>0 时 UI 可显加载态） */
  isLoading: boolean;
  /** 最近一次 provider 错误（翻译失败仍回退原文，不中断渲染） */
  error?: Error;
  /** 清空缓存（localStorage + 会话表） */
  clearCache: () => void;
}

/* -------------------------------- 内部工具 -------------------------------- */

/** 按 provider 路由到 fetch 适配器 */
export function createProviderTranslator(config: TranslateConfig): TranslateFn {
  const options: TranslateProviderOptions = {
    apiKey: config.provider === 'openai' ? (config.key ?? config.apiKey) : config.apiKey,
    appSecret: config.appSecret,
    baseURL: config.baseURL,
    endpoint: config.endpoint,
    model: config.model,
  };
  switch (config.provider) {
    case 'openai':
      return (request) => translateWithOpenAI(request, options);
    case 'deepl':
      return (request) => translateWithDeepL(request, options);
    case 'youdao':
      return (request) => translateWithYoudao(request, options);
    case 'custom':
      return (request) => translateWithCustom(request, options);
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`未知的翻译 provider：${String(exhaustive)}`);
    }
  }
}

/** A translated template must keep exactly the same named variables, including repeats. */
function preservesPlaceholders(source: string, translated: string): boolean {
  const placeholders = (text: string) =>
    Array.from(text.matchAll(/\{[A-Za-z_][A-Za-z0-9_]*\}/g), ([match]) => match).sort();
  const original = placeholders(source);
  const result = placeholders(translated);
  return (
    original.length === result.length && original.every((name, index) => name === result[index])
  );
}

/* --------------------------------- Hook ---------------------------------- */

/**
 * 组件内置文案自动翻译 hook。
 *
 * 缓存命中同步可用（tSync）；未命中走 provider（并发去重：同文案与上下文共享请求）；
 * provider 失败返回原文并在 error 中暴露错误；clearCache 清空后重新翻译。
 */
export function useAutoTranslate(config: TranslateConfig): AutoTranslateResult {
  const {
    provider,
    apiKey,
    key: configuredKey,
    baseURL,
    endpoint,
    model,
    appSecret,
    sourceLang = 'zh',
    targetLang,
    cache: cacheEnabled = true,
    cacheKey,
    cacheStorage,
    translateFn,
  } = config;

  // Each configuration owns its own entries and requests. A response from an old
  // language/provider must never publish into the currently rendered session.
  const session = React.useMemo(
    () => ({
      translate:
        translateFn ??
        createProviderTranslator({
          provider,
          apiKey,
          key: configuredKey,
          baseURL,
          endpoint,
          model,
          appSecret,
          sourceLang,
          targetLang,
        }),
      cache: cacheEnabled ? createTranslationCache(cacheKey, cacheStorage) : undefined,
      entries: new Map<string, string>(),
      attempted: new Set<string>(),
      queue: new Map<string, { text: string; context?: TranslateContext }>(),
      inflight: new Map<string, Promise<string>>(),
      pending: 0,
      generation: 0,
      error: undefined as Error | undefined,
    }),
    [
      provider,
      apiKey,
      configuredKey,
      baseURL,
      endpoint,
      model,
      appSecret,
      sourceLang,
      targetLang,
      cacheEnabled,
      cacheKey,
      cacheStorage,
      translateFn,
    ]
  );
  const activeSession = React.useRef(session);
  activeSession.current = session;
  const mounted = React.useRef(false);
  const [, setVersion] = React.useState(0);

  const requestKey = React.useCallback(
    (text: string, context?: TranslateContext) =>
      JSON.stringify([text, context?.component ?? '', context?.role ?? '']),
    []
  );
  const storageKey = React.useCallback(
    (key: string) =>
      hashKey(
        sourceLang,
        targetLang,
        JSON.stringify([
          provider,
          baseURL ?? '',
          endpoint ?? '',
          model ?? '',
          provider === 'openai' ? (configuredKey ?? apiKey ?? '') : (apiKey ?? ''),
          appSecret ?? '',
          key,
        ])
      ),
    [sourceLang, targetLang, provider, baseURL, endpoint, model, configuredKey, apiKey, appSecret]
  );

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const notify = React.useCallback(() => {
    if (mounted.current && activeSession.current === session) {
      setVersion((value) => value + 1);
    }
  }, [session]);

  const translateOne = React.useCallback(
    (text: string, context?: TranslateContext): Promise<string> => {
      if (!text || sourceLang === targetLang) return Promise.resolve(text);
      const scoped = requestKey(text, context);
      const entry = session.entries.get(scoped);
      if (entry !== undefined) return Promise.resolve(entry);
      const key = storageKey(scoped);
      const cached = session.cache?.get(key);
      if (cached !== undefined && preservesPlaceholders(text, cached)) {
        session.entries.set(scoped, cached);
        notify();
        return Promise.resolve(cached);
      }
      const existing = session.inflight.get(scoped);
      if (existing) return existing;
      session.queue.delete(scoped);

      const generation = session.generation;
      const isCurrent = () =>
        mounted.current && activeSession.current === session && session.generation === generation;
      session.attempted.add(scoped);
      session.pending += 1;
      session.error = undefined;
      notify();

      const task = Promise.resolve()
        .then(() =>
          session.translate({
            texts: [text],
            sourceLang,
            targetLang,
            contexts: [context],
          })
        )
        .then((results) => {
          const translated = results[0];
          if (
            typeof translated !== 'string' ||
            translated === '' ||
            !preservesPlaceholders(text, translated)
          ) {
            return text;
          }
          if (isCurrent()) {
            session.cache?.set(key, translated);
            session.entries.set(scoped, translated);
          }
          return translated;
        })
        .catch((cause: unknown) => {
          if (isCurrent()) {
            session.error = cause instanceof Error ? cause : new Error(String(cause));
          }
          return text;
        })
        .finally(() => {
          if (session.generation !== generation) return;
          session.inflight.delete(scoped);
          session.pending = Math.max(0, session.pending - 1);
          notify();
        });
      session.inflight.set(scoped, task);
      return task;
    },
    [session, sourceLang, targetLang, notify, requestKey, storageKey]
  );

  const drainQueue = React.useCallback(() => {
    if (!mounted.current || activeSession.current !== session) return;
    const queued = Array.from(session.queue.entries()).filter(
      ([key]) => !session.inflight.has(key) && !session.entries.has(key)
    );
    session.queue.clear();
    if (queued.length === 0) return;
    const generation = session.generation;
    const isCurrent = () =>
      mounted.current && activeSession.current === session && session.generation === generation;
    session.pending += 1;
    session.error = undefined;
    notify();
    const task = Promise.resolve()
      .then(() =>
        session.translate({
          texts: queued.map(([, item]) => item.text),
          contexts: queued.map(([, item]) => item.context),
          sourceLang,
          targetLang,
        })
      )
      .then((results) => {
        if (isCurrent()) {
          queued.forEach(([key], index) => {
            const translated = results[index];
            if (
              typeof translated !== 'string' ||
              !translated ||
              !preservesPlaceholders(queued[index][1].text, translated)
            )
              return;
            session.entries.set(key, translated);
            session.cache?.set(storageKey(key), translated);
          });
        }
        return queued.map(([, item], index) => {
          const translated = results[index];
          return typeof translated === 'string' &&
            translated &&
            preservesPlaceholders(item.text, translated)
            ? translated
            : item.text;
        });
      })
      .catch((cause: unknown) => {
        if (isCurrent()) session.error = cause instanceof Error ? cause : new Error(String(cause));
        return queued.map(([, item]) => item.text);
      })
      .finally(() => {
        if (session.generation !== generation) return;
        queued.forEach(([key]) => session.inflight.delete(key));
        session.pending = Math.max(0, session.pending - 1);
        notify();
      });
    queued.forEach(([key], index) =>
      session.inflight.set(
        key,
        task.then((results) => results[index])
      )
    );
  }, [session, sourceLang, targetLang, notify, storageKey]);

  const tSync = React.useCallback(
    (text: string, context?: TranslateContext): string => {
      if (!text || sourceLang === targetLang) return text;
      const scoped = requestKey(text, context);
      const entry = session.entries.get(scoped);
      if (entry !== undefined) return entry;
      const cached = session.cache?.get(storageKey(scoped));
      if (cached !== undefined && preservesPlaceholders(text, cached)) {
        session.entries.set(scoped, cached);
        return cached;
      }
      // Record each automatic attempt once. Failed requests remain retryable via
      // t() or clearCache(), without triggering an endless render/request loop.
      if (!session.attempted.has(scoped)) {
        session.attempted.add(scoped);
        session.queue.set(scoped, { text, context });
        queueMicrotask(drainQueue);
      }
      return text;
    },
    [session, sourceLang, targetLang, drainQueue, requestKey, storageKey]
  );

  const clearCache = React.useCallback(() => {
    session.generation += 1;
    session.cache?.clear();
    session.entries.clear();
    session.attempted.clear();
    session.queue.clear();
    session.inflight.clear();
    session.pending = 0;
    session.error = undefined;
    notify();
  }, [session, notify]);

  React.useEffect(() => {
    drainQueue();
  });

  return {
    t: translateOne,
    tSync,
    isLoading: session.pending > 0,
    error: session.error,
    clearCache,
  };
}
