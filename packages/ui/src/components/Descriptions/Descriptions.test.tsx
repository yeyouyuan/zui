import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Descriptions } from './index';

afterEach(cleanup);

function Basic(props: {
  column?: number;
  size?: 'sm' | 'md';
  bordered?: boolean;
  title?: React.ReactNode;
  className?: string;
  classNames?: Record<string, string>;
}) {
  return (
    <Descriptions
      column={props.column}
      size={props.size}
      bordered={props.bordered}
      title={props.title}
      className={props.className}
      classNames={props.classNames}
    >
      <Descriptions.Item label="姓名">张三</Descriptions.Item>
      <Descriptions.Item label="年龄">28</Descriptions.Item>
      <Descriptions.Item label="城市">上海</Descriptions.Item>
    </Descriptions>
  );
}

describe('Descriptions', () => {
  it('renders dl/dt/dd semantics with labels and content', () => {
    render(<Basic />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-descriptions');
    const body = root.querySelector('[data-part="body"]') as HTMLElement;
    expect(body.tagName).toBe('DL');
    const item = root.querySelector('[data-part="item"]') as HTMLElement;
    const label = item.querySelector('[data-part="label"]') as HTMLElement;
    const content = item.querySelector('[data-part="content"]') as HTMLElement;
    expect(label.tagName).toBe('DT');
    expect(content.tagName).toBe('DD');
    expect(label).toHaveTextContent('姓名');
    expect(content).toHaveTextContent('张三');
  });

  it('defaults to column=3 / size=md / bordered=false', () => {
    render(<Basic />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveAttribute('data-bordered', 'false');
    const body = root.querySelector('[data-part="body"]') as HTMLElement;
    expect(body.style.getPropertyValue('--z-descriptions-columns')).toBe('3');
  });

  it('applies column to the grid via CSS variable', () => {
    render(<Basic column={2} />);
    const body = document.querySelector('[data-part="body"]') as HTMLElement;
    expect(body.style.getPropertyValue('--z-descriptions-columns')).toBe('2');
  });

  it('applies size to root data attribute', () => {
    render(<Basic size="sm" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'sm');
  });

  it('renders title part when title is provided', () => {
    render(<Basic title="用户信息" />);
    const title = screen.getByText('用户信息');
    expect(title).toHaveAttribute('data-part', 'title');
    expect(title).toHaveClass('z-descriptions-title');
  });

  it('omits title part when title is not provided', () => {
    render(<Basic />);
    expect(document.querySelector('[data-part="title"]')).toBeNull();
  });

  it('bordered=true sets data-bordered="true"', () => {
    render(<Basic bordered />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-bordered', 'true');
  });

  it('Item span sets data-span and CSS variable, clamped to column', () => {
    const { container } = render(
      <Descriptions column={2}>
        <Descriptions.Item label="标题" span={2}>
          占两列
        </Descriptions.Item>
        <Descriptions.Item label="越界" span={99}>
          越界内容
        </Descriptions.Item>
      </Descriptions>
    );
    const items = container.querySelectorAll('[data-part="item"]');
    expect(items[0]).toHaveAttribute('data-span', '2');
    expect((items[0] as HTMLElement).style.getPropertyValue('--z-descriptions-item-span')).toBe('2');
    expect(items[1]).toHaveAttribute('data-span', '2'); // 99 → 收敛到 column=2
  });

  it('Item span defaults to 1', () => {
    render(
      <Descriptions>
        <Descriptions.Item label="单列">内容</Descriptions.Item>
      </Descriptions>
    );
    expect(document.querySelector('[data-part="item"]')).toHaveAttribute('data-span', '1');
  });

  it('passes classNames to parts and className to root', () => {
    render(<Basic className="my-desc" classNames={{ root: 'r', label: 'l', item: 'i' }} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-descriptions', 'my-desc', 'r');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('z-descriptions-item', 'i');
    expect(document.querySelector('[data-part="label"]')).toHaveClass('z-descriptions-label', 'l');
  });

  it('forwards native props (aria-label / data-*) to the root element', () => {
    render(<Descriptions aria-label="详情列表" data-testid="desc-root" />);
    expect(screen.getByTestId('desc-root')).toHaveAttribute('aria-label', '详情列表');
  });
});
