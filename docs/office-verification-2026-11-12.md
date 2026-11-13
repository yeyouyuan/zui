# 文档编辑器验证记录

验证日期：2026-11-12。交付范围为本机运行的 ONLYOFFICE Docs 10.0、文件桥接、工作台集成及 `@zui/react` 公共 `OfficeEditor` 组件。组件示例为 `http://127.0.0.1:5174/#/components/office-editor`，文件工作区为 `http://127.0.0.1:5174/#/collaboration`。本次源码变更尚未发布。

下列 OfficeEditor 数值、服务状态及页面试用边界保留为此前验证记录。独立 OfficeStudio 的本轮复核与新执行结果记录在文末，不能用此前的组件库测试总数代替追加功能的验收。

## 代码检查

| 检查                            | 结果                                   |
| ------------------------------- | -------------------------------------- |
| 组件库 TypeScript 检查          | 通过                                   |
| 组件库 ESM、CommonJS 与类型构建 | 通过                                   |
| 公共导出与服务端渲染            | 通过，不访问浏览器                     |
| `pnpm --filter @zui/react test` | 1308/1308 通过，83 个测试文件          |
| OfficeEditor 生命周期测试       | 19 项，已计入组件库总数                |
| 文档站 TypeScript 检查          | 通过                                   |
| 文档站生产构建                  | 通过，保留现有分块体积提示             |
| 修改代码的 ESLint 检查          | 通过                                   |
| 修改源码与说明的 Prettier 检查  | 通过；锁文件与生成 Registry 不纳入此项 |
| `git diff --check`              | 通过                                   |
| `pnpm --filter @zui/docs test`  | 74/74 通过，包含子测试                 |
| 桥接测试                        | 21 项，已计入总数                      |
| 客户端会话与保存测试            | 29 项，已计入总数                      |
| 中文字体生成测试                | 7 项，已计入总数                       |
| `pnpm --filter @zui/cli test`   | 25/25 通过                             |
| Registry 生成结果一致性         | 通过；72 个组件、16 个区块，共 88 条目 |

测试覆盖签名配置与回调、文件取件、保存请求关联、相同内容回写、结果校验、确认失败重试、持久化失败、版本冲突、服务重启、只读、草稿迁移及并发打开。客户端测试使用受控存储与服务响应，不能证明真实浏览器 IndexedDB 写入。

组件测试使用受控 DocsAPI，覆盖 StrictMode 清理、脚本错误与超时、来源隔离、过期事件、JWT 和事件更新保持实例、模式与权限切换重建、原生嵌套配置修改隔离、异步保存和下载失败重试、进行中阻止重载、全屏及 disabled。CLI 测试确认安装与 diff 回读包含组件全部辅助源码文件。

工作台与组件示例共用公共组件。示例创建独立文件副本，切换格式、模式或打开工作区前等待当前会话保存；保存期间新增输入会再次回写，持续新增输入则阻止切换。这些检查不能替代真实原生编辑画布的浏览器验收。

## 本机服务与实际接口

DocumentServer 和桥接容器均为 healthy。生产预览的 `/api/office/health` 返回 `available=true`、`version=10.0.0.169`，确认构建后的页面也具有文件桥接代理。JWT 保持开启，密钥与生成字体均被 Git 忽略。

使用本次生成的独立测试文件完成以下检查：

- 三格式会话返回经过签名的 `word`、`cell`、`pdf` 配置，PDF 明确设置 `isForm=false`。
- DocumentServer 从桥接容器读取 DOCX、XLSX、PDF，字节数与 SHA-256 均匹配。
- 六种真实引擎转换通过：DOCX→DOCX、XLSX→XLSX、PDF→PDF、DOCX→PDF、XLSX→PDF、PDF→DOCX。
- 转换保留测试文字，Excel 保留 `B2+C2` 公式及结果 `30`。
- 使用真实转换结果人工签名发送三格式保存回调；下载结果、请求编号、哈希与 ACK 均匹配，原件保留。

实际回写验证发现公开端口在内部地址重写后仍被保留的问题，已修复并加入回归测试。

这些接口检查没有在编辑器画布中修改内容。保存回调由验证程序签名发送，不能替代真实编辑会话的自动回调验收。

## 中文字体与文件画面

官方字体索引 `AllFonts.js` 和 `font_selection.bin` 均已登记新安装的常规、粗体样式。字体保留上游原始 family 名称 `Noto Sans SC Thin`，实际字重分别为 400 和 700。

独立新建的中文 DOCX 与 XLSX 通过官方转换接口各生成一页 PDF，两份均完整提取预期的 43 个中文字符，且实际嵌入两种字重。转换文件经 Poppler 渲染后已视觉检查，没有方框字形、裁切或重叠，常规与粗体可明显区分。该检查证明测试文件的中文转换和输出画面，不代表浏览器编辑器页面已完成视觉验收。

## 页面试用

### 显示不完整修复

用户提供的组件页批注截图显示，编辑器外框有完整高度，但原生画布只占顶部约 150px，右侧操作栏被裁切。源码复核确认：工作台的 `.office-suite-frame` 将公共组件的 `display:flex` 覆盖成 `display:block`，导致内部画布的百分比高度链断开；固定的 `min-width:760px` 也超过了文档示例的可用宽度。

已拆开 iframe 与 React 容器的样式，恢复父子 flex 高度分配，移除固定最小宽度，并让文件栏和操作按钮按容器宽度自然换行。修复同时作用于页面内嵌和展开状态，不改变文档配置或编辑器实例。该修复经源码复核、CSS 格式检查、文档站类型检查和生产构建验证；浏览器自动权限仍未解除，未进行修复后的原生画布实测。

服务已启动，可直接打开上述组件示例或文件工作区。重新启动的操作见 [完整编辑器说明](office-full-editor.md) 和 [本机部署说明](../deploy/office/README.md)。

1. 点击 Word 示例，在原生编辑器中修改正文与段落格式，保存到工作台，下载后重新打开检查。
2. 点击 Excel 示例，修改单元格与公式，保存到工作台，检查下载文件中的数值和公式。
3. 点击 PDF 示例，通过“主页 → 编辑文本”修改已有文字，保存并下载检查；扫描文字需另行 OCR。

浏览器自动审批仍因已保存的权限设置拒绝读取本地页面，用户选择先交付代码与可打开页面。本次未运行浏览器或 Playwright 测试，尚未确认原生画布操作、真实编辑会话回调、浏览器持久化及页面视觉效果。

## OfficeStudio 规则与日期阶段基线

复核日期：2026-11-12。独立组件页面为 `http://127.0.0.1:5174/#/components/office-studio`。当前源码与 Registry 包含 73 个 UI 组件、16 个业务块；新增的 OfficeEditor 与 OfficeStudio 尚未发布到包仓库。

以下保留 2026-11-12 规则/日期阶段的源码与验收记录，早于后续超链接、Office 界面、字体和 PDF ZUI 控件追加。该阶段源码复核确认已实现：

- Word 的本地 PNG/JPEG、图片尺寸与替代文字、默认页眉页脚、PAGE/NUMPAGES 域、当前区域查找替换与标题大纲。
- Excel 的单元格合并拆分、冻结行列、条件筛选、行排序与支持的引用调整、二维簇状柱状图和标准折线图；新增 8 类条件格式、7 类数据验证、向下/向右复制填充及数字、日期和尾数文本序列。
- PDF 的缩略图、可提取文字查找、结果定位、矩形和手写笔迹、批注拖动及撤销重做。
- 公共打印回调和 ref 方法，以及示例中最近 20 次历史版本的只读查看、导出、打印与恢复为新文件。

新增条件格式的契约包括 `cellIs`、`expression`、`containsText`、`duplicateValues`、`uniqueValues`、`top10` 前/后若干项或百分比、`aboveAverage` 高于/低于平均值、`colorScale` 二色/三色。数据验证包括 `list`、`whole`、`decimal`、`date`、`time`、`textLength`、`custom`；保留输入/错误提示与允许空白设置，启用错误提示的 `stop` 在完整候选输入上阻止无效批次。规则仅覆盖模型支持的矩形 A1 子集；未知复杂规则、动态/外链/结构化/三维/命名/整行整列引用明确拒绝，色阶仅保留最小值、可选的 50 百分位和最大值。填充保留目标规则范围并继承直接样式，支持相对公式和双种子步长；日期按整数天、文本按尾数生成，合并、无效或超限结果整批取消。具体容量与文件边界见 [OfficeStudio 说明](office-studio.md)。

验证错误提示的 `warning` 与 `information` 保留输入并标记无效格，批量操作汇总实际写入的无效目标数量和首格消息；关闭错误消息时保留标记。无效 `stop` 草稿会阻止读取模型、保存、导出、打印、新建、导入和文档切换，修正或取消后可继续。规则输入/错误消息支持多行；不适合 XML 保存的控制字符或不完整 Unicode 会提前拒绝。

当时公式日期回归与规则/结构/填充辅助逻辑共 171/171，已计入该阶段 OfficeStudio 总数。DATE、DATEVALUE、DAY、MONTH、YEAR 按 Excel 1900 日历处理序号 0 和虚拟闰日 60，含 DATE 的月份/天数溢出与错误传播；原有 SSF 日期显示保持一致。

以下结果来自规则/日期阶段源码冻结后的统一验收，包含当时的 Excel 条件格式、数据验证和填充，以及日期边界和提示反馈修复。不能用这些数字代替后续追加功能的最终全量结果。

| 检查                                                | 实际结果                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 组件库 TypeScript、七个工作区包及 IIFE 构建         | 通过                                                                                                                                                                                 |
| `pnpm --filter @zui/react test`                     | 1577/1577 项通过，92 个测试文件；OfficeStudio 269 项、OfficeEditor 19 项均已计入总数                                                                                                 |
| `pnpm --filter @zui/docs test`                      | 162/162 项通过，包含 155 个顶层测试及子测试；0 失败、0 跳过                                                                                                                          |
| 打印回归                                            | 10/10 项通过，已计入文档站总数，包括条件格式、数字格式、PDF 导出文件打印与预览失败清理                                                                                               |
| `pnpm --filter @zui/cli test`                       | 26/26 项通过                                                                                                                                                                         |
| MCP `node --test packages/mcp/tests/tools.test.mjs` | 7/7 项通过，覆盖全部组件目录及两个 Office 生成示例                                                                                                                                   |
| Registry 与打包源码一致性                           | 73 个组件、16 个业务块，共 89 条目；复制源码包含规则对话框、条件格式/验证及填充辅助文件                                                                                              |
| `node scripts/check-consumer.mjs`                   | 89 个条目、276 个源文件、73 个 MCP 示例及 Office 子路径编译通过；打包源码包含本轮规则和填充，CLI diff 无变化                                                                         |
| `node scripts/check-distribution.mjs`               | 七包 npm pack、所有产出 ESM/CJS shared 与 lazy 模块、公共导出、CSS 和浏览器三件套通过                                                                                                |
| 七包 prepare 与 `check-github-packages.mjs --local` | 七个暂存 tarball 经真实 npm aliases 安装，ESM/CJS、Office 子路径、React 19 Button SSR、CSS、CLI、MCP 与严格 NodeNext 声明检查通过；实际 CLI `add office-studio` 后的复制源码编译通过 |
| 分发检查脚本 ESLint、Prettier 与 `git diff --check` | 通过                                                                                                                                                                                 |

该阶段 Node 测试包含真实 DOCX 的图片、页眉页脚和页码域重复导出重开；真实 XLSX 的行列结构与引用调整、合并、冻结、筛选、原生图表及规则重复往返；真实 PDF 原始页面内容保留、表单更新、矢量绘图及 PDF.js 文字提取。XLSX 专项 21/21，包含 18 种条件格式、15 种数据验证变体，以及多行提示和 XML 字符的重复保存。日期专项保留原生序号 0/1/59/60/61、小数日的原始精度和 ISO Gregorian 日期语义，来源文件与独立导出各连续重开 3 轮通过。打印测试验证生成的 Word/Excel 内容、受控打印调用和超时清理，也已执行 PDF 导出文件的受控打印路径，覆盖打印结束后释放 object URL、预览失败清理及过期 load 事件隔离。存储测试使用 fake-indexeddb，覆盖修订冲突、事务提交、历史保留、恢复副本、数据库升级和失败重试。

体积由 `node scripts/check-bundle-size.mjs` 汇总全部同步可达 JS 文件的 gzip 字节，异步编辑内核另列；external 运行时依赖由消费者另行安装。入口预算为 112 KiB（114,688 字节），包含新增 Office 公共 API 和文档模型，不再只统计入口转发文件。

| 规则/日期阶段 JS 产物                  |  原始字节 | gzip 字节 |
| -------------------------------------- | --------: | --------: |
| React ESM 同步入口，2 个文件           |   364,614 |   104,819 |
| Word 异步新增模块                      |    37,343 |    10,689 |
| Excel 异步新增模块                     |   106,835 |    32,082 |
| PDF 异步新增模块                       |    29,566 |     9,509 |
| 内联 React 和编辑依赖的完整浏览器 IIFE | 1,511,970 |   465,229 |

浏览器 `LICENSE.txt` 按实际打包模块收集，共 64,605 字节，包含 48 个依赖的原始许可通知，包括 React、Tiptap、ProseMirror、公式解析器及传递项。七包本地暂存保持源码版本 `0.3.0`，此检查没有向远端仓库发布或验证远端新版本。

这些阶段结果验证当时的文件适配、受控运行时行为和包的安装与编译，不证明真实浏览器中的编辑画布、布局、IndexedDB 持久化、字体加载或打印对话框。上方 OfficeEditor 表格与服务状态继续保留为历史记录，独立 OfficeStudio 不需要该服务，本轮没有启动它。完整能力和格式边界见 [OfficeStudio 说明](office-studio.md)。

该阶段生产预览在 `http://127.0.0.1:5174/#/components/office-studio` 重新运行，索引、引用的 JS/CSS、OfficeStudio 页面模块及 Excel codec 均 HTTP 200。该检查只确认当时的页面资源可取用。文档站构建通过，保留既有 Builder 混合导入及大包体积提示；追加界面后的构建和资源检查需另行记录。

前述规则/日期阶段的本地分发命令、退出码及安装证据保存在 `.release/github-packages/office-distribution-local.json` 和 `consumer-local.json`，保留为历史记录。本轮追加实现后的最终报告与安装证据另存于下文的 `*-final-2026-11-12.json`，对应最新产物和日志。

## OfficeStudio 本轮追加实现

本轮实际学习的 ONLYOFFICE web-apps、sdkjs 和 ranuts/document 固定 commit、源码位置及 ZUI 映射见 [界面与操作参考记录](office-studio-reference-2026-11-12.md)。参考用于布局与操作语义对照，界面控件由 ZUI 实现，没有引入参考项目的 UI 库。

- Word：开始、插入、布局、引用、审阅、视图标签；字体和段落两行工具、正文/无间距/标题 1 样式图库；查找替换、大纲、字数左导航与厘米标尺预览。字体和字号为 ZUI Select，正文保持灰画布上的白纸；现有编辑、撤销重做与导出操作继续生效。
- Sheet：Calibri / 11pt 缺省，字体/字号上行、粗斜下划线与颜色下行，使用对齐图标及 25px 单行状态栏。字号菜单对应官方 8 到 96pt 的 17 档，并补当前导入的小数字号；字体菜单为常见名称及当前导入名称，未枚举全系统字体，也没有任意名称或字号键入。
- XLSX 字体：从原生字体表及单元格、行列样式恢复 9.5、10.5、12.5、14.5、18.5、24.5 等小数字号，覆盖显式样式索引 0、默认字体、行列继承、无字号字体的索引、空白已存在格、公式缓存和超链接。单元格显式样式优先；原文件保存保留行列设置，独立导出写回已建模格的有效字体。改名称会解除 theme scheme，对应 sdkjs 的 `setName` 后 `setScheme(null)`；只改字号及旧草稿未编辑字体时保留原名称、scheme、粗体等属性。专项包含原文件/独立导出连续三轮重开和行列结构迁移，已计入下方 32 项真实 XLSX 结果。
- XLSX 超链接：从 worksheet 原生链接和专用关系回读，保存外部/内部目标、单格/矩形范围、tooltip/display，并保留带链接的文字、数字、布尔、日期、公式与缓存。新增、编辑、删除、结构/重命名/排序/复制/填充及原文件/独立导出均有重复往返回归；未知协议、文件路径和不可解析目标保留元数据，打开由解析器决定。旧模型 `undefined` 与显式 `[]` 区分，通过 hydration 仅补缺失工作表，兼容导出共用迁移逻辑；已有数组不二次迁移。`HYPERLINK` 显示值的标量类型、错误和隐式交叉，以及 `IF` 引用布尔与所选分支读取均有回归。
- PDF：开始/批注标签，查找、批注、缩略图、表单导航及左右面板，页码与缩放状态栏。页面表单覆盖层、表单面板和查找/标注列表使用 ZUI Input、Input.Textarea、Checkbox、Radio/RadioGroup、Select、Button；同一单选字段受控分组，值提交、只读、禁用、页面坐标及旋转保留。
- 图表与公共反馈：图表的数据明细使用 ZUI Collapse 和 Table；文件菜单包含新建、打开、保存、导出、打印，已展开的菜单随只读、禁用及进行中状态同步更新，实际 ZUI 菜单的键鼠操作有回归。保存状态有 live region，错误区有 alert 和重试；560px 以下标题栏左栏最多 96px、状态最多 72px，保留 `aria-live` 与完整 `title`，错误文字允许换行。该窄屏记录来自冻结源码复核，尚无自身页面视觉验收。

Sheet 网格按固定 24px 行高计算虚拟可见区域，单元格绝对定位并使用 `overflow:hidden`，大字号按单元格边界裁切；合并格使用跨行高度。字号不会自动改变网格行高，当前没有自动适配或手动行高 UI。Excel 打印为独立 HTML 表格，缺省 Calibri / 11pt，显式字体与字号优先；没有固定行高，按字号、换行和内边距自然增长，不能据此推定其分页与 Office 一致。

已只读核对的 UI 专项日志如下；它们属于各自源码冻结时的范围，不是最终 UI 全量统计。

| 范围                                              | 2026-11-12 阶段结果                | 日志                                                         |
| ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Word 功能区、字体/字号、导航、样式及既有编辑回归  | 20:45:23 开始，35/35 通过          | `/tmp/zui-office-word-ribbon-focused-20261112.log`           |
| 模型、公式、结构、规则、填充、超链接及字体 helper | 20:47:41 开始，247/247、6 文件通过 | `/tmp/zui-office-hyperlink-model-focused-final-20261112.log` |
| PDF 功能区、导航、表单覆盖层和列表 ZUI 控件       | 21:03:46 开始，20/20 通过          | `/tmp/zui-pdf-zui-controls-focused-20261112.log`             |

这些 UI 专项运行于 jsdom；真实 XLSX/XML 往返、Node PDF 和受控打印结果分别记录，不能替代自身页面视觉或打印对话框验收。

最终 UI 日志 `/tmp/zui-office-ui-full-final-20261112.log` 于 21:19:30 开始，93 个文件、1668/1668 通过；OfficeStudio 十个测试文件合计 359 项，其中模型/helper 247、Header 17、Word 35、Sheet 40、PDF 20，OfficeEditor 19 项，均已计入全量。UI TypeScript 和仓库 `pnpm lint` 已报告 exit 0，Registry 已按冻结 UI 生成 89 条目（73 个组件、16 个块），包含 Collapse/Table/Radio 依赖。

真实 XLSX 专项 32/32、0 失败/跳过，日志 `/tmp/zui-office-font-native-xlsx-fixed-20261112.log`；包含原生数值日期精度、超链接/关系及字体继承的重复保存，不以 ExcelJS 再读后的整数结果代替原始 XML 小数字号核对。文档站最终全量 194/194，包含 187 个顶层测试；真实 Word 创建、导出、重开和再导出专项 17/17，均计入全量。最终 Word 测试加载器递归加载真实 TypeScript 模块并先缓存循环依赖，保留样本模型校验，没有复制样本数据或以桩替代校验。

打印 19/19、0 失败/跳过，日志 `/tmp/zui-office-print-default-final-20261112.log`；打印源码 strict TypeScript、ESLint 和 Prettier 均通过。`/tmp/zui-office-print-font-smoke-20261112.log` 使用 jsdom 计算样式确认 Excel 缺省 Calibri / 11pt、显式 Times New Roman / 11.5pt，以及 Word 表格 10pt。该检查确认 CSS 与模型样式优先级，不能证明浏览器实际排版或打印结果。

## 本轮最终统一验收

以下结果来自本轮产品源码冻结后的检查。2010 项测试全部通过，Office 与文件往返专项已计入各自全量；规则/日期阶段数字继续按前文的历史范围阅读。

| 检查                                                   | 本轮最终结果                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| UI 全量、测试文件数及 OfficeStudio / OfficeEditor 子集 | 1668/1668、93 文件通过；OfficeStudio 359、OfficeEditor 19 均计入                       |
| docs Node 全量、顶层数、真实 XLSX 及打印专项           | 194/194、187 顶层测试、0 失败/跳过；Word 17、XLSX 32、打印 19 均通过且计入全量         |
| UI / docs TypeScript、owned lint / format、差异格式    | UI、docs 及其余工作区包 TypeScript、仓库 `pnpm lint`、三份 Markdown 格式及差异检查通过 |
| CLI、MCP、Registry 与复制源码                          | CLI 26/26、MCP 7/7；89 条目、280 源文件、73 MCP 示例和 Office 子路径编译通过           |
| Tokens、Icons、I18n、Blocks                            | 3/3、7/7、37/37、68/68 通过                                                            |
| 七包、IIFE、docs 生产构建                              | 全部 exit 0；docs 保留既有 Builder 混合导入及大于 500 kB 的 chunk 提示                 |
| 分发、消费者、七包 aliases 安装与源码编译              | 四步全部 exit 0；七包真实 aliases 安装、SSR、公共声明、CLI 复制源码严格编译通过        |
| 同步入口/异步内核/IIFE 体积和许可通知                  | 同步入口 110,470 gzip 字节，小于 114,688 预算；IIFE 478,233 gzip，许可 64,605 字节     |
| 生产预览资源 HTTP                                      | 索引及九个 JS/CSS 资源 HTTP 200，逐字节与最终 `docs/dist` 一致                         |
| Header 菜单与窄屏源码反馈                              | Header 17/17 已计入 UI；窄屏限宽、live region/title 和错误换行已源码复核，视觉未验收   |
| 自身页面浏览器视觉、实际打印/另存为 PDF                | 未验收；未运行浏览器、CUA 或 Playwright                                                |
| GitHub / 包仓库发布                                    | 本轮新增源码尚未发布                                                                   |

最终全量日志：

- UI：`/tmp/zui-office-ui-full-final-20261112.log`。
- docs：`/tmp/zui-office-docs-tests-frozen-final-20261112.log`。
- CLI、Tokens、Icons、I18n、Blocks：`/tmp/zui-office-other-tests-final-20261112.log`；MCP：`/tmp/zui-office-mcp-tests-final-20261112.log`。
- UI TypeScript：`/tmp/zui-office-ui-types-final-20261112.log`；其他工作区包及 docs：`/tmp/zui-office-types-remaining-final-20261112.log`；仓库 lint：`/tmp/zui-office-lint-frozen-final-20261112.log`。
- 七包：`/tmp/zui-office-packages-build-final-20261112.log`；IIFE：`/tmp/zui-office-browser-build-final-20261112.log`；docs：`/tmp/zui-office-docs-build-final-20261112.log`。

本轮消费者、分发、别名暂存和真实安装按顺序执行，全部 exit 0；对应日志为 `/tmp/zui-office-consumer-final-20261112.log`、`/tmp/zui-office-distribution-final-20261112.log`、`/tmp/zui-office-aliases-prepare-final-20261112.log`、`/tmp/zui-office-aliases-consumer-final-20261112.log`。七包 npm pack 文件数分别为 Tokens 11、Icons 293、I18n 17、React 36、Blocks 70、CLI 646、MCP 642。实际安装还覆盖条件格式、验证、字体和超链接的公共类型，以及私有 runtime 导出保护。四步期间 667 个冻结文件 SHA256 和 Git staged/unstaged diff、status 均保持一致，比较证据为 `/tmp/zui-office-distribution-freeze-final-20261112.json`。

最终 tarball 目录为 `/tmp/zui-office-studio-pack-20261112-final`，保持 `@zui/*` 源包名并在暂存阶段使用 `@yeyouyuan/zui-*` npm aliases，版本 `0.3.0`。本地持久记录为 `.release/github-packages/office-distribution-final-2026-11-12.json`；同目录的 `office-manifest-final-2026-11-12.json` 保留七包 sha512、shasum 和大小，`office-consumer-final-2026-11-12.json` 保留实际消费者结果。此前 `office-distribution-local.json` 中的 276 源文件及规则/日期阶段体积不代表本轮最终产物。

最终产物由 `node scripts/check-bundle-size.mjs` 读取全部同步可达 ESM，并分别计算新增异步模块；日志为 `/tmp/zui-office-bundle-size-final-20261112.log`。下列 gzip 为各文件独立压缩后的字节总和。

| 本轮最终产物                        | 模块/文件数 |  原始字节 | gzip 字节 |
| ----------------------------------- | ----------: | --------: | --------: |
| React ESM 同步入口                  |           2 |   381,584 |   110,470 |
| Word 异步新增模块                   |           3 |    49,467 |    13,445 |
| Sheet 异步新增模块                  |           2 |   122,044 |    36,569 |
| PDF 异步新增模块                    |           2 |    35,727 |    10,702 |
| 完整浏览器 IIFE                     |           1 | 1,558,623 |   478,233 |
| 浏览器 CSS                          |           1 |   327,825 |    44,266 |
| 浏览器 `LICENSE.txt`，48 个依赖通知 |           1 |    64,605 |     5,723 |

生产预览为 [OfficeStudio](http://127.0.0.1:5174/#/components/office-studio)。索引与最终 `docs/dist/index.html` 相同，入口、React/ZUI 共享模块、CSS、OfficeStudio 页面、Excel codec 和 Word/Sheet/PDF 内核共九个资源 HTTP 200，内容逐字节与新产物相同。日志为 `/tmp/zui-office-preview-http-final-20261112.log`。此检查确认资源可访问，未执行页面交互或视觉检查。

本轮三份 Markdown 的 Prettier、26 个本地链接以及 `git diff --check` 通过；日志为 `/tmp/zui-office-docs-format-final-20261112.log`、`/tmp/zui-office-docs-links-final-20261112.log`、`/tmp/zui-office-diff-check-final-20261112.log`。本轮收尾只补充文档和本地验收记录，产品源码与打包产物保持冻结。

上述冻结阶段仍有待扩展的字体/字号键入与网格行高，后续实现及检查见下文。Word 完整自动分页、多节和复杂文档兼容、PDF 任意原文编辑与扫描件 OCR 等仍是后续扩展范围。

## OfficeStudio 字体输入与行高追加验收

本节记录字体输入与行高追加功能的检查，更新前文 Select 字体菜单、固定 24px 行高与尚无自动行高入口的阶段结论。前文 2010 项与包安装结果保留为历史基线，本次未重跑仓库全量或发布。

- Word 和 Sheet 使用 ZUI Combobox 键入字体名和小数字号，包含 Enter、菜单选择、失焦提交、Escape 取消、输入法组合、非法值与过期选区草稿隔离。Word 保留 ProseMirror 选区与文档身份，字号按参考 controller 的 1–300pt、半磅归一化处理；Sheet 按 1–409pt 保留小数并应用整个矩形选区。保存、导出和打印先提交有效草稿。
- Sheet 按累计行高计算虚拟视口、滚动、冻结及合并格跨度；提供行高弹窗、自动调整、恢复默认、双击行号自动调整。0–409.5pt，0 隐藏行；选区覆盖行在一次历史更新中应用。默认行高、显式高度和手动隐藏与筛选合并参与显示和打印，并通过真实 XLSX 结构编辑、保存重开及旧草稿来源恢复验证。
- DOCX 连续保存重开验证带标点的自定义字体名及 1、17.5、300pt；XLSX 连续来源保存、独立导出验证小数行高、隐藏、结构迁移及恢复默认。打印测试覆盖显式高度和合并起始行隐藏后保留的可见内容。

| 检查                        | 结果                               | 本地日志                                                                     |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| OfficeStudio 专项           | 378/378，12 文件                   | `/tmp/zui-office-ui-final-tests.log`                                         |
| Word/XLSX/打印/存储专项     | 105/105，无失败或跳过              | `/tmp/zui-office-docs-final-tests.log`                                       |
| UI 与 docs TypeScript       | 通过                               | `/tmp/zui-office-ui-final-types.log`、`/tmp/zui-office-docs-final-types.log` |
| 追加源码 ESLint             | 通过                               | `/tmp/zui-office-final-lint.log`                                             |
| UI ESM、CommonJS 与声明构建 | 通过，已检查日志无 TypeScript 诊断 | `/tmp/zui-office-ui-detail-build.log`                                        |
| docs 生产构建               | 通过，保留现有大分块提示           | `/tmp/zui-office-docs-detail-build.log`                                      |

在 [本地开发预览](http://127.0.0.1:5175/#/components/office-studio) 使用实际浏览器核对：Word 全文选区应用 `Aptos Display` 与 17.25pt，正文实际样式为 17.5pt，选区保持；随后撤销演示修改。Excel A1 的 30.75pt 手动行高显示为 41px；36.5pt 换行内容自动调整为 116px，保存后切换文档和重新加载仍保留。Word 与 Sheet 的字号控件均扩大至 76px，输入元素实测 54px，消除了重复内边距导致的数字裁切。

Excel 截图保存于 `/Users/meaili/.codex/visualizations/2026/11/12/01a1d01d-ba87-74c2-b8f5-d731e6cf25b5/office-studio-excel-font-row-height.png`。本次浏览器检查覆盖局部功能和界面，不代表与 Office 逐像素一致或原生打印对话框验收。自动行高不测量跨多行合并的内容，仍需手动设定；修改字号本身不会自动改变行高。字体字形仍由系统可用字体与 CSS 回退决定。

## Excel 常用编辑补齐与 Office 功能对照

新增选区/工作表/工作簿查找替换、Office 通配符、公式与显示值查找、整批验证与一次撤销；新增列宽输入、拖动、键盘调整、自动适配和恢复默认；补齐垂直对齐、边框线型/颜色与清除格式。XLSX 和打印同步支持尺寸、对齐与合并边框。详见[逐项功能对照](office-function-comparison-2026-11-12.md)。

| 检查                        | 结果                         | 本地日志                                                                           |
| --------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| OfficeStudio 专项           | 400/400，14 文件             | `/tmp/zui-office-function-final-ui-tests.log`                                      |
| Word/XLSX/打印/存储专项     | 108/108，无失败或跳过        | `/tmp/zui-office-function-docs-tests.log`                                          |
| CLI 安装 OfficeStudio       | 1 项通过，其余 25 项未选择   | `/tmp/zui-office-function-cli-tests.log`                                           |
| UI 与 docs TypeScript       | 通过                         | `/tmp/zui-office-function-ui-types.log`、`/tmp/zui-office-function-docs-types.log` |
| 本轮追加源码 ESLint         | 通过                         | `/tmp/zui-office-function-final-lint.log`                                          |
| UI ESM、CommonJS 与声明构建 | 通过，日志无 TypeScript 诊断 | `/tmp/zui-office-function-ui-build.log`                                            |
| docs 生产构建               | 通过，保留现有大分块提示     | `/tmp/zui-office-function-docs-build.log`                                          |

浏览器在 `http://127.0.0.1:5175/#/components/office-studio` 验证：A3:D6 应用所有边框与垂直居中，A–D 列设为 20 字符（145px），重新加载后保留。捕获 A3:D6 选区，将“组件”全部替换为“组件功能”，A5 从“组件开发”变为“组件功能开发”；操作后活动单元格仍是 D6，反馈保留“已替换 1 个单元格；可撤销”。一次撤销恢复 A5，保存后显示“已保存”。行高输入 30.75 并 Enter 提交，A3 实测 41px；撤销恢复原尺寸。

本轮浏览器发现的替换按钮隐式提交已修复并加入回归。行高/列宽弹窗使用 ZUI 的初始焦点机制，回归覆盖下一帧初始化不抢走输入焦点与 Enter 提交后归还触发按钮；浏览器确认行高弹窗打开聚焦输入，Escape 后归还“行高”按钮。

新增功能截图：`/Users/meaili/.codex/visualizations/2026/11/12/01a1d01d-ba87-74c2-b8f5-d731e6cf25b5/office-studio-excel-office-editing.png`。本轮没有在 Microsoft Office 桌面应用中打开文件，也没有验收窄屏、原生打印对话框或全部 Office 功能；文件往返依据原生 ExcelJS 读写测试。显示值替换会跳过公式和无法对应原始内容的格式化数字；自动列宽不测量跨列合并，字符宽度按默认字体近似换算。高级 Office 功能仍按对照表登记为部分或未实现。

## OfficeEditor 界面与功能契合验收（2026-11-13）

本轮为 ONLYOFFICE 集成线补齐与 `OfficeStudio` 一致的界面语言和四项功能契合：`OfficeEditor` 新增 `kind`（分族主题色标题栏）与 `customization`（逐键填充 `editorConfig.customization`，后端值优先，参与身份判定）；`OfficeWorkbench` 文件栏改为 accent 主题（蓝/绿/红）、状态圆点、danger-subtle 错误条、token 化样式，「文件」下拉菜单（保存到工作台/下载文件/展开或返回）替代平铺按钮，主栏保留主保存按钮与「自动保存」开关；外层 chrome 聚焦时 Ctrl/Cmd+S 由工作台接管（iframe 内的同名快捷键由引擎走保存回调）；空闲自动保存默认开启，会话空闲 5 秒且编辑器静默后由轮询器回写，开关关闭时仅保留手动保存，开关状态持久化于 `zui-office-autosave-v1`。示例页升级宽版路由、CSS 类空态与完整 `classNames` 插槽说明。

### 代码检查

| 检查                                                                                                | 结果                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `OfficeEditor.test.tsx`（kind 主题、customization 合并/优先/重建）                                  | 21/21 通过                           |
| `docs/tests/office-client.test.mjs`（空闲窗口、开关持久化、存储失败回退）                           | 32/32 通过                           |
| `pnpm --filter @zui/docs test`                                                                      | 全部通过                             |
| UI 与 docs TypeScript、仓库 `pnpm lint`                                                             | 通过                                 |
| 七包与 docs 生产构建                                                                                | 通过                                 |
| 同步入口体积                                                                                        | 111,193 gzip 字节，低于 114,688 预算 |
| `pnpm test:e2e`（office-workbench 9 项含菜单下载、Ctrl+S、开关；collaboration、builder、docs 全套） | 全部通过                             |
| Registry 再生成                                                                                     | 89 条目一致，`--check` 通过          |

本轮顺带修复既有分支遗留：collaboration 与 office-workbench 的下载路径改为文件菜单；文档站 320px 溢出（关闭态示例代码与行内 code 路径，`docs.css` 修复）；docs-design 导航计数 80、builder 目录 73（OfficeEditor/OfficeStudio 为完整页编辑器，不进 builder 目录）；builder 离线导出的 `<script src=` 来自 chevrotain diagrams 模板，`builder-runtime-plugin.ts` 打桩移除。UI 套件仍有 2 项 OfficeStudio 既有失败（`StudioSheet.test.tsx` 粘贴校验汇总计数），与本轮无关。

上述 2 项粘贴校验失败已在后续 OfficeStudio 选择性粘贴验收中修复，见文末 2026-11-13 记录；此处仅保留当时的历史状态。

### 真实 DocumentServer 画布验收

`node scripts/office-runtime.mjs start` 后两容器 healthy（Docs 10.0.0.169），浏览器实测 `#/components/office-editor`：

- Word/Excel/PDF 示例分别呈现蓝、绿、红 accent 文件栏，状态圆点流转「正在连接 → 已保存到工作台」；原生画布占满 stage（历史 150px 高度缺陷未复现）；`hideRightMenu` 生效（右侧设置面板默认收起，仅保留图标栏）。
- 画布内输入文字后状态进入「编辑中 · 正在自动保存」，空闲后自动回写为「已保存到工作台」；关闭「自动保存」开关后空闲 9 秒保持「编辑中 · 有未保存修改」，重新打开后由轮询完成回写。
- 制造 dirty 后把焦点移到文件栏按 Ctrl+S，状态经 force-save 回写为「已保存到工作台」，浏览器保存对话框未出现；iframe 内的引擎保存回调路径与外层路径汇入同一回写。
- 「文件」菜单含保存到工作台、下载文件、展开编辑器；菜单路径展开后画布满宽重排（样式图库自适应），「返回工作台」可回到内嵌态。
- 560px 视口下文件栏两行折行、无横向溢出（`doc-main` scrollWidth = clientWidth = 560）。

截图存档于 `/Users/meaili/.codex/visualizations/2026/11/13/office-editor-acceptance/`（空态、Word/Excel/PDF 工作台、自动保存、Ctrl+S、文件菜单、展开态、窄视口共 10 张）。验收后 `office-runtime stop`，数据卷保留。本轮未验证引擎多人协作、远端工作区与真实打印机输出。

## OfficeStudio Excel 选择性粘贴验收（2026-11-13）

本轮继续独立 `OfficeStudio` 实现，没有改用 `OfficeEditor` 或 ONLYOFFICE 容器。Excel 富剪贴板升级到 v3，内部复制记录单元格输入、完整直接格式、计算值、列宽、完整包含的合并区域与原生超链接；新增全部、仅公式、仅值、仅格式、公式与数字格式、值与数字格式、保留源格式、除边框外全部、仅列宽、转置共 10 种粘贴模式，以及选择性粘贴对话框和 `Ctrl/⌘ + Alt + V`。每次粘贴保持单次提交与单次撤销，失败不留下部分修改；v1/v2 剪贴板与外部 TSV 继续兼容。

普通粘贴只使用当前事件携带的自定义剪贴板数据，避免内部缓存把外部同文本公式误判为内部复制并平移；最近一次内部复制缓存只供选择性粘贴使用。仅格式模式保留目标输入且不复制合并状态。参差 TSV 粘贴现在显式返回实际写入地址，数据验证提示不会把矩形包围框中的未改动单元格计入；粘贴容量错误文案与实际限制统一为 10,000 个单元格。

| 检查                                   | 结果                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Sheet 模型、超链接与 UI 专项           | 147/147 通过，3 个测试文件；包含 49 项模型、47 项超链接、51 项 UI          |
| 真实 XLSX 往返                         | 36/36 通过；新增 v3 选择性粘贴的值、格式、列宽、转置、合并区域与超链接往返 |
| UI 与 docs TypeScript                  | 通过                                                                       |
| OfficeStudio 相关 ESLint 与 Prettier   | 通过                                                                       |
| UI ESM、CommonJS、声明与 docs 生产构建 | 通过；docs 保留既有 Builder 混合导入和大分块提示                           |
| 尾随空白与差异格式                     | 通过                                                                       |
| 实际页面交互与 560px 响应式布局        | 通过；10 项模式完整呈现，仅值粘贴与一次撤销生效，页面无横向溢出            |

实际页面在 `http://127.0.0.1:5175/#/components/office-studio` 验收：复制 D4 公式单元格后，“选择性粘贴”立即可用，对话框完整显示 10 种模式；向 E4 执行“仅值”得到 `5400`，状态提示“仅值已应用到 1×1”，一次撤销恢复空单元格。560×900 视口下 `body` 与根节点 `scrollWidth` 均为 560px，没有页面级横向溢出；Excel 工作台在窄屏内保持可操作。

本节只记录本轮实际重跑的专项、构建与局部页面验收，不覆盖前文历史全量统计，也不表示已发布到 GitHub 或包仓库。未逐项在浏览器执行其余 9 种粘贴模式，其语义由模型、UI 和真实 XLSX 回归覆盖。

## OfficeStudio ZUI 按钮全面审计（2026-11-13）

本轮核对 Excel 功能区截图中“自动换行 / 合并单元格 / 拆分单元格”以及 OfficeStudio 其余按钮型控件。三项均由 ZUI `Button` 渲染；问题来自功能区对 `aria-pressed="true"` 的旧样式覆盖：灰色背景、强边框与 inset shadow 让选中按钮呈现浏览器原生按钮感。功能区选中态现统一使用 ZUI `primary-subtle` 颜色、组件圆角和轻投影；Word、PDF 的功能区、面板与侧栏选中态同步调整。

源码扫描覆盖 OfficeStudio 9 个生产 TSX 文件，共 172 个 ZUI `Button` 用例；没有直接 `<button>`，也没有动态 `createElement('button')`。原测试夹具中的后续焦点按钮也改用 ZUI `Button`，因此 OfficeStudio 整个 TSX 目录的直接原生按钮为 0。按钮型触发器还包含 ZUI `Tabs`、`DropdownMenu`、`Select`、`Combobox`、`ColorPicker`、`InputNumber` 与 `Switch`，因此运行时按对应的 `z-*` 控件类审计，而不是错误地要求所有触发器都具有 `.z-button`。

实际浏览器在 `http://127.0.0.1:5175/#/components/office-studio` 逐页检查：Excel 的开始、插入、布局、公式、数据、视图六个面板分别渲染 56、23、25、21、24、20 个按钮型控件；Word 六个面板分别为 47、36、23、20、19、19；PDF 的开始与批注面板均为 38。OfficeStudio 示例外层共 44 个按钮型控件。上述扫描均未发现未知按钮类。Excel“自动换行”、Word“适应宽度”、PDF“选择/侧栏”的实际选中态均为 ZUI 主色浅底、6px 圆角和轻投影，不再出现灰底深边与 inset 原生按钮效果。

| 检查                                   | 结果                                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| OfficeStudio 完整专项                  | 405/405，14 个测试文件通过                                          |
| Excel / Word / PDF 全功能区 ZUI 断言   | 所有页签通过；PDF 还覆盖侧栏、状态栏与 `InputNumber` 增减按钮       |
| OfficeStudio TSX 原生按钮扫描          | 生产与测试均为 0；生产代码含 172 个 ZUI `Button` 用例               |
| UI 与 docs TypeScript                  | 通过                                                                |
| OfficeStudio 全目录 ESLint             | 通过                                                                |
| UI ESM、CommonJS、声明与 docs 生产构建 | 通过；docs 保留既有 Builder 混合导入和大于 500 kB 的 chunk 提示     |
| 实际浏览器 DOM 与视觉                  | Excel、Word、PDF 全页签无未知按钮类；三个代表性选中态均通过视觉复核 |

本轮日志为 `/tmp/zui-office-zui-button-source-audit-20261113.log`、`/tmp/zui-office-zui-button-tests-20261113.log`、`/tmp/zui-office-zui-button-typecheck-20261113.log`、`/tmp/zui-office-zui-button-eslint-20261113.log`、`/tmp/zui-office-zui-button-ui-build-20261113.log`、`/tmp/zui-office-zui-button-docs-typecheck-20261113.log` 与 `/tmp/zui-office-zui-button-docs-build-20261113.log`。本轮没有发布到 GitHub 或包仓库。
