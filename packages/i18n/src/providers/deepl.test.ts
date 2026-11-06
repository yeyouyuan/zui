import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateWithDeepL } from './deepl';

afterEach(() => vi.unstubAllGlobals());

describe('DeepL proxy authentication', () => {
  it('omits browser credentials when a proxy owns the key', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ translations: [{ text: 'Please select' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithDeepL(
      { texts: ['请选择'], sourceLang: 'zh', targetLang: 'en' },
      { endpoint: '/api/translate' }
    )).resolves.toEqual(['Please select']);

    expect(fetchMock).toHaveBeenCalledWith('/api/translate', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' },
    }));
  });
});
