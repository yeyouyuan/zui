# RFC-004：CommandPalette 命令面板

状态：2026-11-09 实现复核稿。第 15 节列出的并行初版风险已在本轮实现中逐项清零（query 受控通道、input 独立可访问名、aria-expanded/empty/status 位置、Home/End 保留文本编辑、IME Escape 边界、option id 序号映射、key 安全裁剪、平台感知精确修饰符热键与注册栈仲裁、选择事件与取消、loading/结果公告、焦点恢复），组件测试与 Registry/文档页已同步。双迁移原型（第 15 节）与浏览器级 IME / 平台热键 / 辅助技术验证仍是发布准入前置，未完成前不构成发布承诺。

## 1. 目标

`CommandPalette` 面向文档站、后台和编辑器式应用的全局命令入口：用户通过热键或应用按钮打开模态搜索框，过滤一组动作或导航命令，并用键盘或指针执行。

首版必须做到：

- 复用 `Modal` 的模态语义、焦点陷阱、滚动锁、Esc / 遮罩关闭与焦点归还。
- 采用“dialog 内 editable combobox + listbox popup”模型；DOM 焦点始终留在输入框，活动命令通过 `aria-activedescendant` 表达。
- 支持未分组与分组命令、图标、展示型快捷键、disabled、内置过滤及外部异步过滤。
- 明确受控 / 非受控 `open` 与 `query`、动态命令、选择取消、Router 接入及关闭顺序。
- 默认提供可配置的跨平台全局热键，并解决 IME、重复按键、多个实例和事件冲突。
- 在 SSR / RSC、十套 locale、暗色、RTL、320px、长文案与完整键盘路径下可验证。

## 2. 非目标

- 不替代普通表单字段中的搜索选择；提交表单值使用 `Combobox` / `MultiCombobox`。
- 不替代按钮触发的上下文动作菜单；局部、短列表动作使用 `DropdownMenu`。
- 不实现多选、勾选状态、拖拽排序、任意深度子命令或树形命令。
- 不内置多步骤参数收集、确认流程或命令执行进度；复杂流程由命令回调打开下一界面。
- 不内置模糊打分、拼音、最近使用、收藏、权限、遥测或持久化历史。
- 不为每个命令注册真实系统快捷键；`shortcut` 只负责展示。全局只注册打开 / 关闭面板的 `hotkey`。
- 不内置 Router、数据请求、竞态取消或错误提示；组件提供可取消选择事件与受控 query 通道。
- 首版不虚拟化结果。超大数据集应由应用端过滤、分页或在独立性能 RFC 中评估。

## 3. 数据模型与 TypeScript API

```tsx
export interface CommandPaletteCommand {
  /** 全局唯一且非空 */
  key: string;
  label: React.ReactNode;
  /** 复杂 label 的可访问名与默认过滤文本 */
  textValue?: string;
  /** 简单分组名；空串等同未分组 */
  group?: string;
  /** 仅展示，不注册快捷键 */
  shortcut?: string;
  icon?: React.ReactNode;
  keywords?: readonly string[];
  disabled?: boolean;
  /** 应用可携带 Router 目标或业务数据，组件本身不解释 */
  meta?: unknown;
  onSelect?: (event: CommandPaletteSelectEvent) => void;
}

export type CommandPaletteSelectOriginalEvent =
  React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>;

export interface CommandPaletteSelectEvent {
  command: CommandPaletteCommand;
  query: string;
  source: 'keyboard' | 'pointer';
  originalEvent: CommandPaletteSelectOriginalEvent;
  /** 阻止组件默认的自动关闭；不阻止另一个选择回调被调用 */
  preventDefault(): void;
  readonly defaultPrevented: boolean;
}

export interface CommandPaletteOpenChangeDetails {
  reason: 'hotkey' | 'escape' | 'overlay' | 'select';
  originalEvent?: Event | React.SyntheticEvent;
  commandKey?: string;
}

export interface CommandPaletteQueryChangeDetails {
  reason: 'input' | 'close-reset';
  originalEvent?: React.ChangeEvent<HTMLInputElement>;
}

export type CommandPaletteHotkey = string | false;

export interface CommandPaletteProps {
  commands: readonly CommandPaletteCommand[];

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CommandPaletteOpenChangeDetails) => void;

  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string, details: CommandPaletteQueryChangeDetails) => void;
  resetQueryOnClose?: boolean; // 默认 true

  /** false 关闭本地过滤，由受控 query + commands 承担异步结果 */
  filter?: false | ((command: CommandPaletteCommand, query: string) => boolean);
  loading?: boolean;
  loadingContent?: React.ReactNode;
  emptyContent?: React.ReactNode;

  hotkey?: CommandPaletteHotkey; // 默认 'mod+k'
  onCommandSelect?: (command: CommandPaletteCommand, event: CommandPaletteSelectEvent) => void;

  placeholder?: string;
  inputAriaLabel?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  restoreFocus?: boolean; // 默认 true

  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  classNames?: {
    dialog?: string;
    root?: string;
    input?: string;
    listbox?: string;
    group?: string;
    groupLabel?: string;
    option?: string;
    optionIcon?: string;
    optionLabel?: string;
    optionShortcut?: string;
    status?: string;
    empty?: string;
    loading?: string;
  };
}
```

API 约束：

- `key` 必须全局唯一且非空。重复或空 key 在开发环境警告，并只保留首个合法项，避免重复 DOM id 和不确定回调。
- `label`、`icon` 与 `shortcut` 只能包含非交互内容，不得嵌套按钮、链接、输入框或可聚焦元素；复杂 label 必须提供非空 `textValue`。
- `group` 是展示文本。未分组命令先渲染；其后按 `commands` 中分组首次出现的顺序渲染，同名 group 合并，空 group 不渲染标题。
- `shortcut` 是纯展示字符串，组件以 `dir="ltr"` 的 `<kbd>` 渲染；它不参与 hotkey 匹配或可访问名。
- enabled 命令必须至少有 `command.onSelect` 或根级 `onCommandSelect`。两者都缺少时在开发环境警告，并按 disabled 处理，不能留下可高亮但无效果的 option。
- `filter` 只决定可见命令，不改变源数组、分组内顺序或 disabled。默认过滤不排序；需要相关性排序时由应用传入已经排序的 `commands`。
- `className` 追加到 `data-part="root"`；Modal 表面使用 `classNames.dialog`，避免同一属性在不同组件中含义漂移。
- 同时传 `aria-labelledby` 与 `aria-label` 时，以 `aria-labelledby` 为准，不输出冗余 `aria-label`。

## 4. 状态模型

公开状态彼此独立：

1. `open`：dialog 是否实际打开。
2. `query`：输入框文本。

内部瞬态：

- `activeKey`：当前活动的 enabled 命令，按 key 而非 index 保存。
- `isComposing`：IME 组合输入状态。
- `openingElement`：实际由关闭态进入打开态时的焦点来源。
- hotkey 注册记录：用于同一 document 内多个实例的冲突仲裁。

默认值固定为 `defaultOpen={false}`、`defaultQuery=""`、`resetQueryOnClose={true}`、`hotkey="mod+k"`、`restoreFocus={true}`。

状态规则：

- 受控状态只发出意图，不乐观伪造。若父级拒绝 `onOpenChange(false)`，dialog、`aria-expanded`、query 和焦点陷阱都继续服从实际 `open` prop。
- `onOpenChange` 只报告组件内产生的热键、Esc、遮罩或选择意图；外部直接改变 `open` prop 不反向触发回调。
- `resetQueryOnClose` 只在实际 open 从 true 变为 false 后执行。受控父级拒绝关闭时不得提前清空输入。
- 非受控 query 在实际关闭后同步清空；受控 query 只发出一次 `onQueryChange('', { reason: 'close-reset' })`，可见文本继续服从 prop。
- 实际打开后将 `activeKey` 设为首个 enabled 可见命令；若没有 enabled 结果则为 null。
- query 因用户输入改变时，活动项重置为过滤后首个 enabled 命令。
- 相同 query 下 `commands` 异步更新时，若当前 active key 仍存在且 enabled 则保持；否则优先使用旧视觉 index 上的新项，再回退前一项，最后回退首个 enabled 项。
- disabled 变化、分组移动或数据重排都按 key 维护 active；不得让 `aria-activedescendant` 暂时指向已卸载节点。
- 关闭退场动画期间不接受新的选择。热键再次打开必须等待实际 `open=false`；受控父级若尚未提交关闭，则热键仍只发出关闭意图。

## 5. 过滤、异步与结果公告

内置过滤：

- 空 query 显示全部命令。
- 默认对 `textValue ?? 可提取的纯文本 label` 与 `keywords` 做 Unicode NFKC 规范化、首尾空白裁剪和 locale-aware 小写后的包含匹配。
- 不内置模糊排序；结果顺序始终可预测，避免同一 query 因运行环境变化而重排。
- disabled 命令仍可显示，但不进入 active 序列。

外部异步过滤：

```tsx
<CommandPalette
  query={query}
  onQueryChange={(next) => {
    setQuery(next);
    requestCommands(next);
  }}
  commands={results}
  filter={false}
  loading={loading}
/>
```

- `filter={false}` 仅关闭本地筛选；输入仍必须通过 `query / onQueryChange` 工作。这是异步模式的完整通道，不能只让输入更新内部私有状态。
- 请求去重、AbortController、竞态结果丢弃与错误 UI 属于应用责任。
- `loading=true` 时保留当前 commands，避免每次请求造成活动项和高度抖动；应用若需要清空结果，可显式传空数组。
- loading 优先于 empty：加载时展示 `loadingContent`，不同时宣告“没有结果”。
- listbox 使用 `aria-busy={loading}`；加载、空态和结果数由 listbox 外的单一 `role="status" aria-live="polite"` 区域公告。
- 结果计数只在 query 或结果集稳定后更新，不因单纯 activeKey 移动重复播报。

## 6. 选择、取消与 Router 接入

选择顺序固定为：

1. 忽略 disabled、退场中或没有任何处理器的命令。
2. 构造一次 `CommandPaletteSelectEvent`，先调用 `command.onSelect(event)`。
3. 再调用 `onCommandSelect(command, event)`；即使前一个回调调用 `preventDefault()`，根级回调仍可观察该动作。
4. 两个回调返回后，若 `event.defaultPrevented === false`，发出 `onOpenChange(false, { reason: 'select', commandKey })`。
5. 只有实际 open 变为 false 后才重置 query、结束焦点陷阱并执行焦点恢复。

约束：

- `preventDefault()` 只取消组件默认的自动关闭，不撤销已经运行的业务回调，也不等同于 `stopPropagation`。
- 回调抛错时异常向上冒泡，后续根级回调与自动关闭不执行，便于错误边界捕获真实失败。
- 键盘与指针选择必须共享同一事件顺序，不能一个先关闭、另一个先执行。
- Router 无需特殊渲染出口。应用可把 `href` 或 route descriptor 放在 `meta` 中，并在 `onCommandSelect` 调用 Router：

```tsx
<CommandPalette
  commands={commands}
  onCommandSelect={(command, event) => {
    const href = (command.meta as { href?: string } | undefined)?.href;
    if (!href) return;
    event.preventDefault();
    setOpen(false);
    router.navigate(href);
  }}
/>
```

- 若要由组件按默认顺序自动关闭则不取消；需要保持面板打开，或像上例一样自行编排“关闭 → 导航”顺序时调用 `preventDefault()` 并由应用明确更新 `open`。路由完成后由页面焦点策略聚焦新标题。
- 命令 option 本身不渲染 `<a>`，因为 listbox option 不能再嵌套独立可聚焦链接。需要原生新窗口 / 修饰键链接语义的场景不属于 CommandPalette，应使用普通链接或 SideNav。

## 7. 全局 hotkey

语法：

- 支持 `mod`、`meta`、`ctrl`、`alt`、`shift` 修饰符与一个最终按键，例如 `mod+k`、`mod+shift+p`。
- `mod` 在 Apple 平台只映射 Meta，在其他平台只映射 Control；不得用 `metaKey || ctrlKey`，否则 macOS 上 Ctrl+K 也会误触发。
- 匹配必须是精确修饰符集合；额外按住 Shift / Alt / Ctrl / Meta 不匹配。
- 空字符串、未知修饰符、缺少主键、多个主键或没有任何修饰符时在开发环境警告并停用该 hotkey，避免劫持普通输入。
- `hotkey={false}` 完全不注册 document 监听。

事件边界：

- `event.defaultPrevented`、`event.repeat`、`event.isComposing`、`keyCode === 229`、Dead key 或 AltGraph 输入都不得触发。
- 只有当前实例真正接受热键时才 `preventDefault()`；未匹配事件保留浏览器和应用快捷键。
- hotkey 可在普通输入框中打开面板，因为 `mod+k` 是显式组合键；业务表单冲突时应用必须改键或传 false。
- 同一 document 多个启用实例使用共享注册栈，只有最后注册且仍挂载的实例响应；开发环境对相同组合给出一次冲突警告，绝不能让多个 dialog 同时打开。
- 当前实例已实际打开时再次按 hotkey 请求关闭；关闭态请求打开。受控父级拒绝时 UI 不自行切换。
- document 监听只在客户端 effect 中注册，卸载时必须移除；热键平台判断在事件发生时进行，不能在 SSR 阶段读取 navigator 并造成 hydration 分歧。

## 8. DOM 与 ARIA

```html
<!-- Modal Portal -->
<div role="dialog" aria-modal="true" aria-label="命令面板" data-part="dialog">
  <div data-part="root">
    <input
      type="text"
      role="combobox"
      aria-label="搜索命令"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      aria-expanded="true"
      aria-controls="command-listbox-id"
      aria-activedescendant="command-option-id"
      autocomplete="off"
      data-part="input"
    />

    <div id="command-listbox-id" role="listbox" aria-busy="false" data-part="listbox">
      <div role="option" aria-selected="true" data-part="option"></div>
      <div role="group" aria-labelledby="command-group-label-id" data-part="group">
        <div id="command-group-label-id" data-part="group-label">页面</div>
        <div role="option" aria-selected="false" data-part="option"></div>
      </div>
    </div>

    <!-- 必须是 listbox 的兄弟节点 -->
    <div role="status" aria-live="polite" data-part="status"></div>
  </div>
</div>
```

规则：

- dialog 必须有名称；输入框也必须有独立可访问名。placeholder 不能代替 label。`inputAriaLabel` 缺省取 locale 的“搜索命令”。
- dialog 已打开且 listbox 挂载时，combobox 的 `aria-expanded` 始终为 true；零结果不等于 popup 收起。
- DOM 焦点始终保留在 input。option 不设置 `tabIndex`，活动项由 input 的 `aria-activedescendant` 与 option 的 `aria-selected=true` 同步表达。
- `aria-activedescendant` 只引用当前已挂载且 enabled 的 option；没有活动结果时移除该属性。
- option id 使用组件 `useId()` 前缀与内部稳定序号映射，不能把任意 command key 原样拼进 id。
- 复杂 label 的 option 显式设置 `aria-label={textValue}`；图标 `aria-hidden=true`；展示型快捷键不并入可访问名，避免重复播报。
- disabled 命令保留 `role="option" aria-disabled="true" aria-selected="false"`，不能成为 active。
- group 使用 `role="group" + aria-labelledby`；空组不渲染。group label 本身不可聚焦。
- listbox 的直接语义子级只能是 option 或 group。loading、empty 与 live status 必须放在 listbox 外，不能作为无效子节点混入 option 集合。
- 根与 slots 输出稳定 `data-part`；状态使用 `data-open`、`data-loading`、`data-active`、`data-disabled`，避免样式依赖内部类名。

## 9. 键盘、IME 与指针

dialog 打开后立即聚焦输入框。

| 输入                           | 行为                                                      |
| ------------------------------ | --------------------------------------------------------- |
| 文本输入 / 粘贴                | 更新 query，活动项移到首个 enabled 结果                   |
| ArrowDown                      | 移到下一个 enabled 结果；末尾保持，不循环                 |
| ArrowUp                        | 移到上一个 enabled 结果；开头保持；无 active 时从末项开始 |
| Enter                          | 执行 active 命令；无 active 时不执行                      |
| Escape                         | 请求关闭 dialog                                           |
| Tab / Shift+Tab                | 交给 Modal 焦点陷阱，不执行命令、不关闭                   |
| Home / End / 左右箭头 / 删除键 | 保留单行文本编辑与光标行为，不得被结果导航劫持            |
| 其他组合键                     | 保留浏览器、输入法与应用默认行为                          |

- editable combobox 必须保留平台文本编辑按键。首项 / 末项不另占 Home / End；首版只用上下箭头导航结果。
- `preventDefault()` 仅用于实际处理的 ArrowUp / ArrowDown / Enter / hotkey；无 active 的 Enter 不拦截。
- IME composition 期间不得移动 active、执行 Enter 或由 Escape 关闭 dialog。Modal 的 Esc 监听必须能获知组合态，先让输入法处理 Escape。
- Pointer hover 只对 fine pointer 更新 active；触屏滚动经过 option 不应改变 active。
- 点击 enabled option 走统一选择顺序；点击 disabled 无效果且不关闭。
- 鼠标 / 笔点击 option 时保持输入框 DOM 焦点，避免 `aria-activedescendant` 链断开；触摸不能通过无条件 `pointerdown.preventDefault()` 阻断滚动。
- active 变化后用 `scrollIntoView({ block: 'nearest' })` 保持可见，不把整个页面滚动出位。

## 10. 焦点恢复与 Modal 组合

- 实际从 closed 进入 open 时记录当前 `document.activeElement`；打开动画后聚焦 `data-part="input"`。
- `returnFocusRef` 有可用、已连接且可见的元素时优先恢复；否则恢复打开前记录的元素。
- `restoreFocus={false}` 时不自动恢复，用于 Router 或应用自行管理页面焦点的场景。
- 选择回调若把焦点明确移动到 dialog 外的另一个已连接元素，关闭时不得抢回原触发点；这允许路由完成后聚焦新页面标题。
- 原焦点元素在关闭前被卸载时，不对 detached node 调用 focus；回退到 body，并由应用下一页面的焦点策略接管。
- 遮罩、Esc、hotkey 关闭和普通选择都遵循同一恢复规则。
- Modal 退场动画期间焦点仍受约束；动画结束后才卸载 dialog 和恢复焦点，且只执行一次。
- 页面已有另一个 modal 时遵循全局 modal 栈：只允许最上层响应 Esc 与焦点陷阱；CommandPalette 不另建第二套 modal 栈。

## 11. 视觉、响应式与 RTL

- 默认 dialog 宽度为 `min(42rem, calc(100vw - 2rem))`，最大高度不超过 `min(70dvh, 42rem)`；320px 视口不得出现文档级横向滚动。
- root 使用 column flex；输入区域固定，结果 viewport 独立滚动，长结果不能把 dialog 推出视口。
- option 最小触控高度 40px，图标固定槽、label 弹性截断、shortcut 不挤压主文案；完整名称仍由 `textValue` 提供。
- 分组标题与结果项使用逻辑属性；RTL 下图标、文本、快捷键槽顺序镜像，`kbd` 自身保持 `dir="ltr"`。
- 暗色只使用语义令牌；active、hover、disabled、边框与快捷键至少满足对应文字 / 非文字对比度。
- 320px 下左右 padding 收紧但不隐藏名称；安全区使用 `env(safe-area-inset-*)`。
- `prefers-reduced-motion: reduce` 沿用 Modal 的减弱动效；CommandPalette 不额外引入结果切换动画。
- 强制颜色模式下 active 使用系统 Highlight / outline，不只依赖背景色。

公开组件变量至少包括：

```css
--z-command-palette-width
--z-command-palette-max-height
--z-command-palette-input-height
--z-command-palette-option-height
--z-command-palette-gap
--z-command-palette-padding
--z-command-palette-bg
--z-command-palette-fg
--z-command-palette-muted-fg
--z-command-palette-hover-bg
--z-command-palette-active-bg
--z-command-palette-active-fg
--z-command-palette-focus-ring
```

## 12. Locale

`ZuiLocale` 增加：

```ts
commandPalette: {
  title: string; // 命令面板
  search: string; // 搜索命令
  placeholder: string; // 输入命令或搜索…
  loading: string; // 正在加载命令
  empty: string; // 没有匹配的命令
  results: string; // 找到 {count} 条命令
}
```

十套语言包必须同步补齐。显式 `aria-label`、`inputAriaLabel`、`placeholder`、`loadingContent` 和 `emptyContent` 覆盖 locale。

`results` 使用统一占位替换工具；缺少 `{count}` 时仍能安全输出，不能直接拼接中文量词。

## 13. SSR、RSC 与性能

- 文件声明 `'use client'`。Server Component 必须通过客户端 wrapper 创建带函数的 commands，不能从服务端边界直接序列化 `onSelect`。
- SSR 不访问 document、window、navigator、matchMedia 或平台信息；Portal、hotkey 和焦点逻辑都在客户端 effect 后启用。
- `defaultOpen=false` 的服务端输出不包含 dialog。`defaultOpen=true` 也必须保证 hydration 结构稳定，Portal 在挂载后出现，不制造 server/client id 偏移。
- option / group id 使用 `useId()`，同一树多实例不得冲突。
- 过滤只依赖 `commands + query + filter`；active 移动不重新过滤。默认过滤对单次渲染只规范化 query 一次。
- 首版目标为数百条命令。超过合理规模时应用使用异步过滤；组件不悄悄启用行为不同的虚拟化。
- 文档站页面继续路由级懒加载；组件公开后不得因为 docs chrome 同步导入整个 `@zui/react` barrel 而让主 chunk 跨越预算。

## 14. 测试矩阵

单元 / 组件测试：

- dialog 与 input 各自有名称；combobox / listbox / group / option 结构、稳定 ids、`aria-controls`、`aria-expanded`、`aria-activedescendant` 正确。
- 零结果时 listbox 仍挂载且 expanded=true；empty / loading / status 位于 listbox 外，axe 无结构违规。
- key 空 / 重复、复杂 label 无 textValue、交互后代、enabled 无处理器时开发警告与安全忽略正确。
- open / query 受控拒绝不伪造 UI；实际关闭后才 reset；StrictMode 不重复发意图。
- 默认过滤覆盖 label、textValue、keywords、Unicode 规范化；自定义 filter 与 `filter=false` 异步通道工作。
- 动态 commands 保持 active key；删除、禁用、重排与分组变化按规定回退，不产生悬空 active descendant。
- 上下箭头跨分组且跳过 disabled；边界不循环；Home / End 与文本编辑不被拦截。
- Enter 的键盘选择与 pointer 选择事件顺序一致；item / root handler、preventDefault、异常和受控关闭覆盖。
- IME composition 中 Enter / Escape / hotkey 均不执行；compositionend 后恢复。
- hotkey 精确修饰符、Apple / 非 Apple `mod`、repeat、defaultPrevented、AltGraph、无修饰符非法配置、false 与卸载清理覆盖。
- 两个相同 hotkey 实例只触发注册栈顶部实例；冲突警告不刷屏。
- Modal topmost Esc、overlay、焦点陷阱、returnFocusRef、触发点删除、显式外部聚焦与 restoreFocus=false 覆盖。
- locale 十套键齐全，mergeLocale 深合并；SSR render 不访问 DOM；RSC client boundary 保留。
- `className`、全部 `classNames`、data-part、CSS 变量、ref（若正式 API 增加）透传。

浏览器 / E2E：

- Chrome、Firefox、WebKit：按钮打开、默认 / 自定义 hotkey、输入、过滤、键盘执行、指针执行、Esc / 遮罩关闭与焦点归还。
- macOS Meta 与 Windows / Linux Control 实机或浏览器级事件验证，不能只靠 jsdom 猜平台。
- 中文、日文和韩文 IME：组合输入、Enter、Escape 与热键不误触发。
- VoiceOver / NVDA 至少人工验证 dialog 名称、input 名称、结果数、分组、active option 与 disabled 公告。
- 外部异步过滤：延迟返回、结果乱序、loading、空态与 active 保持。
- Router：命令导航、新标题焦点、取消自动关闭、触发元素被卸载。
- 320px、200% zoom、长分组名 / 命令名 / shortcut、内部滚动、暗色、RTL、forced-colors、reduced-motion。
- axe 在打开、零结果、loading、disabled、RTL 与 320px 状态下零违规；页面无横向溢出和 console error。

## 15. 迁移原型与正式准入

正式发布前必须完成两个不对外承诺 API 的真实迁移原型。**两项原型均已完成（2026-11-09）**：

1. **文档站全局命令入口** ✅
   - `docs/src/App.tsx`：⌘K 由 CommandPalette 接管；命令包含全部文档路由（hash 导航 + 既有标题聚焦策略）、主题切换、聚焦文档搜索（旧 ⌘K 行为成为命令，冲突消除）与 GitHub 外链（`preventDefault()` 保持打开 + `window.open`）。
   - 验证：`e2e/command-palette-docs.spec.ts` 7 条（Router 后标题聚焦、侧栏 `aria-current`、触发点归还、320px 抽屉不冲突、平台感知 mod 按浏览器 UA 断言）。
2. **AdminShell 异步命令入口** ✅
   - `docs/src/prototypes/admin-shell/AdminShellPrototype.tsx` 内 `AdminCommandEntry`：260ms debounce + 单调 request id 竞态丢弃、受控 query + `filter={false}`、loading、动态分组重排、权限禁用项、`preventDefault()` 保持打开的复制链接动作（页面通知）。
   - 验证：`e2e/command-palette-admin.spec.ts` 7 条（竞态后结果一致性、分组重排、禁用不可执行不关闭、导航命令 hash 更新、320px）。

剩余准入项：浏览器级 IME（中/日/韩实机输入法）与 VoiceOver/NVDA 人工走查、macOS Meta 与 Windows Control 实机热键复核。

准入顺序：

1. 本 RFC 评审定稿。
2. 两个原型共享同一私有实现，完成浏览器、axe、IME、Router 与视觉验收。
3. 根据原型结果冻结 API；若需要低层 combobox 能力，抽取共享内部 hook / primitive，不直接把表单型 `Combobox` 嵌进命令面板并继承不相干的 value 语义。
4. 再进入正式 `packages/ui/src/components/CommandPalette/`、根导出、子路径、Registry、CLI / MCP、locale、文档页、a11y notes 与 changeset。
5. 全仓 typecheck、build、test、docs E2E、consumer ESM / CJS / SSR 与包体积预算通过后，状态改为待发布。

当前并行初版在正式准入前至少需要重新审查以下风险：

- `filter=false` 只有内部私有 query，外部无法获得搜索文本并驱动异步 commands。
- dialog 有名称但输入框没有独立可访问名；placeholder 不能替代 label。
- `aria-expanded` 被结果数量驱动，零结果时错误表示 listbox 已收起；empty status 也被放进 listbox。
- Home / End 覆盖单行输入编辑；IME 的 Escape 与 Modal 组合边界未验证。
- option id 直接拼接任意 key；重复 / 非法 key 只警告而未安全裁剪。
- 热键把 Meta / Control 合并为同一 `mod`，且未定义 repeat、defaultPrevented、AltGraph、非法配置与多实例冲突。
- 选择回调没有 query / source / 原始事件，无法取消默认关闭，也没有统一 Router 适配入口。
- enabled 但缺少处理器的命令仍可高亮；动态数据、异步 loading、结果公告和受控 query 尚无完整契约。

上述风险清零并取得双原型证据前，不应仅凭已有单元测试、Registry 条目或 changeset 宣称组件完成。
