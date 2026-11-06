import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from './ConfigProvider';
import { useZuiConfig } from './useZuiConfig';
import { Input } from '../components/Input';
import type { TranslateConfig } from '@zui/i18n';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Copy() {
  const { locale } = useZuiConfig();
  return (
    <>
      <span data-testid="copy">{locale.input.clear}</span>
      <span data-testid="close">{locale.modal.close}</span>
    </>
  );
}

describe('ConfigProvider 翻译集成', () => {
  it('日期与表单模板可翻译并继续替换变量，损坏变量的译文回退原文', async () => {
    const translateFn = vi.fn(async ({ texts }: { texts: string[] }) =>
      texts.map((text) => {
        if (text === '{year}年{month}月') return '{month}/{year}';
        if (text === '数值不能小于 {min}') return 'At least {minimum}';
        return text;
      })
    );
    function TemplateCopy() {
      const { locale } = useZuiConfig();
      return (
        <>
          <span data-testid="month">
            {locale.date.monthFormat.replace('{year}', '2026').replace('{month}', '11')}
          </span>
          <span data-testid="minimum">{locale.form.minNumber.replace('{min}', '3')}</span>
        </>
      );
    }
    render(
      <ConfigProvider
        translate={{ provider: 'custom', targetLang: 'en', cache: false, translateFn }}
      >
        <TemplateCopy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('month')).toHaveTextContent('11/2026'));
    expect(screen.getByTestId('minimum')).toHaveTextContent('数值不能小于 3');
    expect(translateFn.mock.calls.flatMap(([request]) => request.texts)).toContain(
      '数值不能小于 {min}'
    );
  });

  it('只请求实际读取的文案段，不翻译未使用的占位模板', async () => {
    const translateFn = vi.fn(async ({ texts }: { texts: string[] }) =>
      texts.map((text) => `en:${text}`)
    );
    render(
      <ConfigProvider
        translate={{ provider: 'custom', targetLang: 'en', cache: false, translateFn }}
      >
        <Copy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('en:清除'));
    const requested = translateFn.mock.calls.flatMap(([request]) => request.texts);
    expect(requested).toContain('清除');
    expect(requested).toContain('关闭');
    expect(requested).not.toContain('请输入用户名');
    expect(requested).not.toContain('暂无选项');
    expect(requested).not.toContain('暂无数据');
    expect(requested).not.toContain('{year}');
  });

  it('嵌套覆盖合并原始文案，翻译内置文案并保留用户内容', async () => {
    const translateFn = vi.fn(async ({ texts }: { texts: string[] }) =>
      texts.map((text) => `en:${text}`)
    );
    const config: TranslateConfig = {
      provider: 'custom',
      targetLang: 'en',
      cache: false,
      translateFn,
    };
    render(
      <ConfigProvider locale={{ modal: { close: '外层关闭' } }} translate={config}>
        <ConfigProvider locale={{ input: { clear: '内层清除' } }}>
          <Copy />
          <Input value="用户文本" readOnly />
        </ConfigProvider>
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('en:内层清除'));
    expect(screen.getByTestId('close')).toHaveTextContent('en:外层关闭');
    expect(screen.getByRole('textbox')).toHaveValue('用户文本');
    expect(translateFn.mock.calls.flatMap(([request]) => request.texts)).not.toContain('用户文本');
    expect(
      translateFn.mock.calls
        .flatMap(([request]) => request.texts)
        .some((text) => text.startsWith('en:'))
    ).toBe(false);
  });

  it('切换目标语言与停用翻译后不残留上一语言', async () => {
    const translateFn = vi.fn(
      async ({ texts, targetLang }: { texts: string[]; targetLang: string }) =>
        texts.map((text) => `${targetLang}:${text}`)
    );
    const config: TranslateConfig = {
      provider: 'custom',
      targetLang: 'en',
      cache: false,
      translateFn,
    };
    const { rerender } = render(
      <ConfigProvider translate={config}>
        <Copy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('en:清除'));
    rerender(
      <ConfigProvider translate={{ ...config, targetLang: 'ja' }}>
        <Copy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('ja:清除'));
    rerender(
      <ConfigProvider>
        <Copy />
      </ConfigProvider>
    );
    expect(screen.getByTestId('copy')).toHaveTextContent(/^清除$/);
  });

  it('缺少凭据时不请求，允许无浏览器密钥的代理端点', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Translated' } }] }),
    }));
    vi.stubGlobal('fetch', fetch);
    const { rerender } = render(
      <ConfigProvider translate={{ provider: 'openai', targetLang: 'en', cache: false }}>
        <Copy />
      </ConfigProvider>
    );
    expect(fetch).not.toHaveBeenCalled();
    rerender(
      <ConfigProvider
        translate={{
          provider: 'openai',
          targetLang: 'en',
          cache: false,
          endpoint: '/api/translate',
        }}
      >
        <Copy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('Translated'));
    expect(fetch.mock.calls[0][0]).toBe('/api/translate');
  });

  it('使用 OpenAI 兼容协议的 baseURL、key、model 三项', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Clear' } }] }),
    }));
    vi.stubGlobal('fetch', fetch);
    render(
      <ConfigProvider
        translate={{
          provider: 'openai',
          targetLang: 'en',
          baseURL: 'https://example.com/v1',
          key: 'test-key',
          model: 'compatible-model',
          cache: false,
        }}
      >
        <Copy />
      </ConfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId('copy')).toHaveTextContent('Clear'));
    expect(fetch.mock.calls[0][0]).toBe('https://example.com/v1/chat/completions');
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body as string).model).toBe('compatible-model');
  });
});
