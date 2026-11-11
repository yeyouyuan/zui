'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Pagination.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface PaginationProps extends Omit<React.ComponentPropsWithRef<'nav'>, 'children'> {
  /** 当前页（受控），1 起始 */
  page?: number;
  /** 初始页（非受控），1 起始 */
  defaultPage?: number;
  /** 页码变化回调（1 起始） */
  onPageChange?: (page: number) => void;
  /** 每页条数，默认 10 */
  pageSize?: number;
  /** 总条数（必填） */
  total: number;
  /** 当前页两侧相邻页码数，默认 1 */
  siblings?: number;
  /** 显示跳页输入框（数字 + Enter 跳页） */
  showJumper?: boolean;
  /** 整体禁用 */
  disabled?: boolean;
  classNames?: { root?: string; item?: string; jumper?: string };
}

/* -------------------------------- 工具函数 -------------------------------- */

/** 收敛到 [1, pageCount] 的合法页码（1 起始） */
function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), pageCount);
}

type PageToken = { type: 'page'; page: number } | { type: 'ellipsis'; gap: 1 | 2 };

/**
 * 省略号折叠：首尾页固定，当前页 ± siblings 之外折叠为 `…`（最多两个，key 用 +1 / +2）。
 */
function buildPageTokens(current: number, pageCount: number, siblings: number): PageToken[] {
  const tokens: PageToken[] = [{ type: 'page', page: 1 }];
  const rangeStart = Math.max(2, current - siblings);
  const rangeEnd = Math.min(pageCount - 1, current + siblings);

  if (rangeStart > 2) tokens.push({ type: 'ellipsis', gap: 1 });
  for (let page = rangeStart; page <= rangeEnd; page += 1) {
    tokens.push({ type: 'page', page });
  }
  if (rangeEnd < pageCount - 1) tokens.push({ type: 'ellipsis', gap: 2 });

  if (pageCount > 1) tokens.push({ type: 'page', page: pageCount });
  return tokens;
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Pagination({
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  pageSize = 10,
  total,
  siblings = 1,
  showJumper = false,
  disabled = false,
  className,
  classNames,
  ref,
  ...rest
}: PaginationProps) {
  const { locale } = useZuiConfig();
  const safePageSize = Math.max(1, Math.trunc(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const safeSiblings = Math.max(0, Math.trunc(siblings) || 0);

  const [rawPage, setPage] = useControllableState<number>({
    value: pageProp,
    defaultValue: clampPage(defaultPage, pageCount),
    onChange: onPageChange,
  });
  const current = clampPage(rawPage, pageCount);

  const changePage = React.useCallback(
    (target: number) => {
      const next = clampPage(target, pageCount);
      // 与原始 page 比较：受控 page 越界（显示被 clamp）时点击可见页仍应触发回调
      if (next !== rawPage) setPage(next);
    },
    [rawPage, pageCount, setPage]
  );

  const [jumperText, setJumperText] = React.useState('');
  const handleJumperKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const raw = event.currentTarget.value.trim();
    if (raw === '') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      const next = clampPage(parsed, pageCount);
      if (next !== rawPage) setPage(next);
    }
    setJumperText('');
  };

  const tokens = buildPageTokens(current, pageCount, safeSiblings);

  return (
    <nav
      {...rest}
      ref={ref}
      role="navigation"
      aria-label={locale.pagination.label}
      data-part="root"
      data-disabled={disabled ? 'true' : undefined}
      className={cx('z-pagination', className, classNames?.root)}
    >
      <button
        type="button"
        data-part="item"
        className={cx('z-pagination-item', classNames?.item)}
        aria-label={locale.pagination.prev}
        disabled={disabled || current <= 1}
        onClick={() => changePage(current - 1)}
      >
        <ChevronLeft />
      </button>

      {tokens.map((token) =>
        token.type === 'page' ? (
          <button
            key={token.page}
            type="button"
            data-part="item"
            className={cx('z-pagination-item', classNames?.item)}
            aria-current={token.page === current ? 'page' : undefined}
            disabled={disabled}
            onClick={() => changePage(token.page)}
          >
            {token.page}
          </button>
        ) : (
          <span
            key={`+${token.gap}`}
            data-part="item"
            aria-hidden="true"
            className={cx('z-pagination-item', 'z-pagination-ellipsis', classNames?.item)}
          >
            …
          </span>
        )
      )}

      <button
        type="button"
        data-part="item"
        className={cx('z-pagination-item', classNames?.item)}
        aria-label={locale.pagination.next}
        disabled={disabled || current >= pageCount}
        onClick={() => changePage(current + 1)}
      >
        <ChevronRight />
      </button>

      {showJumper ? (
        <div data-part="jumper" className={cx('z-pagination-jumper', classNames?.jumper)}>
          <span>{locale.pagination.jumper}</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={jumperText}
            disabled={disabled}
            aria-label={locale.pagination.jumperLabel}
            onChange={(event) => setJumperText(event.target.value)}
            onKeyDown={handleJumperKeyDown}
          />
          <span>{locale.pagination.unit}</span>
        </div>
      ) : null}
    </nav>
  );
}
