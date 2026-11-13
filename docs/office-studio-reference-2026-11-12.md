# Office Studio 参考源码与 ZUI 映射（2026-11-12）

2026-11-13 已扩展为五个主要仓库的全量源码扫描与逐项台账，见 [源码梳理](onlyoffice-source-review-2026-11-13.md) 和 [196 项功能台账](onlyoffice-feature-ledger-2026-11-13.md)。这里仍记录原有实现范围，不能作为全部功能对齐证明。

本文记录本轮实际读取的 ONLYOFFICE 和 ranuts/document 源码，以及对应的自研界面与数据行为。参考内容用于核对标签、工具分组、控件尺度、画布和文件生命周期；交互入口沿用 ZUI 组件。

本次追加核对了本地 ZUI 应用的字体输入、手动行高和换行自动行高，修正了字号输入框过窄的问题；这属于功能与局部界面验收，不代表与 Office 逐像素一致。源码依据、截图和验证范围见 [验收记录](office-verification-2026-11-12.md)。

本轮继续读取 Spreadsheet `Search.js` 268–352 行、`cell/api.js` 4556–4590 行和 Spreadsheet `Toolbar.js` 840–900 行，补齐查找替换、列宽与边框行为。已实现项与仍缺的细节见 [功能对照表](office-function-comparison-2026-11-12.md)。

## 参考版本与阅读位置

本地阅读缓存为 `/tmp/zui-onlyoffice-reference-20261112/`。下表的 commit 已通过各仓库的 `git rev-parse HEAD` 核实；后文链接固定到同一版本。

| 仓库                                                          | commit                                                                                                                           | 本地子目录        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| [ONLYOFFICE/web-apps](https://github.com/ONLYOFFICE/web-apps) | [f79972a400c3a696490094961772d1f86fac1b82](https://github.com/ONLYOFFICE/web-apps/tree/f79972a400c3a696490094961772d1f86fac1b82) | `web-apps`        |
| [ONLYOFFICE/sdkjs](https://github.com/ONLYOFFICE/sdkjs)       | [9d2138866d929be32f1d107e8b5bfae36156e097](https://github.com/ONLYOFFICE/sdkjs/tree/9d2138866d929be32f1d107e8b5bfae36156e097)    | `sdkjs`           |
| [ranuts/document](https://github.com/ranuts/document)         | [d1c9b03263aabe14789297f5c717fefff2fe4f0d](https://github.com/ranuts/document/tree/d1c9b03263aabe14789297f5c717fefff2fe4f0d)     | `ranuts-document` |

| 实际阅读的源码                                                                                                                                                                                  | 核对内容                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `web-apps/apps/documenteditor/main/app/view/Toolbar.js`、`controller/Toolbar.js`                                                                                                                | File / Home / Insert / Layout / References 的顺序；controller 中的 Collaboration 与 View 入口。                                        |
| [Word `Toolbar.template` 第 39–92 行][oo-word-template]、`ToolbarView.template`、[Word `Viewport.template`][oo-word-viewport]                                                                   | 字体与段落的两行分组、样式图库、查找；标题、Ribbon、40px 左工具栏、中间编辑区和状态栏的层次。                                          |
| `web-apps/apps/documenteditor/main/resources/less/{toolbar,statusbar,variables}.less`；公共 `apps/common/main/resources/less/{header,toolbar,statusbar,variables}.less`                         | 分组、主题与尺度；[公共变量第 104–106 行][oo-common-variables]给出 28/32px 标签高度，[公共状态栏][oo-common-statusbar]给出 25px 高度。 |
| [Sheet `Toolbar.js` 第 890–915 行][oo-sheet-fonts]                                                                                                                                              | 17 档常见字号，以及随后字体 ComboBox 使用字体集合的方式。                                                                              |
| [Word controller 第 1470–1528 行][oo-word-size-input]、[Sheet controller 第 1880–1920 行][oo-sheet-size-input]                                                                                  | 可编辑字号输入：Word 的 1–300pt 与半磅归一化，Sheet 的 1–409pt 范围。                                                                  |
| [PDF `Toolbar.js`][oo-pdf-toolbar]、[PDF `Toolbar.template`][oo-pdf-template]                                                                                                                   | 开始标签、文本批注、高亮、撤销/重做；静态编辑组、分隔、大/小按钮以及页码、缩放、旋转分组。                                             |
| [PDF `LeftMenu.js`][oo-pdf-leftmenu]、`web-apps/apps/pdfeditor/main/resources/less/{toolbar,statusbar}.less`                                                                                    | 查找、批注、缩略图入口，以及页码、缩放和底部状态栏。                                                                                   |
| [sdkjs `WorkbookElems.js` 第 5635–5645 行][oo-font-setter]                                                                                                                                      | 显式设置字体名时先 `setName(val)`，再 `setScheme(null)`；字号使用独立 setter。                                                         |
| [sdkjs `lookupandreferenceFunctions.js` 第 1514–1560 行][oo-hyperlink-formula]、[sdkjs `logicalFunctions.js` 第 199–220 行][oo-if-formula]、[sdkjs `dateandtimeFunctions.js`][oo-date-formulas] | HYPERLINK 的显示值类型、错误与引用取值；IF 的布尔条件和所选分支；1900 日期序号与虚拟闰日。                                             |
| `sdkjs/cell/model/WorkbookElems.js` 第 6102–6163 行、`Workbook.js` 第 10726–10768、20844、22043、23100 行                                                                                       | 原生链接字段与克隆、重叠链接选择、合并、排序、填充；未解析目标的保留。                                                                 |
| `sdkjs/cell/api.js` 第 3551–3586 行、`cell/view/{WorkbookView,WorksheetView}.js`、`cell/utils/utils.js` 第 1565–1574 行                                                                         | 内部矩形链接跳转后以左上角作为活动单元格；外部链接打印行为另核对 `WorksheetView.js` 第 7100–7111 行。                                  |
| [ranuts `lib/onlyoffice-editor.ts`][ranuts-editor]、[ranuts `lib/document-open.ts`][ranuts-open]、[ranuts `lib/converter.ts`][ranuts-converter]                                                 | 编辑器创建/销毁、异步打开的文档归属、文件类型与转换入口。                                                                              |
| [ranuts `lib/active-document-source.ts`][ranuts-source]、[ranuts `lib/history/autosave.ts`][ranuts-autosave]、[ranuts `docs/design-system.md`][ranuts-design]                                   | 原文件与文档身份、恢复来源、历史快照与保存边界；应用壳和编辑器内部布局的区别。                                                         |

另外读取了 ranuts 仓库内的 [Word 示例截图][ranuts-word-image]与 [Excel 示例截图][ranuts-sheet-image]，用于对照紧凑的两行工具区、样式预览和画布。PDF 本轮参考来自源码，没有使用 PDF 参考截图。

## 公共布局到 ZUI 的映射

实现位置：[OfficeStudio.tsx](../packages/ui/src/components/OfficeStudio/OfficeStudio.tsx)、[OfficeStudio.css](../packages/ui/src/components/OfficeStudio/OfficeStudio.css)、[StudioRibbon.tsx](../packages/ui/src/components/OfficeStudio/StudioRibbon.tsx)、[StudioRibbon.css](../packages/ui/src/components/OfficeStudio/StudioRibbon.css)。

| 参考设计或操作                           | 当前实现                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 标题 → 标签 → 功能区 → 编辑画布 → 状态栏 | 三类编辑器共用标题栏；`StudioRibbonTabs` 通过 context 将 ZUI 文件菜单放在标签行左端。                                                                                                                      |
| 按文档类型区分主题                       | Word、Sheet、PDF 使用蓝、绿、红主题语义；`--z-office-studio-accent`、`--z-office-studio-header-bg`、`--z-office-studio-header-fg`、`--z-office-studio-ribbon-bg`、`--z-office-studio-canvas-bg` 统一配色。 |
| 紧凑标签、小按钮和状态栏                 | ZUI 标签行 32px，小按钮 24px、图标 16px、工具区字体 12px；Word、Sheet、PDF 底部状态栏均为单行 25px。控件尺度来自当前 ZUI 合同，尚未逐像素验收。                                                            |
| 文件、保存和打印入口                     | 使用 ZUI DropdownMenu、Button、Input；保留新建、导入、导出、保存、打印、全屏、名称编辑及保存状态。文件转换和持久化由宿主回调承担。                                                                         |
| 菜单、选项与弹窗                         | 工具操作使用 ZUI Tabs、Button、Select、Checkbox、ColorPicker、Modal 等现有组件；内容编辑和页面渲染由现有编辑内核承担。本轮未引入参考项目的 UI 组件库。                                                     |

## Word 映射

实现位置：[StudioWord.tsx](../packages/ui/src/components/OfficeStudio/StudioWord.tsx)、[StudioWord.css](../packages/ui/src/components/OfficeStudio/StudioWord.css)。文稿内容使用 Tiptap。

| 参考设计或操作     | 当前 ZUI 实现                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Office 标签组织    | 文件入口与开始、插入、布局、引用、审阅、视图标签；每个标签显示已有操作。官方 controller 中的 Collaboration 与本项目的审阅标签不代表完整协作/修订能力已实现。 |
| 字体两行工具       | 上行是可编辑的 ZUI 字体、字号 Combobox；下行是粗体、斜体、下划线、删除线、上下标、文字颜色和清除格式。颜色入口保留 ZUI ColorPicker，以 A 与色条作紧凑预览。  |
| 段落两行工具       | 列表、缩进、行距在上行；对齐在下行。段落操作同步到编辑模型，并沿用撤销/重做。                                                                                |
| 样式图库           | ZUI Button 显示正文、无间距、标题 1 预览；另保留完整的现有段落样式 Select。无间距实际设为行高 1、段前/段后 0，正文清除这些显式段落值。                       |
| 剪贴板与编辑       | ZUI 复制、剪切、粘贴、撤销/重做入口。工具栏剪贴板处理纯文本，多行转换成段落；异步剪切/粘贴会核对原文档身份和内容。剪贴板不可用时提示键盘快捷键。             |
| 插入与页面操作     | 保留已有表格、图片、链接、显式分页、页眉/页脚及页面设置入口；表格、查找替换和相关设置使用 ZUI 弹窗或侧栏。                                                   |
| 左导航、标尺与白纸 | 40px 左工具栏提供查找替换、大纲、字数统计；横纵厘米标尺随缩放显示。灰画布中保留白纸、黑色默认正文和细阴影，视图提供标尺/导航开关、100% 与适应宽度。          |
| 统计与状态         | ZUI 字数统计 Modal 展示正文 Unicode 字符数（含/不含空白）与段落数；切到页眉/页脚不改变正文统计对象。底部状态栏为 25px。                                      |

Word 字体菜单当前提供思源黑体（`Noto Sans SC`）、宋体（`SimSun`）、微软雅黑（`Microsoft YaHei`）、Arial、Times New Roman，并追加当前导入的字体名称。常见字号为 `10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48`，也保留当前导入字号选项；默认正文显示为思源黑体、12pt。

标尺目前提供预览，没有拖拽调整；文稿采用连续编辑和显式分页，尚未具备 Office 的完整自动分页。参考模板中的增减字号、修改大小写、文字高亮和完整协作/修订等功能未在本轮实现。

## Sheet 映射

实现位置：[StudioSheet.tsx](../packages/ui/src/components/OfficeStudio/StudioSheet.tsx)、[StudioSheet.css](../packages/ui/src/components/OfficeStudio/StudioSheet.css)、[studio-model.ts](../packages/ui/src/components/OfficeStudio/studio-model.ts)、[studio-sheet-hyperlinks.ts](../packages/ui/src/components/OfficeStudio/studio-sheet-hyperlinks.ts)、[studio-excel-codec.ts](src/pages/collaboration/office-studio/studio-excel-codec.ts)。

| 参考设计或操作           | 当前 ZUI 实现                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheet 功能区             | 文件入口与开始、插入、布局、公式、数据、视图标签；工具按编辑、字体、对齐、数字格式、单元格、规则与填充等分组。                                                                                                             |
| 字体与字号               | 字体组上行使用可编辑的 ZUI 字体和字号 Combobox，下行提供粗体、斜体、下划线、文字/填充颜色。没有显式字体属性的单元格默认显示 Calibri、11pt；选择同步整个选区。                                                              |
| 对齐与单元格格式         | 使用 ZUI 左对齐、居中、右对齐图标按钮，以及数字格式、换行、合并等现有入口。网格保留行列标题、名称框、公式栏、选区和工作表标签。                                                                                            |
| 条件格式、数据验证与填充 | ZUI 规则窗口、数据验证窗口及向下/向右/序列填充入口。规则参与显示和编辑反馈，并通过原生 XLSX 条件格式/数据验证 XML 保存；填充同步公式与直接格式，包括字体和字号。                                                           |
| 原生超链接               | ZUI 超链接窗口管理外部/内部目标、显示文字和提示；打开内部矩形目标时选中范围并激活左上格。增删、结构变化、排序、填充和粘贴沿用模型中的链接记录及迁移逻辑。                                                                  |
| HYPERLINK 与 IF 语义     | 参考 sdkjs 的显示值类型、错误传播、引用隐式交叉和 IF 布尔条件；修复引用 FALSE 时的分支行为。可靠的顶层 HYPERLINK 结果可形成临时链接记录，打开仍由目标解析器判断。                                                          |
| 原生 XLSX 保真           | 从 worksheet `<hyperlinks>` 及专用 `.rels` 读取链接，源文件/独立导出均同步记录和关系；带链接的数值、布尔、日期、公式及缓存保留真实类型。未知协议、文件路径和未解析内部目标仍保存为元数据，打开时由目标解析器决定是否可用。 |
| 旧模型恢复               | `hydrateStudioExcelHyperlinks(document, source)` 仅补齐缺少 `hyperlinks` 的工作表，按源工作表身份、结构记录和重命名迁移原链接；已有显式数组保持原意，`[]` 表示显式清除。                                                   |
| 日期与底部状态           | 1900 日期系统保留虚拟 `1900-02-29` 的序号 60；原始数值日期优先保留 XML 小数日精度。单行 25px 状态栏显示工作表与选区统计。                                                                                                  |

Sheet 当前常见字体是 Calibri、Arial、Aptos、Times New Roman、Courier New、思源黑体、宋体、微软雅黑、等线，并追加当前导入名称。[官方字号列表][oo-sheet-fonts]对应本轮的 `8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72, 96` 共 17 档；当前导入字号也可继续显示。

显式修改源单元格的字体名称时，codec 保留其他字体属性并移除原 `theme scheme` 绑定。这对应 [sdkjs 的 `setFontname`][oo-font-setter]先设置名称、再 `setScheme(null)` 的契约，避免新字体仍受主题字体覆盖。字号通过独立字段更新。

Word 和 Sheet 的字体菜单包含常见字体及当前导入名称，也支持键入名称和小数字号；尚未枚举全系统字体。Word 按官方 controller 的 1–300pt 范围及半磅归一化处理输入；Sheet 按 1–409pt 范围接受小数。Enter、菜单选择和失焦提交，Escape 取消；保留文字或矩形选区，输入法组合与过期文档草稿不会误提交。字形是否可用取决于运行环境中的字体和 CSS 回退。

Sheet 使用累计行高布局，提供行高弹窗（0–409.5pt，0 隐藏）、自动调整、恢复默认及双击行号自动调整。导入默认行高、手动隐藏和显式高度会随结构编辑及 XLSX 往返保留；打印沿用这些高度。自动调整测量实际字体与换行，跨多行合并的内容不参与计算，改字号后需主动执行自动调整。

## PDF 映射

实现位置：[StudioPdf.tsx](../packages/ui/src/components/OfficeStudio/StudioPdf.tsx)、[StudioPdf.css](../packages/ui/src/components/OfficeStudio/StudioPdf.css)、[studio-pdf-adapter.ts](src/pages/collaboration/office-studio/studio-pdf-adapter.ts)、[studio-pdf-codec.ts](src/pages/collaboration/office-studio/studio-pdf-codec.ts)。原文页面由宿主的 PDF.js adapter 渲染，导出由 pdf-lib codec 写回。

| 参考设计或操作     | 当前 ZUI 实现                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 静态编辑组与标签   | 开始、批注两类 ZUI Tabs 共用撤销、重做、选择组；功能区分组有短标签与分隔，并区分小按钮和带图标的大按钮。                                                         |
| 开始工具           | 插入文字/矩形；当前页旋转/页面缩略导航；查找/侧栏入口。                                                                                                          |
| 批注工具           | 文字、高亮、矩形、手写签名及批注列表；文字、颜色、几何等属性沿用现有标注模型。手写签名保存为笔迹，不提供证书数字签名。                                           |
| 左右导航与画布     | 查找、批注、缩略图、表单四类导航，同一入口可关闭侧栏；查找/缩略图在左，批注/表单在右。原文白页放在灰画布上，搜索命中、标注与表单覆盖在对应页面坐标。             |
| 普通表单与原文保存 | 保留普通 AcroForm 字段的原名、选项、控件位置和只读属性；编辑已有字段值，导出从原 PDF 写入这些值与新增标注。原文内容采用页面渲染，没有任意修改原 PDF 排版的能力。 |
| 页码和缩放         | 25px 单行状态栏包含前/后页、页码、ZUI 缩放 Select 与有界增减按钮；缩放菜单向上展开。页面渲染、坐标变换、表单和历史逻辑沿用已有实现。                             |

## ranuts 文件生命周期到宿主的映射

实现位置：[OfficeStudioPage.tsx](src/pages/components/OfficeStudioPage.tsx)、[studio-workspace.ts](src/pages/collaboration/office-studio/studio-workspace.ts)、[studio-storage.ts](src/pages/collaboration/office-studio/studio-storage.ts)、[studio-prepare.ts](src/pages/collaboration/office-studio/studio-prepare.ts)。

| 实际学习的行为                                                          | 当前实现                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `document-open.ts` 的打开归属和取消；`onlyoffice-editor.ts` 的创建/销毁 | 宿主和编辑器检查文档身份、编辑版本与实例存活状态，避免切换文档后的旧异步结果覆盖新文档。                                                                           |
| `converter.ts` 的文件入口和延迟加载                                     | 文档导入/导出通过宿主 codec；OfficeStudio UI 使用回调与 `source`/`pdfRenderer` 接口。参考项目的 vendor 编辑器和转换器未成为本轮 UI 依赖。                          |
| `active-document-source.ts` 的原文件与文档身份                          | IndexedDB 保存文档模型及原始 Blob，恢复和历史预览继续带上对应 source；恢复旧 Excel 模型前补齐超链接元数据。                                                        |
| `history/autosave.ts` 的快照、编辑版本和来源边界                        | 本地空间串行保存并保存历史版本，切换/恢复核对版本；恢复历史为新文档。当前自动保存采用宿主的默认 700ms 调度，未移植 ranuts 按导出成本调整的 30–180 秒恢复快照调度。 |
| `design-system.md` 的应用壳与内部编辑器分层                             | 共用标题、Ribbon、导航、画布和状态栏形成编辑工作区，文档正文保持各编辑器自己的排版与渲染。                                                                         |

[oo-word-template]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/documenteditor/main/app/template/Toolbar.template#L39-L92
[oo-word-viewport]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/documenteditor/main/app/template/Viewport.template
[oo-common-variables]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/common/main/resources/less/variables.less#L104-L106
[oo-common-statusbar]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/common/main/resources/less/statusbar.less#L7-L9
[oo-sheet-fonts]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/spreadsheeteditor/main/app/view/Toolbar.js#L890-L915
[oo-pdf-toolbar]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/pdfeditor/main/app/view/Toolbar.js#L924
[oo-pdf-template]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/pdfeditor/main/app/template/Toolbar.template#L1-L83
[oo-pdf-leftmenu]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/pdfeditor/main/app/view/LeftMenu.js#L82
[oo-font-setter]: https://github.com/ONLYOFFICE/sdkjs/blob/9d2138866d929be32f1d107e8b5bfae36156e097/cell/model/WorkbookElems.js#L5635-L5645
[oo-hyperlink-formula]: https://github.com/ONLYOFFICE/sdkjs/blob/9d2138866d929be32f1d107e8b5bfae36156e097/cell/model/FormulaObjects/lookupandreferenceFunctions.js#L1514-L1560
[oo-if-formula]: https://github.com/ONLYOFFICE/sdkjs/blob/9d2138866d929be32f1d107e8b5bfae36156e097/cell/model/FormulaObjects/logicalFunctions.js#L199-L220
[oo-date-formulas]: https://github.com/ONLYOFFICE/sdkjs/blob/9d2138866d929be32f1d107e8b5bfae36156e097/cell/model/FormulaObjects/dateandtimeFunctions.js#L789-L1120
[ranuts-editor]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/lib/onlyoffice-editor.ts#L345-L424
[ranuts-open]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/lib/document-open.ts
[ranuts-converter]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/lib/converter.ts#L29-L115
[ranuts-source]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/lib/active-document-source.ts
[ranuts-autosave]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/lib/history/autosave.ts#L1-L108
[ranuts-design]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/docs/design-system.md
[ranuts-word-image]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/docs/media/ai-demos/word-ai.jpg
[ranuts-sheet-image]: https://github.com/ranuts/document/blob/d1c9b03263aabe14789297f5c717fefff2fe4f0d/docs/media/ai-demos/excel-ai.jpg
[oo-word-size-input]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/documenteditor/main/app/controller/Toolbar.js#L1470-L1528
[oo-sheet-size-input]: https://github.com/ONLYOFFICE/web-apps/blob/f79972a400c3a696490094961772d1f86fac1b82/apps/spreadsheeteditor/main/app/controller/Toolbar.js#L1880-L1920
