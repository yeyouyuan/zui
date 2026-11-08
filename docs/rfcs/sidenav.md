# RFC-002：SideNav 侧边导航

状态：2026-11-09 原型评审通过，正式实现完成，待随下一版本发布。文档站与 AdminShell 双迁移原型共用同一私有实现完成准入验证，`e2e/sidenav-prototype.spec.ts` 8/8 全绿后已收敛为公共组件。

## 1. 目标

`SideNav` 面向后台、设置中心和文档站的持久侧边导航，解决当前业务区块与文档站重复实现分组、当前页、层级展开和桌面收窄的问题。

首版必须做到：

- 保留原生 `nav / ul / li / a / button` 语义，不使用动作菜单的 `role="menu"`。
- 支持分区、两级导航、图标、徽标、当前页、分组展开与桌面收窄。
- 路由无关：普通 `href` 可直接工作，也允许调用方用 `renderLink` 接入任意 Router。
- 受控与非受控状态、键盘、焦点恢复、SSR、暗色、320px 和长文案可验证。
- 移动端抽屉由 `Drawer` 和布局层负责，SideNav 不自行监听 viewport 或挂载遮罩。

## 2. 非目标

- 不承载“删除、复制、重命名”等动作；这类操作使用 `DropdownMenu`。
- 不实现任意深度树。首版只支持顶层项与一层子链接，避免把导航变成 Tree。
- 不内置路由匹配、权限系统、数据请求、搜索、收藏或最近访问。
- 不承载只切换本地面板的动作项；这类界面继续使用 `Tabs`、按钮或应用自己的状态控制。`SideNav` 的叶子始终代表可定位的链接目标。
- 不在收窄态使用 hover-only 交互；所有子链接必须可由点击和键盘打开。
- 不内置移动端 Drawer、顶部栏、Logo、租户切换器或用户菜单。

## 3. 数据模型与 TypeScript API

```tsx
export interface SideNavLinkItem {
  key: string;
  label: React.ReactNode;
  /** 复杂 label 在桌面收窄态用于视觉提示与可访问名称 */
  textValue?: string;
  href: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  linkProps?: Omit<
    React.ComponentPropsWithoutRef<'a'>,
    'href' | 'children' | 'className' | 'aria-current' | 'tabIndex'
  >;
}

export interface SideNavGroupItem {
  key: string;
  label: React.ReactNode;
  textValue?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  children: readonly SideNavLinkItem[];
}

export type SideNavItem = SideNavLinkItem | SideNavGroupItem;

export interface SideNavSection {
  key: string;
  label?: React.ReactNode;
  items: readonly SideNavItem[];
}

export type SideNavExpandedChangeDetails =
  { reason: 'toggle' | 'current'; key: string } | { reason: 'items-change'; removedKeys: string[] };

export type SideNavLinkRenderProps = Omit<React.ComponentPropsWithRef<'a'>, 'href' | 'children'> & {
  href: string;
  children: React.ReactNode;
  ref: React.Ref<HTMLAnchorElement>;
  'data-part': 'link';
  'data-key': string;
};

export interface SideNavProps extends Omit<
  React.ComponentPropsWithRef<'nav'>,
  'children' | 'className' | 'onSelect'
> {
  sections: readonly SideNavSection[];

  /** 当前路由对应的叶子项；由 Router 或应用位置状态控制 */
  currentKey?: string | null;
  /** 仅在未被取消的同上下文普通导航意图中触发 */
  onNavigate?: (
    key: string,
    item: SideNavLinkItem,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => void;

  expandedKeys?: readonly string[];
  defaultExpandedKeys?: readonly string[];
  onExpandedKeysChange?: (keys: string[], details: SideNavExpandedChangeDetails) => void;

  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsible?: boolean;

  renderLink?: (item: SideNavLinkItem, props: SideNavLinkRenderProps) => React.ReactElement;

  className?: string;
  classNames?: {
    root?: string;
    viewport?: string;
    section?: string;
    sectionLabel?: string;
    list?: string;
    item?: string;
    link?: string;
    groupToggle?: string;
    groupIndicator?: string;
    icon?: string;
    label?: string;
    badge?: string;
    children?: string;
    flyout?: string;
    tooltip?: string;
    collapseToggle?: string;
  };
}
```

API 约束：

- `key` 必须全局唯一且非空；重复 key、空 key、空 section、空 group、空 `href` 和复杂 label 缺少 `textValue` 时在开发环境警告。空 section / group 不渲染交互壳。
- 叶子项必须有 `href`；分组项只负责展开，不同时承担导航，避免一行出现两个含义冲突的点击目标。
- `label`、`icon` 与 `badge` 只能提供非交互内容，禁止嵌套链接、按钮、表单控件或显式可聚焦元素；需要额外动作时应放到 SideNav 之外或使用独立的 `DropdownMenu`，避免 nested-interactive 与冲突的键盘路径。
- `renderLink` 必须返回最终落到原生 `<a>` 的单个可聚焦元素，并完整转发 `ref`、ARIA、`className`、SideNav 提供的 `onClick`、内部决定的 `tabIndex`、`data-part` 与 `data-key`。`linkProps` 不允许覆盖 `tabIndex`，避免破坏原生导航顺序和 Portal flyout 的边界转移；丢失 `ref` 会破坏收窄和动态更新时的焦点恢复。开发文档必须提供经类型检查的 React Router / Next Link 示例。
- `currentKey` 只表达已经生效的当前位置，不由点击乐观改写。Router 应从 location 推导它；普通多页应用在新页面重新渲染时传入新的 `currentKey`。
- `onNavigate` 不调用 `preventDefault()`，只在未被 `linkProps.onClick` 取消的主键、无修饰键、非 `download`、且目标为当前浏览上下文的点击中触发。新窗口、下载、Cmd/Ctrl/Shift/Alt 点击完整保留原生语义，也不会改变当前页标记。
- 点击处理顺序固定为：调用方的 `linkProps.onClick` → SideNav 判定普通导航意图并调用 `onNavigate` → `renderLink` 返回的 Router 链接执行自身导航处理。SideNav 提供的 `props.onClick` 已包含前两步，适配器只转发一次，不另行调用 `linkProps.onClick` 或再次调用 `props.onClick`。若适配器确需附加用于取消导航的处理，必须在 SideNav 的 handler 前执行；任何前置 handler 已 `preventDefault()` 时都不得触发 `onNavigate`。Router 在最后一步为同上下文客户端跳转调用 `preventDefault()` 属于导航实现，不能反向视为前置取消；`onNavigate` 报告导航意图，不承诺路由已经提交。
- disabled 叶子渲染为不可聚焦的语义文本，不输出 `<a href>`，也不调用 `renderLink`；disabled group 使用原生 disabled 按钮，不能展开，其子项不成为可交互目标。权限隐藏应由调用方在传入前过滤，而不是滥用 disabled。
- `currentKey` 指向已知 group 或 disabled 子树时在开发环境警告；`expandedKeys` 指向已知叶子时同样警告。动态过滤、流式加载或数据刷新造成的未知 key 属于正常状态，受控和非受控模式都只在渲染时安全忽略，不制造空当前态、空浮层或控制台噪音。只有 key 已知但类型或可用状态错误时才警告。
- 非空 group 若没有任何可用子链接（全部 disabled），按“有效禁用”处理：开发环境警告，宽态与收窄态都不允许展开或打开 flyout。它保留标签和徽标展示，但 group toggle 使用原生 disabled 语义；调用方应优先隐藏无可用目的地的分组。

## 4. 状态模型

公开状态彼此独立：

1. `currentKey`：当前路由对应的叶子链接；只有受控状态，不假装代替 Router。
2. `expandedKeys`：展开的分组项 key。
3. `collapsed`：桌面宽导航或收窄图标栏。

默认值统一为 `collapsible={true}`、`defaultCollapsed={false}`、`defaultExpandedKeys={[]}`。未传 `collapsed` 时使用非受控状态，其初值由 `defaultCollapsed` 决定并默认 false；传入 `collapsed` 时以实际 props 为准，不使用默认值覆盖受控状态。非受控展开的空数组默认值仍必须在首次渲染同步合并有效当前项父组。

内部瞬态：

- `openFlyoutKey`：收窄态当前打开的子导航浮层，只允许一个。
- `focusReturnRef`：关闭浮层或切换收窄状态时恢复焦点。
- `lastInteraction`：区分键盘与指针打开；键盘打开 flyout 后聚焦首个可用子链接，指针打开保留触发器焦点。

状态规则：

- 点击可用叶子链接按上述普通导航规则调用 `onNavigate`，不在内部改写 `currentKey`，也不阻止原生导航。
- 点击分组只更新 `expandedKeys`，不改变选中项。
- 首次渲染时，非受控 `expandedKeys` 的初值同步合并当前项父组，不等待 effect，因此 SSR 与 hydration 不出现“先收起再展开”；初始合并不回调。
- `currentKey` 后续变化时，非受控展开状态补入其父组并以 `reason: 'current'` 报告。受控展开不伪造 UI：若当前叶子的父组未包含在 `expandedKeys`，在 commit 后报告一次展开意图。首次挂载时已知的 current、current 变化，以及 current 先到而异步 `sections` 后到并首次解析为有效叶子，分别构成一次新的解析周期；解析身份由 `currentKey + parentGroupKey + 连续可解析区间` 决定，因此同一 key 换到新父组、被过滤后重新出现，也各自开始新周期。同一周期内重渲染、数据对象换引用或父级拒绝更新不得重复回调。
- 有效当前项首次解析或变化后，SideNav 在客户端布局提交后确保其位于自身 `viewport` 的可视范围内。只有目标超出滚动区时才按 `block: 'nearest'` 的最小距离立即调整该 viewport 的纵向滚动位置；实现用 viewport 的局部滚动计算，不能直接调用会连带滚动祖先的无约束 `element.scrollIntoView()`，不能滚动页面或移动焦点。宽态目标为实际可见的当前链接；收窄态目标为其顶层链接或父分组按钮，不为此打开 flyout。受控父组仍收起时先确保父按钮可见，父级随后接受展开后再确保当前子链接可见。异步 sections 解析、同 key 换父组或过滤后重现同样触发可见性检查；同一已解析可见目标的数据换引用和普通重渲染不重复滚动，也不阻止用户随后手动浏览列表。SSR 不访问布局或滚动 API。
- 收窄时保留 `expandedKeys`，恢复宽导航后回到原展开状态。
- 组件内部与回调输出的 `expandedKeys` 都必须去重，并始终按当前 `sections` 中分组的视觉顺序排列；动态重排后以新顺序为准，不能暴露 Set 插入顺序造成的不确定结果。
- 收窄态 flyout 不写入 `expandedKeys`；它只是临时访问子链接的展示状态。
- `sections` 动态变化时，非受控 expanded 状态裁掉已删除或不再可用的 group，并以 `reason: 'items-change'` 一次性报告；受控 expanded 对未知 key 静默忽略，对已知叶子 key 才警告。若打开的 flyout 或其触发器被删除、被禁用或变成“全部子项 disabled”的有效禁用组，立即关闭并按焦点规则回退。宽态当前聚焦项被删除时，焦点依次尝试同列表中后一个可用项、前一个可用项、所属分组按钮、收窄按钮和 root。收窄态当前聚焦的顶层项被删除或不再可聚焦时，按跨 section 的顶层逻辑顺序，依次尝试后一个可用顶层链接 / 分组按钮、前一个可用顶层项、收窄按钮和 root。两种形态重排但 key 仍存在时都保持在同一 key，不按旧索引跳转；仅在焦点确实会丢失时执行恢复。
- 收窄态普通、未取消的同上下文叶子导航意图会关闭 flyout，但不把焦点强制送回触发器；修饰键、新窗口、下载和被取消的点击保持 flyout 打开。任何随后提交的 `currentKey` 变化（包括 Router 导航、浏览器前进 / 后退）也会关闭 flyout。关闭后的下一帧若焦点仍落在已移除内容或 `body`，且应用没有把焦点移动到主标题等目的地，SideNav 才把焦点回退到可编程聚焦的 root，不覆盖应用自己的路由焦点管理。
- `collapsible={false}` 只隐藏内置收窄按钮；应用仍可通过受控 `collapsed` 配合自己的布局控制。受控状态被父级拒绝时，`aria-expanded`、宽度与 flyout 均继续服从实际 props。

## 5. DOM 与 ARIA

```html
<nav data-part="root" aria-label="主导航" data-collapsed="false">
  <div id="sidenav-viewport" data-part="viewport">
    <div data-part="section" role="group" aria-labelledby="section-workspace">
      <div id="section-workspace" data-part="section-label">工作区</div>
      <ul data-part="list">
        <li data-part="item">
          <a data-part="link" data-key="dashboard" href="/dashboard">
            <span data-part="icon" aria-hidden="true"></span>
            <span data-part="label">概览</span>
            <span data-part="badge">3</span>
          </a>
        </li>
        <li data-part="item" data-expanded="true" data-current-descendant="true">
          <button
            type="button"
            data-part="group-toggle"
            aria-expanded="true"
            aria-controls="sidenav-group-settings"
          >
            <span data-part="label">设置</span>
            <span data-part="group-indicator" aria-hidden="true"></span>
          </button>
          <ul id="sidenav-group-settings" data-part="children">
            <li data-part="item" data-current="true">
              <a data-part="link" data-key="profile" href="/settings/profile" aria-current="page">
                资料
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
  <button
    type="button"
    data-part="collapse-toggle"
    aria-label="收窄导航"
    aria-expanded="true"
    aria-controls="sidenav-viewport"
  ></button>
</nav>
```

规则：

- 根节点使用真实 `<nav>`；命名优先级为显式 `aria-labelledby`、显式 `aria-label`、locale 的通用“导航”文案，命中前一项时不再输出后一项。root 默认 `tabIndex={-1}` 只作为最终焦点回退，不进入正常 Tab 顺序。
- 叶子链接的名称优先级为 `linkProps['aria-labelledby']`、`linkProps['aria-label']`、`textValue`、`label` 的 DOM 文本；分组按钮为 `textValue`、`label` 的 DOM 文本。复杂 label 必须提供 `textValue`。宽态与收窄态使用同一名称来源，隐藏文字和视觉提示不得改变或重复名称。
- 当前叶子链接使用 `aria-current="page"`；父分组仅用 `data-current-descendant` 表达视觉关联，不冒充当前页。
- 分组按钮使用 `aria-expanded` 与 `aria-controls`；展开列表为普通嵌套 `<ul>`，不添加 `role="tree"` 或 `role="menu"`。宽态的 `aria-expanded` 由实际 `expandedKeys` 驱动并控制内联 children list；收窄态改由 `openFlyoutKey` 驱动并控制 Portal flyout，关闭且浮层未挂载时移除 `aria-controls`，不得继续指向不存在的节点。同一组的 children list 在宽导航与 Portal flyout 间只能存在一份，两种形态使用各自稳定且不重复的 ID。
- section 使用 `role="group"` 与普通文本标签关联，不硬编码 `h2`，避免破坏宿主页面标题层级；无 label 的 section 不添加 `role="group"`、`aria-labelledby` 或空标签。
- 图标是装饰时 `aria-hidden="true"`；徽标默认并入链接可访问名称，纯视觉徽标由调用方显式 `aria-hidden`。
- disabled 叶子使用带 `data-part="link"` 的 `<span aria-disabled="true">`；显式 disabled 或没有可用子链接的 group 使用 `<button disabled>`。它们均不进入 Tab 顺序，且不可打开 flyout。
- 收窄按钮始终以稳定的 viewport id 设置 `aria-controls`，并用实际 `collapsed` 驱动 `aria-expanded={!collapsed}`；名称随状态在 locale 的“收窄导航”与“展开导航”之间切换。受控状态被父级拒绝时，三者都继续反映实际 props，而不是点击意图。
- 收窄态仍保留 label 作为链接或按钮的可访问名称。首版由 SideNav 内部实现 `aria-hidden="true"`、`pointer-events: none` 的纯视觉提示层，不复用当前 `Tooltip` 的默认播报行为，也不新增公共 Tooltip API；同一 `textValue` 不追加到 `aria-describedby`。提示层在键盘 focus 或鼠标 hover 时显示，在 blur、pointerleave、Escape、打开分组 flyout 或退出收窄态时关闭；触摸 / 笔点击不产生持续提示，避免遮挡导航目标。

## 6. 键盘与焦点

- 链接、分组按钮和收窄按钮按原生 Tab 顺序访问；调用方不能用 `linkProps.tabIndex` 改写顺序。不拦截方向键、Home/End 或字符键。
- 分组按钮用 Enter / Space 切换，焦点留在按钮。
- 宽导航收起某分组时，若焦点位于其子链接，先把焦点移回分组按钮再隐藏子列表。
- 切换到收窄态时，若当前焦点将被隐藏，焦点移动到对应顶层链接、分组按钮或收窄按钮。
- 收窄态顶层叶子链接由不重复播报的视觉提示层显示完整 `textValue`；顶层分组按钮点击或 Enter / Space 打开 `FloatingPanel` 子导航。
- 键盘打开 flyout 时聚焦首个可用子链接；指针打开时保留触发器焦点。由于 flyout 经 Portal 渲染，不能依赖 body 末尾的自然 Tab 顺序。逻辑顺序为“分组触发器 → 其可用子链接 → 后续可用顶层链接 / 分组按钮 → 收窄按钮 → 导航外下一可聚焦项”，顶层项按 sections 的视觉顺序跨分区衔接，跳过 disabled；Shift+Tab 按相反方向移动。触发器上的向前 Tab 进入首个可用子链接；触发器上的 Shift+Tab 先关闭浮层，再按原生顺序前往上一焦点项；首个子链接的 Shift+Tab 关闭并回到触发器；子链接内部的 Tab / Shift+Tab 沿列表顺序移动。最后一个子链接的向前 Tab 关闭并聚焦下一个可用顶层项，后面没有顶层项时聚焦收窄按钮，二者都不存在时才移动到 SideNav root 之后的下一可聚焦项，绝不能跳过仍存在的后续顶层项。退出 flyout 后按关闭状态下的原生导航顺序继续移动，不自动重新打开已关闭的分组。若后续顶层项、收窄按钮和导航外下一焦点项均不存在，则不阻止原生 Tab，并把浮层卸载延后到浏览器完成默认焦点移动之后，让焦点离开页面而不是循环回触发器。
- 叶子链接的 Enter 激活会产生原生 click，并遵守与指针主键点击相同的 `linkProps.onClick` 取消与 `onNavigate` 判定；Space 不被改造成链接激活键。
- Escape 关闭 flyout、阻止继续冒泡并回到分组按钮。指针外部点击关闭但不抢走新点击目标的焦点；选择链接或路由跳转时不做额外焦点归还。
- `collapsed` 外部变为 false、group 被禁用、全部子项变为 disabled、或动态数据删除打开项时，若焦点仍在 flyout，优先回到仍可聚焦的原分组按钮。收窄态触发器已删除或不可聚焦时，先按顶层逻辑顺序尝试后一个、前一个可用顶层项，再回到收窄按钮和可编程聚焦的 root；恢复宽态时若原分组按钮不可聚焦，则依次尝试收窄按钮和 root。仅在焦点确实会丢失时执行恢复。
- 链接导航和 `currentKey` 变化导致的关闭使用上一节的“应用目的地优先、root 最终回退”规则，不归还分组触发器；Escape 与外部收窄优先归还仍可聚焦的触发器，收窄态数据失效按前述顶层后项 / 前项 / 收窄按钮 / root 链路恢复。
- flyout 仍是导航链接列表，不使用 menu 的方向键模型。没有可用子链接的 group 从源头不可打开，因此不存在“打开后无首个焦点目标”的状态。

## 7. 桌面收窄与响应式边界

- 宽导航默认宽度 `--z-sidenav-width: 15rem`，收窄宽度 `--z-sidenav-collapsed-width: 3.5rem`。
- root 使用逻辑尺寸，宽态为 `inline-size: min(100%, var(--z-sidenav-width))`，收窄态为 `inline-size: min(100%, var(--z-sidenav-collapsed-width))`，不得把父容器或 320px 视口撑宽。
- `viewport` 承担纵向滚动并设置 `min-block-size: 0`；收窄按钮位于滚动区之外，长导航滚动时仍可操作。flyout 限制到可视区域内，使用 `max-block-size` + `overflow-y: auto`，并提供 `100dvh` 与 `100vh` 回退。
- 收窄态只显示顶层图标、徽标提示与收窄按钮；section label 和文字视觉隐藏但仍保留可访问名称。
- 可收窄实例的顶层项应提供 `icon`；缺失图标时开发环境警告，运行时显示稳定占位而不是截取 label 首字符。
- 320px 下 SideNav 本身可占满容器，但不自动变成 fixed、overlay 或 Drawer。推荐组合：

```tsx
<Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
  <Drawer.Content placement="left" size="min(20rem, 100vw)">
    <Drawer.Header>
      <Drawer.Title>主导航</Drawer.Title>
      <Drawer.Close />
    </Drawer.Header>
    <Drawer.Body>
      <SideNav
        aria-label="主导航"
        sections={sections}
        currentKey={routeKey}
        collapsed={false}
        collapsible={false}
      />
    </Drawer.Body>
  </Drawer.Content>
</Drawer>
```

- Drawer 必须通过 `Drawer.Title` 或显式 `aria-label` 获得可访问名称；SideNav 自己的 landmark 名称不能代替外层 dialog 名称。
- 文档站移动原型使用现有真实 `Drawer`，并固定 `collapsed={false}`、`collapsible={false}`，在 Drawer 内使用宽态内联 children。Portal flyout 与 Drawer 焦点约束的组合尚未验证前，移动 Drawer 不启用收窄 flyout；桌面收窄原型单独验证 Portal 与逻辑 Tab 顺序。
- 不使用 CSS 媒体查询偷偷改写 `collapsed`；布局断点由应用层决定。

RTL 规则：

- 内边距、子级缩进、当前页 2px 指示条、badge 对齐和折叠按钮布局全部使用逻辑属性；指示条位于 `inline-start`。
- flyout 和视觉提示默认出现在 `inline-end`。实现从 root 的实际 `dir` / computed direction 映射到 `FloatingPanel` 的物理 `left | right`，LTR 向右、RTL 向左；不得只读取全局 document direction。
- 展开指示与收窄/展开图标按实际方向镜像。SideNav 不接管方向键，因此无需在 RTL 中反转导航按键。

## 8. Locale

`ZuiLocale` 实现阶段新增：

```ts
sideNav: {
  navigation: string;
  collapse: string;
  expand: string;
  expandGroup: string; // 支持 {label}
  collapseGroup: string; // 支持 {label}
}
```

十套语言包和 `mergeLocale()` 必须同步。显式根 `aria-labelledby` 优先于 `aria-label`，两者均未提供时才回退到 `navigation`。

## 9. 视觉规范与定制出口

视觉原则：

- 当前页用轻量语义底色、主色文字和 `inline-start` 方向的 2px 指示，不使用高饱和整块填充。
- hover、active、focus、current 四态分离；`:focus-visible` 焦点环不能被 active 背景吞掉。
- 二级链接用逻辑方向的层级缩进表达关系，长文案单行省略；完整文本仍在 DOM 中可得，收窄态视觉提示不重复进入无障碍描述。
- badge 靠右，不挤压图标；数值变化不得造成导航宽度跳动。
- 暗色只消费语义 token；forced-colors 下当前页、分组展开和焦点仍可辨认。
- 宽度过渡遵守 reduced-motion；flyout 使用 `FloatingPanel` 的视口翻转与主题继承。

稳定 parts：

```text
root
viewport
section
section-label
list
item
link
group-toggle
group-indicator
icon
label
badge
children
flyout
tooltip
collapse-toggle
```

首版 CSS 变量：

```css
--z-sidenav-width
--z-sidenav-collapsed-width
--z-sidenav-padding
--z-sidenav-gap
--z-sidenav-item-height
--z-sidenav-item-padding-x
--z-sidenav-child-indent
--z-sidenav-radius
--z-sidenav-bg
--z-sidenav-fg
--z-sidenav-muted-fg
--z-sidenav-hover-bg
--z-sidenav-active-bg
--z-sidenav-active-fg
--z-sidenav-indicator
--z-sidenav-focus-ring
--z-sidenav-flyout-width
--z-sidenav-flyout-max-height
--z-sidenav-animation-duration
```

## 10. 测试矩阵

组件测试：

- 分区、叶子、分组、图标、徽标、长文案，以及空 section / group / href 警告和安全忽略。
- `currentKey` 受控语义；expanded / collapsed 的受控、非受控与父级拒绝更新。
- 无配置时可收窄、初始宽态、非受控展开数组为空且同步合并当前父组；显式 default 值与受控 props 的优先级符合统一默认值契约。
- SSR 首屏把当前子链接父组合入非受控初值且不回调；后续 current 变化只报告一次，受控拒绝不循环。
- 受控 expanded 在“挂载即有 current”“current 后到”“current 先到而 sections 后解析”“同 key 换父组”“过滤后重现”五种路径中各按解析周期只报告一次展开意图；同一周期父级拒绝时不循环。
- 当前项初次解析、变化、异步解析与父组随后展开时，只在超出 viewport 时按 nearest 调整内部滚动；收窄态检查顶层项，受控父组拒绝展开时检查父按钮，不打开 flyout、不移动焦点、不滚动页面，普通重渲染不把用户手动滚动拉回当前项。
- 收窄再恢复时 expanded 状态不丢失；sections 删除、重排、禁用时清理非受控状态并关闭失效 flyout。
- 普通 href、被 `linkProps.onClick` 取消、修饰键、非主键、`target`、`download` 与 `rel`；只有符合条件的同上下文导航调用 `onNavigate`。
- `renderLink` 完整转发并合并 `ref`、ARIA、class、事件与 data 属性；React Router / Next 示例纳入类型检查或消费者夹具。
- 点击 handler 顺序与次数：`linkProps.onClick`、SideNav `onNavigate`、Router 内部导航各执行一次；前置取消阻止 `onNavigate`，Router 最后为客户端跳转调用 preventDefault 不吞掉有效导航意图。修饰键、新窗口、下载和非主键保留原生路径。
- label / icon / badge 含交互或可聚焦后代时开发环境警告；叶子与分组名称按规定优先级解析，宽态和收窄态保持一致。
- disabled 叶子与 group 不可聚焦、不可导航、无 href / flyout；current 或 expanded 指向无效目标时安全忽略。
- 全部子项 disabled 的 group 按有效禁用处理；动态变为全 disabled 时关闭 flyout，并走禁用触发器不可聚焦时的顶层后项 / 前项 / 收窄按钮 / root 回退链。
- 收窄 flyout 的键盘/指针打开差异、外部关闭、Escape、触发器 Tab / Shift+Tab、子项双向 Tab、首项 Shift+Tab、末项 Tab，以及焦点归还与不应归还的路径。末项向前必须先到后续可用顶层项（含跨 section 和跳过 disabled）、再到收窄按钮，最后才到导航外；覆盖无收窄按钮、无下一页面焦点及逆向移动，不跳过后续导航项。
- 普通同上下文链接关闭 flyout；修饰键、新窗口、下载和取消点击保持打开；`currentKey`、前进 / 后退变化关闭，且应用路由焦点优先、root 仅作下一帧最终回退。
- 从即将隐藏的子链接收起分组或整个导航时正确恢复焦点。
- flyout 触发器或当前聚焦项被动态删除时使用规定的焦点回退链；宽态重排保留同 key 焦点，删除后按后项 / 前项 / 父组 / 收窄按钮 / root 回退；收窄态顶层项删除、禁用或分组变为有效禁用时按跨 section 的顶层后项 / 前项 / 收窄按钮 / root 回退，重排仍保持同 key。
- 视觉提示的 hover / focus / Escape / touch 行为正确，且不向已有名称重复追加 `aria-describedby`。
- duplicate key、复杂 label 缺 textValue、可收窄项缺 icon，以及 current / expanded 指向错误条目类型的开发警告；动态未知 key 不报警。
- expanded 输入去重且回调按 sections 视觉顺序稳定输出；收窄按钮的名称、`aria-expanded` 与稳定 `aria-controls` 始终同步实际状态。

公共测试：

- axe：宽导航、收窄态、打开 flyout、当前页、disabled，以及带可访问名称的 Drawer 组合。
- roles/labels：`nav/list/listitem/link/button`、aria-current、expanded/controls、可访问名。
- keyboard：Tab 顺序、Enter/Space disclosure、Portal flyout 子链接与后续顶层项 / 收窄按钮 / 导航外之间的双向 Tab 衔接、Escape。
- SSR：无 window/document 访问，初始 current 父组展开结果稳定，Portal 仅在客户端挂载，hydration 无结构差异。
- RTL：逻辑缩进与指示、左右 flyout / 提示、图标镜像和焦点路径。
- 320px / 暗色 / forced-colors / reduced-motion / 200% zoom、超长导航滚动和低高度 flyout 视觉检查。

## 11. 文件与发布边界

实现文件：

```text
packages/ui/src/components/SideNav/
  SideNav.tsx
  SideNav.css
  SideNav.test.tsx
  index.ts
  meta.json
docs/src/pages/components/SideNavPage.tsx
```

同步范围：根导出、`./side-nav` 子路径、locale 十套语言包、Registry、CLI/MCP 示例、llms.txt、a11y/SSR/E2E、changeset。

正式组件编码前已先完成两个不对外导出的迁移原型。两者共享当时位于 `docs/src/prototypes/sidenav/` 的私有 SideNav 实现和样式，没有各自复制导航组件；原型阶段未创建 package 公开导出、子路径导出、Registry 条目、meta、CLI/MCP 示例或 changeset。评审通过后，私有实现已收敛到上面的正式实现文件并删除，相关同步范围随公共组件一并补齐。

1. 文档站侧栏：搜索框、移动 Drawer、路由后标题聚焦仍由文档应用负责；共享 SideNav 替换分区、当前页和链接列表。验证 hash route、过滤后动态 sections、当前项被过滤、320px 真实 Drawer、路由后主标题聚焦和桌面长列表内部滚动。移动 Drawer 固定使用宽态 SideNav，不启用 Portal flyout。
2. 真实路由型 `AdminShell`：至少包含两个分组和两个页面层级，使用 React Router 或等价测试路由从 location 推导 `currentKey`，并通过 `renderLink` 转发 ref 与内部 props，验证点击顺序和取消处理。由此原型证明分组展开、受控 / 非受控 expanded、桌面 collapsed、Portal flyout、逻辑 Tab 顺序与动态焦点恢复，桌面断点由 shell 控制 collapsed；移动端可按上述宽态 Drawer 组合。

`SettingsBlock` 不作为迁移证明：其按钮是在同页切换本地表单面板，不是可定位页面链接，应继续使用 Tabs / 按钮，或由业务先改成真实子路由后再考虑 SideNav。

原型通过条件（均已满足）：

- 不给 SideNav 增加搜索、Router、Drawer、权限或本地面板动作 API。
- 两个原型共同证明替换能力和重复代码删除：文档站删除重复的分区、链接列表和当前页渲染，保留搜索、路由标题聚焦与 Drawer 编排；AdminShell 删除重复的分组展开、桌面收窄、flyout 与导航内部焦点处理。无需让文档站人为新增原本没有的分组或收窄交互来证明删除；两个原型必须实际调用同一份私有实现。
- Router 导航、修饰键、新窗口、返回/前进和直接深链后 `aria-current` 均与实际 location 一致。
- 验证统一默认值、handler 各执行一次且 Router preventDefault 不误判取消；当前项可见性只调整内部 viewport，不抢主标题焦点或滚动页面。
- AdminShell 的桌面收窄证明“触发器 → 子链接 → 后续顶层项 → 收窄按钮 → 导航外”的 Tab 衔接和删除后后项 / 前项焦点回退；文档站的移动 Drawer 证明真实 dialog 命名、焦点约束和始终宽态，暂不验收 Drawer 与收窄 Portal flyout 的混用。
- 两个原型合计覆盖桌面收窄、移动 Drawer、RTL、长文案和动态过滤，并通过对应的键盘、axe 与视觉复核。

验收结果（2026-11-09）：

- 文档站侧栏与真实路由型 AdminShell 均完成迁移，并在正式化后继续使用公共 `SideNav`。
- `e2e/sidenav-prototype.spec.ts` 8 条用例全绿，覆盖宽态语义与 axe、收窄 flyout 双向 Tab / Escape、链接取消与 handler 顺序、动态删除焦点恢复、RTL、320px Drawer、文档过滤与 current，以及隐藏原型不进入公开导航。
- 公共实现已同步根导出、`./side-nav` 子路径、locale、Registry、CLI/MCP、文档、llms、a11y/SSR 与 changeset；发布仍随下一版本统一进行，不回写 v0.2.0 基线。
