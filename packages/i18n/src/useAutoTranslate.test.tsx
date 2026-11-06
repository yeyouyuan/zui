import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useAutoTranslate, type TranslateRequest } from './useAutoTranslate';
import { DEFAULT_CACHE_KEY, hashKey, createMemoryStorage } from './cache';

/* --------------------------------- 工具 ---------------------------------- */

/** 简单可控 mock provider：记录调用次数/请求体，按文本返回译文 */
function makeMockProvider(
  translate: (text: string, req: TranslateRequest) => string | Promise<string>
) {
  const calls: TranslateRequest[] = [];
  const fn = vi.fn(async (req: TranslateRequest) => {
    calls.push(req);
    return Promise.all(req.texts.map((text) => translate(text, req)));
  });
  return { fn, calls };
}

let testStorage = createMemoryStorage();

/** 构造默认配置（每个测试使用稳定、隔离的内存存储） */
function config(overrides: Partial<Parameters<typeof useAutoTranslate>[0]> = {}) {
  return {
    provider: 'custom' as const,
    targetLang: 'en',
    cacheStorage: testStorage,
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  testStorage = createMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* --------------------------------- 测试 ---------------------------------- */

describe('useAutoTranslate —— 基本翻译', () => {
  it('服务端渲染只输出原文，不发翻译请求', async () => {
    const fn = vi.fn(async () => ['Translated']);
    function ServerCopy() {
      const { tSync } = useAutoTranslate(config({ translateFn: fn }));
      return <span>{tSync('请选择')}</span>;
    }
    expect(renderToString(<ServerCopy />)).toContain('请选择');
    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();
  });

  it('t() 异步返回译文', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await expect(result.current.t('请选择')).resolves.toBe('EN:请选择');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('tSync() 缓存未命中返回原文，异步回填后返回译文', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    expect(result.current.tSync('请选择')).toBe('请选择');

    await waitFor(() => {
      expect(result.current.tSync('请选择')).toBe('EN:请选择');
    });
  });

  it('isLoading 在请求期间为 true，完成后为 false', async () => {
    let resolveFn: ((v: string[]) => void) | null = null;
    const fn = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveFn = resolve;
        })
    );
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    const promise = result.current.t('请选择');
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    resolveFn!(['Please select']);
    await expect(promise).resolves.toBe('Please select');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('t() 把组件上下文透传给 provider', async () => {
    const { fn, calls } = makeMockProvider((text) => `EN:${text}`);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await result.current.t('请选择', { component: 'Select', role: 'placeholder' });

    expect(calls[0].contexts?.[0]).toEqual({ component: 'Select', role: 'placeholder' });
  });

  it('tSync() 异步回填时也带上组件上下文', async () => {
    const { fn, calls } = makeMockProvider((text) => `EN:${text}`);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    result.current.tSync('请选择', { component: 'Select', role: 'placeholder' });
    await waitFor(() => expect(fn).toHaveBeenCalled());

    expect(calls[0].contexts?.[0]).toEqual({ component: 'Select', role: 'placeholder' });
  });
});

describe('useAutoTranslate —— 缓存', () => {
  it('命中缓存同步返回译文，不重复请求', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const cacheStorage = createMemoryStorage();

    // 第一次：发起请求
    const first = renderHook(() => useAutoTranslate(config({ translateFn: fn, cacheStorage })));
    await first.result.current.t('请选择');
    expect(fn).toHaveBeenCalledTimes(1);

    // 第二次：新组件实例，命中 localStorage 缓存，同步返回
    const second = renderHook(() => useAutoTranslate(config({ translateFn: fn, cacheStorage })));
    expect(second.result.current.tSync('请选择')).toBe('EN:请选择');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('缓存 key 包含语言、provider 和上下文，写入 localStorage', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const cacheStorage = createMemoryStorage();
    const { result } = renderHook(() =>
      useAutoTranslate(config({ translateFn: fn, cacheStorage }))
    );

    await result.current.t('请选择');

    const expectedKey = hashKey(
      'zh',
      'en',
      JSON.stringify(['custom', '', '', '', '', '', JSON.stringify(['请选择', '', ''])])
    );
    const raw = cacheStorage.getItem(DEFAULT_CACHE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)[expectedKey]).toBe('EN:请选择');
  });

  it('不同 sourceLang/targetLang 生成不同缓存 key', () => {
    expect(hashKey('zh', 'en', '文本')).not.toBe(hashKey('zh', 'ja', '文本'));
    expect(hashKey('zh', 'en', '文本')).not.toBe(hashKey('en', 'zh', '文本'));
    expect(hashKey('zh', 'en', '文本A')).not.toBe(hashKey('zh', 'en', '文本B'));
  });

  it('相同原文在不同组件上下文中独立翻译和缓存', async () => {
    const cacheStorage = createMemoryStorage();
    const fn = vi.fn(async ({ texts, contexts }: TranslateRequest) =>
      texts.map((text, index) => `${contexts?.[index]?.component}:${text}`)
    );
    const { result } = renderHook(() =>
      useAutoTranslate(config({ translateFn: fn, cacheStorage }))
    );
    await expect(result.current.t('关闭', { component: 'Modal', role: 'close' })).resolves.toBe(
      'Modal:关闭'
    );
    await expect(result.current.t('关闭', { component: 'Drawer', role: 'close' })).resolves.toBe(
      'Drawer:关闭'
    );
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.tSync('关闭', { component: 'Modal', role: 'close' })).toBe('Modal:关闭');
    expect(result.current.tSync('关闭', { component: 'Drawer', role: 'close' })).toBe(
      'Drawer:关闭'
    );
  });

  it('切换 provider 后不复用旧 provider 的持久译文', async () => {
    const cacheStorage = createMemoryStorage();
    const firstFn = vi.fn(async ({ texts }: TranslateRequest) =>
      texts.map((text) => `first:${text}`)
    );
    const secondFn = vi.fn(async ({ texts }: TranslateRequest) =>
      texts.map((text) => `second:${text}`)
    );
    const first = renderHook(() =>
      useAutoTranslate(
        config({
          provider: 'custom',
          translateFn: firstFn,
          cacheStorage,
        })
      )
    );
    await first.result.current.t('请选择');
    const second = renderHook(() =>
      useAutoTranslate(
        config({
          provider: 'deepl',
          translateFn: secondFn,
          cacheStorage,
        })
      )
    );
    await expect(second.result.current.t('请选择')).resolves.toBe('second:请选择');
    expect(secondFn).toHaveBeenCalledTimes(1);
  });

  it('同一地址与模型切换 OpenAI key 后不复用旧账号缓存', async () => {
    const cacheStorage = createMemoryStorage();
    const firstFn = vi.fn(async () => ['First account']);
    const secondFn = vi.fn(async () => ['Second account']);
    const shared = {
      provider: 'openai' as const,
      baseURL: 'https://example.com/v1',
      model: 'translate',
      cacheStorage,
    };
    const first = renderHook(() =>
      useAutoTranslate(config({ ...shared, key: 'first-key', translateFn: firstFn }))
    );
    await expect(first.result.current.t('请选择')).resolves.toBe('First account');
    const second = renderHook(() =>
      useAutoTranslate(config({ ...shared, key: 'second-key', translateFn: secondFn }))
    );
    await expect(second.result.current.t('请选择')).resolves.toBe('Second account');
    expect(secondFn).toHaveBeenCalledTimes(1);
    expect(cacheStorage.getItem(DEFAULT_CACHE_KEY)).not.toContain('first-key');
    expect(cacheStorage.getItem(DEFAULT_CACHE_KEY)).not.toContain('second-key');
  });

  it('clearCache() 清空缓存后重新翻译', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const cacheStorage = createMemoryStorage();
    const { result } = renderHook(() =>
      useAutoTranslate(config({ translateFn: fn, cacheStorage }))
    );

    await result.current.t('请选择');
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => result.current.clearCache());
    expect(cacheStorage.getItem(DEFAULT_CACHE_KEY)).toBeNull();

    // 清空后 tSync 返回原文并重新异步翻译
    expect(result.current.tSync('请选择')).toBe('请选择');
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it('cache=false 不写 localStorage', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const cacheStorage = createMemoryStorage();
    const { result } = renderHook(() =>
      useAutoTranslate(config({ translateFn: fn, cacheStorage, cache: false }))
    );

    await result.current.t('请选择');
    expect(cacheStorage.getItem(DEFAULT_CACHE_KEY)).toBeNull();
  });
});

describe('useAutoTranslate —— 并发', () => {
  it('同一文本并发请求去重，只调用 provider 一次', async () => {
    const { fn } = makeMockProvider(async (text) => {
      await new Promise((r) => setTimeout(r, 10));
      return `EN:${text}`;
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    const results = await Promise.all([
      result.current.t('请选择'),
      result.current.t('请选择'),
      result.current.t('请选择'),
    ]);

    expect(results).toEqual(['EN:请选择', 'EN:请选择', 'EN:请选择']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('不同文本并发各自请求', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    const results = await Promise.all([result.current.t('文本A'), result.current.t('文本B')]);

    expect(results).toEqual(['EN:文本A', 'EN:文本B']);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('tSync 并发调用同一文本也去重', async () => {
    const { fn } = makeMockProvider(async (text) => {
      await new Promise((r) => setTimeout(r, 10));
      return `EN:${text}`;
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    result.current.tSync('请选择');
    result.current.tSync('请选择');
    result.current.tSync('请选择');

    await waitFor(() => expect(result.current.tSync('请选择')).toBe('EN:请选择'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('同一渲染批次的不同文案合并为一次 provider 请求', async () => {
    const fn = vi.fn(async ({ texts }: TranslateRequest) => texts.map((text) => `EN:${text}`));
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));
    expect(result.current.tSync('确定')).toBe('确定');
    expect(result.current.tSync('取消')).toBe('取消');
    await waitFor(() => expect(result.current.tSync('确定')).toBe('EN:确定'));
    expect(result.current.tSync('取消')).toBe('EN:取消');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].texts).toEqual(['确定', '取消']);
  });

  it('tSync 排队后立即调用 t 时，同一文案不重复请求', async () => {
    const fn = vi.fn(async ({ texts }: TranslateRequest) => texts.map((text) => `EN:${text}`));
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));
    expect(result.current.tSync('确定')).toBe('确定');
    await expect(result.current.t('确定')).resolves.toBe('EN:确定');
    await waitFor(() => expect(result.current.tSync('确定')).toBe('EN:确定'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('useAutoTranslate —— 错误回退', () => {
  it('t() 接受保留变量的译文，拒绝丢失、改名或新增变量的译文', async () => {
    const fn = vi.fn(async ({ texts }: TranslateRequest) =>
      texts.map((text) => {
        if (text === '{year}年{month}月') return '{month}/{year}';
        if (text === '数值不能小于 {min}') return 'At least {minimum}';
        if (text === '长度不能超过 {max}') return 'Too long';
        return 'Clear {unexpected}';
      })
    );
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));
    await expect(result.current.t('{year}年{month}月')).resolves.toBe('{month}/{year}');
    await expect(result.current.t('数值不能小于 {min}')).resolves.toBe('数值不能小于 {min}');
    await expect(result.current.t('长度不能超过 {max}')).resolves.toBe('长度不能超过 {max}');
    await expect(result.current.t('清除')).resolves.toBe('清除');
    expect(result.current.tSync('数值不能小于 {min}')).toBe('数值不能小于 {min}');
  });

  it('tSync 批量回填只缓存变量完整的译文', async () => {
    const fn = vi.fn(async ({ texts }: TranslateRequest) =>
      texts.map((text) => (text === '{year}年{month}月' ? '{month}/{year}' : 'At least {minimum}'))
    );
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));
    expect(result.current.tSync('{year}年{month}月')).toBe('{year}年{month}月');
    expect(result.current.tSync('数值不能小于 {min}')).toBe('数值不能小于 {min}');
    await waitFor(() => expect(result.current.tSync('{year}年{month}月')).toBe('{month}/{year}'));
    expect(result.current.tSync('数值不能小于 {min}')).toBe('数值不能小于 {min}');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].texts).toEqual(['{year}年{month}月', '数值不能小于 {min}']);
  });

  it('忽略已有缓存中变量被破坏的旧译文', async () => {
    const cacheStorage = createMemoryStorage();
    const key = hashKey(
      'zh',
      'en',
      JSON.stringify(['custom', '', '', '', '', '', JSON.stringify(['数值不能小于 {min}', '', ''])])
    );
    cacheStorage.setItem(DEFAULT_CACHE_KEY, JSON.stringify({ [key]: 'At least {minimum}' }));
    const fn = vi.fn(async () => ['At least {min}']);
    const { result } = renderHook(() =>
      useAutoTranslate(config({ cacheStorage, translateFn: fn }))
    );
    expect(result.current.tSync('数值不能小于 {min}')).toBe('数值不能小于 {min}');
    await waitFor(() => expect(result.current.tSync('数值不能小于 {min}')).toBe('At least {min}'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('provider 失败返回原文并暴露 error', async () => {
    const fn = vi.fn(async () => {
      throw new Error('网络错误');
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await expect(result.current.t('请选择')).resolves.toBe('请选择');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe('网络错误');
  });

  it('tSync 失败回退返回原文', async () => {
    const fn = vi.fn(async () => {
      throw new Error('网络错误');
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    expect(result.current.tSync('请选择')).toBe('请选择');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    // 失败后仍是原文
    expect(result.current.tSync('请选择')).toBe('请选择');
  });

  it('非 Error 抛出物也包装为 Error', async () => {
    const fn = vi.fn(async () => {
      throw '字符串错误';
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await result.current.t('请选择');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe('字符串错误');
  });

  it('provider 返回空串/缺项时回退原文', async () => {
    const fn = vi.fn(async () => ['']);
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await expect(result.current.t('请选择')).resolves.toBe('请选择');
  });

  it('clearCache() 重置 error', async () => {
    const fn = vi.fn(async () => {
      throw new Error('网络错误');
    });
    const { result } = renderHook(() => useAutoTranslate(config({ translateFn: fn })));

    await result.current.t('请选择');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    act(() => result.current.clearCache());
    expect(result.current.error).toBeUndefined();
  });
});

describe('useAutoTranslate —— 组件内 tSync 自动重渲染', () => {
  it('异步回填后组件重渲染拿到译文', async () => {
    const { fn } = makeMockProvider(async (text) => {
      await new Promise((r) => setTimeout(r, 10));
      return `EN:${text}`;
    });

    function Consumer() {
      const { tSync } = useAutoTranslate(config({ translateFn: fn }));
      return <span data-testid="text">{tSync('请选择')}</span>;
    }

    render(<Consumer />);
    expect(screen.getByTestId('text').textContent).toBe('请选择');

    await waitFor(() => {
      expect(screen.getByTestId('text').textContent).toBe('EN:请选择');
    });
  });

  it('缓存已命中时组件首屏即译文', async () => {
    const { fn } = makeMockProvider((text) => `EN:${text}`);
    const cacheStorage = createMemoryStorage();

    // 预热缓存
    const warm = renderHook(() => useAutoTranslate(config({ translateFn: fn, cacheStorage })));
    await warm.result.current.t('请选择');

    function Consumer() {
      const { tSync } = useAutoTranslate(config({ translateFn: fn, cacheStorage }));
      return <span data-testid="text">{tSync('请选择')}</span>;
    }

    render(<Consumer />);
    expect(screen.getByTestId('text').textContent).toBe('EN:请选择');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
