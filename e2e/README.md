# ZUI 文档站 Playwright E2E 冒烟

针对 `docs/` hash 路由文档站的 163 条浏览器测试。默认端口为 **5174**，可用
`ZUI_E2E_PORT` 指定独立端口。覆盖四个核心起始页、Form / Select / Combobox / Modal / 日期范围 / VirtualTable
交互、暗色切换、移动菜单与页内目录，以及 78 个导航路由在 1440px / 320px、浅色 / 暗色四种组合下的溢出、示例裁切、图片加载与文字对比度检查。全站另有 `pageerror` / `console.error` 检查。

当前 0.3.0 发布验证：**163/163 passed（9.1 分钟）**，零失败、零跳过、零不稳定。78 个导航路由在四组尺寸/主题下共 312 次显示检查全部通过。记录见 `docs/audits/2026-11-10/release/`。

## 文件

| 文件                                                             | 说明                                                                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`                                           | 配置：`testDir: '.'`、可配置 baseURL 端口、Chromium、viewport 1280×800、webServer 自动拉起/本地复用                                                                     |
| `docs-design.spec.ts`                                            | 概览预览、命令入口、示例代码与过滤清除、本地头像与图片回退、命令面板开关与穿梭框复选状态，共 5 条                                                                       |
| `docs-loading.spec.ts`                                           | 冷切页保留正文、快速改选、首次占位与减少动画偏好，共 2 条                                                                                                               |
| `blocks.spec.ts`                                                 | 16 个业务区块的分类搜索、状态保留、重置、手机目录与四种宽度明暗主题检查，共 11 条                                                                                       |
| `builder.spec.ts`                                                | 真实拖拽与图片、多页面管理、编辑历史、JSON 备份、独立 HTML 表单、存储失败与冲突，以及三种宽度明暗主题检查，共 13 条                                                     |
| `builder-studio.spec.ts`                                         | 完整编辑器：内容与响应式样式、图层管理与快捷键、六个区块组合、独立表单、三种宽度实际编辑、缩放拖拽、图片资源、非法样式与结构保护，共 11 条                              |
| `builder-layout.spec.ts`                                         | 编辑器完整性：真实百分比与最大宽度、分区与表单栅格、页内锚点滚动、样式复制与重置、自定义画布和专注模式，共 4 条                                                         |
| `docs-page-audit.spec.ts`                                        | 78 个导航路由的四组显示矩阵，共 4 条；可用 `ZUI_AUDIT_DIR` 导出每页截图与 JSON 报告                                                                                     |
| `collaboration.spec.ts`                                          | 本地文件工作台：真实文件导入、完整编辑、下载、持久保存、备份恢复、存储失败重试、标签页冲突、文件管理、评论与草稿，以及 1440/1280/768/320px 明暗布局和完整 axe，共 24 条 |
| `ui-lab.spec.ts`                                                 | 10 个新设计的实际状态变化、目录状态保留、焦点、复制 CSS，以及桌面/320px 明暗主题完整 axe，共 12 条                                                                      |
| `docs-smoke.spec.ts`                                             | 22 条冒烟用例，含全路由 320px 布局审计、焦点管理与 console error 监听                                                                                                   |
| `command-palette-docs.spec.ts` / `command-palette-admin.spec.ts` | 文档与后台命令面板双迁移，共 14 条                                                                                                                                      |
| `sidenav-prototype.spec.ts`                                      | 侧边导航双迁移，共 8 条                                                                                                                                                 |
| `splitter-prototype.spec.ts`                                     | 可调分栏双迁移，共 5 条                                                                                                                                                 |
| `datagrid-prototype.spec.ts`                                     | DataGrid 性能原型，共 4 条                                                                                                                                              |

> 2026-11-10 完整性复核：再新增 4 条实际排版与工作流用例，编辑器 **28/28**。全站执行 **138/139（3.7 分钟）**，唯一失败是协作页下载按钮悬停对比度；修复后协作套件 **24/24（43.0 秒）**。保留首次失败和修复日志，见[完整性复核](../docs/audits/2026-11-10/builder-studio/completeness-audit.md)。
>
> 2026-11-10 完整页面编辑器：新增 11 条用例，编辑器共 24 条，完整回归 **135 passed (2.5m)**。覆盖真实缩放拖拽、原生图层拖动、响应式样式、资源复用、结构保护、完整样式面板明暗 axe 与 78 页四组审计。详见[编辑器功能与验证记录](../docs/page-studio-2026-11-10.md)。
>
> 2026-11-10 业务区块与搭建器：新增 24 条用例后，完整回归 **124 passed (2.1m)**。独立 HTML 的间距补齐后，搭建器全部 **13 passed (19.0s)** 再次通过。详见[功能与验证记录](../docs/blocks-builder-2026-11-10.md)。
>
> 2026-11-10 本地工作台：新增真实文件、持久化、备份和错误恢复等 8 条用例后，完整回归 **100 passed (1.7m)**，包括协作页 24 条与 78 页四组显示矩阵。详见[本地工作台记录](../docs/collaboration-local-2026-11-10.md)。
>
> 2026-11-10 交互补充阶段：协作页新增草稿隔离、引用版本和键盘操作等 5 条用例后，当时定向回归 `16 passed (15.0s)`。响应式用例同时检查带引用的评论输入区与正文编辑状态，执行完整 axe 并保存截图。当时未重跑 92 条全量用例，后续结果见上条。
>
> 2026-11-10：协作界面优化后，完整回归为 86/87 通过；DataGrid 列宽计时出现 81.5ms，超过 64ms 预算，保持预算不变后单进程连续复核 3 次通过。协作页当时的 11 条与 78 页四组显示矩阵全部通过。见[协作界面记录](../docs/collaboration-ui-2026-11-10.md)。
>
> 2026-11-09：新增组件创意工坊后，完整回归 `79 passed (1.5m)`，覆盖 78 页四组显示矩阵。补查规则上限删除后工坊 12/12 再次通过。见[设计与验证记录](../docs/ui-design-lab-2026-11-09.md)。此前 67 条完整回归是加入工坊前的基线，保留在[原审计](../docs/quality-audit-2026-11-09.md)。

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
