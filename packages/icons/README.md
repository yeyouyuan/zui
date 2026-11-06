# @zui/icons

ZUI 图标包：24 个线性图标组件（Feather/Lucide 风格，手写路径），React 19 原生 ref，零 CSS 依赖。

## 安装

```bash
pnpm add @zui/icons
# peer：react ^19
```

## 使用

```tsx
import { Check, Search, Loading } from '@zui/icons';

<Check />                            {/* 1em，继承文字色 */}
<Search size={20} color="#1677ff" /> {/* 指定尺寸与颜色 */}
<Loading spin />                     {/* 旋转加载（默认即带动画） */}
<Loading spin={false} />             {/* 静态加载环 */}
```

## 图标清单（24）

| 图标 | 用途 | 图标 | 用途 |
|---|---|---|---|
| Check | 对勾 | Copy | 复制 |
| Close | 关闭 | Eye | 可见 |
| Search | 搜索 | EyeOff | 隐藏 |
| ChevronDown / Up / Left / Right | V 形方向箭头 | Trash | 删除 |
| ArrowRight | 右箭头（带杆） | Edit | 编辑 |
| Plus / Minus | 加号 / 减号 | Calendar | 日历 |
| Info | 信息 | User | 用户 |
| CheckCircle | 成功 | Settings | 设置 |
| XCircle | 错误 | MoreHorizontal | 更多（横向三点） |
| AlertTriangle | 警告 | Loading | 加载中 |

## 图标规格

- 视窗 `viewBox="0 0 24 24"`（24 视窗）。
- `stroke="currentColor"`、`stroke-width="2"`、`fill="none"`、圆角线帽线段（`stroke-linecap`/`stroke-linejoin` 均为 `round`）。
- 手写 SVG 路径，线性风格近 Feather/Lucide。

## Props（`IconProps`）

每个图标组件都接受同一套 props，扩展 `React.ComponentPropsWithRef<'svg'>`（React 19 原生 ref，直接传 `ref`，无 `forwardRef`）：

```ts
interface IconProps extends React.ComponentPropsWithRef<'svg'> {
  size?: number | string; // 图标边长（同时作用于 width/height），默认 '1em'
  color?: string;         // 描边颜色（stroke），默认 currentColor
  spin?: boolean;         // 仅 Loading 有意义（见下），其它图标接受但忽略
}
```

### 无障碍

- 默认 `aria-hidden="true"`（装饰性图标不进无障碍树）。
- 传入 `aria-label`（或 `aria-labelledby`）时自动移除 `aria-hidden`，让读屏读出名称。

### Loading 与 spin

- `spin` 仅 `Loading` 有意义，**其它图标接受但忽略**（保证 props 类型统一）。
- `Loading` 的 `spin` 默认 `true`（加载图标默认旋转）；`spin={false}` 渲染静态环。
- 旋转动画用 SVG 内嵌 `<animateTransform>`（rotate 360° 循环），**纯 SVG 实现、零 CSS 文件**。

## 构建

```bash
cd packages/icons
npx tsc -p tsconfig.json   # 产出 dist/（ESM + d.ts）
```

## 设计约束（契约）

- `'use client'` 首行、React 19 原生 ref（禁 `forwardRef`）。
- 纯视觉组件：不引 CSS 文件、不依赖设计令牌（颜色走 `currentColor` 继承）。
