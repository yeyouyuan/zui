# RFC-003：Splitter 可调分栏

状态：2026-11-09 迁移原型评审通过，正式实现与发布同步完成，待随下一版本发布。IDE 三栏与主从详情两个隐藏原型持续使用公共候选实现作为回归证据。

## 1. 目标

`Splitter` 提供可拖拽调整的分栏布局，解决主从详情、编辑器与仪表盘在 Row/Col/Flex 静态布局下无法分配空间的问题。

首版必须做到：

- compound API：`Splitter` / `Splitter.Panel`；相邻 Panel 之间的 Handle 由根组件自动生成，并通过 `handleProps` 定制。
- 水平与垂直两种方向；面板尺寸支持受控与非受控。
- 面板 `minSize/maxSize` 约束、`collapsible` 折叠。
- Handle 使用 `role="separator"`，暴露 `aria-valuemin/max/now`，支持键盘调整。
- 拖动用 Pointer Capture；容器尺寸变化由 ResizeObserver 跟随。
- 令牌驱动样式、SSR 安全、暗色与 320px 可验证。

## 2. 非目标

- 不做嵌套面板的状态联动（嵌套 = 外层 Panel 内再放一个 Splitter，由调用方组合）。
- 不做浮动分隔条、双击复位或惯性拖动；不内置保存布局到 localStorage。
- 不做自由窗口（floating/docking）模型；只做线性分栏。
- 不与 `Collapse`（垂直堆叠手风琴）合并：Collapse 是内容折叠组件，Splitter 是布局分配组件。

## 3. 数据模型与 TypeScript API

```tsx
export interface SplitterPanelProps extends Omit<React.ComponentPropsWithRef<'div'>, 'className'> {
  /** 用于相邻 handle 的无障碍名称；默认使用本地化的“面板 {index}” */
  label?: string;
  /** 初始尺寸，占容器主轴的百分比；未提供时按剩余空间均分 */
  initialSize?: number;
  /** 最小尺寸（百分比）。默认 0 */
  minSize?: number;
  /** 最大尺寸（百分比）。默认 100 */
  maxSize?: number;
  /** 是否可折叠到 collapsedSize。默认 false */
  collapsible?: boolean;
  /** 折叠后的尺寸（百分比）。默认 0 */
  collapsedSize?: number;
  /** 折叠状态（受控，可选） */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  classNames?: { root?: string; content?: string };
  children?: React.ReactNode;
}

export interface SplitterHandleContext {
  index: number;
  beforePanelId: string;
  afterPanelId: string;
  beforePanelLabel: string;
  afterPanelLabel: string;
}

export interface SplitterHandleProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  | 'children'
  | 'className'
  | 'role'
  | 'aria-controls'
  | 'aria-orientation'
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-valuenow'
> {
  /** 禁用拖动、键盘调整与折叠；禁用后为纯视觉分隔。默认 false */
  disabled?: boolean;
  /** Enter 切换哪一侧 Panel；默认 none */
  collapseTarget?: 'before' | 'after' | 'none';
  className?: string;
}

export interface SplitterSizesChangeDetails {
  reason: 'pointer' | 'keyboard' | 'collapse' | 'panels-change';
  handleIndex: number | null;
}

export interface SplitterResizeEndDetails extends Omit<SplitterSizesChangeDetails, 'reason'> {
  input: 'pointer' | 'keyboard';
  cancelled: boolean;
  /** 本次交互最后请求的值；取消时为起点快照 */
  requestedSizes: number[];
}

export interface SplitterProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'children' | 'className'
> {
  orientation?: 'horizontal' | 'vertical'; // 默认 'horizontal'
  /** 受控尺寸（百分比数组，长度 = 面板数；折叠面板为 collapsedSize） */
  sizes?: number[];
  defaultSizes?: number[];
  onSizesChange?: (sizes: number[], details: SplitterSizesChangeDetails) => void;
  /**
   * 一次 pointer / keyboard 会话结束时触发。
   * sizes 是结束边界上实际显示的值；受控父级拒绝更新时可能与 requestedSizes 不同。
   */
  onResizeEnd?: (sizes: number[], details: SplitterResizeEndDetails) => void;
  /** 为自动生成的第 index 个 handle 提供名称、折叠目标、disabled 与原生属性 */
  handleProps?: (context: SplitterHandleContext) => SplitterHandleProps;
  className?: string;
  classNames?: {
    root?: string;
    handle?: string;
    handleIndicator?: string;
  };
  children: React.ReactNode;
}
```

API 约束：

- `Splitter` 的 children 只接受 `Splitter.Panel`（`null` / `false` 忽略）；开发环境对其他子元素警告并跳过，不把未知节点塞进尺寸轨道。调用方不手写 Handle，根组件严格在相邻 Panel 间生成一个 separator，因此 DOM 顺序和 `sizes` 下标始终只由 Panel 顺序决定。
- `Splitter.Handle` 不作为组件导出；`SplitterHandleProps` 只是 `handleProps(context)` 的返回类型。根组件始终拥有 `role`、方向、值域和 `aria-controls`，调用方可以传 `aria-label` / `aria-labelledby` / `aria-describedby`、`disabled`、`collapseTarget`、事件与 data 属性，但不能覆盖由布局计算出的 separator 语义。
- `sizes` 为受控时，每步只通过 `onSizesChange` 请求新值，宽度与 ARIA 始终服从最新 props。结束时 `onResizeEnd` 第一参数报告实际值，`details.requestedSizes` 报告最后请求值，父级拒绝更新也不会制造伪状态。
- 折叠是 Panel 的受控/非受控状态，与 sizes 联动：折叠时该面板请求 `collapsedSize`，其余面板按 min/max 重新分配；展开时请求折叠前最后一个有效尺寸。Handle 的 Enter 只有在 `collapseTarget` 明确指向一个 `collapsible` Panel 时才切换；错误目标开发环境警告并忽略。
- Panel 内容里的自定义折叠按钮若要控制非受控 Panel，没有隐式上下文 setter；此场景必须把 `collapsed` 提升为受控状态。首版唯一内置操作通道是带 `collapseTarget` 的 Handle，避免一个面板存在两套不同步的内部状态。

示例：

```tsx
<Splitter
  defaultSizes={[30, 70]}
  handleProps={({ beforePanelLabel, afterPanelLabel }) => ({
    'aria-label': `调整${beforePanelLabel}与${afterPanelLabel}的宽度`,
    collapseTarget: 'before',
  })}
>
  <Splitter.Panel label="目录" collapsible minSize={20}>
    …
  </Splitter.Panel>
  <Splitter.Panel label="内容" minSize={40}>
    …
  </Splitter.Panel>
</Splitter>
```

## 4. 状态与尺寸模型

公开状态：

1. `sizes`：受控/非受控的百分比数组，长度恒等于 Panel 数量，合法布局的总和为 100（允许实现 epsilon 内的浮点误差）。
2. 每个 Panel 的 `collapsed`：受控/非受控；折叠和尺寸请求必须作为同一次操作处理。

内部持久状态：

- 非受控 `sizes` 与每个非受控 Panel 的 `collapsed`。
- 每个 Panel 最近一次未折叠的有效尺寸，用于展开恢复；受控 Panel 也只记录已经从 props 观察到的有效尺寸，不记录被父级拒绝的请求。

内部瞬态：

- `draggingHandleIndex`、Pointer Capture 的 `pointerId` 和拖动起点快照（起始实际 sizes、指针坐标、当时的可分配主轴尺寸）。
- `keyboardHandleIndex` 与该次按键会话的最后请求值；不用 debounce 计时器。
- 面板 id、内容 ref 和 Handle ref，用于 ARIA 关系与折叠时的焦点恢复。

尺寸基准固定为：

```text
C = root content box 的主轴像素
H = 所有实际参与布局的 handle track 主轴像素之和
A = max(0, C - H)
panelPx[i] = A * sizes[i] / 100
```

Handle 的扩展命中热区使用伪元素或绝对定位，不计入 `H`。所有 `minSize`、`maxSize`、`initialSize`、`collapsedSize` 都是相对于 `A` 的 0–100 数值，不相对于包含 Handle 的 `C`；因此 Panel 百分比总和为 100 时不会再被 Handle 挤出容器。

规则：

- 第 `i` 个 Handle 只在 Panel `i` 与 `i + 1` 的固定总量内移动。若两侧当前总量为 `P`，前一 Panel 的有效范围为 `max(before.minSize, P - after.maxSize)` 到 `min(before.maxSize, P - after.minSize)`；后一 Panel 取 `P - beforeSize`。达到任一有效边界后拖动卡住，不向更远 Panel 级联。
- `initialSize` 只在非受控且未提供 `defaultSizes` 时生效；`defaultSizes` 优先于各 Panel 的 `initialSize`。缺失值按剩余可行空间均分，之后按约束归一化。
- 有效约束必须满足每项 `0 <= minSize <= maxSize <= 100`、`0 <= collapsedSize <= maxSize`，并且整体 `sum(minSize) <= 100 <= sum(maxSize)`。初次渲染遇到不可行配置时开发环境警告，并回退为忽略冲突边界的等分布局；运行中 props 变为不可行时保持最后一个有效布局，不输出溢出布局。
- 容器尺寸变化由 ResizeObserver 跟随；百分比不因像素变化而回调。`A = 0` 时保留最后有效百分比并暂停 Pointer 换算，恢复到正尺寸后继续使用同一比例。
- children 增删或重排时，以 React key 保留仍存在 Panel 的非受控尺寸与折叠记录；无 key 时按位置匹配并开发警告。新增 Panel 从其 `initialSize` 或剩余空间取得尺寸，删除 Panel 的份额按相邻优先重新分配，并以 `reason: 'panels-change'` 回调一次。受控 `sizes` 长度不匹配时忽略本次输入并警告，不猜测父级意图。
- Handle 发起的折叠操作回调顺序固定为：目标 Panel 的 `onCollapsedChange(next)` → `onSizesChange(requested, { reason: 'collapse' })` → 交互结束边界上的 `onResizeEnd(actual, details)`。受控父级拒绝任一更新时，布局由当前 `collapsed` 与 `sizes` props 的规范化组合决定，不显示被拒绝的请求；开发环境对持续不一致的组合警告一次。
- 父级直接改变受控 `collapsed` 时不反向触发 `onCollapsedChange`。非受控 sizes 会同步重分配并回调一次 `onSizesChange(reason: 'collapse')`；受控 sizes 若同一 render 未给出兼容值，也请求一次规范化 sizes，但不触发 `onResizeEnd`，因为这不是用户 resize 会话。冲突期间 `collapsed` 优先决定该 Panel 是否 inert 以及是否占 `collapsedSize`。
- 折叠 Panel 固定占 `collapsedSize`，差额优先分配给该 Panel 另一侧、同一 Handle 相邻的 Panel；若其达到 max，再按离折叠 Panel 由近到远分配。展开时按相反顺序回收空间，先尝试恢复记录尺寸，再受当前 min/max 夹紧。
- RTL 只改变水平方向的视觉与指针/方向键映射，不改变 children、`sizes`、Handle index 或 before/after 的逻辑顺序。实现读取 root 的实际 computed direction。

## 5. DOM 与 ARIA

```html
<div data-part="root" data-orientation="horizontal">
  <div id="splitter-panel-navigation" data-part="panel" data-collapsed="false">
    <div data-part="content">…</div>
  </div>
  <div
    data-part="handle"
    role="separator"
    aria-orientation="vertical"
    aria-controls="splitter-panel-navigation splitter-panel-content"
    aria-valuemin="20"
    aria-valuemax="60"
    aria-valuenow="30"
    aria-label="调整目录与内容的宽度"
    tabindex="0"
  ></div>
  <div id="splitter-panel-content" data-part="panel">…</div>
</div>
```

规则：

- root 是无 role 的普通布局 div，不创建 landmark。Handle 使用可聚焦的 `role="separator"`；水平分栏的分隔线为 `aria-orientation="vertical"`，垂直分栏为 `horizontal`。
- 每个 Panel 都获得 SSR/hydration 稳定的 id：调用方显式 `id` 优先，否则由 root 的 `useId` 加稳定 Panel key（无 key 时为位置）生成。Handle 的 `aria-controls` 以空格分隔关联前后两个 Panel id。
- Handle 的默认名称使用 `splitter.resizeHandle` 模板与两个 Panel 的 `label`；缺少 label 时使用本地化 `splitter.panelLabel` 加 1-based 序号，因此同页多个 separator 仍能区分。`handleProps` 返回的 `aria-labelledby` 优先于 `aria-label`，显式 `aria-label` 又优先于默认模板。
- `aria-valuenow` 始终表示逻辑上前一 Panel 的当前实际百分比；`aria-valuemin/max` 使用第 4 节的成对有效范围，而不是简单复制该 Panel 自身的 min/max。值按实现精度舍入供辅助技术朗读，但布局内部保留精度。
- `handleProps().disabled` 输出 `aria-disabled="true"` 且从 Tab 序移除；用户提供的事件先运行，若相应事件已 `preventDefault()`，内部拖动、键盘或折叠行为不再发生。
- 折叠 Panel 保留外层和 `collapsedSize` 布局；其 content 包装器同时设置 `inert`、`aria-hidden="true"`、`pointer-events: none` 与 `overflow: hidden`。未折叠时移除这些属性。不能只靠裁剪或 `overflow: hidden`，否则 0 尺寸内容仍会进入 Tab 序。
- 若 Panel 从未折叠变为折叠时焦点位于其 content 内，commit 后把焦点移到明确以它为 `collapseTarget` 的 Handle；多个候选按该 Panel 之后、之前的相邻顺序选择。没有显式目标时退到之后再之前的可用相邻 Handle；单 Panel 无 Handle 时聚焦带 `tabIndex={-1}` 的 root。若焦点原本不在该 Panel 内，不抢焦点。

## 6. 键盘与指针

- 方向键按 Handle 的**物理移动方向**解释：水平分栏中 Left/Right 向视口左/右移动，垂直分栏中 Up/Down 向上/下移动；与 orientation 不匹配的方向键不拦截。RTL 水平布局因此自然反转 before Panel 数值变化，但键本身的物理方向不反转。
- 每次方向键步进可分配空间的 1%，`PageUp/PageDown` 沿减小/增大 before Panel 的数值方向步进 10%，`Home/End` 分别到第 4 节计算出的 `aria-valuemin/max`。每步都回调 `onSizesChange(..., { reason: 'keyboard', handleIndex })`。
- `Enter` 仅在 `collapseTarget` 指向可折叠的相邻 Panel 时切换其折叠状态；`collapseTarget: 'none'`、目标不存在或 `collapsible={false}` 时不拦截。折叠 Panel 相邻 Handle 的 resize 键与 Pointer 拖动在它展开前不改变尺寸，但 Handle 仍可聚焦并用 Enter 展开。
- 键盘会话从第一个被内部处理的 `keydown` 开始，浏览器 key repeat 属于同一会话；对应调整键的 `keyup` 固定触发一次 `onResizeEnd`。若 keyup 前失焦，`blur` 提交一次；不用“停止一段时间”之类不确定 debounce。键盘会话逐步提交，Escape 不回滚。
- Pointer 只响应主指针与主按钮。`pointerdown` 保存实际布局快照并调用 `setPointerCapture`，`pointermove` 以该快照和当前指针位移持续计算请求值，避免受控 props 延迟造成累计漂移。拖动期间 root 输出 `data-resizing` 并禁用文本选择。
- `pointerup` 是提交边界：释放 capture，并以 `cancelled: false` 触发一次 `onResizeEnd`。`Escape`、`pointercancel` 或非预期 `lostpointercapture` 是取消边界：请求恢复起点快照，随后以 `cancelled: true` 触发一次 `onResizeEnd`；由正常 pointerup 主动释放造成的 lostcapture 不得重复回调。
- 每次会话 `onResizeEnd` 恰好一次。取消时 `details.requestedSizes` 是起点快照；提交时是最后请求值。第一参数始终在该边界读取非受控内部值或最新受控 props，明确区分“请求”与“实际”。
- Handle 的视觉线宽与命中区分离；触摸热区至少 24 CSS px，且 `touch-action: none` 只施加在 Handle 上，不阻断 Panel 内容滚动。
- 不拦截 Tab；Handle 按 DOM 顺序进入 Tab 序，Tab/Shift+Tab 若结束键盘会话，先按 blur 规则提交再自然移动焦点。

## 7. 响应式与窄屏降级

- Splitter 不内置断点：320px 下保持可拖动，但调用方通常应切换布局。推荐组合：外层用 `window.matchMedia` 或 CSS 控制渲染分支，窄屏改用纵向堆叠或 `Drawer`；Splitter 自身只保证在任意容器宽度下 min/max 与键盘行为正确。
- 百分比约束作用于扣除 Handle 后的 `A`，所以容器变窄不会改变 sizes，也不会因 Handle 额外占宽产生横向溢出。不可行约束按第 4 节回退并警告，不按声明顺序偷偷把后方 Panel 压到 min 以下。
- root 使用 CSS Grid 主轴轨道（Panel 百分比轨道与固定 Handle 轨道交错）或数学等价布局；实现不得依赖 flex 自动收缩修正百分比。root 的 `width/height: 100%` 仍由调用方容器决定，并以 `min-block-size: 0`、`min-inline-size: 0` 收敛。
- 320px、缩放文字与长内容下，Panel content 自己决定滚动/换行；Splitter 只裁剪已折叠 content，不在未折叠 Panel 上强制 `overflow: hidden`，避免把可访问内容无提示截断。

## 8. Locale

```ts
splitter: {
  resizeHandle: string; // '调整{before}与{after}的大小'
  panelLabel: string; // '面板 {index}'
  expandPanel: string; // '展开{label}'
  collapsePanel: string; // '折叠{label}'
}
```

十套语言包与 `mergeLocale()` 同步。`{before}` / `{after}` 来自 Panel label，`{index}` 为 1-based；Locale 只提供默认 Handle 名称，不在 Enter 切换时把 separator 名称改成动作按钮名称。展开/折叠字符串用于辅助说明或文档，不覆盖 separator 的稳定名称。

## 9. 视觉规范与定制出口

稳定 parts：`root` / `panel` / `content` / `handle` / `handle-indicator`。

首版 CSS 变量：

```css
--z-splitter-handle-size        /* 分隔条厚度，默认 0.5rem */
--z-splitter-handle-hit-size    /* 命中热区，默认 1.5rem，至少 24 CSS px */
--z-splitter-handle-bg
--z-splitter-handle-hover-bg
--z-splitter-handle-active-bg
--z-splitter-handle-radius
--z-splitter-handle-fg          /* indicator 颜色 */
--z-splitter-animation-duration
```

- 默认视觉：细分隔线 + hover/active 主色；拖动中显示 `col-resize` / `row-resize` 光标。
- Handle 的布局轨道只占 `--z-splitter-handle-size`；`--z-splitter-handle-hit-size` 通过居中的绝对热区扩展，不进入第 4 节的 `H` 两次。相邻 Handle 热区不得覆盖彼此或 Panel 内可点击控件。
- 折叠 Panel 只保留 `collapsedSize` 高度/宽度；content 除 `overflow: hidden` 外必须同步 `inert`、`aria-hidden` 与禁用 pointer events。展开时一次性移除，不出现“视觉已展开但仍 inert”的过渡帧。
- `--z-splitter-animation-duration` 只允许用于折叠/展开轨道过渡；直接拖动与键盘步进必须实时，不做追随动画。reduced-motion 下过渡禁用；forced-colors 下分隔条、disabled、active 与焦点环保持可辨认。

## 10. 测试矩阵

组件测试：

- 渲染与 parts：orientation 两种方向、自动 Handle 数量 = Panel 数量 - 1、children 中非 Panel 警告并跳过、无 `Splitter.Handle` 公共组件。
- Handle 定制：`handleProps(context)` 的 index/id/label 正确；显式 `aria-labelledby` > `aria-label` > locale 默认名称；用户事件 `preventDefault` 可取消内部行为；disabled 为不可聚焦纯视觉分隔。
- ARIA：每个 separator 名称可区分，`aria-controls` 同时指向前后稳定 Panel id；`aria-valuemin/max` 使用成对约束公式，`aria-valuenow` 与受控实际值同步。
- 尺寸数学：Panel 百分比基于 `C - H`，Panel 像素总和加 Handle 恰好等于 content box；hit area 不重复计入；min/max 夹紧与两侧到边界后卡住。
- 非受控拖动：pointerdown → move → up 产生逐步 sizes，并只触发一次非取消 `onResizeEnd`；Escape、pointercancel、意外 lostcapture 均恢复快照并只触发一次取消回调；正常 release 后的 lostcapture 不重复。
- 受控 sizes：父级接受、延迟接受和拒绝三种情况都服从 props；`onResizeEnd(actual, { requestedSizes })` 明确区分实际值与请求值。
- 键盘：物理方向与 RTL 映射、1% 与 10% 步进、Home/End 到有效值域、key repeat、keyup/blur 各会话只提交一次且没有 debounce flake。
- 折叠：明确 `collapseTarget` 的 Enter 操作、错误目标警告、受控/非受控、collapsedSize 联动、展开恢复前尺寸、回调顺序与受控拒绝。
- 折叠焦点：content 输出 inert + aria-hidden；Tab 不进入不可见内容；内部焦点遇外部受控折叠时按指定顺序回退到相关 Handle，单 Panel 回退 root。
- 容器缩放（ResizeObserver 模拟）、0 尺寸暂停、key 保留的 Panel 增删/重排与无 key 警告。
- 归一化：defaultSizes 缺失/超额/不足、initialSize 均分、不可行 min/max 集合回退且不产生溢出布局。
- RTL：dir=rtl 下水平拖动方向与键盘方向翻转。
- 开发警告：面板数与 sizes 长度不一致、invalid collapse target、collapsed/sizes 持续不一致、不可行约束。

公共测试：

- axe：两种方向、多 Handle 唯一命名、折叠态、焦点在 Handle 及折叠前位于 Panel 内容内。
- roles：separator 的 aria-orientation/controls/valuemin/max/now 与 disabled 状态。
- keyboard：上述键盘矩阵、Tab 顺序、keyup/blur 结束边界。
- SSR：无 window 访问；初值归一化结果客户端与服务端一致。
- E2E：真实 Pointer Capture 的提交、Escape/pointercancel 取消、受控拒绝、ResizeObserver、RTL。
- 320px：document 无横向溢出、Panel + Handle 总宽准确；另做暗色、forced-colors、200% zoom 与 reduced-motion 视觉检查。

## 11. 文件与发布边界

```text
packages/ui/src/components/Splitter/
  Splitter.tsx
  Splitter.css
  Splitter.test.tsx
  index.ts
  meta.json
docs/src/pages/components/SplitterPage.tsx
```

同步范围：根导出、`./splitter` 子路径、locale 十套语言包、Registry、CLI/MCP 示例、llms.txt、a11y/SSR/E2E、changeset。

正式化准入使用两个不公开导出、也不进入文档导航或 Registry 的迁移原型；二者共享同一公共候选实现与原型壳样式：

1. IDE 壳：左侧文件树可折叠、中间编辑器、右侧预览，覆盖三个 Panel、两个有独立名称的 Handle、键盘与受控拒绝。
2. 主从详情：两 Panel、320px 容器、RTL、内容区有真实输入与按钮，覆盖外部受控折叠时 inert 和焦点回退。

评审证据为 `e2e/splitter-prototype.spec.ts` 的 5 条浏览器用例：真实 Pointer Capture 提交、Escape / pointercancel 恢复、`C - H` 像素闭合、keyup / blur 会话、受控拒绝、ResizeObserver 从零可用尺寸恢复、外部折叠焦点回退、RTL、320px、浅色 / 暗色 axe 与隐藏路由边界。视觉快照保存在本次评审产物 `/tmp/zui-splitter-visual/`，浅色、暗色 hover 与 320px RTL 均无文档横向溢出。

正式实现已按“尺寸求解纯函数与自动 Handle DOM → 水平 Pointer → 键盘 / ARIA → 受控实际值与结束详情 → 折叠 / focus → 垂直、RTL、ResizeObserver → 发布同步”的顺序完成；后续修改必须继续通过上述组件矩阵与双原型证据，不能退回调用方手写 Handle 或 debounce 键盘提交。

## 12. 外部设计基准

- [Ant Design Splitter](https://ant.design/components/splitter/)
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)（百分比与 min/max 溢出分配参考）
- [WAI-ARIA APG Separator (Focusable)](https://www.w3.org/WAI/ARIA/apg/patterns/separator/)
- [MUI X 数据栅格不并入的决策记录：COMPONENT-ROADMAP.md](../COMPONENT-ROADMAP.md)
