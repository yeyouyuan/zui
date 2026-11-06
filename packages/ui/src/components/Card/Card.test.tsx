import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Card } from './Card';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Card', () => {
  it('renders body content by default with data-part structure', () => {
    const { container } = render(<Card>内容</Card>);
    const root = getRoot(container);
    expect(root).toHaveClass('z-card');
    expect(root).toHaveAttribute('data-bordered', 'true');
    expect(root).toHaveAttribute('data-hoverable', 'false');
    expect(screen.getByText('内容')).toBeInTheDocument();
    const body = container.querySelector('[data-part="body"]');
    expect(body).toHaveClass('z-card-body');
  });

  it('renders title and extra in header part', () => {
    const { container } = render(
      <Card title="卡片标题" extra={<button>操作</button>}>
        内容
      </Card>
    );
    const header = container.querySelector('[data-part="header"]');
    expect(header).toHaveClass('z-card-header');
    const title = container.querySelector('[data-part="title"]');
    expect(title).toHaveClass('z-card-title');
    expect(title).toHaveTextContent('卡片标题');
    const extra = container.querySelector('[data-part="extra"]');
    expect(extra).toHaveClass('z-card-extra');
    expect(extra).toContainElement(screen.getByRole('button', { name: '操作' }));
  });

  it('renders extra only without title', () => {
    const { container } = render(<Card extra={<span>右侧</span>}>内容</Card>);
    expect(container.querySelector('[data-part="header"]')).toBeInTheDocument();
    expect(container.querySelector('[data-part="title"]')).not.toBeInTheDocument();
    expect(screen.getByText('右侧')).toBeInTheDocument();
  });

  it('omits header when no title and no extra', () => {
    const { container } = render(<Card>内容</Card>);
    expect(container.querySelector('[data-part="header"]')).not.toBeInTheDocument();
  });

  it('renders cover at the top', () => {
    const { container } = render(
      <Card cover={<img src="/c.png" alt="封面" />}>内容</Card>
    );
    const cover = container.querySelector('[data-part="cover"]');
    expect(cover).toHaveClass('z-card-cover');
    expect(cover).toContainElement(screen.getByRole('img', { name: '封面' }));
    // cover 在 body 之前
    const root = getRoot(container);
    expect(root.firstElementChild).toBe(cover);
  });

  it('renders footer part', () => {
    const { container } = render(<Card footer={<span>底部</span>}>内容</Card>);
    const footer = container.querySelector('[data-part="footer"]');
    expect(footer).toHaveClass('z-card-footer');
    expect(footer).toHaveTextContent('底部');
  });

  it('omits cover/body/footer parts when not provided', () => {
    const { container } = render(<Card title="仅标题" />);
    expect(container.querySelector('[data-part="cover"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-part="body"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-part="footer"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-part="header"]')).toBeInTheDocument();
  });

  it('exposes bordered via data-bordered', () => {
    const { container } = render(<Card bordered={false}>内容</Card>);
    expect(getRoot(container)).toHaveAttribute('data-bordered', 'false');
  });

  it('exposes hoverable via data-hoverable', () => {
    const { container } = render(<Card hoverable>内容</Card>);
    expect(getRoot(container)).toHaveAttribute('data-hoverable', 'true');
  });

  it('passes className and classNames to all parts', () => {
    const { container } = render(
      <Card
        title="T"
        extra="E"
        cover="C"
        footer="F"
        className="my-root"
        classNames={{
          root: 'cls-root',
          header: 'cls-header',
          title: 'cls-title',
          extra: 'cls-extra',
          cover: 'cls-cover',
          body: 'cls-body',
          footer: 'cls-footer',
        }}
      >
        B
      </Card>
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-card', 'my-root', 'cls-root');
    expect(container.querySelector('[data-part="header"]')).toHaveClass('z-card-header', 'cls-header');
    expect(container.querySelector('[data-part="title"]')).toHaveClass('z-card-title', 'cls-title');
    expect(container.querySelector('[data-part="extra"]')).toHaveClass('z-card-extra', 'cls-extra');
    expect(container.querySelector('[data-part="cover"]')).toHaveClass('z-card-cover', 'cls-cover');
    expect(container.querySelector('[data-part="body"]')).toHaveClass('z-card-body', 'cls-body');
    expect(container.querySelector('[data-part="footer"]')).toHaveClass('z-card-footer', 'cls-footer');
  });

  it('forwards ref to the div element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>内容</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-card');
  });

  it('passes native props through to the root element', () => {
    render(<Card id="my-card" data-testid="card" aria-label="信息卡片">内容</Card>);
    const root = screen.getByTestId('card');
    expect(root).toHaveAttribute('id', 'my-card');
    expect(root).toHaveAttribute('aria-label', '信息卡片');
  });
});
