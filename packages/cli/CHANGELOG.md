# @zui/cli

## 0.2.0

### Minor Changes

- # ZUI v0.2.0：66 组件与分发生态（minor）

  本次发布将七个公开包统一更新至 0.2.0，包含组件、语言包、图标、业务区块及浏览器脚本分发。

  ## 组件库（@zui/react）
  - 组件规模扩展至 **66 个 Registry 组件条目**，包括 Upload、Steps、DateRangePicker、Anchor、Typography、Row、Col、Flex 和 Space，并保留 `./config` 子路径导出。
  - **共享浮层引擎**：统一 `floatingPosition` 定位计算与 `FloatingPanel` / portal 基础设施，Modal、Drawer、DropdownMenu、Popover、Tooltip、Select 等浮层类组件共用同一套定位、焦点圈闭（FocusTrap）、点击外部关闭与滚动锁定逻辑。
  - 新增 Upload、Steps、DateRangePicker、Anchor，以及布局与排版组件。
  - 零运行时样式与 `use client` 边界保持不变，CSS 以 `@zui/react/styles.css` 提供。

  ## CDN 构建（@zui/react）
  - 新增 `build:browser`：产出可直接 `<script>` 引用的 **IIFE 单文件** `dist/browser/zui.global.js`（全局变量 `ZUI`）、配套 `zui.css` 与聚合的 `LICENSE.txt`（含 ZUI / React / React DOM 许可证）。
  - 构建时自动把 CDN 产物拷贝到 `docs/dist/cdn/v{version}`，供文档站与 CDN 直接分发；`package.json` 补充 `unpkg` 字段指向浏览器产物。

  ## 设计令牌（@zui/tokens）
  - 三层 CSS 变量体系（base / semantic / dark）+ TS 常量 + DTCG `tokens.json`，支撑全部新组件的主题化与暗色模式。

  ## 图标（@zui/icons）
  - 提供 **142 枚** 24 视窗线性图标组件（Feather/Lucide 风格），供组件与业务区块使用。

  ## 国际化（@zui/i18n + 文档站翻译代理）
  - 组件文案默认表扩充至 **10 套语言包**：zh-CN、zh-TW、en-US、ja-JP、ko-KR、fr-FR、de-DE、es-ES、ru-RU、pt-BR。
  - `useAutoTranslate` AI 自动翻译（openai / deepl / youdao / custom 多 provider + localStorage 缓存），配套文档站 **AI 翻译安全代理**（`docs/translate-proxy.mjs`）：固定上游路径、限制请求体大小与并发、剥离凭据的 SSRF 安全约束。

  ## 生态：registry / CLI / MCP
  - `registry/registry.json` 包含 **66 个组件与 16 个业务区块**，由源码生成并校验。
  - **@zui/cli**：`init` / `add` / `diff` / `list` 四命令，把 registry 组件源码复制进用户项目，内置 registry 数据快照。
  - **@zui/mcp**：纯 stdio JSON-RPC 2.0 的 MCP server（零 SDK 依赖），提供组件搜索与代码生成工具，供 AI 编码助手直连。

  ## 业务区块（@zui/blocks）
  - 提供 **16 个页面级业务区块**，基于 `@zui/react` 组件拼装。
