# ZUI v0.2.0 发布清单

适用包：`@zui/react`、`@zui/tokens`、`@zui/icons`、`@zui/i18n`、`@zui/cli`、`@zui/mcp`、`@zui/blocks`。

## 当前状态（2026-11-07）

- 七包版本和 CHANGELOG 已更新至 `0.2.0`，原 changeset 已消费。**不要再次执行 `changeset version`**。
- Registry 为 66 个组件、16 个业务区块；Anchor 已有源码、导出、文档和 Registry 条目。
- 七包已有独立 LICENSE，`@zui/react` 已有 README；`@zui/blocks` 对 `@zui/react` 的依赖已移入 `dependencies`。
- GitHub `main` 当前为 `3ec226b`，公开 Pages 的 `v0.2.0` JS、CSS 与演示页均可访问；远端仍无 `v0.2.0` tag。`@zui/react@0.2.0` 在 npm 查询为 404，当前机器 `npm whoami` 为 `ENEEDAUTH`，因此 unpkg 尚不可用。
- 文档 71 个导航路由已完成 320px 暗色静态布局审计；概览、图标库和 16 个业务区块另做桌面/窄屏/暗色及关键交互复核。66 个组件的全部打开态、长文案和原生 200% 缩放仍属于持续增强验收，不作为本次本地发布门禁的阻塞项。

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

- [x] 七包 `package.json` 的版本均为 `0.2.0`，内部依赖可由 workspace 构建和消费者检查正确解析。
- [x] 七包 `CHANGELOG.md` 条目已按 66 个组件、10 套语言包、142 枚图标和 16 个业务区块核对。
- [x] 每包 tarball 包含构建产物、README、LICENSE；CLI/MCP 包还包含 `data/registry/registry.json`。
- [x] `@zui/react` tarball 包含 `dist/browser/zui.global.js`、`zui.css`、`LICENSE.txt`，`unpkg` 字段指向浏览器脚本。
- [x] `docs/dist/cdn/v0.2.0/` 有同一组三个浏览器产物，`docs/public/cdn-demo.html` 已指向公开的 `v0.2.0`。
- [x] 七包 `npm pack --dry-run` 不含测试、stories、`node_modules` 等开发文件；`@zui/tokens` 的 CSS 导出和源码令牌、`@zui/blocks` 的源码分发均按包清单保留。

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
- [ ] 当前 `v0.2.0` JS、CSS 与演示页返回成功；推送本次最终提交并等待 Pages 重建后再次验证。
- [ ] 线上浏览器打开脚本演示，确认 `ZUI.createRoot` 与组件样式正常；随后更新 README/演示页的默认示例版本。
- [ ] 发布完成后核对 Git tag、npm 七包版本、unpkg 和 Pages 版本一致。
