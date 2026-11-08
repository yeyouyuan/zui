# RFC-001：Combobox 自动完成

状态：2026-11-08 已实现并完成自动化验收，作为下一版本候选；不属于 v0.2.0 的 66 组件发布基线，待下一版本发布评审。

- 目标包：`@zui/react`
- 优先级：P1，不阻塞 v0.2.0 发布
- 依赖：`FloatingPanel`、`Portal`、`useControllableState`、ConfigProvider locale

## 1. 目标

`Combobox` 是单选、可编辑、严格选项型输入控件。它用于“输入关键词，从本地或远程结果中选择一个实体”，填补以下空白：

- `Select` 只能从静态选项选择，不能编辑搜索文本。
- `Mentions` 面向文本插入，不提供独立的表单提交值。
- 业务页面不应各自实现异步搜索、IME、活动项、Portal 和键盘导航。

首版必须支持：

- 单选与可编辑输入。
- 本地过滤。
- 由调用方提供的异步 options 与 loading 状态。
- `value`、`inputValue`、`open` 三组受控/非受控状态。
- 严格选项模式：未选择的草稿不作为最终值提交。
- IME、键盘、读屏、Form、SSR、Portal 和窄屏场景。

## 2. 非目标

首版不加入：

- 多选和标签输入。
- 自定义值 / free solo / 创建新选项。
- 分组、树形、无限滚动和虚拟滚动。
- 内置网络请求、缓存、分页、重试或模糊搜索算法。
- 移动端 Bottom Sheet 变体。
- 把未选择的输入文本自动提交为 value。

异步请求由业务层负责。组件只接收当前 `options`、`loading` 和错误/空态内容，避免 UI 包拥有网络生命周期。

## 3. TypeScript API

```tsx
export interface ComboboxOption {
  /** 唯一、稳定的提交值 */
  value: string;
  label: React.ReactNode;
  /** 输入框显示、过滤和可访问名称；复杂 label 时必填 */
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
}

export type ComboboxInputChangeReason = 'input' | 'selection' | 'clear' | 'reset';

export type ComboboxOpenChangeReason =
  'input' | 'focus' | 'toggle' | 'keyboard' | 'selection' | 'escape' | 'blur' | 'outside' | 'clear';

export interface ComboboxProps extends Omit<
  React.ComponentPropsWithRef<'input'>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'type'
  | 'size'
  | 'className'
  | 'style'
  | 'children'
> {
  options: readonly ComboboxOption[];

  value?: string | null;
  defaultValue?: string | null;
  onChange?: (
    value: string | null,
    option: ComboboxOption | null,
    details: { reason: 'selection' | 'clear' }
  ) => void;

  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (
    inputValue: string,
    details: {
      reason: ComboboxInputChangeReason;
      isComposing: boolean;
    }
  ) => void;
  /** 仅在非组合输入或 compositionend 后触发，供外部搜索副作用使用 */
  onSearch?: (query: string) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: { reason: ComboboxOpenChangeReason }) => void;
  /** 焦点离开整个组件边界时触发，currentTarget 为根节点 */
  onBlur?: React.FocusEventHandler<HTMLDivElement>;

  /** false 表示调用方已提供过滤后的远程结果 */
  filterOption?: false | ((option: ComboboxOption, query: string) => boolean);
  /** 当前 options 不含已选项时解析展示文本 */
  displayValue?: (value: string, option: ComboboxOption | undefined) => string;

  loading?: boolean;
  openOnFocus?: boolean;
  autoHighlight?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: 'default' | 'error' | 'success';

  placeholder?: string;
  loadingContent?: React.ReactNode;
  emptyContent?: React.ReactNode;
  /** 非 null 时表示外部搜索失败，并展示错误状态 */
  errorContent?: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    control?: string;
    input?: string;
    clear?: string;
    toggle?: string;
    panel?: string;
    listbox?: string;
    option?: string;
    loading?: string;
    empty?: string;
    error?: string;
    status?: string;
  };
}
```

API 约束：

- public ref、`id`、ARIA 和除 `onBlur` 外的输入事件指向真实 `<input>`。组件固定渲染 `type="text"`，不接受其他 input type。
- `onBlur` 是组件边界事件：由根节点 focus-within 逻辑代理，仅当 `relatedTarget` 不在根节点内时触发，`currentTarget` 为根节点。这样 Form 校验不会把 input → clear 误判为离开字段。
- `className` / `style` 指向根节点。
- `name` 只用于隐藏字段；可见 input 不带 `name`。`form` 同时传给可见 input 与隐藏字段。
- `onChange` 第一参数保持为 value，便于 `Form.Item` 收集。
- option value 重复、复杂 label 缺少 `textValue` 时仅在开发环境警告。
- `filterOption` 未传时，默认对 `textValue`、字符串 label、value、keywords 做不区分大小写的 contains 匹配。
- `errorContent` 由调用方按请求状态传入；非 null 时显示错误状态。组件不接收 error 对象，也不负责重试。

## 4. Locale

`ZuiLocale` 新增：

```ts
combobox: {
  placeholder: string;
  clear: string;
  showOptions: string;
  hideOptions: string;
  loading: string;
  empty: string;
  results: string; // 例如“找到 {count} 项”
}
```

十套语言包必须同步补齐。显式 `placeholder`、`loadingContent`、`emptyContent` 覆盖 locale。

## 5. 状态模型

公开状态彼此独立：

1. `value`：最后提交的 option value。
2. `inputValue`：输入框当前草稿。
3. `open`：结果面板是否打开。

内部瞬态：

- `activeValue`：键盘当前活动项，按 value 保存，不能按 index 持久化。
- `isComposing`：IME 组合输入状态。
- `editing`：输入文本是否已偏离最后提交文本。
- `lastCommittedOption` / `lastKnownTextByValue`：异步 options 暂时不含已选项时保持展示。

状态转换：

| 动作            | value          | inputValue            | open       |
| --------------- | -------------- | --------------------- | ---------- |
| 初始 value      | 保持           | 对应 textValue        | false      |
| 用户输入        | 保持最后提交值 | 更新草稿              | true       |
| 选中 option     | 更新           | option.textValue      | false      |
| clear           | `null`         | 空串                  | false      |
| Escape          | 不变           | 恢复最后提交文本      | false      |
| Tab / 真实 blur | 不变           | 恢复最后提交文本      | false      |
| 外部 value 变化 | 使用外部值     | 非受控 input 同步展示 | 不强制改变 |
| options 刷新    | 不变           | 不覆盖正在编辑的草稿  | 不变       |

设计决定：

- 输入搜索不会提前改写表单值；只有明确选择或清除才触发 `onChange`。
- 严格模式下，未匹配草稿在 Esc、Tab 或失焦时恢复为最后提交文本。
- 重选同一 value 仍触发 `onChange`，让显式用户动作可观察。
- 受控状态只发出意图，不在内部伪造持久值。
- 新 options 到达时优先按 value 保留 active 项，再回退 selected，最后回退首个可用项。
- 非 editing 状态的展示文本始终由当前实际 committed value 解析；选择或清除意图只有在受控 `value` 真正更新后才能改变展示与隐藏字段。
- 受控 `open` 被父级拒绝或延迟时，`aria-expanded`、面板挂载和交互状态都继续使用实际 `open` prop，不能先行模拟。
- `lastCommittedOption` 只在实际 committed value 改变后更新，不能缓存尚未被受控父级确认的新 label。
- `onInputValueChange` 的 `reason: 'reset'` 专指 Esc、Tab 或组件边界 blur 引发的严格文本回退；只有可见文本实际变化时才触发。

默认值优先级：

- `defaultValue` 能由 `options` 或 `displayValue` 解析时，解析出的 committed 文本优先。
- 同时传入且 `defaultInputValue` 与 committed 文本不一致时，忽略 `defaultInputValue` 并在开发环境警告。
- `defaultValue` 暂时无法解析时，`defaultInputValue` 可作为该 value 的初始 last-known text，直到真实 option 到达。
- 未传 `defaultValue` 时，`defaultInputValue` 只是未提交草稿；严格回退后恢复为空串。
- 原生 `form.reset()` 恢复非受控 value/input 的初始默认值并关闭面板，不触发 `onChange` 或 `onInputValueChange`；受控状态继续服从 props。

## 6. DOM 与 ARIA

```html
<div data-part="root" data-open="true" data-size="md" data-loading="false">
  <div data-part="control">
    <input
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      aria-expanded="true"
      aria-controls="combobox-listbox-id"
      aria-activedescendant="combobox-r3-option-0"
      aria-busy="false"
      aria-readonly="false"
      autocomplete="off"
      data-part="input"
    />
    <button type="button" data-part="clear" aria-label="清除选择"></button>
    <button type="button" tabindex="-1" data-part="toggle" aria-label="收起选项"></button>
  </div>
  <input type="hidden" name="city" value="shanghai" />
</div>

<!-- FloatingPanel + Portal -->
<div data-part="panel" data-open="true">
  <div id="combobox-listbox-id" role="listbox" data-part="listbox">
    <div
      id="combobox-r3-option-0"
      role="option"
      aria-selected="true"
      aria-disabled="false"
      aria-label="上海"
      data-part="option"
      data-active="true"
    ></div>
  </div>
  <div data-part="status" role="status" aria-live="polite"></div>
</div>
```

规则：

- 列表导航时 DOM 焦点停留在 input，活动项通过 `aria-activedescendant` 表达；clear 是唯一额外进入 Tab 顺序的控件。
- active 与 selected 分离；只有选中时更新 value。
- `aria-activedescendant` 仅引用当前已挂载的 option。
- 复杂 label 的 option 明确设置 `aria-label={textValue}`。
- option DOM id 使用组件级 `useId()` 前缀加当前 index，例如 `${baseId}-option-${index}`；不得把任意 value 拼进 DOM id。active 状态仍按 value 保存。
- loading / empty 不是 option，放在 listbox 外，并以 `aria-busy` / status 播报。
- 结果状态优先级为 loading → error → empty：`loading=true` 时保留旧结果并显示 loading，暂不显示旧 error；loading 结束后，`errorContent` 非 null 时渲染 `data-part="error"`；empty 仅在非 loading、无 error 且过滤结果为空时出现。三者都不伪装成 option。
- clear 保持原生 `tabIndex=0`，确保键盘用户能清除 committed value；toggle 保持 `tabIndex=-1`，由输入框键盘契约覆盖展开/收起。
- clear / toggle 的 `pointerdown` 阻止 input 提前失焦；指针操作完成后将焦点还给 input。
- clear 通过键盘 Enter / Space 激活时，也必须在按钮因状态变化卸载前保存 input ref，并在提交 clear 意图后恢复 input 焦点。
- 从 input 移到 clear 属于组件内部焦点移动，不触发公开 `onBlur`、严格回退或关闭；只有焦点离开整个 Combobox 才执行这些行为。
- option `pointerdown` 阻止 input 提前 blur，click 再完成选择。
- 面板必须复用 `FloatingPanel`、Portal 主题继承和现有 outside-click 基础设施。
- `readOnly` 时 input 仍可聚焦、选择和复制文本，并设置原生 `readOnly` 与 `aria-readonly="true"`；不得打开、导航或选择，也不渲染 clear / toggle。

## 7. 键盘交互

| 按键               | 关闭态                                                                       | 打开态                                                                   |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ArrowDown          | 打开，激活已选项或首项                                                       | 下一项                                                                   |
| ArrowUp            | 打开，激活已选项或末项                                                       | 上一项                                                                   |
| Enter              | 无草稿时允许原生提交；草稿精确匹配可用 option 时选中，否则打开列表并阻止提交 | 有可用 active 时选中并关闭；否则阻止误提交                               |
| Escape             | 草稿存在时恢复提交文本                                                       | 关闭并恢复提交文本                                                       |
| Tab                | 按原生顺序移动焦点                                                           | 不提交 active；进入 clear 时保持状态，真正离开组件边界时才关闭并严格回退 |
| Alt+ArrowDown      | 打开                                                                         | 不变                                                                     |
| Alt+ArrowUp        | 不变                                                                         | 关闭并恢复严格值                                                         |
| Home / End         | 原生光标移动                                                                 | 仍保留文本编辑行为                                                       |
| Left / Right       | 原生文本编辑                                                                 | 原生文本编辑                                                             |
| Backspace / Delete | 原生文本编辑                                                                 | 原生文本编辑                                                             |
| Space              | 输入空格                                                                     | 输入空格                                                                 |

- 边界采用钳制，不循环。
- 初次打开与新结果回退时只激活 enabled option；若 selected option 已 disabled，则回退首个/末个 enabled。
- 已有 active 后，方向导航按 DOM 顺序，可停在 disabled option，但不能提交，与当前 Select 契约保持一致。
- pointer hover 可以更新 activeValue，但不能抢焦点。
- 不拦截浏览器原生文本编辑快捷键。
- 关闭态 Enter 的精确匹配只比较 query 与 option 的提交展示文本：优先 `textValue`，否则仅回退字符串/数字 label；使用不 trim、不变更大小写的代码单元相等。零个或多个 enabled 匹配都不自动选择，不使用 value / keywords 猜测，统一打开列表并阻止提交。
- loading 时允许保留和导航旧结果，但旧结果视为 stale，Enter、关闭态精确匹配与指针都不得提交；只有归一化后的 `isLoading = loading ?? false` 明确为 false 时才恢复选择。
- `readOnly` 时所有打开、导航、选择和清除按键都不生效，只保留原生文本选择与复制。

## 8. IME

组合输入期间：

- `inputValue` 与 `onInputValueChange` 正常更新，并标记 `isComposing: true`。
- 不更新本地过滤 query，也不触发 `onSearch`，从契约上阻止调用方在组合中启动远程请求。
- Enter、Escape、ArrowUp/Down 不执行提交、关闭或导航。
- 同时检测 composition ref、`nativeEvent.isComposing` 和 keyCode 229 兜底。

`compositionend` 后：

1. 从真实 input 读取最终文本。
2. 更新本地过滤 query，并只触发一次 `onSearch(finalQuery)`。
3. 最终值若已由最后一次 change 报告，不重复触发 `onInputValueChange`。
4. 比较文本时可规范化大小写；绝不修改用户实际输入内容。

非组合状态的每次用户输入先同步触发 `onInputValueChange`，再触发 `onSearch`。selection / reset 不触发搜索；clear 的业务副作用可通过 `onInputValueChange` 的 `reason` 处理。

## 9. 外部异步搜索

推荐用法：

```tsx
<Combobox
  options={remoteOptions}
  filterOption={false}
  loading={loading}
  inputValue={query}
  onInputValueChange={(nextQuery) => setQuery(nextQuery)}
  onSearch={loadRemoteOptions}
/>
```

文档示例必须同时使用：

- AbortController：取消支持 signal 的请求。
- 单调 request id：忽略不支持取消或已经迟到的 Promise。
- `onSearch` 中 debounce；组件保证 composition 结束前不会调用它。
- query 变化、clear、selection 和卸载时取消旧请求。

组件对 options 更新的保证：

- 迟到结果不能重新打开已关闭面板。
- 不能覆盖已提交文本或 value。
- loading 时可保留旧结果，并设置 `aria-busy=true`。
- loading 期间保留的旧结果只用于维持上下文和键盘位置，不可提交。
- 已选项暂时不在结果中时使用 lastKnownText / `displayValue`。

## 10. Form 集成

- public ref、`id`、`aria-invalid`、`aria-describedby`、`aria-required`、`required` 和 `setCustomValidity` 落在真实 input；公开 `onBlur` 由根节点 focus-within 边界代理。
- 可见 input 不带 `name`；隐藏 input 只接收 `name` 并序列化实际 committed value。两者都继承 `form`，确保外置表单归属一致。
- 输入草稿变化不触发 Form.Item value 变化。
- 根节点用 focus-within 边界统一代理公开 blur；Tab 或外部点击真正离开整个组件时才校验。Tab 到 clear、点击 clear / toggle 或 option pointerdown 都不提前触发。
- `required` 校验依据 committed value，不依据 query；可见 input 根据实际 committed value维护 `setCustomValidity`，阻止未匹配草稿用 `requestSubmit()` 绕过必填。隐藏 input 不承担约束校验。
- 关闭态存在未提交草稿时，Enter 必须先精确匹配并选择；无法匹配则打开列表并 `preventDefault()`，不能提交隐藏字段中的旧 value。
- disabled 时隐藏字段不参与提交。

## 11. 定制出口

稳定 parts：

```text
root
control
input
clear
toggle
panel
listbox
option
loading
empty
error
status
```

首版 CSS 变量：

```css
--z-combobox-control-height
--z-combobox-control-padding-x
--z-combobox-control-gap
--z-combobox-font-size
--z-combobox-radius
--z-combobox-bg
--z-combobox-fg
--z-combobox-border
--z-combobox-hover-border
--z-combobox-focus-ring
--z-combobox-placeholder-fg
--z-combobox-icon-fg
--z-combobox-clear-hover-bg
--z-combobox-panel-bg
--z-combobox-panel-border
--z-combobox-panel-radius
--z-combobox-panel-shadow
--z-combobox-panel-max-height
--z-combobox-panel-margin-top
--z-combobox-panel-padding
--z-combobox-option-height
--z-combobox-option-padding-x
--z-combobox-option-radius
--z-combobox-option-fg
--z-combobox-option-active-bg
--z-combobox-option-active-fg
--z-combobox-option-disabled-fg
--z-combobox-status-fg
--z-combobox-animation-duration
```

CSS 必须覆盖 `data-size`、`data-status`、disabled、readOnly、loading、open、320px、动态视口、暗色、reduced-motion、forced-colors 和 `:focus-visible`。

## 12. 测试矩阵

状态：

- value / inputValue / open 分别受控与非受控。
- 受控 value / open 被父级拒绝或延迟时，展示、隐藏字段、ARIA 与面板都不提前切换。
- 外部 value/options 变化。
- selected option 暂时消失与恢复。
- defaultValue / defaultInputValue 一致、不一致和异步暂不可解析。
- 严格文本回退的 reset reason，以及原生 form.reset 不触发变更回调。
- 重复 value 与缺 textValue 的开发警告。

交互与键盘：

- 输入不改变 committed value。
- 鼠标、Enter、Arrow、Escape、Tab、Alt+Arrow。
- Home/End/左右键保留文本编辑。
- disabled option 可导航不可提交。
- clear 可 Tab、toggle 不进入 Tab，以及 clear/toggle/option pointerdown 的焦点行为。
- input 到 clear 的内部焦点移动不触发公开 blur 或严格回退；从 clear 离开组件时根边界只报告一次 blur。
- clear 的指针与键盘激活都恢复 input 焦点。
- 关闭态 Enter 的唯一、多个和零个展示文本精确匹配，以及 value / keywords 不参与自动提交。
- 非 text input type 在类型层不可传入。
- outside click、readOnly、disabled。

IME 与异步：

- composition 中 Enter 不提交、方向键不导航。
- composition 中仍报告 input 文本但不触发搜索；compositionend 只触发一次最终 `onSearch`。
- options 乱序更新不改变 value/open/input。
- loading、empty 与旧结果保留；loading 时旧结果不可提交。
- errorContent 与 loading / empty 的互斥展示。

无障碍与集成：

- combobox/listbox/option 角色与关联 ID。
- active 与 selected 分离。
- 可访问名称、invalid、required、live status 和 axe。
- Form.Item、原生表单、外置 `form`、required / requestSubmit、SSR、Portal 局部主题、Modal/Drawer 内嵌。
- 暗色、320px、200% 缩放、移动软键盘改变 viewport。
- VoiceOver + Safari 和 NVDA + Chrome 加入人工清单。

## 13. 交付文件

```text
packages/ui/src/components/Combobox/
  Combobox.tsx
  Combobox.css
  Combobox.test.tsx
  index.ts
  meta.json

docs/src/pages/components/ComboboxPage.tsx
```

同步修改：

- 根导出与 package README。
- ConfigProvider locale 十套语言包。
- docs 导航、组件页和 `a11y-notes.md`。
- roles / keyboard / labels / axe / SSR 测试。
- Registry、CLI、MCP、消费者检查。
- Playwright 本地过滤、远程 loading、IME 与焦点用例。
- 组件总数、CHANGELOG 与发布材料。

## 14. 后续演进

多选不通过 `multiple: boolean` 加入本组件。它会改变 value 类型、DOM、键盘、Backspace、Form 值和标签删除行为，应新增独立 `MultiCombobox`，复用内部选项、过滤和浮层控制器。

## 15. 实现验收结果

- API 未加入首版非目标能力。
- Form 对 committed value 与草稿的处理已有集成测试。
- 异步示例已使用 AbortController 与 request id 双重竞态保护。
- `Select` 与 `Combobox` 的使用边界已在文档中区分。
- VoiceOver + Safari 与 NVDA + Chrome 仍作为发布前人工辅助技术清单，不由自动化验收替代。

参考：[WAI-ARIA APG Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)。
