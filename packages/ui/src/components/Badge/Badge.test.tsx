import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge } from './Badge';

afterEach(cleanup);

describe('Badge', () => {
  describe('包裹型（有 children）', () => {
    it('renders root wrapper with children and indicator', () => {
      const { container } = render(<Badge count={5}>消息</Badge>);
      const root = container.querySelector('[data-part="root"]') as HTMLElement;
      expect(root).toHaveClass('z-badge');
      expect(root).toHaveAttribute('data-color', 'error');
      expect(screen.getByText('消息')).toBeInTheDocument();
      const indicator = root.querySelector('[data-part="indicator"]');
      expect(indicator).toHaveClass('z-badge-indicator');
      expect(indicator).toHaveTextContent('5');
    });

    it('hides indicator when count is 0 and showZero is false', () => {
      const { container } = render(<Badge count={0}>消息</Badge>);
      expect(container.querySelector('[data-part="indicator"]')).not.toBeInTheDocument();
    });

    it('shows indicator when count is 0 and showZero is true', () => {
      const { container } = render(
        <Badge count={0} showZero>
          消息
        </Badge>
      );
      expect(container.querySelector('[data-part="indicator"]')).toHaveTextContent('0');
    });

    it('caps count at max and shows ${max}+', () => {
      const { container, unmount } = render(
        <Badge count={100} max={99}>
          消息
        </Badge>
      );
      expect(container.querySelector('[data-part="indicator"]')).toHaveTextContent('99+');
      unmount();

      const { container: c2 } = render(
        <Badge count={50} max={10}>
          消息
        </Badge>
      );
      expect(c2.querySelector('[data-part="indicator"]')).toHaveTextContent('10+');
    });

    it('renders dot mode with empty indicator', () => {
      const { container } = render(<Badge dot>消息</Badge>);
      const indicator = container.querySelector('[data-part="indicator"]');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('data-dot', 'true');
      expect(indicator).toBeEmptyDOMElement();
    });
  });

  describe('独立模式（无 children）', () => {
    it('renders standalone indicator without root wrapper', () => {
      render(<Badge count={8} />);
      const indicator = screen.getByText('8');
      expect(indicator).toHaveAttribute('data-part', 'indicator');
      expect(indicator).toHaveClass('z-badge-indicator');
      expect(indicator).toHaveAttribute('data-color', 'error');
      expect(screen.queryByText('消息')).not.toBeInTheDocument();
    });

    it('returns null for count=0 unless showZero is true', () => {
      const { container, rerender } = render(<Badge count={0} />);
      expect(container).toBeEmptyDOMElement();

      rerender(<Badge count={0} showZero />);
      expect(screen.getByText('0')).toHaveAttribute('data-part', 'indicator');
    });

    it('still respects max in standalone mode', () => {
      render(<Badge count={120} />);
      expect(screen.getByText('99+')).toHaveAttribute('data-part', 'indicator');
    });

    it('renders standalone dot mode', () => {
      render(<Badge dot color="primary" />);
      const indicator = document.querySelector('[data-part="indicator"]');
      expect(indicator).toHaveAttribute('data-dot', 'true');
      expect(indicator).toHaveAttribute('data-color', 'primary');
      expect(indicator).toBeEmptyDOMElement();
    });
  });

  it('exposes color via data-color on the visible element', () => {
    const colors = ['primary', 'success', 'warning', 'error', 'neutral'] as const;
    for (const color of colors) {
      const { unmount } = render(<Badge count={1} color={color} />);
      expect(screen.getByText('1')).toHaveAttribute('data-color', color);
      unmount();
    }
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Badge
        count={3}
        className="my-root"
        classNames={{ root: 'cls-root', indicator: 'cls-indicator' }}
      >
        消息
      </Badge>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-badge', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="indicator"]')).toHaveClass(
      'z-badge-indicator',
      'cls-indicator'
    );
  });

  it('passes className to standalone indicator', () => {
    render(<Badge count={2} className="my-badge" classNames={{ indicator: 'cls-indicator' }} />);
    const indicator = screen.getByText('2');
    expect(indicator).toHaveClass('z-badge-indicator', 'my-badge', 'cls-indicator');
  });
});
