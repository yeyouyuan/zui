# ZUI 契约 V4 —— 第一批补齐（Upload / Steps / DateRangePicker / Anchor + npm 发布工程）

> 延续 CONTRACTS.md（V1）/ V2 / V3 全部约定。**注意：V3 之后 Codex 已重构工程**，
> 本轮新增硬性约定如下，与旧契约冲突处以本文为准。

## 0. 当前工程新基线（Codex 重构后，必读）

- **共享浮层引擎**：`packages/ui/src/utils/FloatingPanel.tsx`（Portal + 视口翻转 + 宽度跟随 + 层级继承 + 主题继承）。
  所有"触发器 + 弹出面板"类组件**必须用 `FloatingPanel`**（参考 `Select.tsx` 的用法），禁止手写 fixed 定位。
- **多层 Esc 顺序**：浮层内按键先于外层 Modal/Drawer 消费（utils 已处理，组件只需用 FloatingPanel 即自动获得）。
- **视口单位**：弹层高度上限用 `min(Xpx, calc(100dvh - 16px))`。
- **零硬编码色值**：CSS 只用 `var(--z-*)` 语义令牌 + `color-mix()`。
- **locale 已扩展**：`locale.upload.{text,dragText,remove}`、`locale.steps.label`、`locale.dateRange.{startPlaceholder,endPlaceholder,separator,panelLabel}`、
  `locale.accessibility.anchor` 已由集成者写入 `config/locale.ts`（zhCN/enUS/zhTW/jaJP/koKR 全 5 包），
  组件**直接经 `useZuiConfig()` 消费**，禁止硬编码这些文案。
- **构建**：`packages/ui` 有两个 build：`vite build`（ESM/CJS）与 `build:browser`（CDN IIFE，`vite.browser.config.ts`）。

## 1. 文件边界（5 路并行）

| 路径 | 归属 |
|---|---|
| packages/ui/src/components/{Upload,Steps,DateRangePicker,Anchor}/**（含 meta.json） | 各组件智能体 |
| docs/src/pages/components/{UploadPage,StepsPage,DateRangePickerPage,AnchorPage}.tsx | 各组件智能体写自己的 |
| .changeset/**、docs/RELEASE-CHECKLIST.md、各包 CHANGELOG 校验 | 发布工程智能体 |
| packages/ui/src/index.ts、config/**、utils/**、registry、docs/src/nav.ts、既有组件 | 仅集成者（禁改） |

- 组件间禁止互相 import；共享逻辑只能用 `../../utils`（cx / useControllableState / useOnClickOutside / useFocusTrap / useScrollLock / FloatingPanel / floatingPosition / Portal）。
- 并行期间只跑自己的测试：`npx vitest run src/components/<Name>`；tsc 用 `| grep` 过滤自己的路径。

## 2. Upload（文件上传）

```ts
export interface UploadFile {
  uid: string;                 // 组件生成（z-upload-{n} 或时间戳），受控列表必须保留
  name: string;
  size?: number;               // 字节
  status?: 'uploading' | 'success' | 'error';
  percent?: number;            // 0-100
  response?: unknown;
  error?: string;
  originFileObj?: File;        // 原生 File（内部持有，不序列化）
}
export interface UploadChangeInfo {
  file: UploadFile;
  fileList: UploadFile[];
}
export interface CustomRequestOptions {
  file: File;
  onProgress: (percent: number) => void;
  onSuccess: (response?: unknown) => void;
  onError: (error: Error | string) => void;
}
export interface UploadProps {
  action?: string;                    // 上传 URL；与 customRequest 二选一
  customRequest?: (options: CustomRequestOptions) => { abort?: () => void } | void;
  method?: string;                    // 默认 'post'
  name?: string;                      // 表单字段名，默认 'file'
  headers?: Record<string, string>;
  data?: Record<string, unknown>;     // 附加表单数据
  withCredentials?: boolean;
  accept?: string;                    // 透传 input accept
  multiple?: boolean;                 // 默认 false
  maxCount?: number;                  // 超出时挤掉最旧
  disabled?: boolean;
  draggable?: boolean;                // 拖拽区模式（默认 false 按钮模式）
  fileList?: UploadFile[];
  defaultFileList?: UploadFile[];
  onChange?: (info: UploadChangeInfo) => void;
  onRemove?: (file: UploadFile) => boolean | Promise<boolean> | void;  // 返回 false 阻止移除
  beforeUpload?: (file: File, fileList: File[]) => boolean | Promise<boolean>;  // false 跳过上传但仍入列表?  —— false = 完全跳过（不入列表）
  className?: string;
  classNames?: { root?: string; trigger?: string; list?: string; item?: string; dragzone?: string };
}
```

**实现要求**：
- 隐藏 `<input type="file">`（opacity 0 / 绝对定位，仍可聚焦）+ 可见触发按钮；拖拽模式为整块 dragzone（onDragOver preventDefault + data-dragover 高亮 + onDrop 取 files）。
- 上传引擎：有 `customRequest` 用之；否则用 `XMLHttpRequest`（`upload.onprogress` → percent，`load` 2xx → success，否则 error）。`abort`：组件卸载/移除文件时 xhr.abort()。
- 文件列表项：图标（@zui/icons：Loading=上传中带旋转、CheckCircle=成功、XCircle=失败）+ 文件名（超长省略）+ size 可读格式（B/KB/MB）+ 进度条（uploading 时 width: percent%）+ 移除按钮（`aria-label=locale.upload.remove`）。
- 状态流转：select/drop → （beforeUpload 校验）→ status=uploading percent 0 → progress → success/error；onChange 每次状态变化都触发。
- **maxCount 挤旧**、disabled 禁用 input 与 dropzone、beforeUpload 返回 false 时不入列不触发 onChange。
- 语义：列表 `role="list"`，项 `role="listitem"`；触发按钮 `aria-label=locale.upload.text`。
- **测试（≥14 用例，禁真实网络）**：按钮模式选文件触发 customRequest/XHR mock、进度更新、成功/失败状态、onRemove 阻止移除、beforeUpload false 跳过、maxCount 挤旧、draggable 拖放（DataTransfer mock）、受控 fileList、disabled、classNames/data-part、Esc 无关性。
- meta.json 照 V3 §2 结构。

## 3. Steps（步骤条）

```ts
export type StepStatus = 'wait' | 'process' | 'finish' | 'error';
export interface StepsItem {
  key?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  status?: StepStatus;            // 显式覆盖派生状态
  disabled?: boolean;
}
export interface StepsProps {
  items: StepsItem[];
  current?: number;               // 默认 0
  direction?: 'horizontal' | 'vertical';   // 默认 'horizontal'
  size?: 'md' | 'sm';             // 默认 'md'
  onChange?: (index: number) => void;      // 提供后步骤可点击
  className?: string;
  classNames?: { root?: string; item?: string; icon?: string; content?: string; connector?: string };
}
```

- **派生状态**：idx < current → finish；== current → process；> current → wait；`item.status` 显式覆盖（error 可出现在任意位置）。
- 图标：finish → `CheckCircle`（@zui/icons）；error → `XCircle`；process → 数字（或自定义 icon）；wait → 数字。process 加主色描边/填充。
- 结构：`<ol role="list" aria-label=locale.steps.label>` + `<li>`；每项含圆图标节点 + 连接线（CSS ::after，最后一个无线）+ title/description；当前项 `aria-current="step"`。
- onChange 提供时每项为 `<button>`（disabled 除外），键盘 ↑←/↓→/Home/End 移动 + Enter 确认（roving tabindex）。
- CSS：水平 flex + 连接线 flex:1；vertical 为列布局线在左；process 主色、finish 主色对勾、error danger 色。
- **测试 ≥12**：派生状态、status 覆盖、aria-current、onChange 点击+键盘、disabled、vertical/size 的 data 属性、icon 替换、classNames/data-part。

## 4. DateRangePicker（日期范围，a11y S 级）

```ts
export interface DateRangePickerProps {
  value?: [string, string];              // ISO 'YYYY-MM-DD' 二元组
  defaultValue?: [string, string];
  onChange?: (range: [string, string] | null) => void;   // null = 已清空
  min?: string;
  max?: string;
  disabled?: boolean;
  status?: 'default' | 'error' | 'success';
  size?: 'sm' | 'md' | 'lg';
  allowClear?: boolean;                  // 默认 true（已选时显示清除钮）
  id?: string;
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; day?: string; header?: string };
}
```

- **触发器**：两个只读输入位 + 中间 `locale.dateRange.separator` + 日历图标（@zui/icons Calendar）+ 清除钮（allowClear）。占位符用 `locale.dateRange.startPlaceholder/endPlaceholder`。点击/Enter/↓ 打开面板。
- **面板（必须用 `FloatingPanel`，非 matchWidth）**：**双月并排**（左 = viewMonth，右 = 下月），共享导航（‹ › 逐月平移，aria-label 复用 `locale.date.previousMonth/nextMonth`），月份标题复用 `locale.date.monthFormat`，星期头复用 `locale.date.weekdays`。面板 aria-label = `locale.dateRange.panelLabel`。
- **选择状态机**：无选择 → 点 A（记 start，aria-selected）→ 点 B（≥A 则完成 [A,B] 并关闭；B<A 则 B 成为新 start）。min/max 外禁选（aria-disabled）。
- **范围高亮**：start/end 格 `aria-selected="true"`；中间格 `data-in-range="true"`（浅 primary-subtle 底）。
- **键盘**：触发器 Enter/Space/↓/↑ 开关；面板内 ←→±1 天、↑↓±7 天、Home/End 月首尾、PageUp/PageDown 上/下月、Enter 选定、Esc 关闭并焦点回触发器。焦点跟随日期（roving tabindex 或 aria-activedescendant 二选一，须一致并有测试）。
- **日历网格构建器自包含**（~40 行复制自 DatePicker 逻辑，禁止 import DatePicker）。
- **测试 ≥18**：双月渲染、顺序选择/逆序重开、范围高亮、受控、min/max、清除按钮 onChange(null)、键盘全套、双面板独立导航、Esc 归还焦点、classNames/data-part。
- meta.json 注明「区间版；月份选择器粒度留待后续」。

## 5. Anchor（锚点导航）

```ts
export interface AnchorLinkProps {
  href: string;                   // '#section-id'（必须 # 开头）
  title: React.ReactNode;
  children?: React.ReactNode;     // 嵌套 Anchor.Link（缩进层级）
}
export interface AnchorProps {
  offsetTop?: number;             // 激活判定阈值，默认 0
  target?: () => HTMLElement | Window;   // 滚动容器，默认 window
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>, link: { href: string; title: React.ReactNode }) => void;
  className?: string;
  classNames?: { root?: string; link?: string };
  children?: React.ReactNode;     // Anchor.Link 列表
}
```

- 结构：`<nav aria-label=locale.accessibility.anchor>` + `<ul>`；Link 渲染 `<a href="#id">`（原生锚点语义）。
- **滚动侦测**：rAF 节流监听 target 滚动 + resize；取「top ≤ offsetTop + 8px 的最后一节」为 active（都高于阈值取第一个）；active 链接 `aria-current="true"` + 主色高亮 + 左侧 2px 指示条。
- 点击：preventDefault + 目标 `scrollIntoView({ behavior: 'smooth', block: 'start' })` 减 offsetTop（用 scroll-margin-top 处理亦可，二选一并测试）；点击即置 active。**不改写 location.hash**。
- children 嵌套 Link → ul 内嵌 ul 缩进（CSS padding-left）。
- **测试 ≥10**：渲染链接、滚动侦测激活切换（mock getBoundingClientRect）、点击平滑滚动+preventDefault、active aria-current、嵌套缩进、target 容器、classNames/data-part。

## 6. npm v0.3.0 发布工程（发布智能体）

**任务**（禁止实际 `npm publish`，禁止运行 `changeset version`——组件未全部落地）：
1. 确认根 devDependencies 有 `@changesets/cli`，无则加入并 `pnpm install`。
2. 生成 `.changeset/zui-v0-3-0.md`：对 `@zui/react`、`@zui/tokens`、`@zui/icons`、`@zui/i18n`、`@zui/cli`、`@zui/mcp`、`@zui/blocks` 声明 **minor** bump，描述 V3+V4 全部变更（57+ 组件、AI 生态、浮层引擎、CDN 构建、i18n 语言包、本轮 Upload/Steps/DateRangePicker/Anchor）。
3. 编写 `docs/RELEASE-CHECKLIST.md`（中文发布清单）：前置检查（`pnpm -r build`、`--filter @zui/react build:browser`、`pnpm -r test`、`pnpm lint`、`node scripts/check-distribution.mjs`、`node scripts/check-consumer.mjs`、`node registry/scripts/generate.mjs --check`）→ `npx changeset version` → 核对 CHANGELOG 与版本 → `npm pack` 冒烟 → `changeset publish`（需 NPM_TOKEN）→ tag `v0.3.0` → 注意 CDN 产物拷贝路径含版本号（`docs/dist/cdn/v{version}`）需在 version 后重跑 `build:browser`。
4. 校验 7 个包 `npm pack --dry-run` 的 files 无垃圾（test/dist map 允许、src 不应出现在最终包——以现有 files 字段为准，发现问题只记录到 checklist，不改各包 package.json）。

## 7. 验证要求（每组）

```bash
cd packages/ui && npx vitest run src/components/<Your>          # 只跑自己的
cd packages/ui && npx tsc --noEmit 2>&1 | grep -i "<your paths>" # 过滤自己的错误
```
文档页 import 自 '@zui/react'（导出由集成者汇总）；JSX 属性串内禁止 `\"` 转义（用 `{...}` 表达式）。
