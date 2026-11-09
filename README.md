# ZUI

令牌驱动、零运行时样式、无障碍优先的现代 React 组件库。

## 特性

- **三层设计令牌**：primitive → semantic → component（对标 Adobe Spectrum 分层），CSS 变量驱动，换肤只覆盖语义层
- **零运行时样式**：原生 CSS + CSS 变量（oklch 色彩），无 CSS-in-JS 运行时开销，RSC 友好
- **无障碍优先**：键盘可达一票否决，Select/Modal 等按 WAI-ARIA APG 模式实现
- **语义化定制出口**：`data-part` + slot 级 `classNames` + 组件级 CSS 变量——永不写内部类名覆盖
- **hooks 型反馈 API**：`useMessage()` 感知 React 上下文，无 `message.success()` 静态方法陷阱
- **React 19 原生**：ref 直接作 prop（无 forwardRef）、组合式 API（`Modal.Trigger/.Content`）
- **AI 友好**：`llms.txt`、机器可读契约（CONTRACTS.md）、可预测的组合式 API

## 快速开始

### 直接通过 script 使用

无需安装包，可在普通 HTML 页面中引用公开的浏览器版。它已包含 React 和 React DOM，适合演示或非构建项目；不要与页面现有的另一份 React 混用。

```html
<link rel="stylesheet" href="https://yeyouyuan.github.io/zui/cdn/v0.2.0/zui.css" />
<div id="root"></div>
<script src="https://yeyouyuan.github.io/zui/cdn/v0.2.0/zui.global.js"></script>
<script>
  ZUI.createRoot(document.getElementById('root')).render(
    ZUI.React.createElement(ZUI.Button, { variant: 'primary' }, '你好，ZUI')
  );
</script>
```

[在线脚本演示](https://yeyouyuan.github.io/zui/cdn-demo.html)。公开 Pages 已提供 `v0.2.0` 的 JS、CSS 与演示页；npm 包仍需单独发布。

### 包管理器安装

```bash
pnpm add @zui/react
```

```tsx
import '@zui/react/styles.css';
import { Button, MessageProvider, useMessage } from '@zui/react';

export default function App() {
  return (
    <MessageProvider>
      <Button variant="primary">开始使用</Button>
    </MessageProvider>
  );
}
```

## 换肤（暗色 / 品牌）

```js
// 暗色（零闪烁：@property 已注册关键颜色变量）
document.documentElement.dataset.theme = 'dark';

// 品牌换肤：只覆盖 semantic 层
document.documentElement.style.setProperty('--z-color-primary', 'oklch(0.55 0.2 150)');
```

## 定制出口（三件套）

```tsx
<Button
  classNames={{ root: 'my-btn', label: 'my-btn-label' }}
  data-part="root" // 每个结构元素自带 data-part
/>
```

```css
/* 组件级变量覆盖，不需要知道内部类名 */
.my-btn {
  --z-button-radius: 2px;
}
```

## 包结构

| 包            | 说明                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `@zui/tokens` | 设计令牌：三层 CSS 变量 + TS 常量 + DTCG JSON（Figma/Tokens Studio 可消费） |
| `@zui/react`  | 组件库（当前源码 71 个 Registry 组件条目；v0.2.0 基线为 66 个）             |
| `@zui/icons`  | 图标：142 枚线性图标组件（Feather/Lucide 风格，React 19）                   |
| `@zui/i18n`   | AI 翻译：`useAutoTranslate` 组件内置文案自动翻译                            |
| `@zui/cli`    | registry CLI：`zui init / add / diff / list`                                |
| `@zui/mcp`    | MCP server：给 AI 编码工具暴露 ZUI 组件检索/生成能力                        |
| `@zui/blocks` | 业务区块：16 个页面级区块，涵盖登录、仪表盘、设置与数据展示等场景           |

## 组件清单（v0.2.0，66 个）

**基础**：Button · Input · InputNumber · Checkbox · Radio/RadioGroup · Switch · Select · Cascader · Transfer · Mentions
**表单**：Form · Rate · Slider · ColorPicker
**浮层**：Modal · Drawer · Tooltip · Popover · Popconfirm · DropdownMenu · Message · Notification · Tour
**导航**：Tabs · Pagination · Breadcrumb · Affix · BackTop · FloatButton
**数据展示**：Table · VirtualTable · Tree · TreeSelect · List · Card · Avatar · Badge · Tag · Empty · Skeleton · Divider · Image · QRCode · Watermark · Descriptions · Statistic · Timeline
**日期**：DatePicker · Calendar · TimePicker
**反馈**：Alert · Spin · Progress · Result
**其他**：Collapse · Segmented · App · Upload · Steps · DateRangePicker · Anchor · Typography · Row · Col · Flex · Space
**配置**：ConfigProvider（locale 文案，内置 10 套语言包）

配套：`@zui/icons`（142 枚线性图标，组件内图标已全面接入）、`@zui/tokens`（三层令牌 + DTCG JSON）

下一版本源码已包含 Combobox、MultiCombobox、SideNav、Splitter 和 CommandPalette，共 71 个组件。SideNav、Splitter 与 CommandPalette 的双迁移原型已落地；CommandPalette 仍需真实输入法、读屏与跨平台热键人工验收。DataGrid 已完成性能原型与 RFC 设计稿，待评审后分期实现。详见[组件路线图](./docs/COMPONENT-ROADMAP.md)。

## AI 翻译（`@zui/i18n`）

组件内置文案（placeholder / 无障碍 aria-label / 分页、日期等 locale 段）可随用户语言自动翻译：

```tsx
import { useAutoTranslate } from '@zui/i18n';

const { tSync, isLoading, error, clearCache } = useAutoTranslate({
  provider: 'custom',
  endpoint: '/api/translate', // 服务端持有密钥并返回 { translations: string[] }
  sourceLang: 'zh',
  targetLang: 'en',
});

const placeholder = tSync('请选择', { component: 'Select', role: 'placeholder' });
```

- Provider 可插拔：OpenAI 兼容协议（`baseURL`、`key`、`model`）/ DeepL / 有道 / 自定义翻译函数
- `localStorage` 缓存已译文案，按语言、服务商和组件上下文隔离；翻译失败自动回退原文
- `ConfigProvider translate` 按实际读取的 locale 字段请求翻译；标准语种优先使用 `locale={enUS}` 等静态语言包

## registry / CLI / MCP

- **registry**（`registry/`）：机器可读的组件目录（`registry.json` + schema），记录每个组件的 API、依赖与源码位置
- **CLI**（`@zui/cli`）：`zui init` 初始化、`zui add <component>` 把组件源码复制进你的项目并列出所需依赖、`zui diff` 对比本地与 registry 版本、`zui list` 浏览当前源码的 71 个组件与 16 个业务区块
- **MCP**（`@zui/mcp`）：以 stdio JSON-RPC 暴露 `search` / `api` / `generate` 三个工具，让 AI 编码助手按你的项目上下文检索 ZUI API 并生成组件代码

## 开发

```bash
pnpm install
pnpm test                        # 工作区测试（组件 / a11y / SSR / i18n / CLI / MCP / blocks）
pnpm build                       # 全部包与文档站构建
pnpm typecheck
pnpm lint
pnpm --filter @zui/docs dev       # 文档站 http://localhost:5173
```

## 维护承诺

- 语义化版本：破坏性变更只随 major 版本发布，废弃 API 跨一个大版本后才移除
- API 命名规范见 `CONTRACTS.md`（唯一事实来源）
- 版本历史见 `CHANGELOG.md`；当前待发布的 v0.2.0 包含 66 个 Registry 组件条目、AI 翻译与 registry/CLI/MCP 分发生态；SSR/Next.js 接入见 `docs/SSR.md`

## License

MIT
