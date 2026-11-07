import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataScreenBlock } from '../src/data-screen';

afterEach(cleanup);

describe('data-screen block', () => {
  it('renders Statistic cards, CSS bar chart and Progress gauges', () => {
    const { container } = render(<DataScreenBlock />);
    expect(container.querySelector('.z-statistic')).toBeInTheDocument();
    expect(screen.getByText('实时在线')).toBeInTheDocument();
    // CSS 柱状图：role="img" + 柱条悬浮提示
    expect(screen.getByRole('img', { name: /分时访问量/ })).toBeInTheDocument();
    expect(screen.getByTitle('12,840')).toBeInTheDocument();
    // Progress 资源指标
    const progress = container.querySelectorAll('.z-progress');
    expect(progress.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('CPU 使用率')).toBeInTheDocument();
  });

  it('switches time range through Segmented and fires onRangeChange', () => {
    const onRangeChange = vi.fn();
    const { container } = render(<DataScreenBlock onRangeChange={onRangeChange} />);
    const group = screen.getByRole('radiogroup', { name: '时间维度' });
    expect(group).toBeInTheDocument();
    const weekRadio = screen.getByRole('radio', { name: '近 7 天' });
    expect(weekRadio).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(weekRadio);
    expect(onRangeChange).toHaveBeenCalledWith('week');
    // 非受控内部状态同步
    expect(weekRadio).toHaveAttribute('aria-checked', 'true');
    expect(container).toBeDefined();
  });

  it('respects controlled range props', () => {
    const onRangeChange = vi.fn();
    render(<DataScreenBlock range="month" onRangeChange={onRangeChange} />);
    const monthRadio = screen.getByRole('radio', { name: '近 30 天' });
    expect(monthRadio).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(monthRadio);
    expect(onRangeChange).toHaveBeenCalledWith('month');
    // 受控：值不内部翻转
    expect(monthRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onRefresh from the refresh button', () => {
    const onRefresh = vi.fn();
    render(<DataScreenBlock onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
