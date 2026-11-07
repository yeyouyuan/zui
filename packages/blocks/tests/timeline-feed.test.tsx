import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineFeedBlock } from '../src/timeline-feed';

afterEach(cleanup);

describe('timeline-feed block', () => {
  it('renders Timeline with Avatar and Card entries', () => {
    const { container } = render(<TimelineFeedBlock />);
    expect(container.querySelector('.z-timeline')).toBeInTheDocument();
    expect(container.querySelectorAll('.z-timeline-item').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll('.z-avatar').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('发布了周报《第 45 周产品迭代汇总》')).toBeInTheDocument();
    expect(screen.getByText('李梅')).toBeInTheDocument();
    expect(screen.getByText('告警')).toBeInTheDocument();
  });

  it('shows Skeleton placeholders while loading', () => {
    const { container } = render(<TimelineFeedBlock loading />);
    expect(container.querySelector('.z-timeline')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.z-skeleton').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('fires onLoadMore from the load-more button and hides it when hasMore=false', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<TimelineFeedBlock onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<TimelineFeedBlock onLoadMore={onLoadMore} hasMore={false} />);
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
  });

  it('fires onEntryClick when a feed card is clicked', () => {
    const onEntryClick = vi.fn();
    render(<TimelineFeedBlock onEntryClick={onEntryClick} />);
    fireEvent.click(screen.getByText('库存告警：SKU-8891 低于安全库存'));
    expect(onEntryClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'f4' }));
  });

  it('renders empty text when no entries', () => {
    render(<TimelineFeedBlock entries={[]} />);
    expect(screen.getByText('暂无动态')).toBeInTheDocument();
  });

  it('activates interactive entries with Enter and Space', async () => {
    const onEntryClick = vi.fn();
    const user = userEvent.setup();
    render(<TimelineFeedBlock onEntryClick={onEntryClick} />);
    const trigger = screen.getByRole('button', {
      name: '系统：库存告警：SKU-8891 低于安全库存',
    });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onEntryClick).toHaveBeenCalledTimes(2);
    expect(onEntryClick).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'f4' }));
  });

  it('does not activate the entry when an interactive child is clicked', async () => {
    const onEntryClick = vi.fn();
    const onChildClick = vi.fn();
    const user = userEvent.setup();
    render(
      <TimelineFeedBlock
        entries={[
          {
            key: 'interactive',
            time: '刚刚',
            author: '李梅',
            title: <button onClick={onChildClick}>子操作</button>,
            content: <a href="#details">详情链接</a>,
          },
        ]}
        onEntryClick={onEntryClick}
      />
    );
    await user.click(screen.getByRole('button', { name: '子操作' }));
    await user.click(screen.getByRole('link', { name: '详情链接' }));
    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onEntryClick).not.toHaveBeenCalled();
  });

  it('does not activate the entry when a label proxies a click to its control', async () => {
    const onEntryClick = vi.fn();
    const user = userEvent.setup();
    render(
      <TimelineFeedBlock
        entries={[
          {
            key: 'label-control',
            time: '刚刚',
            author: '李梅',
            title: (
              <label htmlFor="timeline-subscribe">
                <span>订阅动态</span>
                <input id="timeline-subscribe" type="checkbox" />
              </label>
            ),
          },
        ]}
        onEntryClick={onEntryClick}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: '订阅动态' });
    await user.click(screen.getByText('订阅动态'));
    expect(checkbox).toBeChecked();
    expect(onEntryClick).not.toHaveBeenCalled();
  });
});
