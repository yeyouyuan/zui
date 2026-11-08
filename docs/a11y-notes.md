# ZUI 无障碍（a11y）笔记

> 本文件由 a11y 测试组维护，是 ZUI 无障碍工作的「已知问题与规避」知识库：
> 承诺与实现策略、组件难度分级、读屏怪癖清单、自动化测试边界与人工实测清单。
> 契约依据：`CONTRACTS.md` §1（一票否决项）/ §2（逐组件 ARIA 要求）、`CONTRACTS-V2.md` §4（a11y 组交付物）。
> 配套测试：`packages/ui/src/test/a11y.roles.test.tsx`（角色/状态矩阵）、
> `a11y.keyboard.test.tsx`（键盘流抽样）、`a11y.labels.test.tsx`（可访问名覆盖）。

## 1. a11y 承诺与实现策略

**承诺（一票否决）**：键盘可达、`:focus-visible` 可见焦点、语义化 ARIA——任何一条不达标即视为
发布阻断缺陷，不允许「下个版本再修」（`CONTRACTS.md` §1）。

**APG 合规**：所有交互模式对齐 WAI-ARIA Authoring Practices Guide（APG），不做自创模式：

| 模式                          | 组件                      | APG 对应                                                                                                                                             |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| editable combobox             | Combobox                  | Listbox Popup（输入框保留焦点 + `aria-activedescendant`；输入草稿与 committed value 分离）                                                           |
| editable multiselect combobox | MultiCombobox             | Listbox Popup（`aria-multiselectable`；选中即 toggle + 清草稿 + 面板不关；空输入 Backspace 删标签）                                                  |
| select-only combobox          | Select                    | Listbox Popup（焦点保持触发器 + `aria-activedescendant` 虚拟活动项）                                                                                 |
| dialog                        | Modal                     | Dialog（`aria-modal` + 焦点陷阱 + 关闭归还焦点）                                                                                                     |
| tabs                          | Tabs                      | Tabs（roving tabindex + ←→/↑↓ + Home/End）                                                                                                           |
| switch / checkbox / radio     | Switch / Checkbox / Radio | 官方对应模式，优先原生元素                                                                                                                           |
| live region 通知              | Message                   | `role="status"` + `aria-live`（error 用 assertive）                                                                                                  |
| site navigation               | SideNav                   | 原生 `nav/ul/li/a` + `aria-current="page"`；分组为 disclosure 按钮；收窄态 flyout 走 Portal 逻辑 Tab 链                                              |
| focusable separator           | Splitter                  | 具名 `role="separator"` + 双 Panel `aria-controls`；方向键 / PageUp/Down / Home/End；Enter 只折叠明确目标，折叠内容 `inert + aria-hidden` 并安全回焦 |

**实现策略**：

1. **原生语义优先**：Button/Input/Checkbox/Radio/Switch/Table 全部基于原生元素，ARIA 只补强不覆盖
   （原生 `checked`/`disabled`/表格语义免费获得，读屏行为最稳）。
2. **关联不悬空**：复合组件的 `aria-controls`/`aria-labelledby`/`aria-describedby` 一律用 `useId`
   双向生成（Tabs 的 tab↔panel、Modal 的 dialog↔Title/Description），并有测试锁定。
3. **焦点管理集中化**：`useFocusTrap` 统一负责「打开聚焦（`[data-autofocus]` → 首个可聚焦 → 容器本体）、
   Tab/Shift+Tab 容器内循环、关闭归还触发元素」，初始聚焦刻意推迟到 `requestAnimationFrame`
   （原因见 §3.2）。
4. **状态用 ARIA 正确表达**：`aria-expanded`/`aria-selected`/`aria-checked`（含 `mixed`）/
   `aria-busy`/`aria-disabled` 与视觉状态同步，由 `a11y.roles.test.tsx` 矩阵断言兜底。
5. **键盘一票否决落地**：每个组件的键盘行为以契约 §2 清单为准，`a11y.keyboard.test.tsx` 以
   「按键 → 状态/焦点」整流方式锁定回归；Esc 的行为（关闭、回焦、不吞事件）单独覆盖。

## 2. 组件 a11y 难度分级表

分级依据：交互模式复杂度 × 需要人工实测的读屏风险面。
S = 高难度（组合模式 + 焦点管理 + 多读屏坑）；A = 中难度（复合组件或 live region 语义）；
B = 低难度（原生语义为主）。A 级以浮层/菜单类复合组件为主（DropdownMenu、Tooltip、Popover 等
新组件将落在此级）；下表覆盖基线组件与新增的高风险交互模式。

| 组件               | 等级  | a11y 关键点                                                                                             | 风险说明                                                                                                          |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Combobox           | **S** | 可编辑 input + listbox/option、`aria-activedescendant`、IME、严格值回退、clear 可 Tab                   | 组合输入期间误提交、input→clear 被误判真实 blur、异步结果令活动 id 悬空，以及 VoiceOver+Safari 虚拟活动项播报不稳 |
| Select             | **S** | `aria-haspopup="listbox"`/`aria-expanded`、listbox/option、`aria-activedescendant`、typeahead、Esc 回焦 | aria-activedescendant 在 VoiceOver+Safari 播报不稳（§3.1）；disabled option「可导航不可选」易被实现吞掉           |
| Modal              | **S** | `role="dialog"`/`aria-modal="true"`/`aria-labelledby`、焦点陷阱、Esc 关闭+焦点归还、Portal              | Portal 破坏 DOM 兄弟关系（§3.3）；NVDA 开场吞朗读（§3.2）；焦点归还/Tab 陷阱漏一处即键盘困死                      |
| Tabs               | **A** | `tablist`/`tab`/`tabpanel`、roving tabindex、←→/↑↓ 环形移动、Home/End、`aria-controls` 双向             | manual 模式「移动焦点 ≠ 选中」易与 automatic 混淆；未激活 panel 卸载后 `aria-controls` 悬空是已知取舍             |
| Message            | **A** | `role="status"` + `aria-live`（error assertive）、可关闭按钮可访问名                                    | live region 双重播报、assertive 覆盖不生效（§3.4）；自动关闭消息播报时机不可控                                    |
| Button             | **B** | 原生 button、可访问名、loading 时 `aria-busy`/`aria-disabled` 且保留可聚焦                              | 纯图标按钮必须由调用方给 `aria-label`（组件无法猜测）                                                             |
| Input              | **B** | 原生 input、label 关联、清除按钮 `aria-label="清除"`                                                    | label 关联由调用方（`aria-label`/`<label>`）负责，组件不做隐式包裹                                                |
| Checkbox           | **B** | 原生 checkbox、`indeterminate` → `aria-checked="mixed"` + DOM `indeterminate`                           | mixed 态的视觉与朗读需一致；原生 `checked` 与 `aria-checked` 混用时只在 mixed 态显式声明                          |
| Radio / RadioGroup | **B** | `role="radiogroup"` + `aria-orientation`、原生 radio 分组                                               | 无 Group 时回退 `name` 分组，朗读「x of n」依赖调用方给 `name`                                                    |
| Switch             | **B** | `role="switch"` + `aria-checked`、Space/Enter 切换                                                      | label 在按钮内充当可访问名；无 label 时必须 `aria-label`                                                          |
| Table              | **B** | 纯语义 `<table>/<th scope="col">`                                                                       | `scope="col"` 由 Table.HeaderCell 强制；行内交互单元格需调用方自补语义                                            |

## 3. 读屏怪癖清单（已知问题与规避）

以下条目整理自业界实测经验（含 React Aria 团队公开的读屏行为分析），以 ZUI 视角重写为
「现象 → 影响 → ZUI 的规避」。这些是 jsdom 自动化测不出、必须人工实测的领域。

### 3.1 VoiceOver + Safari：`aria-activedescendant` 播报不稳定

- **现象**：焦点保持在触发器、仅靠 `aria-activedescendant` 指示虚拟活动项的 combobox/listbox
  模式下，VoiceOver+Safari 对活动项移动的播报时灵时不灵——朗读游标不跟随虚拟活动项、
  只读出首个选项后不再更新，或与 Chrome 下的行为不一致。
- **影响**：Select 或 Combobox 打开后按 ↑↓，VO 用户可能「静默移动」，不知道当前停在哪一项。
- **ZUI 的规避**：
  - Select 与 Combobox 坚持 APG 标准实现（`aria-activedescendant` 是 combobox 规范做法，不因单平台缺陷降级成
    自创模式）；
  - 保证「最终状态一定可感知」：Select 选中后触发器文本更新；Combobox 的 committed 文本更新并保留
    input 焦点，Escape 恢复 committed 文本；两者的方向键都不改变真实焦点位置；
  - 该「VO + Safari + Select/Combobox」组合列为人工实测清单第一优先项（§4）；若实测确认持续不可用，
    再评估真实聚焦选项的兼容模式，不在单个平台上临时自创语义。

### 3.2 NVDA：打开即聚焦会吞掉开场朗读

- **现象**：Dialog 打开的同一瞬间立刻把焦点移进内容，NVDA 常把「对话框 + 标题」的初始播报吞掉或
  跳过，只读出最终被聚焦控件的名字，用户不知道自己进了什么弹窗。
- **影响**：Modal 打开后上下文丢失，标题/描述白写。
- **ZUI 的规避**：
  - `useFocusTrap` 把初始聚焦推迟到 `requestAnimationFrame`——先让 `role="dialog"` +
    `aria-labelledby`/`aria-describedby` 渲染完成、读屏建立虚拟缓冲，再移动焦点；
  - 标题一律经 `Modal.Title` 自动挂 `aria-labelledby`（无标题不产生悬空引用），保证 dialog
    本身「有名字可读」；
  - 若实测仍跳读，退化策略是把初始焦点落在 dialog 本体（`tabIndex={-1}`）让 NVDA 完整播报标题后
    再由用户 Tab 进内容。

### 3.3 Portal 破坏 DOM 兄弟关系，需要 ariaHideOutside 类规避

- **现象**：Modal/Message 经 Portal 挂到 `body`，视觉上盖住页面，但读屏的浏览模式（虚拟光标）
  仍可「下钻」到背景内容——DOM 上背景与弹层是兄弟，不在弹层子树内。
- **影响**：对 `aria-modal` 支持不完整的旧版读屏/盲文用户，可能读到并 Tab 到弹窗背后的内容。
- **ZUI 的规避**：
  - Modal 依赖 `aria-modal="true"`（主流 AT 会隔离背景）+ 焦点陷阱双保险，Tab 不逃出 dialog
    （`a11y.keyboard.test.tsx` 锁定）；
  - 社区标准兜底方案是 React Aria 式 `ariaHideOutside`（把弹层外一切 `aria-hidden` +
    `inert`）——ZUI 暂未内置，列为已知限制；后续若纳入将进 `src/utils`（集成者领地），
    对接点是 Modal/浮层组共用；
  - Message 是非模态提示，不做背景隔离（隔离反而会打断用户当前操作的朗读）。

### 3.4 Live region 双重播报

- **现象**：嵌套 live region（容器 + 条目都设 `aria-live`）或在 `role="status"` 上再叠一层显式
  `aria-live`，部分读屏会把同一条消息读两遍；另外 `role="status"` 隐含 `aria-live="polite"`，
  error 用 `aria-live="assertive"` 覆盖时，个别读屏/浏览器组合仍按 polite 播报。
- **影响**：提示重复朗读很吵；error 的紧急度可能丢失（用户不知道出错了）。
- **ZUI 的规避**：
  - `z-message-list` 容器本身**不是** live region，只有每条 `z-message` 是唯一播报节点
    （`role="status"` + `aria-live`），从结构上杜绝双重播报；
  - error 显式 `aria-live="assertive"`；该「status + assertive」组合在 NVDA/JAWS 的实际表现
    列入人工实测清单，若不达标备选方案是 error 改用 `role="alert"`（注意 alert 的播报时机更激进）；
  - 自动关闭（duration）只影响视觉存留，播报在插入瞬间完成，不与移除动作二次播报。

## 4. 自动化测试边界与人工实测清单

**jsdom 能测的**（`a11y.roles/keyboard/labels` 与 §5 axe 套件的职责边界）：DOM/ARIA 属性矩阵、
ARIA 关联 id 正确性、键盘事件流（按键 → 状态/焦点变化）、可访问名计算（`getByRole(..., { name })`
读屏视角）、axe 静态规则（结构/语义/命名）。

**jsdom 测不了的**（必须人工实测）：真实读屏的朗读内容/顺序/时机、焦点环可见性（视觉）、
触屏手势、系统级缩放/高对比（forced-colors）模式、双读屏并存等环境差异、**颜色对比度**。

**发布前人工实测清单**：

1. **VoiceOver + Safari**：Select / Combobox ↑↓ 是否播报活动项，Combobox 输入、清除与严格回退是否播报最终文本（§3.1 重点）；Modal 打开是否播报标题；
   Tab 陷阱是否可用；Message 是否被读出、读几遍。
2. **NVDA + Chrome/Firefox**：Combobox loading/results live status 是否只播报一次、IME 组合中 Enter 是否不提交；Modal 开场是否吞朗读（§3.2）；Message error 是否 assertive 播报、
   是否双重播报（§3.4）；Tabs 方向键移动时 tab 名 + 选中态是否播报。
3. **纯键盘**：全部组件 Tab 可达、`:focus-visible` 焦点环清晰可见、Esc 行为与契约一致
   （Select/Modal 关闭且焦点归还、Message 不吞 Esc）。
4. **高对比 / forced-colors**：焦点环、选中态（aria-selected/aria-checked 对应的视觉）仍可辨识。
5. **放大镜 / 缩放 200%**：Modal、Select 弹层不遮挡当前焦点项（active option 滚动跟随已自动化，
   视觉遮挡需人工确认）。

## 5. axe 集成（axe-core 自动化扫描）

> 契约依据：`CONTRACTS-V5.md` §4。配套测试：`packages/ui/src/test/a11y.axe.test.tsx`
> （devDep `axe-core@^4`，直接 `import axe from 'axe-core'`——axe-core 以 UMD 主入口
> 暴露 `axe.run`，vitest CJS interop 下可直接运行，无需 axe-playwright/jest-axe）。

**扫描矩阵**：每棵树独立 `axe.run(container)` 并断言 violations = 0——Button 全变体
（含 loading/disabled/纯图标）、Input+label（clearable/状态）、Select 关闭态（选中/占位/禁用）、
Combobox 关闭态（选中/占位/只读/禁用）与打开态 listbox/option 关联、
Checkbox（选中/未选/禁用/半选 mixed）、RadioGroup（选中/禁用项）、Switch（选中/禁用/无文字）、
Tabs（tablist/tab/tabpanel 含 disabled tab）、Table（scope 表头/选中行）、Alert 四态（含 closable）、
Empty、Card、Pagination（省略号/aria-current/跳页输入）、Badge（独立数字/圆点/包裹角标）。

**测试环境适配（均不是规则豁免）**：

- 容器带 `z-reset` class（box-sizing 依赖），内容包一层 `<main>`：axe 的 `region` 规则要求
  页面内容落在 landmark 内，测试宿主 div 不是语义容器，用 main 包裹让扫描树结构合法，
  从而 `region` 规则真实通过而非禁用。
- jsdom 未实现 `canvas.getContext`，axe 的 icon-ligature 文本检测需要 2d context；
  套件内提供确定性 stub（两次度量同宽 → 判非图标连字），同时消除 jsdom "Not implemented" 噪音。
  该补丁只作用于本套件的 jsdom 环境。

**显式禁用的规则（豁免清单）**：

| 规则             | 原因                                                                                     | 替代覆盖                                                         |
| ---------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `color-contrast` | jsdom 不做真实布局与绘制，拿不到最终前景/背景色，该规则在 jsdom 下只会产出大量不可靠结果 | 发布前人工实测（§4 清单第 4 项）+ 真实浏览器阶段（后续可入 E2E） |

**已知限制与 harness 自证**：

- axe 静态规则 ≠ 真实读屏：朗读顺序、时机、焦点环可见性仍按 §4 人工实测。
- 负向对照验证过 harness 有效性：`aria-label=""` 的按钮、缺 `alt` 的图片可被
  `button-name` / `image-alt` 规则捕获（保证矩阵不是「永远绿灯」的空转扫描）。
- 首轮全矩阵扫描 0 违规，未发现需要修复或按规则豁免的组件缺陷；
  后续新增组件请按 §2 归级时同步在矩阵中登记 axe 用例，发现违规优先修组件。

> 分级与怪癖清单会随组件扩充（DropdownMenu/Tooltip/Popover/Drawer 等）继续追加；
> 新增组件请按 §2 的分级标准归级，并把对应 AT 风险登记进 §3。
