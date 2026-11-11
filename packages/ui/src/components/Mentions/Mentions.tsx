'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './Mentions.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface MentionOption {
  value: string;
  label?: React.ReactNode;
}

export interface MentionsProps {
  options: MentionOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  prefix?: string; // 触发前缀，默认 '@'
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  classNames?: {
    root?: string;
    textarea?: string;
    panel?: string;
    item?: string;
  };
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/* --------------------------------- 工具 ---------------------------------- */

/** 建议匹配用纯文本：字符串/数字 label 取自身，复杂节点回退 value */
function getOptionText(option: MentionOption): string {
  const { label, value } = option;
  if (typeof label === 'string') return label;
  if (typeof label === 'number') return String(label);
  return value;
}

interface MentionTrigger {
  /** 前缀字符在文本中的下标 */
  start: number;
  /** 前缀后的查询词（不含空白） */
  query: string;
}

/**
 * 从光标处向前探测触发态：
 * 光标前形如 `<空白|行首><prefix><无空白查询词>` 时返回触发位置。
 */
function findMention(text: string, pos: number, prefix: string): MentionTrigger | null {
  const before = text.slice(0, pos);
  const atIndex = before.lastIndexOf(prefix);
  if (atIndex < 0) return null;
  const query = before.slice(atIndex + prefix.length);
  if (/^\s*$/.test(prefix)) return null; // 前缀不能是空白
  if (/[\r\n]/.test(query)) return null;
  if (/\s/.test(query)) return null;
  const prevChar = atIndex > 0 ? before[atIndex - 1] : '';
  if (prevChar && !/\s/.test(prevChar)) return null;
  return { start: atIndex, query };
}

/* --------------------------------- 提及 ---------------------------------- */

export function Mentions(props: MentionsProps) {
  const { locale } = useZuiConfig();
  const {
    options,
    value,
    defaultValue,
    onChange,
    prefix = '@',
    rows = 3,
    disabled = false,
    placeholder,
    className,
    classNames,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const panelRef = React.useRef<HTMLDivElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const baseId = React.useId();
  const textareaId = `${baseId}-textarea`;
  const panelId = `${baseId}-panel`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [triggerStart, setTriggerStart] = React.useState(0);
  const [cursorTarget, setCursorTarget] = React.useState<number | null>(null);

  // IME 组合态标记（中文/日文等输入法选词过程中按 Enter/Tab 属于确认候选词）
  const compositionRef = React.useRef(false);

  const [current, setCurrent] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  const filtered = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => getOptionText(option).toLowerCase().includes(keyword));
  }, [options, query]);

  /* ------------------------------ 触发探测 ------------------------------- */

  const updateTrigger = (text: string, pos: number) => {
    const trigger = findMention(text, pos, prefix);
    if (trigger) {
      setTriggerStart(trigger.start);
      setQuery(trigger.query);
      setActiveIndex(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  /* ------------------------------ 插入/关闭 ------------------------------ */

  const closePanel = () => {
    setOpen(false);
  };

  const insert = (option: MentionOption) => {
    const textarea = textareaRef.current;
    const pos = textarea?.selectionStart ?? current.length;
    const inserted = `${option.value} `;
    const next = current.slice(0, triggerStart) + inserted + current.slice(pos);
    setCurrent(next);
    closePanel();
    setCursorTarget(triggerStart + inserted.length);
  };

  /* ------------------------------- 事件 --------------------------------- */

  const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const pos = event.target.selectionStart ?? next.length;
    setCurrent(next);
    if (disabled) return;
    updateTrigger(next, pos);
  };

  const onCompositionStart = () => {
    compositionRef.current = true;
  };

  const onCompositionEnd = () => {
    compositionRef.current = false;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as KeyboardEvent & {
      isComposing?: boolean;
      keyCode?: number;
    };
    // IME 组合态（含部分浏览器的 keyCode 229 兜底）不触发建议导航与提及插入
    if (compositionRef.current || native.isComposing || native.keyCode === 229) return;
    if (disabled || !open) return;
    const { key } = event;
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((prev) => Math.min(filtered.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
        break;
      case 'Enter':
      case 'Tab': {
        const option = filtered[activeIndex];
        if (!option) return;
        event.preventDefault();
        insert(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        closePanel();
        break;
      default:
        break;
    }
  };

  /* ------------------------------- 副作用 -------------------------------- */

  // 插入后把光标定位到插入文本之后
  React.useEffect(() => {
    if (cursorTarget == null) return;
    const textarea = textareaRef.current;
    textarea?.setSelectionRange(cursorTarget, cursorTarget);
    setCursorTarget(null);
  }, [cursorTarget]);

  // 键盘导航激活项时自动平滑滚动到可见区域
  React.useEffect(() => {
    if (open && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, closePanel, open);

  const activeDescendantId = open && filtered.length > 0 ? optionId(activeIndex) : undefined;

  /* -------------------------------- 渲染 --------------------------------- */

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-mentions', classNames?.root, className)}
      data-open={open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : undefined}
    >
      <textarea
        id={textareaId}
        ref={textareaRef}
        data-part="textarea"
        className={cx('z-mentions-textarea', classNames?.textarea)}
        rows={rows}
        value={current}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-activedescendant={activeDescendantId}
        onChange={onTextareaChange}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onKeyDown={onKeyDown}
      />

      {open ? (
        <FloatingPanel open={open} anchorRef={rootRef} matchWidth offsetVariable="--z-mentions-panel-margin-top">
        <div ref={panelRef}
          id={panelId}
          role="listbox"
          data-part="panel"
          className={cx('z-mentions-panel', classNames?.panel)}
          aria-label={locale.accessibility.mentions}
        >
          {filtered.length === 0 ? (
            <div className="z-mentions-empty">{locale.accessibility.noMatch}</div>
          ) : (
            filtered.map((option, index) => (
              <div
                key={option.value}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                id={optionId(index)}
                role="option"
                data-part="item"
                className={cx('z-mentions-item', classNames?.item)}
                aria-selected={activeIndex === index}
                data-active={activeIndex === index ? 'true' : undefined}
                onMouseDown={(event) => {
                  // 防止点击选项时 textarea 失焦
                  event.preventDefault();
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => insert(option)}
              >
                {option.label ?? option.value}
              </div>
            ))
          )}
        </div>
      </FloatingPanel>
      ) : null}
    </div>
  );
}
