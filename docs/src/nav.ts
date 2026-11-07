import { lazy, type ComponentType } from 'react';

const Overview = lazy(() => import('./pages/Overview'));
const TokensPage = lazy(() => import('./pages/TokensPage'));
const ThemePlayground = lazy(() => import('./pages/ThemePlayground'));
const TranslateDemo = lazy(() => import('./pages/i18n/TranslateDemo'));
const ButtonPage = lazy(() => import('./pages/components/ButtonPage'));
const InputPage = lazy(() => import('./pages/components/InputPage'));
const CheckboxPage = lazy(() => import('./pages/components/CheckboxPage'));
const RadioPage = lazy(() => import('./pages/components/RadioPage'));
const SwitchPage = lazy(() => import('./pages/components/SwitchPage'));
const SelectPage = lazy(() => import('./pages/components/SelectPage'));
const ModalPage = lazy(() => import('./pages/components/ModalPage'));
const TabsPage = lazy(() => import('./pages/components/TabsPage'));
const TablePage = lazy(() => import('./pages/components/TablePage'));
const MessagePage = lazy(() => import('./pages/components/MessagePage'));
const TooltipPage = lazy(() => import('./pages/components/TooltipPage'));
const PopoverPage = lazy(() => import('./pages/components/PopoverPage'));
const DropdownMenuPage = lazy(() => import('./pages/components/DropdownMenuPage'));
const AlertPage = lazy(() => import('./pages/components/AlertPage'));
const BadgePage = lazy(() => import('./pages/components/BadgePage'));
const TagPage = lazy(() => import('./pages/components/TagPage'));
const PaginationPage = lazy(() => import('./pages/components/PaginationPage'));
const BreadcrumbPage = lazy(() => import('./pages/components/BreadcrumbPage'));
const AvatarPage = lazy(() => import('./pages/components/AvatarPage'));
const CardPage = lazy(() => import('./pages/components/CardPage'));
const DividerPage = lazy(() => import('./pages/components/DividerPage'));
const EmptyPage = lazy(() => import('./pages/components/EmptyPage'));
const SkeletonPage = lazy(() => import('./pages/components/SkeletonPage'));
const DrawerPage = lazy(() => import('./pages/components/DrawerPage'));
const SpinPage = lazy(() => import('./pages/components/SpinPage'));
const ProgressPage = lazy(() => import('./pages/components/ProgressPage'));
const ConfigPage = lazy(() => import('./pages/components/ConfigPage'));
const FormPage = lazy(() => import('./pages/components/FormPage'));
const SliderPage = lazy(() => import('./pages/components/SliderPage'));
const RatePage = lazy(() => import('./pages/components/RatePage'));
const InputNumberPage = lazy(() => import('./pages/components/InputNumberPage'));
const ColorPickerPage = lazy(() => import('./pages/components/ColorPickerPage'));
const DatePickerPage = lazy(() => import('./pages/components/DatePickerPage'));
const CalendarPage = lazy(() => import('./pages/components/CalendarPage'));
const DescriptionsPage = lazy(() => import('./pages/components/DescriptionsPage'));
const StatisticPage = lazy(() => import('./pages/components/StatisticPage'));
const TimelinePage = lazy(() => import('./pages/components/TimelinePage'));
const VirtualTablePage = lazy(() => import('./pages/components/VirtualTablePage'));
const TreePage = lazy(() => import('./pages/components/TreePage'));
const TreeSelectPage = lazy(() => import('./pages/components/TreeSelectPage'));
const CollapsePage = lazy(() => import('./pages/components/CollapsePage'));
const ListPage = lazy(() => import('./pages/components/ListPage'));
const TransferPage = lazy(() => import('./pages/components/TransferPage'));
const CascaderPage = lazy(() => import('./pages/components/CascaderPage'));
const TimePickerPage = lazy(() => import('./pages/components/TimePickerPage'));
const MentionsPage = lazy(() => import('./pages/components/MentionsPage'));
const NotificationPage = lazy(() => import('./pages/components/NotificationPage'));
const PopconfirmPage = lazy(() => import('./pages/components/PopconfirmPage'));
const ImagePage = lazy(() => import('./pages/components/ImagePage'));
const TourPage = lazy(() => import('./pages/components/TourPage'));
const SegmentedPage = lazy(() => import('./pages/components/SegmentedPage'));
const QRCodePage = lazy(() => import('./pages/components/QRCodePage'));
const WatermarkPage = lazy(() => import('./pages/components/WatermarkPage'));
const AffixPage = lazy(() => import('./pages/components/AffixPage'));
const BackTopPage = lazy(() => import('./pages/components/BackTopPage'));
const FloatButtonPage = lazy(() => import('./pages/components/FloatButtonPage'));
const ResultPage = lazy(() => import('./pages/components/ResultPage'));
const AppPage = lazy(() => import('./pages/components/AppPage'));
const UploadPage = lazy(() => import('./pages/components/UploadPage'));
const StepsPage = lazy(() => import('./pages/components/StepsPage'));
const DateRangePickerPage = lazy(() => import('./pages/components/DateRangePickerPage'));
const AnchorPage = lazy(() => import('./pages/components/AnchorPage'));
const TypographyPage = lazy(() => import('./pages/components/TypographyPage'));
const LayoutPage = lazy(() => import('./pages/components/LayoutPage'));
const DesignAssetsPage = lazy(() => import('./pages/design/DesignAssetsPage'));
const IconGalleryPage = lazy(() => import('./pages/design/IconGalleryPage'));

/** 导航分组：'start'（开始）/ 'components'（组件） */
export type NavGroup = 'start' | 'components';

export interface NavItem {
  /** 导航显示名（侧栏搜索按此过滤） */
  title: string;
  /** hash 路由路径 */
  path: string;
  /** 所属分组 */
  group: NavGroup;
}

/** 分组显示名（渲染顺序即 GROUP_ORDER） */
export const GROUP_LABELS: Record<NavGroup, string> = {
  start: '开始',
  components: '组件',
};

/** 分组渲染顺序 */
export const GROUP_ORDER: NavGroup[] = ['start', 'components'];

/**
 * 导航注册表：侧栏按序渲染，路由匹配也走它。
 */
export const navItems: NavItem[] = [
  { title: '概览', path: '/', group: 'start' },
  { title: '设计令牌', path: '/tokens', group: 'start' },
  { title: '主题调参', path: '/theme', group: 'start' },
  { title: '国际化与翻译', path: '/i18n', group: 'start' },
  { title: '设计资源', path: '/design', group: 'start' },
  { title: '图标库', path: '/icons', group: 'start' },
  { title: 'Button 按钮', path: '/components/button', group: 'components' },
  { title: 'Input 输入框', path: '/components/input', group: 'components' },
  { title: 'Checkbox 复选框', path: '/components/checkbox', group: 'components' },
  { title: 'Radio 单选框', path: '/components/radio', group: 'components' },
  { title: 'Switch 开关', path: '/components/switch', group: 'components' },
  { title: 'Select 选择器', path: '/components/select', group: 'components' },
  { title: 'Modal 对话框', path: '/components/modal', group: 'components' },
  { title: 'Tabs 标签页', path: '/components/tabs', group: 'components' },
  { title: 'Table 表格', path: '/components/table', group: 'components' },
  { title: 'Message 全局提示', path: '/components/message', group: 'components' },
  { title: 'Tooltip 文字提示', path: '/components/tooltip', group: 'components' },
  { title: 'Popover 气泡卡片', path: '/components/popover', group: 'components' },
  { title: 'DropdownMenu 下拉菜单', path: '/components/dropdown-menu', group: 'components' },
  { title: 'Alert 警告提示', path: '/components/alert', group: 'components' },
  { title: 'Badge 徽标', path: '/components/badge', group: 'components' },
  { title: 'Tag 标签', path: '/components/tag', group: 'components' },
  { title: 'Pagination 分页', path: '/components/pagination', group: 'components' },
  { title: 'Breadcrumb 面包屑', path: '/components/breadcrumb', group: 'components' },
  { title: 'Avatar 头像', path: '/components/avatar', group: 'components' },
  { title: 'Card 卡片', path: '/components/card', group: 'components' },
  { title: 'Divider 分割线', path: '/components/divider', group: 'components' },
  { title: 'Empty 空状态', path: '/components/empty', group: 'components' },
  { title: 'Skeleton 骨架屏', path: '/components/skeleton', group: 'components' },
  { title: 'Drawer 抽屉', path: '/components/drawer', group: 'components' },
  { title: 'Spin 加载中', path: '/components/spin', group: 'components' },
  { title: 'Progress 进度条', path: '/components/progress', group: 'components' },
  { title: 'ConfigProvider 全局配置', path: '/components/config', group: 'components' },
  { title: 'Form 表单', path: '/components/form', group: 'components' },
  { title: 'Slider 滑块', path: '/components/slider', group: 'components' },
  { title: 'Rate 评分', path: '/components/rate', group: 'components' },
  { title: 'InputNumber 数字输入', path: '/components/input-number', group: 'components' },
  { title: 'ColorPicker 取色器', path: '/components/color-picker', group: 'components' },
  { title: 'DatePicker 日期选择', path: '/components/date-picker', group: 'components' },
  { title: 'Calendar 日历', path: '/components/calendar', group: 'components' },
  { title: 'Descriptions 描述列表', path: '/components/descriptions', group: 'components' },
  { title: 'Statistic 统计数值', path: '/components/statistic', group: 'components' },
  { title: 'Timeline 时间轴', path: '/components/timeline', group: 'components' },
  { title: 'VirtualTable 虚拟滚动表格', path: '/components/virtual-table', group: 'components' },
  { title: 'Tree 树形控件', path: '/components/tree', group: 'components' },
  { title: 'TreeSelect 树选择', path: '/components/tree-select', group: 'components' },
  { title: 'Collapse 折叠面板', path: '/components/collapse', group: 'components' },
  { title: 'List 列表', path: '/components/list', group: 'components' },
  { title: 'Transfer 穿梭框', path: '/components/transfer', group: 'components' },
  { title: 'Cascader 级联选择', path: '/components/cascader', group: 'components' },
  { title: 'TimePicker 时间选择', path: '/components/time-picker', group: 'components' },
  { title: 'Mentions 提及', path: '/components/mentions', group: 'components' },
  { title: 'Notification 通知提醒框', path: '/components/notification', group: 'components' },
  { title: 'Popconfirm 气泡确认', path: '/components/popconfirm', group: 'components' },
  { title: 'Image 图片', path: '/components/image', group: 'components' },
  { title: 'Tour 漫游引导', path: '/components/tour', group: 'components' },
  { title: 'Segmented 分段控制器', path: '/components/segmented', group: 'components' },
  { title: 'QRCode 二维码', path: '/components/qrcode', group: 'components' },
  { title: 'Watermark 水印', path: '/components/watermark', group: 'components' },
  { title: 'Affix 固钉', path: '/components/affix', group: 'components' },
  { title: 'BackTop 返回顶部', path: '/components/back-top', group: 'components' },
  { title: 'FloatButton 悬浮按钮', path: '/components/float-button', group: 'components' },
  { title: 'Result 结果', path: '/components/result', group: 'components' },
  { title: 'App 容器', path: '/components/app', group: 'components' },
  { title: 'Upload 上传', path: '/components/upload', group: 'components' },
  { title: 'Steps 步骤条', path: '/components/steps', group: 'components' },
  { title: 'DateRangePicker 日期范围', path: '/components/date-range-picker', group: 'components' },
  { title: 'Anchor 锚点', path: '/components/anchor', group: 'components' },
  { title: 'Typography 排版', path: '/components/typography', group: 'components' },
  { title: 'Layout 布局', path: '/components/layout', group: 'components' },
];

/** 路由映射：path → 页面组件（与 navItems 同源，键必须与 navItems 的 path 一一对应） */
export const routeComponents: Record<string, ComponentType> = {
  '/': Overview,
  '/tokens': TokensPage,
  '/theme': ThemePlayground,
  '/i18n': TranslateDemo,
  '/design': DesignAssetsPage,
  '/icons': IconGalleryPage,
  '/components/button': ButtonPage,
  '/components/input': InputPage,
  '/components/checkbox': CheckboxPage,
  '/components/radio': RadioPage,
  '/components/switch': SwitchPage,
  '/components/select': SelectPage,
  '/components/modal': ModalPage,
  '/components/tabs': TabsPage,
  '/components/table': TablePage,
  '/components/message': MessagePage,
  '/components/tooltip': TooltipPage,
  '/components/popover': PopoverPage,
  '/components/dropdown-menu': DropdownMenuPage,
  '/components/alert': AlertPage,
  '/components/badge': BadgePage,
  '/components/tag': TagPage,
  '/components/pagination': PaginationPage,
  '/components/breadcrumb': BreadcrumbPage,
  '/components/avatar': AvatarPage,
  '/components/card': CardPage,
  '/components/divider': DividerPage,
  '/components/empty': EmptyPage,
  '/components/skeleton': SkeletonPage,
  '/components/drawer': DrawerPage,
  '/components/spin': SpinPage,
  '/components/progress': ProgressPage,
  '/components/config': ConfigPage,
  '/components/form': FormPage,
  '/components/slider': SliderPage,
  '/components/rate': RatePage,
  '/components/input-number': InputNumberPage,
  '/components/color-picker': ColorPickerPage,
  '/components/date-picker': DatePickerPage,
  '/components/calendar': CalendarPage,
  '/components/descriptions': DescriptionsPage,
  '/components/statistic': StatisticPage,
  '/components/timeline': TimelinePage,
  '/components/virtual-table': VirtualTablePage,
  '/components/tree': TreePage,
  '/components/tree-select': TreeSelectPage,
  '/components/collapse': CollapsePage,
  '/components/list': ListPage,
  '/components/transfer': TransferPage,
  '/components/cascader': CascaderPage,
  '/components/time-picker': TimePickerPage,
  '/components/mentions': MentionsPage,
  '/components/notification': NotificationPage,
  '/components/popconfirm': PopconfirmPage,
  '/components/image': ImagePage,
  '/components/tour': TourPage,
  '/components/segmented': SegmentedPage,
  '/components/qrcode': QRCodePage,
  '/components/watermark': WatermarkPage,
  '/components/affix': AffixPage,
  '/components/back-top': BackTopPage,
  '/components/float-button': FloatButtonPage,
  '/components/result': ResultPage,
  '/components/app': AppPage,
  '/components/upload': UploadPage,
  '/components/steps': StepsPage,
  '/components/date-range-picker': DateRangePickerPage,
  '/components/anchor': AnchorPage,
  '/components/typography': TypographyPage,
  '/components/layout': LayoutPage,
};
