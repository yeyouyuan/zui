'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Transfer.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TransferItem {
  key: string;
  title: React.ReactNode;
  disabled?: boolean;
}

export interface TransferProps {
  dataSource: TransferItem[];
  targetKeys?: string[];
  defaultTargetKeys?: string[];
  onChange?: (keys: string[]) => void;
  titles?: [string, string]; // 默认 [locale.accessibility.sourceList,locale.accessibility.targetList]
  showSearch?: boolean;
  className?: string;
  classNames?: { root?: string; list?: string; item?: string; buttons?: string };
  'aria-label'?: string;
}

/* --------------------------------- 工具 ---------------------------------- */

/** 过滤用纯文本：字符串/数字 title 取自身，复杂节点回退 key */
function getItemText(item: TransferItem): string {
  const { title, key } = item;
  if (typeof title === 'string') return title;
  if (typeof title === 'number') return String(title);
  return key;
}

/** 按 dataSource 原始顺序整理 key 列表（去重） */
function sortBySource(keys: string[], dataSource: TransferItem[]): string[] {
  const set = new Set(keys);
  return dataSource.filter((item) => set.has(item.key)).map((item) => item.key);
}

/* -------------------------------- 穿梭框 --------------------------------- */

export function Transfer(props: TransferProps) {
  const {
    dataSource,
    targetKeys,
    defaultTargetKeys = [],
    onChange,
    titles,
    showSearch = false,
    className,
    classNames,
    'aria-label': ariaLabel,
  } = props;

  const { locale } = useZuiConfig();

  const [target, setTarget] = useControllableState<string[]>({
    value: targetKeys,
    defaultValue: defaultTargetKeys,
    onChange,
  });

  const targetSet = React.useMemo(() => new Set(target), [target]);
  const sourceItems = dataSource.filter((item) => !targetSet.has(item.key));
  const targetItems = dataSource.filter((item) => targetSet.has(item.key));

  const [sourceChecked, setSourceChecked] = React.useState<string[]>([]);
  const [targetChecked, setTargetChecked] = React.useState<string[]>([]);
  const [sourceQuery, setSourceQuery] = React.useState('');
  const [targetQuery, setTargetQuery] = React.useState('');

  const listRefs = {
    source: React.useRef<HTMLUListElement>(null),
    target: React.useRef<HTMLUListElement>(null),
  };

  const filterItems = (items: TransferItem[], query: string) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => getItemText(item).toLowerCase().includes(keyword));
  };

  const visibleSource = filterItems(sourceItems, sourceQuery);
  const visibleTarget = filterItems(targetItems, targetQuery);

  /* ------------------------------ 选择操作 ------------------------------- */

  const toggleChecked = (side: 'source' | 'target', key: string, checked: boolean) => {
    const setter = side === 'source' ? setSourceChecked : setTargetChecked;
    setter((prev) => (checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));
  };

  const toggleAll = (side: 'source' | 'target') => {
    const items = side === 'source' ? sourceItems : targetItems;
    const checked = side === 'source' ? sourceChecked : targetChecked;
    const enabledKeys = items.filter((item) => !item.disabled).map((item) => item.key);
    const allChecked = enabledKeys.length > 0 && enabledKeys.every((k) => checked.includes(k));
    const next = allChecked ? [] : enabledKeys;
    if (side === 'source') setSourceChecked(next);
    else setTargetChecked(next);
  };

  const movable = (side: 'source' | 'target') => {
    const items = side === 'source' ? sourceItems : targetItems;
    const checked = side === 'source' ? sourceChecked : targetChecked;
    return checked.filter((key) => {
      const item = items.find((i) => i.key === key);
      return item && !item.disabled;
    });
  };

  const move = (direction: 'right' | 'left') => {
    const moving = movable(direction === 'right' ? 'source' : 'target');
    if (moving.length === 0) return;
    const next =
      direction === 'right'
        ? sortBySource([...target, ...moving], dataSource)
        : target.filter((key) => !moving.includes(key));
    setTarget(next);
    if (direction === 'right') setSourceChecked([]);
    else setTargetChecked([]);
  };

  /* ------------------------------ 键盘导航 ------------------------------- */

  const onListKeyDown = (side: 'source' | 'target') => (event: React.KeyboardEvent<HTMLUListElement>) => {
    const list = listRefs[side].current;
    if (!list) return;
    const inputs = Array.from(
      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(:disabled)')
    );
    if (inputs.length === 0) return;
    const currentIndex = inputs.findIndex((input) => input === document.activeElement);
    let nextIndex = -1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = currentIndex < 0 ? 0 : Math.min(inputs.length - 1, currentIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = currentIndex < 0 ? inputs.length - 1 : Math.max(0, currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = inputs.length - 1;
        break;
      default:
        return;
    }
    inputs[nextIndex]?.focus();
  };

  /* -------------------------------- 渲染 --------------------------------- */

  const renderList = (side: 'source' | 'target') => {
    const isSource = side === 'source';
    const sideTitle = isSource ? titles?.[0] ?? locale.accessibility.sourceList : titles?.[1] ?? locale.accessibility.targetList;
    const items = isSource ? sourceItems : targetItems;
    const visible = isSource ? visibleSource : visibleTarget;
    const checked = isSource ? sourceChecked : targetChecked;
    const query = isSource ? sourceQuery : targetQuery;
    const enabledKeys = items.filter((item) => !item.disabled).map((item) => item.key);
    const allChecked = enabledKeys.length > 0 && enabledKeys.every((k) => checked.includes(k));
    const indeterminate = !allChecked && enabledKeys.some((k) => checked.includes(k));

    return (
      <div
        data-part="list"
        className={cx('z-transfer-list', classNames?.list)}
        data-side={side}
      >
        <div data-part="header" className="z-transfer-list-header">
          <label className="z-transfer-checkbox">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(node) => {
                if (node) node.indeterminate = indeterminate;
              }}
              aria-checked={indeterminate ? 'mixed' : undefined}
              aria-label={isSource ? locale.accessibility.selectAllSource : locale.accessibility.selectAllTarget}
              disabled={enabledKeys.length === 0}
              onChange={() => toggleAll(side)}
            />
            <span data-part="checkbox" className="z-transfer-checkbox-box" aria-hidden="true" />
          </label>
          <span className="z-transfer-list-title">{sideTitle}</span>
          <span className="z-transfer-list-count">
            {checked.length}/{items.length}
          </span>
        </div>

        {showSearch ? (
          <div data-part="search" className="z-transfer-search">
            <svg
              className="z-transfer-search-icon"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M11.5 11.5L14 14M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="search"
              className="z-transfer-search-input"
              value={query}
              placeholder={locale.transfer.search}
              aria-label={isSource ? locale.accessibility.searchSource : locale.accessibility.searchTarget}
              disabled={false}
              onChange={(event) =>
                isSource ? setSourceQuery(event.target.value) : setTargetQuery(event.target.value)
              }
            />
          </div>
        ) : null}

        <ul
          ref={listRefs[side]}
          role="listbox"
          aria-multiselectable="true"
          aria-label={sideTitle}
          className="z-transfer-list-body"
          onKeyDown={onListKeyDown(side)}
        >
          {visible.length === 0 ? (
            <li className="z-transfer-empty">{locale.empty.description}</li>
          ) : (
            visible.map((item) => {
              const itemChecked = checked.includes(item.key);
              return (
                <li
                  key={item.key}
                  role="option"
                  data-part="item"
                  className={cx('z-transfer-item', classNames?.item)}
                  aria-selected={itemChecked}
                  aria-disabled={item.disabled ? true : undefined}
                  data-checked={itemChecked ? 'true' : undefined}
                  data-disabled={item.disabled ? 'true' : undefined}
                >
                  <label className="z-transfer-item-label">
                    <input
                      type="checkbox"
                      checked={itemChecked}
                      disabled={item.disabled}
                      onChange={(event) => toggleChecked(side, item.key, event.target.checked)}
                    />
                    <span data-part="checkbox" className="z-transfer-checkbox-box" aria-hidden="true" />
                    <span className="z-transfer-item-title">{item.title}</span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  };

  return (
    <div
      data-part="root"
      className={cx('z-transfer', classNames?.root, className)}
      aria-label={ariaLabel}
    >
      {renderList('source')}

      <div data-part="buttons" className={cx('z-transfer-buttons', classNames?.buttons)}>
        <button
          type="button"
          className="z-transfer-button"
          aria-label={locale.transfer.moveRight}
          disabled={movable('source').length === 0}
          onClick={() => move('right')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              d="M6 3l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="z-transfer-button"
          aria-label={locale.transfer.moveLeft}
          disabled={movable('target').length === 0}
          onClick={() => move('left')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              d="M10 3L5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {renderList('target')}
    </div>
  );
}
