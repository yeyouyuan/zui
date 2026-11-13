# @zui/i18n

> v0.4.0 发布到 GitHub Packages：`@yeyouyuan/zui-i18n`，npmjs 暂不发布。先在项目 `.npmrc` 配置 `@yeyouyuan:registry=https://npm.pkg.github.com`，再用拥有包读取权限的 GitHub 账号登录。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
pnpm add @zui/i18n@npm:@yeyouyuan/zui-i18n@0.4.0
```

源码导入继续使用 `@zui/i18n`。完整认证和安装说明见仓库 [GitHub Packages 文档](https://github.com/yeyouyuan/zui/blob/main/docs/GITHUB-PACKAGES.md)。

ZUI 组件内置文案自动翻译。标准语言请优先使用 `ConfigProvider locale={enUS}` 等静态语言包；运行时翻译适合尚无语言包的语种或动态文案。支持 4 种 provider、localStorage 缓存，失败回退原文。

对应契约：`CONTRACTS-V3.md` §2「AI 翻译组」。

## 安装

```bash
pnpm add @zui/i18n@npm:@yeyouyuan/zui-i18n@0.4.0
```

`react ^19` 为 peer 依赖。

## useAutoTranslate

```ts
type TranslateProvider = 'openai' | 'deepl' | 'youdao' | 'custom';

interface TranslateConfig {
  provider: TranslateProvider;
  baseURL?: string; // OpenAI 兼容 API 根地址；仅域名时补 /v1
  key?: string; // OpenAI 兼容协议密钥；代理在服务端鉴权时可省略
  model?: string; // OpenAI 兼容协议模型名
  apiKey?: string; // 旧版 OpenAI 写法或 DeepL/有道密钥
  endpoint?: string; // custom 必填；OpenAI 可传完整 Chat Completions 地址
  appSecret?: string; // 有道智云 appSecret（apiKey 为 appKey）
  sourceLang?: string; // 默认 'zh'
  targetLang: string; // 必填，如 'en'
  cache?: boolean; // 默认 true，localStorage
  cacheKey?: string; // 默认 'zui-translate-cache'
}

function useAutoTranslate(config: TranslateConfig): {
  t: (text: string, context?: { component?: string; role?: string }) => Promise<string>;
  tSync: (text: string, context?: { component?: string; role?: string }) => string;
  isLoading: boolean;
  error?: Error;
  clearCache: () => void;
};
```

- `t(text, context)`：异步翻译。`context` 注入组件上下文提示词，如 `t('请选择', { component: 'Select', role: 'placeholder' })` → prompt 注入「这是 Select 组件的 placeholder」。命中缓存立即 resolve。
- `tSync(text)`：命中缓存同步返回译文；未命中返回原文并**异步回填**（回填后组件自动重渲染，下次渲染拿到译文）。
- `isLoading`：有进行中的翻译时 `true`。
- `error`：最近一次 provider 错误。翻译失败**仍返回原文**，不中断渲染。
- `clearCache()`：清空 localStorage 缓存与会话内译文表，下次 `tSync` 重新翻译。

## 快速上手

生产环境建议让应用的同源服务端代理保管 OpenAI 兼容服务的 `baseURL`、`key`、`model` 三项。浏览器只填写代理地址：

```tsx
<ConfigProvider
  translate={{
    provider: 'custom',
    endpoint: '/api/translate',
    targetLang: 'en',
  }}
>
  <App />
</ConfigProvider>
```

代理接收 `{ texts, sourceLang, targetLang, contexts? }` 并返回 `{ translations: string[] }`，完整 Node 示例见文档站“国际化与翻译”页面。代理入口应按应用需求提供鉴权和限流。

在临时直连调试环境中，OpenAI 兼容协议使用 `baseURL`、`key`、`model` 三项：

```tsx
<ConfigProvider
  translate={{
    provider: 'openai',
    baseURL: 'https://example.com/v1',
    key: 'test-key',
    model: 'compatible-model',
    targetLang: 'en',
  }}
>
  <App />
</ConfigProvider>
```

`baseURL` 是 API 根地址：只填域名时内部请求 `/v1/chat/completions`；填已有路径如 `/v1` 或 `/api/proxy/v1` 时追加 `/chat/completions`。直连密钥会进入浏览器运行环境，仅用于临时调试。旧的完整 `endpoint` 与 `apiKey` 配置仍兼容。

独立使用 Hook 时也可通过自定义服务端批量翻译接口：

```tsx
import { useAutoTranslate } from '@zui/i18n';

function MyComponent() {
  const { tSync } = useAutoTranslate({
    provider: 'custom',
    endpoint: '/api/translate', // 服务端保管密钥
    targetLang: 'en',
  });

  return (
    <button aria-label={tSync('关闭', { component: 'Modal', role: 'close' })}>
      {tSync('关闭', { component: 'Modal', role: 'close' })}
    </button>
  );
}
```

## Provider 适配

| provider | 请求                                                                           | 说明                                                                                                                     |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `openai` | 优先完整 `endpoint`，否则按 `baseURL` 拼接 Chat Completions 路径，默认官方地址 | 兼容 Chat Completions 协议；`key` 作为 Bearer 密钥，`model` 默认为 `gpt-4o-mini`                                         |
| `deepl`  | `POST {endpoint ?? https://api-free.deepl.com/v2/translate}`                   | `/v2/translate`，`Authorization: DeepL-Auth-Key …`                                                                       |
| `youdao` | `POST {endpoint ?? https://openapi.youdao.com/api}`                            | 有道智云文本翻译，signType v3 签名（`apiKey`=appKey、`appSecret`=appSecret）；密钥应由服务端保管                         |
| `custom` | `POST {endpoint}`                                                              | 请求 `{ texts, sourceLang, targetLang, contexts? }`，响应 `{ translations: string[] }`；`contexts` 与 `texts` 按索引对应 |

全部用 `fetch` 实现，不引重依赖。

## 缓存

- localStorage，条目名默认 `zui-translate-cache`。
- 缓存 key 包含源/目标语言、provider、baseURL、端点、模型、凭据和原文及组件/角色上下文（FNV-1a 32 位，8 位 hex）。不同密钥不会共用译文；localStorage 只保存哈希键，不保存明文凭据。旧版缓存会自然失效。
- 模板文案会校验 `{year}`、`{min}` 等变量；译文缺失、增加或改名变量时回退原文，不缓存损坏的译文。
- 同一渲染批次的待译文案合并为一次 provider 调用；OpenAI 适配器保留每条文案的组件上下文，并将独立请求的并发量限制为 3。有道适配器仍按接口逐条发送请求。
- 命中直接返回，不发网络请求。
- localStorage 不可用（SSR / 隐私模式）时降级为内存 Map。
- 超过 `MAX_CACHE_ENTRIES`（500）条时按写入顺序淘汰最旧。

## 测试

`src/useAutoTranslate.test.tsx` 用 `translateFn` mock provider 覆盖：

- 缓存命中不重复请求、`clearCache` 后重新翻译；不同上下文/服务商译文隔离
- 并发去重（同文案与上下文共享同一次请求）
- 错误回退（失败返回原文、`error` 暴露错误）
- `tSync` 异步回填 + 自动重渲染

```bash
cd packages/i18n && npx tsc -p tsconfig.json && npx vitest run
```

## ConfigProvider 集成

`packages/ui/src/config/translate.ts` 把 `useAutoTranslate` 接到 `ConfigProvider` 的 `translate` 配置项，让组件内置文案（placeholder / 清除 / 关闭 / 暂无数据 / 上一页 / 下一页等）自动翻译。见该文件与 `docs/src/pages/i18n/TranslateDemo.tsx`。
