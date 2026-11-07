import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TablePageBlock, type TableColumn, type TablePageRow } from '../src/table-page';

afterEach(cleanup);

const rows: TablePageRow[] = [
  { key: 'a', name: '耳机', sku: 'SKU-A' },
  { key: 'b', name: '键盘', sku: 'SKU-B' },
  { key: 'c', name: '显示器', sku: 'SKU-C' },
];
const columns: TableColumn<TablePageRow>[] = [
  { key: 'name', title: '商品', render: (row) => `商品：${row.name}` },
  { key: 'sku', title: 'SKU' },
];

describe('table-page block', () => {
  it('submits the typed keyword and reports the chosen filter field and value', async () => {
    const onSearch = vi.fn();
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TablePageBlock
        columns={columns}
        data={rows}
        onSearch={onSearch}
        onFilterChange={onFilterChange}
        filters={[
          { field: 'status', label: '商品状态', options: [{ value: 'onSale', label: '在售' }] },
        ]}
      />
    );
    await user.type(screen.getByRole('textbox', { name: '搜索名称 / SKU' }), 'SKU-A');
    expect(onSearch).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledWith('SKU-A');
    await user.click(screen.getByRole('button', { name: '商品状态' }));
    await user.click(screen.getByRole('option', { name: '在售' }));
    expect(onFilterChange).toHaveBeenCalledWith('status', 'onSale');
    // 查询和筛选由使用方回填数据，区块不会擅自删掉传入的行。
    expect(screen.getByRole('cell', { name: '商品：键盘' })).toBeInTheDocument();
  });

  it('selects individual rows, exposes the mixed state, and selects or clears all rows', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TablePageBlock
        columns={columns}
        data={rows.slice(0, 2)}
        selectable
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '选择第 1 行' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
    expect(screen.getByRole('checkbox', { name: '全选' })).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByText('已选 1 项')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b']);
    expect(screen.getByRole('checkbox', { name: '选择第 2 行' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('checkbox', { name: '选择第 1 行' })).not.toBeChecked();
    expect(screen.queryByText('已选 1 项')).not.toBeInTheDocument();
  });

  it('preserves controlled selection until the owner supplies updated keys', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TablePageBlock
        columns={columns}
        data={rows}
        selectable
        selectedKeys={['a']}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '选择第 2 行' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b']);
    expect(screen.getByRole('checkbox', { name: '选择第 2 行' })).not.toBeChecked();
    rerender(<TablePageBlock columns={columns} data={rows} selectable selectedKeys={['a', 'b']} />);
    expect(screen.getByRole('checkbox', { name: '选择第 2 行' })).toBeChecked();
    expect(screen.getByText('已选 2 项')).toBeInTheDocument();
  });

  it('preserves selections from other pages when selecting or clearing the current page', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TablePageBlock
        columns={columns}
        data={rows.slice(1)}
        selectable
        selectedKeys={['a']}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);

    rerender(
      <TablePageBlock
        columns={columns}
        data={rows.slice(1)}
        selectable
        selectedKeys={['a', 'b', 'c']}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
  });

  it('reports a requested page and renders the owner-provided page data', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TablePageBlock
        columns={columns}
        data={rows.slice(0, 2)}
        total={3}
        pageSize={2}
        page={1}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByText('共 3 条记录')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2', exact: true }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    rerender(
      <TablePageBlock columns={columns} data={rows.slice(2)} total={3} pageSize={2} page={2} />
    );
    expect(screen.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('cell', { name: '商品：显示器' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '商品：耳机' })).not.toBeInTheDocument();
  });

  it('marks loading data as busy and renders one correctly spanned empty row after loading', () => {
    const { rerender } = render(<TablePageBlock columns={columns} data={rows} loading />);
    expect(screen.getByRole('table').closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('cell', { name: '商品：耳机' })).toBeInTheDocument();
    rerender(
      <TablePageBlock
        columns={columns}
        data={[]}
        selectable
        rowActions={() => <button>编辑</button>}
      />
    );
    expect(screen.getByRole('table').closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByRole('cell', { name: '暂无数据' })).toHaveAttribute('colspan', '4');
    expect(screen.getByText('共 0 条记录')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '选择第 1 行' })).not.toBeInTheDocument();
  });
});
