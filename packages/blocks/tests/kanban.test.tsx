import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KanbanBlock } from '../src/kanban';

afterEach(cleanup);

describe('kanban block', () => {
  it('renders three static columns with count badges and priority tags', () => {
    const { container } = render(<KanbanBlock />);
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    // 计数徽标
    expect(screen.getByLabelText('3 张卡片')).toBeInTheDocument();
    expect(screen.getAllByLabelText('2 张卡片')).toHaveLength(2);
    // 优先级 Tag
    expect(container.querySelectorAll('.z-tag').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('数据大屏移动端适配')).toBeInTheDocument();
  });

  it('activates a card on click and fires callbacks; toggles off on second click', () => {
    const onActiveCardChange = vi.fn();
    const onCardClick = vi.fn();
    render(<KanbanBlock onActiveCardChange={onActiveCardChange} onCardClick={onCardClick} />);
    const card = screen.getByText('看板拖拽交互调研').closest('.z-card');
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute('data-active', 'false');
    fireEvent.click(screen.getByText('看板拖拽交互调研').closest('.z-card')!);
    expect(onActiveCardChange).toHaveBeenCalledWith('k4');
    expect(onCardClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'k4', priority: 'high' }));
    // 再次点击同一卡片取消高亮
    fireEvent.click(screen.getByText('看板拖拽交互调研').closest('.z-card')!);
    expect(onActiveCardChange).toHaveBeenLastCalledWith(null);
  });

  it('supports controlled activeCardKey', () => {
    const onActiveCardChange = vi.fn();
    render(<KanbanBlock activeCardKey="k1" onActiveCardChange={onActiveCardChange} />);
    const activeCard = screen.getByText('数据大屏移动端适配').closest('.z-card');
    expect(activeCard).toHaveAttribute('data-active', 'true');
    const other = screen.getByText('订单导出接口性能优化').closest('.z-card');
    expect(other).toHaveAttribute('data-active', 'false');
    fireEvent.click(other!);
    expect(onActiveCardChange).toHaveBeenCalledWith('k2');
    // 受控：值不内部翻转
    expect(screen.getByText('数据大屏移动端适配').closest('.z-card')).toHaveAttribute('data-active', 'true');
  });

  it('renders empty hint for an empty column', () => {
    render(<KanbanBlock columns={[{ key: 'todo', title: '待处理', cards: [] }]} />);
    expect(screen.getByText('暂无卡片')).toBeInTheDocument();
  });
});
