import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './Alert';

afterEach(cleanup);

describe('Alert', () => {
  it('renders with default type=info and role=status', () => {
    render(<Alert title="提示标题">辅助描述</Alert>);
    const root = screen.getByRole('status');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-type', 'info');
    expect(root).toHaveClass('z-alert');
    expect(screen.getByText('提示标题')).toBeInTheDocument();
    expect(screen.getByText('辅助描述')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses role=alert for error and warning, role=status for info and success', () => {
    const { unmount: u1 } = render(<Alert type="error">错误</Alert>);
    expect(screen.getByRole('alert')).toHaveAttribute('data-type', 'error');
    u1();
    const { unmount: u2 } = render(<Alert type="warning">警告</Alert>);
    expect(screen.getByRole('alert')).toHaveAttribute('data-type', 'warning');
    u2();
    const { unmount: u3 } = render(<Alert type="success">成功</Alert>);
    expect(screen.getByRole('status')).toHaveAttribute('data-type', 'success');
    u3();
    render(<Alert type="info">信息</Alert>);
    expect(screen.getByRole('status')).toHaveAttribute('data-type', 'info');
  });

  it('renders title and description parts with proper class names', () => {
    const { container } = render(
      <Alert title="标题" classNames={{ title: 'cls-title', description: 'cls-desc' }}>
        描述
      </Alert>
    );
    const title = container.querySelector('[data-part="title"]');
    expect(title).toHaveClass('z-alert-title', 'cls-title');
    expect(title).toHaveTextContent('标题');
    const description = container.querySelector('[data-part="description"]');
    expect(description).toHaveClass('z-alert-description', 'cls-desc');
    expect(description).toHaveTextContent('描述');
  });

  it('renders icon part by default and hides it with showIcon=false', () => {
    const { container, unmount } = render(<Alert title="带图标">内容</Alert>);
    const icon = container.querySelector('[data-part="icon"]');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('z-alert-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    unmount();

    const { container: c2 } = render(
      <Alert showIcon={false} title="无图标">
        内容
      </Alert>
    );
    expect(c2.querySelector('[data-part="icon"]')).not.toBeInTheDocument();
  });

  it('renders no close button by default', () => {
    render(<Alert title="标题">内容</Alert>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('closable: renders close button, removes alert and calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Alert closable onClose={onClose} title="可关闭">
        内容
      </Alert>
    );
    const close = screen.getByRole('button', { name: '关闭' });
    expect(close).toHaveAttribute('data-part', 'close');
    expect(close).toHaveClass('z-alert-close');

    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Alert
        closable
        className="my-root"
        classNames={{ root: 'cls-root', icon: 'cls-icon', close: 'cls-close' }}
        title="标题"
      >
        内容
      </Alert>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-alert', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="icon"]')).toHaveClass('z-alert-icon', 'cls-icon');
    expect(root.querySelector('[data-part="close"]')).toHaveClass('z-alert-close', 'cls-close');
  });

  it('forwards ref to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Alert ref={ref} title="标题">
        内容
      </Alert>
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole('status'));
  });

  it('passes native props through to the root element', () => {
    render(
      <Alert id="my-alert" data-testid="alert" aria-label="自定义" title="标题">
        内容
      </Alert>
    );
    const root = screen.getByTestId('alert');
    expect(root).toHaveAttribute('id', 'my-alert');
    expect(root).toHaveAttribute('aria-label', '自定义');
  });
});
