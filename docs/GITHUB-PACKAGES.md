# GitHub Packages

本次发布使用 GitHub 的 npm registry（https://npm.pkg.github.com），不向 npmjs 发布。源码继续使用 @zui/*，发布名称归属 GitHub 仓库账号。

| 源码与安装别名 | GitHub Packages 名称  |
| -------------- | --------------------- |
| @zui/react     | @yeyouyuan/zui-react  |
| @zui/blocks    | @yeyouyuan/zui-blocks |
| @zui/icons     | @yeyouyuan/zui-icons  |
| @zui/tokens    | @yeyouyuan/zui-tokens |
| @zui/i18n      | @yeyouyuan/zui-i18n   |
| @zui/cli       | @yeyouyuan/zui-cli    |
| @zui/mcp       | @yeyouyuan/zui-mcp    |

## 安装

在项目 .npmrc 中配置：

```ini
@yeyouyuan:registry=https://npm.pkg.github.com
```

GitHub Packages 的 npm 安装需要身份验证。使用有读取包权限的 GitHub 账号和 classic PAT 的 read:packages 权限登录，token 作为 npm login 的密码输入；组织启用 SSO 时还需要授权该 token。不要提交令牌。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @zui/react@npm:@yeyouyuan/zui-react@0.3.0 @zui/blocks@npm:@yeyouyuan/zui-blocks@0.3.0
```

```tsx
import '@zui/react/styles.css';
import { Button } from '@zui/react';
import { DashboardBlock } from '@zui/blocks';
```

按需安装其他包时使用同样的别名形式，例如：

```bash
npm install @zui/tokens@npm:@yeyouyuan/zui-tokens@0.3.0 @zui/icons@npm:@yeyouyuan/zui-icons@0.3.0
npm install --save-dev @zui/cli@npm:@yeyouyuan/zui-cli@0.3.0 @zui/mcp@npm:@yeyouyuan/zui-mcp@0.3.0
npx zui list
```

内部依赖也使用 npm aliases，确保区块中的 @zui/react 导入和声明能够解析。直接安装发布名称仍可使用该包，但生成的代码示例使用 @zui/*，推荐上面的别名方式。

## 发布流程

七个公开包保持相同版本。先完成全站回归、工作区检查、构建和分发检查，再在对应提交发布同版本 GitHub Release（例如 v0.3.0）。Publish GitHub Packages 工作流只向 npm.pkg.github.com 发布，通过 GITHUB_TOKEN 的 packages:write 权限认证；也可手动触发工作流。

```bash
pnpm build
pnpm --filter @zui/react build:browser
node scripts/check-distribution.mjs
node scripts/check-consumer.mjs
pnpm release:prepare
node scripts/check-github-packages.mjs --local
```

prepare 脚本从 npm pack 实际文件清单创建暂存包，重写发布名称和内部依赖，关联 yeyouyuan/zui 仓库，输出七个 tarball、SHA-512 完整性值和清单。它不修改源码名称，不包含测试、依赖目录或开发脚本。

local 检查通过临时本机 registry 安装这些 tarball，以验证真实 npm aliases 解析及内部依赖；同时执行 ESM、CommonJS、React 19 SSR、CSS 导出、CLI、MCP stdio 和严格 TypeScript 声明检查。发布之后，工作流重新从 GitHub registry 安装七个版本并重复检查，结果保存为工作流附件。

发布脚本只允许清单中的 owner scope，校验 tarball 的 SHA-512；重跑时只跳过同版本且内容相同的包。发现已存在但内容不同的版本会停止，不覆盖版本。

包的实际可见性和访问权限以 GitHub 包设置为准；工作流安装成功代表对应仓库的令牌可读取。需要向其他仓库开放时，配置包的 Actions access 或使用拥有该包读取权限的凭据。

## 前端功能范围

页面搭建器是页面设计工具。导出包含页面样式和交互的 HTML；多页原型共享一个 HTML，可离线打开。工作区、主组件和本地内容协作数据保存在当前浏览器，建议定期导出备份。REST 数据源为浏览器端只读 GET，受目标服务的 CORS 约束，不包含业务后端或账号服务。
