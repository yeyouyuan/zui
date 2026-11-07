import { useMemo, useState } from 'react';
import * as ZuiIcons from '@zui/icons';
import { Input, Tag } from '@zui/react';

import CodeBlock from '../../components/CodeBlock';
import { usePageTitle } from '../../components/usePageTitle';

/* --------------------------------- 分类数据 -------------------------------- */

/** 图标名 → 分类（与 packages/icons/README.md 分组一致） */
const CATEGORY_OF: Record<string, string> = {
  // 基础（原 24 枚）
  Check: '基础', Close: '基础', Search: '基础', Plus: '基础', Minus: '基础', Info: '基础',
  Copy: '基础', Trash: '基础', Edit: '基础', Eye: '基础', EyeOff: '基础', Loading: '基础',
  MoreHorizontal: '基础', Settings: '基础', User: '基础', Calendar: '基础',
  // 方向与箭头
  ArrowRight: '方向', ArrowLeft: '方向', ArrowUp: '方向', ArrowDown: '方向',
  ArrowUpRight: '方向', ArrowDownRight: '方向',
  ChevronDown: '方向', ChevronUp: '方向', ChevronLeft: '方向', ChevronRight: '方向',
  ChevronsLeft: '方向', ChevronsRight: '方向', ChevronsUp: '方向', ChevronsDown: '方向',
  ExternalLink: '方向', LogIn: '方向', LogOut: '方向', RefreshCw: '方向', RotateCcw: '方向',
  // 操作与编辑
  Download: '操作', Link: '操作', Scissors: '操作', Filter: '操作', Send: '操作', Share: '操作',
  ZoomIn: '操作', ZoomOut: '操作', Maximize: '操作', Minimize: '操作', Play: '操作', Pause: '操作',
  SkipForward: '操作', SkipBack: '操作', Save: '操作', Terminal: '操作', Code: '操作',
  Type: '操作', Bold: '操作', Italic: '操作',
  AlignLeft: '操作', AlignCenter: '操作', AlignRight: '操作', AlignJustify: '操作',
  // 对象与文件
  File: '对象', FileText: '对象', Folder: '对象', FolderOpen: '对象', Inbox: '对象',
  Archive: '对象', Clipboard: '对象', Book: '对象', Bookmark: '对象', Camera: '对象',
  Film: '对象', Music: '对象', Video: '对象', Mic: '对象', Image: '对象',
  Package: '对象', Truck: '对象', ShoppingBag: '对象', ShoppingCart: '对象',
  CreditCard: '对象', DollarSign: '对象', Percent: '对象', TagIcon: '对象', Ticket: '对象',
  Gift: '对象',
  // 设备与系统
  Monitor: '设备', Smartphone: '设备', Tablet: '设备', Watch: '设备', Printer: '设备',
  HardDrive: '设备', Database: '设备', Server: '设备', Cloud: '设备', Wifi: '设备',
  WifiOff: '设备', Bluetooth: '设备', Battery: '设备', Power: '设备', Shield: '设备',
  ShieldCheck: '设备', Lock: '设备', Unlock: '设备', Key: '设备', Cpu: '设备',
  Layers: '设备', Home: '设备', Building: '设备', MapPin: '设备', Compass: '设备',
  Navigation: '设备', Globe: '设备', Menu: '设备', MoreVertical: '设备',
  // 社交与状态
  Users: '社交', UserPlus: '社交', UserMinus: '社交', UserCheck: '社交', Heart: '社交',
  Star: '社交', ThumbsUp: '社交', ThumbsDown: '社交', Smile: '社交', Frown: '社交',
  Flag: '社交', Award: '社交', Zap: '社交', HelpCircle: '社交', Bell: '社交',
  BellOff: '社交', Mail: '社交', MessageSquare: '社交', MessageCircle: '社交',
  AtSign: '社交', Clock: '社交', Sun: '社交', Moon: '社交', Droplet: '社交',
  Wind: '社交', CloudRain: '社交',
  // 状态语义
  CheckCircle: '状态语义', XCircle: '状态语义', AlertTriangle: '状态语义',
};

const CATEGORY_ORDER = ['基础', '方向', '操作', '对象', '设备', '社交', '状态语义'];

const USAGE_CODE = `import { Calendar, Search, CheckCircle } from '@zui/icons';

// 尺寸（默认 1em，随字号缩放）、颜色（默认 currentColor，随文字变色）
<Calendar size={16} />
<Search size={24} color="var(--z-color-primary)" />
<CheckCircle spin={false} />

// 唯一带旋转的图标：<Loading />（内置 animateTransform 循环）`;

/* --------------------------------- 图标注册表 -------------------------------- */

interface IconEntry {
  name: string;
  Component: (props: { size?: number | string; color?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) => React.ReactNode;
  category: string;
}

const ALL_ICONS: IconEntry[] = Object.entries(ZuiIcons)
  .filter(([name, value]) => name !== 'IconProps' && typeof value === 'function')
  .map(([name, Component]) => ({
    name,
    Component: Component as IconEntry['Component'],
    category: CATEGORY_OF[name] ?? '其他',
  }))
  .sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
  });

/* --------------------------------- 页面 --------------------------------- */

export default function IconGalleryPage(): React.ReactNode {
  usePageTitle('图标库');

  const [keyword, setKeyword] = useState('');
  const [activeSize, setActiveSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return ALL_ICONS;
    return ALL_ICONS.filter(({ name, category }) =>
      name.toLowerCase().includes(kw) || category.includes(kw)
    );
  }, [keyword]);

  const grouped = useMemo(() => {
    const map = new Map<string, IconEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [filtered]);

  const copyUsage = async (name: string) => {
    const snippet = `import { ${name} } from '@zui/icons';`;
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = snippet;
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedName(name);
    window.setTimeout(() => setCopiedName((prev) => (prev === name ? null : prev)), 1200);
  };

  const sizePx = activeSize === 'sm' ? 16 : activeSize === 'lg' ? 32 : 24;

  return (
    <div className="doc-page">
      <h1 className="doc-h1">图标库</h1>
      <p className="doc-lead">
        @zui/icons 内置 {ALL_ICONS.length} 枚线性图标（24 视窗、stroke=currentColor、圆角线帽，
        Feather/Lucide 风格）。点击任意图标复制引用代码；支持按名称 / 分类过滤。
      </p>

      <h2 className="doc-h2">使用方式</h2>
      <CodeBlock language="tsx" code={USAGE_CODE} />

      <h2 className="doc-h2">图标总览</h2>
      <div className="doc-pg-preview-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 220 }}>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按名称或分类过滤，如 calendar / 方向"
            aria-label="按名称或分类过滤图标"
            clearable
            onClear={() => setKeyword('')}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>预览尺寸</span>
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <Tag
              key={s}
              color={activeSize === s ? 'primary' : 'neutral'}
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveSize(s)}
            >
              {s} · {s === 'sm' ? 16 : s === 'md' ? 24 : 32}px
            </Tag>
          ))}
          <Tag color="neutral">{filtered.length} / {ALL_ICONS.length} 枚</Tag>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="doc-p">没有匹配「{keyword.trim()}」的图标。</p>
      ) : (
        grouped.map(({ category, items }) => (
          <section key={category} style={{ marginTop: 24 }}>
            <h3 className="doc-h3" style={{ margin: '0 0 12px' }}>
              {category} <span style={{ fontWeight: 400, fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>({items.length})</span>
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
                gap: 8,
              }}
            >
              {items.map(({ name, Component }) => (
                <button
                  key={name}
                  type="button"
                  title={`点击复制 ${name} 的引用代码`}
                  onClick={() => void copyUsage(name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 8px 10px',
                    border: '1px solid var(--z-color-border-subtle)',
                    borderRadius: 'var(--z-radius-md)',
                    background: copiedName === name ? 'var(--z-color-success-subtle)' : 'var(--z-color-bg)',
                    color: 'var(--z-color-fg)',
                    cursor: 'pointer',
                    transition: 'background-color var(--z-duration-fast) var(--z-ease-standard)',
                  }}
                >
                  <Component size={sizePx} />
                  <span
                    style={{
                      fontSize: 'var(--z-text-xs)',
                      color: 'var(--z-color-fg-muted)',
                      wordBreak: 'break-all',
                      lineHeight: 1.2,
                    }}
                  >
                    {copiedName === name ? '已复制 ✓' : name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <h2 className="doc-h2">API</h2>
      <div className="doc-p">
        全部图标共享同一组 props（见 <code className="doc-code-inline">IconProps</code>）：
      </div>
      <table className="doc-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>prop</th>
            <th style={{ textAlign: 'left', padding: 8 }}>类型</th>
            <th style={{ textAlign: 'left', padding: 8 }}>默认值</th>
            <th style={{ textAlign: 'left', padding: 8 }}>说明</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['size', `number | string`, `'1em'`, '图标尺寸；默认随字号缩放'],
            ['color', 'string', 'currentColor', '线条颜色，默认继承文字色'],
            ['spin', 'boolean', 'Loading 为 true', '旋转动画；仅 Loading 有意义，其余图标忽略'],
            ['aria-label', 'string', '—', '传入时图标对读屏可见并自动移除 aria-hidden'],
          ].map(([n, t, d, desc]) => (
            <tr key={n}>
              <td style={{ padding: 8 }}><code className="doc-code-inline">{n}</code></td>
              <td style={{ padding: 8 }}><code className="doc-code-inline">{t}</code></td>
              <td style={{ padding: 8 }}>{d}</td>
              <td style={{ padding: 8 }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
