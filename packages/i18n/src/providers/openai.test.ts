import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateWithOpenAI } from './openai';

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible Chat Completions', () => {
  it('uses the configured endpoint, model and context without requiring a browser key', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Please select' } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      translateWithOpenAI(
        {
          texts: ['请选择'],
          sourceLang: 'zh',
          targetLang: 'en',
          contexts: [{ component: 'Select', role: 'placeholder' }],
        },
        { endpoint: '/v1/chat/completions', model: 'compatible-model' }
      )
    ).resolves.toEqual(['Please select']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/chat/completions');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    const body = JSON.parse(init.body);
    expect(body.model).toBe('compatible-model');
    expect(body.messages[0].content).toContain('Select 组件的 placeholder');
    expect(body.messages[1]).toEqual({ role: 'user', content: '请选择' });
    expect(body).not.toHaveProperty('temperature');
  });

  it('appends chat/completions to a compatible API baseURL', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Close' } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await translateWithOpenAI(
      { texts: ['关闭'], sourceLang: 'zh', targetLang: 'en' },
      { baseURL: 'https://example.com/v1/', model: 'compatible-model', apiKey: 'test-key' }
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/v1/chat/completions');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    expect(JSON.parse(init.body).model).toBe('compatible-model');
  });

  it('accepts a host-only baseURL and inserts /v1', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello' } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await translateWithOpenAI(
      { texts: ['你好'], sourceLang: 'zh', targetLang: 'en' },
      { baseURL: 'https://api.fengwind.com', model: 'translate' }
    );
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.fengwind.com/v1/chat/completions');
  });

  it('limits concurrent requests to three and keeps translations in source order', async () => {
    const pending: Array<{ text: string; resolve: () => void }> = [];
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const text = JSON.parse(init.body).messages[1].content as string;
      await new Promise<void>((resolve) => pending.push({ text, resolve }));
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: `EN:${text}` } }] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const task = translateWithOpenAI(
      { texts: ['A', 'B', 'C', 'D'], sourceLang: 'zh', targetLang: 'en' },
      { model: 'translate' }
    );
    expect(pending.map(({ text }) => text)).toEqual(['A', 'B', 'C']);
    pending[1].resolve();
    await vi.waitFor(() => expect(pending.map(({ text }) => text)).toEqual(['A', 'B', 'C', 'D']));
    pending[3].resolve();
    pending[2].resolve();
    pending[0].resolve();
    await expect(task).resolves.toEqual(['EN:A', 'EN:B', 'EN:C', 'EN:D']);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
