import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderListBlock, DEMO_ORDERS } from '../src/order-list';

afterEach(cleanup);

describe('order-list block', () => {
  it('renders the order table with status tags and pagination', () => {
    const { container } = render(<OrderListBlock orders={DEMO_ORDERS} />);
    expect(screen.getByText('订单列表')).toBeInTheDocument();
    expect(container.querySelector('.z-table')).toBeInTheDocument();
    expect(screen.getByText('SO-2025-1001')).toBeInTheDocument();
    expect(screen.getByText('SO-2025-1005')).toBeInTheDocument();
    // 状态 Tag（同文案也会出现在未展开的 Select 选项里，取至少一处）
    expect(screen.getAllByText('待支付').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(1);
    // 金额与分页（两条 1299 订单同页）
    expect(screen.getAllByText('¥1,299.00')).toHaveLength(2);
    expect(container.querySelector('.z-pagination')).toBeInTheDocument();
    expect(screen.getByText('共 6 条订单')).toBeInTheDocument();
  });

  it('filters orders by status through the Select and reports the change', async () => {
    const onStatusFilterChange = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = render(
      <OrderListBlock orders={DEMO_ORDERS} onStatusFilterChange={onStatusFilterChange} />
    );
    await user.click(screen.getByRole('button', { name: /^订单状态筛选 / }));
    await user.click(screen.getByRole('option', { name: '待支付' }));
    expect(onStatusFilterChange).toHaveBeenCalledWith('pending');

    // 受控回填筛选值后仅剩待支付订单
    rerender(
      <OrderListBlock orders={DEMO_ORDERS} statusFilter="pending" onStatusFilterChange={onStatusFilterChange} />
    );
    expect(screen.getByText('SO-2025-1002')).toBeInTheDocument();
    expect(screen.queryByText('SO-2025-1001')).not.toBeInTheDocument();
    expect(screen.getByText('共 1 条订单')).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('cancels an order via Popconfirm', async () => {
    const onCancelOrder = vi.fn();
    const user = userEvent.setup();
    render(<OrderListBlock orders={DEMO_ORDERS} onCancelOrder={onCancelOrder} />);
    // 只有可取消状态（待支付/已支付）渲染取消按钮：第一页 5 条中含 2 条
    expect(screen.getAllByRole('button', { name: '取消订单' })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: '取消订单' })[0]);
    expect(screen.getByText('确认取消该订单吗？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确定' }));
    expect(onCancelOrder).toHaveBeenCalledTimes(1);
    expect(onCancelOrder).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'o-1001', orderNo: 'SO-2025-1001' })
    );
  });

  it('paginates the order rows and reports page changes', async () => {
    const onPageChange = vi.fn();
    const first = render(
      <OrderListBlock orders={DEMO_ORDERS} pageSize={5} onPageChange={onPageChange} />
    );
    // 默认第一页 5 条
    expect(screen.getByText('SO-2025-1001')).toBeInTheDocument();
    expect(screen.queryByText('SO-2025-1006')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    first.unmount();

    // 受控翻页后展示第二页
    render(<OrderListBlock orders={DEMO_ORDERS} pageSize={5} page={2} />);
    expect(screen.getByText('SO-2025-1006')).toBeInTheDocument();
    expect(screen.queryByText('SO-2025-1001')).not.toBeInTheDocument();
  });
});
