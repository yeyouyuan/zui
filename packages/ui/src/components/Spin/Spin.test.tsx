import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Spin } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

describe('Spin 独立模式', () => {
  it('默认 spinning 渲染旋转环与 root 类名', () => {
    const { container } = render(<Spin />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-spin', 'z-spin--inline');
    expect(root).toHaveAttribute('data-spinning', '');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root.querySelector('[data-part="spinner"]')).toHaveClass('z-spin-spinner');
  });

  it('spinning=false 时独立模式不渲染', () => {
    const { container } = render(<Spin spinning={false} />);
    expect(container.querySelector('[data-part="root"]')).toBeNull();
  });

  it('tip 渲染为底部文案', () => {
    render(<Spin tip="加载中…" />);
    expect(screen.getByText('加载中…')).toHaveAttribute('data-part', 'tip');
    expect(screen.getByText('加载中…')).toHaveClass('z-spin-tip');
  });

  it('size 暴露 data-size', () => {
    const { container } = render(<Spin size="lg" />);
    expect(container.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'lg');
  });
});

describe('Spin 包裹模式', () => {
  it('有 children 时渲染内容 + 遮罩 + aria-busy', () => {
    const { container } = render(
      <Spin tip="加载中">
        <p data-testid="content">内容</p>
      </Spin>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-spin--wrap');
    expect(root).toHaveAttribute('data-spinning', '');

    expect(screen.getByTestId('content')).toBeInTheDocument();
    const childrenWrap = container.querySelector('.z-spin-children') as HTMLElement;
    expect(childrenWrap).toHaveAttribute('aria-busy', 'true');

    // 遮罩 + 旋转环 + tip 同时可见
    expect(container.querySelector('.z-spin-mask')).not.toBeNull();
    expect(container.querySelector('[data-part="spinner"]')).not.toBeNull();
    expect(screen.getByText('加载中')).toHaveClass('z-spin-tip');
  });

  it('spinning=false 时内容可交互、无遮罩与 aria-busy', () => {
    const { container } = render(
      <Spin spinning={false}>
        <p data-testid="content">内容</p>
      </Spin>
    );
    expect(container.querySelector('[data-part="root"]')).not.toHaveAttribute('data-spinning');
    expect(container.querySelector('.z-spin-mask')).toBeNull();
    const childrenWrap = container.querySelector('.z-spin-children') as HTMLElement;
    expect(childrenWrap).not.toHaveAttribute('aria-busy');
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});

describe('Spin 定制出口', () => {
  it('classNames 追加到 root / spinner / tip', () => {
    const { container } = render(
      <Spin tip="加载中" classNames={{ root: 'c-root', spinner: 'c-spinner', tip: 'c-tip' }}>
        <p>内容</p>
      </Spin>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-spin', 'c-root');
    expect(container.querySelector('[data-part="spinner"]')).toHaveClass('z-spin-spinner', 'c-spinner');
    expect(screen.getByText('加载中')).toHaveClass('z-spin-tip', 'c-tip');
  });

  it('透传原生属性（className、data-*）', () => {
    const { container } = render(<Spin className="my-spin" data-foo="bar" tip="加载中" />);
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-spin', 'my-spin');
    expect(root).toHaveAttribute('data-foo', 'bar');
  });

  it('forwards ref to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Spin ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveAttribute('data-part', 'root');
  });
});
