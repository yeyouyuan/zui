'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Close,
  Menu,
  RotateCcw,
  Search,
  Settings,
} from '@zui/icons';
import { Portal, cx, useControllableState } from '../../utils';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Input } from '../Input';
import { Popover } from '../Popover';
import { Tag } from '../Tag';
import { Tooltip } from '../Tooltip';
import './Table.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TableDensity = 'comfortable' | 'compact';
export type TableAlign = 'left' | 'center' | 'right';
export type TableSortOrder = 'ascend' | 'descend';
export type TableSortMode = 'client' | 'manual';

export interface TableSortState {
  key: string;
  order: TableSortOrder;
}

export interface TableColumn<T = unknown> {
  /** 列标识，稳定唯一；列顺序、显隐与排序状态都以它为准 */
  key: string;
  title: React.ReactNode;
  width?: number | string;
  align?: TableAlign;
  /** 允许通过明确的排序菜单对数据行排序 */
  sortable?: boolean;
  /** 自定义比较；缺省按单元格值做数字/字符串自动比较 */
  sorter?: (a: T, b: T) => number;
  /** index 为当前显示序号；sourceIndex 为输入 data 中的原始序号 */
  render?: (row: T, index: number, sourceIndex: number) => React.ReactNode;
}

export interface TableColumnState {
  /** 展示顺序，为列 key 的排列；缺失的新 key 自动追加 */
  order?: string[];
  /** 隐藏的列 key 列表；始终至少保留一个可见字段 */
  hidden?: string[];
}

export interface TableProps<T = unknown> extends Omit<
  React.ComponentPropsWithRef<'table'>,
  'size'
> {
  density?: TableDensity;
  bordered?: boolean;
  striped?: boolean;
  classNames?: { root?: string };
  /** 传入 data + columns 后进入数据驱动模式；children 语义用法不受影响 */
  data?: T[];
  columns?: TableColumn<T>[];
  rowKey?: keyof T | ((row: T, index: number) => React.Key);
  columnState?: TableColumnState;
  defaultColumnState?: TableColumnState;
  onColumnStateChange?: (state: TableColumnState) => void;
  sortState?: TableSortState | null;
  defaultSortState?: TableSortState | null;
  onSortStateChange?: (state: TableSortState | null) => void;
  /** client 在本地重排 data；manual 只回调排序状态，供服务端查询使用 */
  sortMode?: TableSortMode;
}

export type TableHeadProps = React.ComponentPropsWithRef<'thead'>;
export type TableBodyProps = React.ComponentPropsWithRef<'tbody'>;

export interface TableRowProps extends React.ComponentPropsWithRef<'tr'> {
  selected?: boolean;
}

export interface TableCellProps extends React.ComponentPropsWithRef<'td'> {
  align?: TableAlign;
}

export interface TableHeaderCellProps extends Omit<React.ComponentPropsWithRef<'th'>, 'align'> {
  align?: TableAlign;
}

interface NormalizedColumnState {
  order: string[];
  hidden: string[];
}

type DragScope = 'header' | 'panel';
type DropPosition = 'before' | 'after';

interface DragSession {
  pointerId: number;
  key: string;
  scope: DragScope;
  startX: number;
  startY: number;
  started: boolean;
  source: HTMLElement;
}

interface DragVisual {
  key: string;
  label: string;
  x: number;
  y: number;
  scope: DragScope;
}

interface DropTarget {
  key: string;
  position: DropPosition;
}

/* ---------------------------------- 工具 ---------------------------------- */

const DRAG_THRESHOLD = 6;

function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(nodeText).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return nodeText(node.props.children);
  return '';
}

function uniqueKnownKeys(keys: string[], candidate: string[] | undefined): string[] {
  const known = new Set(keys);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of candidate ?? []) {
    if (!known.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function normalizeColumnState(
  keys: string[],
  state: TableColumnState | undefined
): NormalizedColumnState {
  const explicit = uniqueKnownKeys(keys, state?.order);
  const order = [...explicit, ...keys.filter((key) => !explicit.includes(key))];
  let hidden = uniqueKnownKeys(keys, state?.hidden);
  if (keys.length > 0 && hidden.length >= keys.length) {
    const keepVisible = order[0] ?? keys[0];
    hidden = hidden.filter((key) => key !== keepVisible);
  }
  return { order, hidden };
}

function sameColumns(left: string[] | undefined, right: string[]): boolean {
  const a = left ?? [];
  return a.length === right.length && a.every((value, index) => value === right[index]);
}

function defaultColumnSort(a: unknown, b: unknown): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : -1;
  if (b == null || b === '') return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true });
}

function rowValue<T>(row: T, column: TableColumn<T>): unknown {
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

function reorderKeys(
  keys: string[],
  fromKey: string,
  toKey: string,
  position: DropPosition
): string[] {
  if (fromKey === toKey || !keys.includes(fromKey) || !keys.includes(toKey)) return keys;
  const next = keys.filter((key) => key !== fromKey);
  const target = next.indexOf(toKey);
  if (target < 0) return keys;
  next.splice(target + (position === 'after' ? 1 : 0), 0, fromKey);
  return next;
}

function sortLabel(order: TableSortOrder): string {
  return order === 'ascend' ? '升序' : '降序';
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
    sortState: sortStateProp,
    defaultSortState = null,
    onSortStateChange,
    sortMode = 'client',
    ref: userRef,
    ...rest
  } = props;

  const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const managerTitleId = `${instanceId}-column-manager-title`;
  const managerDescriptionId = `${instanceId}-column-manager-description`;
  const instructionsId = `${instanceId}-table-instructions`;
  const dataTableMode = Boolean(data && columns?.length);

  const uniqueColumns = React.useMemo(() => {
    const seen = new Set<string>();
    return (columns ?? []).filter((column) => {
      if (!column.key || seen.has(column.key)) return false;
      seen.add(column.key);
      return true;
    });
  }, [columns]);

  React.useEffect(() => {
    const keys = (columns ?? []).map((column) => column.key);
    const duplicates = keys.filter((key, index) => !key || keys.indexOf(key) !== index);
    if (duplicates.length > 0) {
      console.warn('[ZUI Table] column.key 必须非空且唯一，重复项已忽略：', duplicates);
    }
  }, [columns]);

  const columnByKey = React.useMemo(() => {
    const map = new Map<string, TableColumn<T>>();
    for (const column of uniqueColumns) map.set(column.key, column);
    return map;
  }, [uniqueColumns]);
  const declaredKeys = React.useMemo(
    () => uniqueColumns.map((column) => column.key),
    [uniqueColumns]
  );

  const [rawColumnState, setRawColumnState] = useControllableState<TableColumnState>({
    value: columnStateProp,
    defaultValue: defaultColumnState ?? {},
    onChange: onColumnStateChange,
  });
  const columnState = React.useMemo(
    () => normalizeColumnState(declaredKeys, rawColumnState),
    [declaredKeys, rawColumnState]
  );
  const hiddenKeys = React.useMemo(() => new Set(columnState.hidden), [columnState.hidden]);
  const visibleKeys = React.useMemo(
    () => columnState.order.filter((key) => !hiddenKeys.has(key)),
    [columnState.order, hiddenKeys]
  );

  const [rawSortState, setRawSortState] = useControllableState<TableSortState | null>({
    value: sortStateProp,
    defaultValue: defaultSortState,
    onChange: onSortStateChange,
  });
  const validSortState = React.useMemo(() => {
    if (!rawSortState) return null;
    const column = columnByKey.get(rawSortState.key);
    if (!column?.sortable || hiddenKeys.has(rawSortState.key)) return null;
    return rawSortState;
  }, [columnByKey, hiddenKeys, rawSortState]);

  const [managerOpen, setManagerOpen] = React.useState(false);
  const [columnQuery, setColumnQuery] = React.useState('');
  const [announcement, setAnnouncement] = React.useState('');
  const [dragging, setDragging] = React.useState(false);
  const [dragVisual, setDragVisual] = React.useState<DragVisual | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const dropTargetRef = React.useRef<DropTarget | null>(null);
  const dragSessionRef = React.useRef<DragSession | null>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const headerRef = React.useRef<HTMLTableSectionElement>(null);
  const panelListRef = React.useRef<HTMLUListElement>(null);

  const commitColumnState = React.useCallback(
    (next: TableColumnState) => {
      const normalized = normalizeColumnState(declaredKeys, next);
      setRawColumnState({ order: normalized.order, hidden: normalized.hidden });
    },
    [declaredKeys, setRawColumnState]
  );

  const announceColumnPosition = React.useCallback(
    (key: string, order: string[]) => {
      const label = nodeText(columnByKey.get(key)?.title) || key;
      setAnnouncement(`${label}已移动到第 ${order.indexOf(key) + 1} 列，共 ${order.length} 列`);
    },
    [columnByKey]
  );

  const moveColumnTo = React.useCallback(
    (key: string, nextIndex: number) => {
      const current = columnState.order;
      const from = current.indexOf(key);
      if (from < 0) return;
      const bounded = Math.max(0, Math.min(current.length - 1, nextIndex));
      if (from === bounded) return;
      const next = current.filter((item) => item !== key);
      next.splice(bounded, 0, key);
      commitColumnState({ order: next, hidden: columnState.hidden });
      announceColumnPosition(key, next);
    },
    [announceColumnPosition, columnState.hidden, columnState.order, commitColumnState]
  );

  const moveColumnByDrop = React.useCallback(
    (fromKey: string, target: DropTarget) => {
      const next = reorderKeys(columnState.order, fromKey, target.key, target.position);
      if (sameColumns(next, columnState.order)) return;
      commitColumnState({ order: next, hidden: columnState.hidden });
      announceColumnPosition(fromKey, next);
    },
    [announceColumnPosition, columnState.hidden, columnState.order, commitColumnState]
  );

  const setSort = React.useCallback(
    (next: TableSortState | null) => {
      setRawSortState(next);
      if (!next) {
        setAnnouncement('已清除数据排序');
        return;
      }
      const label = nodeText(columnByKey.get(next.key)?.title) || next.key;
      setAnnouncement(`已按${label}${sortLabel(next.order)}排列`);
    },
    [columnByKey, setRawSortState]
  );

  React.useEffect(() => {
    if (rawSortState && !validSortState) setSort(null);
  }, [rawSortState, setSort, validSortState]);

  const rows = React.useMemo(() => {
    if (!dataTableMode) return [];
    const keyed = (data ?? []).map((row, sourceIndex) => ({ row, sourceIndex }));
    if (!validSortState || sortMode === 'manual') return keyed;
    const column = columnByKey.get(validSortState.key);
    if (!column) return keyed;
    const compare =
      column.sorter ??
      ((left: T, right: T) => defaultColumnSort(rowValue(left, column), rowValue(right, column)));
    keyed.sort((left, right) => {
      const result = compare(left.row, right.row);
      return validSortState.order === 'ascend' ? result : -result;
    });
    return keyed;
  }, [columnByKey, data, dataTableMode, sortMode, validSortState]);

  const toggleHidden = React.useCallback(
    (key: string) => {
      const isHidden = hiddenKeys.has(key);
      if (!isHidden && visibleKeys.length <= 1) return;
      const hidden = isHidden
        ? columnState.hidden.filter((item) => item !== key)
        : [...columnState.hidden, key];
      commitColumnState({ order: columnState.order, hidden });
      const label = nodeText(columnByKey.get(key)?.title) || key;
      setAnnouncement(`${label}已${isHidden ? '显示' : '隐藏'}`);
      if (!isHidden && rawSortState?.key === key) setSort(null);
    },
    [
      columnByKey,
      columnState.hidden,
      columnState.order,
      commitColumnState,
      hiddenKeys,
      rawSortState?.key,
      setSort,
      visibleKeys.length,
    ]
  );

  const toggleAllColumns = React.useCallback(
    (showAll: boolean) => {
      if (showAll) {
        commitColumnState({ order: columnState.order, hidden: [] });
        setAnnouncement('已显示全部字段');
        return;
      }
      const keep = visibleKeys[0] ?? columnState.order[0];
      const hidden = columnState.order.filter((key) => key !== keep);
      commitColumnState({ order: columnState.order, hidden });
      if (rawSortState && hidden.includes(rawSortState.key)) setSort(null);
      setAnnouncement('已隐藏其他字段，保留一个可见字段');
    },
    [columnState.order, commitColumnState, rawSortState, setSort, visibleKeys]
  );

  const resetColumns = React.useCallback(() => {
    commitColumnState({ order: declaredKeys, hidden: [] });
    setColumnQuery('');
    setAnnouncement('字段顺序与显示状态已恢复默认');
  }, [commitColumnState, declaredKeys]);

  const cancelDrag = React.useCallback(() => {
    dragSessionRef.current = null;
    dropTargetRef.current = null;
    setDragging(false);
    setDragVisual(null);
    setDropTarget(null);
  }, []);

  const beginDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, key: string, scope: DragScope) => {
      if (event.button !== 0 || event.isPrimary === false || dragSessionRef.current) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragSessionRef.current = {
        pointerId: event.pointerId,
        key,
        scope,
        startX: event.clientX,
        startY: event.clientY,
        started: false,
        source: event.currentTarget,
      };
      setDragging(true);
    },
    []
  );

  React.useEffect(() => {
    if (!dragging) return;

    const nodesFor = (scope: DragScope): HTMLElement[] => {
      const root = scope === 'header' ? headerRef.current : panelListRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>('[data-column-key]'));
    };

    const onMove = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (!session.started) {
        const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
        if (distance < DRAG_THRESHOLD) return;
        session.started = true;
      }

      const nodes = nodesFor(session.scope);
      const target = nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return session.scope === 'panel'
          ? event.clientY >= rect.top && event.clientY <= rect.bottom
          : event.clientX >= rect.left && event.clientX <= rect.right;
      });
      let nextTarget: DropTarget | null = null;
      if (target?.dataset.columnKey) {
        const rect = target.getBoundingClientRect();
        if (session.scope === 'panel') {
          nextTarget = {
            key: target.dataset.columnKey,
            position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
          };
        } else {
          const rtl = window.getComputedStyle(headerRef.current!).direction === 'rtl';
          const firstHalf = rtl
            ? event.clientX > rect.left + rect.width / 2
            : event.clientX < rect.left + rect.width / 2;
          nextTarget = {
            key: target.dataset.columnKey,
            position: firstHalf ? 'before' : 'after',
          };
        }
      }
      dropTargetRef.current = nextTarget;
      setDropTarget(nextTarget);
      setDragVisual({
        key: session.key,
        label: nodeText(columnByKey.get(session.key)?.title) || session.key,
        x: event.clientX,
        y: event.clientY,
        scope: session.scope,
      });
    };

    const complete = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const target = dropTargetRef.current;
      if (session.started && target && target.key !== session.key) {
        moveColumnByDrop(session.key, target);
      }
      cancelDrag();
    };

    const cancel = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (session && event.pointerId === session.pointerId) cancelDrag();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelDrag();
      setAnnouncement('已取消字段移动');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', complete);
    window.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', complete);
      window.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelDrag, columnByKey, dragging, dropTarget, moveColumnByDrop]);

  const handleMoveKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
      if (!event.altKey) return;
      const current = columnState.order.indexOf(key);
      if (current < 0) return;
      const rtl = window.getComputedStyle(tableRef.current!).direction === 'rtl';
      let next = current;
      if (event.key === 'ArrowLeft') next = current + (rtl ? 1 : -1);
      else if (event.key === 'ArrowRight') next = current + (rtl ? -1 : 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = columnState.order.length - 1;
      else return;
      event.preventDefault();
      moveColumnTo(key, next);
    },
    [columnState.order, moveColumnTo]
  );

  const filteredKeys = React.useMemo(() => {
    const query = columnQuery.trim().toLocaleLowerCase();
    if (!query) return columnState.order;
    return columnState.order.filter((key) => {
      const label = nodeText(columnByKey.get(key)?.title) || key;
      return label.toLocaleLowerCase().includes(query);
    });
  }, [columnByKey, columnQuery, columnState.order]);

  const visibleCount = visibleKeys.length;
  const allVisible = visibleCount === declaredKeys.length;
  const someVisible = visibleCount > 0 && !allVisible;
  const columnsCustomized =
    !sameColumns(columnState.order, declaredKeys) || columnState.hidden.length > 0;
  const sortedColumn = validSortState ? columnByKey.get(validSortState.key) : undefined;
  const sortedLabel = sortedColumn ? nodeText(sortedColumn.title) || sortedColumn.key : '';

  const renderSortTrigger = (column: TableColumn<T>) => {
    const active = validSortState?.key === column.key ? validSortState.order : null;
    const label = nodeText(column.title) || column.key;
    const stateText = active ? sortLabel(active) : '未排序';
    const nextHint =
      active === 'ascend'
        ? '点击切换为降序'
        : active === 'descend'
          ? '点击清除排序'
          : '点击按升序排列';
    return (
      <button
        type="button"
        className="z-table-sort-trigger"
        data-active={active ?? undefined}
        data-sort={active ?? undefined}
        aria-label={`${label}，${stateText}，${nextHint}`}
        title={`${label}：${nextHint}`}
        onClick={() =>
          setSort(
            active === null
              ? { key: column.key, order: 'ascend' }
              : active === 'ascend'
                ? { key: column.key, order: 'descend' }
                : null
          )
        }
      >
        <span className="z-table-header-title">{column.title}</span>
        <span className="z-table-sort-indicator" aria-hidden="true">
          {active === 'ascend' ? (
            <ArrowUp size={13} />
          ) : active === 'descend' ? (
            <ArrowDown size={13} />
          ) : (
            <>
              <ChevronUp size={11} className="z-table-sort-caret" />
              <ChevronDown size={11} className="z-table-sort-caret" />
            </>
          )}
        </span>
      </button>
    );
  };

  const renderHeaderCell = (key: string) => {
    const column = columnByKey.get(key);
    if (!column) return null;
    const activeSort = validSortState?.key === key ? validSortState.order : null;
    const target = dropTarget?.key === key ? dropTarget.position : undefined;
    const label = nodeText(column.title) || key;
    return (
      <TableHeaderCell
        key={key}
        data-column-key={key}
        data-sort={activeSort ?? undefined}
        data-dragging={
          dragVisual?.scope === 'header' && dragVisual.key === key ? 'true' : undefined
        }
        data-drop-position={dragVisual?.scope === 'header' ? target : undefined}
        aria-sort={
          activeSort === 'ascend'
            ? 'ascending'
            : activeSort === 'descend'
              ? 'descending'
              : undefined
        }
        align={column.align}
        style={column.width != null ? { width: column.width } : undefined}
      >
        <span className="z-table-header-content">
          <Tooltip content={`拖动调整${label}列；Alt+方向键也可移动`} placement="top">
            <button
              type="button"
              className="z-table-drag-handle"
              aria-label={`移动 ${label} 列`}
              onPointerDown={(event) => beginDrag(event, key, 'header')}
              onLostPointerCapture={(event) => {
                const session = dragSessionRef.current;
                if (session?.pointerId === event.pointerId && !session.started) cancelDrag();
              }}
              onKeyDown={(event) => handleMoveKey(event, key)}
            >
              <Menu size={14} aria-hidden="true" />
            </button>
          </Tooltip>
          {column.sortable ? (
            renderSortTrigger(column)
          ) : (
            <span className="z-table-header-title">{column.title}</span>
          )}
        </span>
      </TableHeaderCell>
    );
  };

  const renderBodyCell = (key: string, row: T, displayIndex: number, sourceIndex: number) => {
    const column = columnByKey.get(key);
    if (!column) return null;
    const content = column.render
      ? column.render(row, displayIndex, sourceIndex)
      : String(rowValue(row, column) ?? '');
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

  const describedBy = [rest['aria-describedby'], instructionsId].filter(Boolean).join(' ');

  return (
    <div className="z-table-data-wrap" data-table-instance={instanceId}>
      <div className="z-table-toolbar">
        <div className="z-table-sort-summary">
          <span className="z-table-toolbar-label">数据排序</span>
          {validSortState && sortedColumn ? (
            <Tag
              color="primary"
              icon={
                validSortState.order === 'ascend' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
              }
            >
              <span className="z-table-sort-tag-label">
                {sortedLabel} · {sortLabel(validSortState.order)}
              </span>
              <button
                type="button"
                className="z-table-sort-tag-clear"
                aria-label={`清除${sortedLabel}排序`}
                onClick={() => setSort(null)}
              >
                <Close size={12} />
              </button>
            </Tag>
          ) : (
            <span className="z-table-unsorted">未排序</span>
          )}
        </div>

        <Popover open={managerOpen} onOpenChange={setManagerOpen}>
          <Popover.Trigger asChild>
            <Button
              size="sm"
              variant={columnsCustomized ? 'secondary' : 'outline'}
              iconStart={<Settings size={14} />}
              className="z-table-settings-button"
            >
              字段 {visibleCount}/{declaredKeys.length}
            </Button>
          </Popover.Trigger>
          <Popover.Content
            className="z-table-column-panel"
            aria-labelledby={managerTitleId}
            aria-describedby={managerDescriptionId}
            align="end"
          >
            <div className="z-table-column-panel-head">
              <div>
                <div id={managerTitleId} className="z-table-column-panel-title">
                  字段管理
                </div>
                <div id={managerDescriptionId} className="z-table-column-panel-description">
                  {visibleCount} / {declaredKeys.length} 个字段可见
                </div>
              </div>
              <button
                type="button"
                className="z-table-panel-close"
                aria-label="关闭字段管理"
                onClick={() => setManagerOpen(false)}
              >
                <Close size={14} />
              </button>
            </div>

            <div className="z-table-column-search">
              <Input
                data-autofocus
                size="sm"
                prefix={<Search size={14} />}
                value={columnQuery}
                placeholder="搜索字段"
                aria-label="搜索字段"
                clearable
                onChange={(event) => setColumnQuery(event.target.value)}
                onClear={() => setColumnQuery('')}
              />
            </div>

            <div className="z-table-show-all">
              <Checkbox
                checked={allVisible}
                indeterminate={someVisible}
                onChange={toggleAllColumns}
                label="显示全部字段"
              />
            </div>

            <ul ref={panelListRef} className="z-table-column-list" data-drag-scope="panel">
              {filteredKeys.map((key) => {
                const column = columnByKey.get(key);
                if (!column) return null;
                const label = nodeText(column.title) || key;
                const currentIndex = columnState.order.indexOf(key);
                const visible = !hiddenKeys.has(key);
                const lastVisible = visible && visibleCount <= 1;
                const target = dropTarget?.key === key ? dropTarget.position : undefined;
                return (
                  <li
                    key={key}
                    className="z-table-column-item"
                    data-column-key={key}
                    data-dragging={
                      dragVisual?.scope === 'panel' && dragVisual.key === key ? 'true' : undefined
                    }
                    data-drop-position={dragVisual?.scope === 'panel' ? target : undefined}
                  >
                    <Tooltip content={`拖动调整${label}字段`} placement="left">
                      <button
                        type="button"
                        className="z-table-panel-drag-handle"
                        aria-label={`移动 ${label} 字段`}
                        onPointerDown={(event) => beginDrag(event, key, 'panel')}
                        onLostPointerCapture={(event) => {
                          const session = dragSessionRef.current;
                          if (session?.pointerId === event.pointerId && !session.started)
                            cancelDrag();
                        }}
                      >
                        <Menu size={14} aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <span className="z-table-column-item-label">{column.title}</span>
                    <span className="z-table-column-item-actions">
                      <Tooltip content="上移" placement="top">
                        <button
                          type="button"
                          className="z-table-column-move-button"
                          aria-label={`上移 ${label} 字段`}
                          disabled={currentIndex <= 0}
                          onClick={() => moveColumnTo(key, currentIndex - 1)}
                        >
                          <ChevronUp size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip content="下移" placement="top">
                        <button
                          type="button"
                          className="z-table-column-move-button"
                          aria-label={`下移 ${label} 字段`}
                          disabled={currentIndex >= columnState.order.length - 1}
                          onClick={() => moveColumnTo(key, currentIndex + 1)}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip
                        content={
                          lastVisible ? '至少保留一个可见字段' : visible ? '隐藏字段' : '显示字段'
                        }
                        placement="right"
                      >
                        <span className="z-table-column-visible-control">
                          <Checkbox
                            checked={visible}
                            disabled={lastVisible}
                            onChange={() => toggleHidden(key)}
                            aria-label={`显示 ${label}`}
                          />
                        </span>
                      </Tooltip>
                    </span>
                  </li>
                );
              })}
            </ul>

            {filteredKeys.length === 0 ? (
              <div className="z-table-column-empty">没有匹配的字段</div>
            ) : null}

            <div className="z-table-column-panel-foot">
              <Button
                size="sm"
                variant="ghost"
                iconStart={<RotateCcw size={14} />}
                onClick={resetColumns}
              >
                恢复默认字段
              </Button>
              <Button size="sm" onClick={() => setManagerOpen(false)}>
                完成
              </Button>
            </div>
          </Popover.Content>
        </Popover>
      </div>

      <div
        className="z-table-scroll-region"
        role="region"
        aria-label={
          rest['aria-label'] ? `${rest['aria-label']}，可横向滚动` : '数据表格，可横向滚动'
        }
        tabIndex={0}
      >
        <table
          ref={(node) => {
            tableRef.current = node;
            if (typeof userRef === 'function') userRef(node);
            else if (userRef) (userRef as React.RefObject<HTMLTableElement | null>).current = node;
          }}
          data-part="root"
          className={cx('z-table', 'z-table-data', classNames?.root, className)}
          data-density={density}
          data-bordered={bordered ? 'true' : 'false'}
          data-striped={striped ? 'true' : 'false'}
          {...rest}
          aria-describedby={describedBy || undefined}
        >
          <caption id={instructionsId} className="z-table-visually-hidden">
            使用每个字段的排序菜单选择升序、降序或清除排序；使用移动字段按钮或 Alt
            加方向键调整字段顺序。
          </caption>
          <thead ref={headerRef} className="z-table-head" data-drag-scope="header">
            <tr className="z-table-row">{visibleKeys.map(renderHeaderCell)}</tr>
          </thead>
          <tbody className="z-table-body">
            {rows.map(({ row, sourceIndex }, displayIndex) => (
              <TableRow key={resolveRowKey(row, sourceIndex, rowKey)}>
                {visibleKeys.map((key) => renderBodyCell(key, row, displayIndex, sourceIndex))}
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>

      <span className="z-table-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {dragVisual ? (
        <Portal inheritFrom={{ current: tableRef.current }}>
          <div
            className="z-table-drag-ghost"
            data-scope={dragVisual.scope}
            style={{ left: dragVisual.x + 12, top: dragVisual.y + 12 }}
            aria-hidden="true"
          >
            <Menu size={14} />
            {dragVisual.label}
          </div>
        </Portal>
      ) : null}
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

const TableRoot = Object.assign(Table, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeaderCell: TableHeaderCell,
});

export { TableRoot as Table, TableHead, TableBody, TableRow, TableCell, TableHeaderCell };
