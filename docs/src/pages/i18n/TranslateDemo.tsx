import { useEffect, useMemo, useState } from 'react';
import { useAutoTranslate, type TranslateProvider } from '@zui/i18n';
import {
  Alert,
  Button,
  ConfigProvider,
  DatePicker,
  Empty,
  Input,
  MessageProvider,
  Pagination,
  Popconfirm,
  Select,
  Tag,
  TimePicker,
  enUS,
  frFR,
  deDE,
  esES,
  jaJP,
  koKR,
  ptBR,
  ruRU,
  useMessage,
  zhCN,
  zhTW,
  mergeLocale,
  type ZuiLocale,
} from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CodeBlock from '../../components/CodeBlock';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

/* --------------------------------- 常量 --------------------------------- */

const LOCALES: Array<{ value: string; label: string; locale: ZuiLocale }> = [
  { value: 'zhCN', label: '🇨🇳 简体中文 (zh-CN)', locale: zhCN },
  { value: 'enUS', label: '🇺🇸 English (en-US)', locale: enUS },
  { value: 'zhTW', label: '🇭🇰 繁體中文 (zh-TW)', locale: zhTW },
  { value: 'jaJP', label: '🇯🇵 日本語 (ja-JP)', locale: jaJP },
  { value: 'koKR', label: '🇰🇷 한국어 (ko-KR)', locale: koKR },
  { value: 'frFR', label: '🇫🇷 Français (fr-FR)', locale: frFR },
  { value: 'deDE', label: '🇩🇪 Deutsch (de-DE)', locale: deDE },
  { value: 'esES', label: '🇪🇸 Español (es-ES)', locale: esES },
  { value: 'ruRU', label: '🇷🇺 Русский (ru-RU)', locale: ruRU },
  { value: 'ptBR', label: '🇧🇷 Português (pt-BR)', locale: ptBR },
];

const LOCALE_USAGE_CODE = `import { ConfigProvider, enUS } from '@zui/react';

export default function App() {
  return (
    <ConfigProvider locale={enUS}>
      {/* 内部所有组件（DatePicker/Pagination/Popconfirm/Select 等）将自动以英文呈现 */}
      <YourApp />
    </ConfigProvider>
  );
}`;

const MERGE_LOCALE_CODE = `import { ConfigProvider, enUS, mergeLocale } from '@zui/react';

// 基于 enUS 深度覆盖特定组件文案
const customLocale = mergeLocale(enUS, {
  select: { placeholder: 'Choose an option...' },
  empty: { description: 'Nothing found here' },
});

export default function App() {
  return (
    <ConfigProvider locale={customLocale}>
      <YourApp />
    </ConfigProvider>
  );
}`;

const DEMO_TEXTS: Array<{ text: string; context: { component: string; role: string } }> = [
  { text: '请选择', context: { component: 'Select', role: 'placeholder' } },
  { text: '清除', context: { component: 'Input', role: 'clear' } },
  { text: '关闭', context: { component: 'Modal', role: 'close' } },
  { text: '暂无数据', context: { component: 'Empty', role: 'description' } },
  { text: '上一页', context: { component: 'Pagination', role: 'prev' } },
  { text: '下一页', context: { component: 'Pagination', role: 'next' } },
];

const PROVIDER_OPTIONS: Array<{ value: TranslateProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容协议' },
  { value: 'deepl', label: 'DeepL' },
  { value: 'youdao', label: '有道' },
  { value: 'custom', label: 'Custom (POST)' },
];

const AI_CONFIG_CODE = `import { useAutoTranslate } from '@zui/i18n';

const { tSync, isLoading, clearCache } = useAutoTranslate({
  provider: 'openai',
  baseURL: 'https://example.com/v1',
  key: 'temporary-test-key', // 仅供临时直连调试；正式部署请使用下方服务端代理
  model: 'compatible-model',
  targetLang: 'en',
  cache: true,
});

// 同步获取（带组件上下文提示词，AI 翻译更精准）
tSync('请选择', { component: 'Select', role: 'placeholder' });`;

const PROXY_SERVER_CODE = `// 在文档站目录运行：TRANSLATE_BASE_URL=... TRANSLATE_API_KEY=... TRANSLATE_MODEL=... node translate-proxy.mjs
// 可执行代理位于 docs/translate-proxy.mjs，完整实现包含输入校验、超时与三路并发。
// 浏览器只请求 /api/translate；三项配置均留在服务端。`;

const PROXY_CLIENT_CODE = `// 浏览器只访问同源地址，不接触服务商密钥
const { tSync } = useAutoTranslate({
  provider: 'custom',
  endpoint: '/api/translate',
  sourceLang: 'zh',
  targetLang: 'en',
});

tSync('请选择', { component: 'Select', role: 'placeholder' });`;

const PROXY_VITE_CODE = `// docs/vite.config.ts 已配置开发环境转发
proxy: { '/api/translate': 'http://127.0.0.1:8787' }`;

function readCacheSnapshot(cacheKey = 'zui-translate-cache'): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/* -------------------------------- 组件实现 -------------------------------- */

export default function I18nPage(): React.ReactNode {
  usePageTitle('国际化 i18n 与 AI 翻译');

  return (
    <MessageProvider>
      <I18nPageBody />
    </MessageProvider>
  );
}

function I18nPageBody(): React.ReactNode {
  // 1. 标准语言包切换
  const [selectedLocaleKey, setSelectedLocaleKey] = useState<string>('zhCN');
  const activeLocale = useMemo(
    () => LOCALES.find((l) => l.value === selectedLocaleKey)?.locale ?? zhCN,
    [selectedLocaleKey]
  );

  // 2. AI 翻译演示
  const [provider, setProvider] = useState<TranslateProvider>('openai');
  const [targetLang, setTargetLang] = useState('en');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [, refreshCache] = useState(0);
  const [endpoint, setEndpoint] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const message = useMessage();

  const aiConfig = useMemo(
    () => ({
      provider,
      key: provider === 'openai' ? apiKey || undefined : undefined,
      apiKey: provider === 'openai' ? undefined : apiKey || undefined,
      baseURL: provider === 'openai' ? endpoint || undefined : undefined,
      endpoint: provider === 'openai' ? undefined : endpoint || undefined,
      model: model || undefined,
      appSecret: appSecret || undefined,
      sourceLang: 'zh',
      targetLang: targetLang || 'en',
      cache: true,
    }),
    [provider, targetLang, apiKey, endpoint, model, appSecret]
  );
  const { t, tSync, isLoading, error, clearCache } = useAutoTranslate(aiConfig);
  const ready =
    !!targetLang.trim() &&
    (provider === 'custom'
      ? !!endpoint.trim()
      : provider === 'openai'
        ? !!endpoint.trim() && !!apiKey.trim() && !!model.trim()
        : provider === 'youdao'
          ? !!apiKey.trim() && !!appSecret.trim()
          : !!apiKey.trim() || !!endpoint.trim());
  useEffect(() => {
    setEnabled(false);
  }, [provider, targetLang, apiKey, endpoint, model, appSecret]);
  const cacheSize = Object.keys(readCacheSnapshot()).length;

  return (
    <div className="doc-page">
      <h1 className="doc-h1">国际化 i18n 与 AI 翻译</h1>
      <p className="doc-lead">
        ZUI 采用双层国际化方案：底层提供 <strong>10 套官方内置标准语言包</strong>
        （开箱即用、无网络依赖）， 同时集成 <strong>@zui/i18n 智能翻译管道</strong>
        ，支持任意大模型驱动未翻译文案的自动回填与持久化缓存。
      </p>

      {/* ---------------- 第一部分：标准多语言切换 ---------------- */}
      <h2 className="doc-h2">1. 官方内置语言包（动态无感切换）</h2>
      <p className="doc-p">
        内置 <code>zhCN</code>（简体中文）、<code>enUS</code>（English）、<code>zhTW</code>
        （繁體中文）、
        <code>jaJP</code>（日本語）、<code>koKR</code>（한국어）、<code>frFR</code>
        （Français）、<code>deDE</code>（Deutsch）、<code>esES</code>（Español）、
        <code>ruRU</code>（Русский）、<code>ptBR</code>（Português）十套完整语言包。通过{' '}
        <code>ConfigProvider</code> 全局注入，内部组件即刻响应。
      </p>

      <Demo
        title="实时切换语言包"
        description="选择不同的语言包，下方包含 DatePicker、Pagination、Select、TimePicker、Popconfirm、Empty 的展示板将即时切换所有内置文案。"
        code={LOCALE_USAGE_CODE}
        stack
      >
        <div className="doc-locale-demo">
          <div className="doc-locale-switcher">
            <span style={{ fontWeight: 600 }}>选择语言：</span>
            <Select
              options={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
              value={selectedLocaleKey}
              onChange={(v) => setSelectedLocaleKey(v)}
              size="md"
            />
          </div>

          {/* 实时呈现多语言组件展示区 */}
          <ConfigProvider locale={activeLocale}>
            <div className="doc-locale-panel">
              <div className="doc-locale-controls">
                <div>
                  <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                    选择器占位符
                  </span>
                  <Select options={[]} style={{ minWidth: 160 }} />
                </div>

                <div>
                  <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                    日期选择面板
                  </span>
                  <DatePicker defaultValue="2026-11-05" />
                </div>

                <div>
                  <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                    时间选择
                  </span>
                  <TimePicker />
                </div>

                <div>
                  <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                    气泡确认框
                  </span>
                  <Popconfirm title="Are you sure / 确定吗？">
                    <Button variant="outline">点击触发</Button>
                  </Popconfirm>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                  分页控件（包含上一页、下一页、跳页文案）
                </span>
                <Pagination total={100} defaultPage={1} showJumper />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                  空状态
                </span>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--z-color-bg)',
                    borderRadius: 'var(--z-radius-sm)',
                    border: '1px dashed var(--z-color-border)',
                  }}
                >
                  <Empty />
                </div>
              </div>
            </div>
          </ConfigProvider>
        </div>
      </Demo>

      <Demo
        title="局部自定义与文案合并 (mergeLocale)"
        description="如果你只需要修改现有语言包中的部分文案，使用 mergeLocale 进行安全合并，无需重写整份配置。"
        code={MERGE_LOCALE_CODE}
      >
        <ConfigProvider
          locale={mergeLocale(enUS, { select: { placeholder: 'Choose an option...' } })}
        >
          <Select options={[]} />
        </ConfigProvider>
      </Demo>

      {/* ---------------- 第二部分：AI 动态翻译 ---------------- */}
      <h2 className="doc-h2">2. AI 动态智能翻译 (@zui/i18n)</h2>
      <p className="doc-p">
        除了标准预设语言包，ZUI 还提供了<code>@zui/i18n</code> 运行时工具。
        当系统包含动态业务文案或冷门语种时，可将文本与组件上下文提交给 LLM
        进行精准翻译并自动缓存在浏览器中。兼容 OpenAI Chat Completions 协议的模型可填写 API
        根地址、密钥和模型名。 正式接入建议通过服务端代理保管密钥；本页直连服务商仅用于临时调试。
      </p>
      {import.meta.env.BASE_URL !== '/' ? (
        <Alert type="info" title="GitHub Pages 静态演示">
          此站点不运行翻译代理。下方的 Custom 模式需要另行部署可访问的服务端接口；
          内置语言包切换可直接使用。OpenAI 兼容直连仅供临时调试，并受服务商跨域策略限制。
        </Alert>
      ) : null}

      <Demo
        title="AI 翻译测试台"
        description="OpenAI 兼容模式填写 baseURL、key、model 后启动；服务端代理请选 Custom。"
        code={AI_CONFIG_CODE}
        stack
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="doc-pg-preview-row"
            style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}
          >
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="doc-p" style={{ margin: 0 }}>
                provider 服务商
              </span>
              <Select
                options={PROVIDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={provider}
                onChange={(v) => {
                  setProvider(v as TranslateProvider);
                  setApiKey('');
                  setEndpoint('');
                  setAppSecret('');
                  setModel('');
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="doc-p" style={{ margin: 0 }}>
                targetLang 目标语种
              </span>
              <Input
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                placeholder="en"
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span className="doc-p" style={{ margin: 0 }}>
                {provider === 'openai' ? 'baseURL（API 根地址）' : '服务端翻译地址'}
              </span>
              <Input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder={
                  provider === 'openai' ? '例如 https://example.com/v1' : '例如 /api/translate'
                }
              />
            </label>
            {provider !== 'custom' ? (
              <label style={{ display: 'grid', gap: 4 }}>
                <span className="doc-p" style={{ margin: 0 }}>
                  {provider === 'openai'
                    ? 'key（仅供本页调试，生产环境请放在服务端）'
                    : 'apiKey（仅供本页调试，生产环境请放在服务端）'}
                </span>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="仅调试使用"
                />
              </label>
            ) : null}
            {provider === 'openai' ? (
              <label style={{ display: 'grid', gap: 4 }}>
                <span className="doc-p" style={{ margin: 0 }}>
                  model 模型名
                </span>
                <Input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="例如 translate"
                />
              </label>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {provider === 'youdao' ? (
              <label>
                appSecret{' '}
                <Input
                  type="password"
                  value={appSecret}
                  onChange={(event) => setAppSecret(event.target.value)}
                />
              </label>
            ) : null}
            <Button
              disabled={!ready || isLoading}
              onClick={() => {
                if (enabled && error) {
                  void Promise.all(DEMO_TEXTS.map(({ text, context }) => t(text, context)));
                } else {
                  setEnabled(true);
                }
              }}
            >
              {isLoading ? '翻译中…' : enabled && error ? '重试翻译' : '开始翻译'}
            </Button>
          </div>
          <div
            style={{
              padding: 16,
              background: 'var(--z-color-bg)',
              border: '1px solid var(--z-color-border-subtle)',
              borderRadius: 'var(--z-radius-sm)',
            }}
          >
            <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              {DEMO_TEXTS.map(({ text, context }) => (
                <li key={text}>
                  <code className="doc-code-inline">{text}</code>
                  <span aria-hidden="true" style={{ color: 'var(--z-color-fg-muted)' }}>
                    {' '}
                    [上下文: {context.component} / {context.role}] →{' '}
                  </span>
                  <strong>{enabled && ready ? tSync(text, context) : text}</strong>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEnabled(false);
                  clearCache();
                  refreshCache((v) => v + 1);
                  message.info('本地翻译缓存已清空');
                }}
              >
                清空浏览器翻译缓存
              </Button>
              {isLoading ? <Tag color="primary">AI 翻译中…</Tag> : null}
              {error ? <Tag color="error">{error.message}</Tag> : null}
              <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                浏览器全部翻译缓存条目：<strong>{cacheSize}</strong>
              </span>
            </div>
          </div>
        </div>
      </Demo>

      <h3 className="doc-h3">生产接入：服务端代理</h3>
      <p className="doc-p">
        OpenAI 兼容服务需要 <code>baseURL</code>、<code>key</code>、<code>model</code>。
        服务端保存这三项并转发翻译请求；浏览器只调用同源的 <code>/api/translate</code>。 以下 Node
        示例使用 <code>TRANSLATE_BASE_URL</code>、<code>TRANSLATE_API_KEY</code>、
        <code>TRANSLATE_MODEL</code> 环境变量。文档站的 <code>docs/translate-proxy.mjs</code>
        可直接运行；实际部署时还应在代理入口增加用户鉴权和限流。
      </p>
      <CodeBlock code={PROXY_SERVER_CODE} language="server.mjs" />
      <p className="doc-p">
        文档站开发服务器已把 <code>/api/translate</code> 转发到本机 <code>127.0.0.1:8787</code>；
        生产环境由应用服务承载同一路径。客户端示例：
      </p>
      <CodeBlock code={PROXY_VITE_CODE} language="vite.config.ts" />
      <CodeBlock code={PROXY_CLIENT_CODE} language="React" />

      <Alert type="info" title="语言包与 AI 翻译的区别">
        <strong>静态语言包</strong>
        ：无需网络翻译请求，首屏即可呈现，适合中/英/繁/日/韩等标准国际化场景；
        <br />
        <strong>AI 动态翻译</strong>
        ：按需将冷门语种或动态数据由大模型翻译并缓存在客户端，适合全球化多语言 UGC
        或轻量级国际化试水。
      </Alert>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'locale',
            type: 'ZuiLocale',
            defaultValue: 'zhCN',
            description: 'ConfigProvider 接受的语言包对象，包含所有组件文案配置。',
          },
          {
            name: 'mergeLocale',
            type: '(base: ZuiLocale, override: DeepPartial<ZuiLocale>) => ZuiLocale',
            defaultValue: '—',
            description: '用于在现有语言包基础上安全局部覆盖字段。',
          },
          {
            name: 'useZuiConfig',
            type: '() => { locale: ZuiLocale }',
            defaultValue: '—',
            description: '自定义业务组件获取当前全局生效语言包的 Hook。',
          },
          {
            name: 'useAutoTranslate',
            type: '(config: TranslateConfig) => AutoTranslateReturn',
            defaultValue: '—',
            description: '@zui/i18n 提供的 AI 动态翻译 Hook，提供 t 与 tSync 方法。',
          },
        ]}
      />
    </div>
  );
}
