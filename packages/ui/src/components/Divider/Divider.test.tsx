import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Divider } from './Divider';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Divider', () => {
  it('renders horizontal divider by default as a single line', () => {
    const { container } = render(<Divider />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-divider');
    expect(root).toHaveAttribute('data-orientation', 'horizontal');
    expect(root).not.toHaveAttribute('data-dashed');
    expect(root).not.toHaveAttribute('data-has-text');
    expect(container.querySelectorAll('[data-part="line"]')).toHaveLength(1);
  });

  it('renders text between two lines when children given', () => {
    const { container } = render(<Divider>分割文字</Divider>);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-has-text', 'true');
    const text = container.querySelector('[data-part="text"]');
    expect(text).toHaveClass('z-divider-text');
    expect(text).toHaveTextContent('分割文字');
    expect(container.querySelectorAll('[data-part="line"]')).toHaveLength(2);
  });

  it('exposes dashed via data-dashed', () => {
    const { container } = render(<Divider dashed />);
    expect(getRoot(container)).toHaveAttribute('data-dashed', 'true');
    const { container: c2 } = render(<Divider dashed>文字</Divider>);
    expect(getRoot(c2)).toHaveAttribute('data-dashed', 'true');
  });

  it('renders vertical divider and ignores children', () => {
    const { container } = render(<Divider orientation="vertical">忽略</Divider>);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-orientation', 'vertical');
    expect(root).not.toHaveAttribute('data-has-text');
    expect(container.querySelector('[data-part="text"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-part="line"]')).toHaveLength(1);
    expect(screen.queryByText('忽略')).not.toBeInTheDocument();
  });

  it('exposes orientation via data-orientation', () => {
    const { container } = render(<Divider orientation="vertical" />);
    expect(getRoot(container)).toHaveAttribute('data-orientation', 'vertical');
  });

  it('appends className on the root', () => {
    const { container } = render(<Divider className="my-divider">文字</Divider>);
    expect(getRoot(container)).toHaveClass('z-divider', 'my-divider');
  });

  it('forwards ref to the div element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Divider ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-divider');
  });

  it('passes native props through to the root element', () => {
    render(<Divider id="my-divider" data-testid="divider" aria-hidden="true" />);
    const root = screen.getByTestId('divider');
    expect(root).toHaveAttribute('id', 'my-divider');
    expect(root).toHaveAttribute('aria-hidden', 'true');
  });
});
