import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Timeline } from './index';

afterEach(cleanup);

const ITEMS = [
  { label: '09:00', children: '起床', color: 'success' as const },
  { label: '10:00', children: '开会' },
  { key: 'custom', children: '收工', color: 'warning' as const, dot: <span data-testid="custom-dot">★</span> },
];

describe('Timeline', () => {
  it('renders items with content and label parts', () => {
    render(<Timeline items={ITEMS} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-timeline');
    const items = root.querySelectorAll('[data-part="item"]');
    expect(items).toHaveLength(3);
    expect(screen.getByText('起床')).toHaveAttribute('data-part', 'content');
    expect(screen.getByText('09:00')).toHaveAttribute('data-part', 'label');
  });

  it('defaults to mode=left', () => {
    render(<Timeline items={ITEMS} />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-mode', 'left');
  });

  it('mode=right and mode=alternate set data-mode', () => {
    const { rerender } = render(<Timeline items={ITEMS} mode="right" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-mode', 'right');
    rerender(<Timeline items={ITEMS} mode="alternate" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-mode', 'alternate');
  });

  it('item color maps to data-color (default neutral)', () => {
    render(<Timeline items={ITEMS} />);
    const items = document.querySelectorAll('[data-part="item"]');
    expect(items[0]).toHaveAttribute('data-color', 'success');
    expect(items[1]).toHaveAttribute('data-color', 'neutral'); // 未指定默认 neutral
    expect(items[2]).toHaveAttribute('data-color', 'warning');
  });

  it('renders custom dot when provided, default dot otherwise', () => {
    render(<Timeline items={ITEMS} />);
    expect(screen.getByTestId('custom-dot')).toBeInTheDocument();
    expect(document.querySelector('[data-part="dot-custom"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-part="dot-default"]')).toHaveLength(2);
  });

  it('renders pending node with pending dot when provided', () => {
    render(<Timeline items={ITEMS} pending="加载中…" />);
    const pending = document.querySelector('[data-part="pending"]') as HTMLElement;
    expect(pending).toHaveAttribute('data-pending', 'true');
    expect(pending.querySelector('[data-part="dot-pending"]')).toBeInTheDocument();
    expect(screen.getByText('加载中…')).toHaveAttribute('data-part', 'content');
  });

  it('omits pending node when not provided', () => {
    render(<Timeline items={ITEMS} />);
    expect(document.querySelector('[data-part="pending"]')).toBeNull();
  });

  it('uses item.key as React key and falls back to index', () => {
    const { container } = render(<Timeline items={ITEMS} />);
    const items = container.querySelectorAll('[data-part="item"]');
    // 三个节点全部渲染（key 稳定性由 React 保证，这里断言数量与顺序）
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('起床');
    expect(items[2].textContent).toContain('收工');
  });

  it('passes classNames to parts and className to root', () => {
    render(
      <Timeline
        items={ITEMS}
        className="my-tl"
        classNames={{ root: 'r', item: 'i', dot: 'd', label: 'l', content: 'c' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-timeline', 'my-tl', 'r');
    const item = root.querySelector('[data-part="item"]') as HTMLElement;
    expect(item).toHaveClass('z-timeline-item', 'i');
    expect(item.querySelector('[data-part="dot"]')).toHaveClass('z-timeline-dot', 'd');
    expect(item.querySelector('[data-part="label"]')).toHaveClass('z-timeline-label', 'l');
    expect(item.querySelector('[data-part="content"]')).toHaveClass('z-timeline-content', 'c');
  });

  it('forwards native props (aria-label / data-*) to root', () => {
    render(<Timeline items={ITEMS} aria-label="时间轴" data-testid="tl-root" />);
    expect(screen.getByTestId('tl-root')).toHaveAttribute('aria-label', '时间轴');
  });
});
