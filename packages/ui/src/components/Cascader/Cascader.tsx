'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './Cascader.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface CascaderOption {
  value: string;
  label: React.ReactNode;
  children?: CascaderOption[];
  disabled?: boolean;
}

export interface CascaderProps {
  options: CascaderOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (path: string[]) => void;
  placeholder?: string; // 默认 '请选择'
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg'; // 默认 'md'
  showSearch?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    trigger?: string;
    panel?: string;
    menu?: string;
    item?: string;
  };
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/* --------------------------------- 工具 ---------------------------------- */

/** 按高亮路径展开列：第 0 列为 options，后续列为高亮项的 children */
function getColumns(options: CascaderOption[], activePath: string[]): CascaderOption[][] {
  const columns: CascaderOption[][] = [options];
  let current = options;
  for (const value of activePath) {
    const node = current.find((option) => option.value === value);
    if (node && node.children && node.children.length > 0) {
      columns.push(node.children);
      current = node.children;
    } else {
      break;
    }
  }
  return columns;
}

/** 沿路径解析出各段 label */
function resolveLabels(options: CascaderOption[], path: string[]): React.ReactNode[] {
  const labels: React.ReactNode[] = [];
  let current = options;
  for (const value of path) {
    const node = current.find((option) => option.value === value);
    if (!node) break;
    labels.push(node.label);
    current = node.children ?? [];
  }
  return labels;
}

interface FlatEntry {
  path: string[];
  labels: React.ReactNode[];
  text: string;
  disabled?: boolean;
}

/** 展平全部节点（含路径），供 showSearch 搜索 */
function flattenOptions(options: CascaderOption[]): FlatEntry[] {
  const result: FlatEntry[] = [];
  const walk = (list: CascaderOption[], path: string[], labels: React.ReactNode[]) => {
    for (const option of list) {
      const nextPath = [...path, option.value];
      const nextLabels = [...labels, option.label];
      result.push({
        path: nextPath,
        labels: nextLabels,
        // 可搜索文本：label 文本 + 路径 value（复杂 label 节点回退 value 匹配）
        text: [
          ...nextLabels.map((label) =>
            typeof label === 'string' || typeof label === 'number' ? String(label) : ''
          ),
          ...nextPath,
        ].join(' '),
        disabled: option.disabled,
      });
      if (option.children?.length) walk(option.children, nextPath, nextLabels);
    }
  };
  walk(options, [], []);
  return result;
}

/* --------------------------------- 级联 ---------------------------------- */

export function Cascader(props: CascaderProps) {
  const { locale } = useZuiConfig();
  const {
    options,
    value,
    defaultValue,
    onChange,
    placeholder = locale.select.placeholder,
    disabled = false,
    size = 'md',
    showSearch = false,
    className,
    classNames,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const baseId = React.useId();
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;
  const optionId = (columnIndex: number, optionIndex: number) =>
    `${baseId}-option-${columnIndex}-${optionIndex}`;
  const searchOptionId = (optionIndex: number) => `${baseId}-search-option-${optionIndex}`;

  const [open, setOpen] = React.useState(false);
  const [activePath, setActivePath] = React.useState<string[]>([]);
  const [focusCol, setFocusCol] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [searchActive, setSearchActive] = React.useState(0);

  const [path, setPath] = useControllableState<string[]>({
    value,
    defaultValue: defaultValue ?? [],
    onChange,
  });

  const columns = getColumns(options, activePath);
  const valueLabels = resolveLabels(options, path);
  const searchMode = showSearch && query.trim() !== '';
  const searchResults = React.useMemo(() => {
    if (!searchMode) return [];
    const keyword = query.trim().toLowerCase();
    return flattenOptions(options).filter((entry) => entry.text.toLowerCase().includes(keyword));
  }, [searchMode, query, options]);

  /* ---------------------------- 打开/关闭/选中 ---------------------------- */

  const openPanel = () => {
    if (disabled) return;
    setActivePath([...path]);
    setFocusCol(0);
    setQuery('');
    setSearchActive(0);
    setOpen(true);
  };

  const closePanel = (refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };

  const commit = (next: string[]) => {
    setPath(next);
    closePanel(true);
  };

  /** 当前列的选项清单与高亮项 */
  const colState = (colIndex: number) => {
    const list = columns[colIndex] ?? [];
    const activeValue = activePath[colIndex];
    const activeIndex = list.findIndex((option) => option.value === activeValue);
    return { list, activeIndex };
  };

  /** 列内移动高亮（跳过 disabled，端点夹紧） */
  const moveActive = (colIndex: number, delta: 1 | -1) => {
    const { list, activeIndex } = colState(colIndex);
    if (list.length === 0) return;
    let next = activeIndex < 0 ? (delta > 0 ? -1 : list.length) : activeIndex;
    for (let step = 0; step < list.length; step += 1) {
      next = Math.min(list.length - 1, Math.max(0, next + delta));
      if (!list[next].disabled) break;
      if (next === 0 || next === list.length - 1) break;
    }
    const option = list[next];
    if (!option || option.disabled) return;
    setActivePath([...activePath.slice(0, colIndex), option.value]);
    setFocusCol(colIndex);
  };

  /** 列内首/尾可用项 */
  const jumpActive = (colIndex: number, edge: 'first' | 'last') => {
    const { list } = colState(colIndex);
    const candidates = edge === 'first' ? list : [...list].reverse();
    const option = candidates.find((item) => !item.disabled);
    if (!option) return;
    setActivePath([...activePath.slice(0, colIndex), option.value]);
    setFocusCol(colIndex);
  };

  /** 激活某列某项：有子级则展开下一列，否则作为叶子选中 */
  const activate = (colIndex: number, option: CascaderOption) => {
    if (option.disabled) return;
    const nextPath = [...activePath.slice(0, colIndex), option.value];
    if (option.children && option.children.length > 0) {
      setActivePath(nextPath);
      setFocusCol(colIndex + 1);
    } else {
      commit(nextPath);
    }
  };

  /* ------------------------------ 键盘导航 ------------------------------- */

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (searchMode) return; // 搜索模式键盘由搜索框处理
    const { key } = event;
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(Math.min(focusCol, columns.length - 1), 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(Math.min(focusCol, columns.length - 1), -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (focusCol + 1 < columns.length) setFocusCol(focusCol + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        setFocusCol(Math.max(0, focusCol - 1));
        break;
      case 'Home':
        event.preventDefault();
        jumpActive(Math.min(focusCol, columns.length - 1), 'first');
        break;
      case 'End':
        event.preventDefault();
        jumpActive(Math.min(focusCol, columns.length - 1), 'last');
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const { list, activeIndex } = colState(Math.min(focusCol, columns.length - 1));
        const option = list[activeIndex];
        if (option) activate(Math.min(focusCol, columns.length - 1), option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        closePanel(true);
        break;
      case 'Tab':
        closePanel(false);
        break;
      default:
        break;
    }
  };

  /* --------------------------- 搜索模式键盘 ------------------------------ */

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchMode) return;
    const native = event.nativeEvent as KeyboardEvent & {
      isComposing?: boolean;
      keyCode?: number;
    };
    if (native.isComposing || native.keyCode === 229) return;
    const { key } = event;
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setSearchActive((prev) => Math.min(searchResults.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSearchActive((prev) => Math.max(0, prev - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const entry = searchResults[searchActive];
        if (entry && !entry.disabled) commit(entry.path);
        break;
      }
      case 'Escape':
        event.preventDefault();
        closePanel(true);
        break;
      case 'Tab':
        closePanel(false);
        break;
      default:
        break;
    }
  };

  /* ------------------------------- 副作用 -------------------------------- */

  // 打开后焦点移入面板（键盘交互从面板开始）
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // 高亮项跟随滚动
  React.useEffect(() => {
    if (!open || searchMode) return;
    const key = activePath[focusCol];
    if (key != null) itemRefs.current[key]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, searchMode, activePath, focusCol]);

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => closePanel(false), open);

  const focusedColumnIndex = Math.min(focusCol, columns.length - 1);
  const focusedOptionIndex = (columns[focusedColumnIndex] ?? []).findIndex(
    (option) => option.value === activePath[focusedColumnIndex]
  );
  const activeDescendantId = !open
    ? undefined
    : searchMode
      ? searchActive >= 0 && searchActive < searchResults.length
        ? searchOptionId(searchActive)
        : undefined
      : focusedOptionIndex >= 0
        ? optionId(focusedColumnIndex, focusedOptionIndex)
        : undefined;

  /* -------------------------------- 渲染 --------------------------------- */

  const renderColumns = () => (
    <div className="z-cascader-menus">
      {columns.map((list, colIndex) => (
        <div
          key={colIndex}
          role="listbox"
          data-part="menu"
          className={cx('z-cascader-menu', classNames?.menu)}
          aria-label={locale.accessibility.column.replace('{index}', String(colIndex + 1))}
          data-focused={focusCol === colIndex ? 'true' : undefined}
        >
          {list.map((option, optionIndex) => {
            const selected = path[colIndex] === option.value;
            const active = activePath[colIndex] === option.value;
            return (
              <div
                key={option.value}
                id={optionId(colIndex, optionIndex)}
                role="option"
                data-part="item"
                className={cx('z-cascader-item', classNames?.item)}
                aria-selected={selected}
                aria-disabled={option.disabled ? true : undefined}
                data-active={active ? 'true' : undefined}
                ref={(element) => {
                  itemRefs.current[option.value] = element;
                }}
                onMouseDown={(event) => {
                  // 防止点击选项时面板失焦
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  if (option.disabled) return;
                  setActivePath([...activePath.slice(0, colIndex), option.value]);
                }}
                onClick={() => activate(colIndex, option)}
              >
                <span className="z-cascader-item-label">{option.label}</span>
                {option.children && option.children.length > 0 ? (
                  <svg
                    className="z-cascader-item-arrow"
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const renderSearch = () => (
    <div
      role="listbox"
      data-part="menu"
      className={cx('z-cascader-menu', 'z-cascader-search-results', classNames?.menu)}
      aria-label={locale.accessibility.searchResults}
    >
      {searchResults.length === 0 ? (
        <div className="z-cascader-empty">{locale.accessibility.noMatch}</div>
      ) : (
        searchResults.map((entry, index) => (
          <div
            key={entry.path.join('/')}
            id={searchOptionId(index)}
            role="option"
            data-part="item"
            className={cx('z-cascader-item', classNames?.item)}
            aria-selected={path.join('/') === entry.path.join('/')}
            aria-disabled={entry.disabled ? true : undefined}
            data-active={searchActive === index ? 'true' : undefined}
            ref={(element) => {
              itemRefs.current[`search-${index}`] = element;
            }}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onMouseEnter={() => setSearchActive(index)}
            onClick={() => {
              if (!entry.disabled) commit(entry.path);
            }}
          >
            <span className="z-cascader-item-label">
              {entry.labels.map((label, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="z-cascader-item-separator"> / </span> : null}
                  {label}
                </React.Fragment>
              ))}
            </span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-cascader', classNames?.root, className)}
      data-open={open ? 'true' : 'false'}
      data-size={size}
      data-disabled={disabled ? 'true' : undefined}
    >
      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        data-part="trigger"
        className={cx('z-cascader-trigger', classNames?.trigger)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => (open ? closePanel(false) : openPanel())}
        onKeyDown={(event) => {
          if (disabled) return;
          if (!open && (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            openPanel();
          } else if (!open && event.key === 'Escape') {
            // 关闭态无事可做
          } else if (open && event.key === 'Escape') {
            event.preventDefault();
            closePanel(true);
          }
        }}
      >
        <span
          className="z-cascader-value"
          data-placeholder={valueLabels.length === 0 ? '' : undefined}
        >
          {valueLabels.length === 0
            ? placeholder
            : valueLabels.map((label, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="z-cascader-value-separator"> / </span> : null}
                  {label}
                </React.Fragment>
              ))}
        </span>
        <svg
          className="z-cascader-arrow"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <FloatingPanel open={open} anchorRef={rootRef} focusOnOpen offsetVariable="--z-cascader-panel-margin-top">
        <div
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        data-part="panel"
        className={cx('z-cascader-panel', classNames?.panel)}
        data-open={open ? 'true' : 'false'}
        aria-activedescendant={searchMode ? undefined : activeDescendantId}
        onKeyDown={onKeyDown}
      >
        {showSearch ? (
          <div className="z-cascader-search">
            <input
              type="search"
              className="z-cascader-search-input"
              value={query}
              placeholder={locale.transfer.search}
              aria-label={locale.accessibility.searchCascader}
              aria-activedescendant={searchMode ? activeDescendantId : undefined}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchActive(0);
              }}
              onKeyDown={onSearchKeyDown}
            />
          </div>
        ) : null}
        {searchMode ? renderSearch() : renderColumns()}
      </div>
      </FloatingPanel>
    </div>
  );
}
