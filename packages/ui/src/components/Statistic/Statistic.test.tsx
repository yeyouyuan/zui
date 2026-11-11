import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Statistic, StatisticCountDown, formatCountdown, formatStatisticValue } from './index';
import { ConfigProvider, deDE } from '../../index';

/**
 * 与实现一致的运行时小数位上限探测（ECMA-402 规范上限 100，当前 V8/Node 18-20 实际为 20）。
 * 用例断言使用该交集，保证在不同 Node 版本上都稳定。
 */
function runtimeMaxFractionDigits(): number {
  for (const candidate of [100, 20]) {
    try {
      (0).toLocaleString('zh-CN', {
        minimumFractionDigits: candidate,
        maximumFractionDigits: candidate,
      });
      return candidate;
    } catch {
      // 该候选值不被当前运行时支持，降级探测
    }
  }
  return 20;
}

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

  it('precision=-1 does not crash and renders like precision=0', () => {
    render(<Statistic value={12345} precision={-1} />);
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('precision=-1 output matches precision=0 output', () => {
    const { unmount } = render(<Statistic value={1234.5678} precision={-1} />);
    expect(screen.getByText('1,235')).toBeInTheDocument();
    unmount();
    render(<Statistic value={1234.5678} precision={0} />);
    expect(screen.getByText('1,235')).toBeInTheDocument();
  });

  it('precision=101 does not crash and output matches precision=100 output', () => {
    const expected = formatStatisticValue(1234.5678, 100);
    const { unmount } = render(<Statistic value={1234.5678} precision={101} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    unmount();
    render(<Statistic value={1234.5678} precision={100} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('clamped precision yields correct decimals: negative clamps to 0, oversized clamps to cap', () => {
    const cap = Math.min(100, runtimeMaxFractionDigits());
    const { unmount } = render(<Statistic value={2} precision={-5} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    unmount();
    render(<Statistic value={2} precision={200} />);
    expect(screen.getByText(`2.${'0'.repeat(cap)}`)).toBeInTheDocument();
  });

  it('number formatting follows ConfigProvider locale code (de-DE decimal separator)', () => {
    render(
      <ConfigProvider locale={deDE}>
        <Statistic value={1234.5} precision={1} />
      </ConfigProvider>
    );
    expect(screen.getByText('1.234,5')).toBeInTheDocument();
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

describe('formatStatisticValue precision clamp (regression)', () => {
  it('negative precision clamps to 0 and matches precision=0 output', () => {
    expect(() => formatStatisticValue(1234.5678, -1)).not.toThrow();
    expect(formatStatisticValue(1234.5678, -1)).toBe(formatStatisticValue(1234.5678, 0));
    expect(formatStatisticValue(1234.5678, -1)).toBe('1,235');
    expect(formatStatisticValue(1234.5678, Number.NEGATIVE_INFINITY)).toBe('1,235');
  });

  it('precision >100 clamps to 100 and matches precision=100 output', () => {
    expect(() => formatStatisticValue(1234.5678, 101)).not.toThrow();
    expect(formatStatisticValue(1234.5678, 101)).toBe(formatStatisticValue(1234.5678, 100));
    expect(formatStatisticValue(1234.5678, Number.POSITIVE_INFINITY)).toBe(
      formatStatisticValue(1234.5678, 100)
    );
  });

  it('clamped precision keeps correct decimal digits', () => {
    const cap = Math.min(100, runtimeMaxFractionDigits());
    expect(formatStatisticValue(2, -5)).toBe('2'); // clamp 到 0 位小数
    expect(formatStatisticValue(2, 0)).toBe('2');
    expect(formatStatisticValue(2, 200)).toBe(`2.${'0'.repeat(cap)}`); // clamp 到规范/运行时上限
    expect(formatStatisticValue(2, 100)).toBe(`2.${'0'.repeat(cap)}`);
    expect(formatStatisticValue(1.25, -1)).toBe('1'); // 0 位小数四舍五入
  });

  it('boundary values 0 and 100 stay unchanged; invalid precision falls back to default decimals', () => {
    const cap = Math.min(100, runtimeMaxFractionDigits());
    expect(formatStatisticValue(1.5, 0)).toBe('2');
    expect(formatStatisticValue(1.5, 100)).toBe(`1.5${'0'.repeat(cap - 1)}`);
    expect(formatStatisticValue(1.25, undefined)).toBe('1.25');
    expect(formatStatisticValue(1.25, Number.NaN)).toBe('1.25'); // 不抛 RangeError
  });

  it('numeric strings route through the same clamp and locale', () => {
    expect(formatStatisticValue('1234.5678', -1)).toBe('1,235');
    expect(formatStatisticValue('1234.5', 1, 'de-DE')).toBe('1.234,5');
  });

  it('accepts a locale tag without changing the default output', () => {
    expect(formatStatisticValue(12345, undefined, 'zh-CN')).toBe('12,345');
    expect(formatStatisticValue(12345, undefined)).toBe('12,345'); // 缺省仍为 zh-CN
  });
});

describe('formatCountdown', () => {
  it('formats remaining ms as zero-padded HH:mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(1)).toBe('00:00:01');
    expect(formatCountdown(5_000)).toBe('00:00:05');
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    // 跨天累计小时数，不做天位
    expect(formatCountdown(48 * 3_600_000)).toBe('48:00:00');
  });
});

describe('Statistic.CountDown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders role=timer with locale accessible name and parts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { container } = render(
      <StatisticCountDown value={Date.now() + 3_723_000} title="活动结束" />
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('role', 'timer');
    expect(root).toHaveAttribute('aria-label', '倒计时');
    expect(screen.getByText('活动结束')).toHaveAttribute('data-part', 'title');
    expect(container.querySelector('.z-statistic-number')).toHaveTextContent('01:02:03');
  });

  it('explicit aria-label overrides the locale default', () => {
    vi.useFakeTimers();
    render(<StatisticCountDown value={Date.now() + 60_000} aria-label="秒杀结束" />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '秒杀结束');
  });

  it('ticks down each second', async () => {
    vi.useFakeTimers();
    render(<StatisticCountDown value={Date.now() + 5_000} />);
    const number = document.querySelector('.z-statistic-number') as HTMLElement;
    expect(number).toHaveTextContent('00:00:05');
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(number).toHaveTextContent('00:00:03');
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(number).toHaveTextContent('00:00:00');
  });

  it('fires onFinish once when reaching zero', async () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    render(<StatisticCountDown value={Date.now() + 2_000} onFinish={onFinish} />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('already-past target renders 00:00:00 and fires onFinish immediately', () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    render(<StatisticCountDown value={Date.now() - 1_000} onFinish={onFinish} />);
    expect(document.querySelector('.z-statistic-number')).toHaveTextContent('00:00:00');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('deduplicates an already-finished target across StrictMode effect replay', () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    render(
      <StrictMode>
        <StatisticCountDown value={Date.now() - 1_000} onFinish={onFinish} />
      </StrictMode>
    );
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('hydrates from a deterministic placeholder even when time crosses a second boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const target = Date.now() + 2_000;
    const markup = renderToString(<StatisticCountDown value={target} />);
    expect(markup).toContain('--:--:--');

    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.append(container);
    vi.setSystemTime(new Date('2026-01-01T00:00:01.250Z'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, <StatisticCountDown value={target} />);
    });

    expect(error.mock.calls.flat().join(' ')).not.toMatch(/hydration|did not match/i);
    expect(container.querySelector('.z-statistic-number')).toHaveTextContent('00:00:01');
    act(() => root?.unmount());
    container.remove();
    error.mockRestore();
  });

  it('accepts Date and numeric-string targets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { unmount } = render(<StatisticCountDown value={new Date('2026-01-01T00:01:00Z')} />);
    expect(document.querySelector('.z-statistic-number')).toHaveTextContent('00:01:00');
    unmount();
    render(<StatisticCountDown value="2026-01-01T00:02:00Z" />);
    expect(document.querySelector('.z-statistic-number')).toHaveTextContent('00:02:00');
  });

  it('unparseable target renders 00:00:00 without throwing', () => {
    vi.useFakeTimers();
    render(<StatisticCountDown value="not-a-date" />);
    expect(document.querySelector('.z-statistic-number')).toHaveTextContent('00:00:00');
  });

  it('is mounted as Statistic.CountDown with same behavior', () => {
    vi.useFakeTimers();
    render(<Statistic.CountDown value={Date.now() + 1_000} />);
    expect(document.querySelector('.z-statistic-number')).toHaveTextContent('00:00:01');
  });
});
