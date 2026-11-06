import { useEffect, useState } from 'react';
import { colorScales, tokens } from '@zui/tokens';

import CodeBlock from '../components/CodeBlock';
import { usePageTitle } from '../components/usePageTitle';

const SCALE_LABELS: Record<string, string> = {
  neutral: 'Neutral 中性色阶',
  brand: 'Brand 品牌色阶',
  danger: 'Danger 危险色阶',
  success: 'Success 成功色阶',
  warning: 'Warning 警告色阶',
  info: 'Info 信息色阶',
};

/** 语义色板分组：语义名 → 说明 */
const SEMANTIC_COLORS: { title: string; items: { name: string; cssVar: string; note: string }[] }[] = [
  {
    title: '背景',
    items: [
      { name: 'bg', cssVar: 'var(--z-color-bg)', note: '页面底色' },
      { name: 'bg-subtle', cssVar: 'var(--z-color-bg-subtle)', note: '次级背景 / 分区' },
      { name: 'bg-muted', cssVar: 'var(--z-color-bg-muted)', note: '弱化填充：标签、代码块' },
      { name: 'bg-elevated', cssVar: 'var(--z-color-bg-elevated)', note: '浮层表面：卡片、弹层' },
      { name: 'bg-inverse', cssVar: 'var(--z-color-bg-inverse)', note: '反色表面' },
    ],
  },
  {
    title: '前景',
    items: [
      { name: 'fg', cssVar: 'var(--z-color-fg)', note: '正文' },
      { name: 'fg-muted', cssVar: 'var(--z-color-fg-muted)', note: '次要文字' },
      { name: 'fg-subtle', cssVar: 'var(--z-color-fg-subtle)', note: '弱化文字：占位符' },
      { name: 'fg-inverse', cssVar: 'var(--z-color-fg-inverse)', note: '反色表面文字' },
      { name: 'fg-on-primary', cssVar: 'var(--z-color-fg-on-primary)', note: '主色上的文字' },
    ],
  },
  {
    title: '边框',
    items: [
      { name: 'border', cssVar: 'var(--z-color-border)', note: '常规描边' },
      { name: 'border-subtle', cssVar: 'var(--z-color-border-subtle)', note: '弱分隔线' },
      { name: 'border-strong', cssVar: 'var(--z-color-border-strong)', note: '强调描边' },
      { name: 'border-focus', cssVar: 'var(--z-color-border-focus)', note: '焦点描边' },
    ],
  },
  {
    title: '主色',
    items: [
      { name: 'primary', cssVar: 'var(--z-color-primary)', note: '主按钮 / 选中态' },
      { name: 'primary-hover', cssVar: 'var(--z-color-primary-hover)', note: '悬停' },
      { name: 'primary-active', cssVar: 'var(--z-color-primary-active)', note: '按下' },
      { name: 'primary-subtle', cssVar: 'var(--z-color-primary-subtle)', note: '弱化主色底' },
      { name: 'primary-subtle-fg', cssVar: 'var(--z-color-primary-subtle-fg)', note: '弱化底上的文字' },
    ],
  },
  {
    title: '状态色',
    items: [
      { name: 'danger', cssVar: 'var(--z-color-danger)', note: '危险' },
      { name: 'success', cssVar: 'var(--z-color-success)', note: '成功' },
      { name: 'warning', cssVar: 'var(--z-color-warning)', note: '警告' },
      { name: 'info', cssVar: 'var(--z-color-info)', note: '信息' },
    ],
  },
];

const RADII: { name: string; cssVar: string }[] = [
  { name: '--z-radius-sm', cssVar: tokens.radius.sm },
  { name: '--z-radius-md', cssVar: tokens.radius.md },
  { name: '--z-radius-lg', cssVar: tokens.radius.lg },
  { name: '--z-radius-xl', cssVar: tokens.radius.xl },
  { name: '--z-radius-full', cssVar: tokens.radius.full },
];

const TYPE_SCALE: { name: string; cssVar: string; note: string }[] = [
  { name: '--z-text-xs', cssVar: tokens.text.xs, note: '12px · 辅助信息' },
  { name: '--z-text-sm', cssVar: tokens.text.sm, note: '14px · 次要正文' },
  { name: '--z-text-md', cssVar: tokens.text.md, note: '16px · 正文（基准）' },
  { name: '--z-text-lg', cssVar: tokens.text.lg, note: '18px · 小标题' },
  { name: '--z-text-xl', cssVar: tokens.text.xl, note: '20px · 标题' },
  { name: '--z-text-2xl', cssVar: tokens.text['2xl'], note: '24px · 页面标题' },
];

const SHADOWS: { name: string; cssVar: string }[] = [
  { name: '--z-shadow-xs', cssVar: tokens.shadow.xs },
  { name: '--z-shadow-sm', cssVar: tokens.shadow.sm },
  { name: '--z-shadow-md', cssVar: tokens.shadow.md },
  { name: '--z-shadow-lg', cssVar: tokens.shadow.lg },
];

const IMPORT_CODE = `import { tokens, colorScales } from '@zui/tokens';

// tokens：语义层 var() 引用，可直接用于 style / CSS-in-JS
<div style={{ background: tokens.color.bg, color: tokens.color.fg }} />

// colorScales：原始色阶 var() 引用，适合画色板 / 调试
colorScales.brand[600]; // 'var(--z-brand-600)'`;

function resolveCssValue(value: string, computed: CSSStyleDeclaration, depth = 0): string {
  if (depth > 5) return value.trim();
  const match = /^var\((--[\w-]+)(?:,\s*(.*))?\)$/.exec(value.trim());
  if (!match) return value.trim();
  const resolved = computed.getPropertyValue(match[1]).trim();
  return resolved ? resolveCssValue(resolved, computed, depth + 1) : (match[2] ?? '').trim();
}

function useResolvedTokenValues(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => {
      const root = document.documentElement;
      const computed = getComputedStyle(root);
      const names = new Set<string>();
      for (const scale of Object.values(colorScales)) {
        for (const cssVar of Object.values(scale)) names.add(cssVar);
      }
      for (const group of SEMANTIC_COLORS) for (const item of group.items) names.add(item.cssVar);
      const next: Record<string, string> = {};
      names.forEach((name) => { next[name] = resolveCssValue(name, computed); });
      setValues(next);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    systemTheme?.addEventListener('change', refresh);
    return () => {
      observer.disconnect();
      systemTheme?.removeEventListener('change', refresh);
    };
  }, []);

  return values;
}

export default function TokensPage(): React.ReactNode {
  usePageTitle('设计令牌');
  const resolvedValues = useResolvedTokenValues();

  return (
    <div className="doc-page">
      <h1 className="doc-h1">设计令牌</h1>
      <p className="doc-lead">
        ZUI 的视觉事实来源是三层令牌：base（原始色阶）→ semantic（语义变量，组件唯一消费入口）→
        dark（暗色映射）。下例色块直接以 CSS 变量渲染，切主题即全部跟随。
      </p>

      <h2 className="doc-h2">原始色阶（base）</h2>
      <p className="doc-p">
        色块背景取自 <code className="doc-code-inline">colorScales</code> 中的 var() 引用；
        下方值由浏览器实时解析，切换亮暗主题时会同步更新。
      </p>
      {Object.entries(colorScales).map(([scaleName, scale]) => (
        <section className="doc-swatch-section" key={scaleName}>
          <h3 className="doc-swatch-scale-name">{SCALE_LABELS[scaleName] ?? scaleName}</h3>
          <ul className="doc-swatch-grid">
            {Object.entries(scale).map(([step, cssVar]) => (
              <li className="doc-swatch" key={step}>
                <div className="doc-swatch-color" style={{ background: cssVar }} />
                <div className="doc-swatch-meta">
                  <span className="doc-swatch-name">
                    --z-{scaleName}-{step}
                  </span>
                  <span className="doc-swatch-hex">{resolvedValues[cssVar] || '解析中…'}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2 className="doc-h2">语义色（semantic）</h2>
      {SEMANTIC_COLORS.map((group) => (
        <section className="doc-swatch-section" key={group.title}>
          <h3 className="doc-swatch-scale-name">{group.title}</h3>
          <ul className="doc-swatch-grid">
            {group.items.map((item) => (
              <li className="doc-swatch" key={item.name}>
                <div className="doc-swatch-color" style={{ background: item.cssVar }} />
                <div className="doc-swatch-meta">
                  <span className="doc-swatch-name">--z-color-{item.name}</span>
                  <span className="doc-swatch-hex">{resolvedValues[item.cssVar] || item.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2 className="doc-h2">间距</h2>
      <p className="doc-p">
        <code className="doc-code-inline">--z-space-1..12</code>，4px 步进（1=4px … 12=48px）。
      </p>
      <ul className="doc-ruler">
        {Object.entries(tokens.space).map(([step, cssVar]) => (
          <li className="doc-ruler-row" key={step}>
            <span className="doc-ruler-label">--z-space-{step}</span>
            <span className="doc-ruler-bar" style={{ width: cssVar }} />
          </li>
        ))}
      </ul>

      <h2 className="doc-h2">圆角</h2>
      <p className="doc-p">
        <code className="doc-code-inline">--z-radius</code> 是唯一来源（0.625rem），其余全部派生。
      </p>
      <ul className="doc-radius-grid">
        {RADII.map((item) => (
          <li className="doc-radius-box" key={item.name} style={{ borderRadius: item.cssVar }}>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>

      <h2 className="doc-h2">字阶</h2>
      <ul className="doc-type-scale">
        {TYPE_SCALE.map((item) => (
          <li className="doc-type-row" key={item.name}>
            <span className="doc-type-label">{item.name}</span>
            <span style={{ fontSize: item.cssVar, lineHeight: 'var(--z-leading-tight)' }}>
              令牌驱动的排版 Aa 永 0
            </span>
            <span className="doc-type-label">{item.note}</span>
          </li>
        ))}
      </ul>

      <h2 className="doc-h2">阴影</h2>
      <ul className="doc-shadow-grid">
        {SHADOWS.map((item) => (
          <li
            className="doc-shadow-card"
            key={item.name}
            style={{ boxShadow: item.cssVar }}
          >
            <span>{item.name}</span>
          </li>
        ))}
      </ul>

      <h2 className="doc-h2">在代码中使用</h2>
      <CodeBlock code={IMPORT_CODE} />
    </div>
  );
}
