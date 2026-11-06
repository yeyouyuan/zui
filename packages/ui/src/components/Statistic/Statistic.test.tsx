import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Statistic, formatStatisticValue } from './index';

afterEach(cleanup);

describe('Statistic', () => {
  it('renders title and value with parts', () => {
    render(<Statistic title="总销售额" value={12345} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-statistic');
    expect(screen.getByText('总销售额')).toHaveAttribute('data-part', 'title');
    const value = document.querySelector('[data-part="value"]') as HTMLElement;
    expect(value).toHaveTextContent('12,345');
    expect(value.querySelector('.z-statistic-number')).toHaveTextContent('12,345');
  });

  it('formats numbers with thousand separators', () => {
    render(<Statistic value={1234567} />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    const { unmount } = render(<Statistic value={-1234.5} precision={1} />);
    expect(screen.getByText('-1,234.5')).toBeInTheDocument();
    unmount();
  });

  it('precision pads decimals', () => {
    render(<Statistic value={42} precision={2} />);
    expect(screen.getByText('42.00')).toBeInTheDocument();
  });

  it('renders prefix and suffix', () => {
    render(<Statistic value={100} prefix="¥" suffix="元" />);
    expect(screen.getByText('¥')).toHaveAttribute('data-part', 'prefix');
    expect(screen.getByText('元')).toHaveAttribute('data-part', 'suffix');
  });

  it('omits prefix/suffix parts when not provided', () => {
    render(<Statistic value={100} />);
    expect(document.querySelector('[data-part="prefix"]')).toBeNull();
    expect(document.querySelector('[data-part="suffix"]')).toBeNull();
    expect(document.querySelector('[data-part="title"]')).toBeNull();
  });

  it('valueStyle merges inline styles onto the value element', () => {
    render(<Statistic value={1} valueStyle={{ color: 'rgb(1, 2, 3)' }} />);
    const value = document.querySelector('[data-part="value"]') as HTMLElement;
    expect(value).toHaveStyle({ color: 'rgb(1, 2, 3)' });
  });

  it('passes classNames to parts and className to root', () => {
    render(
      <Statistic
        title="T"
        value={1}
        suffix="%"
        className="my-stat"
        classNames={{ root: 'r', title: 't', value: 'v', suffix: 's' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-statistic', 'my-stat', 'r');
    expect(document.querySelector('[data-part="title"]')).toHaveClass('z-statistic-title', 't');
    expect(document.querySelector('[data-part="value"]')).toHaveClass('z-statistic-value', 'v');
    expect(document.querySelector('[data-part="suffix"]')).toHaveClass('z-statistic-suffix', 's');
  });

  it('string value: numeric strings get formatted, others pass through', () => {
    const { unmount } = render(<Statistic value="12345" />);
    expect(screen.getByText('12,345')).toBeInTheDocument();
    unmount();
    render(<Statistic value="加载中…" />);
    expect(screen.getByText('加载中…')).toBeInTheDocument();
  });

  it('large value uses semibold 600 weight token (CSS var defined)', () => {
    // 字重通过组件级变量 --z-statistic-value-font-weight 控制（--z-weight-semibold = 600），
    // 这里断言 value part 结构与 CSS 变量挂在根选择器上的契约（样式由 CSS 提供）。
    render(<Statistic value={999999} />);
    const value = document.querySelector('[data-part="value"]') as HTMLElement;
    expect(value.querySelector('.z-statistic-number')).toBeTruthy();
  });

  it('formatStatisticValue handles non-finite and empty input', () => {
    expect(formatStatisticValue('')).toBe('');
    expect(formatStatisticValue(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  it('forwards native props (aria-label / data-*) to root', () => {
    render(<Statistic value={1} aria-label="指标" data-testid="stat-root" />);
    expect(screen.getByTestId('stat-root')).toHaveAttribute('aria-label', '指标');
  });
});
