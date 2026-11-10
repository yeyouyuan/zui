'use client';

import * as React from 'react';
import { Avatar, Button, Card, Skeleton, Timeline } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type TimelineFeedEventColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface TimelineFeedEntry {
  key: string;
  /** 时间文案，如 "09:24" 或 "今天 09:24" */
  time: string;
  author: string;
  /** 头像图片地址；不传则按姓名首字渲染 */
  avatarSrc?: string;
  title: React.ReactNode;
  content?: React.ReactNode;
  /** 事件类型标记（Tag 文案 + 时间线颜色） */
  type?: string;
  color?: TimelineFeedEventColor;
}

export interface TimelineFeedBlockProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 头部右侧操作区插槽 */
  actions?: React.ReactNode;
  entries?: TimelineFeedEntry[];
  /** 加载中：Skeleton 占位 */
  loading?: boolean;
  /** 是否还有更多（false 时隐藏加载按钮） */
  hasMore?: boolean;
  /** 加载更多回调（按钮点击触发） */
  onLoadMore?: () => void;
  /** 加载更多按钮文案 */
  loadMoreText?: string;
  /** 空状态文案 */
  emptyText?: string;
  /** 单条点击（可选交互回调） */
  onEntryClick?: (entry: TimelineFeedEntry) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; header?: string; timeline?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_FEED_ENTRIES: TimelineFeedEntry[] = [
  {
    key: 'f1',
    time: '今天 09:24',
    author: '李梅',
    title: '发布了周报《第 45 周产品迭代汇总》',
    content: '本周完成 12 项需求交付，含数据大屏 2.0 与移动端适配优化。',
    type: '周报',
    color: 'primary',
  },
  {
    key: 'f2',
    time: '今天 08:57',
    author: '王强',
    title: '审批通过了「秋季焕新」营销预算',
    content: '预算总额 ¥ 280,000，分三期执行。',
    type: '审批',
    color: 'success',
  },
  {
    key: 'f3',
    time: '昨天 18:40',
    author: '张晓明',
    title: '提交了退款工单 #20261105-0891',
    content: '订单 TS-9912 支付异常，等待客服跟进。',
    type: '工单',
    color: 'warning',
  },
  {
    key: 'f4',
    time: '昨天 16:02',
    author: '系统',
    title: '库存告警：SKU-8891 低于安全库存',
    content: '当前库存 8 件，安全库存 50 件，请及时补货。',
    type: '告警',
    color: 'error',
  },
];

const INTERACTIVE_DESCENDANT_SELECTOR =
  'a[href], area[href], button, input, select, textarea, label, summary, audio[controls], video[controls], iframe, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';

function isInteractiveDescendant(target: EventTarget | null, currentTarget: HTMLElement): boolean {
  if (!(target instanceof Element) || target === currentTarget) return false;
  const interactive = target.closest(INTERACTIVE_DESCENDANT_SELECTOR);
  return (
    interactive != null && interactive !== currentTarget && currentTarget.contains(interactive)
  );
}

/* ---------------------------------- 区块 ---------------------------------- */

/** 时间线信息流区块：Timeline + Avatar + Card 组成的事件流，Skeleton 加载占位 + 加载更多 */
export function TimelineFeedBlock({
  title = '团队动态',
  subtitle = '最新的团队事件与动态',
  actions,
  entries = DEMO_FEED_ENTRIES,
  loading = false,
  hasMore = true,
  onLoadMore,
  loadMoreText = '加载更多',
  emptyText = '暂无动态',
  onEntryClick,
  className,
  style,
  classNames,
}: TimelineFeedBlockProps) {
  const timelineItems = entries.map((entry) => ({
    key: entry.key,
    color: entry.color ?? 'neutral',
    children: (
      <Card
        hoverable
        style={{ cursor: onEntryClick ? 'pointer' : undefined, minWidth: 0 }}
        onClick={
          onEntryClick
            ? (event) => {
                if (isInteractiveDescendant(event.target, event.currentTarget)) return;
                onEntryClick(entry);
              }
            : undefined
        }
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--z-space-3)' }}>
          <Avatar name={entry.author} src={entry.avatarSrc} size="md" />
          <div style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--z-space-2)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 'var(--z-weight-medium)', color: 'var(--z-color-fg)' }}>
                {entry.author}
              </span>
              <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}>
                {entry.time}
              </span>
              {entry.type != null ? (
                <span
                  style={{
                    fontSize: 'var(--z-text-xs)',
                    padding: '0 var(--z-space-2)',
                    borderRadius: 'var(--z-radius-full)',
                    border: '1px solid var(--z-color-border-subtle)',
                    color: 'var(--z-color-fg-muted)',
                  }}
                >
                  {entry.type}
                </span>
              ) : null}
              {onEntryClick ? (
                <button
                  type="button"
                  aria-label={
                    typeof entry.title === 'string'
                      ? `查看 ${entry.author}：${entry.title}`
                      : `查看 ${entry.author} 的动态`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onEntryClick(entry);
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px var(--z-space-2)',
                    border: '1px solid var(--z-color-border-subtle)',
                    borderRadius: 'var(--z-radius-sm)',
                    background: 'transparent',
                    color: 'var(--z-color-fg-muted)',
                    font: 'inherit',
                    fontSize: 'var(--z-text-xs)',
                    cursor: 'pointer',
                  }}
                >
                  查看
                </button>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 'var(--z-space-1)',
                color: 'var(--z-color-fg)',
                fontSize: 'var(--z-text-sm)',
                fontWeight: 'var(--z-weight-medium)',
              }}
            >
              {entry.title}
            </div>
            {entry.content != null ? (
              <div
                style={{
                  marginTop: 'var(--z-space-2)',
                  color: 'var(--z-color-fg-muted)',
                  fontSize: 'var(--z-text-sm)',
                  lineHeight: 'var(--z-leading-relaxed)',
                }}
              >
                {entry.content}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    ),
  }));

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
      <header
        data-part="header"
        className={classNames?.header}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
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
              color: 'var(--z-color-fg)',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 'var(--z-space-1) 0 0',
              fontSize: 'var(--z-text-sm)',
              color: 'var(--z-color-fg-muted)',
            }}
          >
            {subtitle}
          </p>
        </div>
        {actions != null ? (
          <div style={{ display: 'flex', gap: 'var(--z-space-3)' }}>{actions}</div>
        ) : null}
      </header>

      {/* 信息流主体：时间并入卡片元信息，避免窄屏独立时间列挤压内容。 */}
      <div>
        {loading ? (
          /* Skeleton 加载占位 */
          <div
            data-part="loading"
            aria-busy="true"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-5)' }}
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--z-space-3)' }}
              >
                <Skeleton circle width={32} height={32} />
                <div style={{ flex: 1 }}>
                  <Skeleton lines={2} />
                </div>
              </div>
            ))}
          </div>
        ) : timelineItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--z-color-fg-subtle)',
              padding: 'var(--z-space-8) 0',
            }}
          >
            {emptyText}
          </div>
        ) : (
          <div data-part="feed" className={classNames?.timeline}>
            <Timeline items={timelineItems} />
            {hasMore ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 'var(--z-space-4)',
                }}
              >
                <Button variant="outline" onClick={() => onLoadMore?.()}>
                  {loadMoreText}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineFeedBlock;
