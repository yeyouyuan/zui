'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './VirtualTable.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface VirtualTableColumn<T = Record<string, unknown>> {
  key: string;
  title: React.ReactNode;
  width?: number; // 列宽（px），默认 120
  render?: (row: T) => React.ReactNode; // 自定义单元格内容
  fixed?: 'left' | 'right'; // 固定列（sticky）
  align?: 'left' | 'center' | 'right'; // 单元格对齐方式，默认 left
}

export interface VirtualTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: Array<VirtualTableColumn<T>>;
  rowHeight?: number; // 行高（px），默认 48
  height: number; // 容器高度（px），必填
  overscan?: number; // 可视区上下额外渲染行数，默认 5
  onRowClick?: (row: T) => void;
  className?: string;
  classNames?: { root?: string; header?: string; body?: string; row?: string; cell?: string };
}

/* --------------------------------- 常量 ---------------------------------- */

const DEFAULT_COLUMN_WIDTH = 120;

/* --------------------------------- 工具 ---------------------------------- */

/** requestAnimationFrame 兜底（测试/SSR 环境） */
const scheduleFrame: (cb: () => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16) as unknown as number;

const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

/** SSR 下退化为 useEffect，避免服务端 useLayoutEffect 警告 */
const useIsomorphicLayoutEffect: typeof React.useLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

/** 默认单元格取值：字符串/数字直接渲染，其余交给 render */
function defaultCellValue(row: unknown, key: string): React.ReactNode {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/* ------------------------------ VirtualTable ------------------------------ */

/**
 * 虚拟滚动表格：容器固定 height + body 撑总高度 + 仅渲染可视区窗口行，
 * 滚动经 rAF 合帧更新。固定列用 sticky CSS。独立于 Table 组件。
 */
export function VirtualTable<T = Record<string, unknown>>({
  data,
  columns,
  rowHeight = 48,
  height,
  overscan = 5,
  onRowClick,
  className,
  classNames,
}: VirtualTableProps<T>) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  // 表头真实高度：sticky 表头固定为 --z-virtual-table-header-height（默认 2.5rem），
  // 占据文档流高度，必须计入滚动总高。SSR / jsdom 等无布局环境量不到
  // （getBoundingClientRect 返回 0），保持 null 回退 rowHeight。
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = React.useState<number | null>(null);

  // 挂载及结构性变化后测量表头实际高度，滚动上限按「表头 + 表体」口径计算
  useIsomorphicLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measured = header.getBoundingClientRect().height;
    if (measured > 0) {
      setMeasuredHeaderHeight((prev) => (prev === measured ? prev : measured));
    }
  }, [data.length, height, rowHeight]);

  // 滚动监听：rAF 合帧，避免每次 scroll 都触发渲染
  const flushScroll = React.useCallback(() => {
    frameRef.current = null;
    const el = rootRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const handleScroll = React.useCallback(() => {
    if (frameRef.current != null) return; // 已排队，本帧只处理一次
    frameRef.current = scheduleFrame(flushScroll);
  }, [flushScroll]);

  React.useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelFrame(frameRef.current);
    };
  }, []);

  // 列宽与固定列偏移（多列 fixed 时按累计宽度贴边）
  const columnWidths = columns.map((col) => col.width ?? DEFAULT_COLUMN_WIDTH);
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  const leftOffsets: Array<number | undefined> = [];
  let leftAcc = 0;
  columns.forEach((col, i) => {
    if (col.fixed === 'left') {
      leftOffsets[i] = leftAcc;
      leftAcc += columnWidths[i] ?? 0;
    }
  });
  const rightOffsets: Array<number | undefined> = [];
  let rightAcc = 0;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    if (columns[i]?.fixed === 'right') {
      rightOffsets[i] = rightAcc;
      rightAcc += columnWidths[i] ?? 0;
    }
  }

  // 边缘固定列索引（用于阴影与视觉分界线）
  const lastLeftIndex = columns.reduce((last, col, idx) => (col.fixed === 'left' ? idx : last), -1);
  const firstRightIndex = columns.findIndex((col) => col.fixed === 'right');

  // 可视区窗口：~height/rowHeight + 2*overscan 行
  const totalHeight = data.length * rowHeight;
  // 真实可滚动上限 = 表体总高 + 表头高 - 容器高（表头 sticky 但占文档流，参与滚动范围）。
  // 旧实现用 rowHeight 充当表头高：rowHeight < 表头高（如 32 < 40）时上限偏小，
  // 会把浏览器合法的底部 scrollTop 强行拉回，导致底部行不可达、滚动抖动。
  const headerHeight = measuredHeaderHeight ?? rowHeight;
  const maxScrollTop = Math.max(0, totalHeight + headerHeight - height);
  const effectiveScrollTop = Math.min(scrollTop, maxScrollTop);
  React.useEffect(() => {
    const root = rootRef.current;
    if (root && root.scrollTop > maxScrollTop) {
      root.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
    }
  }, [maxScrollTop]);
  const startIndex = Math.max(0, Math.floor(effectiveScrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    data.length,
    Math.ceil((effectiveScrollTop + height) / rowHeight) + overscan
  );
  const visibleRows = data.slice(startIndex, endIndex);

  return (
    <div
      ref={rootRef}
      data-part="root"
      role="table"
      aria-rowcount={data.length + 1}
      className={cx('z-virtual-table', className, classNames?.root)}
      style={{ height }}
      onScroll={handleScroll}
    >
      {/* 表头：sticky 顶栏 */}
      <div
        ref={headerRef}
        data-part="header"
        role="row"
        aria-rowindex={1}
        className={cx('z-virtual-table-header', classNames?.header)}
        style={{ width: Math.max(totalWidth, 0) }}
      >
        {columns.map((col, i) => (
          <div
            key={col.key}
            data-part="cell"
            role="columnheader"
            className={cx('z-virtual-table-cell', 'z-virtual-table-header-cell', classNames?.cell)}
            style={{
              width: columnWidths[i],
              minWidth: columnWidths[i],
              maxWidth: columnWidths[i],
              left: col.fixed === 'left' ? leftOffsets[i] : undefined,
              right: col.fixed === 'right' ? rightOffsets[i] : undefined,
            }}
            data-fixed={col.fixed}
            data-fixed-edge={
              col.fixed === 'left' && i === lastLeftIndex
                ? 'left'
                : col.fixed === 'right' && i === firstRightIndex
                  ? 'right'
                  : undefined
            }
            data-align={col.align ?? 'left'}
          >
            {col.title}
          </div>
        ))}
      </div>

      {/* 表体：总高度撑出滚动条，窗口行绝对定位 */}
      <div
        data-part="body"
        className={cx('z-virtual-table-body', classNames?.body)}
        style={{ height: totalHeight, width: Math.max(totalWidth, 0) }}
      >
        {visibleRows.map((row, i) => {
          const index = startIndex + i;
          return (
            <div
              key={index}
              data-part="row"
              role="row"
              aria-rowindex={index + 2}
              className={cx('z-virtual-table-row', classNames?.row)}
              style={{ top: index * rowHeight, height: rowHeight, width: Math.max(totalWidth, 0) }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
            >
              {columns.map((col, ci) => (
                <div
                  key={col.key}
                  data-part="cell"
                  role="cell"
                  className={cx('z-virtual-table-cell', classNames?.cell)}
                  style={{
                    width: columnWidths[ci],
                    minWidth: columnWidths[ci],
                    maxWidth: columnWidths[ci],
                    left: col.fixed === 'left' ? leftOffsets[ci] : undefined,
                    right: col.fixed === 'right' ? rightOffsets[ci] : undefined,
                  }}
                  data-fixed={col.fixed}
                  data-fixed-edge={
                    col.fixed === 'left' && ci === lastLeftIndex
                      ? 'left'
                      : col.fixed === 'right' && ci === firstRightIndex
                        ? 'right'
                        : undefined
                  }
                  data-align={col.align ?? 'left'}
                >
                  {col.render ? col.render(row) : defaultCellValue(row, col.key)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
