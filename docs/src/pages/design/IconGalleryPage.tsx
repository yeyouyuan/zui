import { useEffect, useMemo, useRef, useState } from 'react';
import * as ZuiIcons from '@zui/icons';
import { Button, Input, Tag, Typography } from '@zui/react';

import CodeBlock, { copyCodeText } from '../../components/CodeBlock';
import { usePageTitle } from '../../components/usePageTitle';
import './icon-gallery.css';

/* --------------------------------- 分类数据 -------------------------------- */

/** 图标名 → 分类（与 packages/icons/README.md 分组一致） */
const CATEGORY_OF: Record<string, string> = {
  Check: '基础',
  Close: '基础',
  Search: '基础',
  Plus: '基础',
  Minus: '基础',
  Info: '基础',
  Copy: '基础',
  Trash: '基础',
  Edit: '基础',
  Eye: '基础',
  EyeOff: '基础',
  Loading: '基础',
  MoreHorizontal: '基础',
  Settings: '基础',
  User: '基础',
  Calendar: '基础',
  ArrowRight: '方向',
  ArrowLeft: '方向',
  ArrowUp: '方向',
  ArrowDown: '方向',
  ArrowUpRight: '方向',
  ArrowDownRight: '方向',
  ChevronDown: '方向',
  ChevronUp: '方向',
  ChevronLeft: '方向',
  ChevronRight: '方向',
  ChevronsLeft: '方向',
  ChevronsRight: '方向',
  ChevronsUp: '方向',
  ChevronsDown: '方向',
  ExternalLink: '方向',
  LogIn: '方向',
  LogOut: '方向',
  RefreshCw: '方向',
  RotateCcw: '方向',
  Download: '操作',
  Link: '操作',
  Scissors: '操作',
  Filter: '操作',
  Send: '操作',
  Share: '操作',
  ZoomIn: '操作',
  ZoomOut: '操作',
  Maximize: '操作',
  Minimize: '操作',
  Play: '操作',
  Pause: '操作',
  SkipForward: '操作',
  SkipBack: '操作',
  Save: '操作',
  Terminal: '操作',
  Code: '操作',
  Type: '操作',
  Bold: '操作',
  Italic: '操作',
  AlignLeft: '操作',
  AlignCenter: '操作',
  AlignRight: '操作',
  AlignJustify: '操作',
  File: '对象',
  FileText: '对象',
  Folder: '对象',
  FolderOpen: '对象',
  Inbox: '对象',
  Archive: '对象',
  Clipboard: '对象',
  Book: '对象',
  Bookmark: '对象',
  Camera: '对象',
  Film: '对象',
  Music: '对象',
  Video: '对象',
  Mic: '对象',
  Image: '对象',
  Package: '对象',
  Truck: '对象',
  ShoppingBag: '对象',
  ShoppingCart: '对象',
  CreditCard: '对象',
  DollarSign: '对象',
  Percent: '对象',
  TagIcon: '对象',
  Ticket: '对象',
  Gift: '对象',
  Monitor: '设备',
  Smartphone: '设备',
  Tablet: '设备',
  Watch: '设备',
  Printer: '设备',
  HardDrive: '设备',
  Database: '设备',
  Server: '设备',
  Cloud: '设备',
  Wifi: '设备',
  WifiOff: '设备',
  Bluetooth: '设备',
  Battery: '设备',
  Power: '设备',
  Shield: '设备',
  ShieldCheck: '设备',
  Lock: '设备',
  Unlock: '设备',
  Key: '设备',
  Cpu: '设备',
  Layers: '设备',
  Home: '设备',
  Building: '设备',
  MapPin: '设备',
  Compass: '设备',
  Navigation: '设备',
  Globe: '设备',
  Menu: '设备',
  MoreVertical: '设备',
  Users: '社交',
  UserPlus: '社交',
  UserMinus: '社交',
  UserCheck: '社交',
  Heart: '社交',
  Star: '社交',
  ThumbsUp: '社交',
  ThumbsDown: '社交',
  Smile: '社交',
  Frown: '社交',
  Flag: '社交',
  Award: '社交',
  Zap: '社交',
  HelpCircle: '社交',
  Bell: '社交',
  BellOff: '社交',
  Mail: '社交',
  MessageSquare: '社交',
  MessageCircle: '社交',
  AtSign: '社交',
  Clock: '社交',
  Sun: '社交',
  Moon: '社交',
  Droplet: '社交',
  Wind: '社交',
  CloudRain: '社交',
  CheckCircle: '状态语义',
  XCircle: '状态语义',
  AlertTriangle: '状态语义',
};

const CATEGORY_ORDER = [
  '基础',
  '方向',
  '操作',
  '对象',
  '设备',
  '社交',
  '状态语义',
  '其他',
] as const;

type IconComponent = (props: Record<string, unknown>) => React.ReactNode;

interface IconEntry {
  name: string;
  Component: IconComponent;
  category: string;
}

const ALL_ICONS: IconEntry[] = Object.entries(ZuiIcons)
  .filter(([name, value]) => name !== 'IconProps' && typeof value === 'function')
  .map(([name, Component]) => ({
    name,
    Component: Component as unknown as IconComponent,
    category: CATEGORY_OF[name] ?? '其他',
  }))
  .sort((a, b) => {
    const catDiff =
      CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]) -
      CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]);
    return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
  });

const COLOR_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '默认', value: 'var(--z-color-fg)' },
  { label: '主色', value: 'var(--z-color-primary)' },
  { label: '成功', value: 'var(--z-color-success)' },
  { label: '警告', value: 'var(--z-color-warning)' },
  { label: '危险', value: 'var(--z-color-danger)' },
];

const SIZE_PRESETS = [16, 20, 24, 32, 48];
const STROKE_OPTIONS = [1, 1.5, 2, 2.5];

const USAGE_CODE = `import { Calendar, Search, Loading } from '@zui/icons';

// 尺寸（默认 1em，随字号缩放）、颜色（默认 currentColor，随文字变色）
<Calendar size={16} />
<Search size={24} color="var(--z-color-primary)" />
<Loading spin={false} />

// 唯一带旋转动画的图标：<Loading />（默认转圈，传 spin={false} 静态展示）`;

/* --------------------------------- 页面 --------------------------------- */

export default function IconGalleryPage(): React.ReactNode {
  usePageTitle('图标库');

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('全部');
  const [size, setSize] = useState(24);
  const [stroke, setStroke] = useState(2);
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [spinPreview, setSpinPreview] = useState(true);
  const [selected, setSelected] = useState<IconEntry | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const detailCloseRef = useRef<HTMLButtonElement | null>(null);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const restoreFocusFrame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
      window.cancelAnimationFrame(restoreFocusFrame.current ?? 0);
    },
    []
  );
  useEffect(() => {
    setCopied(null);
    setCopyError(false);
    if (!selected) return;
    const compactLayout = window.matchMedia('(max-width: 1200px)').matches;
    const frame = window.requestAnimationFrame(() => {
      if (compactLayout) {
        detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      // 详情在窄屏会视觉前置；主动移入焦点，避免 Tab 仍从后续图标继续。
      detailCloseRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const closeDetail = () => {
    const trigger = selectedTriggerRef.current;
    setSelected(null);
    window.cancelAnimationFrame(restoreFocusFrame.current ?? 0);
    restoreFocusFrame.current = window.requestAnimationFrame(() => {
      restoreFocusFrame.current = undefined;
      // 关闭按钮随详情卸载，需显式把焦点交还给仍在文档中的触发卡片。
      if (trigger?.isConnected) trigger.focus();
    });
  };

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of ALL_ICONS) {
      map.set(entry.category, (map.get(entry.category) ?? 0) + 1);
    }
    return map;
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return ALL_ICONS.filter(({ name, category: cat }) => {
      if (category !== '全部' && cat !== category) return false;
      if (!kw) return true;
      return name.toLowerCase().includes(kw) || cat.includes(kw);
    });
  }, [keyword, category]);

  useEffect(() => {
    if (selected && !filtered.some((entry) => entry.name === selected.name)) {
      // 用户正在操作筛选控件时保持其焦点；隐藏的触发卡不再适合作为恢复目标。
      setSelected(null);
    }
  }, [filtered, selected]);

  const grouped = useMemo(() => {
    if (filtered.length === 0) return [];
    if (category !== '全部') {
      return [{ category, items: filtered }];
    }
    const map = new Map<string, IconEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }));
  }, [filtered, category]);

  const copy = async (text: string, key: string) => {
    const ok = await copyCodeText(text);
    setCopied(ok ? key : null);
    setCopyError(!ok);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setCopied(null);
      setCopyError(false);
    }, 2000);
  };

  const copyRawSvg = () => {
    const source = svgRef.current;
    if (!source) return;
    const svg = source.cloneNode(true) as SVGSVGElement;
    // 独立 SVG 不依赖文档站令牌；复制用户当前看见的实际颜色与尺寸。
    svg.setAttribute('stroke', window.getComputedStyle(source).stroke);
    if (selected?.name === 'Loading' && spinPreview) {
      const group = svg.querySelector('g');
      if (group) {
        group.setAttribute('data-zui-loading', '');
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent =
          '@media(prefers-reduced-motion:no-preference){[data-zui-loading]{transform-box:view-box;transform-origin:center;animation:zui-loading-spin 1s linear infinite}@keyframes zui-loading-spin{to{transform:rotate(360deg)}}}';
        svg.prepend(style);
      }
    }
    void copy(svg.outerHTML, 'raw-svg');
  };

  /** 数值尺寸始终携带属性：组件默认 1em，并不是当前预览的 24px。 */
  const usageFor = (name: string, withStroke = false) => {
    const attrs: string[] = [`size={${size}}`];
    if (color !== COLOR_OPTIONS[0].value) attrs.push(`color="${color}"`);
    if (withStroke && stroke !== 2) attrs.push(`strokeWidth={${stroke}}`);
    if (name === 'Loading' && !spinPreview) attrs.push('spin={false}');
    return attrs.length ? `<${name} ${attrs.join(' ')} />` : `<${name} />`;
  };

  /* ------------------------------ 详情面板 ------------------------------ */

  const detail = selected ? (
    <aside
      id="icon-detail"
      ref={detailRef}
      className="doc-icon-detail"
      aria-label={`${selected.name} 图标详情`}
    >
      <div className="doc-icon-detail-heading">
        <span>图标详情</span>
        <Button
          ref={detailCloseRef}
          size="sm"
          variant="ghost"
          aria-label="关闭图标详情"
          onClick={closeDetail}
        >
          <ZuiIcons.Close size={16} />
        </Button>
      </div>
      <div className="doc-icon-detail-preview">
        <selected.Component
          ref={svgRef}
          size={size}
          color={color}
          {...(selected.name === 'Loading' ? { spin: spinPreview } : {})}
          {...(stroke !== 2 ? { strokeWidth: stroke } : {})}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Typography.Text strong>{selected.name}</Typography.Text>
        <Tag color="neutral">{selected.category}</Tag>
      </div>

      <Group label="尺寸">
        {SIZE_PRESETS.map((s) => (
          <Chip key={s} active={size === s} onClick={() => setSize(s)}>
            {s}
          </Chip>
        ))}
      </Group>

      {selected.name === 'Loading' ? (
        <Group label="旋转动画">
          {[
            { label: '转圈', value: true },
            { label: '静态', value: false },
          ].map((opt) => (
            <Chip
              key={opt.label}
              active={spinPreview === opt.value}
              onClick={() => setSpinPreview(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </Group>
      ) : null}

      <Group label="线条粗细">
        {STROKE_OPTIONS.map((w) => (
          <Chip key={w} active={stroke === w} onClick={() => setStroke(w)}>
            {w}
          </Chip>
        ))}
      </Group>

      <Group label="颜色">
        {COLOR_OPTIONS.map((opt) => (
          <Chip key={opt.label} active={color === opt.value} onClick={() => setColor(opt.value)}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 'var(--z-radius-full)',
                background: opt.value,
                marginRight: 4,
              }}
            />
            {opt.label}
          </Chip>
        ))}
      </Group>

      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <CodeChip
          label={copied === 'import' ? '已复制 ✓' : '复制 import'}
          onClick={() => void copy(`import { ${selected.name} } from '@zui/icons';`, 'import')}
        />
        <CodeChip
          label={copied === 'jsx' ? '已复制 ✓' : '复制 JSX'}
          code={usageFor(selected.name, true)}
          onClick={() => void copy(usageFor(selected.name, true), 'jsx')}
        />
        <CodeChip label={copied === 'raw-svg' ? '已复制 ✓' : '复制原始 SVG'} onClick={copyRawSvg} />
      </div>
      <p className="doc-icon-copy-status" role="status">
        {copyError ? '复制失败，请使用浏览器选择并复制代码。' : copied ? '已复制到剪贴板' : ''}
      </p>
    </aside>
  ) : null;

  /* --------------------------------- 渲染 --------------------------------- */

  return (
    <div className="doc-page doc-icon-page">
      <h1 className="doc-h1">图标库</h1>
      <p className="doc-lead">
        @zui/icons 内置 {ALL_ICONS.length} 枚线性图标（24 视窗、stroke=currentColor、圆角线帽，
        Feather/Lucide 风格）。点击图标查看详情并复制引用代码；支持按名称 / 分类过滤、 实时调节尺寸
        / 线条粗细 / 颜色。
      </p>

      <h2 className="doc-h2">使用方式</h2>
      <CodeBlock language="tsx" code={USAGE_CODE} />

      <h2 className="doc-h2">图标总览</h2>

      {/* ------------------------------ 工具栏 ------------------------------ */}
      <div className="doc-icon-toolbar">
        <div
          className="doc-pg-preview-row"
          style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
        >
          <div className="doc-icon-search">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按名称或分类过滤，如 calendar / 方向"
              aria-label="按名称或分类过滤图标"
              clearable
              onClear={() => setKeyword('')}
            />
          </div>
          <Tag color="neutral">
            {filtered.length} / {ALL_ICONS.length} 枚
          </Tag>
          {selected ? (
            <Button size="sm" variant="outline" onClick={closeDetail}>
              关闭详情
            </Button>
          ) : null}
        </div>
        {/* 分类快捷筛选 chips */}
        <div
          role="group"
          aria-label="图标分类"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          <Chip active={category === '全部'} onClick={() => setCategory('全部')}>
            全部 · {ALL_ICONS.length}
          </Chip>
          {CATEGORY_ORDER.filter((c) => categoryCounts.has(c)).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c} · {categoryCounts.get(c) ?? 0}
            </Chip>
          ))}
        </div>
      </div>

      {/* ------------------------- 网格 + 详情双栏 ------------------------- */}
      <div className="doc-icon-layout" data-detail={selected ? 'open' : 'closed'}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {grouped.length === 0 ? (
            <div className="doc-icon-empty" role="status">
              <ZuiIcons.Search size={28} />
              <p className="doc-p">没有匹配「{keyword.trim()}」的图标。</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKeyword('');
                  setCategory('全部');
                }}
              >
                重置筛选
              </Button>
            </div>
          ) : (
            grouped.map(({ category: cat, items }) => (
              <section key={cat} style={{ marginTop: 16, marginBottom: 24 }}>
                <h3 className="doc-h3" style={{ margin: '0 0 12px' }}>
                  {cat}{' '}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 'var(--z-text-xs)',
                      color: 'var(--z-color-fg-muted)',
                    }}
                  >
                    ({items.length})
                  </span>
                </h3>
                <div className="doc-icon-grid">
                  {items.map(({ name, Component }) => (
                    <button
                      key={name}
                      type="button"
                      className="doc-icon-card"
                      aria-pressed={selected?.name === name}
                      aria-controls="icon-detail"
                      title={`${name} — 点击查看详情`}
                      onClick={(event) => {
                        if (selected?.name === name) {
                          setSelected(null);
                          return;
                        }
                        selectedTriggerRef.current = event.currentTarget;
                        setSelected({ name, Component, category: cat });
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: '14px 8px 10px',
                        border: `1px solid ${
                          selected?.name === name
                            ? 'var(--z-color-primary)'
                            : 'var(--z-color-border-subtle)'
                        }`,
                        borderRadius: 'var(--z-radius-md)',
                        background:
                          selected?.name === name
                            ? 'var(--z-color-primary-subtle)'
                            : 'var(--z-color-bg)',
                        color: 'var(--z-color-fg)',
                        cursor: 'pointer',
                        transition:
                          'background-color var(--z-duration-fast) var(--z-ease-standard), border-color var(--z-duration-fast) var(--z-ease-standard)',
                      }}
                    >
                      <Component
                        size={size}
                        color={color}
                        {...(name === 'Loading' ? { spin: spinPreview } : {})}
                        {...(stroke !== 2 ? { strokeWidth: stroke } : {})}
                      />
                      <span
                        style={{
                          fontSize: 'var(--z-text-xs)',
                          color: 'var(--z-color-fg-muted)',
                          wordBreak: 'break-all',
                          lineHeight: 1.2,
                        }}
                      >
                        {name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        {detail}
      </div>
    </div>
  );
}

/* --------------------------------- 局部部件 --------------------------------- */

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 'var(--z-text-xs)',
          color: 'var(--z-color-fg-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="doc-icon-chip"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        fontSize: 'var(--z-text-xs)',
        fontFamily: 'inherit',
        border: `1px solid ${active ? 'var(--z-color-primary)' : 'var(--z-color-border-subtle)'}`,
        borderRadius: 'var(--z-radius-full)',
        background: active ? 'var(--z-color-primary-subtle)' : 'var(--z-color-bg)',
        color: active ? 'var(--z-color-primary-subtle-fg)' : 'var(--z-color-fg-muted)',
        cursor: 'pointer',
        transition:
          'background-color var(--z-duration-fast) var(--z-ease-standard), border-color var(--z-duration-fast) var(--z-ease-standard)',
      }}
    >
      {children}
    </button>
  );
}

function CodeChip({ label, code, onClick }: { label: string; code?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="doc-icon-code-chip"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '6px 10px',
        fontSize: 'var(--z-text-xs)',
        fontFamily: 'var(--z-font-mono)',
        textAlign: 'left',
        border: '1px solid var(--z-color-border-subtle)',
        borderRadius: 'var(--z-radius-sm)',
        background: 'var(--z-color-bg-subtle)',
        color: 'var(--z-color-fg)',
        cursor: 'pointer',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {code ?? label}
      </span>
      <span style={{ color: 'var(--z-color-fg-muted)', flex: 'none' }}>{code ? label : '📋'}</span>
    </button>
  );
}
