'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './TimePicker.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TimePickerProps {
  value?: string; // 'HH:mm' 或 'HH:mm:ss'
  defaultValue?: string;
  onChange?: (time: string) => void; // 按 format 输出
  format?: 'HH:mm' | 'HH:mm:ss'; // 默认 'HH:mm'
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg'; // 默认 'md'
  className?: string;
  classNames?: {
    root?: string;
    trigger?: string;
    panel?: string;
    column?: string;
    item?: string;
  };
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

type TimeUnit = 'hour' | 'minute' | 'second';

interface TimeValue {
  hour: number;
  minute: number;
  second: number;
}

/* --------------------------------- 工具 ---------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** 解析 'HH:mm[:ss]'，非法输入回退 00:00:00（边界 clamp） */
function parseTime(input: string | undefined): TimeValue {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec((input ?? '').trim());
  if (!match) return { hour: 0, minute: 0, second: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2]))),
    second: Math.min(59, Math.max(0, Number(match[3] ?? 0))),
  };
}

/** 按 format 序列化 */
function formatTime(time: TimeValue, format: 'HH:mm' | 'HH:mm:ss'): string {
  const base = `${pad(time.hour)}:${pad(time.minute)}`;
  return format === 'HH:mm:ss' ? `${base}:${pad(time.second)}` : base;
}

const UNIT_MAX: Record<TimeUnit, number> = { hour: 23, minute: 59, second: 59 };

/* ------------------------------- TimePicker ------------------------------- */

export function TimePicker(props: TimePickerProps) {
  const {
    value,
    defaultValue,
    onChange,
    format = 'HH:mm',
    disabled = false,
    size = 'md',
    className,
    classNames,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const { locale } = useZuiConfig();
  const unitLabels: Record<TimeUnit, string> = {
    hour: locale.timePicker.hour,
    minute: locale.timePicker.minute,
    second: locale.timePicker.second,
  };

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const baseId = React.useId();
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<TimeValue>({ hour: 0, minute: 0, second: 0 });
  const [focusUnit, setFocusUnit] = React.useState<TimeUnit>('hour');

  const [current, setCurrent] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  const units = React.useMemo<TimeUnit[]>(
    () => format === 'HH:mm:ss' ? ['hour', 'minute', 'second'] : ['hour', 'minute'],
    [format]
  );
  const displayTime = current ? formatTime(parseTime(current), format) : '';

  /* ---------------------------- 打开/关闭/确认 ---------------------------- */

  const openPanel = () => {
    if (disabled) return;
    setDraft(parseTime(current));
    setFocusUnit('hour');
    setOpen(true);
  };

  const closePanel = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const confirm = () => {
    setCurrent(formatTime(draft, format));
    closePanel(true);
  };

  /* ------------------------------ 键盘导航 ------------------------------- */

  const scrollUnit = (unit: TimeUnit, delta: 1 | -1) => {
    setDraft((prev) => {
      const max = UNIT_MAX[unit];
      const next = (prev[unit] + delta + max + 1) % (max + 1);
      return { ...prev, [unit]: next };
    });
    setFocusUnit(unit);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const { key } = event;
    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        scrollUnit(focusUnit, -1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        scrollUnit(focusUnit, 1);
        break;
      case 'ArrowLeft': {
        event.preventDefault();
        const index = units.indexOf(focusUnit);
        setFocusUnit(units[Math.max(0, index - 1)]);
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        const index = units.indexOf(focusUnit);
        setFocusUnit(units[Math.min(units.length - 1, index + 1)]);
        break;
      }
      case 'Enter':
        event.preventDefault();
        confirm();
        break;
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

  // 打开后焦点移入面板
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // 当前值跟随滚动
  React.useEffect(() => {
    if (!open) return;
    for (const unit of units) {
      itemRefs.current[`${unit}-${draft[unit]}`]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, draft, units]);

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => closePanel(false), open);

  /* -------------------------------- 渲染 --------------------------------- */

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-time-picker', classNames?.root, className)}
      data-open={open ? 'true' : 'false'}
      data-size={size}
      data-disabled={disabled ? 'true' : undefined}
    >
      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        data-part="trigger"
        className={cx('z-time-picker-trigger', classNames?.trigger)}
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
          } else if (open && event.key === 'Escape') {
            event.preventDefault();
            closePanel(true);
          }
        }}
      >
        <span
          className="z-time-picker-value"
          data-placeholder={displayTime ? undefined : ''}
        >
          {displayTime || locale.timePicker.placeholder}
        </span>
        <svg
          className="z-time-picker-clock-icon"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 4.5V8l2.5 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <FloatingPanel open={open} anchorRef={rootRef} focusOnOpen offsetVariable="--z-time-picker-panel-margin-top">
        <div
        id={panelId}
        ref={panelRef}
        tabIndex={-1}
        data-part="panel"
        className={cx('z-time-picker-panel', classNames?.panel)}
        data-open={open ? 'true' : 'false'}
        onKeyDown={onKeyDown}
      >
        {units.map((unit) => (
          <div
            key={unit}
            role="listbox"
            data-part="column"
            className={cx('z-time-picker-column', classNames?.column)}
            aria-label={unitLabels[unit]}
            data-unit={unit}
            data-focused={focusUnit === unit ? 'true' : undefined}
          >
            {Array.from({ length: UNIT_MAX[unit] + 1 }, (_, index) => (
              <div
                key={index}
                role="option"
                data-part="item"
                className={cx('z-time-picker-item', classNames?.item)}
                aria-selected={draft[unit] === index}
                data-active={draft[unit] === index ? 'true' : undefined}
                ref={(element) => {
                  itemRefs.current[`${unit}-${index}`] = element;
                }}
                onMouseDown={(event) => {
                  // 防止点击选项时面板失焦
                  event.preventDefault();
                }}
                onClick={() => {
                  setDraft((prev) => ({ ...prev, [unit]: index }));
                  setFocusUnit(unit);
                }}
              >
                {pad(index)}
              </div>
            ))}
          </div>
        ))}
      </div>
      </FloatingPanel>
    </div>
  );
}
