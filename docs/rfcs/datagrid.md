# RFC-005：DataGrid 交互式数据表格

状态：2026-11-09 设计稿（含性能原型实测数据）。性能前置条件已验证（第 8 节），本 RFC 评审通过后进入分期实现；实现不改动现有 `Table` / `VirtualTable`。

## 1. 目标

`DataGrid` 面向需要**交互式**数据操作的后台场景：在虚拟滚动之上提供列排序、筛选、行选择、列宽调整、固定列和完整的 `role="grid"` 键盘模型。

首版（v1）必须做到：

- 泛型列定义 `GridColumn<T>`；数据、排序、选择、列宽均支持受控与非受控。
- 10,000 行下所有交互处于第 8 节的实测预算内（虚拟化窗口渲染）。
- `role="grid"` 语义与方向键网格导航、行选择、`aria-sort`、焦点恢复。
- 固定列（行选择列 + 至多两列业务列）在横向滚动时保持可见。
- 键牌、令牌、SSR、暗色、320px、RTL 与 reduced-motion 全链路可验证。

## 2. 非目标

- 首版不做单元格内编辑（v2 评估 Enter/F2 编辑入口）；不承诺 Excel 式编辑器。
- 不做列隐藏/重排的拖拽管线、列固定切换 UI、分组聚合行和树形表格（后续分期）。
- 不内置服务端请求编排：服务端模式只提供"状态受控 + 回调"的接口形态。
- 不替代导出/打印等业务能力。

## 3. 与 Table / VirtualTable 的职责边界

| 组件 | 定位 | 数据量 | 交互 |
| --- | --- | --- | --- |
| `Table` | 语义化静态表格（原生 table） | 小 | 无内置交互；排序/筛选由调用方在表头内自行实现 |
| `VirtualTable` | 虚拟滚动只读表格 | 大（10k+） | 无排序/选择/列宽 |
| `DataGrid`（新） | 交互式数据网格（div 网格，非 table 元素） | 大（10k+） | 排序、筛选、选择、列宽、固定列、grid 键盘模型 |

兼容策略：

- **不修改** `Table` 与 `VirtualTable`。DataGrid 是独立组件，不复用它们的 DOM。
- 虚拟化机制与 `VirtualTable` 同源（scrollTop + 固定行高 + overscan）；实现阶段评估把窗口计算抽成共享工具（放 `src/utils/`），`VirtualTable` 可后续迁移，不阻塞 DataGrid。
- 文档互相指引：需要交互升级的 `Table` 用户迁移到 DataGrid；`meta.json` 的 `related` 双向标注。

## 4. 能力矩阵与分期

| 能力 | v1 | v2+ |
| --- | --- | --- |
| 虚拟滚动渲染 | ✅ | — |
| 列排序（单列，点击表头 + `aria-sort`） | ✅ | 多列排序 |
| 行选择（复选 + 全选 + 半选 + 受控） | ✅ | 区间选择（Shift）、禁用行 |
| 客户端筛选（列头关键字/枚举） | ✅ | 自定义筛选面板 |
| 列宽拖动 | ✅ | 双击自适应 |
| 固定列（sticky，至多左 2 列） | ✅ | 左右固定 + 切换 UI |
| 服务端模式（受控排序/筛选 + on 请求回调 + loading） | ✅（接口形态） | 内置请求编排 |
| 单元格编辑 | ❌ | Enter/F2 入口 |
| 列隐藏/重排 | ❌ | ✅ |
| 分组聚合行 / 树形 | ❌ | ✅ |

## 5. 数据模型与 TypeScript API

```tsx
export interface DataGridColumn<T> {
  key: string;                    // 列标识；与 dataIndex 对应
  dataIndex?: keyof T;            // 取值字段；复合渲染用 render
  header: React.ReactNode;
  /** 复杂表头/单元格必须提供 textValue 供排序与可访问名 */
  textValue?: string;
  width?: number;                 // 初始宽度（px）；minWidth/maxWidth 夹紧
  minWidth?: number;              // 默认 60
  maxWidth?: number;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  filterable?: boolean;           // v1 仅枚举/关键字两种内置 UI
  filterValues?: Array<{ label: string; value: string }>; // 枚举筛选选项
  sticky?: boolean;               // v1 最多前两列生效，超出警告
  render?: (row: T, context: { rowIndex: number }) => React.ReactNode;
  headerRender?: (context: { sortState: 'asc' | 'desc' | null }) => React.ReactNode;
}

export interface DataGridSortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataGridProps<T extends object>
  extends Omit<React.ComponentPropsWithRef<'div'>, 'children' | 'onKeyDown'> {
  columns: ReadonlyArray<DataGridColumn<T>>;
  rows: readonly T[];
  /** 行唯一标识（id 字段名）；默认 'id' */
  rowKey?: keyof T & string;
  rowHeight?: number;             // 默认 40；虚拟化要求固定行高
  overscan?: number;              // 默认 6

  // 排序（客户端排序内置；服务端模式传受控值并接管 rows）
  sort?: DataGridSortState | null;
  defaultSort?: DataGridSortState | null;
  onSortChange?: (sort: DataGridSortState | null) => void;

  // 筛选（客户端内置；服务端模式受控）
  filters?: Record<string, string[]> | null;   // columnKey -> 选中值
  defaultFilters?: Record<string, string[]> | null;
  onFiltersChange?: (filters: Record<string, string[]> | null) => void;

  // 选择（受控/非受控；值为 rowKey 提取的字符串）
  selectedKeys?: readonly string[];
  defaultSelectedKeys?: readonly string[];
  onSelectedKeysChange?: (keys: string[], details: { reason: 'row' | 'all' }) => void;
  isRowSelectable?: (row: T) => boolean;

  // 列宽
  columnWidths?: Record<string, number>;
  defaultColumnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;

  // 服务端模式
  loading?: boolean;              // 覆盖排序/筛选时的数据区状态
  emptyContent?: React.ReactNode;
  loadingContent?: React.ReactNode;

  'aria-label'?: string;
  className?: string;
  classNames?: {
    root?: string; header?: string; headerRow?: string; headerCell?: string;
    viewport?: string; row?: string; cell?: string; stickyCell?: string;
    selectCell?: string; empty?: string; loading?: string;
    resizeHandle?: string; filterPanel?: string;
  };
}
```

API 约束：

- 受控语义与全库一致（值受控时不乐观更新；拒绝时不循环回调）。
- 客户端模式下排序/筛选/选择均在组件内完成；`rows` 变化时排序与筛选重新应用。
- 服务端模式：调用方传受控 `sort/filters` + 自行请求后更新 `rows`，组件置 `loading` 时数据区显示 loadingContent 且交互不被打断。
- `rowKey` 提取值必须是 string/number；重复或缺失开发环境警告并跳过该行选择登记。
- `sticky` 超过前两列时开发环境警告且只渲染前两列（原型实测的 sticky 叠加策略）。

## 6. DOM 与 ARIA

```html
<div role="grid" aria-label="…" aria-rowcount="10000" data-part="root">
  <div role="row" data-part="header-row">
    <div role="columnheader" aria-sort="ascending" aria-colindex="1">…</div>
  </div>
  <div data-part="viewport">           <!-- 滚动容器 -->
    <div style="height: 总高">          <!-- 撑起滚动高度 -->
      <div role="row" aria-rowindex="42" aria-selected="true" data-part="row">
        <div role="gridcell" aria-colindex="1">…</div>
      </div>
    </div>
  </div>
</div>
```

规则：

- root `role="grid"` + `aria-rowcount`（真实总行数，非窗口数）；行 `aria-rowindex` 用原始行号，虚拟化不破坏语义。
- 表头 `aria-sort="ascending | descending | none"`；可排序列表头是按钮语义（或含按钮），激活切换。
- 选中行 `aria-selected`；全选表头用 `aria-checked="true|mixed|false"` 的复选语义（role=checkbox 于 columnheader 内）。
- 筛选面板是表头内的 disclosure（按钮 + `aria-expanded` + Popup），非菜单模式。
- 列宽 handle 沿用 Splitter 的 focusable separator 模式（`role="separator"` + aria-valuenow=当前宽度）。
- 固定列实现为 sticky + 显式 `left` 偏移；横向滚动时由 e2e 断言可见性。
- 复杂单元格 render 的可访问名依赖 `textValue`（复杂 header 同理）。

## 7. 键盘模型

- 网格方向键：焦点在 gridcell 时 ↑↓←→ 移动到相邻可见单元格（跨行时保持列）；`aria-activedescendant` 模式（DOM 焦点保留在 root 或输入控件，实现 PR 定夺二选一并全量测试）。
- `Home/End`：行首/行尾单元格；`Ctrl+Home/End`：首行首格 / 末行末格（含虚拟滚动跳转，跳转后同步 scrollTop）。
- `PageDown/PageUp`：按可视行数翻页。
- `Space`：选中/取消当前行；表头聚焦时 Space/Enter 触发全选切换。
- `Enter`：激活当前列的排序（表头）或行主操作（v1 无编辑时仅表头生效）。
- 筛选面板内：原生控件语义 + Esc 关闭回表头按钮。
- 列宽 handle：方向键 ±16px（复用 Splitter 步进约定），Home/End 到 minWidth/maxWidth。
- 焦点恢复：排序/筛选/滚动导致窗口重排时，`aria-activedescendant` 指向的 key 保持在原单元格；该行滚出窗口后焦点回退到 root（实现 PR 给出回退链并测试）。
- IME：所有确认键在 composition 中不触发（与 Combobox 同一套三重兜底）。

## 8. 性能预算与实测（原型数据）

**原型**：`docs/src/prototypes/datagrid/`（一次性测量脚手架，仅直达路由 `/prototype/datagrid`，不进入组件库）。10,000 行 × 9 列，固定 40px 行高，overscan 6，两列 sticky，确定性数据。

**实测环境**：Playwright Chromium（本地 macOS，1280×800）；端到端延迟 = 点击到双 rAF 提交。测量用例：`e2e/datagrid-prototype.spec.ts`（常驻，防预算回退）。

| 指标 | 预算 | 实测 | 结论 |
| --- | --- | --- | --- |
| 虚拟化窗口 DOM | < 1200 节点（10k 全量会是数十万） | **24 行 / 300 节点** | ✅ |
| 排序（10k，端到端） | < 150ms | **23.0ms** | ✅ 余量 6.5× |
| 全选切换（10k Set 重建，端到端） | < 150ms | **10.9ms** | ✅ 余量 13.7× |
| 列宽拖动最差帧 | < 64ms（合成事件注入含开销） | **49.7ms** | ✅（真机指针事件按 rAF 对齐，实现阶段须复测并把目标收紧到 < 32ms） |
| 滚动到底部 | 窗口行数不增长 | 24 行恒定 | ✅ |

原型结论：**排序/选择瓶颈不在数据计算而在渲染调度**；列宽拖动是唯一贴近预算的路径，正式实现必须把宽度变化合并进单次 setState 并优先走 `grid-template-columns`（整表一次性重排，原型即此方案）。虚拟化、排序、选择的数据模型可以直接沿用。

## 9. Locale

```ts
dataGrid: {
  sortLabel: string;        // '排序'
  selectAll: string;        // '全选'
  selectRow: string;        // '选择 {label}'
  resizeColumn: string;     // '调整 {label} 列宽'
  filterLabel: string;      // '筛选'
  filterEmpty: string;      // '无匹配项'
  loading: string;          // '加载中'
}
```

十套语言包与 `mergeLocale()` 同步；`{label}` 用列 `textValue`。

## 10. 视觉规范与定制出口

稳定 parts：`root / header / header-row / header-cell / viewport / row / cell / sticky-cell / select-cell / resize-handle / filter-panel / empty / loading`。

首版 CSS 变量：

```css
--z-datagrid-row-height
--z-datagrid-header-bg
--z-datagrid-header-fg
--z-datagrid-row-hover-bg
--z-datagrid-row-selected-bg
--z-datagrid-sticky-shadow      /* 固定列右缘阴影 */
--z-datagrid-border
--z-datagrid-cell-padding-x
--z-datagrid-animation-duration
```

- 行 hover 与选中底色分离；选中优先级高于 hover。
- 固定列右缘用 1px 阴影表达层叠，不用实线。
- 行高固定（虚拟化前提）；单元格内容单行省略，完整文本可经 title/tooltip 获取（实现 PR 定）。
- 数字列右对齐（`align: 'end'`）+ tabular-nums。
- 320px：横向滚动是预期行为；固定列仍生效。暗色只消费语义 token；forced-colors 下选中与固定列边界可辨认。

## 11. 测试矩阵（要点）

组件测试：

- 列定义：泛型取值、render 覆盖、textValue 缺失警告、sticky 超限警告、重复 rowKey 警告。
- 虚拟化：窗口行数恒定、滚动更新行内容、`aria-rowindex` 为原始行号、ResizeObserver 视口变化。
- 排序：点击循环 asc→desc→（取消可选）、`aria-sort`、受控拒绝、服务端模式 loading。
- 筛选：枚举面板、`filters` 受控、与排序叠加、清空。
- 选择：单行/全选/半选（`aria-checked="mixed"`）、受控拒绝、`isRowSelectable`、keys 顺序稳定。
- 列宽：拖动/键盘、min/max 夹紧、受控、持久化回调。
- 固定列：横向滚动可见性（e2e 已有原型级断言，组件化后保留）。
- 键盘：第 7 节全矩阵 + 焦点恢复 + IME。

公共测试：axe（排序态/选中态/固定列）、roles/labels、SSR（首屏窗口稳定、无 window 访问）、320px/暗色/forced-colors/reduced-motion 视觉检查、E2E 性能预算防回退（原型 spec 迁移为组件 spec）。

## 12. 文件与发布边界

```text
packages/ui/src/components/DataGrid/
  DataGrid.tsx
  DataGrid.css
  DataGrid.test.tsx
  index.ts
  meta.json
docs/src/pages/components/DataGridPage.tsx
```

实现分期：v1.0 虚拟化 + 排序 + 选择；v1.1 列宽 + 固定列；v1.2 筛选 + 服务端模式接口；每期独立 changeset 与文档。键盘模型与焦点恢复在 v1.0 一并落地（grid 语义的底线）。

同步范围：根导出、`./data-grid` 子路径、locale 十套语言包、Registry、CLI/MCP 示例、llms.txt、a11y/SSR/E2E、changeset。

## 13. 外部设计基准

- [WAI-ARIA APG Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)（交互模型与 aria-rowcount/rowindex）
- [MUI X Data Grid](https://mui.com/x/react-data-grid/)（列定义与受控状态形态）
- [TanStack Table](https://tanstack.com/table)（headless 状态拆分参考；实现阶段评估复用其状态机还是自研，倾向自研以贴合令牌与受控契约）
- 仓库内原型：`docs/src/prototypes/datagrid/`（性能预算的来源与防回退基线）
