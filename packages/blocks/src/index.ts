'use client';

// @zui/blocks 公共导出 —— 16 个页面级业务区块
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
export { UserCenterBlock, DEMO_USER, DEMO_PREFERENCES } from './user-center/index.js';
export type {
  UserCenterBlockProps,
  UserCenterUser,
  UserPreferenceItem,
} from './user-center/index.js';

export { PermissionBlock, DEMO_PERMISSION_TREE, DEMO_MEMBERS } from './permission/index.js';
export type { PermissionBlockProps, PermissionMember } from './permission/index.js';

export { SettingsBlock, DEMO_SETTINGS_VALUES, DEMO_SETTINGS_SECTIONS } from './settings/index.js';
export type { SettingsBlockProps, SettingsValues, SettingsSection } from './settings/index.js';

export {
  WizardBlock,
  DEMO_WIZARD_VALUES,
  DEMO_WIZARD_STEPS,
  DEMO_CATEGORY_OPTIONS,
} from './wizard/index.js';
export type { WizardBlockProps, WizardValues } from './wizard/index.js';

export { ProfileEditBlock, DEMO_PROFILE, DEMO_TENURE } from './profile-edit/index.js';
export type { ProfileEditBlockProps, ProfileEditValues } from './profile-edit/index.js';

export { OrderListBlock, DEMO_ORDERS, DEMO_ORDER_STATUS_OPTIONS } from './order-list/index.js';
export type {
  OrderListBlockProps,
  OrderRow,
  OrderStatus,
  OrderStatusOption,
} from './order-list/index.js';

// ---- 第三批新增区块（展示/流程向） ----
export {
  DataScreenBlock,
  DEMO_SCREEN_STATS,
  DEMO_SCREEN_BARS,
  DEMO_SCREEN_GAUGES,
} from './data-screen/index.js';
export type {
  DataScreenBlockProps,
  DataScreenStat,
  DataScreenBar,
  DataScreenGauge,
  DataScreenRange,
} from './data-screen/index.js';

export { TimelineFeedBlock, DEMO_FEED_ENTRIES } from './timeline-feed/index.js';
export type {
  TimelineFeedBlockProps,
  TimelineFeedEntry,
  TimelineFeedEventColor,
} from './timeline-feed/index.js';

export { KanbanBlock, DEMO_KANBAN_COLUMNS } from './kanban/index.js';
export type {
  KanbanBlockProps,
  KanbanColumn,
  KanbanTaskCard,
  KanbanPriority,
} from './kanban/index.js';

export { ErrorPagesBlock } from './error-pages/index.js';
export type { ErrorPagesBlockProps, ErrorPageStatus, ErrorPageCopy } from './error-pages/index.js';

export {
  SearchResultBlock,
  DEMO_SEARCH_TYPES,
  DEMO_SEARCH_RESULTS,
} from './search-result/index.js';
export type {
  SearchResultBlockProps,
  SearchResultItem,
  SearchResultType,
} from './search-result/index.js';

export { ListDetailBlock, DEMO_DETAIL_ITEMS } from './list-detail/index.js';
export type { ListDetailBlockProps, ListDetailItem } from './list-detail/index.js';
