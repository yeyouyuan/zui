# Page Studio 完整性复核 · 2026-11-10

本次从当前源码和真实 Chromium 重新验证完整编辑流程。最初的 135 条全站通过结果保留在 `full-e2e.log`；本次全站回归记录在 `completeness-initial-e2e.log`，受影响套件复核记录在 `completeness-collaboration.log`。

## 复核发现与修复

1. **百分比宽度与最大宽度的作用层级不正确。** 原有样式写在组件内部，Puck 另有外部拖拽包装；横排容器中设置 50% 的标题实测只有约 40.5px，容器为 1200px。现在使用 Puck 的 inline / dragRef 接口，让编辑和导出使用同一个组件根节点，宽度、最大宽度与外边距作用于真正的 Flex/Grid 子项。外观保留在视觉组件上，避免百分比计算两次。新增浏览器用例测量实际宽度比例，并验证手机覆盖及离线 HTML。
2. **内容分区、表单与分栏的布局作用目标不一致。** Flex/Grid 设置现在应用到内容插槽；分区标题、表单标题和提交结果保持在内容布局之外。新增用例检查两列的实际宽度、对齐和标题位置，并验证手机单列与导出页面。
3. **预览中的页内锚点触发 iframe 导航。** 画布与独立 HTML 对普通页内链接执行当前文档滚动；目标不存在时保留预览。保留修饰键点击行为。用例使用超出首屏的内容，验证目标进入可视区且当前文档未被导航替换。
4. **补齐此前证据较弱的工具流程。** 实际操作复制全部设备样式、粘贴、重置手机覆盖、撤销恢复、820px 自定义宽度和专注模式，检查字号继承、iframe 宽度与工作区缩放。
5. **全站回归发现协作页下载按钮悬停对比度不足。** 首次全站执行为 138/139，唯一失败是协作页备份恢复后下载按钮的 hover 文字对比度为 4.38。按钮现在使用该页面已有的语义强调文字颜色，并在原用例中明确悬停后执行 axe。受影响的 24 条协作测试全部通过（43.0 秒），其余页面源码未因此修改。

## 最终验证

- 编辑器 28/28，包括原有 24 条及新增 4 条真实排版与工作流用例。
- 全站首次执行 138/139（3.7 分钟）；修复唯一失败后，协作套件 24/24。保留首次失败日志，未将分批验证记为单次 139/139。
- 文档站单元测试 8/8，类型检查、范围 ESLint、Prettier 和生产构建通过。
- 显示检查覆盖 78 个导航路由的桌面/手机、浅色/深色四组矩阵。编辑器另有 1440/768/320px 实际编辑测试。

## 功能与直接验证对应

| 用户流程                               | 实现入口                                                     | 浏览器验证                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 新建、重命名、复制、删除多页面         | `BuilderPage.tsx`、`use-builder-workspace.ts`                | `builder.spec.ts` 多页面管理与刷新恢复                                                                                   |
| 从组件库拖入、点击插入、组合预设区块   | `BuilderEditor.tsx`、`builder-snippets.ts`                   | `builder.spec.ts` 真实拖拽；`builder-studio.spec.ts` 六个区块组合与缩放拖拽                                              |
| 内容、样式、响应式与真实排版           | `BuilderInspector.tsx`、`builder-design.ts`                  | `builder-studio.spec.ts` 响应式与刷新；`builder-layout.spec.ts` 宽度、栅格、样式复制及重置                               |
| 图层移动、排序、复制、隐藏与锁定       | `BuilderEditor.tsx`、`builder-tree.ts`、`builder-config.tsx` | `builder-studio.spec.ts` 跨容器移动、原生图层拖动、状态、快捷键与结构保护                                                |
| 上传图片、复用资源、刷新保留           | `BuilderEditor.tsx`、`builder-config.tsx`                    | `builder.spec.ts` 真实图片；`builder-studio.spec.ts` 图片资源复用                                                        |
| 自动保存、版本、撤销重做、异常恢复     | `use-builder-workspace.ts`、`BuilderPage.tsx`                | `builder.spec.ts` 版本恢复、存储失败、损坏备份与多标签冲突                                                               |
| 画布交互、独立预览、表单校验和数据下载 | `builder-config.tsx`、`builder-export.tsx`                   | `builder.spec.ts` 离线表单；`builder-studio.spec.ts` 新控件；`builder-layout.spec.ts` 锚点                               |
| 页面 JSON、工作区备份、独立 HTML       | `builder-model.ts`、`BuilderPage.tsx`、`builder-export.tsx`  | `builder.spec.ts` 导入导出往返；`builder-studio.spec.ts` 组合页备份与隐藏；`builder-layout.spec.ts` 导出几何一致性       |
| 三种宽度、专注模式、主题和键盘         | `BuilderEditor.tsx`、`builder-studio.css`                    | `builder.spec.ts` 三宽度明暗主题与 axe；`builder-studio.spec.ts` 实际编辑；`builder-layout.spec.ts` 自定义宽度与专注模式 |

## 使用边界

这是当前浏览器上的本地页面工作台。保存使用浏览器存储；JSON 用于继续编辑及迁移；HTML 可独立使用。导出页面的表单在浏览器完成校验并生成下载数据，需要远程接收时应接入服务。外链图片依赖网络，本地上传图片随页面嵌入。

生产构建成功，仍有编辑器与组件库分块超过 500 kB 的体积提示；编辑器保持按路由懒加载。未安装依赖、变更版本或执行发布。

最新总数和检查状态以同目录 `verification.json` 为准。构建日志为 `completeness-pages-build.log`。
