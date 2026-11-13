# @zui/icons

> v0.4.0 发布到 GitHub Packages：`@yeyouyuan/zui-icons`，npmjs 暂不发布。先在项目 `.npmrc` 配置 `@yeyouyuan:registry=https://npm.pkg.github.com`，再用拥有包读取权限的 GitHub 账号登录。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
pnpm add @zui/icons@npm:@yeyouyuan/zui-icons@0.4.0
```

源码导入继续使用 `@zui/icons`。完整认证和安装说明见仓库 [GitHub Packages 文档](https://github.com/yeyouyuan/zui/blob/main/docs/GITHUB-PACKAGES.md)。

ZUI 图标包：142 个线性图标组件（Feather/Lucide 风格），React 19 原生 ref，零 CSS 依赖。

共 5 组：基础 24 枚 + CONTRACTS-V6.md §1 第三批 118 枚（方向 / 操作 / 对象文件 / 设备系统 / 社交状态）。
新图标 path 采用 Lucide/Feather 开源数据（ISC 许可，兼容本包 MIT），由
`scripts/generate-icons.mjs`（名称→path 映射表）批量生成。

## 安装

```bash
pnpm add @zui/icons@npm:@yeyouyuan/zui-icons@0.4.0
# peer：react ^19
```

## 使用

```tsx
import { Check, Search, Loading, TagIcon } from '@zui/icons';

<Check />                            {/* 1em，继承文字色 */}
<Search size={20} color="#1677ff" /> {/* 指定尺寸与颜色 */}
<Loading spin />                     {/* 旋转加载（默认即带动画） */}
<Loading spin={false} />             {/* 静态加载环 */}
<TagIcon aria-label="标签" />         {/* 传 aria-label 时露出给读屏 */}
```

## 图标清单（142，按分类分组）

### 基础（24）

| 图标                            | 用途           | 图标           | 用途             |
| ------------------------------- | -------------- | -------------- | ---------------- |
| Check                           | 对勾           | Copy           | 复制             |
| Close                           | 关闭           | Eye            | 可见             |
| Search                          | 搜索           | EyeOff         | 隐藏             |
| ChevronDown / Up / Left / Right | V 形方向箭头   | Trash          | 删除             |
| ArrowRight                      | 右箭头（带杆） | Edit           | 编辑             |
| Plus / Minus                    | 加号 / 减号    | Calendar       | 日历             |
| Info                            | 信息           | User           | 用户             |
| CheckCircle                     | 成功           | Settings       | 设置             |
| XCircle                         | 错误           | MoreHorizontal | 更多（横向三点） |
| AlertTriangle                   | 警告           | Loading        | 加载中           |

### 方向（14）

ArrowLeft · ArrowUp · ArrowDown · ArrowUpRight · ArrowDownRight · ChevronsLeft · ChevronsRight ·
ChevronsUp · ChevronsDown · ExternalLink（外部链接）· LogIn（登录）· LogOut（退出登录）·
RefreshCw（刷新，无旋转动画语义）· RotateCcw（逆时针旋转）

### 操作（24）

Download（下载）· Link（链接）· Scissors（剪切）· Filter（筛选）· Send（发送）· Share（分享）·
ZoomIn / ZoomOut（放大 / 缩小）· Maximize / Minimize（最大化 / 最小化）·
Play / Pause（播放 / 暂停）· SkipForward / SkipBack（快进 / 快退）· Save（保存）·
Terminal（终端）· Code（代码）· Type（文本）· Bold / Italic（加粗 / 斜体）·
AlignLeft / AlignCenter / AlignRight / AlignJustify（对齐四式）

### 对象 / 文件（25）

File · FileText（文本文件）· Folder · FolderOpen（打开的文件夹）· Inbox（收件箱）·
Archive（归档）· Clipboard（剪贴板）· Book（书籍）· Bookmark（书签）· Camera（相机）·
Film（影片）· Music（音乐）· Video（视频）· Mic（麦克风）· Image（图片）· Package（包裹）·
Truck（货车）· ShoppingBag（购物袋）· ShoppingCart（购物车）· CreditCard（银行卡）·
DollarSign（美元）· Percent（折扣）· **TagIcon**（标签图标；为避免与业务 Tag 组件同名混淆，
组件名刻意为 TagIcon）· Ticket（票券）· Gift（礼物）

### 设备 / 系统（29）

Monitor（显示器）· Smartphone · Tablet · Watch · Printer（打印机）· HardDrive（硬盘）·
Database（数据库）· Server（服务器）· Cloud（云）· Wifi / WifiOff（Wi-Fi 连接 / 断开）·
Bluetooth（蓝牙）· Battery（电池）· Power（电源）· Shield / ShieldCheck（盾牌 / 安全校验）·
Lock / Unlock（锁定 / 解锁）· Key（钥匙）· Cpu（处理器）· Layers（图层）· Home（首页）·
Building（建筑）· MapPin（定位）· Compass（指南针）· Navigation（导航）· Globe（全球）·
Menu（菜单）· MoreVertical（更多，纵向三点）

### 社交 / 状态（26）

Users（用户组）· UserPlus / UserMinus / UserCheck（加人 / 移除 / 校验）· Heart（收藏）·
Star（评分）· ThumbsUp / ThumbsDown（点赞 / 点踩）· Smile / Frown（笑脸 / 皱眉）·
Flag（旗帜）· Award（奖章）· Zap（闪电）· HelpCircle（帮助）· Bell / BellOff（通知 / 静音）·
Mail（邮件）· MessageSquare / MessageCircle（消息）· AtSign（@ 提及）· Clock（时钟）·
Sun / Moon（亮色 / 暗色）· Droplet（水滴）· Wind（风）· CloudRain（下雨）

## 图标规格

- 视窗 `viewBox="0 0 24 24"`（24 视窗）。
- `stroke="currentColor"`、`stroke-width="2"`、`fill="none"`、圆角线帽线段（`stroke-linecap`/`stroke-linejoin` 均为 `round`）。
- Lucide/Feather 开源 path 数据（ISC 许可），公共骨架由内部 `SvgIcon` 统一承载。

## Props（`IconProps`）

每个图标组件都接受同一套 props，扩展 `React.ComponentPropsWithRef<'svg'>`（React 19 原生 ref，直接传 `ref`，无 `forwardRef`）：

```ts
interface IconProps extends React.ComponentPropsWithRef<'svg'> {
  size?: number | string; // 图标边长（同时作用于 width/height），默认 '1em'
  color?: string; // 描边颜色（stroke），默认 currentColor
  spin?: boolean; // 仅 Loading 有意义（见下），其它图标接受但忽略
}
```

### 无障碍

- 默认 `aria-hidden="true"`（装饰性图标不进无障碍树）。
- 传入 `aria-label`（或 `aria-labelledby`）时自动移除 `aria-hidden`，让读屏读出名称。

### Loading 与 spin

- `spin` 仅 `Loading` 有意义，**其它图标接受但忽略**（保证 props 类型统一；RefreshCw 等刷新类图标无旋转动画语义）。
- `Loading` 的 `spin` 默认 `true`（加载图标默认旋转）；`spin={false}` 渲染静态环。
- 旋转动画用浏览器 Web Animations API（rotate 360° 循环），零 CSS 文件依赖；不支持该 API 的环境显示静态环。
- 遵循系统“减少动态效果”设置，并在设置改变时自动停止或恢复；关闭 `spin` 或卸载时清理动画。
- 服务端与复制出的原始 SVG 为静态图形；需要独立 SVG 动画时可自行添加 CSS 动画。

## 构建与测试

```bash
cd packages/icons
npx tsc -p tsconfig.json   # 产出 dist/（ESM + d.ts）
npx vitest run             # tests/icons.test.mjs：导出总数 + 关键 SVG 属性断言

# 重新生成第三批 118 枚图标（改映射表后执行；已存在的文件需 --force 覆盖）
node scripts/generate-icons.mjs
```

## 设计约束（契约）

- `'use client'` 首行、React 19 原生 ref（禁 `forwardRef`）。
- 纯视觉组件：不引 CSS 文件、不依赖设计令牌（颜色走 `currentColor` 继承）。

## 数量口径说明

CONTRACTS-V6.md §1 正文写「新增 76 枚 / 导出总数 100」，但其精确清单实际枚举 118 个名字
（方向 14 + 操作 24 + 对象/文件 25 + 设备/系统 29 + 社交/状态 26），两者矛盾。经确认
**按清单全量实现**：24（既有）+ 118（新增）= **142**，`tests/icons.test.mjs` 按实际总数断言。
