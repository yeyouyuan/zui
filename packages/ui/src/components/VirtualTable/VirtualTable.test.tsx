import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtualTable } from './VirtualTable';
import type { VirtualTableColumn } from './VirtualTable';

afterEach(cleanup);

interface Row {
  id: number;
  name: string;
  age: number;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `名称${i + 1}`, age: 20 + (i % 30) }));
}

const COLUMNS: Array<VirtualTableColumn<Row>> = [
  { key: 'id', title: 'ID', width: 100 },
  { key: 'name', title: '名称', width: 160 },
  { key: 'age', title: '年龄', width: 120 },
];

/** 等一帧 rAF 合帧完成（滚动状态提交） */
async function flushFrame(ms = 60): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function getBodyRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-part="row"]'));
}

describe('VirtualTable', () => {
  it('renders root with data-part/role=fixed height and header', () => {
    render(<VirtualTable data={makeRows(3)} columns={COLUMNS} height={400} />);
    const root = screen.getByRole('table');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveClass('z-virtual-table');
    expect(root).toHaveStyle({ height: '400px' });
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('renders default cell values from row fields', () => {
    render(<VirtualTable data={makeRows(2)} columns={COLUMNS} height={400} />);
    expect(screen.getByText('名称1')).toBeInTheDocument();
    expect(screen.getByText('名称2')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('uses column render function when provided', () => {
    const columns: Array<VirtualTableColumn<Row>> = [
      { key: 'id', title: 'ID', render: (row) => `#${row.id}` },
    ];
    render(<VirtualTable data={makeRows(2)} columns={columns} height={400} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('exposes header/body/row/cell data-parts', () => {
    const { container } = render(<VirtualTable data={makeRows(1)} columns={COLUMNS} height={400} />);
    expect(container.querySelector('[data-part="header"]')).not.toBeNull();
    expect(container.querySelector('[data-part="body"]')).not.toBeNull();
    expect(container.querySelector('[data-part="row"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-part="cell"]').length).toBeGreaterThan(0);
  });

  it('sets aria-rowindex on rows starting from 2 and aria-rowcount on root', () => {
    const { container } = render(<VirtualTable data={makeRows(10)} columns={COLUMNS} height={400} />);
    const rows = getBodyRows(container);
    expect(rows[0]).toHaveAttribute('aria-rowindex', '2');
    expect(rows[1]).toHaveAttribute('aria-rowindex', '3');
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '11');
  });

  /* ------------------------- 10000 行压测（差异化重点） ------------------------- */

  it('10000 rows: renders at most 30 DOM rows (virtualized window)', () => {
    const t0 = performance.now();
    const { container } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} />
    );
    const elapsed = performance.now() - t0;
    const rows = getBodyRows(container);
    console.log(`[VirtualTable 压测] 10000 行渲染耗时 ${elapsed.toFixed(1)}ms，DOM 行数 ${rows.length}`);
    expect(rows.length).toBeLessThanOrEqual(30);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('10000 rows: first window contains the head rows and excludes the tail', () => {
    const { container } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} />
    );
    const rows = getBodyRows(container);
    expect(rows[0]).toHaveAttribute('aria-rowindex', '2'); // 第 0 行数据
    expect(screen.queryByText('名称10000')).not.toBeInTheDocument();
    expect(screen.getByText('名称1')).toBeInTheDocument();
  });

  it('10000 rows: scroll moves the window via rAF and keeps DOM rows <= 30', async () => {
    const { container } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} />
    );
    const root = screen.getByRole('table');
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 48000 });
    fireEvent.scroll(root);
    await flushFrame();

    const rows = getBodyRows(container);
    expect(rows.length).toBeLessThanOrEqual(30);
    const first = Number(rows[0]?.getAttribute('aria-rowindex'));
    // scrollTop 48000 / 48 = 1000 起始行 - overscan 5 → aria-rowindex 997
    expect(first).toBe(997);
    expect(screen.getByText('名称1000')).toBeInTheDocument();
  });

  it('overscan controls the extra rows outside the viewport', () => {
    const { container: c1 } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} overscan={0} />
    );
    const withoutOverscan = getBodyRows(c1).length;
    cleanup();
    const { container: c2 } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} overscan={5} />
    );
    const withOverscan = getBodyRows(c2).length;
    expect(withOverscan).toBeGreaterThan(withoutOverscan);
    expect(withOverscan).toBeLessThanOrEqual(30);
  });

  /* ------------------------------- 交互与定制 ------------------------------- */

  it('fires onRowClick with the row data', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <VirtualTable data={makeRows(3)} columns={COLUMNS} height={400} onRowClick={onRowClick} />
    );
    await user.click(screen.getByText('名称2'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ id: 2, name: '名称2' });
  });

  it('fixed left column cells are sticky with cumulative offsets', () => {
    const columns: Array<VirtualTableColumn<Row>> = [
      { key: 'id', title: 'ID', width: 100, fixed: 'left' },
      { key: 'name', title: '名称', width: 80, fixed: 'left' },
      { key: 'age', title: '年龄', width: 120 },
    ];
    render(<VirtualTable data={makeRows(2)} columns={columns} height={400} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('data-fixed', 'left');
    expect(headers[0]).toHaveStyle({ left: '0px' });
    expect(headers[1]).toHaveAttribute('data-fixed', 'left');
    expect(headers[1]).toHaveStyle({ left: '100px' });
    expect(headers[2]).not.toHaveAttribute('data-fixed');
  });

  it('fixed right column cells get sticky right offsets', () => {
    const columns: Array<VirtualTableColumn<Row>> = [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'name', title: '名称', width: 80, fixed: 'right' },
      { key: 'age', title: '年龄', width: 120, fixed: 'right' },
    ];
    render(<VirtualTable data={makeRows(2)} columns={columns} height={400} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[1]).toHaveAttribute('data-fixed', 'right');
    expect(headers[1]).toHaveStyle({ right: '120px' });
    expect(headers[2]).toHaveAttribute('data-fixed', 'right');
    expect(headers[2]).toHaveStyle({ right: '0px' });
  });

  it('default column width is 120px when width is omitted', () => {
    const columns: Array<VirtualTableColumn<Row>> = [{ key: 'id', title: 'ID' }];
    render(<VirtualTable data={makeRows(1)} columns={columns} height={400} />);
    expect(screen.getByRole('columnheader')).toHaveStyle({ width: '120px' });
  });

  it('rowHeight is applied to each row', () => {
    const { container } = render(
      <VirtualTable data={makeRows(3)} columns={COLUMNS} height={400} rowHeight={32} />
    );
    for (const row of getBodyRows(container)) {
      expect(row).toHaveStyle({ height: '32px' });
    }
  });

  it('merges classNames into parts and className into root', () => {
    const { container } = render(
      <VirtualTable
        data={makeRows(2)}
        columns={COLUMNS}
        height={400}
        className="my-table"
        classNames={{ root: 'r', header: 'h', body: 'b', row: 'rw', cell: 'c' }}
      />
    );
    const root = screen.getByRole('table');
    expect(root).toHaveClass('my-table');
    expect(root).toHaveClass('r');
    expect(container.querySelector('[data-part="header"]')).toHaveClass('h');
    expect(container.querySelector('[data-part="body"]')).toHaveClass('b');
    expect(container.querySelector('[data-part="row"]')).toHaveClass('rw');
    expect(container.querySelector('[data-part="cell"]')).toHaveClass('c');
  });

  it('renders zero rows for empty data', () => {
    const { container } = render(<VirtualTable data={[]} columns={COLUMNS} height={400} />);
    expect(getBodyRows(container)).toHaveLength(0);
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '1');
  });

  it('renders all rows when data fits the viewport', () => {
    const { container } = render(<VirtualTable data={makeRows(5)} columns={COLUMNS} height={480} />);
    expect(getBodyRows(container)).toHaveLength(5);
  });

  it('body height equals total rows height for scrollbar sizing', () => {
    const { container } = render(
      <VirtualTable data={makeRows(10000)} columns={COLUMNS} height={480} rowHeight={48} />
    );
    const body = container.querySelector<HTMLElement>('[data-part="body"]');
    expect(body).toHaveStyle({ height: `${10000 * 48}px` });
  });

  it('cancels the pending rAF frame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const { unmount } = render(<VirtualTable data={makeRows(100)} columns={COLUMNS} height={400} />);
    const root = screen.getByRole('table');
    Object.defineProperty(root, 'scrollTop', { configurable: true, value: 200 });
    fireEvent.scroll(root);
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
