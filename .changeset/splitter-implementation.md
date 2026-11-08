---
'@zui/react': minor
'@zui/cli': minor
'@zui/mcp': minor
---

按 RFC-003 新增 Splitter 可调分栏组件：`Splitter` / `Splitter.Panel` compound API 自动生成具名 separator，并通过 `handleProps(context)` 配置名称、disabled 与明确的 `collapseTarget`。支持基于 `C - H` 的尺寸分配、Pointer Capture、min/max 夹紧、受控/非受控尺寸、RTL、ResizeObserver、折叠内容 inert 与焦点回退；pointerup 提交，Escape / pointercancel / 意外 lostcapture 恢复快照并通过 `onResizeEnd` 的 `cancelled` 与 `requestedSizes` 报告边界，键盘会话在 keyup / blur 提交。同步扩展十套 locale、Registry、CLI 数据与 MCP 代码生成。
