import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Progress } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

function getFill(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="fill"]') as HTMLElement;
}

describe('Progress 渲染与默认值', () => {
  it('渲染轨道/填充/信息三部件，默认 md + normal', () => {
    const { container } = render(<Progress percent={30} />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-progress');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveAttribute('data-status', 'normal');

    const track = container.querySelector('[data-part="track"]');
    expect(track).toHaveClass('z-progress-track');

    const fill = getFill(container);
    expect(fill).toHaveClass('z-progress-fill');
    expect(fill.style.width).toBe('30%');

    expect(screen.getByText('30%')).toHaveAttribute('data-part', 'info');
  });

  it('size 暴露 data-size', () => {
    const { container } = render(<Progress percent={10} size="sm" />);
    expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'sm');
  });

  it('showInfo=false 隐藏百分比文字', () => {
    const { container } = render(<Progress percent={50} showInfo={false} />);
    expect(container.querySelector('[data-part="info"]')).toBeNull();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('Progress 百分比处理', () => {
  it('percent 越界夹取到 [0, 100]', () => {
    const { container: c1, unmount: u1 } = render(<Progress percent={150} showInfo={false} />);
    expect(getFill(c1).style.width).toBe('100%');
    expect(getFill(c1)).toHaveAttribute('aria-valuenow', '100');
    u1();

    const { container: c2 } = render(<Progress percent={-20} showInfo={false} />);
    expect(getFill(c2).style.width).toBe('0%');
    expect(getFill(c2)).toHaveAttribute('aria-valuenow', '0');
  });

  it('小数百分比保留一位展示', () => {
    render(<Progress percent={33.34} />);
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });
});

describe('Progress ARIA', () => {
  it('role="progressbar" + aria-valuenow/min/max', () => {
    const { container } = render(<Progress percent={42} />);
    const bar = getFill(container);
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('支持 aria-label 与 aria-labelledby 为进度条提供名称', () => {
    const { rerender } = render(<Progress percent={42} aria-label="上传进度" />);
    expect(screen.getByRole('progressbar', { name: '上传进度' })).toBeInTheDocument();

    rerender(
      <>
        <span id="progress-label">任务进度</span>
        <Progress percent={42} aria-labelledby="progress-label" />
      </>
    );
    expect(screen.getByRole('progressbar', { name: '任务进度' })).toBeInTheDocument();
  });
});

describe('Progress status', () => {
  it('status 暴露 data-status（normal/active/success/error）', () => {
    const statuses = ['normal', 'active', 'success', 'error'] as const;
    for (const status of statuses) {
      const { container, unmount } = render(<Progress percent={60} status={status} />);
      expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-status', status);
      unmount();
    }
  });
});

describe('Progress 定制出口', () => {
  it('color 覆盖填充色变量，classNames 追加到各部件', () => {
    const { container } = render(
      <Progress
        percent={70}
        color="rebeccapurple"
        className="my-root"
        classNames={{ root: 'c-root', track: 'c-track', fill: 'c-fill', info: 'c-info' }}
      />
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-progress', 'my-root', 'c-root');
    expect(container.querySelector('[data-part="track"]')).toHaveClass(
      'z-progress-track',
      'c-track'
    );

    const fill = getFill(container);
    expect(fill).toHaveClass('z-progress-fill', 'c-fill');
    expect(fill.style.getPropertyValue('--z-progress-color')).toBe('rebeccapurple');

    expect(screen.getByText('70%')).toHaveClass('z-progress-info', 'c-info');
  });
});
