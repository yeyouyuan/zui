# ZUI registry

`registry.json` 从组件、业务块和公共源码生成，供 CLI 复制与 MCP 查询。
v0.4.0 包含 73 个组件、16 个业务块，共 89 个条目。`OfficeEditor` 需要 ONLYOFFICE Docs；`OfficeStudio` 使用 ZUI 与独立编辑内核，无需文档服务器，支持 Word 图片/页眉页脚/查找替换、Excel 工作表与行列增删/合并/冻结/筛选排序/原生图表和 PDF 绘图/文字查找/普通表单。`OfficeStudio` 的 UI 条目包含编辑内核与 ZUI 依赖；真实文件 codec、PDF worker/字体、打印及历史版本持久化由宿主适配，文档示例中的适配器不随此条目复制。接入与格式限制见 [OfficeStudio 说明](../docs/office-studio.md)。

```bash
node registry/scripts/generate.mjs
node registry/scripts/generate.mjs --check
```

生成器扫描 `packages/ui/src/components/` 与 `packages/blocks/src/*/block.json`。
组件目录包含 `.ts`、`.tsx`、`.css` 和 `index.ts` 出口，排除测试和 stories。
`meta.json` 提供描述、API 和依赖信息，缺失描述时从文档页兜底。

清单顶层字段：

| 字段           | 用途                                             |
| -------------- | ------------------------------------------------ |
| `items`        | 组件或业务块条目                                 |
| `sharedFiles`  | utils、config、styles 公共源码                   |
| `dependencies` | 公共源码所需 npm 依赖，包括 CSS 中的令牌包       |
| `exports`      | 公开符号到组件 barrel 的映射，供业务块本地化导入 |

每条目包含 `name`、`type`（`registry:component` / `registry:block`）、`title`、
`description`、`dependencies`、`registryDependencies`、`files`、`cssVars`、`meta`。
依赖由 metadata 声明与源码扫描合并，组件间依赖递归安装。

CLI 将组件放到 `<components>/<kebab-name>/`、业务块放到 `<components>/blocks/<name>/`、
公共源码放到 `<components>/_zui/`，并转换相对路径、业务块组件导入和样式入口。
`add` 与 `diff` 共用同一转换，比较的是用户项目最终接收的代码。

```bash
pnpm dlx @zui/cli list
pnpm dlx @zui/cli add button form-page
pnpm dlx @zui/cli diff button
```

`registry/scripts/bundle.mjs` 在 CLI/MCP 构建时将清单、源码和 metadata 打包到各包的 `data/`，
安装后可独立工作，无需另行获取本仓库。详见 [CLI 文档](../packages/cli/README.md)。
