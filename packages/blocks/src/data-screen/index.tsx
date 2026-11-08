'use client';

import * as React from 'react';
import { Progress, Segmented, Statistic, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type DataScreenRange = 'today' | 'week' | 'month';

export interface DataScreenStat {
  key: string;
  label: string;
  value: number | string;
  suffix?: string;
  /** 环比文案，如 "较昨日 +12.4%" */
  trend?: string;
}

export interface DataScreenBar {
  label: string;
  /** 相对高度 0-100 */
  value: number;
  /** 可选指标数值文本（悬浮提示） */
  tooltip?: string;
}

export interface DataScreenGauge {
  key: string;
  label: string;
  /** 0-100 */
  percent: number;
  status?: 'normal' | 'active' | 'success' | 'error';
  /** 右侧补充说明，如 "8C16G" */
  hint?: string;
}

export interface DataScreenBlockProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 头部右侧操作区插槽 */
  actions?: React.ReactNode;
  stats?: DataScreenStat[];
  /** CSS 柱状图数据（value 0-100 相对高度） */
  bars?: DataScreenBar[];
  barChartTitle?: React.ReactNode;
  gauges?: DataScreenGauge[];
  gaugeChartTitle?: React.ReactNode;
  /** 时间维度（受控）；不传走非受控 */
  range?: DataScreenRange;
  defaultRange?: DataScreenRange;
  onRangeChange?: (range: DataScreenRange) => void;
  /** 刷新回调（点刷新按钮时触发） */
  onRefresh?: () => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; header?: string; stats?: string; charts?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_SCREEN_STATS: DataScreenStat[] = [
  { key: 'uv', label: '实时在线', value: '8,642', suffix: '人', trend: '较昨日 +6.2%' },
  { key: 'pv', label: '今日访问', value: '128,406', suffix: '次', trend: '较昨日 +11.8%' },
  { key: 'order', label: '今日订单', value: '3,286', suffix: '笔', trend: '较昨日 -1.5%' },
  { key: 'gmv', label: '今日成交额', value: '¥ 1,286,400', trend: '较昨日 +9.3%' },
];

export const DEMO_SCREEN_BARS: DataScreenBar[] = [
  { label: '00:00', value: 18, tooltip: '2,140' },
  { label: '03:00', value: 10, tooltip: '1,208' },
  { label: '06:00', value: 22, tooltip: '2,864' },
  { label: '09:00', value: 58, tooltip: '7,420' },
  { label: '12:00', value: 76, tooltip: '9,815' },
  { label: '15:00', value: 64, tooltip: '8,237' },
  { label: '18:00', value: 88, tooltip: '11,306' },
  { label: '21:00', value: 96, tooltip: '12,840' },
];

export const DEMO_SCREEN_GAUGES: DataScreenGauge[] = [
  { key: 'cpu', label: 'CPU 使用率', percent: 62, status: 'active', hint: '8C16G' },
  { key: 'memory', label: '内存占用', percent: 78, status: 'active', hint: '12.4/16G' },
  { key: 'disk', label: '磁盘使用', percent: 45, status: 'success', hint: '450G/1T' },
  { key: 'api', label: 'API 成功率', percent: 99, status: 'success', hint: '近 1h' },
];

const RANGE_OPTIONS: { value: DataScreenRange; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '近 7 天' },
  { value: 'month', label: '近 30 天' },
];

/* ---------------------------------- 区块 ---------------------------------- */

/**
 * 数据大屏区块：深色底自适应，Statistic 统计卡行 + CSS 柱状图 + Progress 资源指标，
 * 支持时间维度切换（受控/非受控）与刷新回调。
 */
export function DataScreenBlock({
  title = '实时数据大屏',
  subtitle = '实时数据概览',
  actions,
  stats = DEMO_SCREEN_STATS,
  bars = DEMO_SCREEN_BARS,
  barChartTitle = '分时访问量',
  gauges = DEMO_SCREEN_GAUGES,
  gaugeChartTitle = '资源监控',
  range,
  defaultRange = 'today',
  onRangeChange,
  onRefresh,
  className,
  style,
  classNames,
}: DataScreenBlockProps) {
  const [currentRange, setCurrentRange] = useControllableState<DataScreenRange>({
    value: range,
    defaultValue: defaultRange,
    onChange: onRangeChange,
  });

  const maxBar = Math.max(
    ...bars.map((bar) => (Number.isFinite(bar.value) ? Math.max(0, bar.value) : 0)),
    1
  );

  /* 深色底自适应：直接落在中性色阶 primitive 上，不随页面主题翻转 */
  const dark = {
    bg: 'var(--z-neutral-950)',
    panel: 'var(--z-neutral-900)',
    border: 'var(--z-neutral-800)',
    fg: 'var(--z-neutral-100)',
    fgMuted: 'var(--z-neutral-400)',
    fgSubtle: 'var(--z-neutral-500)',
  };
  const darkTokens = {
    '--z-color-fg': dark.fg,
    '--z-color-fg-muted': dark.fgMuted,
    '--z-color-fg-subtle': dark.fgSubtle,
    '--z-color-bg': dark.bg,
    '--z-color-bg-muted': dark.panel,
    '--z-color-bg-subtle': dark.panel,
    '--z-color-border': dark.border,
    '--z-color-border-subtle': dark.border,
  } as React.CSSProperties;

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        ...darkTokens,
        padding: 'clamp(var(--z-space-4), 3vw, var(--z-space-8))',
        background: dark.bg,
        color: dark.fg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-5)',
        ...style,
      }}
    >
      {/* 页头：标题 + 时间维度 + 刷新 */}
      <header
        data-part="header"
        className={classNames?.header}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--z-space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--z-text-xl)',
              fontWeight: 'var(--z-weight-semibold)',
              color: dark.fg,
              letterSpacing: '0.04em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 'var(--z-space-1) 0 0',
              fontSize: 'var(--z-text-sm)',
              color: dark.fgMuted,
            }}
          >
            {subtitle}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--z-space-3)',
            flexWrap: 'wrap',
          }}
        >
          {actions ?? (
            <>
              <Segmented
                options={RANGE_OPTIONS}
                value={currentRange}
                onChange={(value) => setCurrentRange(value as DataScreenRange)}
                aria-label="时间维度"
              />
              <button
                type="button"
                onClick={() => onRefresh?.()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--z-space-2)',
                  padding: 'var(--z-space-2) var(--z-space-4)',
                  borderRadius: 'var(--z-radius-md)',
                  border: `1px solid ${dark.border}`,
                  background: dark.panel,
                  color: dark.fg,
                  fontSize: 'var(--z-text-sm)',
                  cursor: 'pointer',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                刷新
              </button>
            </>
          )}
        </div>
      </header>

      {/* Statistic 统计卡行 */}
      <section
        aria-label="核心指标"
        className={classNames?.stats}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: 'var(--z-space-4)',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            style={{
              background: dark.panel,
              border: `1px solid ${dark.border}`,
              borderRadius: 'var(--z-radius-lg)',
              padding: 'var(--z-space-5)',
              minWidth: 0,
            }}
          >
            <Statistic
              title={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              valueStyle={{ color: 'var(--z-brand-400)', fontSize: 'var(--z-text-2xl)' }}
            />
            {stat.trend != null ? (
              <div
                style={{
                  marginTop: 'var(--z-space-2)',
                  fontSize: 'var(--z-text-xs)',
                  color: dark.fgSubtle,
                }}
              >
                {stat.trend}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {/* 图表区：CSS 柱状图 + Progress 指标 */}
      <div
        className={classNames?.charts}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
          gap: 'var(--z-space-4)',
        }}
      >
        {/* CSS 柱状图 */}
        <section
          aria-label={typeof barChartTitle === 'string' ? barChartTitle : '柱状图'}
          style={{
            background: dark.panel,
            border: `1px solid ${dark.border}`,
            borderRadius: 'var(--z-radius-lg)',
            padding: 'var(--z-space-5)',
          }}
        >
          <h2
            style={{
              margin: '0 0 var(--z-space-4)',
              fontSize: 'var(--z-text-md)',
              fontWeight: 'var(--z-weight-medium)',
              color: dark.fg,
            }}
          >
            {barChartTitle}
          </h2>
          <div
            role="img"
            aria-label={typeof barChartTitle === 'string' ? `${barChartTitle}柱状图` : '柱状图'}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 'var(--z-space-3)',
              height: 200,
            }}
          >
            {bars.map((bar, index) => {
              const heightPercent = Number.isFinite(bar.value)
                ? Math.round((Math.max(0, bar.value) / maxBar) * 100)
                : 0;
              return (
                <div
                  key={`${bar.label}-${index}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateRows: 'minmax(0, 1fr) auto',
                    alignItems: 'end',
                    justifyItems: 'center',
                    gap: 'var(--z-space-2)',
                    height: '100%',
                  }}
                >
                  <div
                    title={bar.tooltip ?? `${bar.label}: ${bar.value}`}
                    style={{
                      width: '100%',
                      maxWidth: 32,
                      height: `${heightPercent}%`,
                      borderRadius: 'var(--z-radius-sm) var(--z-radius-sm) 0 0',
                      background: `linear-gradient(to top, var(--z-brand-600), var(--z-brand-400))`,
                    }}
                  />
                  <span
                    style={{
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'var(--z-text-xs)',
                      color: dark.fgSubtle,
                    }}
                  >
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Progress 资源指标 */}
        <section
          aria-label={typeof gaugeChartTitle === 'string' ? gaugeChartTitle : '资源监控'}
          style={{
            background: dark.panel,
            border: `1px solid ${dark.border}`,
            borderRadius: 'var(--z-radius-lg)',
            padding: 'var(--z-space-5)',
          }}
        >
          <h2
            style={{
              margin: '0 0 var(--z-space-4)',
              fontSize: 'var(--z-text-md)',
              fontWeight: 'var(--z-weight-medium)',
              color: dark.fg,
            }}
          >
            {gaugeChartTitle}
          </h2>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--z-space-5)',
            }}
          >
            {gauges.map((gauge) => (
              <li key={gauge.key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--z-space-2)',
                    fontSize: 'var(--z-text-sm)',
                  }}
                >
                  <span style={{ color: dark.fg }}>{gauge.label}</span>
                  {gauge.hint != null ? (
                    <span style={{ color: dark.fgSubtle }}>{gauge.hint}</span>
                  ) : null}
                </div>
                <Progress percent={gauge.percent} status={gauge.status} aria-label={gauge.label} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default DataScreenBlock;
