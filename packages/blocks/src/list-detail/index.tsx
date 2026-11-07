'use client';

import * as React from 'react';
import { Card, Col, Descriptions, Empty, List, Row, Tag, useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export interface ListDetailItem {
  key: string;
  title: string;
  description?: React.ReactNode;
  /** 状态标记（Tag 文案 + 颜色） */
  status?: { text: string; color: 'primary' | 'success' | 'warning' | 'error' | 'neutral' };
  /** 右侧附加内容（如时间） */
  extra?: React.ReactNode;
  /** 右侧详情键值对 */
  detail: { label: React.ReactNode; value: React.ReactNode }[];
}

export interface ListDetailBlockProps {
  title?: React.ReactNode;
  /** 左列表标题 */
  listTitle?: React.ReactNode;
  /** 右详情标题；默认取选中项 title */
  detailTitle?: React.ReactNode;
  items?: ListDetailItem[];
  /** 当前选中项（受控）；不传走非受控 */
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectedKeyChange?: (key: string) => void;
  /** 详情 Descriptions 每行列数，默认 2 */
  detailColumn?: number;
  /** 选中项变化回调 */
  onSelect?: (item: ListDetailItem) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string; list?: string; detail?: string };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_DETAIL_ITEMS: ListDetailItem[] = [
  {
    key: 't1',
    title: '官网改版项目',
    description: '品牌升级配套的官网视觉与信息架构改版。',
    status: { text: '进行中', color: 'primary' },
    extra: '11-05 更新',
    detail: [
      { label: '负责人', value: '李梅' },
      { label: '优先级', value: '高' },
      { label: '开始时间', value: '2026-10-12' },
      { label: '计划完成', value: '2026-11-30' },
      { label: '关联迭代', value: 'R45' },
      { label: '所属部门', value: '产品设计部' },
    ],
  },
  {
    key: 't2',
    title: '移动端数据大屏',
    description: '大屏区块的移动端自适应与手势交互方案。',
    status: { text: '待评审', color: 'warning' },
    extra: '11-03 更新',
    detail: [
      { label: '负责人', value: '张晓明' },
      { label: '优先级', value: '中' },
      { label: '开始时间', value: '2026-10-20' },
      { label: '计划完成', value: '2026-12-10' },
      { label: '关联迭代', value: 'R46' },
      { label: '所属部门', value: '前端架构组' },
    ],
  },
  {
    key: 't3',
    title: '订单中台性能优化',
    description: '订单列表导出链路性能治理，目标 P95 < 800ms。',
    status: { text: '已完成', color: 'success' },
    extra: '10-28 更新',
    detail: [
      { label: '负责人', value: '王强' },
      { label: '优先级', value: '高' },
      { label: '开始时间', value: '2026-09-01' },
      { label: '实际完成', value: '2026-10-25' },
      { label: '关联迭代', value: 'R43' },
      { label: '所属部门', value: '交易平台组' },
    ],
  },
];

/* ---------------------------------- 区块 ---------------------------------- */

/** 列表详情区块：左列表（List）右详情（Descriptions + Card）双栏 Row/Col 布局 */
export function ListDetailBlock({
  title = '项目列表',
  listTitle = '项目',
  detailTitle,
  items = DEMO_DETAIL_ITEMS,
  selectedKey,
  defaultSelectedKey,
  onSelectedKeyChange,
  detailColumn = 2,
  onSelect,
  className,
  style,
  classNames,
}: ListDetailBlockProps) {
  const [currentKey, setCurrentKey] = useControllableState<string>({
    value: selectedKey,
    defaultValue: defaultSelectedKey ?? items[0]?.key ?? '',
    onChange: (key) => {
      onSelectedKeyChange?.(key);
      const item = items.find((entry) => entry.key === key);
      if (item) onSelect?.(item);
    },
  });

  const activeItem = items.find((item) => item.key === currentKey) ?? null;

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
        gap: 'var(--z-space-4)',
        ...style,
      }}
    >
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

      {/* 左列表 + 右详情 双栏 */}
      <Row gutter={[16, 16]}>
        <Col
          span={24}
          flex="1 1 300px"
          style={{ minWidth: 0 }}
          className="zui-list-detail-col-list"
        >
          <Card
            className={classNames?.list}
            title={listTitle}
            extra={
              <span style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-subtle)' }}>
                共 {items.length} 项
              </span>
            }
          >
            <List
              bordered={false}
              items={items.map((item) => ({
                key: item.key,
                title: (
                  <button
                    type="button"
                    onClick={() => setCurrentKey(item.key)}
                    aria-current={currentKey === item.key ? 'true' : undefined}
                    style={{
                      font: 'inherit',
                      border: 'none',
                      borderRadius: 'var(--z-radius-sm)',
                      background: 'transparent',
                      padding: 'var(--z-space-1) 0',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 'var(--z-space-2)',
                      color:
                        currentKey === item.key ? 'var(--z-color-primary)' : 'var(--z-color-fg)',
                      fontWeight: 'var(--z-weight-medium)',
                      fontSize: 'var(--z-text-sm)',
                    }}
                  >
                    {item.title}
                    {item.status != null ? (
                      <Tag color={item.status.color}>{item.status.text}</Tag>
                    ) : null}
                  </button>
                ),
                description: item.description,
                extra:
                  item.extra != null ? (
                    <span
                      style={{
                        fontSize: 'var(--z-text-xs)',
                        color: 'var(--z-color-fg-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.extra}
                    </span>
                  ) : undefined,
              }))}
            />
          </Card>
        </Col>

        <Col
          span={24}
          flex="2 1 400px"
          style={{ minWidth: 0 }}
          className="zui-list-detail-col-detail"
        >
          <Card className={classNames?.detail} title={detailTitle ?? activeItem?.title ?? '详情'}>
            {activeItem == null ? (
              <Empty description="暂无选中项" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--z-space-4)' }}>
                {activeItem.status != null || activeItem.extra != null ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--z-space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {activeItem.status != null ? (
                      <Tag color={activeItem.status.color}>{activeItem.status.text}</Tag>
                    ) : null}
                    {activeItem.extra != null ? (
                      <span
                        style={{ fontSize: 'var(--z-text-xs)', color: 'var(--z-color-fg-subtle)' }}
                      >
                        {activeItem.extra}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {activeItem.description != null ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--z-text-sm)',
                      color: 'var(--z-color-fg-muted)',
                      lineHeight: 'var(--z-leading-relaxed)',
                    }}
                  >
                    {activeItem.description}
                  </p>
                ) : null}
                <Descriptions title="详细信息" column={detailColumn} bordered size="sm">
                  {activeItem.detail.map((entry, index) => (
                    <Descriptions.Item key={index} label={entry.label}>
                      {entry.value}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ListDetailBlock;
