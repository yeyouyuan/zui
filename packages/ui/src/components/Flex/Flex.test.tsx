import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Flex } from './Flex';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Flex', () => {
  it('renders a div with z-flex class and default data attributes', () => {
    const { container } = render(<Flex>内容</Flex>);
    const root = getRoot(container);
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveClass('z-flex');
    expect(root).toHaveAttribute('data-vertical', 'false');
    expect(root).toHaveAttribute('data-justify', 'start');
    expect(root).toHaveAttribute('data-align', 'start');
    expect(root).toHaveAttribute('data-wrap', 'false');
    // 未给 gap 时不产生内联 gap（走 CSS 默认 --z-flex-gap）
    expect(root.style.gap).toBe('');
  });

  it('exposes vertical direction via data-vertical', () => {
    const { container } = render(<Flex vertical />);
    expect(getRoot(container)).toHaveAttribute('data-vertical', 'true');
  });

  it('maps gap sm/md/lg to --z-space-2/3/4', () => {
    const { container } = render(<Flex gap="sm" />);
    expect(getRoot(container).style.gap).toBe('var(--z-space-2)');
    const { container: c2 } = render(<Flex gap="md" />);
    expect(getRoot(c2).style.gap).toBe('var(--z-space-3)');
    const { container: c3 } = render(<Flex gap="lg" />);
    expect(getRoot(c3).style.gap).toBe('var(--z-space-4)');
  });

  it('supports numeric gap as px and string gap verbatim', () => {
    const { container } = render(<Flex gap={24} />);
    expect(getRoot(container).style.gap).toBe('24px');
    const { container: c2 } = render(<Flex gap="1rem" />);
    expect(getRoot(c2).style.gap).toBe('1rem');
  });

  it('exposes justify / align / wrap via data attributes', () => {
    const { container } = render(
      <Flex justify="space-around" align="baseline" wrap />,
    );
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-justify', 'space-around');
    expect(root).toHaveAttribute('data-align', 'baseline');
    expect(root).toHaveAttribute('data-wrap', 'true');
  });

  it('applies inline flex property', () => {
    const { container } = render(<Flex flex={1} />);
    expect(getRoot(container).style.flex).toBe('1 1 0%');
    const { container: c2 } = render(<Flex flex="none" />);
    expect(getRoot(c2).style.flex).toBe('0 0 auto');
  });

  it('renders semantic tags via component prop', () => {
    const { container } = render(
      <Flex component="ul">
        <li>一</li>
        <li>二</li>
      </Flex>,
    );
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(list).toHaveClass('z-flex');
    expect(container.querySelector('ul.z-flex')).not.toBeNull();

    const { container: c2 } = render(
      <Flex component="ol">
        <li>一</li>
      </Flex>,
    );
    expect(c2.querySelector('ol.z-flex')).not.toBeNull();

    const { container: c3 } = render(<Flex component="span">行内</Flex>);
    expect(c3.querySelector('span.z-flex')).not.toBeNull();
  });

  it('appends className and classNames.root on the root element', () => {
    const { container } = render(
      <Flex className="my-flex" classNames={{ root: 'extra-flex' }} />,
    );
    expect(getRoot(container)).toHaveClass('z-flex', 'my-flex', 'extra-flex');
  });

  it('forwards ref and passes native props through to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(
      <Flex
        ref={ref}
        id="my-flex"
        data-testid="flex"
        aria-label="工具栏"
        gap="md"
        vertical
        style={{ padding: '4px' }}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-flex');
    expect(getRoot(container)).toHaveAttribute('id', 'my-flex');
    expect(getRoot(container)).toHaveAttribute('aria-label', '工具栏');
    // 用户 style 与 gap/方向内联样式合并（用户值后展开）
    expect(getRoot(container).style.padding).toBe('4px');
    expect(getRoot(container).style.gap).toBe('var(--z-space-3)');
    expect(getRoot(container)).toHaveAttribute('data-vertical', 'true');
  });
});
