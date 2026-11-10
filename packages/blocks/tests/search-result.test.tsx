import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchResultBlock } from '../src/search-result';

afterEach(cleanup);

describe('search-result block', () => {
  it('renders search input, type filters and result list', () => {
    const { container } = render(<SearchResultBlock />);
    expect(screen.getByRole('searchbox', { name: '搜索文档 / 产品 / 工单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部', pressed: true })).toBeInTheDocument();
    expect(container.querySelectorAll('.z-list-item').length).toBe(5);
    expect(screen.getByText('ZUI 设计系统接入指南')).toBeInTheDocument();
  });

  it('filters results by keyword and switches result type', async () => {
    const user = userEvent.setup();
    const onKeywordChange = vi.fn();
    const { container } = render(<SearchResultBlock onKeywordChange={onKeywordChange} />);
    // 关键词过滤
    await user.type(screen.getByRole('searchbox', { name: '搜索文档 / 产品 / 工单' }), '大屏');
    expect(onKeywordChange).toHaveBeenCalled();
    expect(container.querySelectorAll('.z-list-item').length).toBe(3);
    expect(screen.getByText('数据大屏区块使用说明')).toBeInTheDocument();
    // 切换到「工单」：叠加类型过滤。
    fireEvent.click(screen.getByRole('button', { name: '工单' }));
    expect(screen.getByRole('button', { name: '工单', pressed: true })).toBeInTheDocument();
    expect(container.querySelectorAll('.z-list-item').length).toBe(1);
    expect(screen.getByText('大屏图表导出图片失败')).toBeInTheDocument();
    // 切回「全部」恢复
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(container.querySelectorAll('.z-list-item').length).toBe(3);
  });

  it('shows Empty state and resets filters from its action', async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchResultBlock />);
    await user.type(screen.getByRole('searchbox', { name: '搜索文档 / 产品 / 工单' }), '不存在的内容');
    expect(screen.getByText('未找到相关结果')).toBeInTheDocument();
    expect(container.querySelector('.z-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.getByText('ZUI 设计系统接入指南')).toBeInTheDocument();
  });

  it('fires onSearch on Enter or button click and onResultClick on item click', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onResultClick = vi.fn();
    render(<SearchResultBlock onSearch={onSearch} onResultClick={onResultClick} />);
    const input = screen.getByRole('searchbox', { name: '搜索文档 / 产品 / 工单' });
    await user.type(input, '设计{Enter}');
    expect(onSearch).toHaveBeenCalledWith('设计');
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(onSearch).toHaveBeenLastCalledWith('设计');
    fireEvent.click(screen.getByText('ZUI 设计系统接入指南'));
    expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'r1', type: 'doc' }));
  });
});
