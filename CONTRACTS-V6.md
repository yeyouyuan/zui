# ZUI 契约 V6 —— 第三批：生态扩展（图标 100 / blocks 15 / 语言包 10）

> 延续 V1-V5 全部约定。基线：v0.2.0（已固化）、66 组件、4 blocks、5 语言包、24 图标。

## 0. 文件边界（6 路并行）

| 路径 | 归属 |
|---|---|
| packages/icons/**（src/icons/ 新图标 + src/index.ts + README） | 图标智能体（独占） |
| packages/blocks/src/{user-center,permission,settings,wizard,profile-edit,order-list}/** | 区块 A |
| packages/blocks/src/{data-screen,timeline-feed,kanban,error-pages,search-result,list-detail}/** | 区块 B |
| packages/ui/src/config/locale.ts + docs/src/pages/i18n/TranslateDemo.tsx + packages/ui/src/config/index.ts | 语言包智能体（独占） |
| docs/src/pages/design/**（新建设计资源页） | 设计资源智能体 |
| packages/ui/src/index.ts、docs/src/nav.ts、packages/blocks/src/index.ts、packages/blocks/package.json、README.md、registry | 仅集成者（禁改） |

- 区块智能体**只写自己的 src/<name>/ 目录 + 自己的测试文件 tests/<name>.test.tsx**；
  `packages/blocks/src/index.ts` 与 `package.json` exports 由集成者汇总（现文件禁改）。
- 区块可用组件：全部 66 个（Upload/Steps/DateRangePicker/Typography/Row/Col/Flex/Space 均已导出）；
  **图标仅可用 @zui/icons 现有 24 枚**（新图标并行开发中，需新图标处用内联 SVG）。
- 并行期间只跑自己的测试；tsc 用 `| grep` 过滤。

## 1. @zui/icons 扩充：24 → 100（图标智能体）

- 现有 24 枚保留，**新增 76 枚**（Lucide/Feather 风格，24 视窗、stroke=currentColor、stroke-width 2、fill none、圆角线帽），沿用 `SvgIcon` 骨架与 `IconProps`（size/color/spin）。
- 命名精确按此清单（PascalCase 组件 = 同名文件）：
  **方向**：ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, ChevronsLeft, ChevronsRight, ChevronsUp, ChevronsDown, ExternalLink, LogIn, LogOut, RefreshCw, RotateCcw
  **操作**：Download, Link, Scissors, Filter, Send, Share, ZoomIn, ZoomOut, Maximize, Minimize, Play, Pause, SkipForward, SkipBack, Save, Terminal, Code, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify
  **对象/文件**：File, FileText, Folder, FolderOpen, Inbox, Archive, Clipboard, Book, Bookmark, Camera, Film, Music, Video, Mic, Image, Package, Truck, ShoppingBag, ShoppingCart, CreditCard, DollarSign, Percent, TagIcon, Ticket, Gift
  **设备/系统**：Monitor, Smartphone, Tablet, Watch, Printer, HardDrive, Database, Server, Cloud, Wifi, WifiOff, Bluetooth, Battery, Power, Shield, ShieldCheck, Lock, Unlock, Key, Cpu, Layers, Home, Building, MapPin, Compass, Navigation, Globe, Menu, MoreVertical
  **社交/状态**：Users, UserPlus, UserMinus, UserCheck, Heart, Star, ThumbsUp, ThumbsDown, Smile, Frown, Flag, Award, Zap, HelpCircle, Bell, BellOff, Mail, MessageSquare, MessageCircle, AtSign, Clock, Sun, Moon, Droplet, Wind, CloudRain
- 写法建议：写一个一次性 Node 脚本（生成器：名称→path 数据映射表）批量产出 `src/icons/<Name>.tsx`，跑完删除脚本或放 scripts/（勿留仓库根）；`src/index.ts` 全量导出 + `README.md` 更新清单（按分类分组）。
- 每枚图标手写/校准 path（可用 Lucide 开源 path 数据，ISC 许可兼容 MIT）。
- **验证**：`cd packages/icons && npx tsc -p tsconfig.json` 0 错误；`src/index.ts` 导出总数 = 100；抽查 5 枚渲染（现有测试风格补一个 `tests/icons-snapshot.test.mjs`？icons 包无 vitest——加一个最小 vitest 测试文件断言 100 导出与关键 SVG 属性即可，devDeps 补 vitest）。

## 2. 业务区块 4 → 15（区块 A / 区块 B）

新增 11 个页面级区块（每含 `index.tsx` + `block.json` + 独立测试 `tests/<name>.test.tsx`）：

**区块 A（表单与管理向，全部走 Form 受控 / Upload / Steps / Typography）**：
1. **user-center 个人中心** — Avatar+Descriptions+Tabs（资料/安全/偏好）+ Upload 头像上传
2. **permission 权限管理** — Tree（角色权限树，checkable）+ Table（成员）+ Switch 开关列
3. **settings 系统设置** — 左侧锚点式分组（Anchor 可选）+ 表单分区 + Switch 偏好开关
4. **wizard 分步向导** — Steps + 三步表单（下一步/上一步，最后一步完成回调）
5. **profile-edit 资料编辑** — Row/Col 表单布局 + Upload + DateRangePicker（任职时间）
6. **order-list 订单列表** — Table + Pagination + Select 筛选 + Tag 状态 + Popconfirm 取消

**区块 B（数据展示与流程向）**：
7. **data-screen 数据大屏** — Statistic 卡行 + CSS 柱状/条形图 + Progress 指标（深色底自适应）
8. **timeline-feed 时间线信息流** — Timeline + Avatar + Card + Skeleton 加载占位
9. **kanban 看板** — 三列静态看板（Card + Tag 优先级 + 计数徽标；无拖拽库，注明）
10. **error-pages 错误页集** — Result 403/404/500 三态 + 返回操作（同一区块内 props 切换）
11. **search-result 搜索结果页** — Input 搜索 + Tabs 类型切换 + List 结果 + Empty 无结果
12. **list-detail 列表详情** — 左列表（List）右详情（Descriptions+Card）双栏 Row/Col

- 统一约定：'use client' 首行；受控 props + onChange 回调（数据 props 化 + DEMO_* 演示数据导出）；block.json `{ name, description, dependencies[], category: "业务块" }`；**图标仅用现有 24 枚或内联 SVG**；测试 ≥3 个用例/区块（渲染关键节点 + 一处交互）；样式走 z 令牌。
- 测试写法参照 `packages/blocks/tests/blocks.test.tsx`；**独立文件**（tests/user-center.test.tsx 等），禁改既有测试文件与 src/index.ts。

## 3. 语言包 5 → 10（语言包智能体，独占 locale.ts）

- 新增 **frFR / deDE / esES / ruRU / ptBR** 五包（结构逐字段对齐 zhCN，含 accessibility/form/result/upload/steps/dateRange/popconfirm/tour 全段），`config/index.ts` 同步导出。
- `docs/src/pages/i18n/TranslateDemo.tsx`：LOCALES 切换数组从 5 扩到 10（旗帜 emoji：🇫🇷🇩🇪🇪🇸🇷🇺🇧🇷），页面文案改为「10 套官方内置语言包」。
- **验证**：全字段存在性断言测试（在 packages/ui/src/test/i18n.test.tsx **追加**新 describe，禁改既有断言）+ `npx tsc --noEmit`。

## 4. 设计资源对接文档（设计资源智能体）

- 新建 `docs/src/pages/design/DesignAssetsPage.tsx`：Figma Tokens Studio 导入流程（粘贴 `packages/tokens/src/tokens.json` 的 DTCG 格式：Primitives → Semantic → 别名链）、品牌换肤三步法（改 semantic 层）、`build:browser` CDN 接入（`<script src=".../zui.global.js">` + `ZUI.createRoot`，附 cdn-demo.html 链接）、设计侧令牌命名对照表。
- 页面结构照抄 ButtonPage 模式（usePageTitle + Demo/代码块 + 表格）；`public/llms.txt` 追加「设计资源」一节。
- **验证**：`cd docs && npx tsc --noEmit` 过滤自身 0 错误；`npx vite build` 通过。

## 5. 验证要求

- 各组只跑自己范围；tsc 过滤自己的路径；禁改他组文件与集成者文件。
- 区块组额外：`cd packages/blocks && npx vitest run tests/<your>` 通过。
