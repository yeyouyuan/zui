# SSR / Next.js App Router 接入指南

ZUI 使用原生 CSS 与 CSS 变量。`@zui/react` 的 ESM/CJS 入口保留 `'use client'`，
图标、业务块和翻译 Hook 的公开入口也声明客户端边界。

## 样式与客户端边界

在应用根布局统一引入组件样式，避免页面切换时重复管理样式入口：

```tsx
// app/layout.tsx
import '@zui/react/styles.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
```

Server Component 可以导入和渲染 ZUI 的客户端组件，跨边界 props 必须可序列化。
例如 `<Button>继续</Button>` 可以直接渲染；事件处理、hooks、ref 和函数型配置应在自己的
客户端组件中定义。需要交互时把边界放在相应功能上：

```tsx
// app/ui/name-field.tsx
'use client';
import { useState } from 'react';
import { Input } from '@zui/react';

export function NameField() {
  const [name, setName] = useState('');
  return <Input aria-label="用户名" value={name} onChange={(event) => setName(event.target.value)} />;
}
```

`ConfigProvider`、`MessageProvider` 等在客户端入口中组合，Server Component 可引用该入口。
子路径（如 `@zui/react/button`）与主入口目前指向同一产物，仍需引入完整样式。
通过 CLI 复制源码时，应保留复制文件中的 `'use client'` 和 CSS 导入。

## 服务端渲染与水合

- 浏览器 API 放在 effects 和事件处理内。Portal 在服务端及客户端首帧只输出隐藏锚点，
  挂载后才把浮层写入容器；默认打开的弹层不会出现在服务端 HTML 中。
- 内部 ID 使用 `React.useId()`。保持两端组件树与初始 props 一致，多个独立 React 根需协调 ID 前缀。
- 默认文案为 zh-CN。两端使用相同 locale；翻译缓存、网络响应和用户偏好可能让客户端文案随后变化。
- Calendar、DatePicker 等依赖当前日期或时区的组件需单独检查跨时区、跨午夜水合。
  本仓库 SSR 冒烟测试不等于所有框架、时区与业务配置均已通过。
- CSS 变量可由服务端样式、class 或客户端属性设置。首屏主题取决于 HTML、CSS 加载及主题初始化顺序；
  `@property` 本身不能保证无闪烁。优先由服务端输出一致主题；读取本地偏好时同时处理 CSP 与水合策略。

## 集成验收

在实际项目执行 `next build` 并检查运行时控制台，覆盖弹层、表单、主题切换和日期组件。
本仓库已提供 SSR 单元测试及发布入口 smoke 检查，但尚未建立独立 Next.js 集成测试工程，
不将其描述为完整框架兼容认证。
