'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Pagination,
  Popconfirm,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tag,
} from '@zui/react';
import { useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

/** 订单行（数据 props 化） */
export interface OrderRow {
  key: string;
  /** 订单号 */
  orderNo: string;
  /** 商品名称 */
  product: string;
  /** 买家 */
  buyer: string;
  /** 金额（元） */
  amount: number;
  status: OrderStatus;
  /** 下单时间文案 */
  createdAt: string;
}

export interface OrderStatusOption {
  value: string;
  label: string;
}

export interface OrderListBlockProps {
  title?: React.ReactNode;
  orders: OrderRow[];
  /** 状态筛选（受控；'all' 表示全部） */
  statusFilter?: string;
  defaultStatusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  /** 筛选下拉选项 */
  statusOptions?: OrderStatusOption[];
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  /** 取消订单（Popconfirm 确认后触发） */
  onCancelOrder?: (order: OrderRow) => void;
  cancelConfirmTitle?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    toolbar?: string;
    table?: string;
    footer?: string;
  };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'shipped', label: '已发货' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

export const DEMO_ORDERS: OrderRow[] = [
  { key: 'o-1001', orderNo: 'SO-2025-1001', product: 'ZUI 年度会员', buyer: '林小满', amount: 1299, status: 'paid', createdAt: '2025-11-01 10:24' },
  { key: 'o-1002', orderNo: 'SO-2025-1002', product: '设计_tokens 套装', buyer: '陈默', amount: 199, status: 'pending', createdAt: '2025-11-02 14:05' },
  { key: 'o-1003', orderNo: 'SO-2025-1003', product: '图标授权包', buyer: '赵一鸣', amount: 499, status: 'shipped', createdAt: '2025-11-03 09:41' },
  { key: 'o-1004', orderNo: 'SO-2025-1004', product: '主题定制服务', buyer: '王雨晴', amount: 4999, status: 'completed', createdAt: '2025-11-04 16:18' },
  { key: 'o-1005', orderNo: 'SO-2025-1005', product: 'ZUI 年度会员', buyer: '孙晓', amount: 1299, status: 'cancelled', createdAt: '2025-11-05 11:52' },
  { key: 'o-1006', orderNo: 'SO-2025-1006', product: '私有部署授权', buyer: '周航', amount: 9999, status: 'paid', createdAt: '2025-11-06 08:30' },
];

/* --------------------------------- 工具 ---------------------------------- */

const STATUS_TAG_COLOR: Record<OrderStatus, 'warning' | 'primary' | 'neutral' | 'success' | 'error'> = {
  pending: 'warning',
  paid: 'primary',
  shipped: 'neutral',
  completed: 'success',
  cancelled: 'error',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

/** 可取消的状态：待支付 / 已支付 */
function isCancellable(status: OrderStatus): boolean {
  return status === 'pending' || status === 'paid';
}

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ---------------------------------- 区块 ---------------------------------- */

/** 订单列表区块：Table + Pagination + Select 状态筛选 + Tag 状态 + Popconfirm 取消 */
export function OrderListBlock({
  title = '订单列表',
  orders,
  statusFilter: statusFilterProp,
  defaultStatusFilter = 'all',
  onStatusFilterChange,
  statusOptions = DEMO_ORDER_STATUS_OPTIONS,
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  pageSize = 5,
  onCancelOrder,
  cancelConfirmTitle = '确认取消该订单吗？',
  className,
  style,
  classNames,
}: OrderListBlockProps) {
  // useControllableState 在受控/非受控下都会回调 onChange，无需显式转发
  const [statusFilter, setStatusFilter] = useControllableState<string>({
    value: statusFilterProp,
    defaultValue: defaultStatusFilter,
    onChange: onStatusFilterChange,
  });
  const [page, setPage] = useControllableState<number>({
    value: pageProp,
    defaultValue: defaultPage,
    onChange: onPageChange,
  });

  const filtered = React.useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter]
  );
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const rows = filtered.slice((currentPage - 1) * safePageSize, currentPage * safePageSize);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const headerCellStyle: React.CSSProperties = { whiteSpace: 'nowrap' };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-4)',
        maxWidth: 960,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      <Card>
        {/* 工具栏 */}
        <div
          className={classNames?.toolbar}
          data-part="toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--z-space-4)',
            flexWrap: 'wrap',
            marginBottom: 'var(--z-space-4)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--z-text-lg)',
              fontWeight: 'var(--z-weight-semibold)',
              color: 'var(--z-color-fg)',
            }}
          >
            {title}
          </h2>
          <span style={{ display: 'inline-block', width: 150 }}>
            <Select
              aria-label="订单状态筛选"
              options={statusOptions}
              value={statusFilter}
              onChange={handleStatusChange}
            />
          </span>
        </div>

        {/* 表格 */}
        <div className={classNames?.table} data-part="table" style={{ overflowX: 'auto' }}>
          <Table striped>
            <TableHead>
              <TableRow>
                <TableHeaderCell style={headerCellStyle}>订单号</TableHeaderCell>
                <TableHeaderCell style={headerCellStyle}>商品</TableHeaderCell>
                <TableHeaderCell style={headerCellStyle}>买家</TableHeaderCell>
                <TableHeaderCell align="right" style={headerCellStyle}>金额</TableHeaderCell>
                <TableHeaderCell style={headerCellStyle}>状态</TableHeaderCell>
                <TableHeaderCell style={headerCellStyle}>下单时间</TableHeaderCell>
                <TableHeaderCell align="right" style={headerCellStyle}>操作</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <span
                      style={{ color: 'var(--z-color-fg-muted)', fontSize: 'var(--z-text-sm)' }}
                    >
                      暂无符合条件的订单
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((order) => (
                  <TableRow key={order.key}>
                    <TableCell>
                      <span
                        style={{
                          fontFamily: 'var(--z-font-mono)',
                          fontSize: 'var(--z-text-sm)',
                          color: 'var(--z-color-fg)',
                        }}
                      >
                        {order.orderNo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span style={{ color: 'var(--z-color-fg)' }}>{order.product}</span>
                    </TableCell>
                    <TableCell>
                      <span style={{ color: 'var(--z-color-fg-muted)' }}>{order.buyer}</span>
                    </TableCell>
                    <TableCell align="right">
                      <span
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 'var(--z-weight-medium)',
                          color: 'var(--z-color-fg)',
                        }}
                      >
                        {formatAmount(order.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tag color={STATUS_TAG_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Tag>
                    </TableCell>
                    <TableCell>
                      <span style={{ color: 'var(--z-color-fg-muted)', fontSize: 'var(--z-text-sm)' }}>
                        {order.createdAt}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      {isCancellable(order.status) && onCancelOrder != null ? (
                        <Popconfirm
                          title={cancelConfirmTitle}
                          description={`订单 ${order.orderNo} 取消后不可恢复`}
                          onConfirm={() => onCancelOrder(order)}
                        >
                          <Button size="sm" variant="outline">
                            取消订单
                          </Button>
                        </Popconfirm>
                      ) : (
                        <span
                          style={{ color: 'var(--z-color-fg-subtle)', fontSize: 'var(--z-text-sm)' }}
                        >
                          —
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div
          className={classNames?.footer}
          data-part="footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--z-space-3)',
            paddingTop: 'var(--z-space-4)',
          }}
        >
          <span style={{ fontSize: 'var(--z-text-sm)', color: 'var(--z-color-fg-muted)' }}>
            共 {filtered.length} 条订单
          </span>
          <Pagination
            page={currentPage}
            onPageChange={setPage}
            total={filtered.length}
            pageSize={safePageSize}
          />
        </div>
      </Card>
    </div>
  );
}

export default OrderListBlock;
