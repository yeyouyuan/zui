import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateWithCustom } from './custom';

afterEach(() => vi.unstubAllGlobals());

describe('custom translation endpoint', () => {
  it('sends a context aligned with each source text', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: ['Close', 'Dismiss'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      translateWithCustom(
        {
          texts: ['关闭', '关闭'],
          sourceLang: 'zh',
          targetLang: 'en',
          contexts: [
            { component: 'Modal', role: 'close' },
            { component: 'Drawer', role: 'close' },
          ],
        },
        { endpoint: '/api/translate' }
      )
    ).resolves.toEqual(['Close', 'Dismiss']);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contexts).toEqual([
      { component: 'Modal', role: 'close' },
      { component: 'Drawer', role: 'close' },
    ]);
  });
});
