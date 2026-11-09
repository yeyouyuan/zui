'use client';

/**
 * DataGrid 性能原型（RFC-005 立项前置，仅直达访问）：
 * 验证 10,000 行下虚拟化渲染、排序、选择、列宽调整与固定列的性能预算。
 * 实现是一次性的测量脚手架，不进入 @zui/react，也不作为 DataGrid 的实现起点。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DataGridPrototype.css';

const ROW_COUNT = 10_000;
const ROW_HEIGHT = 40;
const OVERSCAN = 6;
const HEADER_HEIGHT = 44;

interface Row {
  id: number;
  name: string;
  region: string;
  owner: string;
  amount: number;
  status: 'active' | 'paused' | 'archived';
  progress: number;
  updatedAt: number;
}

const REGIONS = ['华东', '华北', '华南', '西南'];
const OWNERS = ['林晓', '陈默', '王一舟', '赵青禾', '孙砚'];
const STATUSES = ['active', 'paused', 'archived'] as const;

/** 确定性伪随机，保证每次加载数据一致 */
function makeRows(): Row[] {
  const rows: Row[] = [];
  let seed = 42;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let index = 0; index < ROW_COUNT; index += 1) {
    rows.push({
      id: 100000 + index,
      name: `工单 ${index + 1}`,
      region: REGIONS[Math.floor(next() * REGIONS.length)],
      owner: OWNERS[Math.floor(next() * OWNERS.length)],
      amount: Math.floor(next() * 100000) / 10,
      status: STATUSES[Math.floor(next() * STATUSES.length)],
      progress: Math.floor(next() * 101),
      updatedAt: 1760000000000 + Math.floor(next() * 3_000_000_000),
    });
  }
  return rows;
}

const ALL_ROWS = makeRows();

type SortKey = 'id' | 'name' | 'region' | 'owner' | 'amount' | 'progress' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const DEFAULT_WIDTHS = [52, 120, 96, 110, 110, 104, 120, 168, 150];

interface Metrics {
  sortMs: number | null;
  selectMs: number | null;
  resizeFrameMs: number | null;
  renderedRows: number;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function DataGridPrototype(): React.ReactNode {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'id', dir: 'asc' });
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [widths, setWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const [metrics, setMetrics] = useState<Metrics>({
    sortMs: null,
    selectMs: null,
    resizeFrameMs: null,
    renderedRows: 0,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const resizeSampleFrame = useRef(0);
  const resizeState = useRef<{
    pointerId: number;
    columnIndex: number;
    startX: number;
    startWidth: number;
    worstFrame: number;
    ended: boolean;
  } | null>(null);

  useEffect(
    () => () => {
      cancelAnimationFrame(resizeSampleFrame.current);
      delete document.documentElement.dataset.zDatagridResizing;
    },
    []
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    setViewportHeight(element.clientHeight);
    return () => observer.disconnect();
  }, []);

  // 排序：计算耗时入库（渲染由 React 调度，端到端延迟由 e2e 双 rAF 测量）
  const sortedRows = useMemo(() => {
    const copy = [...ALL_ROWS];
    const { key, dir } = sort;
    copy.sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (typeof left === 'number' && typeof right === 'number') {
        return dir === 'asc' ? left - right : right - left;
      }
      const order = String(left).localeCompare(String(right), 'zh-Hans-CN');
      return dir === 'asc' ? order : -order;
    });
    return copy;
  }, [sort]);

  const handleSort = useCallback((key: SortKey) => {
    const started = performance.now();
    setSort((previous) =>
      previous.key === key
        ? { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setMetrics((previous) => ({
      ...previous,
      sortMs: performance.now() - started,
    }));
  }, []);

  const toggleRow = useCallback((id: number) => {
    const started = performance.now();
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMetrics((previous) => ({ ...previous, selectMs: performance.now() - started }));
  }, []);

  const toggleAll = useCallback(() => {
    const started = performance.now();
    setSelected((previous) =>
      previous.size === ALL_ROWS.length ? new Set() : new Set(ALL_ROWS.map((row) => row.id))
    );
    setMetrics((previous) => ({ ...previous, selectMs: performance.now() - started }));
  }, []);

  // 测量收到列宽更新输入到下一帧的延迟，包含 React 提交与等待绘制。
  // pointermove 之间的间隔包含用户停顿/测试驱动等待，不能用作渲染耗时。
  const startResize = (columnIndex: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = {
      pointerId: event.pointerId,
      columnIndex,
      startX: event.clientX,
      startWidth: widths[columnIndex],
      worstFrame: 0,
      ended: false,
    };
    document.documentElement.dataset.zDatagridResizing = '';
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const started = performance.now();
    const nextWidth = Math.max(60, state.startWidth + (event.clientX - state.startX));
    setWidths((previous) => {
      const next = [...previous];
      next[state.columnIndex] = Math.round(nextWidth);
      return next;
    });
    if (resizeSampleFrame.current === 0) {
      resizeSampleFrame.current = requestAnimationFrame(() => {
        resizeSampleFrame.current = 0;
        state.worstFrame = Math.max(state.worstFrame, performance.now() - started);
        if (state.ended) {
          setMetrics((previous) => ({
            ...previous,
            resizeFrameMs: Math.round(state.worstFrame * 100) / 100,
          }));
        }
      });
    }
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    state.ended = true;
    if (resizeSampleFrame.current === 0) {
      setMetrics((previous) => ({
        ...previous,
        resizeFrameMs: Math.round(state.worstFrame * 100) / 100,
      }));
    }
    resizeState.current = null;
    delete document.documentElement.dataset.zDatagridResizing;
  };

  // 虚拟化窗口
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const lastVisible = Math.min(sortedRows.length, firstVisible + visibleCount);
  const windowRows = sortedRows.slice(firstVisible, lastVisible);
  const totalSelected = selected.size;
  const allSelected = totalSelected === ALL_ROWS.length;

  useEffect(() => {
    setMetrics((previous) => ({ ...previous, renderedRows: windowRows.length }));
  }, [windowRows.length]);

  const domNodes = gridRef.current?.querySelectorAll('*').length ?? 0;
  const columnsValue = widths.map((width) => `${width}px`).join(' ');

  const columns: Array<{
    key: SortKey | null;
    label: string;
    sortable?: boolean;
    render: (row: Row) => React.ReactNode;
  }> = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (row) => row.id,
    },
    { key: 'name', label: '名称', sortable: true, render: (row) => row.name },
    { key: 'region', label: '区域', sortable: true, render: (row) => row.region },
    { key: 'owner', label: '负责人', sortable: true, render: (row) => row.owner },
    {
      key: 'amount',
      label: '金额',
      sortable: true,
      render: (row) => `¥${row.amount.toLocaleString('zh-CN')}`,
    },
    { key: null, label: '状态', render: (row) => row.status },
    { key: 'progress', label: '进度', sortable: true, render: (row) => `${row.progress}%` },
    {
      key: 'updatedAt',
      label: '更新时间',
      sortable: true,
      render: (row) => formatDate(row.updatedAt),
    },
  ];

  return (
    <div className="datagrid-prototype" data-testid="datagrid-prototype">
      <h1>DataGrid 性能原型</h1>
      <p className="datagrid-prototype-lead">
        10,000 行 × 9 列；验证虚拟化渲染、排序、选择、列宽拖动与固定列（RFC-005
        立项前置）。本页是一次性测量脚手架，不进入组件库。
      </p>

      <section className="datagrid-prototype-hud" aria-label="性能指标">
        <span data-testid="metric-rows">
          渲染行数 {metrics.renderedRows} / {ROW_COUNT}
        </span>
        <span data-testid="metric-dom">DOM 节点 {domNodes}</span>
        <span data-testid="metric-selected">已选 {totalSelected}</span>
        <span data-testid="metric-sort">
          排序耗时 {metrics.sortMs == null ? '—' : `${metrics.sortMs.toFixed(2)}ms`}
        </span>
        <span data-testid="metric-select">
          选择耗时 {metrics.selectMs == null ? '—' : `${metrics.selectMs.toFixed(2)}ms`}
        </span>
        <span data-testid="metric-resize">
          列宽更新延迟 {metrics.resizeFrameMs == null ? '—' : `${metrics.resizeFrameMs}ms`}
        </span>
      </section>

      <div
        ref={gridRef}
        className="datagrid-prototype-grid"
        role="grid"
        aria-label="性能原型表格"
        aria-rowcount={ROW_COUNT}
      >
        <div
          className="datagrid-prototype-header"
          role="row"
          style={{ display: 'grid', gridTemplateColumns: columnsValue, height: HEADER_HEIGHT }}
        >
          <div
            role="columnheader"
            className="datagrid-prototype-cell datagrid-prototype-cell--sticky datagrid-prototype-select"
            style={{ left: 0, width: widths[0] }}
          >
            <input
              type="checkbox"
              data-testid="select-all"
              aria-label="全选"
              checked={allSelected}
              onChange={toggleAll}
            />
          </div>
          {columns.map((column, index) => {
            const columnIndex = index + 1;
            const sorted = sort.key === column.key;
            return (
              <div
                key={column.key ?? index}
                role="columnheader"
                aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`datagrid-prototype-cell${columnIndex === 1 ? ' datagrid-prototype-cell--sticky datagrid-prototype-cell--sticky-second' : ''}`}
                style={{
                  left: columnIndex === 1 ? widths[0] : undefined,
                  width: widths[columnIndex],
                }}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    data-testid={`sort-${column.key}`}
                    className="datagrid-prototype-sort"
                    onClick={() => handleSort(column.key as SortKey)}
                  >
                    {column.label}
                    <span aria-hidden="true" className="datagrid-prototype-sort-arrow">
                      {sorted ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
                {columnIndex > 0 ? (
                  <div
                    data-testid={`resize-${column.key ?? index}`}
                    role="separator"
                    aria-label={`调整 ${column.label} 列宽`}
                    aria-orientation="vertical"
                    className="datagrid-prototype-resize"
                    onPointerDown={startResize(columnIndex)}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          ref={viewportRef}
          data-testid="datagrid-viewport"
          className="datagrid-prototype-viewport"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: sortedRows.length * ROW_HEIGHT, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: firstVisible * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {windowRows.map((row) => (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={row.id - 100000 + 1}
                  data-selected={selected.has(row.id) ? 'true' : undefined}
                  className="datagrid-prototype-row"
                  style={{ display: 'grid', gridTemplateColumns: columnsValue, height: ROW_HEIGHT }}
                >
                  <div
                    role="gridcell"
                    className="datagrid-prototype-cell datagrid-prototype-cell--sticky datagrid-prototype-select"
                    style={{ left: 0, width: widths[0] }}
                  >
                    <input
                      type="checkbox"
                      data-testid={`row-select-${row.id}`}
                      aria-label={`选择 ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </div>
                  {columns.map((column, index) => {
                    const columnIndex = index + 1;
                    return (
                      <div
                        key={column.key ?? index}
                        role="gridcell"
                        className={`datagrid-prototype-cell${columnIndex === 1 ? ' datagrid-prototype-cell--sticky datagrid-prototype-cell--sticky-second' : ''}`}
                        style={{
                          left: columnIndex === 1 ? widths[0] : undefined,
                          width: widths[columnIndex],
                        }}
                      >
                        {column.render(row)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
