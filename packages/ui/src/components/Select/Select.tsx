'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './Select.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string; // 默认 '请选择'
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg'; // 默认 'md'
  status?: 'default' | 'error' | 'success'; // 默认 'default'
  id?: string;
  name?: string; // 渲染隐藏 input 供表单提交
  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    trigger?: string;
    value?: string;
    listbox?: string;
    option?: string;
    empty?: string;
  };
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/* --------------------------------- 工具 ---------------------------------- */

/** typeahead 匹配用纯文本：字符串/数字 label 取自身，复杂节点回退 value */
function getOptionText(option: SelectOption): string {
  const { label, value } = option;
  if (typeof label === 'string') return label;
  if (typeof label === 'number') return String(label);
  return value;
}

/** typeahead 前缀缓冲时长（ms），对齐 APG 惯例 */
const TYPEAHEAD_TIMEOUT = 500;

/* ---------------------------------- Select -------------------------------- */

export function Select(props: SelectProps) {
  const {
    options,
    value,
    defaultValue,
    onChange,
    placeholder,
    disabled = false,
    size = 'md',
    status = 'default',
    id,
    name,
    className,
    style,
    classNames,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  } = props;

  // placeholder 默认值走 locale（显式传入含空串时以传入值为准）
  const { locale } = useZuiConfig();
  const placeholderText = placeholder === undefined ? locale.select.placeholder : placeholder;

  const panelRef = React.useRef<HTMLDivElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLElement | null>>([]);
  const typeaheadRef = React.useRef({ query: '', timer: 0 });

  const baseId = React.useId();
  const triggerId = id ?? `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [currentValue, setCurrentValue] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  const selectedIndex = options.findIndex((option) => option.value === currentValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /* ---------------------------- 打开/关闭/选中 ---------------------------- */

  const openList = (fallback: 'first' | 'last') => {
    let next = -1;
    if (options.length > 0) {
      next = selectedIndex >= 0 ? selectedIndex : fallback === 'last' ? options.length - 1 : 0;
    }
    setActiveIndex(next);
    setOpen(true);
  };

  const closeList = (refocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (refocus) triggerRef.current?.focus();
  };

  const commit = () => {
    const option = options[activeIndex];
    if (!option || option.disabled) return;
    setCurrentValue(option.value);
    closeList(true);
  };

  /* ------------------------------ 键盘导航 ------------------------------- */

  const moveActive = (delta: 1 | -1) => {
    if (options.length === 0) return;
    setActiveIndex((prev) => {
      const base = prev < 0 ? (delta > 0 ? -1 : options.length) : prev;
      return Math.min(options.length - 1, Math.max(0, base + delta));
    });
  };

  /** 首字母 typeahead：单字符重复输入循环匹配，连续输入按前缀匹配。
   *  首次输入含当前位置（快速定位），重复字符从下一位置循环。 */
  const handleTypeahead = (char: string) => {
    const state = typeaheadRef.current;
    window.clearTimeout(state.timer);
    const isRepeat =
      state.query.length > 0 &&
      state.query
        .toLowerCase()
        .split('')
        .every((c) => c === char.toLowerCase());
    const query = isRepeat ? char : state.query + char;
    state.query = query;
    state.timer = window.setTimeout(() => {
      state.query = '';
    }, TYPEAHEAD_TIMEOUT);

    const prefix = query.toLowerCase();
    const total = options.length;
    if (total === 0) return;
    const start = activeIndex < 0 ? 0 : activeIndex;
    const offset = isRepeat ? 1 : 0;
    for (let step = offset; step < total + offset; step += 1) {
      const index = (start + step) % total;
      if (getOptionText(options[index]).toLowerCase().startsWith(prefix)) {
        setActiveIndex(index);
        return;
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    const isSpace = key === ' ' || key === 'Spacebar';
    const isPrintable =
      key.length === 1 && !isSpace && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!open) {
      if (key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp') {
        // preventDefault 抑制 Enter 对按钮的原生 click，避免重复触发
        event.preventDefault();
        openList(key === 'ArrowUp' ? 'last' : 'first');
      } else if (isSpace) {
        // Space 交给原生 click（keyup 触发）打开，避免 keydown/click 双触发
      } else if (isPrintable) {
        setActiveIndex(-1);
        setOpen(true);
        handleTypeahead(key);
      }
      return;
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        if (options.length > 0) setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        if (options.length > 0) setActiveIndex(options.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        commit();
        break;
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        commit();
        break;
      case 'Escape':
        event.preventDefault();
        closeList(true);
        break;
      case 'Tab':
        closeList(false);
        break;
      default:
        if (isPrintable) handleTypeahead(key);
    }
  };

  const onTriggerClick = () => {
    if (disabled) return;
    if (open) closeList(false);
    else openList('first');
  };

  const onOptionMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // 防止点击 option 时触发器失焦
    event.preventDefault();
  };

  const onOptionClick = (index: number) => {
    if (!open) return;
    const option = options[index];
    if (!option || option.disabled) return;
    setCurrentValue(option.value);
    closeList(true);
  };

  /* ------------------------------- 副作用 -------------------------------- */

  // active option 跟随滚动
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => closeList(false), open);

  const activeDescendantId =
    open && activeIndex >= 0 && activeIndex < options.length ? optionId(activeIndex) : undefined;

  /* -------------------------------- 渲染 --------------------------------- */

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-select', classNames?.root, className)}
      data-open={open ? 'true' : 'false'}
      data-size={size}
      data-status={status}
      data-disabled={disabled ? 'true' : undefined}
      style={style}
    >
      {ariaLabel && !ariaLabelledBy ? (
        <span
          id={`${triggerId}-label`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {ariaLabel}
        </span>
      ) : null}
      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        data-part="trigger"
        className={cx('z-select-trigger', classNames?.trigger)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendantId}
        aria-label={ariaLabel}
        aria-labelledby={
          ariaLabelledBy
            ? `${ariaLabelledBy} ${triggerId}-value`
            : ariaLabel
              ? `${triggerId}-label ${triggerId}-value`
              : undefined
        }
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={onTriggerClick}
        onKeyDown={onKeyDown}
      >
        <span
          data-part="value"
          id={`${triggerId}-value`}
          className={cx('z-select-value', classNames?.value)}
          data-placeholder={selectedOption ? undefined : ''}
        >
          {selectedOption ? selectedOption.label : placeholderText}
        </span>
      </button>

      {name ? <input type="hidden" name={name} value={currentValue} disabled={disabled} /> : null}

      <FloatingPanel
        open={open}
        anchorRef={rootRef}
        matchWidth
        offsetVariable="--z-select-listbox-margin-top"
      >
        <div
          ref={panelRef}
          role="listbox"
          id={listboxId}
          data-part="listbox"
          data-open={open ? 'true' : 'false'}
          className={cx('z-select-listbox', classNames?.listbox)}
        >
          {options.length === 0 ? (
            <div data-part="empty" className={cx('z-select-empty', classNames?.empty)}>
              {locale.select.empty}
            </div>
          ) : (
            options.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                id={optionId(index)}
                role="option"
                data-part="option"
                className={cx('z-select-option', classNames?.option)}
                aria-selected={currentValue === option.value}
                aria-disabled={option.disabled ? true : undefined}
                data-active={activeIndex === index ? 'true' : undefined}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                onMouseDown={onOptionMouseDown}
                onClick={() => onOptionClick(index)}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}
