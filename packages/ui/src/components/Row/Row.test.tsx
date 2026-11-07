import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Col } from '../Col';
import { Row } from './Row';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Row', () => {
  it('renders default row with z-row class and default data attributes', () => {
    const { container } = render(<Row>内容</Row>);
    const root = getRoot(container);
    expect(root).toHaveClass('z-row');
    expect(root).toHaveAttribute('data-justify', 'start');
    expect(root).toHaveAttribute('data-align', 'top');
    expect(root).toHaveAttribute('data-wrap', 'true');
    // 默认无 gutter 内联样式
    expect(root.style.marginInline).toBe('');
    expect(root.style.rowGap).toBe('');
  });

  it('applies negative margin-inline on Row for horizontal gutter', () => {
    const { container } = render(<Row gutter={16} />);
    const root = getRoot(container);
    expect(root.style.marginInline).toBe('-8px');
    expect(root.style.rowGap).toBe('');
  });

  it('applies row-gap for vertical gutter via [horizontal, vertical] tuple', () => {
    const { container } = render(<Row gutter={[16, 24]} />);
    const root = getRoot(container);
    expect(root.style.marginInline).toBe('-8px');
    expect(root.style.rowGap).toBe('24px');
  });

  it('injects horizontal gutter padding into Col via React Context', () => {
    const { container } = render(
      <Row gutter={16}>
        <Col data-testid="col">列</Col>
      </Row>,
    );
    const col = container.querySelector('[data-testid="col"]') as HTMLElement;
    expect(col).toHaveClass('z-col');
    expect(col.style.paddingInline).toBe('8px');
    // 垂直 gutter 只作用于 Row 的 row-gap，Col 不产生垂直 padding
    const { container: c2 } = render(
      <Row gutter={[0, 24]}>
        <Col data-testid="col2">列</Col>
      </Row>,
    );
    const col2 = c2.querySelector('[data-testid="col2"]') as HTMLElement;
    expect(col2.style.paddingInline).toBe('');
    expect(getRoot(c2).style.rowGap).toBe('24px');
  });

  it('does not set gutter styles for zero/undefined gutter', () => {
    const { container } = render(
      <Row gutter={0}>
        <Col data-testid="col">列</Col>
      </Row>,
    );
    expect(getRoot(container).style.marginInline).toBe('');
    const col = container.querySelector('[data-testid="col"]') as HTMLElement;
    expect(col.style.paddingInline).toBe('');
  });

  it('exposes justify / align / wrap via data attributes', () => {
    const { container } = render(
      <Row justify="space-between" align="middle" wrap={false} />,
    );
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-justify', 'space-between');
    expect(root).toHaveAttribute('data-align', 'middle');
    expect(root).toHaveAttribute('data-wrap', 'false');
  });

  it('scopes gutter context per Row (inner Row overrides outer)', () => {
    const { container } = render(
      <Row gutter={16}>
        <Col data-testid="outer-col">外</Col>
        <Row gutter={8}>
          <Col data-testid="inner-col">内</Col>
        </Row>
      </Row>,
    );
    const outer = container.querySelector(
      '[data-testid="outer-col"]',
    ) as HTMLElement;
    const inner = container.querySelector(
      '[data-testid="inner-col"]',
    ) as HTMLElement;
    expect(outer.style.paddingInline).toBe('8px');
    expect(inner.style.paddingInline).toBe('4px');
  });

  it('appends className and classNames.root on the root element', () => {
    const { container } = render(
      <Row className="my-row" classNames={{ root: 'extra-row' }} />,
    );
    expect(getRoot(container)).toHaveClass('z-row', 'my-row', 'extra-row');
  });

  it('forwards ref and passes native props through to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(
      <Row
        ref={ref}
        id="my-row"
        data-testid="row"
        aria-label="栅格"
        style={{ margin: 4 }}
        gutter={16}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('z-row');
    expect(getRoot(container)).toHaveAttribute('id', 'my-row');
    expect(getRoot(container)).toHaveAttribute('aria-label', '栅格');
    // 用户 style 与 gutter 内联样式合并（用户值后展开）
    expect(getRoot(container).style.margin).toBe('4px');
    expect(getRoot(container).style.marginInline).toBe('-8px');
  });
});
