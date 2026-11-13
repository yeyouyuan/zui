# ZUI 后续组件路线图

状态：2026-11-09 实施后复核。Combobox、MultiCombobox、SideNav、Splitter、CommandPalette 均已实现并进入 Registry（71 个组件 + 16 个业务块，共 87 个条目），随下一版本发布。DataGrid 立项前置已完成：性能原型已复测（10k 行：排序 30.9ms / 全选 21.8ms / 列宽更新到下一帧 34.3ms；列宽测量已排除指针输入间隔），独立大型 RFC 已起草（rfcs/datagrid.md），待评审后分期实现。

2026-11-12 工作区补充：新增 `OfficeEditor` 与独立 `OfficeStudio`，当前 Registry 为 73 个组件和 16 个业务块，共 89 条目。新增编辑器尚未发布；上面的性能数值与首轮组件状态保留为 2026-11-09 记录。

## 现状与判断标准

### 新增设计探索（2026-11-09）

文档站新增“组件创意工坊”（`#/lab`），按四组实现 10 个可交互设计：MetricBoard、QueryBuilder、FileWorkbench、DiffViewer、TaskBoard、ApprovalFlow、ActivityInbox、AccessControl、SchedulePicker、StyleConfigurator。包含筛选、批量操作、状态流转、审批校验、角色权限与样式实时配置。它们仍是文档设计原型，不计入 71 个正式组件；候选契约、复用方向与实现边界见 [RFC-007](rfcs/ui-design-lab.md)。

优先验证文件工作台/版本对比与既有内容协作原型的组合；条件构建器验证受控规则和服务端查询契约；任务看板和指标卡优先作为业务块深化。其余候选在两个真实消费场景验证后再确定正式化次序。

ZUI v0.2.0 已有 66 个 UI 组件，基础表单、日期、浮层、反馈和常见数据展示已经完整。后续组件不再按“别的组件库有就补”的方式扩张，而按以下标准进入路线图：

1. 在两个以上业务页面中存在稳定复用需求。
2. 不能用现有组件少量组合获得同等语义、键盘体验和状态管理。
3. 能复用 ZUI 的令牌、`FloatingPanel`、`useControllableState`、Portal、locale 与 Registry 基础设施。
4. 有明确的 WAI-ARIA 模式或原生语义，自动化与人工验收边界可以定义。
5. API 能在首版保持克制，不用大量布尔参数预埋未来能力。

## 优先级

| 顺序 | 候选             | 解决的问题                                                                         | 首版范围                                                      | 结论                         |
| ---- | ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| 1    | `Combobox`       | `Select` 只能选择，缺少可编辑搜索、异步结果和严格选项型自动完成                    | 单选、输入过滤、外部异步 options、严格选项、完整 IME/键盘支持 | 已实现，待下一版本           |
| 1.5  | `MultiCombobox`  | 同构 options 的多选场景（标签、负责人、批量实体）                                  | RFC-001 §16 边界：toggle 多选、标签删除、异步通道同构         | 已实现，待下一版本           |
| 2    | `SideNav`        | 文档站与路由型后台壳重复手写持久侧栏、分组、展开与当前位置                         | 语义化 `nav/list/link`、分组、层级、折叠、路由适配            | 已正式实现，待下一版本       |
| 3    | `Splitter`       | Row/Col/Flex 只能静态布局，无法支持主从详情、编辑器和仪表盘可调分栏                | 水平/垂直、受控尺寸、min/max、折叠、键盘 separator            | 已正式实现，待下一版本       |
| 4    | `DataGrid`       | `Table` 与 `VirtualTable` 缺少交互式列宽调整、排序、筛选、选择和完整 grid 键盘模型 | 先做能力拆分与性能原型，不直接实现                            | RFC 已起草（含实测），待评审 |
| 5    | `CommandPalette` | 文档和后台缺少全局命令搜索                                                         | 复用未来的 `Combobox` + `Modal`，支持分组命令与快捷键         | 已正式实现，待下一版本       |

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

## 内容协作方向（2026-11-09）

下一组设计优先 FilePreview、ContentEditor、CommentThread，覆盖文件预览、纯文本编辑与上下文讨论。文档站 `#/collaboration` 已于 2026-11-10 补齐[可用的本地文件工作台](collaboration-local-2026-11-10.md)：真实文件导入、完整文本编辑、评论、IndexedDB 持久保存、下载与完整备份恢复。[RFC-006](rfcs/content-collaboration.md) 的通用组件 API、远端存储与权限契约仍为提案，未加入正式导出与 Registry，不增加 71 个源码组件的计数。

2026-11-12 工作台新增 [Word、Excel、PDF 页面内完整编辑器](office-full-editor.md)，使用本机部署的 ONLYOFFICE Docs 10.0：DOCX 正文与排版、XLSX 工作表与公式/图表、PDF 已有可识别文字直接在文档画布中编辑，桥接服务持久保存原格式结果并回写工作区。后续将原生画布提炼为公共 `OfficeEditor` 组件，加入 UI 导出与 Registry，并用于工作台和 `#/components/office-editor` 的组件示例；源码组件数为 72，本次尚未发布。部署、保存与恢复链路、Community 能力与商用授权边界在实施说明中列明。[首版浏览器实现](office-preview-2026-11-12.md)保留为旧草稿迁移与历史验证记录。

同日按用户选择新增并深化 [OfficeStudio 独立文档工作台](office-studio.md)：直接使用 ZUI 控件，Word 提供本地图片、默认页眉页脚、原生页码域、查找替换与大纲；Excel 提供公式、工作表与行列增删、合并拆分、冻结、筛选排序和原生柱状/折线图；PDF 提供缩略图、全文查找、文字/高亮/矩形/手写笔迹及普通表单。三种编辑器都支持撤销重做，示例提供真实文件导入导出、打印、本地恢复、最近 20 次历史版本及恢复为新文件。`#/components/office-studio` 无需 ONLYOFFICE 服务。

这些能力仍有明确格式边界：Word 不具备完整自动分页或多节版式兼容，Excel 拒绝透视和不支持的复杂对象，PDF 不提供任意原文修改与 OCR；PDF 查找依赖可提取文字和宿主 renderer。`OfficeStudio` 是公共 UI 组件，文件 codec、worker/字体、打印和历史版本存储由宿主适配。当前源码组件数为 73，新增组件尚未发布；本轮 Node 验证及浏览器验收边界见 [验证记录](office-verification-2026-11-12.md)。
