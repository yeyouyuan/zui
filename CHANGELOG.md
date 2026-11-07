# Changelog

ZUI 遵循语义化版本：破坏性变更只随 major 发布，废弃 API 跨一个大版本后才移除。

## v0.2.0 —— 66 组件 + AI 生态

**组件（66 个 Registry 条目）**

- 新增数据/日期类：DatePicker、Calendar、TimePicker、Tree、TreeSelect、VirtualTable、List、Collapse、Segmented
- 新增表单类：Form、InputNumber、Rate、Slider、ColorPicker、Cascader、Transfer、Mentions
- 新增反馈/其他：Notification、Popconfirm、Image、Tour、QRCode、Watermark、Affix、BackTop、FloatButton、Result、App
- 新增布局、导航与录入：Upload、Steps、DateRangePicker、Anchor、Typography、Row、Col、Flex、Space

**工程**

- `@zui/icons`（142 枚线性图标）全面接入组件内置图标（Chevron/Close/Check/Loading 等不再内联 SVG）
- locale 全量接入：`ZuiLocale` 新增 date / transfer / timePicker 段，pagination 段收口；DatePicker、Calendar、Pagination、Transfer、TimePicker 内置文案统一走 `useZuiConfig`
- 内置语言包扩展至 10 套；OpenAI 兼容翻译支持 `baseURL`、`key`、`model`，并提供服务端代理示例
- `@zui/react` exports 补齐 `./tooltip`、`./popover`、`./dropdown-menu`、`./progress`、`./spin` 子路径
- 新增 `docs/SSR.md`（Next.js App Router 接入指南）

**AI 生态**

- `@zui/i18n`：`useAutoTranslate` 组件内置文案自动翻译（OpenAI / DeepL / 有道 / 自定义 provider，localStorage 缓存）
- `registry/` + `@zui/cli`：机器可读组件目录，`zui init / add / diff / list` 把组件源码分发进用户项目
- `@zui/mcp`：stdio JSON-RPC MCP server（`search` / `api` / `generate` 工具），服务 AI 编码助手
- `@zui/blocks`：16 个页面级业务区块

## 早期开发阶段：26 个组件

**组件（新增 16 个，累计 26 个）**

- 新增：Tabs、Pagination、Breadcrumb、Table、Card、Avatar、Badge、Tag、Empty、Skeleton、Divider、Tooltip、Popover、DropdownMenu、Message、Alert
- 受控/非受控统一走 `useControllableState` 范式

**工程**

- 三层设计令牌（primitive → semantic → component）+ CSS 变量换肤（`data-theme` 暗色零闪烁）
- `data-part` + slot 级 `classNames` + 组件级 CSS 变量三件套定制出口
- `@zui/tokens` DTCG JSON（Figma / Tokens Studio 可消费）
- hooks 型反馈 API：`useMessage()`（无静态方法陷阱）
- a11y 矩阵测试（role / aria / 键盘）+ SSR 冒烟测试

## v0.1 —— 10 个核心组件

**组件**

- Button、Input、Checkbox、Radio/RadioGroup、Switch、Select、Modal、Drawer、Spin、Progress

**工程**

- React 19 原生 ref（无 forwardRef）、组合式 API（`Modal.Trigger/.Content`）
- ESM + CJS + d.ts + style.css 构建产物；零运行时样式（原生 CSS + oklch）
- `llms.txt` 与机器可读契约（CONTRACTS.md）
