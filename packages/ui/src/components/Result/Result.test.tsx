import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Result } from './index';

afterEach(cleanup);

describe('Result 渲染', () => {
  it('默认 info 状态渲染标题与图标', () => {
    render(<Result />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root).toHaveClass('z-result');
    expect(root).toHaveAttribute('data-status', 'info');
    expect(screen.getByText('提示')).toBeInTheDocument();
    expect(document.querySelector('[data-part="icon"] svg')).toBeInTheDocument();
  });

  it('自定义 title/subTitle/extra 渲染', () => {
    render(
      <Result
        status="success"
        title="支付成功"
        subTitle="2 秒后跳转订单页"
        extra={<button type="button">查看订单</button>}
      />
    );
    expect(screen.getByText('支付成功')).toBeInTheDocument();
    expect(screen.getByText('2 秒后跳转订单页')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看订单' })).toBeInTheDocument();
  });

  it('各状态渲染默认标题', () => {
    render(<Result status="404" />);
    // 标题与图标数字码都含 "404"，用 root 内标题 part 精确定位
    const title = document.querySelector('[data-part="title"]');
    expect(title).toHaveTextContent('404');
  });
});

describe('Result data-part / classNames', () => {
  it('data-part 结构完整（root/icon/title/subtitle/extra）', () => {
    render(
      <Result status="error" title="t" subTitle="s" extra={<span>e</span>} />
    );
    for (const part of ['root', 'icon', 'title', 'subtitle', 'extra']) {
      expect(document.querySelector(`[data-part="${part}"]`)).toBeInTheDocument();
    }
  });

  it('classNames 逐 slot 追加类名', () => {
    render(
      <Result
        title="t"
        subTitle="s"
        extra={<span>e</span>}
        classNames={{
          root: 'my-root',
          icon: 'my-icon',
          title: 'my-title',
          subtitle: 'my-subtitle',
          extra: 'my-extra',
        }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('my-root');
    expect(document.querySelector('[data-part="icon"]')).toHaveClass('my-icon');
    expect(document.querySelector('[data-part="title"]')).toHaveClass('my-title');
    expect(document.querySelector('[data-part="subtitle"]')).toHaveClass('my-subtitle');
    expect(document.querySelector('[data-part="extra"]')).toHaveClass('my-extra');
  });

  it('className 追加到根元素', () => {
    render(<Result className="page-404" />);
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-result', 'page-404');
  });
});

describe('Result 边界', () => {
  it('subTitle/extra 为 null 时不渲染对应 part', () => {
    render(<Result title="仅标题" />);
    expect(document.querySelector('[data-part="subtitle"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-part="extra"]')).not.toBeInTheDocument();
    expect(screen.queryByText('提示')).not.toBeInTheDocument();
    expect(screen.getByText('仅标题')).toBeInTheDocument();
  });

  it('status 覆盖 403/500 数字码图标', () => {
    const { rerender } = render(<Result status="403" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-status', '403');
    rerender(<Result status="500" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-status', '500');
    expect(document.querySelector('[data-part="title"]')).toHaveTextContent('500');
  });
});
