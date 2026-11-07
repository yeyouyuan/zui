import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Col } from './Col';
import { Row } from '../Row';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Col', () => {
  it('renders default col with z-col class and no inline span/flex state', () => {
    const { container } = render(<Col>内容</Col>);
    const root = getRoot(container);
    expect(root).toHaveClass('z-col');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).not.toHaveAttribute('data-flex');
    // 无 span：不下发内联变量（宽度走 CSS 默认 var(--z-col-span, 24)）
    expect(root.style.getPropertyValue('--z-col-span')).toBe('');
    expect(root.style.flex).toBe('');
  });

  it('sets span via inline CSS variable --z-col-span', () => {
    const { container } = render(<Col span={8} />);
    const root = getRoot(container);
    expect(root.style.getPropertyValue('--z-col-span')).toBe('8');
    expect(root).not.toHaveAttribute('data-flex');
  });

  it('sets offset via inline CSS variable --z-col-offset', () => {
    const { container } = render(<Col span={12} offset={4} />);
    const root = getRoot(container);
    expect(root.style.getPropertyValue('--z-col-span')).toBe('12');
    expect(root.style.getPropertyValue('--z-col-offset')).toBe('4');
  });

  it('flex prop overrides span (inline flex, no span variable, data-flex)', () => {
    const { container } = render(<Col span={8} flex="auto" />);
    const root = getRoot(container);
    // jsdom 将 flex: auto 归一化为 '1 1 auto'
    expect(root.style.flex).toBe('1 1 auto');
    expect(root.style.getPropertyValue('--z-col-span')).toBe('');
    expect(root).toHaveAttribute('data-flex', 'true');
  });

  it('supports numeric flex and flex=none', () => {
    const { container } = render(<Col flex={2} />);
    // CSS 规范：flex: <number> → grow=number、shrink=1、basis=0%
    expect(getRoot(container).style.flex).toBe('2 1 0%');
    const { container: c2 } = render(<Col flex="none" />);
    expect(getRoot(c2).style.flex).toBe('0 0 auto');
    const { container: c3 } = render(<Col flex="0 0 120px" />);
    expect(getRoot(c3).style.flex).toBe('0 0 120px');
  });

  it('defaults gutter padding to 0 when rendered without Row context', () => {
    const { container } = render(<Col span={8}>无 Row</Col>);
    expect(getRoot(container).style.paddingInline).toBe('');
  });

  it('receives horizontal gutter padding from Row via Context', () => {
    const { container } = render(
      <Row gutter={24}>
        <Col data-testid="col">列</Col>
      </Row>,
    );
    const col = container.querySelector('[data-testid="col"]') as HTMLElement;
    expect(col.style.paddingInline).toBe('12px');
  });

  it('appends className and classNames.root on the root element', () => {
    const { container } = render(
      <Col className="my-col" classNames={{ root: 'extra-col' }} />,
    );
    expect(getRoot(container)).toHaveClass('z-col', 'my-col', 'extra-col');
  });

  it('forwards ref and passes native props through to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(
      <Col
        ref={ref}
        id="my-col"
        data-testid="col"
        aria-label="列"
        span={6}
        style={{ color: 'var(--z-color-fg)' }}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-col');
    expect(getRoot(container)).toHaveAttribute('id', 'my-col');
    expect(getRoot(container)).toHaveAttribute('aria-label', '列');
    // 用户 style 与内联变量合并（用户值后展开）
    expect(getRoot(container).style.getPropertyValue('--z-col-span')).toBe('6');
    expect(getRoot(container).style.color).toBe('var(--z-color-fg)');
  });
});
