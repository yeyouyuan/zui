'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Table.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TableDensity = 'comfortable' | 'compact';
export type TableAlign = 'left' | 'center' | 'right';

export interface TableProps extends Omit<React.ComponentPropsWithRef<'table'>, 'size'> {
  density?: TableDensity; // 默认 'comfortable'
  bordered?: boolean; // 默认 false（行分隔线始终有）
  striped?: boolean; // 默认 false
  classNames?: { root?: string };
}

export type TableHeadProps = React.ComponentPropsWithRef<'thead'>;
export type TableBodyProps = React.ComponentPropsWithRef<'tbody'>;

export interface TableRowProps extends React.ComponentPropsWithRef<'tr'> {
  selected?: boolean;
}

export interface TableCellProps extends React.ComponentPropsWithRef<'td'> {
  align?: TableAlign; // 默认 'left'
}

export interface TableHeaderCellProps extends Omit<React.ComponentPropsWithRef<'th'>, 'align'> {
  align?: TableAlign; // 默认 'left'
}

/* ----------------------------------- Root --------------------------------- */

function Table(props: TableProps) {
  const {
    density = 'comfortable',
    bordered = false,
    striped = false,
    classNames,
    className,
    children,
    ...rest
  } = props;

  return (
    <table
      data-part="root"
      className={cx('z-table', classNames?.root, className)}
      data-density={density}
      data-bordered={bordered ? 'true' : 'false'}
      data-striped={striped ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </table>
  );
}

/* ---------------------------------- Parts --------------------------------- */

function TableHead(props: TableHeadProps) {
  const { className, children, ...rest } = props;
  return (
    <thead className={cx('z-table-head', className)} {...rest}>
      {children}
    </thead>
  );
}

function TableBody(props: TableBodyProps) {
  const { className, children, ...rest } = props;
  return (
    <tbody className={cx('z-table-body', className)} {...rest}>
      {children}
    </tbody>
  );
}

function TableRow(props: TableRowProps) {
  const { selected = false, className, children, ...rest } = props;
  return (
    <tr
      className={cx('z-table-row', className)}
      data-selected={selected ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </tr>
  );
}

function TableHeaderCell(props: TableHeaderCellProps) {
  const { align = 'left', className, children, ...rest } = props;
  return (
    <th
      scope="col"
      data-part="header-cell"
      className={cx('z-table-header-cell', className)}
      data-align={align}
      {...rest}
    >
      {children}
    </th>
  );
}

function TableCell(props: TableCellProps) {
  const { align = 'left', className, children, ...rest } = props;
  return (
    <td data-part="cell" className={cx('z-table-cell', className)} data-align={align} {...rest}>
      {children}
    </td>
  );
}

/* -------------------------------- Compound -------------------------------- */

const TableRoot = Object.assign(Table, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeaderCell: TableHeaderCell,
});

export {
  TableRoot as Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
};
