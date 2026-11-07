// @zui/icons 最小测试（CONTRACTS-V6.md §1）：
// 1) 导出总数 = 142（既有 24 + 契约 §1 精确清单 118；契约正文「76/100」与清单 118 矛盾，
//    经确认按清单全量实现，见 scripts/generate-icons.mjs 头注）；
// 2) 关键 SVG 属性断言（24 视窗 / stroke=currentColor / stroke-width 2 / fill none / 圆角线帽 / aria-hidden）。
// 用 react-dom/server 的 renderToStaticMarkup 渲染，node 环境即可，无需 jsdom。
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ZUIIcons from '../src/index.ts';

const NAMES = [
  // 既有 24
  'AlertTriangle', 'ArrowRight', 'Calendar', 'Check', 'CheckCircle', 'ChevronDown', 'ChevronLeft',
  'ChevronRight', 'ChevronUp', 'Close', 'Copy', 'Edit', 'Eye', 'EyeOff', 'Info', 'Loading',
  'Minus', 'MoreHorizontal', 'Plus', 'Search', 'Settings', 'Trash', 'User', 'XCircle',
  // 方向 14
  'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowUpRight', 'ArrowDownRight', 'ChevronsLeft',
  'ChevronsRight', 'ChevronsUp', 'ChevronsDown', 'ExternalLink', 'LogIn', 'LogOut',
  'RefreshCw', 'RotateCcw',
  // 操作 24
  'Download', 'Link', 'Scissors', 'Filter', 'Send', 'Share', 'ZoomIn', 'ZoomOut', 'Maximize',
  'Minimize', 'Play', 'Pause', 'SkipForward', 'SkipBack', 'Save', 'Terminal', 'Code', 'Type',
  'Bold', 'Italic', 'AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify',
  // 对象/文件 25
  'File', 'FileText', 'Folder', 'FolderOpen', 'Inbox', 'Archive', 'Clipboard', 'Book', 'Bookmark',
  'Camera', 'Film', 'Music', 'Video', 'Mic', 'Image', 'Package', 'Truck', 'ShoppingBag',
  'ShoppingCart', 'CreditCard', 'DollarSign', 'Percent', 'TagIcon', 'Ticket', 'Gift',
  // 设备/系统 29
  'Monitor', 'Smartphone', 'Tablet', 'Watch', 'Printer', 'HardDrive', 'Database', 'Server',
  'Cloud', 'Wifi', 'WifiOff', 'Bluetooth', 'Battery', 'Power', 'Shield', 'ShieldCheck', 'Lock',
  'Unlock', 'Key', 'Cpu', 'Layers', 'Home', 'Building', 'MapPin', 'Compass', 'Navigation',
  'Globe', 'Menu', 'MoreVertical',
  // 社交/状态 26
  'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'Heart', 'Star', 'ThumbsUp', 'ThumbsDown',
  'Smile', 'Frown', 'Flag', 'Award', 'Zap', 'HelpCircle', 'Bell', 'BellOff', 'Mail',
  'MessageSquare', 'MessageCircle', 'AtSign', 'Clock', 'Sun', 'Moon', 'Droplet', 'Wind',
  'CloudRain',
];

describe('@zui/icons 导出', () => {
  it('导出总数 = 142（24 既有 + 118 新增），且与契约名单一一对应', () => {
    const keys = Object.keys(ZUIIcons).sort();
    expect(keys).toHaveLength(142);
    expect(keys).toEqual([...NAMES].sort());
  });

  it('每枚图标都是函数组件', () => {
    for (const name of NAMES) {
      expect(typeof ZUIIcons[name]).toBe('function');
    }
  });
});

describe('@zui/icons 关键 SVG 属性', () => {
  const htmlOf = (name, props) =>
    renderToStaticMarkup(createElement(ZUIIcons[name], props));

  it('全部 142 枚渲染出统一骨架：24 视窗 / currentColor / stroke-width 2 / fill none / 圆角线帽 / aria-hidden', () => {
    for (const name of NAMES) {
      const html = htmlOf(name);
      expect(html, name).toContain('viewBox="0 0 24 24"');
      expect(html, name).toContain('stroke="currentColor"');
      expect(html, name).toContain('stroke-width="2"');
      expect(html, name).toContain('fill="none"');
      expect(html, name).toContain('stroke-linecap="round"');
      expect(html, name).toContain('stroke-linejoin="round"');
      expect(html, name).toContain('aria-hidden="true"');
    }
  });

  it('size / color props 透传', () => {
    const html = htmlOf('Check', { size: 20, color: '#1677ff' });
    expect(html).toContain('width="20"');
    expect(html).toContain('height="20"');
    expect(html).toContain('stroke="#1677ff"');
  });

  it('传入 aria-label 时移除 aria-hidden', () => {
    const html = htmlOf('Search', { 'aria-label': '搜索' });
    expect(html).toContain('aria-label="搜索"');
    expect(html).not.toContain('aria-hidden');
  });

  it('TagIcon 是标签图标（非业务 Tag），渲染出 tag 形状 path', () => {
    const html = htmlOf('TagIcon');
    expect(html).toContain('M20.59 13.41');
  });

  it('spin 仅 Loading 有旋转动画：Loading 默认带 animateTransform，其余图标忽略 spin', () => {
    expect(htmlOf('Loading')).toMatch(/animatetransform/i);
    expect(htmlOf('Loading', { spin: false })).not.toMatch(/animatetransform/i);
    // RefreshCw 无旋转语义：接受 spin 但不产生动画
    expect(htmlOf('RefreshCw', { spin: true })).not.toMatch(/animatetransform/i);
  });
});
