# @zui/react

> v0.3.0 发布到 GitHub Packages：`@yeyouyuan/zui-react`，npmjs 暂不发布。先在项目 `.npmrc` 配置 `@yeyouyuan:registry=https://npm.pkg.github.com`，再用拥有包读取权限的 GitHub 账号登录。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
pnpm add @zui/react@npm:@yeyouyuan/zui-react@0.3.0
```

源码导入继续使用 `@zui/react`。完整认证和安装说明见仓库 [GitHub Packages 文档](https://github.com/yeyouyuan/zui/blob/main/docs/GITHUB-PACKAGES.md)。

ZUI 组件库核心包：当前源码含 71 个 Registry 组件条目，令牌驱动、零运行时样式、无障碍优先。

```bash
pnpm add @zui/react@npm:@yeyouyuan/zui-react@0.3.0
```

```tsx
import '@zui/react/styles.css';
import { Button } from '@zui/react';

<Button variant="primary">开始使用</Button>;
```

- 71 个 Registry 组件条目覆盖表单 / 数据展示 / 反馈 / 导航 / 浮层；新增 Combobox / MultiCombobox、SideNav、Splitter 与 CommandPalette（完整清单见仓库根 README）
- 三层 Design Token（CSS 变量），`ConfigProvider locale` 内置 10 套语言包
- 组合式 API（`Modal.Trigger` 等）+ `data-part` / `classNames` / 组件级 CSS 变量三件套定制出口
- 附带 CDN IIFE 构建（`build:browser` → `dist/browser/zui.global.js`，随 GitHub Pages 部署）

文档：仓库 `docs/` 站（`pnpm --filter @zui/docs dev`）。
