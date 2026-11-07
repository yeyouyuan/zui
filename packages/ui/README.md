# @zui/react

ZUI 组件库核心包：57+ 现代 React 组件，令牌驱动、零运行时样式、无障碍优先。

```bash
pnpm add @zui/react
```

```tsx
import '@zui/react/styles.css';
import { Button } from '@zui/react';

<Button variant="primary">开始使用</Button>
```

- 57 组件覆盖表单 / 数据展示 / 反馈 / 导航 / 浮层（完整清单见仓库根 README）
- 三层 Design Token（CSS 变量），`ConfigProvider locale` 五国语言包
- 组合式 API（`Modal.Trigger` 等）+ `data-part` / `classNames` / 组件级 CSS 变量三件套定制出口
- 附带 CDN IIFE 构建（`build:browser` → `dist/browser/zui.global.js`，`unpkg` 字段已指向）

文档：仓库 `docs/` 站（`pnpm --filter @zui/docs dev`）。
