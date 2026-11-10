'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Statistic,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger,
  Tag,
} from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type DashboardTrendDirection = 'up' | 'down' | 'flat';

export interface DashboardStat {
  key: string;
  label: string;
  value: React.ReactNode;
  /** 数值后缀（如 "笔"、"%"） */
  suffix?: string;
  /** 对比文案，如 "较上周 +12.5%" */
  trend?: string;
  trendDirection?: DashboardTrendDirection;
  /** 卡片底部弱化说明 */
  hint?: string;
}

export interface DashboardChannelRow {
  key: string;
  name: string;
  visits: string;
  /** 占比 0-100 */
  share: number;
}

export interface DashboardActivity {
  key: string;
  time: string;
  event: string;
  operator?: string;
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  statusText: string;
}

export interface DashboardBlockProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 头部右侧操作区插槽 */
  actions?: React.ReactNode;
  stats?: DashboardStat[];
  /** 趋势柱状图数据（0-100 的相对高度） */
  trendData?: { label: string; value: number }[];
  channels?: DashboardChannelRow[];
  activities?: DashboardActivity[];
  onTabChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; stats?: string; chart?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

const DEFAULT_STATS: DashboardStat[] = [
  { key: 'visits', label: '今日访问量', value: '48,210', trend: '较昨日 +12.4%', trendDirection: 'up', hint: '峰值 10:00 - 11:00' },
  { key: 'orders', label: '新增订单', value: '1,286', suffix: '笔', trend: '较昨日 -3.1%', trendDirection: 'down', hint: '待付款 128 笔' },
  { key: 'revenue', label: '销售额', value: '¥ 368,420', trend: '较上周 +8.7%', trendDirection: 'up', hint: '客单价 ¥ 286.5' },
  { key: 'conversion', label: '转化率', value: '6.8', suffix: '%', trend: '较上周 +0.6%', trendDirection: 'up', hint: '行业均值 5.2%' },
];

const DEFAULT_TREND: { label: string; value: number }[] = [
  { label: '周一', value: 42 },
  { label: '周二', value: 56 },
  { label: '周三', value: 48 },
  { label: '周四', value: 72 },
  { label: '周五', value: 65 },
  { label: '周六', value: 88 },
  { label: '周日', value: 76 },
  { label: '周一', value: 58 },
  { label: '周二', value: 64 },
  { label: '周三', value: 80 },
  { label: '周四', value: 71 },
  { label: '周五', value: 92 },
];

const DEFAULT_CHANNELS: DashboardChannelRow[] = [
  { key: 'direct', name: '直接访问', visits: '21,430', share: 44 },
  { key: 'search', name: '搜索引擎', visits: '14,820', share: 31 },
  { key: 'social', name: '社交媒体', visits: '8,260', share: 17 },
  { key: 'email', name: '邮件营销', visits: '3,700', share: 8 },
];

const DEFAULT_ACTIVITIES: DashboardActivity[] = [
  { key: 'a1', time: '09:24', event: '订单 #20240815-0042 支付成功', operator: '系统', status: 'success', statusText: '成功' },
  { key: 'a2', time: '09:12', event: '用户 张晓明 提交了退款申请', operator: '客服 · 李梅', status: 'warning', statusText: '待处理' },
  { key: 'a3', time: '08:57', event: '库存告警：SKU-8891 低于安全库存', operator: '系统', status: 'error', statusText: '告警' },
  { key: 'a4', time: '08:31', event: '营销活动「秋季焕新」已上线', operator: '运营 · 王强', status: 'info', statusText: '已发布' },
  { key: 'a5', time: '08:05', event: '日报数据同步完成', operator: '系统', status: 'neutral', statusText: '完成' },
];

const TREND_TAG_COLOR = {
  up: 'success',
  down: 'error',
  flat: 'neutral',
} as const;

/* --------------------------------- 子部件 --------------------------------- */

function StatCard({ stat }: { stat: DashboardStat }) {
  const direction = stat.trendDirection ?? 'flat';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  return (
    <Card style={{ minWidth: 0 }}>
      {typeof stat.value === 'string' || typeof stat.value === 'number' ? (
        <Statistic title={stat.label} value={stat.value} suffix={stat.suffix} />
      ) : (
        <>
          <div style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>{stat.label}</div>
          <div style={{ margin: 'var(--z-space-2) 0 var(--z-space-3)', fontSize: 'var(--z-text-2xl)', fontWeight: 'var(--z-weight-semibold)', color: 'var(--z-color-fg)', lineHeight: 'var(--z-leading-tight)' }}>
            {stat.value}{stat.suffix != null ? <span style={{ marginLeft: 'var(--z-space-1)', fontSize: 'var(--z-text-md)', fontWeight: 'var(--z-weight-regular)' }}>{stat.suffix}</span> : null}
          </div>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-2)', minHeight: 22 }}>
        {stat.trend != null ? (
          <Tag color={TREND_TAG_COLOR[direction]}>
            <span aria-hidden="true">{arrow}</span> {stat.trend}
          </Tag>
        ) : null}
        {stat.hint != null ? (
          <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-subtle)' }}>{stat.hint}</span>
        ) : null}
      </div>
    </Card>
  );
}

function ShareBar({ share, color = 'var(--z-color-primary)' }: { share: number; color?: string }) {
  const percentage = Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--z-space-2)', minWidth: 120 }}>
      <div
        role="progressbar"
        aria-label="流量占比"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: 1,
          height: 6,
          borderRadius: 'var(--z-radius-full)',
          background: 'var(--z-color-bg-subtle)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${percentage}%`, height: '100%', borderRadius: 'var(--z-radius-full)', background: color }} />
      </div>
      <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {percentage}%
      </span>
    </div>
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

/** 仪表盘区块：统计卡 + Tabs 趋势图 + 渠道表 + 最近动态表 */
export function DashboardBlock({
  title = '仪表盘',
  subtitle = '数据更新于今天 09:30',
  actions,
  stats = DEFAULT_STATS,
  trendData = DEFAULT_TREND,
  channels = DEFAULT_CHANNELS,
  activities = DEFAULT_ACTIVITIES,
  onTabChange,
  className,
  style,
  classNames,
}: DashboardBlockProps) {
  const maxTrend = Math.max(...trendData.map((d) => Number.isFinite(d.value) ? Math.max(0, d.value) : 0), 1);

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        padding: 'clamp(var(--z-space-3), 3vw, var(--z-space-6))',
        background: 'var(--z-color-bg-muted)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-5)',
        ...style,
      }}
    >
      {/* 页头 */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--z-space-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--z-text-xl)', fontWeight: 'var(--z-weight-semibold)', color: 'var(--z-color-fg)' }}>
            {title}
          </h1>
          <p style={{ margin: 'var(--z-space-1) 0 0', fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--z-space-3)' }}>
          {actions ?? (
            <>
              <Button variant="outline" iconStart={<span aria-hidden="true">⤓</span>}>
                导出数据
              </Button>
              <Button iconStart={<span aria-hidden="true">＋</span>}>新建报告</Button>
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
          <StatCard key={stat.key} stat={stat} />
        ))}
      </section>

      {/* 趋势 Tabs */}
      <Tabs defaultValue="overview" onValueChange={onTabChange}>
        <TabsList style={{ marginBottom: 'var(--z-space-4)' }}>
          <TabsTrigger value="overview">流量概览</TabsTrigger>
          <TabsTrigger value="channels">渠道分析</TabsTrigger>
          <TabsTrigger value="funnel">转化漏斗</TabsTrigger>
        </TabsList>

        <TabsPanel value="overview">
          <div
            className={classNames?.chart}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 'var(--z-space-4)' }}
          >
            <Card title="访问量趋势" extra={<Tag color="primary">近 12 日</Tag>}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 'var(--z-space-3)',
                  height: 220,
                  paddingTop: 'var(--z-space-2)',
                }}
              >
                {trendData.map((d, i) => (
                  <div key={`${d.label}-${i}`} style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', alignItems: 'end', justifyItems: 'center', gap: 'var(--z-space-2)', height: '100%' }}>
                    <div
                      title={`${d.label}: ${d.value}`}
                      style={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${Number.isFinite(d.value) ? Math.round((Math.max(0, d.value) / maxTrend) * 100) : 0}%`,
                        borderRadius: 'var(--z-radius-sm) var(--z-radius-sm) 0 0',
                        background: i === trendData.length - 1 ? 'var(--z-color-primary)' : 'var(--z-color-primary-subtle)',
                      }}
                    />
                    <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-subtle)' }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="流量来源">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--z-space-5)' }}>
                {channels.map((row) => (
                  <li key={row.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--z-space-2)', fontSize: 'var(--z-text-sm)' }}>
                      <span style={{ color: 'var(--z-color-fg)' }}>{row.name}</span>
                      <span style={{ color: 'var(--z-color-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{row.visits}</span>
                    </div>
                    <ShareBar share={row.share} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabsPanel>

        <TabsPanel value="channels">
          <Card title="渠道明细">
            <div tabIndex={0} role="region" aria-label="可横向滚动的数据表格" style={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>渠道</TableHeaderCell>
                  <TableHeaderCell align="right">访问量</TableHeaderCell>
                  <TableHeaderCell>占比</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {channels.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="right">{row.visits}</TableCell>
                    <TableCell>
                      <ShareBar share={row.share} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </Card>
        </TabsPanel>

        <TabsPanel value="funnel">
          <Card title="转化漏斗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-3)', alignItems: 'center', padding: 'var(--z-space-4) 0' }}>
              {[
                { label: '访问', value: '48,210', width: 100 },
                { label: '加购', value: '12,480', width: 72 },
                { label: '下单', value: '4,210', width: 48 },
                { label: '支付', value: '3,286', width: 32 },
              ].map((step) => (
                <div key={step.label} style={{ width: `${step.width}%`, minWidth: 160 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--z-space-3) var(--z-space-4)',
                      borderRadius: 'var(--z-radius-md)',
                      background: 'var(--z-color-primary-subtle)',
                      color: 'var(--z-color-primary-subtle-fg)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--z-text-sm)', fontWeight: 'var(--z-weight-medium)' }}>{step.label}</span>
                    <span style={{ fontSize: 'var(--z-text-sm)', fontVariantNumeric: 'tabular-nums' }}>{step.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsPanel>
      </Tabs>

      {/* 最近动态 */}
      <Card title="最近动态" extra={<Button variant="ghost" size="sm">查看全部</Button>}>
        <div tabIndex={0} role="region" aria-label="可横向滚动的数据表格" style={{ overflowX: 'auto' }}><Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell style={{ width: 80 }}>时间</TableHeaderCell>
              <TableHeaderCell>事件</TableHeaderCell>
              <TableHeaderCell style={{ width: 140 }}>操作人</TableHeaderCell>
              <TableHeaderCell style={{ width: 100 }}>状态</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activities.map((row) => (
              <TableRow key={row.key}>
                <TableCell style={{ color: 'var(--z-color-fg-muted)', fontVariantNumeric: 'tabular-nums' }}>{row.time}</TableCell>
                <TableCell>{row.event}</TableCell>
                <TableCell style={{ color: 'var(--z-color-fg-muted)' }}>{row.operator ?? '—'}</TableCell>
                <TableCell>
                  <Tag color={row.status === 'info' ? 'primary' : row.status}>{row.statusText}</Tag>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      </Card>
    </div>
  );
}

export default DashboardBlock;
