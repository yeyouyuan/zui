import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Space } from './Space';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Space', () => {
  it('renders default space with z-space class and default gap (md = --z-space-2)', () => {
    const { container } = render(
      <Space>
        <span>一</span>
        <span>二</span>
      </Space>,
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-space');
    expect(root).toHaveAttribute('data-direction', 'horizontal');
    expect(root).toHaveAttribute('data-align', 'start');
    expect(root).toHaveAttribute('data-wrap', 'false');
    // 默认 md → 8px → --z-space-2
    expect(root.style.gap).toBe('var(--z-space-2)');
  });

  it('maps size sm/md/lg to --z-space-1/2/3', () => {
    const { container } = render(<Space size="sm" />);
    expect(getRoot(container).style.gap).toBe('var(--z-space-1)');
    const { container: c2 } = render(<Space size="md" />);
    expect(getRoot(c2).style.gap).toBe('var(--z-space-2)');
    const { container: c3 } = render(<Space size="lg" />);
    expect(getRoot(c3).style.gap).toBe('var(--z-space-3)');
  });

  it('supports numeric size as px', () => {
    const { container } = render(<Space size={24} />);
    expect(getRoot(container).style.gap).toBe('24px');
    const { container: c2 } = render(<Space size={0} />);
    expect(getRoot(c2).style.gap).toBe('0px');
  });

  it('exposes direction via data-direction and applies column stacking', () => {
    const { container } = render(
      <Space direction="vertical">
        <span>一</span>
        <span>二</span>
      </Space>,
    );
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-direction', 'vertical');
    expect(root.style.flexDirection).toBe('');
    // 方向由 CSS（data-direction 选择器）实现，jsdom 不做级联计算，仅断言属性暴露
    expect(container.querySelectorAll('[data-part="root"]')).toHaveLength(1);
  });

  it('exposes wrap via data-wrap', () => {
    const { container } = render(<Space wrap />);
    expect(getRoot(container)).toHaveAttribute('data-wrap', 'true');
    const { container: c2 } = render(<Space wrap={false} />);
    expect(getRoot(c2)).toHaveAttribute('data-wrap', 'false');
  });

  it('exposes align via data-align', () => {
    const { container } = render(
      <Space align="baseline">
        <strong>粗</strong>
        <span>细</span>
      </Space>,
    );
    expect(getRoot(container)).toHaveAttribute('data-align', 'baseline');
    const { container: c2 } = render(<Space align="center" />);
    expect(getRoot(c2)).toHaveAttribute('data-align', 'center');
  });

  it('appends className and classNames.root on the root element', () => {
    const { container } = render(
      <Space className="my-space" classNames={{ root: 'extra-space' }} />,
    );
    expect(getRoot(container)).toHaveClass('z-space', 'my-space', 'extra-space');
  });

  it('forwards ref and passes native props through to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(
      <Space
        ref={ref}
        id="my-space"
        data-testid="space"
        aria-label="操作组"
        size={16}
        style={{ padding: '2px' }}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-space');
    expect(getRoot(container)).toHaveAttribute('id', 'my-space');
    expect(getRoot(container)).toHaveAttribute('aria-label', '操作组');
    // 用户 style 与 size 内联 gap 合并（用户值后展开）
    expect(getRoot(container).style.padding).toBe('2px');
    expect(getRoot(container).style.gap).toBe('16px');
  });
});
