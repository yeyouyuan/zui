import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

function getLines(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-part="line"]')) as HTMLElement[];
}

describe('Skeleton', () => {
  it('renders 3 lines by default with data-lines/data-active', () => {
    const { container } = render(<Skeleton />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-skeleton');
    expect(root).toHaveAttribute('data-lines', '3');
    expect(root).toHaveAttribute('data-active', 'true');
    expect(root).not.toHaveAttribute('data-circle');
    expect(getLines(container)).toHaveLength(3);
  });

  it('marks the last line (60% width via CSS)', () => {
    const { container } = render(<Skeleton />);
    const lines = getLines(container);
    expect(lines[0]).not.toHaveAttribute('data-last');
    expect(lines[1]).not.toHaveAttribute('data-last');
    expect(lines[2]).toHaveAttribute('data-last', 'true');
    expect(lines[2]).toHaveClass('z-skeleton-line');
  });

  it('respects custom lines count', () => {
    const { container: c1 } = render(<Skeleton lines={5} />);
    expect(getLines(c1)).toHaveLength(5);
    expect(getLines(c1)[4]).toHaveAttribute('data-last', 'true');

    const { container: c2 } = render(<Skeleton lines={1} />);
    expect(getLines(c2)).toHaveLength(1);
    expect(getLines(c2)[0]).toHaveAttribute('data-last', 'true');
    expect(getRoot(c2)).toHaveAttribute('data-lines', '1');
  });

  it('clamps invalid lines to at least 1', () => {
    const { container } = render(<Skeleton lines={0} />);
    expect(getLines(container)).toHaveLength(1);
  });

  it('renders circle mode: single round line, ignores lines', () => {
    const { container } = render(<Skeleton circle lines={5} />);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-circle', 'true');
    expect(root).not.toHaveAttribute('data-lines');
    expect(getLines(container)).toHaveLength(1);
    expect(getLines(container)[0]).not.toHaveAttribute('data-last');
  });

  it('active=false omits data-active', () => {
    const { container } = render(<Skeleton active={false} />);
    expect(getRoot(container)).not.toHaveAttribute('data-active');
  });

  it('applies numeric width/height as --z-skeleton-* px values', () => {
    const { container } = render(<Skeleton width={200} height={24} />);
    const root = getRoot(container);
    expect(root.style.getPropertyValue('--z-skeleton-width')).toBe('200px');
    expect(root.style.getPropertyValue('--z-skeleton-height')).toBe('24px');
  });

  it('passes string width/height through', () => {
    const { container } = render(<Skeleton width="60%" height="2em" />);
    const root = getRoot(container);
    expect(root.style.getPropertyValue('--z-skeleton-width')).toBe('60%');
    expect(root.style.getPropertyValue('--z-skeleton-height')).toBe('2em');
  });

  it('circle with single dimension keeps a circle (both axes follow)', () => {
    const { container } = render(<Skeleton circle width={48} />);
    const root = getRoot(container);
    expect(root.style.getPropertyValue('--z-skeleton-width')).toBe('48px');
    expect(root.style.getPropertyValue('--z-skeleton-height')).toBe('48px');
  });

  it('is aria-hidden by default (decorative placeholder)', () => {
    const { container } = render(<Skeleton />);
    expect(getRoot(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('passes className and native props through to the root', () => {
    render(<Skeleton className="my-skeleton" id="my-sk" data-testid="sk" />);
    const root = screen.getByTestId('sk');
    expect(root).toHaveClass('z-skeleton', 'my-skeleton');
    expect(root).toHaveAttribute('id', 'my-sk');
  });

  it('forwards ref to the div element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-skeleton');
  });
});
