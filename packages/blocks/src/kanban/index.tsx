'use client';

import * as React from 'react';
import { Card, Tag, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type KanbanPriority = 'high' | 'medium' | 'low';

export interface KanbanTaskCard {
  key: string;
  title: string;
  priority: KanbanPriority;
  assignee?: string;
  /** 额外标签文案 */
  tags?: string[];
  /** 截止日期文案，如 "11-15" */
  dueDate?: string;
}

export interface KanbanColumn {
  key: string;
  title: string;
  cards: KanbanTaskCard[];
}

export interface KanbanBlockProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 头部右侧操作区插槽 */
  actions?: React.ReactNode;
  /** 三列看板数据（列数不限，默认三列演示） */
  columns?: KanbanColumn[];
  /** 当前高亮卡片（受控）；不传走非受控 */
  activeCardKey?: string | null;
  defaultActiveCardKey?: string | null;
  onActiveCardChange?: (key: string | null) => void;
  /** 卡片点击回调（与受控高亮同步触发） */
  onCardClick?: (card: KanbanTaskCard) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; header?: string; board?: string; column?: string; count?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_KANBAN_COLUMNS: KanbanColumn[] = [
  {
    key: 'todo',
    title: '待处理',
    cards: [
      {
        key: 'k1',
        title: '数据大屏移动端适配',
        priority: 'high',
        assignee: '李梅',
        tags: ['前端'],
        dueDate: '11-12',
      },
      {
        key: 'k2',
        title: '订单导出接口性能优化',
        priority: 'medium',
        assignee: '王强',
        tags: ['后端'],
        dueDate: '11-14',
      },
      { key: 'k3', title: '帮助中心文案修订', priority: 'low', assignee: '赵敏', dueDate: '11-20' },
    ],
  },
  {
    key: 'doing',
    title: '进行中',
    cards: [
      {
        key: 'k4',
        title: '看板拖拽交互调研',
        priority: 'high',
        assignee: '张晓明',
        tags: ['前端', '调研'],
        dueDate: '11-11',
      },
      { key: 'k5', title: '权限树批量授权', priority: 'medium', assignee: '刘洋', tags: ['后端'] },
    ],
  },
  {
    key: 'done',
    title: '已完成',
    cards: [
      { key: 'k6', title: '登录页视觉走查', priority: 'medium', assignee: '赵敏' },
      { key: 'k7', title: '组件库 0.2.0 发布', priority: 'high', assignee: '李梅', tags: ['发布'] },
    ],
  },
];

const PRIORITY_META: Record<
  KanbanPriority,
  { label: string; color: 'error' | 'warning' | 'success' }
> = {
  high: { label: '高', color: 'error' },
  medium: { label: '中', color: 'warning' },
  low: { label: '低', color: 'success' },
};

/* ---------------------------------- 区块 ---------------------------------- */

/**
 * 看板区块：三列静态看板（Card + Tag 优先级 + 计数徽标）。
 * 注意：静态展示，不含拖拽能力（未引入拖拽库）；卡片点击仅做高亮选中。
 */
export function KanbanBlock({
  title = '项目看板',
  subtitle = '静态看板视图 · 不支持拖拽',
  actions,
  columns = DEMO_KANBAN_COLUMNS,
  activeCardKey,
  defaultActiveCardKey = null,
  onActiveCardChange,
  onCardClick,
  className,
  style,
  classNames,
}: KanbanBlockProps) {
  const [currentKey, setCurrentKey] = useControllableState<string | null>({
    value: activeCardKey,
    defaultValue: defaultActiveCardKey,
    onChange: onActiveCardChange,
  });

  const handleCardClick = (card: KanbanTaskCard) => {
    const next = currentKey === card.key ? null : card.key;
    setCurrentKey(next);
    onCardClick?.(card);
  };

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

      {/* 三列看板 */}
      <div
        data-part="board"
        className={classNames?.board}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: 'var(--z-space-4)',
          alignItems: 'start',
        }}
      >
        {columns.map((column) => (
          <section
            key={column.key}
            aria-label={
              typeof column.title === 'string'
                ? `${column.title}列，${column.cards.length} 张卡片`
                : undefined
            }
            data-part="column"
            className={classNames?.column}
            style={{
              background: 'var(--z-color-bg-subtle)',
              border: '1px solid var(--z-color-border-subtle)',
              borderRadius: 'var(--z-radius-lg)',
              padding: 'var(--z-space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--z-space-3)',
              minWidth: 0,
            }}
          >
            {/* 列头：标题 + 计数徽标 */}
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--z-space-2)',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--z-text-md)',
                  fontWeight: 'var(--z-weight-semibold)',
                  color: 'var(--z-color-fg)',
                }}
              >
                {column.title}
              </h2>
              <span
                data-part="count"
                className={classNames?.count}
                aria-label={`${column.cards.length} 张卡片`}
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 'var(--z-radius-full)',
                  background: 'var(--z-color-primary-subtle)',
                  color: 'var(--z-color-primary-subtle-fg)',
                  fontSize: 'var(--z-text-xs)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {column.cards.length}
              </span>
            </header>

            {/* 卡片列表 */}
            {column.cards.map((card) => {
              const priority = PRIORITY_META[card.priority] ?? PRIORITY_META.low;
              const active = currentKey === card.key;
              return (
                <Card
                  key={card.key}
                  hoverable
                  data-active={active ? 'true' : 'false'}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  style={{
                    cursor: 'pointer',
                    minWidth: 0,
                    ...(active
                      ? { borderColor: 'var(--z-color-primary)', boxShadow: 'var(--z-shadow-sm)' }
                      : null),
                  }}
                  onClick={() => handleCardClick(card)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleCardClick(card);
                    }
                  }}
                >
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-2)' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--z-space-2)',
                      }}
                    >
                      <Tag color={priority.color}>{priority.label}</Tag>
                      {card.dueDate != null ? (
                        <span
                          style={{
                            fontSize: 'var(--z-text-xs)',
                            color: 'var(--z-color-fg-subtle)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          截止 {card.dueDate}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--z-text-sm)',
                        fontWeight: 'var(--z-weight-medium)',
                        color: 'var(--z-color-fg)',
                      }}
                    >
                      {card.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--z-space-2)',
                        flexWrap: 'wrap',
                      }}
                    >
                      {card.assignee != null ? (
                        <span
                          style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-muted)' }}
                        >
                          {card.assignee}
                        </span>
                      ) : null}
                      {(card.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 'var(--z-text-xs)',
                            padding: '0 var(--z-space-2)',
                            borderRadius: 'var(--z-radius-full)',
                            border: '1px solid var(--z-color-border-subtle)',
                            color: 'var(--z-color-fg-muted)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}

            {column.cards.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--z-space-6) 0',
                  color: 'var(--z-color-fg-subtle)',
                  fontSize: 'var(--z-text-sm)',
                }}
              >
                暂无卡片
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

export default KanbanBlock;
