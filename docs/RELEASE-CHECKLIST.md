# ZUI v0.2.0 发布清单

适用包：`@zui/react`、`@zui/tokens`、`@zui/icons`、`@zui/i18n`、`@zui/cli`、`@zui/mcp`、`@zui/blocks`。

## 当前状态（2026-11-07）

- 七包版本和 CHANGELOG 已更新至 `0.2.0`，原 changeset 已消费。**不要再次执行 `changeset version`**。
- Registry 为 66 个组件、16 个业务区块；Anchor 已有源码、导出、文档和 Registry 条目。
- 七包已有独立 LICENSE，`@zui/react` 已有 README；`@zui/blocks` 对 `@zui/react` 的依赖已移入 `dependencies`。
- GitHub `main` 仍是 `06dbaaa`，公开 Pages 脚本仍只有 `v0.1.0`。`@zui/react` 在 npm 查询为 404，当前机器 `npm whoami` 为 `ENEEDAUTH`。因此 unpkg 的 `v0.2.0` 脚本尚不可用。
- 组件视觉验收仍在继续；自动测试通过不能代表 66 个组件的全部打开态、暗色和缩放状态已逐一验收。

## 1. 发布前验证

在仓库根目录运行，任何一步失败都先修复，再继续：

```bash
pnpm install --frozen-lockfile
node registry/scripts/generate.mjs --check
pnpm -r build
pnpm -r typecheck
pnpm lint
pnpm -r test
ZUI_E2E_PORT=5175 pnpm test:e2e
pnpm --filter @zui/react build:browser
node scripts/check-distribution.mjs
node scripts/check-consumer.mjs
```

E2E 可用 `ZUI_E2E_PORT` 选空闲端口，避免复用已有文档服务。CI 安装 Chromium 并运行同一套浏览器测试。检查 ESM gzip 小于 CI 的 96 KiB 门槛。

## 2. 检查发布产物

- [ ] 七包 `package.json` 的版本均为 `0.2.0`，内部依赖解析到对应 `0.2.0` 包。
- [ ] 七包 `CHANGELOG.md` 条目与实际功能一致，尤其核对原文中已过时的版本、组件、语言包、图标与业务区块计数。
- [ ] 每包 tarball 包含构建产物、README、LICENSE；CLI/MCP 包还包含 `data/registry/registry.json`。
- [ ] `@zui/react` tarball 包含 `dist/browser/zui.global.js`、`zui.css`、`LICENSE.txt`，`unpkg` 字段指向浏览器脚本。
- [ ] `docs/dist/cdn/v0.2.0/` 有同一组三个浏览器产物。`docs/public/cdn-demo.html` 当前仍指向公开的 `v0.1.0`；Pages 部署 `v0.2.0` 后再同步更新演示页。
- [ ] 七包 `npm pack --dry-run` 不含测试、stories、`node_modules` 等开发文件。`@zui/tokens` 与 `@zui/blocks` 当前仍将 `src` 列入 `files`；确认这是期望的源码分发后再发布。

## 3. 发布 npm 与 unpkg

发布账号需要 `@zui` scope 的公开包发布权限，并先在本机或受控 CI 完成 npm 认证。凭据只存 npm/CI 安全配置，不写入仓库。

```bash
npm whoami
npx changeset publish
npm view @zui/react@0.2.0 version
```

发布后核对七包版本及 `@zui/react` tarball 的浏览器产物，再用真实 URL 验证 unpkg 的 JS 与 CSS 返回成功且可在普通 HTML 页面调用 `window.ZUI`。unpkg 是 npm 包的 CDN，不需要单独上传；npm 未发布前不能引用其 URL 作为已上线资源。

## 4. GitHub 与 Pages

确认工作区改动和最终 diff 后，提交并推送 `main`，再创建并推送 `v0.2.0` tag。Pages 工作流在 `main` 推送后会重建文档和 `cdn/v0.2.0/`。

- [ ] GitHub 上确认 `main` 包含本次提交、CI 全绿、Pages 部署成功。
- [ ] 线上验证 `https://yeyouyuan.github.io/zui/cdn/v0.2.0/zui.global.js`、`zui.css` 和文档站页面均返回成功。
- [ ] 线上浏览器打开脚本演示，确认 `ZUI.createRoot` 与组件样式正常；随后更新 README/演示页的默认示例版本。
- [ ] 发布完成后核对 Git tag、npm 七包版本、unpkg 和 Pages 版本一致。
