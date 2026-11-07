#!/usr/bin/env node
/**
 * @zui/icons 一次性生成脚本（CONTRACTS-V6.md §1 第三批 118 枚新图标）。
 *
 * 用法：
 *   node scripts/generate-icons.mjs           # 写出 src/icons/<Name>.tsx（已存在则跳过）
 *   node scripts/generate-icons.mjs --force   # 覆盖已存在文件（勿覆盖 Loading 等手写图标）
 *   node scripts/generate-icons.mjs --index   # 额外打印 src/index.ts 的导出块（按字母序）
 *
 * path 数据采用 Lucide/Feather 开源线性图标（ISC 许可，兼容本包 MIT），
 * 24 视窗、stroke=currentColor、stroke-width 2、fill none、圆角线帽 —— 这些
 * 公共属性由 src/SvgIcon.tsx 统一承载，生成文件只含各自的图形子元素。
 * `spin` 仅 Loading 有旋转语义，其余图标按契约「接受但忽略」。
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'icons');

/** 每枚图标：desc 中文说明；parts 为 SvgIcon 内的 JSX 子元素（6 空格缩进由生成器统一加）。 */
const ICONS = {
  // ───────────────────────────── 方向（14） ─────────────────────────────
  ArrowLeft: { desc: '左箭头（带杆）', parts: ['<path d="m12 19-7-7 7-7" />', '<path d="M19 12H5" />'] },
  ArrowUp: { desc: '上箭头（带杆）', parts: ['<path d="m5 12 7-7 7 7" />', '<path d="M12 19V5" />'] },
  ArrowDown: { desc: '下箭头（带杆）', parts: ['<path d="m19 12-7 7-7-7" />', '<path d="M12 5v14" />'] },
  ArrowUpRight: { desc: '右上箭头', parts: ['<path d="M7 7h10v10" />', '<path d="M7 17 17 7" />'] },
  ArrowDownRight: { desc: '右下箭头', parts: ['<path d="m7 7 10 10" />', '<path d="M17 7v10H7" />'] },
  ChevronsLeft: { desc: '双 V 形左箭头', parts: ['<path d="m11 17-5-5 5-5" />', '<path d="m18 17-5-5 5-5" />'] },
  ChevronsRight: { desc: '双 V 形右箭头', parts: ['<path d="m6 17 5-5-5-5" />', '<path d="m13 17 5-5-5-5" />'] },
  ChevronsUp: { desc: '双 V 形上箭头', parts: ['<path d="m17 11-5-5-5 5" />', '<path d="m17 18-5-5-5 5" />'] },
  ChevronsDown: { desc: '双 V 形下箭头', parts: ['<path d="m7 6 5 5 5-5" />', '<path d="m7 13 5 5 5-5" />'] },
  ExternalLink: { desc: '外部链接', parts: ['<path d="M15 3h6v6" />', '<path d="M10 14 21 3" />', '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />'] },
  LogIn: { desc: '登录', parts: ['<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />', '<path d="m10 17 5-5-5-5" />', '<path d="M15 12H3" />'] },
  LogOut: { desc: '退出登录', parts: ['<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />', '<path d="m16 17 5-5-5-5" />', '<path d="M21 12H9" />'] },
  RefreshCw: { desc: '刷新（双箭头环，无旋转动画语义）', parts: ['<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />', '<path d="M21 3v5h-5" />', '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />', '<path d="M3 21v-5h5" />'] },
  RotateCcw: { desc: '逆时针旋转', parts: ['<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />', '<path d="M3 3v5h5" />'] },

  // ───────────────────────────── 操作（24） ─────────────────────────────
  Download: { desc: '下载', parts: ['<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />', '<path d="m7 10 5 5 5-5" />', '<path d="M12 15V3" />'] },
  Link: { desc: '链接', parts: ['<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />', '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />'] },
  Scissors: { desc: '剪切', parts: ['<circle cx="6" cy="6" r="3" />', '<path d="M8.12 8.12 12 12" />', '<path d="M20 4 8.12 15.88" />', '<circle cx="6" cy="18" r="3" />', '<path d="M14.8 14.8 20 20" />'] },
  Filter: { desc: '筛选', parts: ['<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />'] },
  Send: { desc: '发送', parts: ['<path d="m22 2-7 20-4-9-9-4Z" />', '<path d="M22 2 11 13" />'] },
  Share: { desc: '分享', parts: ['<circle cx="18" cy="5" r="3" />', '<circle cx="6" cy="12" r="3" />', '<circle cx="18" cy="19" r="3" />', '<path d="m8.59 13.51 6.83 3.98" />', '<path d="m15.41 6.51-6.82 3.98" />'] },
  ZoomIn: { desc: '放大', parts: ['<circle cx="11" cy="11" r="8" />', '<path d="m21 21-4.35-4.35" />', '<path d="M11 8v6" />', '<path d="M8 11h6" />'] },
  ZoomOut: { desc: '缩小', parts: ['<circle cx="11" cy="11" r="8" />', '<path d="m21 21-4.35-4.35" />', '<path d="M8 11h6" />'] },
  Maximize: { desc: '最大化', parts: ['<path d="M8 3H5a2 2 0 0 0-2 2v3" />', '<path d="M21 8V5a2 2 0 0 0-2-2h-3" />', '<path d="M3 16v3a2 2 0 0 0 2 2h3" />', '<path d="M16 21h3a2 2 0 0 0 2-2v-3" />'] },
  Minimize: { desc: '最小化', parts: ['<path d="M8 3v3a2 2 0 0 1-2 2H3" />', '<path d="M21 8h-3a2 2 0 0 1-2-2V3" />', '<path d="M3 16h3a2 2 0 0 1 2 2v3" />', '<path d="M16 21v-3a2 2 0 0 1 2-2h3" />'] },
  Play: { desc: '播放', parts: ['<path d="m6 3 14 9-14 9V3z" />'] },
  Pause: { desc: '暂停', parts: ['<rect x="6" y="4" width="4" height="16" rx="1" />', '<rect x="14" y="4" width="4" height="16" rx="1" />'] },
  SkipForward: { desc: '快进 / 下一个', parts: ['<path d="m5 4 10 8-10 8V4z" />', '<path d="M19 5v14" />'] },
  SkipBack: { desc: '快退 / 上一个', parts: ['<path d="m19 20-10-8 10-8v16z" />', '<path d="M5 19V5" />'] },
  Save: { desc: '保存（软盘）', parts: ['<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />', '<path d="M17 21v-8H7v8" />', '<path d="M7 3v5h8" />'] },
  Terminal: { desc: '终端', parts: ['<path d="m4 17 6-6-6-6" />', '<path d="M12 19h8" />'] },
  Code: { desc: '代码', parts: ['<path d="m16 18 6-6-6-6" />', '<path d="m8 6-6 6 6 6" />'] },
  Type: { desc: '文本', parts: ['<path d="M4 7V4h16v3" />', '<path d="M9 20h6" />', '<path d="M12 4v16" />'] },
  Bold: { desc: '加粗', parts: ['<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />', '<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />'] },
  Italic: { desc: '斜体', parts: ['<path d="M19 4h-9" />', '<path d="M14 20H5" />', '<path d="M15 4 9 20" />'] },
  AlignLeft: { desc: '左对齐', parts: ['<path d="M21 6H3" />', '<path d="M15 12H3" />', '<path d="M17 18H3" />'] },
  AlignCenter: { desc: '居中对齐', parts: ['<path d="M21 6H3" />', '<path d="M17 12H7" />', '<path d="M19 18H5" />'] },
  AlignRight: { desc: '右对齐', parts: ['<path d="M21 6H3" />', '<path d="M21 12H9" />', '<path d="M21 18H7" />'] },
  AlignJustify: { desc: '两端对齐', parts: ['<path d="M3 6h18" />', '<path d="M3 12h18" />', '<path d="M3 18h18" />'] },

  // ─────────────────────────── 对象 / 文件（25） ───────────────────────────
  File: { desc: '文件', parts: ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />', '<path d="M14 2v4a2 2 0 0 0 2 2h4" />'] },
  FileText: { desc: '文本文件', parts: ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />', '<path d="M14 2v4a2 2 0 0 0 2 2h4" />', '<path d="M16 13H8" />', '<path d="M16 17H8" />', '<path d="M10 9H8" />'] },
  Folder: { desc: '文件夹', parts: ['<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />'] },
  FolderOpen: { desc: '打开的文件夹', parts: ['<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />'] },
  Inbox: { desc: '收件箱', parts: ['<path d="M22 12h-6l-2 3h-4l-2-3H2" />', '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />'] },
  Archive: { desc: '归档', parts: ['<rect x="2" y="3" width="20" height="5" rx="1" />', '<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />', '<path d="M10 12h4" />'] },
  Clipboard: { desc: '剪贴板', parts: ['<rect x="8" y="2" width="8" height="4" rx="1" />', '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />'] },
  Book: { desc: '书籍', parts: ['<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />'] },
  Bookmark: { desc: '书签', parts: ['<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />'] },
  Camera: { desc: '相机', parts: ['<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />', '<circle cx="12" cy="13" r="3" />'] },
  Film: { desc: '影片 / 胶片', parts: ['<rect x="3" y="3" width="18" height="18" rx="2" />', '<path d="M7 3v18" />', '<path d="M3 7.5h4" />', '<path d="M3 12h18" />', '<path d="M3 16.5h4" />', '<path d="M17 3v18" />', '<path d="M17 7.5h4" />', '<path d="M17 16.5h4" />'] },
  Music: { desc: '音乐', parts: ['<path d="M9 18V5l12-2v13" />', '<circle cx="6" cy="18" r="3" />', '<circle cx="18" cy="16" r="3" />'] },
  Video: { desc: '视频', parts: ['<path d="m22 8-6 4 6 4V8Z" />', '<rect x="2" y="6" width="14" height="12" rx="2" />'] },
  Mic: { desc: '麦克风', parts: ['<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />', '<path d="M19 10v2a7 7 0 0 1-14 0v-2" />', '<path d="M12 19v3" />'] },
  Image: { desc: '图片', parts: ['<rect x="3" y="3" width="18" height="18" rx="2" />', '<circle cx="9" cy="9" r="2" />', '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />'] },
  Package: { desc: '包裹', parts: ['<path d="m7.5 4.27 9 5.15" />', '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />', '<path d="m3.3 7 8.7 5 8.7-5" />', '<path d="M12 22V12" />'] },
  Truck: { desc: '货车 / 配送', parts: ['<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />', '<path d="M15 18H9" />', '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />', '<circle cx="17" cy="18" r="2" />', '<circle cx="7" cy="18" r="2" />'] },
  ShoppingBag: { desc: '购物袋', parts: ['<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />', '<path d="M3 6h18" />', '<path d="M16 10a4 4 0 0 1-8 0" />'] },
  ShoppingCart: { desc: '购物车', parts: ['<circle cx="8" cy="21" r="1" />', '<circle cx="19" cy="21" r="1" />', '<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />'] },
  CreditCard: { desc: '银行卡', parts: ['<rect x="2" y="5" width="20" height="14" rx="2" />', '<path d="M2 10h20" />'] },
  DollarSign: { desc: '美元符号', parts: ['<path d="M12 2v20" />', '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />'] },
  Percent: { desc: '百分号 / 折扣', parts: ['<path d="M19 5 5 19" />', '<circle cx="6.5" cy="6.5" r="2.5" />', '<circle cx="17.5" cy="17.5" r="2.5" />'] },
  TagIcon: { desc: '标签（图标语义；避免与业务 Tag 组件同名混淆，故命名 TagIcon）', parts: ['<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />', '<path d="M7 7h.01" />'] },
  Ticket: { desc: '票券', parts: ['<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />', '<path d="M13 5v2" />', '<path d="M13 11v2" />', '<path d="M13 17v2" />'] },
  Gift: { desc: '礼物', parts: ['<rect x="3" y="8" width="18" height="4" rx="1" />', '<path d="M12 8v13" />', '<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />', '<path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 11 4.5 12 8c1-3.5 3-5 4.5-5a2.5 2.5 0 0 1 0 5" />'] },

  // ─────────────────────────── 设备 / 系统（29） ───────────────────────────
  Monitor: { desc: '显示器', parts: ['<rect x="2" y="3" width="20" height="14" rx="2" />', '<path d="M8 21h8" />', '<path d="M12 17v4" />'] },
  Smartphone: { desc: '智能手机', parts: ['<rect x="5" y="2" width="14" height="20" rx="2" />', '<path d="M12 18h.01" />'] },
  Tablet: { desc: '平板', parts: ['<rect x="4" y="2" width="16" height="20" rx="2" />', '<path d="M12 18h.01" />'] },
  Watch: { desc: '手表', parts: ['<circle cx="12" cy="12" r="6" />', '<path d="M12 10v2l1 1" />', '<path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05" />', '<path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05" />'] },
  Printer: { desc: '打印机', parts: ['<path d="M6 9V2h12v7" />', '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />', '<rect x="6" y="14" width="12" height="8" rx="1" />'] },
  HardDrive: { desc: '硬盘', parts: ['<path d="M22 12H2" />', '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />', '<path d="M6 16h.01" />', '<path d="M10 16h.01" />'] },
  Database: { desc: '数据库', parts: ['<ellipse cx="12" cy="5" rx="9" ry="3" />', '<path d="M3 5v14a9 3 0 0 0 18 0V5" />', '<path d="M3 12a9 3 0 0 0 18 0" />'] },
  Server: { desc: '服务器', parts: ['<rect x="2" y="2" width="20" height="8" rx="2" />', '<rect x="2" y="14" width="20" height="8" rx="2" />', '<path d="M6 6h.01" />', '<path d="M6 18h.01" />'] },
  Cloud: { desc: '云', parts: ['<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />'] },
  Wifi: { desc: 'Wi-Fi 信号', parts: ['<path d="M5 13a10 10 0 0 1 14 0" />', '<path d="M8.5 16.5a5 5 0 0 1 7 0" />', '<path d="M2 8.82a15 15 0 0 1 20 0" />', '<path d="M12 20h.01" />'] },
  WifiOff: { desc: 'Wi-Fi 断开', parts: ['<path d="m1 1 22 22" />', '<path d="M8.5 16.5a5 5 0 0 1 7 0" />', '<path d="M2 8.82a15 15 0 0 1 4.17-2.65" />', '<path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />', '<path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />', '<path d="M5 13a10 10 0 0 1 5.24-2.76" />', '<path d="M12 20h.01" />'] },
  Bluetooth: { desc: '蓝牙', parts: ['<path d="m7 7 10 10-5 5V2l5 5L7 17" />'] },
  Battery: { desc: '电池', parts: ['<rect x="2" y="7" width="16" height="10" rx="2" />', '<path d="M22 11v2" />'] },
  Power: { desc: '电源', parts: ['<path d="M12 2v10" />', '<path d="M18.4 6.6a9 9 0 1 1-12.77.04" />'] },
  Shield: { desc: '盾牌', parts: ['<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />'] },
  ShieldCheck: { desc: '盾牌对勾（安全校验）', parts: ['<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />', '<path d="m9 12 2 2 4-4" />'] },
  Lock: { desc: '锁定', parts: ['<rect x="3" y="11" width="18" height="11" rx="2" />', '<path d="M7 11V7a5 5 0 0 1 10 0v4" />'] },
  Unlock: { desc: '解锁', parts: ['<rect x="3" y="11" width="18" height="11" rx="2" />', '<path d="M7 11V7a5 5 0 0 1 9.9-1" />'] },
  Key: { desc: '钥匙', parts: ['<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />'] },
  Cpu: { desc: '处理器', parts: ['<rect x="4" y="4" width="16" height="16" rx="2" />', '<rect x="9" y="9" width="6" height="6" />', '<path d="M15 2v2" />', '<path d="M15 20v2" />', '<path d="M9 2v2" />', '<path d="M9 20v2" />', '<path d="M2 15h2" />', '<path d="M2 9h2" />', '<path d="M20 15h2" />', '<path d="M20 9h2" />'] },
  Layers: { desc: '图层', parts: ['<path d="M12 2 2 7l10 5 10-5-10-5z" />', '<path d="m2 17 10 5 10-5" />', '<path d="m2 12 10 5 10-5" />'] },
  Home: { desc: '首页', parts: ['<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />', '<path d="M9 22V12h6v10" />'] },
  Building: { desc: '建筑物', parts: ['<rect x="4" y="2" width="16" height="20" rx="2" />', '<path d="M9 22v-4h6v4" />', '<path d="M8 6h.01" />', '<path d="M8 10h.01" />', '<path d="M8 14h.01" />', '<path d="M12 6h.01" />', '<path d="M12 10h.01" />', '<path d="M12 14h.01" />', '<path d="M16 6h.01" />', '<path d="M16 10h.01" />', '<path d="M16 14h.01" />'] },
  MapPin: { desc: '地图定位', parts: ['<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />', '<circle cx="12" cy="10" r="3" />'] },
  Compass: { desc: '指南针', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />'] },
  Navigation: { desc: '导航', parts: ['<path d="m3 11 19-9-9 19-2-8-8-2z" />'] },
  Globe: { desc: '全球 / 语言', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />', '<path d="M2 12h20" />'] },
  Menu: { desc: '菜单（三条横线）', parts: ['<path d="M4 6h16" />', '<path d="M4 12h16" />', '<path d="M4 18h16" />'] },
  MoreVertical: { desc: '更多（纵向三点）', parts: ['<circle cx="12" cy="5" r="1" />', '<circle cx="12" cy="12" r="1" />', '<circle cx="12" cy="19" r="1" />'] },

  // ─────────────────────────── 社交 / 状态（26） ───────────────────────────
  Users: { desc: '用户组', parts: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />', '<circle cx="9" cy="7" r="4" />', '<path d="M22 21v-2a4 4 0 0 0-3-3.87" />', '<path d="M16 3.13a4 4 0 0 1 0 7.75" />'] },
  UserPlus: { desc: '添加用户', parts: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />', '<circle cx="9" cy="7" r="4" />', '<path d="M19 8v6" />', '<path d="M22 11h-6" />'] },
  UserMinus: { desc: '移除用户', parts: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />', '<circle cx="9" cy="7" r="4" />', '<path d="M22 11h-6" />'] },
  UserCheck: { desc: '用户校验', parts: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />', '<circle cx="9" cy="7" r="4" />', '<path d="m16 11 2 2 4-4" />'] },
  Heart: { desc: '心形 / 收藏', parts: ['<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />'] },
  Star: { desc: '星形 / 评分', parts: ['<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />'] },
  ThumbsUp: { desc: '点赞', parts: ['<path d="M7 10v12" />', '<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />'] },
  ThumbsDown: { desc: '点踩', parts: ['<path d="M17 14V2" />', '<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />'] },
  Smile: { desc: '笑脸', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="M8 14s1.5 2 4 2 4-2 4-2" />', '<path d="M9 9h.01" />', '<path d="M15 9h.01" />'] },
  Frown: { desc: '皱眉', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="M16 16s-1.5-2-4-2-4 2-4 2" />', '<path d="M9 9h.01" />', '<path d="M15 9h.01" />'] },
  Flag: { desc: '旗帜', parts: ['<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />', '<path d="M4 22v-7" />'] },
  Award: { desc: '奖章', parts: ['<circle cx="12" cy="8" r="6" />', '<path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />'] },
  Zap: { desc: '闪电', parts: ['<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />'] },
  HelpCircle: { desc: '帮助（圆圈问号）', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />', '<path d="M12 17h.01" />'] },
  Bell: { desc: '铃铛 / 通知', parts: ['<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />', '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />'] },
  BellOff: { desc: '关闭通知', parts: ['<path d="M13.73 21a2 2 0 0 1-3.46 0" />', '<path d="M18.63 13A17.89 17.89 0 0 1 18 8" />', '<path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />', '<path d="M18 8a6 6 0 0 0-9.33-5" />', '<path d="m1 1 22 22" />'] },
  Mail: { desc: '邮件', parts: ['<rect x="2" y="4" width="20" height="16" rx="2" />', '<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />'] },
  MessageSquare: { desc: '方形消息', parts: ['<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />'] },
  MessageCircle: { desc: '圆形消息', parts: ['<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />'] },
  AtSign: { desc: '@ 符号 / 提及', parts: ['<circle cx="12" cy="12" r="4" />', '<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />'] },
  Clock: { desc: '时钟', parts: ['<circle cx="12" cy="12" r="10" />', '<path d="M12 6v6l4 2" />'] },
  Sun: { desc: '太阳 / 亮色', parts: ['<circle cx="12" cy="12" r="4" />', '<path d="M12 2v2" />', '<path d="M12 20v2" />', '<path d="m4.93 4.93 1.41 1.41" />', '<path d="m17.66 17.66 1.41 1.41" />', '<path d="M2 12h2" />', '<path d="M20 12h2" />', '<path d="m6.34 17.66-1.41 1.41" />', '<path d="m19.07 4.93-1.41 1.41" />'] },
  Moon: { desc: '月亮 / 暗色', parts: ['<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />'] },
  Droplet: { desc: '水滴', parts: ['<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />'] },
  Wind: { desc: '风', parts: ['<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />', '<path d="M9.6 4.6A2 2 0 1 1 11 8H2" />', '<path d="M12.6 19.4A2 2 0 1 0 14 16H2" />'] },
  CloudRain: { desc: '下雨', parts: ['<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />', '<path d="M16 14v6" />', '<path d="M8 14v6" />', '<path d="M12 16v6" />'] },
};

const force = process.argv.includes('--force');
const printIndex = process.argv.includes('--index');

const names = Object.keys(ICONS);
if (names.length !== 118) {
  throw new Error(`契约 §1 要求 118 枚，当前映射表只有 ${names.length} 枚`);
}
for (const name of names) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(`组件名不符合 PascalCase：${name}`);
  }
}

const TEMPLATE = (name, desc, body) => `'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ${name} — ${desc} */
export function ${name}({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
${body}
    </SvgIcon>
  );
}
`;

let written = 0;
let skipped = 0;
for (const [name, { desc, parts }] of Object.entries(ICONS)) {
  const file = join(outDir, `${name}.tsx`);
  if (existsSync(file) && !force) {
    skipped += 1;
    continue;
  }
  const body = parts.map((p) => `      ${p}`).join('\n');
  writeFileSync(file, TEMPLATE(name, desc, body), 'utf8');
  written += 1;
}
console.log(`[generate-icons] 写出 ${written} 个文件，跳过已存在 ${skipped} 个（合计映射表 ${names.length} 枚）。`);

if (printIndex) {
  // 按目录实际文件（含既有 24 枚）生成 index.ts 导出块，字母序
  const all = [];
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.tsx') && !f.startsWith('_')) all.push(f.replace(/\.tsx$/, ''));
  }
  all.sort((a, b) => a.localeCompare(b));
  console.log('--- index.ts 导出块（可直接粘贴到 index.ts）---');
  console.log(all.map((n) => `export { ${n} } from './icons/${n}.js';`).join('\n'));
  console.log('--- 共', all.length, '枚 ---');
}
