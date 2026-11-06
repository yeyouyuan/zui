# @zui/blocks

ZUI 业务区块：4 个页面级区块（登录 / 仪表盘 / 表格页 / 表单页），用 `@zui/react` 现有组件拼装的高完成度页面骨架，可整体嵌入业务系统，也可拆改。

- 每块是一个 React 组件（首行 `'use client'`，RSC/Next.js 友好），自带布局/间距/层次，直接像真实页面渲染。
- 样式走 ZUI 语义令牌（`--z-color-*` / `--z-space-*` / `--z-text-*` 等），无硬编码色值；**块本身不引 CSS 文件**，由使用方全局引入 `@zui/react/styles.css`。
- 每块附 `block.json`（名称 / 描述 / 依赖组件清单 / category: "业务块"），供 registry 分发与 AI 检索。

## 安装与引入

```bash
pnpm add @zui/blocks @zui/react react react-dom
```

```tsx
// 入口处引入一次样式（由使用方引入，块不自带 CSS）
import '@zui/react/styles.css';

import { LoginBlock, DashboardBlock, TablePageBlock, FormPageBlock } from '@zui/blocks';
// 或按块单独引入（tree-shaking 友好）：
import { LoginBlock } from '@zui/blocks/login';
```

## 用法示例

### LoginBlock 登录页

```tsx
<LoginBlock
  productName="Acme Cloud"
  error="账号或密码错误，请重试"
  onSubmit={({ username, password, remember }) => signIn(username, password, remember)}
  onForgotPassword={() => router.push('/forgot')}
  onRegister={() => router.push('/register')}
  onSocialLogin={(provider) => socialSignIn(provider)}
/>
```

结构：品牌位（logo + 产品名）→ Card 表单（账号 / 密码 + 显示密码切换、记住我、忘记密码）→ 主按钮 → Divider「或」→ 第三方登录（GitHub / 微信 / Google）→ 注册引导。支持 `loading` / `error` / `title` / `subtitle` / `logo` / 占位文案等插槽与文案定制。

### DashboardBlock 仪表盘

```tsx
<DashboardBlock
  title="运营概览"
  stats={[
    { key: 'uv', label: '今日 UV', value: '48,210', trend: '较昨日 +12.4%', trendDirection: 'up' },
    // ...最多自定义任意数量统计卡
  ]}
  trendData={[{ label: '周一', value: 42 }, /* ... */]}
  channels={[{ key: 'direct', name: '直接访问', visits: '21,430', share: 44 }, /* ... */]}
  activities={[{ key: 'a1', time: '09:24', event: '订单支付成功', status: 'success', statusText: '成功' }, /* ... */]}
  onTabChange={(tab) => console.log(tab)}
  actions={<Button>自定义操作</Button>}
/>
```

结构：页头（标题 + 导出/新建操作）→ Statistic 统计卡行（数值 + 趋势 Tag + 提示）→ Tabs 三面板（访问量趋势柱状图 + 流量来源占比条 / 渠道明细表 / 转化漏斗）→ 最近动态 Table。全部数据可用 props 覆盖，内置演示数据开箱即视。

### TablePageBlock 表格页

```tsx
import { TablePageBlock, DEMO_COLUMNS, DEMO_DATA, DEMO_FILTERS } from '@zui/blocks';

<TablePageBlock
  title="商品管理"
  columns={DEMO_COLUMNS}
  data={DEMO_DATA}
  filters={DEMO_FILTERS}
  selectable
  onSelectionChange={(keys) => console.log(keys)}
  onSearch={(kw) => console.log('search', kw)}
  onFilterChange={(field, value) => console.log(field, value)}
  onPageChange={(page) => console.log(page)}
  rowActions={(row) => (
    <>
      <Button variant="ghost" size="sm">编辑</Button>
      <Button variant="ghost" size="sm">删除</Button>
    </>
  )}
/>
```

结构：Card 容器 → 工具栏（标题 + 搜索框 + 下拉筛选 Select 组 + 已选计数 + 操作按钮）→ Table（可选行选择列 / 空态 / loading 半透明）→ 底部「共 N 条」+ Pagination（含跳页）。列定义 `TableColumn<T>` 支持 `render` 自定义单元格（内置 `Tag` 状态渲染示例）。

### FormPageBlock 表单页

```tsx
<FormPageBlock
  title="新建项目"
  mode="create"
  loading={saving}
  onSubmit={(values) => createProject(values)}
  onCancel={() => router.back()}
/>
```

结构：页头（标题 + 新建/编辑 Tag）→ 三个分区 Card（Form.Item 基本信息双列字段组 / 联系方式 + 描述 / DatePicker / 通知与状态 Switch + 同意条款 Checkbox）→ 粘底操作栏（取消 + 提交，未勾选同意时提交禁用）。受控字段全覆盖 `FormPageValues`。

## 组件依赖

业务块直接使用 `@zui/react` 的 Form、Statistic、DatePicker、Card、Input、Select、Button、Checkbox、Switch、Divider、Tag、Table、Tabs 和 Pagination。块的 props 接口保持稳定，使用方只需引入一次 `@zui/react/styles.css`。

## 与 registry / CLI 配合分发

每块的 `block.json` 是 registry 条目的数据源（契约 §3，`type: "registry:block"`）：

```json
{
  "name": "login",
  "description": "登录页区块：品牌位 + 账号/密码表单 + 记住我 + 第三方登录，基于 Card/Input/Button/Checkbox 拼装",
  "dependencies": ["Button", "Input", "Card", "Checkbox", "Divider"],
  "category": "业务块"
}
```

分发流程（registry 组的 `registry/scripts/generate.mjs` 扫描 `packages/blocks/src/*/`，读取 `block.json` + 文件清单生成 registry 条目）：

1. **生成**：registry 生成脚本读取每个 `src/<block>/block.json`，产出 `type: "registry:block"` 条目，`files` 指向 `src/<block>/index.tsx`，`registryDependencies` 由 `dependencies`（组件名）映射为 `registry:component` 条目。
2. **安装**：`npx zui add login` 复制 `index.tsx` 到业务方 `src/components/blocks/login/`，并按依赖清单拉取 Button/Input/Card 等组件源码（先装组件后装块，块是纯组件拼装，无独立 CSS 文件）。
3. **升级**：`npx zui diff login` 对比本地副本与 registry 上游，输出 unified diff。
4. **AI 检索**：`block.json` 的 `name/description/dependencies/category` 进入 `@zui/mcp` 的 `zui_search_components` 索引（category="业务块"），供 AI 按描述直接生成页面骨架。

包内亦可整体安装（`@zui/blocks` workspace 包），此时按上文「安装与引入」直接 import 即可，不走文件复制。

## 目录结构

```
packages/blocks/
├── package.json          # @zui/blocks，peerDeps: react/react-dom ^19 + @zui/react
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts          # 桶导出（4 块 + 类型 + 演示数据）
    ├── login/
    │   ├── index.tsx     # LoginBlock
    │   └── block.json
    ├── dashboard/
    │   ├── index.tsx     # DashboardBlock
    │   └── block.json
    ├── table-page/
    │   ├── index.tsx     # TablePageBlock + DEMO_* 演示数据
    │   └── block.json
    └── form-page/
        ├── index.tsx     # FormPageBlock
        └── block.json
```

## 开发与验证

```bash
cd packages/blocks
npx tsc -p tsconfig.json   # 类型检查（0 错误）
```

## 约定

- 首行 `'use client'`；React 19 原生 ref；禁 forwardRef（同 V1/V2 契约）。
- 只用语义令牌（`--z-color-primary`、`--z-color-fg-muted`、`--z-space-4`、`--z-radius-md`、`--z-text-sm` 等），适配亮/暗主题自动生效。
- `data-part="root|brand|form|toolbar|footer"` 标记关键节点，配合 `classNames` 可从外部覆盖局部样式。
- 数据全部 props 化（内置演示数据可覆盖），块不发请求、不持业务状态，回调交给业务方。
