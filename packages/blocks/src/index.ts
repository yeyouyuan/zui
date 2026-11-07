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

// ---- 第三批新增区块（管理/表单向） ----
export { UserCenterBlock } from './user-center/index.js';
export type { UserCenterBlockProps, UserCenterUser, UserPreferenceItem } from './user-center/index.js';

export { PermissionBlock } from './permission/index.js';
export type { PermissionBlockProps, PermissionMember } from './permission/index.js';

export { SettingsBlock } from './settings/index.js';
export type { SettingsBlockProps, SettingsValues, SettingsSection } from './settings/index.js';

export { WizardBlock } from './wizard/index.js';
export type { WizardBlockProps, WizardValues } from './wizard/index.js';

export { ProfileEditBlock } from './profile-edit/index.js';
export type { ProfileEditBlockProps, ProfileEditValues } from './profile-edit/index.js';

export { OrderListBlock } from './order-list/index.js';
export type { OrderListBlockProps, OrderRow, OrderStatus } from './order-list/index.js';

// ---- 第三批新增区块（展示/流程向） ----
export { DataScreenBlock } from './data-screen/index.js';
export type { DataScreenBlockProps, DataScreenStat, DataScreenBar, DataScreenGauge } from './data-screen/index.js';

export { TimelineFeedBlock } from './timeline-feed/index.js';
export type { TimelineFeedBlockProps, TimelineFeedEntry } from './timeline-feed/index.js';

export { KanbanBlock } from './kanban/index.js';
export type { KanbanBlockProps, KanbanColumn, KanbanTaskCard } from './kanban/index.js';

export { ErrorPagesBlock } from './error-pages/index.js';
export type { ErrorPagesBlockProps, ErrorPageStatus } from './error-pages/index.js';

export { SearchResultBlock } from './search-result/index.js';
export type { SearchResultBlockProps, SearchResultItem } from './search-result/index.js';

export { ListDetailBlock } from './list-detail/index.js';
export type { ListDetailBlockProps, ListDetailItem } from './list-detail/index.js';
