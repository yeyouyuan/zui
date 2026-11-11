'use client';

import * as React from 'react';
import { Calendar as CalendarGlyph, ChevronLeft, ChevronRight } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, FloatingPanel, useControllableState, useOnClickOutside } from '../../utils';
import './DatePicker.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface DatePickerProps extends Omit<React.ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'min' | 'max'> {
  /** 选中日期（ISO 'YYYY-MM-DD'） */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** 可选最小日期（ISO，含） */
  min?: string;
  /** 可选最大日期（ISO，含） */
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: {
    root?: string;
    trigger?: string;
    panel?: string;
    day?: string;
    header?: string;
    input?: string;
    icon?: string;
    label?: string;
    nav?: string;
    grid?: string;
    week?: string;
    weekday?: string;
  };
}

/* -------------------------------- 日期工具 -------------------------------- */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → ISO 'YYYY-MM-DD'（本地时区，避免 UTC 偏移） */
function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 严格解析 'YYYY-MM-DD'（校验真实日历日期），非法返回 null */
function parseISO(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function todayDate(): Date {
  return startOfDay(new Date());
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

/** 加减月，日期溢出时 clamp 到月末（1-31 + 1 月 → 2-28/29） */
function addMonths(date: Date, delta: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + delta;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 周内序号：0 = 周一 … 6 = 周日（周一为首日，zh-CN 惯例） */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** 生成 6 周 × 7 天网格（首格为当月 1 日所在周的周一） */
function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = addDays(first, -mondayIndex(first));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) cells.push(addDays(start, i));
  return cells;
}

/* --------------------------------- 图标（@zui/icons） -------------------------- */

function CalendarIcon() {
  return <CalendarGlyph size={16} />;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return direction === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />;
}

/* -------------------------------- DatePicker ------------------------------ */

export function DatePicker(props: DatePickerProps) {
  const {
    value,
    defaultValue,
    onChange,
    min,
    max,
    disabled = false,
    placeholder,
    size = 'md',
    className,
    classNames,
    onBlur,
    onFocus,
    onKeyDown,
    ref: userRef,
    ...inputProps
  } = props;

  const { locale } = useZuiConfig();
  const placeholderText = placeholder ?? locale.date.placeholder;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  // Portal 首帧渲染 null，需等 panel 真正挂载后再激活焦点管理
  const [panelNode, setPanelNode] = React.useState<HTMLDivElement | null>(null);

  const baseId = React.useId();
  const panelId = `${baseId}-panel`;
  const labelId = `${baseId}-label`;

  const [open, setOpen] = React.useState(false);
  const [currentValue, setCurrentValue] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  // 输入框草稿文本（仅在用户输入/聚焦进入编辑态时与显示分离）
  const [draft, setDraft] = React.useState(currentValue);
  // 是否处于编辑态：编辑态下不同步 value 显示，避免 blur 提交时的脏时序
  const editingRef = React.useRef(false);
  // 面板聚焦日期（roving tabindex 的锚点），打开面板时重置到 value / 今天
  const [focusedDate, setFocusedDate] = React.useState<Date>(
    () => parseISO(currentValue) ?? todayDate()
  );

  // 受控值外部变化 → 同步输入框显示（编辑态不打断用户输入）
  React.useEffect(() => {
    if (!editingRef.current) setDraft(currentValue);
  }, [currentValue]);

  const minISO = min !== undefined ? (parseISO(min) ? min : '') : '';
  const maxISO = max !== undefined ? (parseISO(max) ? max : '') : '';

  const isDateDisabled = React.useCallback(
    (iso: string): boolean => {
      if (minISO && iso < minISO) return true;
      if (maxISO && iso > maxISO) return true;
      return false;
    },
    [minISO, maxISO]
  );

  /* ---------------------------- 打开/关闭/选中 ---------------------------- */

  const openPanel = () => {
    if (disabled) return;
    setFocusedDate(parseISO(currentValue) ?? todayDate());
    setOpen(true);
  };

  const closePanel = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const cancelEditing = () => {
    editingRef.current = false;
    setDraft(currentValue);
  };

  const selectDate = (date: Date) => {
    const iso = toISO(date);
    if (isDateDisabled(iso)) return;
    editingRef.current = false;
    if (iso !== currentValue) setCurrentValue(iso);
    setFocusedDate(date);
    closePanel(true);
  };

  /* ---------------------------- 触发器文本输入 ---------------------------- */

  /** Enter / blur 时提交草稿：仅编辑态生效；合法日期统一回写 ISO，否则还原显示 */
  const commitDraft = (): boolean => {
    if (!editingRef.current) return false;
    editingRef.current = false;
    const parsed = parseISO(draft);
    if (draft.trim() === '') {
      setCurrentValue('');
      setDraft('');
      return true;
    }
    if (parsed && !isDateDisabled(toISO(parsed))) {
      const iso = toISO(parsed);
      setFocusedDate(parsed);
      setDraft(iso);
      if (iso !== currentValue) setCurrentValue(iso);
      return true;
    }
    setDraft(currentValue);
    return false;
  };

  /* ------------------------------ 键盘导航 ------------------------------- */

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const { key } = event;
    if (key === 'Enter') {
      // Enter 提交输入框中的 ISO 文本（合法值生效，非法还原），并打开面板
      event.preventDefault();
      const committed = commitDraft();
      if (!open) {
        if (committed) setOpen(true);
        else openPanel();
      }
      return;
    }
    if (key === 'ArrowDown' && !open) {
      event.preventDefault();
      openPanel();
      return;
    }
    if (open) {
      if (key === 'Escape') {
        event.preventDefault();
        cancelEditing();
        closePanel(true);
      } else if (key === 'Tab') {
        closePanel(false);
      }
    }
  };

  /** 点击日期格时不触发输入框 blur 提交（由 selectDate 统一提交） */
  const onDayMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
  };

  /** 日期格键盘导航（挂聚焦格自身，焦点真实落在格子上时最可靠，兼容 AT 的 cell 级焦点） */
  const onGridKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    const focused = focusedDate;
    const move = (next: Date) => {
      event.preventDefault();
      setFocusedDate(next);
    };
    switch (event.key) {
      case 'ArrowLeft': {
        // 周循环：周一 ← 跳到本周日
        move(mondayIndex(focused) === 0 ? addDays(focused, 6) : addDays(focused, -1));
        break;
      }
      case 'ArrowRight': {
        // 周循环：周日 → 跳到本周一
        move(mondayIndex(focused) === 6 ? addDays(focused, -6) : addDays(focused, 1));
        break;
      }
      case 'ArrowUp':
        move(addDays(focused, -7));
        break;
      case 'ArrowDown':
        move(addDays(focused, 7));
        break;
      case 'Home':
        move(new Date(focused.getFullYear(), focused.getMonth(), 1));
        break;
      case 'End':
        move(
          new Date(focused.getFullYear(), focused.getMonth(), daysInMonth(focused.getFullYear(), focused.getMonth()))
        );
        break;
      case 'PageUp':
        move(addMonths(focused, -1));
        break;
      case 'PageDown':
        move(addMonths(focused, 1));
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar': {
        // 选中聚焦日期并关闭（min/max 外禁用不选）
        event.preventDefault();
        selectDate(focused);
        break;
      }
      case 'Escape':
        event.preventDefault();
        cancelEditing();
        closePanel(true);
        break;
      case 'Tab':
        // 真实 Tab：焦点已离开日期格（浏览器先移动焦点再触发 keydown），
        // 关闭面板且不抢焦点；若焦点仍在格上（AT/合成事件），退回触发器
        closePanel(document.activeElement === event.currentTarget);
        break;
      default:
        break;
    }
  };

  /* ------------------------------- 副作用 -------------------------------- */

  // 面板打开 / 聚焦日期变化 → DOM 焦点跟随日期格（roving tabindex）
  React.useEffect(() => {
    if (!open || !panelNode) return;
    const iso = toISO(focusedDate);
    const cell = panelNode.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    cell?.focus();
  }, [open, panelNode, focusedDate]);

  // 点击外部关闭（root 含触发器，panel 在 Portal 内需一并纳入）
  const outsideRefs = React.useMemo(
    () => [rootRef, panelRef],
    []
  );
  useOnClickOutside(outsideRefs, () => closePanel(false), open);

  /* -------------------------------- 渲染 --------------------------------- */

  const viewYear = focusedDate.getFullYear();
  const viewMonth = focusedDate.getMonth();
  const cells = buildMonthGrid(focusedDate);
  const focusedISO = toISO(focusedDate);
  const todayISO = toISO(todayDate());
  const monthLabel = locale.date.monthFormat
    .replace('{year}', String(viewYear))
    .replace('{month}', String(viewMonth + 1));

  const setPanelRef = React.useCallback((element: HTMLDivElement | null) => {
    panelRef.current = element;
    setPanelNode(element);
  }, []);

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-datepicker', classNames?.root, className)}
      data-size={size}
      data-open={open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : undefined}
    >
      <div
        data-part="trigger"
        className={cx('z-datepicker-trigger', classNames?.trigger)}
        data-open={open ? 'true' : 'false'}
      >
        <input
          {...inputProps}
          ref={(node) => {
            triggerRef.current = node;
            if (typeof userRef === 'function') userRef(node);
            else if (userRef) userRef.current = node;
          }}
          data-part="input"
          className={cx('z-datepicker-input', classNames?.input)}
          type="text"
          role="combobox"
          aria-label={inputProps['aria-label'] ?? (inputProps.id || inputProps['aria-labelledby'] ? undefined : locale.date.inputLabel)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          placeholder={placeholderText}
          value={draft}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            editingRef.current = true;
            setDraft(event.target.value);
          }}
          onBlur={(event) => { commitDraft(); onBlur?.(event); }}
          onFocus={(event) => {
            onFocus?.(event);
            if (event.defaultPrevented) return;
            if (disabled) return;
            if (!open) openPanel();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented) onInputKeyDown(event);
          }}
        />
        <span data-part="icon" className={cx('z-datepicker-icon', classNames?.icon)}>
          <CalendarIcon />
        </span>
      </div>

      {open ? (
        <FloatingPanel open anchorRef={rootRef}>
          <div
            ref={setPanelRef}
            id={panelId}
            role="dialog"
            aria-label={locale.date.panelLabel}
            data-part="panel"
            className={cx('z-datepicker-panel', classNames?.panel)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) {
                event.preventDefault();
                event.stopPropagation();
                cancelEditing();
                closePanel(true);
              }
            }}
          >
            <div
              data-part="header"
              className={cx('z-datepicker-header', classNames?.header)}
            >
              <button
                type="button"
                data-part="nav"
                className={cx('z-datepicker-nav', classNames?.nav)}
                aria-label={locale.date.previousMonth}
                disabled={disabled}
                onClick={() => setFocusedDate(addMonths(focusedDate, -1))}
              >
                <ChevronIcon direction="left" />
              </button>
              <span
                id={labelId}
                data-part="label"
                className={cx('z-datepicker-label', classNames?.label)}
              >
                {monthLabel}
              </span>
              <button
                type="button"
                data-part="nav"
                className={cx('z-datepicker-nav', classNames?.nav)}
                aria-label={locale.date.nextMonth}
                disabled={disabled}
                onClick={() => setFocusedDate(addMonths(focusedDate, 1))}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <div
              role="grid"
              aria-labelledby={labelId}
              data-part="grid"
              className={cx('z-datepicker-grid', classNames?.grid)}
            >
              <div role="row" data-part="week" className={cx('z-datepicker-week', classNames?.week)}>
                {locale.date.weekdays.map((name) => (
                  <span
                    key={name}
                    role="columnheader"
                    data-part="weekday"
                    className={cx('z-datepicker-weekday', classNames?.weekday)}
                    aria-label={locale.date.weekdayFormat.replace('{name}', name)}
                  >
                    {name}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, weekIndex) => (
                <div
                  role="row"
                  data-part="week"
                  className={cx('z-datepicker-week', classNames?.week)}
                  key={weekIndex}
                >
                  {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                    const iso = toISO(date);
                    const inMonth = date.getMonth() === viewMonth;
                    const disabledDay = isDateDisabled(iso);
                    return (
                      <span
                        key={iso}
                        role="gridcell"
                        data-part="day"
                        data-date={iso}
                        className={cx('z-datepicker-day', classNames?.day)}
                        aria-selected={iso === currentValue}
                        aria-disabled={disabledDay || undefined}
                        aria-current={iso === todayISO ? 'date' : undefined}
                        tabIndex={iso === focusedISO ? 0 : -1}
                        data-out-month={inMonth ? undefined : ''}
                        data-today={iso === todayISO ? '' : undefined}
                        onMouseDown={onDayMouseDown}
                        onKeyDown={onGridKeyDown}
                        onClick={() => {
                          if (!disabledDay) selectDate(date);
                        }}
                      >
                        {date.getDate()}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
