# ZUI v0.2.0 发布清单

适用包：`@zui/react`、`@zui/tokens`、`@zui/icons`、`@zui/i18n`、`@zui/cli`、`@zui/mcp`、`@zui/blocks`。

## v0.2.0 发布基线（2026-11-07 历史记录）

- 七包版本和 CHANGELOG 已更新至 `0.2.0`，原 changeset 已消费。**不要再次执行 `changeset version`**。
- Registry 为 66 个组件、16 个业务区块；Anchor 已有源码、导出、文档和 Registry 条目。
- 七包已有独立 LICENSE，`@zui/react` 已有 README；`@zui/blocks` 对 `@zui/react` 的依赖已移入 `dependencies`。
- GitHub `main` 已包含质量提交 `c7fec2f` 与 Pages 依赖构建修复 `e60a06f`；对应 CI、Pages、`v0.2.0` JS/CSS 和在线脚本演示均已验证成功。远端仍无 `v0.2.0` tag，npm/unpkg 仍等待发布认证。
- 文档 71 个导航路由已完成 320px 暗色静态布局审计；概览、图标库和 16 个业务区块另做桌面/窄屏/暗色及关键交互复核。66 个组件的全部打开态、长文案和原生 200% 缩放仍属于持续增强验收，不作为本次本地发布门禁的阻塞项。

## 当前开发分支（2026-11-09）

- 源码现有 71 个组件、16 个业务区块，Registry 共 87 个条目；文档有 77 个公开导航路由。
- 文档完成导航分组、切页保留正文与 77 页四组显示矩阵；内容协作为设计原型。67 条 E2E 全部通过，最新验证与边界见 [本轮审计](quality-audit-2026-11-09.md)。
- Combobox / MultiCombobox、SideNav、Splitter、CommandPalette 已实现，五份 minor changeset 和一份 patch changeset 等待下一版本统一消费。包版本仍为 `0.2.0`；此处源码数量不代表 npm 已发布内容。
- CommandPalette 仍需真实中文输入法、VoiceOver / NVDA 和 macOS / Windows 热键人工验收，见 [RFC 第 15 节](./rfcs/command-palette.md)。DataGrid 处于性能原型与 RFC 评审阶段。
- 本次已重新核验 GitHub 认证和远端分支；用户授权先同步 GitHub 并部署 Pages，npm 稍后继续。npm 当前未登录，包版本与 changeset 本轮不消费；正式 npm 发布前再确认 scope 权限和版本。

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

- [x] GitHub 上确认 `e60a06f` 已进入 `main`，对应 CI 全绿、Pages 部署成功。
- [x] `e60a06f` 对应部署的 `v0.2.0` JS、CSS 与演示页返回成功，入口引用与最终产物哈希一致。
- [x] 在线打开该部署的脚本演示，确认 `ZUI.createRoot`、Button 样式与点击交互正常，且无页面异常或 console error。
- [ ] 发布完成后核对 Git tag、npm 七包版本、unpkg 和 Pages 版本一致。
