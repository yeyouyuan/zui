# ZUI 契约 V5 —— 第二批：质量护城河 + 页面骨架层

> 延续 CONTRACTS V1-V4 全部约定。新基线（V4 后）：FloatingPanel 浮层引擎为弹层标配、
> locale 全走 `useZuiConfig()`、零硬编码色值、React 19 原生 ref、'use client' 首行。
> 版本基线：**v0.2.0**（已固化，CHANGELOG 已生成）。

## 0. 文件边界（4 路并行）

| 路径 | 归属 |
|---|---|
| packages/ui/src/components/{Typography,Row,Col,Flex,Space}/**（含 meta.json） | 组件智能体 |
| docs/src/pages/components/{TypographyPage,LayoutPage}.tsx | 对应智能体 |
| e2e/**（playwright.config.ts + tests）、根 package.json scripts/devDeps | E2E 智能体 |
| packages/ui/src/test/a11y.axe.test.tsx、packages/ui/package.json devDeps、CI workflow a11y 段 | axe 智能体 |
| packages/ui/src/index.ts、config/**、utils/**、registry、docs/src/nav.ts | 仅集成者（禁改） |

- 新组件 locale 键已备好：`locale.accessibility.copy`（'复制'）/ `copied`（'已复制'）。
- 并行期间只跑自己的测试；tsc 用 `| grep` 过滤。

## 1. Typography（排版，组合式）

```ts
export type TypographyType = 'secondary' | 'success' | 'warning' | 'danger';
interface CopyConfig { text?: string; onCopy?: () => void }
interface BaseProps { type?: TypographyType; copyable?: boolean | CopyConfig; delete?: boolean; className?; classNames?: {root?, copy?}; children? }
Typography.Title:  { level?: 1|2|3|4|5 (默认 1，渲染 h1-h5) } & BaseProps
Typography.Paragraph: BaseProps & { ellipsis?: boolean | { rows: number } }   // rows 用 -webkit-line-clamp
Typography.Text: BaseProps & { code?: boolean; mark?: boolean; underline?: boolean; strong?: boolean; keyboard?: boolean }
```

- **copyable**：内容后渲染复制按钮（图标 Copy→成功短暂 CheckCircle 1.5s）；`navigator.clipboard.writeText`，失败回退 `textarea + execCommand('copy')`；`aria-label=locale.accessibility.copy`，成功后 `title=locale.accessibility.copied` + `aria-live="polite"` 反馈节点；CopyConfig.text 覆盖被复制内容（默认取 children 文本）。
- **语义**：Text 默认 `<span>`（code→`<code>`、keyboard→`<kbd>`、mark→`<mark>`、strong 加粗、underline 下划线、delete→`<del>`）；Title 渲染 `h1-h5`；Paragraph `<p>`。`type` 只调色（`--z-color-fg-muted` / success / warning / danger）。
- 类名：`z-typography`（根共享）+ `z-typography-h1..h5 / paragraph / text`；字号字重全部走 `--z-text-*` / `--z-weight-*` 令牌。
- **测试 ≥14**：h 级别标签、type 配色 data-type、code/mark/strong/delete/underline 组合、ellipsis rows（style 断言）、copyable 点击写剪贴板（mock navigator.clipboard）+ 反馈态、CopyConfig.text、classNames/data-part。

## 2. Layout（Row / Col / Flex / Space，纯展示无状态）

```ts
// Row —— 24 栅格水平容器
Row: {
  gutter?: number | [number, number];   // 默认 0；[水平, 垂直]
  justify?: 'start'|'end'|'center'|'space-between'|'space-around'|'space-evenly';  // 默认 'start'
  align?: 'top'|'middle'|'bottom';      // 默认 'top'
  wrap?: boolean;                       // 默认 true
  children; className?; classNames?: {root?};
}
// Col —— 栅格列（必须是 Row 直接子级）
Col: {
  span?: number;    // 1-24，宽度 calc(span/24*100%)
  offset?: number;  // 0-23，margin-left
  flex?: string | number | 'auto' | 'none';  // 提供时覆盖 span（flex-basis 语义）
  children; className?; classNames?: {root?};
}
// Flex —— 万能弹性容器
Flex: { vertical?: boolean; justify?:同 Row; align?: 'start'|'center'|'end'|'baseline'|'stretch'; gap?: 'sm'|'md'|'lg' | number | string; wrap?: boolean; flex?: string|number; component?: 'div'|'span'|'ul'|'ol'; children; className?; classNames?: {root?} }
// Space —— 间距容器（inline-flex）
Space: { size?: 'sm'|'md'|'lg' | number;   // 默认 'md'（8px）
  direction?: 'horizontal'|'vertical';     // 默认 'horizontal'
  wrap?: boolean; align?: 'start'|'center'|'end'|'baseline'; children; className?; classNames?: {root?} }
```

- **gutter 实现（antd 范式）**：Row 水平 gutter → 自身 `margin-inline: -g/2` + 每个 Col `padding-inline: g/2`（经 Context 注入 Col，禁止 children 遍历 clone）；垂直 gutter → Row `row-gap`。
- Col 宽度走 CSS：`.z-col` 默认 `flex: 0 0 auto`，span/offset 用内联 `style={{ '--z-col-span': n }}` + CSS `width: calc(var(--z-col-span,24)/24*100%)`；flex prop 直接内联 `flex`。Col 内联 CSS 变量而非生成 240 个工具类（零运行时样式原则下最简方案，文档注明）。
- Flex gap：sm/md/lg 映射 `--z-space-2/3/4`；number→px、string 原样（走内联 `gap`）。
- Space：`inline-flex; gap`；direction=vertical 加 `flex-direction: column`；wrap 允许 `flex-wrap: wrap`。
- 语义：Row/Col/Flex 无 role（纯布局 div）；Flex component prop 可换语义标签。
- CSS 全部语义令牌 + `--z-row-* / --z-col-* / --z-flex-* / --z-space-*` 组件变量。
- **测试（合计 ≥24）**：Row gutter（含负 margin/Col padding/Context 断言）、justify/align/wrap data 属性、Col span/offset 内联变量、flex 覆盖、Flex 方向/gap 映射/component 换标签、Space 尺寸映射（number→px）/direction/wrap、classNames/data-part。

## 3. Playwright E2E 框架（E2E 智能体）

- 根目录新增：`e2e/docs-smoke.spec.ts`（可拆多个 spec）、`playwright.config.ts`、根 package.json 增加 devDep `@playwright/test` 与 script `"test:e2e": "playwright test"`。
- **config**：`testDir: '../e2e'`（config 放 e2e/ 内则 testDir '.'）、`baseURL: http://localhost:5174`、`webServer: { command: 'pnpm --filter @zui/docs dev --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true }`、`projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`、`use: { viewport: { width: 1280, height: 800 } }`。
- **冒烟用例（≥10）**：
  1. 概览/令牌/主题/i18n 四页 h1 可见且无「页面出错了」；
  2. Form 页：空提交出现校验红字，填写后提交成功回显；
  3. Select 页：点击展开选项并选中，触发器文本变化；
  4. Modal 页：打开后 role=dialog 可见，Esc 关闭；
  5. DatePicker 页：打开日历选一天，输入位出现所选 ISO；
  6. VirtualTable 页：容器滚动后 aria-rowindex 变化（虚拟化生效）；
  7. 暗色切换：`data-theme="dark"` 生效后切回；
  8. **console error 收集**：每页收集 pageerror/console.error，断言为 0（全局 beforeEach 挂监听）。
- 纪律：hash 路由切换用 `page.evaluate(() => location.hash = ...)`（page.goto 同源 hash 不触发重渲染）；strict locator（count 校验）；每断言前 domSnapshot 或语义 role 定位；**不改任何 packages/ 源文件**。
- 运行说明写进 e2e/README.md（`npx playwright install chromium` 一次性、与手动 dev server 并存）。

## 4. axe-core 自动化无障碍（axe 智能体）

- `packages/ui` devDeps 增加 `axe-core`（用 `axe.source` 注入或 `axe-core` 的 jsdom 可用 API；不引 axe-playwright）。
- 新测试 `packages/ui/src/test/a11y.axe.test.tsx`：渲染代表性矩阵（Button 各变体、Input+label、Select 关闭态、Checkbox/Radio/Switch、Tabs、Table、Alert、Empty、Card、Pagination、Badge），每棵树跑 `axe.run(node, { rules: { 'color-contrast': { enabled: false } /* jsdom 无法算对比度，禁用并注释 */ } })`，断言 violations 为 0；发现真实违规 → 修复组件而非豁免（如确有豁免需求，在结果里按 `id` 显式禁用并注释原因）。
- 每组件 axe 前需容器带 `z-reset` class（box-sizing 依赖）。
- CI（`.github/workflows/ci.yml`）无需单独步骤——axe 测试在 `pnpm -r test` 内自动执行；在 workflow 的 a11y 相关位置加一行注释说明即可。
- 若 axe 对某组件报违规：小问题直接修（如缺 label），结构性问题在测试内按规则豁免并写明原因到 `docs/a11y-notes.md` 追加小节。

## 5. 验证要求

- 组件组：`npx vitest run src/components/<Your>` + `npx tsc --noEmit | grep` 过滤。
- E2E 组：`npx playwright test --reporter=line`（需先 `npx playwright install chromium`；dev server 由 webServer 自动管理，reuseExistingServer 兼容手动启动的 5174）。
- axe 组：`npx vitest run src/test/a11y.axe`。
