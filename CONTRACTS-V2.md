# ZUI 契约 V2 —— 新增组件与配套（并行开发第二轮，必读）

> 延续 `CONTRACTS.md`（V1）全部约定：'use client' 首行、React 19 原生 ref（禁 forwardRef）、
> cx 合并类名、useControllableState 受控范式、data-part + classNames + 组件级 CSS 变量三件套、
> 只用语义令牌禁止硬编码色值、测试必写、禁改 src/index.ts 与共享配置。
> 本文只补充「新东西」的精确契约。冲突处以本文为准。

## 0. 文件边界（本轮 10 路并行，违反即冲突）

| 路径 | 归属 |
|---|---|
| packages/ui/src/components/{Tooltip,Popover,DropdownMenu}/** | 浮层组 |
| packages/ui/src/components/{Alert,Badge,Tag}/** | 反馈组 |
| packages/ui/src/components/{Pagination,Breadcrumb}/** | 导航组 |
| packages/ui/src/components/{Avatar,Card,Divider,Empty,Skeleton}/** | 展示组 |
| packages/ui/src/components/{Drawer,Spin,Progress}/** | 交互组 |
| packages/icons/**（新包） | 图标组 |
| packages/ui/src/test/a11y*.test.tsx、docs/a11y-notes.md | a11y 组 |
| scripts/**、.changeset/**、LICENSE、packages/ui/package.json、.github/** | 工程组 |
| docs/src/App.tsx、router.tsx、nav.ts、styles/docs.css、components/{Demo,ApiTable,CodeBlock}.tsx、pages/{Overview,TokensPage,ThemePlayground}.tsx | 文档组 |
| packages/ui/src/components/{Input,Modal,Select,Message}/**（仅文案收口） | Config 组 |
| docs/src/pages/components/<Name>Page.tsx | 各组件组写自己的页 |

- 各组件组写完组件后，顺手写自己的文档页 `docs/src/pages/components/<Name>Page.tsx`（照抄 ButtonPage.tsx 的结构模式：简介 + Demo + ApiTable），**不要动 docs 的 App/router/nav**（集成者统一挂路由）。
- `packages/ui/src/index.ts`、`packages/ui/vite/vitest/tsconfig`、`packages/ui/src/utils/**`、`reset.css`：仅集成者改。
- 并行期间 `npx tsc --noEmit` 会报别人文件的错——只用 `| grep <你的目录>` 过滤自己的；只跑自己目录的 vitest。

## 1. 新组件 API（逐个精确契约；未写明处同 V1 范式）

### Tooltip（悬浮提示，hover/focus 触发）
```ts
interface TooltipProps {
  content: React.ReactNode;              // 提示内容
  children: React.ReactElement;          // 单个子元素（作为触发器）
  placement?: 'top' | 'bottom' | 'left' | 'right';   // 默认 'top'
  delay?: number;                        // 显示延迟 ms，默认 200
  disabled?: boolean;
  className?: string;
  classNames?: { root?: string; content?: string };
}
```
- root 包裹 `z-tooltip-root`（position:relative），content 绝对定位 `z-tooltip`（role="tooltip"，data-placement）。
- hover 进入延迟显示、离开隐藏；focus 显示、blur 隐藏；Esc 隐藏（文档级 keydown）。
- 通过 `aria-describedby` 把 tooltip id 关联到触发器（cloneElement 注入，保留原 props）。
- 深色底浅字浮层（`--z-color-bg-inverse`/`--z-color-fg-inverse`），圆角 6px，小阴影，12px 字。

### Popover（点击弹出层，组合式）
```ts
// Popover（Root Context）+ Popover.Trigger（button 或 asChild 语义：透传到子元素 onClick）
interface PopoverContentProps extends React.ComponentPropsWithRef<'div'> {
  align?: 'start' | 'center' | 'end';    // 相对触发器对齐，默认 'start'
  side?: 'bottom' | 'top';               // 默认 'bottom'
  classNames?: { content?: string };
}
// Popover.Content（Portal 到 body，绝对定位跟随 root 或用 fixed 计算于触发器下）
```
- 点击触发器 toggle；点击外部（useOnClickOutside）与 Esc 关闭；打开焦点进 content 首个可聚焦元素，关闭归还。
- content：`z-popover`，白底圆角 8px + shadow-lg，padding 12px；data-state open/closed 进出场（150ms）。
- 部件：`z-popover-root`（wrapper，relative）/`z-popover`（content）。

### DropdownMenu（菜单，APG menu-button 模式，键盘重点）
```ts
// DropdownMenu（Root Context）+ .Trigger（button，aria-haspopup="menu" aria-expanded）
// .Content（role="menu"）+ .Item + .Separator + .Label（分组标题）
interface DropdownMenuItemProps {
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;                      // 红色危险项（删除类）
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```
- 键盘（必须全测）：打开时焦点进入菜单首项（roving tabindex，menuitem）；↑↓ 移动（跳过 disabled）、Home/End、Enter/Space 触发 onSelect 并关闭且焦点回 Trigger、Esc 关闭回 Trigger、首字母 typeahead、Tab 关闭。
- `z-dropdown-menu`（浮层白底圆角阴影）、`z-dropdown-menu-item`（行高 32px，hover/焦点浅灰底，danger 红字）、`z-dropdown-menu-separator`、`z-dropdown-menu-label`。
- 点击外部关闭；option 交互用 pointerdown preventDefault 防失焦。

### Alert（警告提示条，静态横幅）
```ts
interface AlertProps extends Omit<React.ComponentPropsWithRef<'div'>, 'title'> {
  type?: 'info' | 'success' | 'warning' | 'error';   // 默认 'info'
  title?: React.ReactNode;
  children?: React.ReactNode;            // 辅助描述
  closable?: boolean;
  onClose?: () => void;
  showIcon?: boolean;                    // 默认 true
  classNames?: { root?: string; icon?: string; title?: string; description?: string; close?: string };
}
```
- 浅色状态底 + 状态色边/图标（danger/success/warning/info 的 -subtle/-subtle-fg 对），圆角 8px，左侧图标 + 标题 + 描述。
- 语义：error/warning 用 `role="alert"`，info/success 用 `role="status"`。
- parts：root(`z-alert`)/icon/title/description/close。

### Badge（计数徽标，包裹型）
```ts
interface BadgeProps {
  count?: number;                        // 数字；0 时默认隐藏
  dot?: boolean;                         // 小圆点模式
  max?: number;                          // 超出显示 `${max}+`，默认 99
  showZero?: boolean;                    // 默认 false
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';  // 默认 'error'
  children?: React.ReactNode;            // 有 children 则右上角角标包裹，无则独立展示数字
  className?: string;
  classNames?: { root?: string; indicator?: string };
}
```
- 角标红底白字 12px、圆角 full、最小宽高 16px、定位右上角 translate 50%。dot 模式 8px 圆点。
- parts：root(`z-badge`)/indicator(`z-badge-indicator`)。

### Tag（标签，可关闭）
```ts
interface TagProps extends Omit<React.ComponentPropsWithRef<'span'>, 'color'> {
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';  // 默认 'neutral'
  closable?: boolean;
  onClose?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  classNames?: { root?: string; icon?: string; close?: string };
}
```
- 圆角 4px 小块、浅底+状态字色、24px 高、关闭钮 ×（aria-label="移除标签"）。

### Pagination（分页）
```ts
interface PaginationProps {
  page?: number; defaultPage?: number;   // 受控/非受控，1 起始
  onPageChange?: (page: number) => void;
  pageSize?: number;                     // 默认 10
  total: number;                         // 必填，总条数
  siblings?: number;                     // 当前页两侧页码数，默认 1
  showJumper?: boolean;                  // 跳页输入框
  disabled?: boolean;
  className?: string;
  classNames?: { root?: string; item?: string; jumper?: string };
}
```
- 上/下一页按钮（Chevron 图标纯 CSS/svg）+ 页码 + 省略号 + 可选跳页（Input 数字 + Enter）。
- 当前页 `aria-current="page"`；nav 容器 `role="navigation"` aria-label="分页"；页码 button 32px 方形。
- 省略号渲染逻辑：page 与 siblings 范围外折叠为 `…`（用 `+1`/`+2` 简单渲染 `…` 即可）。

### Breadcrumb（面包屑）
```ts
// Breadcrumb（root：role="navigation" aria-label="面包屑"，ol 结构）
// Breadcrumb.Item: { href?: string; children }；最后一项 aria-current="page"
// 分隔符默认 "/"，Breadcrumb 分隔符 slot：className z-breadcrumb-separator
```
- parts：root(`z-breadcrumb`)/item(`z-breadcrumb-item`)/separator。hover 字色变 primary。

### Avatar（头像）
```ts
interface AvatarProps extends Omit<React.ComponentPropsWithRef<'span'>, 'color'> {
  src?: string;
  alt?: string;
  name?: string;                         // 无图时取首字符（中文取第一个字，英文取首字母大写）
  icon?: React.ReactNode;                // 无图无名时图标
  size?: 'sm' | 'md' | 'lg' | number;    // sm24/md32/lg40，number 自定义 px
  shape?: 'circle' | 'square';           // 默认 'circle'
  classNames?: { root?: string; image?: string; fallback?: string };
}
```
- 图片 object-fit cover；加载失败回退 fallback；fallback 底色按名字哈希在 5 个语义浅色中取（primary/success/warning/info/danger 的 subtle 对）。

### Card（卡片，props 式，不搞组合式——避免过度抽象）
```ts
interface CardProps extends Omit<React.ComponentPropsWithRef<'div'>, 'title'> {
  title?: React.ReactNode;
  extra?: React.ReactNode;               // 头部右侧插槽
  cover?: React.ReactNode;               // 顶部媒体区
  footer?: React.ReactNode;
  bordered?: boolean;                    // 默认 true
  hoverable?: boolean;                   // hover 阴影+上浮
  classNames?: { root?: string; header?: string; title?: string; extra?: string; cover?: string; body?: string; footer?: string };
}
```
- 白底圆角 8px、border-subtle；header 高 48px 左右 padding 20px；body padding 20px；footer 顶部分隔线。

### Divider（分割线）
```ts
interface DividerProps {
  orientation?: 'horizontal' | 'vertical';  // 默认 'horizontal'
  dashed?: boolean;
  children?: React.ReactNode;              // 中间文字（仅 horizontal）
  className?: string;
}
```
- 1px border-subtle 线；带文字时两侧留白 12px、文字 12px fg-muted；vertical 为 1px 竖线 inline-block 高 1em。

### Empty（空状态）
```ts
interface EmptyProps {
  image?: React.ReactNode;               // 自定义插图，默认内置简洁 SVG（两个矩形+圆）
  description?: React.ReactNode;         // 默认「暂无数据」
  children?: React.ReactNode;            // 操作区（如按钮）
  className?: string;
  classNames?: { root?: string; image?: string; description?: string };
}
```
- 垂直居中、插图 64px 灰调、描述 fg-muted 13px、间距 12px。

### Skeleton（骨架屏）
```ts
interface SkeletonProps {
  lines?: number;                        // 文本行数，默认 3
  width?: number | string;
  height?: number | string;
  circle?: boolean;                      // 圆形（头像位）
  active?: boolean;                      // 呼吸/扫光动画，默认 true
  className?: string;
}
```
- bg-muted 底 + 渐变扫光动画（1.5s 循环，prefers-reduced-motion 降级）；行间距 8px、末行宽 60%。

### Drawer（抽屉，组合式，Modal 姊妹件——复用 utils）
```ts
// Drawer（Root Context，受控 open）+ .Trigger + .Content + .Header/.Title/.Body/.Footer/.Close
interface DrawerContentProps {
  placement?: 'left' | 'right' | 'top' | 'bottom';  // 默认 'right'
  size?: number | string;                // 抽屉宽/高，默认 378
  closeOnOverlay?: boolean;              // 默认 true
  closeOnEsc?: boolean;                  // 默认 true
  classNames?: { overlay?: string; content?: string };
}
```
- 与 Modal 相同的焦点陷阱/滚动锁/Portal/进出场规范（data-state open/closed，滑入动画 translateX/Y）；role="dialog" aria-modal；Close aria-label="关闭"。
- parts：`z-drawer-overlay`/`z-drawer`/`z-drawer-header`/`z-drawer-title`/`z-drawer-body`/`z-drawer-footer`/`z-drawer-close`。

### Spin（加载中）
```ts
interface SpinProps {
  spinning?: boolean;                    // 默认 true
  size?: 'sm' | 'md' | 'lg';             // 默认 'md'
  tip?: React.ReactNode;                 // 底部文案
  children?: React.ReactNode;            // 有 children 时包裹并半透明遮罩
  classNames?: { root?: string; spinner?: string; tip?: string };
}
```
- 旋转环（border 技巧或 SVG circle）；包裹模式 absolute 遮罩 + 内容 aria-busy。

### Progress（进度条）
```ts
interface ProgressProps {
  percent: number;                       // 0-100，必填
  size?: 'sm' | 'md';                    // 默认 'md'（6px/8px 高）
  status?: 'normal' | 'active' | 'success' | 'error';  // 默认 'normal'
  showInfo?: boolean;                    // 右侧百分比文字，默认 true
  color?: string;                        // 自定义填充色
  className?: string;
  classNames?: { root?: string; track?: string; fill?: string; info?: string };
}
```
- 轨道 bg-muted 圆角 full；填充 primary（success 绿/error 红/active 带流动光）；role="progressbar" aria-valuenow/min/max；过渡 width 300ms。

## 2. @zui/icons 包（新包 packages/icons）

- `packages/icons/package.json`：name `@zui/icons`，type module，peerDeps react ^19，exports 指向 dist（build: `tsc -p tsconfig.json`，jsx react-jsx，出 esm + d.ts）。
- 24 个图标组件（统一 24 视窗、stroke=currentColor、stroke-width 2、fill none、线性风格近 Feather/Lucide）：
  `Check, Close, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, Plus, Minus, Info, CheckCircle, XCircle, AlertTriangle, Loading, Copy, Eye, EyeOff, Trash, Edit, Calendar, User, Settings, MoreHorizontal`
- 每个组件：
```ts
interface IconProps extends React.ComponentPropsWithRef<'svg'> {
  size?: number | string;                // 默认 '1em'
  color?: string;                        // 默认 currentColor
  spin?: boolean;                        // 仅 Loading 有意义，其它图标接受但忽略
}
```
- 文件：`src/icons/<Name>.tsx` + `src/index.ts`（全导出 + `IconProps` 类型）+ README。
- Loading 的 spin 用 CSS-in-attribute？不引 CSS 文件——用 svg 自身 `<animateTransform>` 或 style 属性 keyframes 不可行，改用 `style={{ animation: 'z-icon-spin 1s linear infinite' }}` 需要 keyframes——**用 svg 内嵌 `<style>` 一次**（每个 Loading 渲染内联 style 标签定义 @keyframes z-icon-spin，可接受；或 animateTransform 旋转 360 循环，选 animateTransform 方案，纯 SVG 零 CSS）。
- 文档页不需要（图标在文档站 Overview 里展示即可，集成者处理）。

## 3. ConfigProvider + 文案收口（Config 组）

```ts
interface ZuiLocale {
  select: { placeholder: string };       // '请选择'
  input: { clear: string };              // '清除'
  modal: { close: string };              // '关闭'
  drawer: { close: string };
  message: { close: string };
  pagination: { prev: string; next: string; jumper: string };  // '上一页'/'下一页'/'跳至'
  empty: { description: string };        // '暂无数据'
}
interface ConfigProviderProps {
  locale?: Partial<ZuiLocale>;           // 与默认 zh-CN 深合并
  children?: React.ReactNode;
}
function ConfigProvider(props): JSX.Element;
function useZuiConfig(): { locale: ZuiLocale };
```
- 实现放 `packages/ui/src/config/`（ConfigProvider.tsx、locale.ts、useZuiConfig.ts、index.ts）。
- 收口改动（仅这些既有文件）：Input.tsx（clear aria-label）、Modal.tsx（Close aria-label）、Select.tsx（placeholder 默认值）、Message（close aria-label）、Drawer 新组件直接受影响的写法——**新组件由各组自行用 useZuiConfig**？不行会跨组依赖未就绪的模块。约定：**新组件本轮仍用硬编码中文默认文案**，Config 组只收口 Input/Modal/Select/Message 四处 + 写好 config 模块供下轮统一。文档注明。
- `useZuiConfig` 在无 Provider 时返回默认 locale 不 throw（与 useMessage 不同，配置必须可缺省）。

## 4. a11y 组（新测试文件，禁止加新依赖）

- `packages/ui/src/test/a11y.roles.test.tsx`：全组件 ARIA 角色矩阵断言（Select 触发器 aria-haspopup/expanded、Modal role=dialog aria-modal、Tabs role=tablist/tab/tabpanel、Message role=status、Switch role=switch、RadioGroup role=radiogroup、Pagination role=navigation、Tooltip role=tooltip）。
- `packages/ui/src/test/a11y.keyboard.test.tsx`：抽样键盘流（Tabs 方向键、Select 全套、Modal Esc/焦点归还、Message Esc 不吞事件）。
- `packages/ui/src/test/a11y.labels.test.tsx`：所有可交互元素有可访问名（getByRole('button', { name })）。
- `docs/a11y-notes.md`：读屏怪癖清单（VoiceOver/NVDA 已知问题与规避，参考 React Aria 博客经验写成 ZUI 自己的清单）+ 组件 a11y 难度分级表。
- **禁止**安装 vitest-axe 等新依赖；禁止改既有测试文件；只新增 `a11y*` 文件。

## 5. 工程组（唯一可改 package.json / CI 的组）

- `LICENSE`（MIT，占位 Copyright (c) 2026 ZUI Contributors）。
- `packages/ui/package.json` exports 增加 per-component subpath（`"./button"`、`"./modal"` … 每组件指向 `./dist/index.js` 即可（同产物多入口挂同一文件亦可接受，写 `./dist/index.js`），别名 + `./styles.css` 保持。
- `.changeset/config.json`（changesets 初始化配置，access public，baseBranch main）。
- `.github/workflows/ci.yml` 增加：`npx vitest run` 全量、`npm pack --dry-run` 冒烟、体积预算步骤（沿用 gzip 预算，JS < 48KB gzip 给新组件留量）。
- `scripts/ssr-smoke.mjs` 或 `packages/ui/src/test/ssr.test.tsx`（二选一，优先 vitest 测试）：`renderToString` 渲染 Button/Input/Select/Modal.Content 关闭态/MessageProvider 不炸、输出含 z- 类名。禁止引入新依赖（react-dom/server 已有）。
- 根 package.json scripts 增加 `changeset`/`release` 占位脚本。

## 6. 文档组（体验升级，不写新组件页）

- 顶栏暗色切换（文档站 chrome 自身也用 z 令牌）、移动端响应式（侧栏折叠为顶部菜单）、侧栏搜索过滤框（按名称过滤导航项）、代码块复制按钮（navigator.clipboard）。
- `docs/src/nav.ts`：导航注册表（数组：{ title, path, group }），App 侧栏从它渲染——**初始只含现有页面**，集成者会追加新组件页。
- ThemePlayground 增强：3 个预设主题按钮（默认蓝/深紫/森绿——改 hue 与圆角组合）、导出 CSS/JSON 双格式、重置按钮。
- Demo/ApiTable/CodeBlock 的 props 只允许**增量**扩展（各组件组正在按现有 API 写文档页，不可破坏兼容）。

## 7. 验证要求（每组）

- 只跑自己目录：`cd packages/ui && npx vitest run src/components/<自己的>`；tsc 用 `npx tsc --noEmit 2>&1 | grep '<自己的路径>'` 过滤。
- 图标组：`cd packages/icons && npx tsc -p tsconfig.json` 必须过。
- 文档组：`cd docs && npx vite build` 必须过。
- 工程组：`npx vitest run src/test/ssr*`（若用 vitest 方案）+ `node scripts/ssr-smoke.mjs`（若用脚本方案）+ `npm pack --dry-run`（在 packages/ui）。
- 禁止全量 `pnpm test`/`pnpm build`（并行期间会互相干扰）。
