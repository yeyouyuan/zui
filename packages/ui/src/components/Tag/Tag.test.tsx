import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag } from './Tag';

afterEach(cleanup);

describe('Tag', () => {
  it('renders with default color=neutral and label content', () => {
    const { container } = render(<Tag>标签</Tag>);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-tag');
    expect(root).toHaveAttribute('data-color', 'neutral');
    expect(screen.getByText('标签')).toBeInTheDocument();
  });

  it('exposes color via data-color', () => {
    const colors = ['primary', 'success', 'warning', 'error', 'neutral'] as const;
    for (const color of colors) {
      const { container, unmount } = render(<Tag color={color}>标签</Tag>);
      expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-color', color);
      unmount();
    }
  });

  it('renders icon part when icon is provided', () => {
    const { container } = render(<Tag icon={<i data-testid="icon">★</i>}>标签</Tag>);
    const icon = container.querySelector('[data-part="icon"]');
    expect(icon).toHaveClass('z-tag-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon!.contains(screen.getByTestId('icon'))).toBe(true);
  });

  it('does not render close button by default', () => {
    render(<Tag>标签</Tag>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('closable: renders × button with aria-label="移除标签" and removes tag on click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Tag closable onClose={onClose}>
        标签
      </Tag>
    );
    const close = screen.getByRole('button', { name: '移除标签' });
    expect(close).toHaveAttribute('data-part', 'close');
    expect(close).toHaveClass('z-tag-close');

    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(expect.any(Object));
    expect(screen.queryByText('标签')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '移除标签' })).not.toBeInTheDocument();
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Tag
        closable
        icon={<i>★</i>}
        className="my-root"
        classNames={{ root: 'cls-root', icon: 'cls-icon', close: 'cls-close' }}
      >
        标签
      </Tag>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-tag', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="icon"]')).toHaveClass('z-tag-icon', 'cls-icon');
    expect(root.querySelector('[data-part="close"]')).toHaveClass('z-tag-close', 'cls-close');
  });

  it('forwards ref to the root element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Tag ref={ref}>标签</Tag>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toHaveAttribute('data-part', 'root');
  });

  it('passes native props through to the root element', () => {
    render(
      <Tag id="my-tag" data-testid="tag" title="提示" tabIndex={0}>
        标签
      </Tag>
    );
    const root = screen.getByTestId('tag');
    expect(root).toHaveAttribute('id', 'my-tag');
    expect(root).toHaveAttribute('title', '提示');
    expect(root).toHaveAttribute('tabindex', '0');
  });
});
