import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
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
