import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { List } from './List';

afterEach(cleanup);

const ITEMS = [
  { key: '1', title: '标题一', description: '描述一' },
  { key: '2', title: '标题二', description: '描述二', extra: <button type="button">操作</button> },
  { key: '3', title: '标题三', avatar: <span>头</span> },
];

describe('List', () => {
  it('renders ul/li semantics with title and description', () => {
    render(<List items={ITEMS} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-list');
    expect(screen.getByRole('list')).toHaveAttribute('data-part', 'body');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('标题一')).toHaveAttribute('data-part', 'title');
    expect(screen.getByText('描述一')).toHaveAttribute('data-part', 'description');
  });

  it('renders avatar and extra slots', () => {
    render(<List items={ITEMS} />);
    expect(screen.getByText('头').parentElement).toHaveAttribute('data-part', 'avatar');
    expect(screen.getByRole('button', { name: '操作' }).parentElement).toHaveAttribute(
      'data-part',
      'extra'
    );
  });

  it('renders header and footer', () => {
    render(<List items={ITEMS} header="列表头" footer="列表尾" />);
    expect(screen.getByText('列表头')).toHaveAttribute('data-part', 'header');
    expect(screen.getByText('列表尾')).toHaveAttribute('data-part', 'footer');
  });

  it('bordered defaults to true and can be disabled', () => {
    const { rerender } = render(<List items={ITEMS} />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-bordered', 'true');
    rerender(<List items={ITEMS} bordered={false} />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-bordered', 'false');
  });

  it('size maps to data-size (default md)', () => {
    const { rerender } = render(<List items={ITEMS} />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'md');
    rerender(<List items={ITEMS} size="sm" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'sm');
  });

  it('loading renders spinner block with aria-busy and hides items', () => {
    render(<List items={ITEMS} loading />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveAttribute('data-loading', 'true');
    const loading = screen.getByRole('status', { name: '加载中' });
    expect(loading).toHaveAttribute('data-part', 'loading');
    expect(loading.querySelector('[class*="spinner"]')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('标题一')).not.toBeInTheDocument();
  });

  it('not loading keeps list body and no spinner', () => {
    render(<List items={ITEMS} loading={false} />);
    expect(document.querySelector('[data-part="root"]')).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('empty items renders empty list body without crash', () => {
    render(<List items={[]} />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('data-part', 'body');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('passes className and classNames to slots', () => {
    render(
      <List
        items={ITEMS}
        className="my-root"
        classNames={{ root: 'c-root', item: 'c-item', meta: 'c-meta', extra: 'c-extra' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-list', 'my-root', 'c-root');
    const items = document.querySelectorAll('[data-part="item"]');
    expect(items[0]).toHaveClass('z-list-item', 'c-item');
    expect(document.querySelector('[data-part="meta"]')).toHaveClass('z-list-item-meta', 'c-meta');
    expect(document.querySelector('[data-part="extra"]')).toHaveClass('z-list-item-extra', 'c-extra');
  });
});
