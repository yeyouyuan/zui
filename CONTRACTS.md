# ZUI 契约层规范（所有实作者必读，禁止偏离）

> 本文件是并行开发的唯一事实来源。任何组件的 props、类名、CSS 变量命名必须与本文一致。
> 竞品调研结论已折算进本规范：零运行时 CSS、三层令牌、语义化定制出口（永不暴露内部类名）、
> hooks 型反馈 API（无静态方法）、组合式复合组件、React 19 原生 ref。

## 0. 文件边界（并行开发防冲突，违反即冲突回滚）

| 归属 | 路径 | 谁写 |
|---|---|---|
| 契约/共享 | `packages/ui/src/utils/**`、`src/styles/**`、`src/index.ts`、`package.json`、`*.config.ts` | 仅集成者（已完成，任何人不得改动） |
| 令牌 | `packages/tokens/src/**`、`packages/tokens/package.json` | 令牌智能体 |
| 组件 | `packages/ui/src/components/<Name>/**` | 各组件智能体（只写自己的目录） |
| 文档 | `docs/src/**` | 文档智能体（最后阶段） |

- 各组件目录内：`<Name>.tsx`（或 `<Name>.<Part>.tsx`）、`<Name>.css`、`<Name>.test.tsx`、`index.ts`（目录内 barrel，只导出本组件）。
- **禁止修改 `packages/ui/src/index.ts`**（由集成者统一汇总导出）。
- 组件间不互相 import；需要共享逻辑一律用 `../utils`（已提供）。

## 1. 通用 API 范式

- **React 19 原生**：函数组件直接接收 `ref` prop（`React.ComponentPropsWithRef<'x'>` 扩展），**禁止 forwardRef**。
- 每个 `.tsx`/含 hooks 的 `.ts` 文件第一行：`'use client';`
- 类名合并工具：`cx(...)`（来自 `../utils`）。用户 `className` 永远追加在根元素。
- **受控/非受控**：`useControllableState`（来自 `../utils`），约定 `value` / `defaultValue` / `onChange`。
- **尺寸**：`size?: 'sm' | 'md' | 'lg'`，默认 `'md'`（Table 密度、Message 除外，见下）。
- **禁用**：`disabled?: boolean`。
- **定制出口三件套**（这是对 antd 样式覆盖之痛的正面回答，必须全部实现）：
  1. 根元素与每个结构元素带 `data-part="<part名>"`（根为 `root`）；
  2. `classNames?: Record<PartName, string>`（slot 级类名追加，勿做成覆盖）；
  3. 组件级 CSS 变量（见 §3），在组件 CSS 的选择器上定义，用户可任意覆盖。
- 剩余 props 透传到根元素（`className`、`style`、`aria-*`、`data-*`、事件）。
- 无障碍：一票否决项——键盘可达、`:focus-visible` 可见焦点、语义化 ARIA。

## 2. 组件 API（逐组件精确契约）

### Button（variant/size 定型范式）
```ts
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
interface ButtonProps extends Omit<React.ComponentPropsWithRef<'button'>, 'prefix'> {
  variant?: ButtonVariant;          // 默认 'primary'
  size?: 'sm' | 'md' | 'lg';        // 默认 'md'
  loading?: boolean;                // 置灰+spinner+aria-busy，阻止点击
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
  classNames?: { root?: string; icon?: string; label?: string; spinner?: string };
}
```
- parts: `root`（`z-button`）、`icon`（`z-button-icon`，iconStart/iconEnd 各一个）、`label`（`z-button-label`）、`spinner`（`z-button-spinner`）。
- 根元素 data 属性：`data-variant`、`data-size`、`data-loading`、`data-full-width`。
- loading 时原生 `disabled` 不强制（保留可聚焦），用 `aria-disabled` + 拦截 onClick。
- 禁用时用原生 `disabled`。

### Input
```ts
interface InputProps extends Omit<React.ComponentPropsWithRef<'input'>, 'prefix' | 'size'> {
  size?: 'sm' | 'md' | 'lg';                    // 默认 'md'
  status?: 'default' | 'error' | 'success';     // 默认 'default'
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  clearable?: boolean;                          // 有值时显示清除按钮
  onClear?: () => void;
  classNames?: { root?: string; input?: string; prefix?: string; suffix?: string; clear?: string };
}
```
- 结构：root(`z-input`) > prefix + input(`z-input-field`) + clear(`z-input-clear`) + suffix。
- clear 按钮：`type="button"`、`aria-label="清除"`、只读时隐藏；点击后聚焦 input 并触发 onClear。
- 状态通过根元素 `data-status` 暴露。

### Checkbox
```ts
interface CheckboxProps extends Omit<React.ComponentPropsWithRef<'input'>, 'type' | 'onChange' | 'checked' | 'defaultChecked' | 'size'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  indeterminate?: boolean;
  classNames?: { root?: string; control?: string; label?: string };
}
```
- 隐藏原生 input（保持无障碍），视觉层 `z-checkbox-box`（`data-part="control"`）。
- `indeterminate` 设置 DOM `input.indeterminate` + 视觉态（横线图标），`aria-checked="mixed"`。
- 结构 parts: `root`（label 包裹 `z-checkbox`）、`control`、`label`（`z-checkbox-label`）。

### Radio / RadioGroup
```ts
interface RadioGroupProps {
  value?: string; defaultValue?: string; onChange?: (value: string) => void;
  name?: string; disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';      // 默认 'vertical'
  children?: React.ReactNode; className?: string;
  classNames?: { root?: string };
}
interface RadioProps extends Omit<React.ComponentPropsWithRef<'input'>, 'type' | 'onChange' | 'checked' | 'defaultChecked' | 'size'> {
  value: string; label?: React.ReactNode; disabled?: boolean;
  classNames?: { root?: string; control?: string; label?: string };
}
```
- RadioGroup 用 Context 向 Radio 注入 name/value/onChange/disabled；组根 `role="radiogroup"`，`aria-orientation`。
- Radio 无 Group 时回退原生 name 分组。视觉同心圆（`z-radio-dot`）。parts: `root`/`control`/`label`。

### Switch
```ts
interface SwitchProps extends Omit<React.ComponentPropsWithRef<'button'>, 'onChange' | 'value' | 'type'> {
  checked?: boolean; defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';                           // 默认 'md'
  label?: React.ReactNode;
  classNames?: { root?: string; track?: string; thumb?: string; label?: string };
}
```
- 原生 button，`role="switch"`、`aria-checked`；Space/Enter 切换（原生即可）。
- parts: `root`、`track`（`z-switch-track`，圆角轨道）、`thumb`（`z-switch-thumb`，滑块）、`label`。

### Select（select-only combobox，APG 模式，a11y 重点）
```ts
interface SelectOption { value: string; label: React.ReactNode; disabled?: boolean; }
interface SelectProps {
  options: SelectOption[];
  value?: string; defaultValue?: string; onChange?: (value: string) => void;
  placeholder?: string;                          // 默认 '请选择'
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';                     // 默认 'md'
  status?: 'default' | 'error' | 'success';      // 默认 'default'
  id?: string; name?: string;                    // name 渲染隐藏 input 供表单提交
  className?: string;
  classNames?: { root?: string; trigger?: string; value?: string; listbox?: string; option?: string; empty?: string };
  'aria-label'?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string;
}
```
- **触发器**：button，`aria-haspopup="listbox"`、`aria-expanded`、`aria-controls`、`aria-activedescendant`（焦点保持在触发器，虚拟移动 active option）。
- **列表**：`role="listbox"`，option `role="option"` + `aria-selected` + `aria-disabled`。
- **键盘**（必须全实现并测试）：关闭时 Enter/Space/↓/↑ 打开；打开时 ↑↓ 移动 active、Home/End 首尾、Enter/Space 选中、Esc 关闭并焦点回触发器、Tab 关闭、首字母 typeahead 快速定位。
- active option 跟随滚动（`scrollIntoView({ block: 'nearest' })`）。
- 点击外部关闭（`useOnClickOutside`）；option 用 mousedown + preventDefault 防输入失焦。
- 弹层绝对定位于 root 内（root `position: relative`），`data-open` 控制显隐。disabled option 不可选但可导航到（`aria-disabled`）。
- parts: `root`（`z-select`）、`trigger`、`value`、`listbox`、`option`、`empty`。

### Modal（组合式 API）
```ts
interface ModalProps {
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}
// Modal.Trigger: 原生 button，自动 onClick 开关，透传 props
// Modal.Content:
interface ModalContentProps extends React.ComponentPropsWithRef<'div'> {
  size?: 'sm' | 'md' | 'lg';                     // 默认 'md'
  closeOnOverlay?: boolean;                      // 默认 true
  closeOnEsc?: boolean;                          // 默认 true
  classNames?: { overlay?: string; content?: string };
}
// Modal.Header / Modal.Title / Modal.Description / Modal.Body / Modal.Footer / Modal.Close
// Modal.Close: 原生 button；图标用法默认 aria-label="关闭"，文字用法以文字作为无障碍名称
```
- Context 贯穿：`open`、`onOpenChange`、titleId/descriptionId（`useId` 自动关联 `aria-labelledby`/`aria-describedby`）。
- Content 用 `Portal`（`../utils`）渲染到 body；root dialog：`role="dialog"`、`aria-modal="true"`、`tabIndex={-1}`。
- **焦点管理**（APG Dialog 规则，必须测试）：打开时焦点移入 dialog（优先 `[data-autofocus]`，否则首个可聚焦元素，最后 dialog 本体）；`useFocusTrap` 循环 Tab；关闭时焦点归还触发元素。
- overlay 点击关闭（closeOnOverlay）、Esc 关闭（closeOnEsc）、`useScrollLock` 锁滚动。
- 打开时渲染、关闭后卸载；进出场用 `data-state="open"/"closed"` + CSS 动画（不引动画库）。
- parts（Modal.Content 内）：`overlay`（`z-modal-overlay`）、`content`（`z-modal`）；Header/Title/Body/Footer/Close 类名 `z-modal-header`/`z-modal-title`/`z-modal-body`/`z-modal-footer`/`z-modal-close`，各带 `data-part`。

### Tabs（组合式 API）
```ts
interface TabsProps {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';       // 默认 'horizontal'
  activationMode?: 'automatic' | 'manual';       // 默认 'automatic'（焦点即选中）
  children?: React.ReactNode; className?: string;
  classNames?: { root?: string; list?: string; trigger?: string; panel?: string };
}
// Tabs.List（role="tablist"，aria-orientation）
// Tabs.Trigger: { value: string; disabled?: boolean; icon?: React.ReactNode } + 透传；role="tab"
// Tabs.Panel:  { value: string; forceMount?: boolean }；role="tabpanel"
```
- roving tabindex：选中 tab `tabIndex=0`，其余 `-1`。
- 键盘（必须测试）：←→（vertical 时 ↑↓）移动，Home/End 首尾；manual 模式下 Enter/Space 激活。
- `aria-selected`、`aria-controls`/`aria-labelledby` 用 `useId` 双向关联；未激活 panel 默认卸载（forceMount 可保留 + `hidden`）。
- parts: `root`（`z-tabs`）、`list`（`z-tabs-list`）、`trigger`（`z-tab`）、`panel`（`z-tabs-panel`）。

### Table（组合式，展示型）
```ts
interface TableProps extends Omit<React.ComponentPropsWithRef<'table'>, 'size'> {
  density?: 'comfortable' | 'compact';           // 默认 'comfortable'
  bordered?: boolean;                            // 默认 false（行分隔线始终有）
  striped?: boolean;                             // 默认 false
  classNames?: { root?: string };
}
// Table.Head / Table.Body / Table.Row / Table.Cell / Table.HeaderCell
// Table.Row: { selected?: boolean } → data-selected
// Table.HeaderCell / Table.Cell: { align?: 'left' | 'center' | 'right' }（默认 left）
```
- 纯语义 `<table>/<thead>/<tbody>/<tr>/<th>/<td>` 包装，props 透传；`<th scope="col">`。
- 根 `z-table`，`data-density`、`data-bordered`、`data-striped`。类名：`z-table-row`/`z-table-cell`/`z-table-header-cell`。

### Message（hooks 型，**无静态方法**，规避 antd 上下文丢失之痛）
```ts
interface MessageConfig {
  content: React.ReactNode;
  duration?: number;                             // ms，默认 3000；0 = 不自动关闭
  closable?: boolean;                            // 默认 false
  onClose?: () => void;
}
interface MessageApi {
  show: (config: MessageConfig | string) => string;   // 返回 id
  success: (config: MessageConfig | string) => string;
  error: (config: MessageConfig | string) => string;
  warning: (config: MessageConfig | string) => string;
  info: (config: MessageConfig | string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}
function MessageProvider(props: {
  children?: React.ReactNode;
  max?: number;                                  // 默认 3，超出挤掉最旧
  placement?: 'top' | 'bottom';                  // 默认 'top'
}): JSX.Element;
function useMessage(): MessageApi;               // 无 Provider 时 throw 明确错误
```
- Provider 内部 `Portal` 渲染容器 `z-message-list`（`data-placement`），条目 `z-message`（`data-variant`）。
- 语义：`role="status"` + `aria-live="polite"`（error 用 `aria-live="assertive"`）。
- 进出场：`data-state="open"/"closing"` + CSS 动画，关闭时先 `closing` 再移除（200ms）。
- 每条可选关闭按钮（closable，`aria-label="关闭"`）；自动关闭计时器在 hover/focus 时暂停（可选加分项，至少实现自动关闭）。

## 3. CSS 规范

- **类名**：`z-<component>`、`z-<component>-<part>`；状态用 data 属性选择器（`[data-variant='primary']`），不引入状态修饰类。
- **令牌命名（必须逐字使用）**：
  - 语义色：`--z-color-bg / bg-subtle / bg-muted / bg-elevated / bg-inverse`、
    `--z-color-fg / fg-muted / fg-subtle / fg-inverse / fg-on-primary`、
    `--z-color-border / border-subtle / border-strong / border-focus`、
    `--z-color-primary / primary-hover / primary-active / primary-fg / primary-subtle / primary-subtle-fg`、
    `--z-color-{danger|success|warning|info}` 及其 `-hover`/`-fg`/`-subtle`/`-subtle-fg`、
    `--z-color-link / link-hover / focus-ring / overlay / disabled-bg / disabled-fg / disabled-border`。
  - 尺寸：`--z-radius`（唯一来源 0.625rem，派生 `--z-radius-sm/md/lg/xl/full`）、
    `--z-space-1..12`（4px 步进）、`--z-text-xs/sm/md/lg/xl/2xl`、`--z-leading-tight/normal/relaxed`、
    `--z-weight-regular/medium/semibold`、`--z-font-sans/mono`、
    `--z-shadow-xs/sm/md/lg`、`--z-duration-fast/normal/slow`、`--z-ease-standard/entrance/exit`、
    `--z-z-base/sticky/dropdown/overlay/modal/toast`。
  - 组件级（示例，Button 内定义）：`--z-button-height / padding-x / font-size / radius / bg / fg / border / hover-bg / hover-fg / active-bg`。每个组件同理定义自己的 `--z-<name>-*`。
- 组件 CSS 只消费语义层与本组件变量；**禁止硬编码色值**（透明度叠加除外，用 `color-mix()`）。
- 动效遵守 `prefers-reduced-motion`（在 reset.css 已有全局降级，组件动画用 `var(--z-duration-*)`）。

## 4. 测试要求（每个组件必须有 `<Name>.test.tsx`）

- `vitest` + `@testing-library/react` + `@testing-library/user-event`，断言用 jest-dom。
- 必测：渲染与默认态、受控/非受控切换、disabled、键盘交互（按各组件 §2 清单）、
  ARIA 属性（role/aria-expanded/aria-selected/aria-checked 等）、classNames/data-part 透传。
- 测试内只 import 本组件目录，禁止 import `src/index.ts`。

## 5. 构建与验证命令

```bash
cd packages/ui && npx vitest run src/components/<YourComponent>   # 只跑自己的测试
cd packages/ui && npx tsc --noEmit                                # 类型检查
```
不要跑全量 `pnpm test`（其他智能体并行中，只看自己的结果）。
