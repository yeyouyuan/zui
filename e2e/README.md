# ZUI 文档站 Playwright E2E 冒烟

针对 `docs/` hash 路由文档站的 67 条浏览器测试。默认端口为 **5174**，可用
`ZUI_E2E_PORT` 指定独立端口。覆盖四个核心起始页、Form / Select / Combobox / Modal / 日期范围 / VirtualTable
交互、暗色切换、移动菜单与页内目录，以及 77 个导航路由在 1440px / 320px、浅色 / 暗色四种组合下的溢出、示例裁切、图片加载与文字对比度检查。全站另有 `pageerror` / `console.error` 检查。

## 文件

| 文件                                                             | 说明                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`                                           | 配置：`testDir: '.'`、可配置 baseURL 端口、Chromium、viewport 1280×800、webServer 自动拉起/本地复用  |
| `docs-design.spec.ts`                                            | 概览预览、命令入口、示例代码与过滤清除、本地头像与图片回退、命令面板开关与穿梭框复选状态，共 5 条    |
| `docs-loading.spec.ts`                                           | 冷切页保留正文、快速改选、首次占位与减少动画偏好，共 2 条                                            |
| `docs-page-audit.spec.ts`                                        | 77 个导航路由的四组显示矩阵，共 4 条；可用 `ZUI_AUDIT_DIR` 导出每页截图与 JSON 报告                  |
| `collaboration.spec.ts`                                          | 内容协作原型：编辑、引用、评论与回复、解决/重新打开、文件隔离、状态和权限、320px 暗色与 axe，共 3 条 |
| `docs-smoke.spec.ts`                                             | 22 条冒烟用例，含全路由 320px 布局审计、焦点管理与 console error 监听                                |
| `command-palette-docs.spec.ts` / `command-palette-admin.spec.ts` | 文档与后台命令面板双迁移，共 14 条                                                                   |
| `sidenav-prototype.spec.ts`                                      | 侧边导航双迁移，共 8 条                                                                              |
| `splitter-prototype.spec.ts`                                     | 可调分栏双迁移，共 5 条                                                                              |
| `datagrid-prototype.spec.ts`                                     | DataGrid 性能原型，共 4 条                                                                           |

> 2026-11-09：67 条用例完整运行全部通过，含 Transfer 复选状态与 77 页四组显示矩阵。完整记录见 [本轮审计](../docs/quality-audit-2026-11-09.md)。

## 首次安装（一次性）

浏览器二进制不随 `pnpm install` 下载，首次需要：

```bash
pnpm add -D -w @playwright/test   # 已在根 package.json devDeps 中
npx playwright install chromium   # 只需执行一次（缓存在 ~/Library/Caches/ms-playwright）
```

## 运行

**必须带 `--config`**（config 在 e2e/ 内，根目录裸跑 `npx playwright test` 会以仓库根为
testDir，把 packages/ 里的 vitest 单测也当用例收集，报「Vitest failed to access its
internal state」）：

```bash
pnpm test:e2e                                              # 推荐入口（等价下行）
npx playwright test --config e2e/playwright.config.ts --reporter=line
npx playwright test --config e2e/playwright.config.ts -g "Select"   # 只跑匹配用例
ZUI_E2E_PORT=5175 pnpm test:e2e                            # 指定空闲端口
```

webServer 行为：Playwright 先探测 `http://localhost:<ZUI_E2E_PORT>`（未设置时为 5174）：

- **已有手动 dev server 在监听**（`pnpm dev` / `pnpm --filter @zui/docs dev`）→ 本地直接复用，不执行 webServer command；
- **目标端口空闲** → 自动执行 `pnpm --filter @zui/docs dev --port <port> --strictPort`，测试结束后关闭；
- **CI** → 不复用已有服务，避免误测残留进程。

只跑单条用例可加过滤：`pnpm test:e2e -g "Select"`。

## 与手动 dev server 并存

手动起的目标端口完全兼容：本地 config 的 `reuseExistingServer: true` 使 Playwright 探测到
url 已在监听就跳过 command（`--strictPort` 因此不会产生端口抢占）。反过来，
先跑测试（自动拉起 server）再想手动开发，请等测试结束，或手动起 server 后再跑测试。

## CI

```yaml
- run: pnpm install
- run: npx playwright install --with-deps chromium # 容器内补系统依赖
- run: pnpm test:e2e # CI 中 retries=2、reporter=github
```

要点：

- config 已按 `process.env.CI` 切换 `retries: 2` 与 `github` reporter，无需额外参数；
- CI 环境通常无手动 dev server，webServer 会以 `--strictPort` 自动拉起并回收；
- 失败时会保留 trace（`trace: 'retain-on-failure'`），用
  `npx playwright show-trace test-results/<case>/trace.zip` 回放。

## 用例纪律（约定）

- hash 路由切换一律 `page.evaluate(() => { location.hash = ... })`：
  同源 `page.goto` 改 hash 不触发 `hashchange`，不会重渲染；
- locator 全部 strict：断言前先 `toHaveCount(...)` 收敛，多实例页面用 `.first()`/`.nth()` 明确选取；
- 断言全部使用 web-first assertions（`expect(locator).toBeVisible()` 等）；
- 组件文案断言使用站内中文文案（如「请输入用户名」「导出报告」「当前值：en」）；
- 浮层（Select 列表、DatePicker 面板、Modal）经 Portal 渲染到 `document.body`，
  定位不挂在触发器子树下，用 `[data-open="true"]` / `[data-state="open"]` 区分开合态。

## 已验证修复与已知行为

- **Form StrictMode 字段注册**：`Form.Item` 的注册和注销现都在 effect 内，
  E2E 直接提交空表单，不经过预填或重渲染，验证错误提示和 `aria-invalid`。
- **VirtualTable 滚动钳制**：`scrollTop` 超过 `totalHeight + rowHeight - height` 会被
  组件钳回最大值，冒烟用例直接滚到底部断言末行（aria-rowindex=1001）出现。
