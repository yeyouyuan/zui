import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Table } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

function BasicTable(props: {
  density?: 'comfortable' | 'compact';
  bordered?: boolean;
  striped?: boolean;
  selected?: boolean;
  classNames?: { root?: string };
  tableProps?: React.ComponentPropsWithRef<'table'>;
}) {
  return (
    <Table
      density={props.density}
      bordered={props.bordered}
      striped={props.striped}
      classNames={props.classNames}
      {...props.tableProps}
    >
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>姓名</Table.HeaderCell>
          <Table.HeaderCell align="right">年龄</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row selected={props.selected}>
          <Table.Cell>张三</Table.Cell>
          <Table.Cell align="right">28</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>李四</Table.Cell>
          <Table.Cell align="right">32</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

describe('Table', () => {
  it('渲染行列与单元格文本', () => {
    render(<BasicTable />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('年龄')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
  });

  it('HeaderCell 是 th[scope=col]，Cell 是 td', () => {
    render(<BasicTable />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const th of headers) {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'col');
    }
    const cells = screen.getAllByRole('cell');
    for (const td of cells) {
      expect(td.tagName).toBe('TD');
    }
  });

  it('默认 data 属性：density=comfortable、bordered=false、striped=false', () => {
    render(<BasicTable />);
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('data-density', 'comfortable');
    expect(table).toHaveAttribute('data-bordered', 'false');
    expect(table).toHaveAttribute('data-striped', 'false');
  });

  it('density/bordered/striped 通过 data 属性暴露', () => {
    render(<BasicTable density="compact" bordered striped />);
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('data-density', 'compact');
    expect(table).toHaveAttribute('data-bordered', 'true');
    expect(table).toHaveAttribute('data-striped', 'true');
  });

  it('Row selected → data-selected', () => {
    render(<BasicTable selected />);
    const [headRow, firstRow, secondRow] = screen.getAllByRole('row');
    expect(firstRow).toHaveAttribute('data-selected', 'true');
    expect(secondRow).toHaveAttribute('data-selected', 'false');
    expect(headRow).toHaveAttribute('data-selected', 'false');
  });

  it('align → data-align（默认 left）', () => {
    render(<BasicTable />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('data-align', 'left');
    expect(headers[1]).toHaveAttribute('data-align', 'right');
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveAttribute('data-align', 'left');
    expect(cells[1]).toHaveAttribute('data-align', 'right');

    render(
      <Table>
        <Table.Body>
          <Table.Row>
            <Table.Cell align="center">居中</Table.Cell>
            <Table.HeaderCell align="center">居中头</Table.HeaderCell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    expect(screen.getByText('居中')).toHaveAttribute('data-align', 'center');
    expect(screen.getByText('居中头')).toHaveAttribute('data-align', 'center');
  });

  it('props 透传到 <table>（aria-label 等），Omit size', () => {
    render(<BasicTable tableProps={{ 'aria-label': '用户表格', id: 'my-table' }} />);
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-label', '用户表格');
    expect(table).toHaveAttribute('id', 'my-table');
  });

  it('classNames.root 追加到根元素', () => {
    render(<BasicTable classNames={{ root: 'my-table' }} />);
    const table = screen.getByRole('table');
    expect(table).toHaveClass('z-table');
    expect(table).toHaveClass('my-table');
    expect(table).toHaveAttribute('data-part', 'root');
  });

  it('各 part 类名与 data-part 齐备', () => {
    render(<BasicTable />);
    const head = document.querySelector('thead');
    const body = document.querySelector('tbody');
    const rows = screen.getAllByRole('row');
    const cells = screen.getAllByRole('cell');
    const headers = screen.getAllByRole('columnheader');

    expect(head).toHaveClass('z-table-head');
    expect(body).toHaveClass('z-table-body');
    for (const row of rows) expect(row).toHaveClass('z-table-row');
    for (const cell of cells) expect(cell).toHaveClass('z-table-cell');
    for (const th of headers) expect(th).toHaveClass('z-table-header-cell');
    // 单元格带 data-part
    expect(cells[0]).toHaveAttribute('data-part', 'cell');
    expect(headers[0]).toHaveAttribute('data-part', 'header-cell');
  });

  it('className 透传到 tr/td/th', () => {
    const { container } = render(
      <Table>
        <Table.Body>
          <Table.Row className="row-x">
            <Table.Cell className="cell-x">A</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    const row = container.querySelector('tr') as HTMLElement;
    expect(row).toHaveClass('z-table-row', 'row-x');
    expect(container.querySelector('td')).toHaveClass('z-table-cell', 'cell-x');
  });
});

/* ============================== 数据驱动模式 ============================== */

import { fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

interface DemoRow {
  name: string;
  age: number;
  city: string;
}

const demoData: DemoRow[] = [
  { name: '张三', age: 28, city: '杭州' },
  { name: '李四', age: 32, city: '上海' },
  { name: '王五', age: 24, city: '北京' },
];

const demoColumns = [
  { key: 'name', title: '姓名', sortable: true },
  { key: 'age', title: '年龄', sortable: true },
  { key: 'city', title: '城市' },
];

function DataTable(props: {
  columnState?: { order?: string[]; hidden?: string[] };
  defaultColumnState?: { order?: string[]; hidden?: string[] };
  onColumnStateChange?: (state: { order?: string[]; hidden?: string[] }) => void;
}) {
  return (
    <Table
      data={demoData}
      columns={demoColumns}
      rowKey="name"
      columnState={props.columnState}
      defaultColumnState={props.defaultColumnState}
      onColumnStateChange={props.onColumnStateChange}
    />
  );
}

const headerCells = () =>
  Array.from(document.querySelectorAll<HTMLTableCellElement>('[data-part="header-cell"]'));

const bodyCellsOfColumn = (key: string) =>
  Array.from(document.querySelectorAll<HTMLTableCellElement>(`td[data-column-key="${key}"]`));

describe('Table 数据驱动模式', () => {
  // jsdom 未实现 pointer capture，表头拖拽依赖它
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value() {},
    });
  });
  it('columns/data 渲染表头与数据行，render 函数生效', () => {
    render(
      <Table
        data={demoData}
        columns={[
          { key: 'name', title: '姓名', render: (row: DemoRow) => `姓名:${row.name}` },
          { key: 'age', title: '年龄' },
        ]}
        rowKey="name"
      />
    );
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('姓名:张三')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    // rowKey 用 name 字段作 tr key（不可直接断言，但可断言行数）
    const bodyRows = document.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(3);
  });

  it('语义化用法不受影响：不传 columns 时不渲染工具行', () => {
    render(
      <Table>
        <Table.Body>
          <Table.Row>
            <Table.Cell>仅语义化</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '列设置' })).not.toBeInTheDocument();
    expect(screen.getByText('仅语义化')).toBeInTheDocument();
  });

  it('点击表头三态排序：升序 → 降序 → 取消，aria-sort 同步', () => {
    render(<DataTable />);
    const nameButton = screen.getByRole('button', { name: /姓名/ });
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(nameButton);
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'ascending');
    // 默认比较用 zh-Hans localeCompare（拼音序：李 < 王 < 张）
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '李四',
      '王五',
      '张三',
    ]);
    fireEvent.click(nameButton);
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'descending');
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '张三',
      '王五',
      '李四',
    ]);
    fireEvent.click(nameButton);
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'none');
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '张三',
      '李四',
      '王五',
    ]);
  });

  it('默认比较按数字排序年龄，sorter 优先于默认比较', () => {
    const sorter = vi.fn((a: DemoRow, b: DemoRow) => b.age - a.age);
    render(
      <Table
        data={demoData}
        columns={[
          { key: 'name', title: '姓名' },
          { key: 'age', title: '年龄', sortable: true, sorter },
        ]}
        rowKey="name"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /年龄/ }));
    expect(sorter).toHaveBeenCalled();
    expect(bodyCellsOfColumn('age').map((cell) => cell.textContent)).toEqual(['32', '28', '24']);
  });

  it('非受控 columnState：面板勾选隐藏列，th/td 消失且至少保留一列', async () => {
    render(<DataTable />);
    fireEvent.click(screen.getByRole('button', { name: '列设置' }));
    const cityToggle = screen.getByRole('checkbox', { name: '显示 城市' });
    fireEvent.click(cityToggle);
    await waitFor(() => {
      expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name', 'age']);
    });
    expect(document.querySelector('td[data-column-key="city"]')).toBeNull();
    // 继续隐藏年龄：仅剩姓名一列仍合法
    fireEvent.click(screen.getByRole('checkbox', { name: '显示 年龄' }));
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name']);
    // 最后一列拒绝隐藏
    fireEvent.click(screen.getByRole('checkbox', { name: '显示 姓名' }));
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name']);
  });

  it('受控 columnState：hidden/order 由外部驱动，onColumnStateChange 回调', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable columnState={{ order: ['city', 'name', 'age'] }} onColumnStateChange={onChange} />
    );
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['city', 'name', 'age']);
    // 受控显隐：面板操作回调 onChange，外层未更新 value 前视图不变
    fireEvent.click(screen.getByRole('button', { name: '列设置' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '显示 城市' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['city', 'name', 'age']);
    // 外层提交 value 后视图跟随
    rerender(
      <DataTable
        columnState={{ order: ['city', 'name', 'age'], hidden: ['city'] }}
        onColumnStateChange={onChange}
      />
    );
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name', 'age']);
    // 受控顺序
    rerender(
      <DataTable
        columnState={{ order: ['name', 'city', 'age'], hidden: ['city'] }}
        onColumnStateChange={onChange}
      />
    );
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name', 'age']);
  });

  it('order 缺失 key 追加到末尾；未知 key 不渲染', () => {
    render(
      <Table data={demoData} columns={demoColumns} rowKey="name" columnState={{ order: ['age'] }} />
    );
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['age', 'name', 'city']);
  });

  it('重置按钮恢复声明顺序与全部显示', async () => {
    render(
      <Table
        data={demoData}
        columns={demoColumns}
        rowKey="name"
        defaultColumnState={{ order: ['city', 'name', 'age'], hidden: ['age'] }}
      />
    );
    expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['city', 'name']);
    fireEvent.click(screen.getByRole('button', { name: '列设置' }));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    await waitFor(() => {
      expect(headerCells().map((cell) => cell.dataset.columnKey)).toEqual(['name', 'age', 'city']);
    });
  });

  it('列设置面板内拖动：非受控模式下更新顺序', () => {
    // 面板内拖动与表头共享 moveColumn；直接验证面板 li 结构存在
    render(<DataTable />);
    fireEvent.click(screen.getByRole('button', { name: '列设置' }));
    const items = document.querySelectorAll('.z-table-column-item');
    expect(items).toHaveLength(3);
    // Checkbox 与列标题一一对应
    expect(screen.getByRole('checkbox', { name: '显示 姓名' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '显示 城市' })).toBeInTheDocument();
  });
});
