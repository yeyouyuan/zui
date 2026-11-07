import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListDetailBlock } from '../src/list-detail';

afterEach(cleanup);

describe('list-detail block', () => {
  it('renders left list and right Descriptions detail in a two-column Row/Col layout', () => {
    const { container } = render(<ListDetailBlock />);
    // 双栏
    expect(container.querySelector('.zui-list-detail-col-list')).toBeInTheDocument();
    expect(container.querySelector('.zui-list-detail-col-detail')).toBeInTheDocument();
    // 左列表
    expect(container.querySelectorAll('.z-list-item').length).toBe(3);
    expect(screen.getAllByText('官网改版项目').length).toBeGreaterThanOrEqual(2);
    // 右详情：默认选中第一项
    expect(container.querySelector('.z-descriptions')).toBeInTheDocument();
    expect(container.querySelectorAll('.z-descriptions-item').length).toBe(6);
    expect(screen.getByText('详细信息')).toBeInTheDocument();
    expect(screen.getAllByText('李梅').length).toBeGreaterThanOrEqual(1);
  });

  it('selects a list item on click and fires onSelect with the item', () => {
    const onSelect = vi.fn();
    const { container } = render(<ListDetailBlock onSelect={onSelect} />);
    fireEvent.click(screen.getAllByText('订单中台性能优化')[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 't3' }));
    // 详情标题跟随选中项
    expect(screen.getAllByText('订单中台性能优化').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.z-descriptions')).toHaveTextContent('王强');
  });

  it('supports controlled selectedKey', () => {
    const onSelect = vi.fn();
    const { container } = render(<ListDetailBlock selectedKey="t2" onSelect={onSelect} />);
    expect(container.querySelector('.z-descriptions')).toHaveTextContent('张晓明');
    // 详情标题默认取选中项
    expect(screen.getAllByText('移动端数据大屏').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByText('官网改版项目')[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 't1' }));
    // 受控：详情仍显示 t2
    expect(container.querySelector('.z-descriptions')).toHaveTextContent('张晓明');
  });

  it('shows empty detail when no items provided', () => {
    render(<ListDetailBlock items={[]} />);
    expect(screen.getByText('暂无选中项')).toBeInTheDocument();
  });
});
