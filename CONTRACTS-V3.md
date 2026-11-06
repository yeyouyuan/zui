# ZUI 契约 V3 —— V3 扩产（并行开发第三轮，必读）

> 延续 `CONTRACTS.md`（V1）与 `CONTRACTS-V2.md`（V2）全部约定：'use client' 首行、
> React 19 原生 ref（禁 forwardRef）、cx 合并类名、useControllableState 受控范式、
> data-part + classNames + 组件级 CSS 变量三件套、只用语义令牌禁止硬编码色值、
> 测试必写、禁改 src/index.ts 与共享配置。冲突处以本文为准。

## 0. 文件边界（本轮 10 路并行，违反即冲突）

| 路径                                                                                                                                                                     | 归属                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| packages/ui/src/components/{Form,Slider,Rate,InputNumber,ColorPicker}/**                                                                                                 | 表单组                                               |
| packages/ui/src/components/{DatePicker,Calendar,Descriptions,Statistic,Timeline}/**                                                                                      | 数据A组                                              |
| packages/ui/src/components/{VirtualTable,Tree,TreeSelect,Collapse,List}/**                                                                                               | 数据B组（VirtualTable 新增独立组件，不动现有 Table） |
| packages/ui/src/components/{Transfer,Cascader,TimePicker,Mentions,Notification,Popconfirm,Image,Tour,Segmented,QRCode,Watermark,Affix,BackTop,FloatButton,Result,App}/** | 补全组（16 件）                                      |
| packages/i18n/**（新包）+ packages/ui/src/config/translate.ts（新增文件） + docs/src/pages/i18n/**                                                                       | AI 翻译组                                            |
| packages/cli/**（新包）+ registry/**（schema + item 生成）                                                                                                               | registry 组                                          |
| packages/mcp/**（新包）                                                                                                                                                  | MCP 组                                               |
| packages/blocks/**（新包：登录/仪表盘/表格/表单 4 块）                                                                                                                   | 区块组                                               |
| packages/ui/src/components/**（仅图标替换与 locale 收口）+ README.md + CHANGELOG.md + docs/SSR.md                                                                        | 工程组                                               |
| docs/src/pages/components/<新组件>Page.tsx                                                                                                                               | 各组件组写自己的                                     |
| docs/src/nav.ts、App.tsx、router.tsx、index.ts、packages/ui/vite/vitest/tsconfig、utils/**                                                                               | 仅集成者                                             |

- 各组并行期间只用 `| grep <你的目录>` 过滤 tsc；只跑自己目录的 vitest。
- 新组件页照抄 `docs/src/pages/components/ButtonPage.tsx` 模式（usePageTitle + Demo + ApiTable + CustomizeOutlet），import 自 `@zui/react`，不要动 nav.ts。

## 1. 新组件 API（精确契约；未写明处同 V1/V2 范式；每组件均含 data-part/classNames/CSS 变量三件套）

### Form（表单容器，antd 灵魂组件）

```ts
interface FormRule {
  required?: boolean;
  message?: string;
  min?: number;
  max?: number; // 长度或数值范围（含）
  pattern?: RegExp;
  validator?: (value: unknown) => boolean | string; // 返回 false 或错误消息
}
interface FormProps {
  initialValues?: Record<string, unknown>;
  onFinish?: (values: Record<string, unknown>) => void;
  onFinishFailed?: (errors: Record<string, string>) => void;
  children: React.ReactNode;
  className?: string;
  classNames?: { root?: string };
}
// Form.Item: { name: string; label?: React.ReactNode; rules?: FormRule[]; required?: boolean; children: React.ReactElement }
// useForm(): { validateFields, setFieldsValue, getFieldsValue, resetFields, scrollToField }
```

- Form.Item 用 Context 把 name/value/onChange/校验错误注入单子元素（cloneElement）。
- 校验时机：blur 时校验该字段、submit 时全量校验；错误红字 + `aria-invalid` + `aria-describedby`。
- parts：root(`z-form`)/item(`z-form-item`)/label(`z-form-item-label`)/control(`z-form-item-control`)/error(`z-form-item-error`)。

### Slider（滑块）

```ts
interface SliderProps {
  value?: number;
  defaultValue?: number;
  onChange?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number; // 默认 0/100/1
  disabled?: boolean;
  marks?: Record<number, React.ReactNode>;
  tooltip?: boolean; // 拖动时显示数值，默认 true
  className?: string;
  classNames?: { root?: string; track?: string; fill?: string; thumb?: string; mark?: string };
}
```

- role="slider"，aria-valuenow/min/max/valuetext；←→/↑↓/Home/End/PageUp/PageDown 键盘步进（APG slider 模式）。
- parts：root(`z-slider`)/track/fill/thumb/mark。thumb 16px 圆带阴影。

### Rate（评分）

```ts
interface RateProps {
  value?: number;
  defaultValue?: number;
  onChange?: (v: number) => void;
  count?: number; // 默认 5
  allowHalf?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  className?: string;
  classNames?: { root?: string; star?: string; half?: string };
}
```

- 原生 button 星形 + aria-checked/role="radio" 或 role="slider"（用 radiogroup 语义更清晰：role="radiogroup" + 每星 role="radio" aria-checked）；←→ 键盘调整。星形 SVG（五角星 path），选中 warning 色（`--z-color-warning`）。

### InputNumber（数字输入）

```ts
interface InputNumberProps {
  value?: number;
  defaultValue?: number;
  onChange?: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number; // 默认 -Infinity/Infinity/1
  precision?: number; // 小数位
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  controls?: boolean; // 显示 +/- 按钮，默认 true
  className?: string;
  classNames?: { root?: string; input?: string; increase?: string; decrease?: string };
}
```

- input type=number 语义 + ↑↓ 键盘步进 + +/- 按钮（aria-label="增加"/"减少"，从 locale 未来扩展，本轮硬编码中文）。边界 clamp。

### ColorPicker（取色器）

```ts
interface ColorPickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (hex: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: { root?: string; swatch?: string; panel?: string; hue?: string };
}
```

- 触发器显示色块（swatch）+ hex 文本；点击弹出面板（Popover 模式，绝对定位，外部点击/Esc 关闭）。
- 面板：饱和度/亮度方块（HSV 二维）+ 色相条（hue slider）+ hex input。内部状态 HSV→hex 转换。**不做 alpha**。
- 键盘：面板内 ←→/↑↓ 调 SV、Home/End 调 hue。

### DatePicker（a11y S 级重点）

```ts
interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void; // ISO 'YYYY-MM-DD'
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; day?: string; header?: string };
}
```

- 触发器 Input 样式（同 Input 视觉）+ 日历图标；点击/Enter/↓ 打开日历面板（Portal 或绝对定位，Popover 模式）。
- 日历网格：`role="grid"` + `role="gridcell"` + `aria-selected`；月份/年切换（Chevron 图标）；今天高亮；min/max 外禁用。
- 键盘（必须全测）：←→/↑↓ 移动日期（周循环）、Home/End 月首尾、PageUp/PageDown 上/下月、Enter 选中关闭、Esc 关闭归还焦点。
- 触发器 input 直接输入 ISO 日期解析合法值。**区间版不在本轮**（v0.4）。

### Calendar（日历，静态展示）

```ts
interface CalendarProps {
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  fullscreen?: boolean; // 默认 true 全幅
  className?: string;
  classNames?: { root?: string; header?: string; grid?: string; day?: string };
}
```

- 与 DatePicker 共享日历网格实现思路（但独立组件，不复用内部——避免组件间 import）。月份导航 + 选中日 + 今天。

### Descriptions（描述列表）

```ts
interface DescriptionsProps {
  title?: React.ReactNode;
  column?: number; // 默认 3（每行项数）
  size?: 'sm' | 'md'; // 默认 'md'
  bordered?: boolean; // 默认 false
  children?: React.ReactNode; // Descriptions.Item
  className?: string;
}
// Descriptions.Item: { label: React.ReactNode; span?: number }
```

- `<dl>/<dt>/<dd>` 语义。bordered 时 td 风格边框。

### Statistic（统计数值）

```ts
interface StatisticProps {
  title?: React.ReactNode;
  value: number | string;
  precision?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
  className?: string;
  classNames?: { root?: string; title?: string; value?: string; suffix?: string };
}
```

- 数字格式化（千分位）+ 前后缀 + 标题。大数字字重 600。

### Timeline（时间轴）

```ts
interface TimelineProps {
  items: Array<{
    label?: React.ReactNode;
    children: React.ReactNode;
    color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
    dot?: React.ReactNode;
  }>;
  mode?: 'left' | 'right' | 'alternate'; // 默认 'left'
  pending?: React.ReactNode;
  className?: string;
  classNames?: { root?: string; item?: string; dot?: string; label?: string; content?: string };
}
```

- 竖线 + 节点圆点 + 内容；颜色映射状态色。

### VirtualTable（虚拟滚动表格，差异化重点）

```ts
interface VirtualTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: Array<{
    key: string;
    title: React.ReactNode;
    width?: number;
    render?: (row: T) => React.ReactNode;
    fixed?: 'left' | 'right';
  }>;
  rowHeight?: number; // 默认 48
  height?: number; // 容器高度，必填
  overscan?: number; // 默认 5
  onRowClick?: (row: T) => void;
  className?: string;
  classNames?: { root?: string; header?: string; body?: string; row?: string; cell?: string };
}
```

- 纯自研虚拟滚动（不引库）：容器固定 height + 内部 spacer 撑总高度 + 可视区渲染 rows（滚动监听 rAF 优化）。
- 大数据目标：10000 行渲染流畅（只渲染 ~20 行 DOM）。固定列（fixed left/right）用 sticky CSS。
- **不与现有 Table 组件合并**（独立组件，避免破坏 411 测试）。
- parts：root(`z-virtual-table`)/header/body/row/cell。aria：role="table"/"row"/"cell"，row aria-rowindex。

### Tree（树，勾选传播/异步）

```ts
interface TreeNode {
  key: string;
  title: React.ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
  isLeaf?: boolean;
  loading?: boolean;
}
interface TreeProps {
  data: TreeNode[];
  checkable?: boolean;
  checkedKeys?: string[];
  defaultCheckedKeys?: string[];
  onCheck?: (keys: string[]) => void;
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  onExpand?: (keys: string[]) => void;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  loadData?: (node: TreeNode) => Promise<void>; // 异步加载子节点
  className?: string;
  classNames?: { root?: string; node?: string; label?: string; icon?: string; checkbox?: string };
}
```

- role="tree"/"treeitem"，aria-expanded/aria-checked（勾选传播：父子联动，半选 indeterminate）。展开图标（Chevron）+ 加载 spinner。
- 键盘：↑↓ 移动节点、← 折叠/跳父、→ 展开/跳子、Space 勾选、Enter 选中。

### TreeSelect（树选择）

```ts
interface TreeSelectProps {
  data: TreeNode[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (keys: string[]) => void;
  multiple?: boolean; // 默认 true
  placeholder?: string;
  ariaLabel?: string; // 触发器的稳定无障碍名称
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; tags?: string };
}
```

- 触发器（Input 样式）+ 多值 Tag 显示 + 弹出 Tree 面板（Popover 模式）。
- 触发器 Enter/Space/↓ 打开并聚焦首项；面板 ↑↓/Home/End 导航，←→ 展开或收起，Space/Enter 选择，Esc 关闭并归还焦点。

### Collapse（折叠面板）

```ts
interface CollapseProps {
  items: Array<{
    key: string;
    label: React.ReactNode;
    children: React.ReactNode;
    disabled?: boolean;
  }>;
  value?: string[];
  defaultValue?: string[];
  onChange?: (keys: string[]) => void;
  accordion?: boolean; // 手风琴模式（单开）
  className?: string;
  classNames?: { root?: string; item?: string; header?: string; content?: string };
}
```

- role="button" header + aria-expanded/aria-controls；展开高度动画（CSS grid-template-rows 或 max-height 过渡）。

### List（列表）

```ts
interface ListProps {
  items: Array<{
    key: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    extra?: React.ReactNode;
    avatar?: React.ReactNode;
  }>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bordered?: boolean; // 默认 true
  size?: 'sm' | 'md'; // 默认 'md'
  loading?: boolean;
  className?: string;
  classNames?: { root?: string; item?: string; meta?: string; extra?: string };
}
```

- ul/li 语义 + 头像/标题/描述/右侧 extra。

### Transfer（穿梭框）

```ts
interface TransferProps {
  dataSource: Array<{ key: string; title: React.ReactNode; disabled?: boolean }>;
  targetKeys?: string[];
  defaultTargetKeys?: string[];
  onChange?: (keys: string[]) => void;
  titles?: [string, string]; // 默认 ['源列表','目标列表']
  showSearch?: boolean;
  className?: string;
  classNames?: { root?: string; list?: string; item?: string; buttons?: string };
}
```

- 双列 + 中间移动按钮（→/←，Chevron 图标）+ checkbox 选择。role="listbox"/"option"，键盘移动。

### Cascader（级联）

```ts
interface CascaderOption {
  value: string;
  label: React.ReactNode;
  children?: CascaderOption[];
  disabled?: boolean;
}
interface CascaderProps {
  options: CascaderOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (path: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSearch?: boolean;
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; menu?: string; item?: string };
}
```

- 触发器 + 多列菜单（每列一栏，hover/选中展开下一列）+ 路径值。键盘：←→ 切列、↑↓ 列内移动、Enter 选中。

### TimePicker（时间选择）

```ts
interface TimePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (time: string) => void; // 'HH:mm:ss'
  format?: 'HH:mm' | 'HH:mm:ss'; // 默认 'HH:mm'
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; column?: string; item?: string };
}
```

- 触发器 + 弹出面板（时/分/秒三列滚动列表，当前值高亮）。键盘 ↑↓ 滚动列、Enter 确认、Esc 关闭。

### Mentions（提及）

```ts
interface MentionsProps {
  options: Array<{ value: string; label?: React.ReactNode }>;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  prefix?: string; // 触发前缀，默认 '@'
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  classNames?: { root?: string; textarea?: string; panel?: string; item?: string };
}
```

- textarea + 输入 prefix 字符触发下拉建议（选项过滤），↑↓ 移动、Enter/Tab 插入、Esc 关闭。

### Notification（通知卡片）

```ts
interface NotificationConfig {
  title: React.ReactNode;
  description?: React.ReactNode;
  duration?: number; // 默认 4500；0 不自动关
  closable?: boolean; // 默认 true
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'; // 默认 'topRight'
  icon?: React.ReactNode;
  onClick?: () => void;
}
// NotificationProvider + useNotification(): { open, success, error, warning, info, close, destroy }
```

- 与 Message 类似但卡片更大、可点击、右上角。role="alert" 或 "status"。

### Popconfirm（气泡确认）

```ts
interface PopconfirmProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string; // 默认 '确定'/'取消'
  children: React.ReactElement;
  className?: string;
  classNames?: { root?: string; content?: string; actions?: string };
}
```

- Popover 式浮层 + 标题/描述/确定取消按钮。确定触发 onConfirm 并关闭。

### Image（图片）

```ts
interface ImageProps extends Omit<React.ComponentPropsWithRef<'img'>, 'onError'> {
  width?: number | string;
  height?: number | string;
  fallback?: string;
  preview?: boolean; // 点击预览大图，默认 true
  alt?: string;
  className?: string;
  classNames?: { root?: string; image?: string; preview?: string };
}
```

- 预览：点击打开全屏遮罩大图（Portal + Esc/点击关闭）。

### Tour（漫游引导）

```ts
interface TourStep {
  title: React.ReactNode;
  description?: React.ReactNode;
  target: string | (() => HTMLElement | null); // CSS 选择器或函数
  placement?: 'top' | 'bottom' | 'left' | 'right';
}
interface TourProps {
  steps: TourStep[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  current?: number;
  onCurrentChange?: (i: number) => void;
  className?: string;
}
```

- 高亮目标元素（遮罩挖洞，用 box-shadow 技巧）+ 浮层卡片 + 上一步/下一步/完成。Esc 关闭。

### Segmented（分段控制器）

```ts
interface SegmentedProps {
  options: Array<{
    value: string;
    label: React.ReactNode;
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean; // 撑满宽度
  className?: string;
  classNames?: { root?: string; item?: string; thumb?: string };
}
```

- role="radiogroup" + role="radio" + 选中项滑块（thumb 过渡动画）。←→ 键盘。

### QRCode（二维码）

```ts
interface QRCodeProps {
  value: string;
  size?: number; // 默认 160
  level?: 'L' | 'M' | 'Q' | 'H'; // 纠错级别，默认 'M'
  color?: string; // 默认 --z-color-fg
  bgColor?: string; // 默认 --z-color-bg
  className?: string;
}
```

- 自研二维码生成（纯 TS，不引库——最小 QR 编码器，支持字节模式 + 纠错 L/M/Q/H 的简化实现，或采用最简版本：仅支持数字/字母短串的 QR 矩阵绘制）。**如果完整 QR 算法过重，实现一个可用的最小版本（数字/字母模式 + M 纠错），并在文档注明范围**。渲染 SVG 矩阵。

### Watermark（水印）

```ts
interface WatermarkProps {
  content?: React.ReactNode | React.ReactNode[];
  image?: string;
  rotate?: number; // 默认 -22
  gap?: [number, number]; // 默认 [100, 100]
  children: React.ReactNode;
  className?: string;
}
```

- 背景水印：absolute 覆盖层 + SVG/data-uri 平铺文本水印，`pointer-events: none`。

### Affix（固钉）

```ts
interface AffixProps {
  offsetTop?: number;
  offsetBottom?: number;
  target?: () => HTMLElement | Window; // 默认 window
  onChange?: (affixed: boolean) => void;
  children: React.ReactNode;
  className?: string;
}
```

- 滚动监听（rAF/节流）+ 切换 fixed/relative。

### BackTop（返回顶部）

```ts
interface BackTopProps {
  target?: () => HTMLElement | Window;
  visibilityHeight?: number; // 默认 400
  onClick?: () => void;
  children?: React.ReactNode; // 自定义按钮
  className?: string;
}
```

- 滚动超过阈值显示（淡入），点击平滑滚动到顶部。

### FloatButton（悬浮按钮）

```ts
interface FloatButtonProps {
  icon?: React.ReactNode;
  description?: React.ReactNode;
  shape?: 'circle' | 'square';
  type?: 'default' | 'primary';
  trigger?: 'click' | 'hover';
  onClick?: () => void;
  menu?: Array<{ icon?: React.ReactNode; description?: React.ReactNode; onClick?: () => void }>; // 触发展开菜单
  className?: string;
  classNames?: { root?: string; menu?: string; item?: string };
}
```

- 固定右下角（fixed）圆形按钮 + 可展开菜单。

### Result（结果页）

```ts
interface ResultProps {
  status?: 'success' | 'error' | 'info' | 'warning' | '404' | '403' | '500'; // 默认 'info'
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode; // 操作按钮区
  className?: string;
  classNames?: { root?: string; icon?: string; title?: string; subtitle?: string; extra?: string };
}
```

- 大图标（Success/Error/Warning/Info SVG）+ 标题 + 副标题 + 操作区。

### App（容器，统一 message/notification/modal 上下文）

```ts
interface AppProps {
  children: React.ReactNode;
  message?: { max?: number; placement?: 'top' | 'bottom' };
  notification?: { max?: number; placement?: NotificationPlacement };
  className?: string;
}
// useApp(): { message: MessageApi; notification: NotificationApi; modal: ModalApi }
```

- 内部组合 MessageProvider + NotificationProvider；useApp 统一出口（避免多 Provider 嵌套）。

## 2. AI 翻译组（packages/i18n + packages/ui/src/config/translate.ts + docs/src/pages/i18n/**）

### useAutoTranslate API（packages/i18n/src/useAutoTranslate.ts）

```ts
type TranslateProvider = 'openai' | 'deepl' | 'youdao' | 'custom';
interface TranslateConfig {
  provider: TranslateProvider;
  apiKey?: string;
  endpoint?: string;                   // custom 必填，返回 { translations: string[] }
  model?: string;                      // openai 用，如 'gpt-4o-mini'
  sourceLang?: string;                 // 默认 'zh'
  targetLang: string;                  // 必填，如 'en'
  cache?: boolean;                     // 默认 true，localStorage
  cacheKey?: string;                   // 默认 'zui-translate-cache'
}
function useAutoTranslate(config: TranslateConfig): {
  t: (text: string, context?: { component?: string; role?: string }) => string | Promise<string>;
  tSync: (text: string) => string;    // 命中缓存同步返回，否则返回原文 + 异步回填
  isLoading: boolean;
  error?: Error;
  clearCache: () => void;
};
// ConfigProvider 集成（packages/ui/src/config/translate.ts）：
interface ConfigProviderProps { translate?: TranslateConfig; ... }
// 组件内置文案（placeholder/请选择/清除/关闭/暂无数据/上一页/下一页 等）通过 useAutoTranslate 自动翻译
```

- **provider 适配**：openai（chat/completions，system prompt 注明组件上下文）、deepl（/v2/translate）、youdao（/api），custom（POST endpoint { texts, sourceLang, targetLang } 返回 { translations }）。
- **缓存**：localStorage，key = hash(sourceLang:targetLang:text)，命中直接返回。
- **上下文提示词**：`t('请选择', { component: 'Select', role: 'placeholder' })` → prompt 注入"这是 Select 组件的 placeholder"。
- **测试**：mock provider 测缓存、并发、错误回退（失败返回原文）、clearCache。

### meta.json（每组件一份，AI 翻译组写）

- 路径：`packages/ui/src/components/<Name>/meta.json`
- 结构：

```json
{
  "name": "Button",
  "description": "按钮组件，触发即时操作",
  "category": "基础",
  "useCase": ["表单提交", "对话框确认", "工具栏操作"],
  "dontUse": ["不要用 Button 做页面导航（用 Link）"],
  "props": {
    "variant": {
      "type": "'primary'|'secondary'|'outline'|'ghost'|'danger'",
      "default": "'primary'",
      "desc": "按钮变体"
    }
  },
  "a11yNotes": ["loading 时保持可聚焦"],
  "related": ["Input", "Form"]
}
```

- **范围**：只写本轮 26 个现有组件 + 新组件由各组件组写自己的 meta.json（AI 翻译组给 26 个旧组件补）。

### llms.txt 更新（AI 翻译组）

- 在 `docs/public/llms.txt` 追加：useAutoTranslate API、meta.json 字段说明、registry/CLI 用法、MCP tool 调用示例。
- 保持 LLM 可读性（每组件签名一行 + 用法示例）。

## 3. registry 组（packages/cli + registry/**）

### registry schema（registry/registry.json）

```json
{
  "name": "zui",
  "homepage": "https://zui.dev",
  "items": [
    {
      "name": "button",
      "type": "registry:component",
      "title": "Button 按钮",
      "description": "触发即时操作的按钮组件",
      "dependencies": [],
      "registryDependencies": [],
      "files": [
        "packages/ui/src/components/Button/Button.tsx",
        "packages/ui/src/components/Button/Button.css"
      ],
      "cssVars": { "--z-button-height": "32px" },
      "meta": "packages/ui/src/components/Button/meta.json"
    }
  ]
}
```

### CLI（packages/cli/src/index.ts）

```bash
npx zui init                     # 交互式初始化（检测框架、配置目标目录、写 .zurc.json）
npx zui add button               # 从 registry 复制 Button.tsx + Button.css 到 src/components/ui/button/
npx zui add button modal        # 多组件
npx zui add --all                # 全部
npx zui diff button              # 显示本地副本 vs registry 的 diff（上游更新通道）
npx zui list                     # 列出 registry 所有组件
```

- 命令行用 commander 或纯 process.argv 解析（不引重依赖，选轻量 `commander`）。
- `add` 输出：复制文件 + 提示 import 路径 + 安装依赖（如需要）。
- `diff`：对比本地与 registry 文件内容，输出 unified diff。

### 生成脚本（registry/scripts/generate.mjs）

- 遍历 packages/ui/src/components/*/，读 meta.json + 文件清单，生成 registry/registry.json。
- 一键重建 registry。

## 4. MCP 组（packages/mcp）

### @zui/mcp（Model Context Protocol server）

- 三个 tool：
  1. `zui_search_components`：输入 query，返回匹配组件（name/description/category）
  2. `zui_get_component_api`：输入组件名，返回 props 签名 + 用法示例（读 meta.json + CONTRACTS）
  3. `zui_generate_code`：输入组件名 + props，生成可用 JSX 代码片段
- 用 `@modelcontextprotocol/sdk`（或纯 stdio JSON-RPC，避免重依赖——**优先纯 stdio 实现**，不引 MCP SDK，手写 JSON-RPC 2.0 消息处理）。
- 实现：`packages/mcp/src/index.ts`，监听 stdio，解析 `tools/list`、`tools/call`，返回 meta.json 数据。
- **AI 就绪文档**：`packages/mcp/README.md` + 更新 `docs/public/llms.txt`（说明如何配置 Claude Desktop / Cursor 调用 ZUI MCP）。

## 5. 区块组（packages/blocks）

### 4 个业务块（登录/仪表盘/表格/表单）

- `packages/blocks/src/login/index.tsx` — 登录页（Card + Form + Input + Button + Checkbox）
- `packages/blocks/src/dashboard/index.tsx` — 仪表盘（Statistic + Table + Card + Tabs）
- `packages/blocks/src/table-page/index.tsx` — 表格页（Table + Pagination + Card + Select + Button）
- `packages/blocks/src/form-page/index.tsx` — 表单页（Form + Input + Select + DatePicker + Button）
- 每块导出 React 组件 + `block.json`（名称/描述/依赖组件清单）。
- registry 条目（type: "registry:block"）。

## 6. 工程组（图标接入/locale/README/CHANGELOG/SSR）

### @zui/icons 接入组件（替换内联 SVG）

- 给 26 个组件中用到内联 SVG 的地方替换为 `@zui/icons`（Search/ChevronDown/Close/Check/Loading 等）。
- `packages/ui/package.json` dependencies 加 `"@zui/icons": "workspace:*"`。
- **只改图标 import 与 JSX，不动逻辑/测试**（测试若断言 svg 结构需最小调整）。

### exports 补齐（packages/ui/package.json）

- 补 5 个 subpath：`./dropdown-menu`、`./popover`、`./progress`、`./spin`、`./tooltip`（下划线风格保持一致）。

### locale 全量接入

- DatePicker/Calendar/Pagination/Transfer/TimePicker 的内置文案（上一月/下月/今天/确定/取消/上一页/下一页/搜索 等）接入 `useZuiConfig` locale。
- 扩展 `ZuiLocale` 类型（新增 date/pagination/transfer/timePicker 等段）。

### README + CHANGELOG

- 修正 README"10 个核心组件"→"51+ 组件"；新增 V3 组件清单、AI 翻译、registry/CLI/MCP 段落。
- `CHANGELOG.md`：v0.1（10 组件）、v0.2（26 组件）、v0.3（51+ 组件 + AI 生态）。

### SSR/Next.js 指南（docs/SSR.md）

- 如何在 Next.js App Router 用 ZUI（'use client' 边界、样式引入、SSR 兼容性说明）。

## 7. 测试文档组

### 新组件测试（各组件组写自己的，此处只规定覆盖要求）

- 每组件至少 8 个测试用例：渲染/受控/键盘/ARIA/禁用/classNames/data-part。
- 高难度组件（DatePicker/VirtualTable/Tree/Form）至少 15 用例。

### a11y 矩阵扩展（测试文档组）

- `packages/ui/src/test/a11y.roles.test.tsx` 追加新组件 ARIA（Slider role=slider、Rate role=radio、DatePicker role=grid、Tree role=tree、Segmented role=radiogroup 等）。
- 禁止改既有断言，只追加。

### 文档站新页（各组件组写自己的）

- 每个新组件一个 Page（照抄 ButtonPage 模式）。
- **ThemePlayground 产品化**：3 预设 → 10 预设 + 自定义 JSON 导入 + 对比模式（左右分屏新旧主题）。

## 8. 验证要求（每组）

- 只跑自己目录：`cd packages/ui && npx vitest run src/components/<自己的>`；tsc 用 `| grep` 过滤。
- 新包（i18n/cli/mcp/blocks）：`npx tsc -p tsconfig.json` 必须过；mcp 用 `node dist/index.js` 启动不报错。
- 文档组：`cd docs && npx vite build` 过。
- 禁止全量 `pnpm test`/`pnpm build`（并行干扰）。
