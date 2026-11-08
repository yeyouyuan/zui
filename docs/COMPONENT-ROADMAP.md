# ZUI 后续组件路线图

状态：2026-11-09 实施后复核。Combobox、MultiCombobox、SideNav、Splitter、CommandPalette 均已实现并进入 Registry（71 个组件 + 16 个业务块，共 87 个条目），随下一版本发布。DataGrid 立项前置已完成：性能原型实测达标（排序 23ms / 全选 10.9ms / 列宽最差帧 49.7ms，10k 行），独立大型 RFC 已起草（rfcs/datagrid.md），待评审后分期实现。

## 现状与判断标准

ZUI v0.2.0 已有 66 个 UI 组件，基础表单、日期、浮层、反馈和常见数据展示已经完整。后续组件不再按“别的组件库有就补”的方式扩张，而按以下标准进入路线图：

1. 在两个以上业务页面中存在稳定复用需求。
2. 不能用现有组件少量组合获得同等语义、键盘体验和状态管理。
3. 能复用 ZUI 的令牌、`FloatingPanel`、`useControllableState`、Portal、locale 与 Registry 基础设施。
4. 有明确的 WAI-ARIA 模式或原生语义，自动化与人工验收边界可以定义。
5. API 能在首版保持克制，不用大量布尔参数预埋未来能力。

## 优先级

| 顺序 | 候选             | 解决的问题                                                                         | 首版范围                                                      | 结论                   |
| ---- | ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| 1    | `Combobox`       | `Select` 只能选择，缺少可编辑搜索、异步结果和严格选项型自动完成                    | 单选、输入过滤、外部异步 options、严格选项、完整 IME/键盘支持 | 已实现，待下一版本     |
| 1.5  | `MultiCombobox`  | 同构 options 的多选场景（标签、负责人、批量实体）                                  | RFC-001 §16 边界：toggle 多选、标签删除、异步通道同构         | 已实现，待下一版本     |
| 2    | `SideNav`        | 文档站与路由型后台壳重复手写持久侧栏、分组、展开与当前位置                         | 语义化 `nav/list/link`、分组、层级、折叠、路由适配            | 已正式实现，待下一版本 |
| 3    | `Splitter`       | Row/Col/Flex 只能静态布局，无法支持主从详情、编辑器和仪表盘可调分栏                | 水平/垂直、受控尺寸、min/max、折叠、键盘 separator            | 已正式实现，待下一版本 |
| 4    | `DataGrid`       | `Table` 与 `VirtualTable` 缺少交互式列宽调整、排序、筛选、选择和完整 grid 键盘模型 | 先做能力拆分与性能原型，不直接实现                            | RFC 已起草（含实测），待评审   |
| 5    | `CommandPalette` | 文档和后台缺少全局命令搜索                                                         | 复用未来的 `Combobox` + `Modal`，支持分组命令与快捷键         | 已正式实现，待下一版本 |

## 为什么先做 Combobox

- `Select` 当前是 select-only combobox，只支持静态 `options` 和单一选中值；不能把输入文本与提交值分开管理。
- `Mentions` 解决的是文本中的建议插入，不适合“搜索后选择一个实体”的表单语义。
- 用户、客户、商品、城市、远程字典等后台字段都需要同一种可编辑单选模式。
- 主流组件系统均把 Autocomplete/Combobox 作为独立能力，而不是把全部行为继续塞进 Select。

详细方案见 [Combobox RFC](./rfcs/combobox.md)。

## SideNav 设计边界

详细首版方案见 [SideNav RFC](./rfcs/sidenav.md)。

**评审与正式化（2026-11-09）**：RFC §11 要求的两个迁移原型已完成并通过评审——评审证据为 `e2e/sidenav-prototype.spec.ts` 的 8 条自动化用例（宽态语义、收窄 flyout 键盘 Tab 链、链接取消组合、动态项焦点回退、RTL、320px Drawer、文档外壳过滤与 axe）。正式实现落在 `packages/ui/src/components/SideNav/`，文档站侧栏与后台壳原型页均已切换到公共导出，原型私有实现已删除。

`SideNav` 面向站点和后台导航，不使用动作菜单的 `role="menu"` 模式：

- 根结构优先为 `<nav><ul><li><a>`，当前页用 `aria-current="page"`。
- 支持受控 `currentKey`、`expandedKeys`、分组、图标、徽标、折叠和 `renderLink`。
- 路由跳转由链接或调用方路由组件负责，ZUI 不绑定具体 Router。
- 桌面折叠与移动端抽屉是不同布局职责；首版只提供导航本体，不内置 Drawer。
- `DropdownMenu` 继续负责按钮触发的动作菜单，两者不合并。
- 正式化前已用文档站侧栏与真实路由型 `AdminShell` 完成双迁移原型并通过 8 条 E2E；同页按钮切换的 `SettingsBlock` 不作为导航组件成立的证据。

## Splitter 设计边界

详细首版方案见 [Splitter RFC](./rfcs/splitter.md)。

**评审与正式化（2026-11-09）**：RFC §11 的 IDE 三栏壳与主从详情两个隐藏迁移原型已完成，浏览器证据收敛在 `e2e/splitter-prototype.spec.ts`。正式 API 只公开 `Splitter` 与 `Splitter.Panel`；相邻 Handle 自动生成，避免调用方数量与 Panel 轨道失配。

- `orientation="horizontal | vertical"`。
- `sizes/defaultSizes/onSizesChange/onResizeEnd`，结束详情区分实际尺寸、请求尺寸与取消边界。
- Panel 提供 `minSize/maxSize/collapsible/collapsedSize`。
- `handleProps(context)` 定制自动 Handle 的名称、原生事件、disabled 与明确 `collapseTarget`。
- Handle 使用具名 `role="separator"`，`aria-controls` 同时关联两侧稳定 Panel id，并暴露成对有效的 `aria-valuemin/max/now`。
- Pointer Capture 处理拖动；pointerup 提交，Escape / pointercancel / 意外 lostcapture 恢复快照；键盘在 keyup / blur 提交。
- Panel 百分比只分配 `容器主轴 - 固定 Handle 轨道`；ResizeObserver 跟随容器恢复，320px 下不产生文档横向溢出。
- 折叠内容保持挂载，但同步 `inert + aria-hidden`；折叠前位于内容内的焦点回退到相关 Handle。

## DataGrid 立项前置条件

DataGrid 价值高，但不能把功能继续堆入 `Table`：

1. 先明确与 `Table`、`VirtualTable` 的职责和兼容策略。
2. 先验证 10,000 行下排序、选择、列调整和固定列的性能预算。
3. 先确定 `role="grid"` 键盘模型、编辑单元格和焦点恢复。
4. 泛型列定义、受控状态和服务端排序/筛选必须同时设计。
5. 首版不承诺 Excel 式全功能编辑器。

## 暂不独立立项

- `ContextMenu`：优先评估在 `DropdownMenu` 上增加右键触发和坐标锚点，而不是复制菜单实现。
- `DateTimePicker` / `TimeRangePicker`：先验证 DatePicker 与 TimePicker 的组合方案。
- `Textarea`、`Input.Search`、`Input.Password`、`AvatarGroup`、`PageHeader`、`Toolbar`：优先作为现有组件子 API 或组合示例。
- `Carousel`：更偏营销展示，不是当前企业后台核心缺口。
- 富文本编辑器和图表：依赖与维护面过大，不进入基础 UI 包。

## 新组件统一 Definition of Done

- 源码、CSS、测试、`index.ts`、`meta.json`、根导出完整。
- 受控/非受控状态、原生 props/ref、`classNames`、`data-part` 与组件级 CSS 变量完整。
- locale 十套语言包同步；显式 prop 能覆盖内置文案。
- 角色、键盘、可访问名、axe、SSR、Form 与嵌套浮层测试完整。
- 文档页覆盖桌面/320px、浅色/暗色、加载/空态/错误态和 reduced-motion。
- Registry、CLI、MCP、消费者检查、E2E 与发布清单同步。

## 外部设计基准

- [WAI-ARIA APG Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Material UI Autocomplete](https://mui.com/material-ui/react-autocomplete/)
- [Ant Design Splitter](https://ant.design/components/splitter/)
- [MUI X Data Grid](https://mui.com/x/react-data-grid/)
