'use client';

// @zui/blocks 公共导出 —— 4 个业务块（登录/仪表盘/表格页/表单页）
// 样式由使用方引入：import '@zui/react/styles.css'

export { LoginBlock } from './login/index.js';
export type { LoginBlockProps, LoginBlockValues } from './login/index.js';

export { DashboardBlock } from './dashboard/index.js';
export type {
  DashboardBlockProps,
  DashboardStat,
  DashboardChannelRow,
  DashboardActivity,
  DashboardTrendDirection,
} from './dashboard/index.js';

export { TablePageBlock, DEMO_COLUMNS, DEMO_DATA, DEMO_FILTERS } from './table-page/index.js';
export type {
  TablePageBlockProps,
  TableColumn,
  TablePageRow,
  TablePageFilter,
} from './table-page/index.js';

export { FormPageBlock } from './form-page/index.js';
export type { FormPageBlockProps, FormPageValues } from './form-page/index.js';
