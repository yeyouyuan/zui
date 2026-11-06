/**
 * 翻译缓存 —— localStorage 持久化（不可用时降级内存 Map），见 CONTRACTS-V3 §2。
 * 上层把语言、provider、原文和上下文编码为 hash key；命中直接返回。
 */

/* ---------------------------------- 类型 ---------------------------------- */

/** 底层缓存存储：localStorage 或内存 Map（SSR / 隐私模式降级） */
export interface TranslationCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 翻译缓存实例 */
export interface TranslationCache {
  /** 按 hash 读取译文；未命中返回 undefined */
  get(key: string): string | undefined;
  /** 写入一条译文（容量超限时淘汰最早写入项） */
  set(key: string, value: string): void;
  /** 清空该 cacheKey 下的全部条目 */
  clear(): void;
}

/* --------------------------------- 常量 ---------------------------------- */

/** 默认 localStorage key（契约默认值） */
export const DEFAULT_CACHE_KEY = 'zui-translate-cache';

/** 最多缓存条数（超出按插入序淘汰最旧，防止 localStorage 超额） */
export const MAX_CACHE_ENTRIES = 500;

/* --------------------------------- hash ---------------------------------- */

/**
 * 同步 FNV-1a 32 位哈希，输出 8 位 hex。
 * 对传入的语言与文本标识计算哈希；上层负责将 provider 和上下文并入文本标识。
 */
export function hashKey(sourceLang: string, targetLang: string, text: string): string {
  const input = `${sourceLang}:${targetLang}:${text}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619（2^24+2^8+0x93），用移位加法保持 32 位精度
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/* --------------------------------- 存储层 --------------------------------- */

/** 内存 Map 实现的存储（SSR / localStorage 不可用时兜底） */
export function createMemoryStorage(): TranslationCacheStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * 取全局 localStorage；不可用（SSR / 隐私模式 / 抛错）时返回内存实现。
 */
export function resolveCacheStorage(): TranslationCacheStorage {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      // 探测可写：Safari 隐私模式 getItem/setItem 会抛错
      const probe = '__zui_i18n_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    // 降级内存缓存
  }
  return createMemoryStorage();
}

/* ------------------------------- TranslationCache -------------------------- */

/**
 * 创建翻译缓存。
 * @param cacheKey localStorage 条目名（默认 'zui-translate-cache'）
 * @param storage 自定义存储（测试可注入；缺省自动取 localStorage，退化内存 Map）
 */
export function createTranslationCache(
  cacheKey: string = DEFAULT_CACHE_KEY,
  storage?: TranslationCacheStorage
): TranslationCache {
  const store = storage ?? resolveCacheStorage();

  const readAll = (): Record<string, string> => {
    try {
      const raw = store.getItem(cacheKey);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  const writeAll = (data: Record<string, string>): void => {
    try {
      store.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // 配额超限等写失败：静默降级（缓存是优化，不是正确性依赖）
    }
  };

  return {
    get(key) {
      const value = readAll()[key];
      return typeof value === 'string' ? value : undefined;
    },
    set(key, value) {
      const data = readAll();
      // 先删后插：把当前 key 放到对象末尾（插入序 → 淘汰最旧）
      delete data[key];
      data[key] = value;
      const keys = Object.keys(data);
      if (keys.length > MAX_CACHE_ENTRIES) {
        for (const stale of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) {
          delete data[stale];
        }
      }
      writeAll(data);
    },
    clear() {
      try {
        store.removeItem(cacheKey);
      } catch {
        // 忽略：无缓存可清时的防御
      }
    },
  };
}
