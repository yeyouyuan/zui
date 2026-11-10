# Page Studio 页面编辑器 · 2026-11-10

最新扩展见 [多场景设计与业务数据](page-studio-scenes-2026-11-10.md)：新增场景模板、共享数据源、画布快捷设计与个人区块库；原有页面保留。

页面搭建器现为独立的全屏工作台：左侧管理组件、图层、页面与图片，中间编辑画布，右侧编辑内容和样式。入口为 `#/builder`。

## 从空白到可使用页面

1. 新建空白页面，或选用产品介绍、联系收集、项目概览、交互工作台模板。
2. 拖拽 ZUI 组件进入画布，或点击组件卡片上的加号。选中容器时插入子组件，选中普通组件时插入到其后。
3. 在右侧「内容」中修改文字、图片、按钮、表单字段；在「样式」中调整布局与外观。
4. 切换桌面、平板、手机，为小屏设置独立覆盖；缩放用于调整工作区显示比例。
5. 在「图层」中命名、排序、移动、隐藏和锁定；通过底部路径选择父级。
6. 使用交互预览检查链接、表单校验和下载，再导出独立 HTML。需要继续编辑时导出页面 JSON 或备份整个工作区。

## 编辑能力

| 区域       | 已实现                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 顶部工具条 | 多页面切换、新建、重命名、复制、删除、撤销重做、保存状态、保存版本、预览、导入导出                                  |
| 组件库     | 全部 71 个公开 ZUI 组件，共 82 个搭建节点；布局、表单、内容、导航、反馈五组；搜索、拖拽、一键插入                   |
| 预设区块   | 品牌首屏、功能亮点、行动号召、完整联系表单、常见问题、数据概览，可混合组成整页                                      |
| 图层结构   | 展开收起、命名、选中、原生拖动、跨容器移动、上移下移、复制、剪切、粘贴、删除                                        |
| 图层状态   | 隐藏组件在编辑态保留占位、导出时移除；锁定保护内容和子组件，限制向锁定容器拖入组件                                  |
| 图片资源   | 上传真实图片并插入，复用工作区已用图片；嵌入 JSON，刷新后恢复                                                       |
| 画布       | 1280/768/390px 设备预设，320–1920px 自定义宽度，自动适应与 25–150% 缩放，专注模式                                   |
| 响应式样式 | 桌面基础样式，平板与手机覆盖；继承提示、清除覆盖、复制粘贴整套样式                                                  |
| 内容与外观 | Flex/Grid、自由定位、栅格轨道与跨行跨列、相对单位、尺寸约束、间距、排版、背景图与渐变、边框、阴影、变换及自定义 CSS |
| 预览与导出 | 画布内交互、独立预览、页面 JSON、工作区 JSON、可离线运行的 HTML、页面 JSON 查看与复制                               |
| 窄屏       | 组件、图层、页面、图片和属性使用弹层；手机默认使用手机画布；保持真实内容编辑与键盘关闭                              |
| 主题       | 浅色、深色、跟随系统，编辑器界面主题与被编辑页面主题独立                                                            |

### 全组件与组合

组件目录与 `packages/ui/src/index.ts` 对照，覆盖全部 71 个公开组件，并包含 ConfigProvider、FormItem、自定义 TabPanel、自由容器等节点。每个节点使用实际 ZUI 渲染器；导入、保存、编辑、预览与导出共享配置和校验规则。

- Card、Tabs / TabPanel、Splitter、Modal、Drawer、Popover 等容器可嵌套组件。Splitter 的每个直接子组件对应一个可调整的面板，可配置「小屏自动堆叠」，切换布局保留字段值；Tabs 的面板值与标签项对应。
- 表格支持自定义列、真实数据、搜索和排序。选项、菜单、步骤、树数据可视编辑，也可校验后应用 JSON；无效输入保留原有数据。
- 表单支持普通输入及 Select、Checkbox、Switch、Segmented、日期、树选择等实际值，支持必填校验与结果 JSON 下载。Upload 本地模式可导入文件并下载原始内容，提交文件元数据；页面刷新后需重新选择本地附件。
- Button 可配置链接、提交、复制文本、下载文本、消息反馈、切换指定 HTML ID 的区域。自定义 HTML ID、悬停说明和辅助名称可在内容面板设置；复制组件时重建节点和 HTML ID，并重写内部链接及显隐目标。
- 「交互工作台」模板组合统计卡片、真实项目表格、自定义标签面板、可调分栏、时间线、弹窗和表单，可直接修改为自己的业务页面。

### 高度自定义

桌面、平板、手机分别配置并继承样式。支持 Flex/Grid、任意栅格轨道、跨行跨列、排列顺序、伸缩与对齐；支持 relative / absolute / sticky / fixed、四边偏移、层级和溢出。尺寸支持 px、%、vw / vh、rem / em、auto 及 calc / min / max / clamp。

组件可配置背景图或渐变、排版、边框、阴影、旋转缩放；内容、外层布局和悬停状态均可应用自定义 CSS 声明。CSS 通过校验后应用，不接受选择器、`@` 规则或脚本。页面设置可调整最大宽度、间距、主色、背景、字体和页面 CSS。图片支持不超过 1 MB 的 PNG、JPEG、WebP、GIF。

## 保存与数据边界

- 当前浏览器本机自动保存，最多 20 个页面，每页保留最近 5 个手动保存版本。
- 单页上限 500 个组件、嵌套 8 层；阻止循环层级和间接嵌套表单。
- 所有拖拽、内容编辑和自定义操作经过结构校验；无效结构恢复修改前内容。
- JSON 导入最多 32 MB；字段、样式与链接进行白名单校验。无效导入保留当前页面。
- 原有损坏存档备份、配额失败重试、多标签页冲突保护保持可用。
- 响应式样式通过容器查询生成，编辑画布与独立 HTML 使用同一套规则。
- HTML 内联 React / ZUI 运行时、组件样式和页面数据，不依赖 CDN；外链图片仍需网络。交互预览和独立 HTML 使用同一渲染器，浮层隔离在自己的 iframe 内。表单数据在浏览器处理，文件上传服务模式需要配置真实 HTTP 后端。

## 快捷键

| 按键                     | 行为                                 |
| ------------------------ | ------------------------------------ |
| ⌘ / Ctrl S               | 保存版本                             |
| ⌘ / Ctrl Z               | 撤销                                 |
| ⌘ / Ctrl Shift Z、Ctrl Y | 重做                                 |
| ⌘ / Ctrl D               | 复制组件及子组件                     |
| ⌘ / Ctrl C / X / V       | 复制、剪切、粘贴组件                 |
| Delete / Backspace       | 删除所选组件                         |
| Alt ↑ / ↓                | 上下移动组件，到边界时保持位置       |
| Esc                      | 选中父级、返回页面设置或关闭当前弹层 |

输入框保留原生文字编辑快捷键；输入框内保存仍保存页面版本。

## 本轮验证：全库与高度自定义

本轮 35 条编辑器浏览器回归、8 条文档单元测试均通过，类型检查、范围 ESLint、Prettier 及 GitHub Pages 构建通过。构建仍有分块高于 500 kB 的提示；编辑器和导出功能按需加载。验证记录及明暗/手机截图见 [builder-catalog 审计](audits/2026-11-10/builder-catalog/completeness-audit.md)。回归覆盖原有编辑器功能，以及全组件保存刷新与离线运行、复杂表单和附件、可视数据校验、自定义样式和动作、嵌套分栏及工作台模板。

```sh
pnpm exec playwright test --config e2e/playwright.config.ts e2e/builder.spec.ts e2e/builder-studio.spec.ts e2e/builder-layout.spec.ts e2e/builder-catalog.spec.ts --workers=2
pnpm --filter @zui/docs typecheck
pnpm --filter @zui/docs test
pnpm exec eslint docs/src/pages/builder docs/builder-runtime-plugin.ts docs/vite.config.ts e2e/builder-catalog.spec.ts e2e/builder-layout.spec.ts
GITHUB_PAGES_BUILD=true pnpm --filter @zui/docs build
git diff --check
```

当前为本地页面编辑器，不包含多人同步或后端数据服务。本轮未安装依赖、修改版本或执行发布。

## 历史验证：全库接入前

以下为此前版本的独立验证，不作为本轮全库扩展后已重跑全站的证据。

| 检查                                    | 结果                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| 全站浏览器回归                          | 本次 138 / 139 通过，3.7 分钟；唯一的协作页悬停对比度失败已修复 |
| 修复后受影响的协作页套件                | 24 / 24 通过，43 秒                                             |
| 其中页面编辑器                          | 28 / 28 通过                                                    |
| 文档站单元测试                          | 8 / 8 通过                                                      |
| 文档类型检查、改动范围 ESLint、Prettier | 通过                                                            |
| GitHub Pages 产物构建、diff 空白检查    | 通过                                                            |

最终结果记录在 [verification.json](audits/2026-11-10/builder-studio/verification.json)。本次[全站日志](audits/2026-11-10/builder-studio/completeness-initial-e2e.log)保留首次失败，修复后的[协作页回归日志](audits/2026-11-10/builder-studio/completeness-collaboration.log)记录受影响套件全部通过。此前 135 / 135 通过的结果保留在 [full-e2e.log](audits/2026-11-10/builder-studio/full-e2e.log)。

新增 11 条编辑器用例，覆盖响应式样式与刷新恢复、跨容器移动、锁定与隐藏、快捷键与排序边界、真实表单校验下载、全部区块组合与 JSON 往返、独立 HTML、三种宽度的实际编辑、缩放后的真实嵌套拖拽及按钮大小、图片上传复用、非法样式保护、原生图层拖动及结构保护。保留原搭建器 13 条保存、导入导出、异常恢复和明暗无障碍用例。

完整性复核再新增 4 条浏览器用例：百分比与最大宽度、分区与表单栅格、页内锚点真实滚动，以及样式复制/覆盖重置/撤销/自定义画布/专注模式。已修复拖拽包装层造成的宽度失真、容器内容的布局目标、预览锚点导航离开当前文档；画布与独立 HTML 使用相同组件尺寸结构。功能对应和实测证据见[完整性复核](audits/2026-11-10/builder-studio/completeness-audit.md)。

视觉检查已查看[完整浅色工作台](audits/2026-11-10/builder-studio/composed-page.png)、[完整深色工作台](audits/2026-11-10/builder-studio/composed-dark.png)与 [320px 编辑画布](audits/2026-11-10/builder-studio/editor-320.png)。完整样式面板在浅色、深色下执行 axe 检查；全站审计覆盖 78 页的 1440/320px、浅色/深色矩阵。

复现命令：

```sh
pnpm exec playwright test --config e2e/playwright.config.ts --workers=2
pnpm --filter @zui/docs typecheck
pnpm --filter @zui/docs test
pnpm exec eslint docs/src/pages/builder e2e/builder.spec.ts e2e/builder-studio.spec.ts e2e/builder-layout.spec.ts e2e/docs-smoke.spec.ts e2e/collaboration.spec.ts
GITHUB_PAGES_BUILD=true pnpm --filter @zui/docs build
git diff --check
```

构建仍提示编辑器与组件库分块超过 500 kB 的建议阈值；搭建器继续按路由懒加载。本轮未安装依赖、修改版本或执行发布。
