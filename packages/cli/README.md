# @zui/cli

> v0.3.0 发布到 GitHub Packages：`@yeyouyuan/zui-cli`，npmjs 暂不发布。先在项目 `.npmrc` 配置 `@yeyouyuan:registry=https://npm.pkg.github.com`，再用拥有包读取权限的 GitHub 账号登录。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
pnpm add @zui/cli@npm:@yeyouyuan/zui-cli@0.3.0
```

源码导入继续使用 `@zui/cli`。完整认证和安装说明见仓库 [GitHub Packages 文档](https://github.com/yeyouyuan/zui/blob/main/docs/GITHUB-PACKAGES.md)。

ZUI registry 命令行工具：把 registry 里的组件**源码**复制进你的项目（可自由修改），并提供
上游更新对比通道。零运行时依赖，纯 `process.argv` 解析。

## 命令（契约 §3）

```bash
pnpm dlx @yeyouyuan/zui-cli@0.3.0 init                     # 交互式初始化：检测框架、配置目标目录、写 .zurc.json
pnpm dlx @yeyouyuan/zui-cli@0.3.0 add button               # 复制 Button.tsx + Button.css 到 src/components/ui/button/
pnpm dlx @yeyouyuan/zui-cli@0.3.0 add button modal         # 多组件
pnpm dlx @yeyouyuan/zui-cli@0.3.0 add --all                # 复制全部组件与业务块
pnpm dlx @yeyouyuan/zui-cli@0.3.0 diff button              # 本地副本 vs registry 的 unified diff（上游更新通道）
pnpm dlx @yeyouyuan/zui-cli@0.3.0 list                     # 列出 registry 所有组件
pnpm dlx @yeyouyuan/zui-cli@0.3.0 list --json              # JSON 输出整个 registry
```

## 选项

| 选项                           | 说明                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `-c, --components <dir>`       | 组件目标目录（默认 `src/components/ui`）                          |
| `--framework <name>`           | 指定框架，跳过检测（next / vite / react-scripts / remix / react） |
| `--registry <path>`            | 指定 `registry.json` 路径（默认自动定位）                         |
| `--cwd <dir>`                  | 指定项目目录（默认当前目录）                                      |
| `--json`                       | `list` 以 JSON 输出                                               |
| `-y, --yes`                    | 非交互，全部取默认                                                |
| `-f, --force`                  | `init` 覆盖已有 `.zurc.json`                                      |
| `-h, --help` / `-v, --version` | 帮助 / 版本                                                       |

## .zurc.json

`zui init` 写入项目根：

```json
{
  "components": "src/components/ui",
  "framework": "next",
  "language": "ts"
}
```

- `components`：组件复制目标目录（相对项目根或绝对路径）。
- `registry`（可选）：自定义 registry.json 路径。

## registry 定位顺序

1. `--registry <path>` 参数
2. `ZUI_REGISTRY` 环境变量
3. `.zurc.json` 的 `registry` 字段
4. 自 cwd 向上找 `registry/registry.json`
5. 包内 `data/registry/registry.json`（发布包自带源码与元数据）
6. 自 CLI 包位置向上找（monorepo 开发态直接 `node packages/cli/dist/index.js` 运行）

## add 行为

- 组件文件复制到 `<components>/<组件名>/<原文件名>`（如 `src/components/ui/button/Button.tsx`）。
- 公共 utils/config/styles 放到 `<components>/_zui/`，业务块放到 `<components>/blocks/<name>/`；转换相对导入与样式入口。
- 自动补齐 `registryDependencies`（组件间依赖，递归去重）。
- 已存在且内容一致 → `skipped`；已存在且不同 → `updated`（覆盖式同步，registry 为准）。
- 输出 import 提示与需要安装的 npm `dependencies`（无则提示仅 react peer 依赖）。

```bash
pnpm dlx @yeyouyuan/zui-cli@0.3.0 add button modal
#   created  src/components/ui/button/Button.css
#   created  src/components/ui/button/Button.tsx
#   created  src/components/ui/modal/Modal.css
#   created  src/components/ui/modal/Modal.tsx
# import 提示：import { Button } from './src/components/ui/button'; // Button 按钮
# 按 GitHub Packages 文档中的别名方式安装 @zui/icons / @zui/i18n / @zui/tokens 等依赖；另需 react / react-dom。
```

## diff 行为

对比经过相同路径和导入转换后的 registry 源文件与本地副本，输出 unified diff：

- 一致 → `无差异`
- 有差异 → `state = changed`，给出 `--- a/... +++ b/...` patch（本地为 a，registry 为 b）
- 本地缺失 → `state = missing`，整个文件作为新增行

## 开发

```bash
cd packages/cli
npx tsc -p tsconfig.json     # 编译到 dist/
npx vitest run               # 测试（init/add 文件复制、diff、argv 解析、registry 契约）
```

测试用 mock registry + 临时目标目录验证 init/add 的文件复制逻辑，并对真实
`registry/registry.json` 做 schema 校验与 `add button` 端到端冒烟。

## 相关

- registry 生成脚本与 schema：见 [`registry/README.md`](../../registry/README.md)
