# ZUI 71 组件全量交互审计（2026-11-11）

## 范围与结论

本轮对 `packages/ui/src/components` 中的 71 个正式组件做全量交互审计，按组件逐项复核键盘与焦点、ARIA 语义、受控/非受控状态、浮层与关闭顺序、SSR、卸载清理、强制色彩、RTL、减少动态效果、触控目标，以及对应文档示例。审计对象为当前源码与回归测试，不把 Builder、内容协作、DataGrid 等文档原型计入 71 个正式组件。

- **P0：0 项。** 未发现会造成全局不可用、数据破坏或无法绕过的阻断问题。
- **P1：已完成。** 全部 P1 交互缺陷已在提交 `aa67673`（`fix: resolve all P1 interaction defects from full component audit`）修复并补回归。
- **第一批 P2：已完成。** 提交 `112dfe3` 完成第一批实现修复；其后的当前工作树补齐复核中仍缺的明确测试。覆盖类别包括焦点、ARIA、受控状态、`forced-colors`、RTL、`prefers-reduced-motion`、触控目标与 Pointer Events，以及 docs 可访问性/响应式细节。

## 第一批测试缺口复核

| 项目                 | 当前覆盖                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Image 预览焦点归还   | 0.3 已有回归；覆盖键盘打开、Esc 关闭以及 Modal 内逐层关闭后回到原图。                                       |
| Watermark SSR        | 已有 `renderToString` 回归；确认服务端不访问 DOM，并输出稳定 SVG data URI。                                 |
| Anchor 卸载监听      | 本工作树新增回归；确认卸载时移除目标容器的 `scroll` / `scrollend` 与 window 的 `resize` 监听。              |
| Popover 叠层         | 已有回归；覆盖双 Popover、Popover 与 Modal 的栈顶 Esc 仲裁，以及 Modal 内 Popover 的 `z-index` 高于来源层。 |
| Message closing 驱逐 | 已有回归；`max` 只驱逐 open 条目，跳过 closing 条目，且 `onClose` 不重复通知。                              |

除 Anchor 卸载清理外，其余列出的缺口都已由现有测试覆盖，因此未重复添加同义用例。本次只改测试和文档，未修改组件实现。

## 第一批 P2 完成类别

- **焦点**：打开后初始焦点、关闭归还、键盘/指针操作后的焦点连续性、树与传输列表的动态焦点恢复。
- **ARIA**：`aria-activedescendant`、`aria-current`、`aria-selected`、`aria-checked`、`aria-modal`、live region 及可访问名称与可见状态一致。
- **受控状态**：父级接受或拒绝更新均在提交周期内收敛；拒绝后不残留过期请求，不在以后相同值变化时重放，也不重复回调。
- **强制色彩**：关键选择控件、日期控件、弹层、树、表格与标签补充 `forced-colors: active` 可辨识状态。
- **RTL**：方向性图标和 SideNav 展开/折叠状态按逻辑方向呈现。
- **减少动态效果**：组件和文档中的非必要过渡、动画在 `prefers-reduced-motion: reduce` 下停用或降级。
- **触控**：拖拽/滑动组件使用 Pointer Events 与合适的 `touch-action`；触控目标和状态切换不依赖 hover。
- **文档**：属性表、代码块和原型返回入口补齐可聚焦滚动区、名称、焦点可见性与减少动态效果处理。

## 验证命令

在仓库根目录运行：

```bash
pnpm --dir packages/ui exec vitest run \
  src/components/Anchor/Anchor.test.tsx \
  src/components/Image/Image.test.tsx \
  src/components/Watermark/Watermark.test.tsx \
  src/components/Popover/Popover.test.tsx \
  src/components/Message/Message.test.tsx
pnpm --filter @zui/docs typecheck
pnpm exec eslint \
  packages/ui/src/components/Anchor/Anchor.test.tsx \
  docs/quality-audit-2026-11-11.md \
  docs/RELEASE-CHECKLIST.md
git diff --check
```

说明：若运行 `pnpm --filter @zui/react test -- <file>`，当前包脚本会把参数追加到 `vitest run` 后但仍收集完整测试集；定向回归应使用上面的 `pnpm --dir packages/ui exec vitest run ...`。

## 人工验证边界

本轮**未做真实设备/辅助技术人工验收**：未使用实机中文 IME，未使用 macOS VoiceOver，也未使用 Windows NVDA。自动化测试验证的是 DOM、事件、焦点与 ARIA 契约，不能替代这些环境下的读屏顺序、组合输入候选窗、语音反馈和浏览器/系统快捷键复核；正式发布前仍应按发布清单补做。
