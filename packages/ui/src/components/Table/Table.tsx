'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Settings } from '@zui/icons';
import { cx, useControllableState } from '../../utils';
import { Checkbox } from '../Checkbox';
import { Popover } from '../Popover';
import './Table.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TableDensity = 'comfortable' | 'compact';
export type TableAlign = 'left' | 'center' | 'right';
export type TableSortOrder = 'ascend' | 'descend';

export interface TableColumn<T = unknown> {
  /** 列标识，稳定唯一；列顺序与显隐状态都以它为准 */
  key: string;
  title: React.ReactNode;
  width?: number | string;
  align?: TableAlign;
  /** 允许点击表头对数据行排序 */
  sortable?: boolean;
  /** 自定义比较；缺省按单元格值做数字/字符串自动比较 */
  sorter?: (a: T, b: T) => number;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface TableColumnState {
  /** 展示顺序，为列 key 的排列；缺失的 key 追加到末尾 */
  order?: string[];
  /** 隐藏的列 key 列表 */
  hidden?: string[];
}

export interface TableProps<T = unknown> extends Omit<
  React.ComponentPropsWithRef<'table'>,
  'size'
> {
  density?: TableDensity; // 默认 'comfortable'
  bordered?: boolean; // 默认 false（行分隔线始终有）
  striped?: boolean; // 默认 false
  classNames?: { root?: string };
  /** 传入 data + columns 后进入数据驱动模式；children 语义化用法不受影响 */
  data?: T[];
  columns?: TableColumn<T>[];
  rowKey?: keyof T | ((row: T, index: number) => React.Key);
  /** 受控列状态（顺序 + 显隐）；缺省内部管理 */
  columnState?: TableColumnState;
  defaultColumnState?: TableColumnState;
  onColumnStateChange?: (state: TableColumnState) => void;
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

/* ------------------------------ 数据模式辅助 ------------------------------- */

function normalizeOrder(keys: string[], order: string[] | undefined): string[] {
  if (!order?.length) return keys;
  const known = order.filter((key) => keys.includes(key));
  const missing = keys.filter((key) => !known.includes(key));
  return [...known, ...missing];
}

function defaultColumnSort(a: unknown, b: unknown): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : -1;
  if (b == null || b === '') return 1;
  const left = typeof a === 'number' ? a : String(a);
  const right = typeof b === 'number' ? b : String(b);
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'zh-Hans-CN', { numeric: true });
}

function rowValue<T>(row: T, column: TableColumn<T>): unknown {
  // rowKey 只标识行身份；单元格取值始终按列 key
  return (row as Record<string, unknown>)[column.key];
}

function resolveRowKey<T>(
  row: T,
  index: number,
  rowKey: keyof T | ((row: T, index: number) => React.Key) | undefined
): React.Key {
  if (typeof rowKey === 'function') return rowKey(row, index);
  if (rowKey != null) {
    const value = (row as Record<string, unknown>)[rowKey as string];
    if (value != null) return value as React.Key;
  }
  return index;
}

/* ----------------------------------- Root --------------------------------- */

function Table<T>(props: TableProps<T>) {
  const {
    density = 'comfortable',
    bordered = false,
    striped = false,
    classNames,
    className,
    children,
    data,
    columns,
    rowKey,
    columnState: columnStateProp,
    defaultColumnState,
    onColumnStateChange,
    ...rest
  } = props;

  const dataTableMode = Boolean(data && columns?.length);

  const [state, setState] = useControllableState<TableColumnState>({
    value: columnStateProp,
    defaultValue: defaultColumnState ?? {},
    onChange: onColumnStateChange,
  });

  const [sortState, setSortState] = React.useState<{
    key: string;
    order: TableSortOrder;
  } | null>(null);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [dropKey, setDropKey] = React.useState<string | null>(null);
  const [panelDrag, setPanelDrag] = React.useState(false);
  const rootRef = React.useRef<HTMLTableElement>(null);

  const declaredKeys = React.useMemo(() => (columns ?? []).map((column) => column.key), [columns]);
  const orderedKeys = React.useMemo(
    () => normalizeOrder(declaredKeys, state.order),
    [declaredKeys, state.order]
  );
  const hiddenKeys = React.useMemo(() => new Set(state.hidden ?? []), [state.hidden]);
  const visibleKeys = React.useMemo(
    () => orderedKeys.filter((key) => !hiddenKeys.has(key)),
    [orderedKeys, hiddenKeys]
  );

  const commitState = React.useCallback((next: TableColumnState) => setState(next), [setState]);

  const moveColumn = React.useCallback(
    (fromKey: string, toKey: string, before: boolean) => {
      if (fromKey === toKey) return;
      const source = orderedKeys.filter((key) => key !== fromKey);
      const index = source.indexOf(toKey);
      source.splice(before ? index : index + 1, 0, fromKey);
      commitState({ order: source, hidden: state.hidden });
    },
    [commitState, orderedKeys, state.hidden]
  );

  const rows = React.useMemo(() => {
    if (!dataTableMode) return [];
    const list = (data ?? []) as T[];
    const keyed = list.map((row, index) => ({ row, index }));
    if (!sortState) return keyed;
    const column = (columns ?? []).find((item) => item.key === sortState.key) as
      TableColumn<T> | undefined;
    if (!column) return keyed;
    const compare =
      column.sorter ??
      ((left: T, right: T) => defaultColumnSort(rowValue(left, column), rowValue(right, column)));
    keyed.sort((left, right) => {
      const result = compare(left.row, right.row);
      return sortState.order === 'ascend' ? result : -result;
    });
    return keyed;
  }, [columns, data, dataTableMode, sortState]);

  /* ------------------------------ 排序点击 -------------------------------- */

  const toggleSort = React.useCallback((key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, order: 'ascend' };
      if (current.order === 'ascend') return { key, order: 'descend' };
      return null;
    });
  }, []);

  /* ------------------------------ 表头拖拽 -------------------------------- */

  const beginHeaderDrag = React.useCallback(
    (event: React.PointerEvent<HTMLTableCellElement>, key: string) => {
      if (dataTableMode && !event.altKey) {
        event.preventDefault();
        const cell = event.currentTarget;
        cell.setPointerCapture(event.pointerId);
        setPanelDrag(false);
        setDragKey(key);
      }
    },
    [dataTableMode]
  );

  const beginPanelDrag = React.useCallback(
    (event: React.PointerEvent<HTMLLIElement>, key: string) => {
      // 复选框等控件的点击不进入拖拽；pointerdown 的 preventDefault 会吞掉
      // 浏览器派生的 click，导致控件失效。
      const target = event.target as HTMLElement;
      if (target.closest('input, button, label, [role="checkbox"]')) return;
      event.preventDefault();
      const item = event.currentTarget;
      item.setPointerCapture(event.pointerId);
      setPanelDrag(true);
      setDragKey(key);
    },
    []
  );

  React.useEffect(() => {
    if (!dragKey) return;
    const onMove = (event: PointerEvent) => {
      // 面板经 Portal 渲染在 body 下，不在 table 内；scope 属性已区分拖拽来源
      // 表头与列设置面板共用同一拖拽状态机；命中检测限定在拖拽来源的 scope
      const scopeName = panelDrag ? 'panel' : 'header';
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          `[data-drag-scope="${scopeName}"] [data-column-key]`
        ),
      ];
      // 表头水平排列按 X 命中；列设置面板垂直排列按 Y 命中
      const target = nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return panelDrag
          ? event.clientY >= rect.top && event.clientY <= rect.bottom
          : event.clientX >= rect.left && event.clientX <= rect.right;
      });
      setDropKey(target?.dataset.columnKey ?? null);
    };
    const onUp = () => {
      setDragKey((currentKey) => {
        setDropKey((currentDrop) => {
          if (currentKey && currentDrop && currentKey !== currentDrop) {
            const dragIndex = orderedKeys.indexOf(currentKey);
            const dropIndex = orderedKeys.indexOf(currentDrop);
            moveColumn(currentKey, currentDrop, dropIndex < dragIndex);
          }
          return null;
        });
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragKey, moveColumn, orderedKeys, panelDrag]);

  /* ------------------------------ 列设置面板 ------------------------------ */

  const toggleHidden = React.useCallback(
    (key: string) => {
      const current = state.hidden ?? [];
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      // 至少保留一列可见
      if (declaredKeys.every((key) => next.includes(key))) return;
      commitState({ order: state.order, hidden: next });
    },
    [commitState, declaredKeys, state.hidden, state.order]
  );

  const resetState = React.useCallback(() => {
    commitState({ order: undefined, hidden: undefined });
    setSortState(null);
  }, [commitState]);

  const panelToggle = React.useCallback((event: React.PointerEvent) => {
    // 与表头拖拽区分：点击设置按钮时不进入拖拽
    event.stopPropagation();
  }, []);

  /* -------------------------------- 渲染 --------------------------------- */

  const columnByKey = React.useMemo(() => {
    const map = new Map<string, TableColumn<T>>();
    for (const column of columns ?? []) map.set(column.key, column);
    return map;
  }, [columns]);

  const renderHeaderCell = (key: string) => {
    const column = columnByKey.get(key);
    if (!column) return null;
    const sortActive = sortState?.key === key ? sortState.order : null;
    const sortable = Boolean(column.sortable);
    return (
      <TableHeaderCell
        key={key}
        data-column-key={key}
        data-sort={sortActive ?? undefined}
        data-dragging={dragKey === key ? 'true' : undefined}
        data-drop-before={dropKey === key && dragKey !== key && dragKey ? 'true' : undefined}
        aria-sort={
          sortable
            ? sortActive === 'ascend'
              ? 'ascending'
              : sortActive === 'descend'
                ? 'descending'
                : 'none'
            : undefined
        }
        align={column.align}
        style={column.width != null ? { width: column.width } : undefined}
        onPointerDown={(event) => beginHeaderDrag(event, key)}
      >
        <span className="z-table-header-content">
          {sortable ? (
            <button
              type="button"
              className="z-table-sort-button"
              onPointerDown={panelToggle}
              onClick={() => toggleSort(key)}
            >
              <span className="z-table-header-title">{column.title}</span>
              <span className="z-table-sort-icon" aria-hidden="true">
                {sortActive === 'ascend' ? (
                  <ArrowUp size={12} />
                ) : sortActive === 'descend' ? (
                  <ArrowDown size={12} />
                ) : (
                  <ArrowUp size={12} className="z-table-sort-icon-idle" />
                )}
              </span>
            </button>
          ) : (
            <span className="z-table-header-title">{column.title}</span>
          )}
        </span>
      </TableHeaderCell>
    );
  };

  const renderBodyCell = (key: string, row: T, index: number) => {
    const column = columnByKey.get(key);
    if (!column) return null;
    const content = column.render ? column.render(row, index) : String(rowValue(row, column) ?? '');
    return (
      <TableCell key={key} data-column-key={key} align={column.align}>
        {content}
      </TableCell>
    );
  };

  if (!dataTableMode) {
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

  return (
    <div className="z-table-data-wrap">
      <div className="z-table-toolbar">
        <Popover>
          <Popover.Trigger
            className="z-table-settings-button"
            aria-label="列设置"
            onPointerDown={panelToggle}
          >
            <Settings size={14} />
            列设置
          </Popover.Trigger>
          <Popover.Content className="z-table-column-panel">
            <div className="z-table-column-panel-head">列设置</div>
            <ul className="z-table-column-list" data-drag-scope="panel">
              {orderedKeys.map((key) => {
                const column = columnByKey.get(key);
                if (!column) return null;
                return (
                  <li
                    key={key}
                    className="z-table-column-item"
                    data-column-key={key}
                    data-dragging={dragKey === key && panelDrag ? 'true' : undefined}
                    onPointerDown={(event) => beginPanelDrag(event, key)}
                  >
                    <span className="z-table-column-item-label">{column.title}</span>
                    <Checkbox
                      checked={!hiddenKeys.has(key)}
                      onChange={() => toggleHidden(key)}
                      aria-label={`显示 ${typeof column.title === 'string' ? column.title : key}`}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="z-table-column-panel-foot">
              <button type="button" className="z-table-reset-button" onClick={resetState}>
                重置
              </button>
            </div>
          </Popover.Content>
        </Popover>
      </div>
      <table
        ref={rootRef}
        data-part="root"
        className={cx('z-table', 'z-table-data', classNames?.root, className)}
        data-density={density}
        data-bordered={bordered ? 'true' : 'false'}
        data-striped={striped ? 'true' : 'false'}
        {...rest}
      >
        <thead className="z-table-head" data-drag-scope="header">
          <tr className="z-table-row">{visibleKeys.map(renderHeaderCell)}</tr>
        </thead>
        <tbody className="z-table-body">
          {rows.map(({ row, index }) => (
            <TableRow key={resolveRowKey(row, index, rowKey)}>
              {visibleKeys.map((key) => renderBodyCell(key, row, index))}
            </TableRow>
          ))}
        </tbody>
      </table>
    </div>
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

export { TableRoot as Table, TableHead, TableBody, TableRow, TableCell, TableHeaderCell };
