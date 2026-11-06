import { describe, expect, it, vi } from 'vitest';
import { computeYoudaoSign, translateWithYoudao } from './youdao';

describe('Youdao v3 signing', () => {
  it('includes the complete salt and uses the documented short and long input forms', async () => {
    await expect(
      computeYoudaoSign('短文本', 'app-key', 'salt-id', '1700000000', 'secret')
    ).resolves.toBe('2077c1340a61f27da51efd3e29e3a464b6a4ff50baccc37df44648cdd333e946');
    await expect(
      computeYoudaoSign('1234567890123456789012345', 'app-key', 'salt-id', '1700000000', 'secret')
    ).resolves.toBe('0ac377411b29c3ecfd1963d4baf38c400cf0e4d058a2305d8d63d199bf048387');
  });

  it('sends the matching salt, curtime and sign fields', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errorCode: '0', translation: ['Hello'] }),
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('salt-id');
    const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    try {
      await expect(
        translateWithYoudao(
          { texts: ['短文本'], sourceLang: 'zh', targetLang: 'en' },
          { apiKey: 'app-key', appSecret: 'secret', endpoint: '/proxy/youdao' }
        )
      ).resolves.toEqual(['Hello']);
      expect(fetchMock).toHaveBeenCalledWith(
        '/proxy/youdao',
        expect.objectContaining({ method: 'POST' })
      );
      const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
      expect(body.get('salt')).toBe('salt-id');
      expect(body.get('curtime')).toBe('1700000000');
      expect(body.get('sign')).toBe(
        '2077c1340a61f27da51efd3e29e3a464b6a4ff50baccc37df44648cdd333e946'
      );
    } finally {
      globalThis.fetch = originalFetch;
      uuid.mockRestore();
      now.mockRestore();
    }
  });
});
