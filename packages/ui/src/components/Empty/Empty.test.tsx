import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Empty } from './Empty';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Empty', () => {
  it('renders default description and built-in SVG image', () => {
    const { container } = render(<Empty />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
    const image = container.querySelector('[data-part="image"]');
    expect(image).toHaveClass('z-empty-image');
    // 内置插图：灰调两个矩形 + 圆
    const svg = image?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll('rect')).toHaveLength(2);
    expect(svg?.querySelectorAll('circle')).toHaveLength(1);
  });

  it('renders root with data-part structure', () => {
    const { container } = render(<Empty />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-empty');
    expect(root).toHaveAttribute('data-part', 'root');
    const description = container.querySelector('[data-part="description"]');
    expect(description).toHaveClass('z-empty-description');
  });

  it('renders custom description', () => {
    render(<Empty description="自定义文案" />);
    expect(screen.getByText('自定义文案')).toBeInTheDocument();
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });

  it('renders custom image node', () => {
    const { container } = render(<Empty image={<i data-testid="custom-img">图</i>} />);
    expect(screen.getByTestId('custom-img')).toBeInTheDocument();
    expect(container.querySelector('[data-part="image"] svg')).not.toBeInTheDocument();
  });

  it('renders children as actions area', () => {
    const { container } = render(
      <Empty>
        <button>去添加</button>
      </Empty>
    );
    const actions = container.querySelector('[data-part="actions"]');
    expect(actions).toHaveClass('z-empty-actions');
    expect(actions).toContainElement(screen.getByRole('button', { name: '去添加' }));
  });

  it('omits actions area when no children', () => {
    const { container } = render(<Empty />);
    expect(container.querySelector('[data-part="actions"]')).not.toBeInTheDocument();
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Empty
        className="my-root"
        classNames={{ root: 'cls-root', image: 'cls-image', description: 'cls-description' }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-empty', 'my-root', 'cls-root');
    expect(container.querySelector('[data-part="image"]')).toHaveClass('z-empty-image', 'cls-image');
    expect(container.querySelector('[data-part="description"]')).toHaveClass(
      'z-empty-description',
      'cls-description'
    );
  });

  it('forwards ref to the div element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Empty ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-empty');
  });

  it('passes native props through to the root element', () => {
    render(<Empty id="my-empty" data-testid="empty" aria-label="空状态" />);
    const root = screen.getByTestId('empty');
    expect(root).toHaveAttribute('id', 'my-empty');
    expect(root).toHaveAttribute('aria-label', '空状态');
  });
});
