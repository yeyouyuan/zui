import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Table, type TableSortState } from './index';

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
  label?: string;
  columnState?: { order?: string[]; hidden?: string[] };
  defaultColumnState?: { order?: string[]; hidden?: string[] };
  onColumnStateChange?: (state: { order?: string[]; hidden?: string[] }) => void;
  sortState?: TableSortState | null;
  defaultSortState?: TableSortState | null;
  onSortStateChange?: (state: TableSortState | null) => void;
  sortMode?: 'client' | 'manual';
}) {
  return (
    <Table
      aria-label={props.label ?? '人员表格'}
      data={demoData}
      columns={demoColumns}
      rowKey="name"
      columnState={props.columnState}
      defaultColumnState={props.defaultColumnState}
      onColumnStateChange={props.onColumnStateChange}
      sortState={props.sortState}
      defaultSortState={props.defaultSortState}
      onSortStateChange={props.onSortStateChange}
      sortMode={props.sortMode}
    />
  );
}

const tableByLabel = (label = '人员表格') => screen.getByRole('table', { name: label });

function headerCells(table: HTMLElement = tableByLabel()): HTMLTableCellElement[] {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>('[data-part="header-cell"]'));
}

function headerKeys(table: HTMLElement = tableByLabel()): (string | undefined)[] {
  return headerCells(table).map((cell) => cell.dataset.columnKey);
}

function bodyCellsOfColumn(
  key: string,
  table: HTMLElement = tableByLabel()
): HTMLTableCellElement[] {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>(`td[data-column-key="${key}"]`));
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {},
  } as DOMRect;
}

function setColumnRects(table: HTMLElement, top = 0) {
  headerCells(table).forEach((cell, index) => {
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(rect(index * 100, top, 100, 40));
  });
}

function setPanelRects() {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.z-table-column-item'));
  items.forEach((item, index) => {
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(rect(0, index * 44, 320, 40));
  });
}

function pointer(
  target: HTMLElement | Window | Document,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: Record<string, unknown> = {}
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const payload = {
    pointerId: 7,
    button: 0,
    isPrimary: true,
    clientX: 20,
    clientY: 20,
    ...init,
  };
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, { configurable: true, value }])
    )
  );
  fireEvent(target, event);
}

async function openSortMenu(column: string, current = '未排序') {
  fireEvent.click(screen.getByRole('button', { name: `${column}排序，当前${current}` }));
  await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
}

async function openColumnManager(buttonName = /字段 3\/3/) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: '字段管理' })).toBeInTheDocument());
  return screen.getByRole('dialog', { name: '字段管理' });
}

describe('Table 数据驱动模式', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value() {},
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value() {},
    });
  });

  it('columns/data 渲染表头与数据行，render 接收显示序号与原始序号', () => {
    const renderCell = vi.fn(
      (row: DemoRow, index: number, sourceIndex: number) => `${index}/${sourceIndex}:${row.name}`
    );
    render(
      <Table
        aria-label="自定义表格"
        data={demoData}
        columns={[
          { key: 'name', title: '姓名', sortable: true, render: renderCell },
          { key: 'age', title: '年龄' },
        ]}
        rowKey="name"
        defaultSortState={{ key: 'name', order: 'ascend' }}
      />
    );
    expect(screen.getByRole('table', { name: '自定义表格' })).toBeInTheDocument();
    expect(screen.getByText('0/1:李四')).toBeInTheDocument();
    expect(renderCell).toHaveBeenCalledWith(demoData[1], 0, 1);
  });

  it('语义化用法不受影响：不传 columns 时不渲染数据工具栏', () => {
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
    expect(screen.queryByText('数据排序')).not.toBeInTheDocument();
    expect(screen.getByText('仅语义化')).toBeInTheDocument();
  });

  it('显式菜单执行升序、降序与清除；只有活动 th 有 aria-sort', async () => {
    render(<DataTable />);
    expect(headerCells().every((cell) => !cell.hasAttribute('aria-sort'))).toBe(true);

    await openSortMenu('姓名');
    fireEvent.click(screen.getByRole('menuitem', { name: /升序排列/ }));
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'ascending');
    expect(headerCells()[1]).not.toHaveAttribute('aria-sort');
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '李四',
      '王五',
      '张三',
    ]);
    expect(screen.getByText('姓名 · 升序')).toBeInTheDocument();

    await openSortMenu('姓名', '升序');
    fireEvent.click(screen.getByRole('menuitem', { name: /降序排列/ }));
    expect(headerCells()[0]).toHaveAttribute('aria-sort', 'descending');
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '张三',
      '王五',
      '李四',
    ]);

    await openSortMenu('姓名', '降序');
    fireEvent.click(screen.getByRole('menuitem', { name: '清除排序' }));
    expect(headerCells()[0]).not.toHaveAttribute('aria-sort');
    expect(bodyCellsOfColumn('name').map((cell) => cell.textContent)).toEqual([
      '张三',
      '李四',
      '王五',
    ]);
  });

  it('排序摘要关闭按钮清除排序且受控模式不产生假状态', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable sortState={{ key: 'age', order: 'descend' }} onSortStateChange={onChange} />
    );
    expect(screen.getByText('年龄 · 降序')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除年龄排序' }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByText('年龄 · 降序')).toBeInTheDocument();
    rerender(<DataTable sortState={null} onSortStateChange={onChange} />);
    expect(screen.getByText('未排序')).toBeInTheDocument();
  });

  it('manual 排序只回调状态，不重排 data', async () => {
    const onChange = vi.fn();
    render(<DataTable sortMode="manual" onSortStateChange={onChange} />);
    await openSortMenu('年龄');
    fireEvent.click(screen.getByRole('menuitem', { name: /升序排列/ }));
    expect(onChange).toHaveBeenCalledWith({ key: 'age', order: 'ascend' });
    expect(bodyCellsOfColumn('age').map((cell) => cell.textContent)).toEqual(['28', '32', '24']);
  });

  it('自定义 sorter 优先；默认数字比较正确', async () => {
    const sorter = vi.fn((a: DemoRow, b: DemoRow) => b.age - a.age);
    render(
      <Table
        aria-label="排序表格"
        data={demoData}
        columns={[
          { key: 'name', title: '姓名' },
          { key: 'age', title: '年龄', sortable: true, sorter },
        ]}
        rowKey="name"
      />
    );
    await openSortMenu('年龄');
    fireEvent.click(screen.getByRole('menuitem', { name: /升序排列/ }));
    expect(sorter).toHaveBeenCalled();
    expect(
      bodyCellsOfColumn('age', screen.getByRole('table', { name: '排序表格' })).map(
        (cell) => cell.textContent
      )
    ).toEqual(['32', '28', '24']);
  });

  it('专用表头手柄真实拖拽，按 before/after 精确换列并播报', async () => {
    render(<DataTable />);
    const table = tableByLabel();
    setColumnRects(table);
    const handle = screen.getByRole('button', { name: '移动 姓名 列' });
    pointer(handle, 'pointerdown', { clientX: 20, clientY: 20 });
    pointer(window, 'pointermove', { clientX: 275, clientY: 20 });
    pointer(window, 'pointerup', { clientX: 275, clientY: 20 });
    await waitFor(() => expect(headerKeys()).toEqual(['age', 'city', 'name']));
    expect(screen.getByRole('status')).toHaveTextContent('姓名已移动到第 3 列');
  });

  it('小于阈值、pointercancel 与 Escape 均不误提交', () => {
    render(<DataTable />);
    const table = tableByLabel();
    setColumnRects(table);
    const handle = screen.getByRole('button', { name: '移动 姓名 列' });

    pointer(handle, 'pointerdown', { clientX: 20 });
    pointer(window, 'pointermove', { clientX: 24 });
    pointer(window, 'pointerup', { clientX: 24 });
    expect(headerKeys()).toEqual(['name', 'age', 'city']);

    pointer(handle, 'pointerdown', { clientX: 20 });
    pointer(window, 'pointermove', { clientX: 275 });
    pointer(window, 'pointercancel', { clientX: 275 });
    expect(headerKeys()).toEqual(['name', 'age', 'city']);

    pointer(handle, 'pointerdown', { clientX: 20 });
    pointer(window, 'pointermove', { clientX: 275 });
    fireEvent.keyDown(document, { key: 'Escape' });
    pointer(window, 'pointerup', { clientX: 275 });
    expect(headerKeys()).toEqual(['name', 'age', 'city']);
  });

  it('两个 Table 的拖拽命中互不干扰', async () => {
    render(
      <>
        <DataTable label="第一个表格" />
        <DataTable label="第二个表格" />
      </>
    );
    const first = tableByLabel('第一个表格');
    const second = tableByLabel('第二个表格');
    setColumnRects(first, 0);
    setColumnRects(second, 100);
    const handle = within(first.closest('.z-table-data-wrap')!).getByRole('button', {
      name: '移动 姓名 列',
    });
    pointer(handle, 'pointerdown', { clientX: 20, clientY: 20 });
    pointer(window, 'pointermove', { clientX: 275, clientY: 20 });
    pointer(window, 'pointerup', { clientX: 275, clientY: 20 });
    await waitFor(() => expect(headerKeys(first)).toEqual(['age', 'city', 'name']));
    expect(headerKeys(second)).toEqual(['name', 'age', 'city']);
  });

  it('Alt+方向/Home/End 提供非拖拽移动并保持可访问播报', () => {
    render(<DataTable />);
    const handle = screen.getByRole('button', { name: '移动 姓名 列' });
    fireEvent.keyDown(handle, { key: 'ArrowRight', altKey: true });
    expect(headerKeys()).toEqual(['age', 'name', 'city']);
    fireEvent.keyDown(handle, { key: 'End', altKey: true });
    expect(headerKeys()).toEqual(['age', 'city', 'name']);
    expect(screen.getByRole('status')).toHaveTextContent('姓名已移动到第 3 列');
  });

  it('字段管理：搜索、可见计数、显隐、最后一列禁用与恢复默认', async () => {
    render(<DataTable defaultColumnState={{ order: ['city', 'name', 'age'] }} />);
    const dialog = await openColumnManager();
    expect(dialog).toHaveAccessibleDescription('3 / 3 个字段可见');

    fireEvent.change(within(dialog).getByRole('textbox', { name: '搜索字段' }), {
      target: { value: '城' },
    });
    expect(within(dialog).getByText('城市')).toBeInTheDocument();
    expect(within(dialog).queryByText('姓名')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '清除' }));

    fireEvent.click(within(dialog).getByRole('checkbox', { name: '显示 城市' }));
    expect(headerKeys()).toEqual(['name', 'age']);
    expect(screen.getByRole('button', { name: /字段 2\/3/ })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '显示 年龄' }));
    expect(headerKeys()).toEqual(['name']);
    expect(within(dialog).getByRole('checkbox', { name: '显示 姓名' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: '恢复默认字段' }));
    expect(headerKeys()).toEqual(['name', 'age', 'city']);
  });

  it('字段管理：显示全部 indeterminate、上下移按钮和面板真实拖拽', async () => {
    render(<DataTable defaultColumnState={{ hidden: ['city'] }} />);
    const dialog = await openColumnManager(/字段 2\/3/);
    const showAll = within(dialog).getByRole('checkbox', { name: '显示全部字段' });
    expect(showAll).toHaveProperty('indeterminate', true);
    fireEvent.click(showAll);
    expect(headerKeys()).toEqual(['name', 'age', 'city']);

    fireEvent.click(within(dialog).getByRole('button', { name: '下移 姓名 字段' }));
    expect(headerKeys()).toEqual(['age', 'name', 'city']);

    setPanelRects();
    const dragHandle = within(dialog).getByRole('button', { name: '移动 城市 字段' });
    pointer(dragHandle, 'pointerdown', { clientX: 20, clientY: 108 });
    pointer(window, 'pointermove', { clientX: 20, clientY: 10 });
    pointer(window, 'pointerup', { clientX: 20, clientY: 10 });
    await waitFor(() => expect(headerKeys()).toEqual(['city', 'age', 'name']));
  });

  it('隐藏活动排序列时清除排序；字段重置不清除其他排序', async () => {
    render(
      <DataTable
        defaultSortState={{ key: 'city', order: 'ascend' }}
        defaultColumnState={{ order: ['city', 'name', 'age'] }}
      />
    );
    const dialog = await openColumnManager();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '显示 城市' }));
    expect(screen.getByText('未排序')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '完成' }));
    await openSortMenu('年龄');
    fireEvent.click(screen.getByRole('menuitem', { name: /降序排列/ }));
    const reopened = await openColumnManager(/字段 2\/3/);
    fireEvent.click(within(reopened).getByRole('button', { name: '恢复默认字段' }));
    expect(screen.getByText('年龄 · 降序')).toBeInTheDocument();
  });

  it('受控 columnState 归一化未知/重复/all-hidden，回调发出完整状态', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columnState={{ order: ['ghost', 'city', 'city'], hidden: ['name', 'age', 'city'] }}
        onColumnStateChange={onChange}
      />
    );
    expect(headerKeys()).toEqual(['city']);
    const dialog = await openColumnManager(/字段 1\/3/);
    fireEvent.click(within(dialog).getByRole('button', { name: '下移 城市 字段' }));
    expect(onChange).toHaveBeenCalledWith({
      order: ['name', 'city', 'age'],
      hidden: ['name', 'age'],
    });
    rerender(
      <DataTable
        columnState={{ order: ['name', 'city', 'age'], hidden: ['name', 'age'] }}
        onColumnStateChange={onChange}
      />
    );
    expect(headerKeys()).toEqual(['city']);
  });
});
