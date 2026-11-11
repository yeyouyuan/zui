'use client';

import * as React from 'react';
import { Calendar as CalendarGlyph, ChevronLeft, ChevronRight, Close } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, FloatingPanel, useControllableState, useOnClickOutside } from '../../utils';
import './DateRangePicker.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface DateRangePickerProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'onChange' | 'value' | 'defaultValue'
> {
  /** 选中范围，ISO 'YYYY-MM-DD' 二元组 [start, end]（start <= end）；null = 受控清空态 */
  value?: [string, string] | null;
  defaultValue?: [string, string];
  /** 完成选择回调；null = 已清空 */
  onChange?: (range: [string, string] | null) => void;
  /** 可选最小日期（ISO，含），之外禁选 */
  min?: string;
  /** 可选最大日期（ISO，含），之外禁选 */
  max?: string;
  disabled?: boolean;
  status?: 'default' | 'error' | 'success';
  size?: 'sm' | 'md' | 'lg';
  /** 已选时显示清除按钮，默认 true */
  allowClear?: boolean;
  id?: string;
  className?: string;
  classNames?: {
    root?: string;
    trigger?: string;
    panel?: string;
    day?: string;
    header?: string;
  };
}

/* -------------------------------- 日期工具 -------------------------------- */
/* 网格构建器自包含（逻辑与 DatePicker 一致，按契约禁止跨组件 import） */

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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
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

/** 绝对月份序号（year*12 + month），用于左右月窗口比较 */
function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/* --------------------------------- 图标（@zui/icons） -------------------------- */

function CalendarIcon() {
  return <CalendarGlyph size={16} />;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return direction === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />;
}

/* ------------------------------ DateRangePicker ----------------------------- */

export function DateRangePicker(props: DateRangePickerProps) {
  const {
    value,
    defaultValue,
    onChange,
    min,
    max,
    disabled = false,
    status = 'default',
    size = 'md',
    allowClear = true,
    id,
    className,
    classNames,
    ref: userRef,
    ...restProps
  } = props;

  const { locale } = useZuiConfig();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const startRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);
  const leftGridRef = React.useRef<HTMLDivElement>(null);
  const rightGridRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  // Portal 首帧渲染 null，需等 panel 真正挂载后再激活焦点管理
  const [panelNode, setPanelNode] = React.useState<HTMLDivElement | null>(null);

  const baseId = React.useId();
  const panelId = `${baseId}-panel`;
  const leftLabelId = `${baseId}-label-left`;
  const rightLabelId = `${baseId}-label-right`;

  const [open, setOpen] = React.useState(false);
  const [range, setRange] = useControllableState<[string, string] | null>({
    value,
    defaultValue: defaultValue ?? null,
    onChange,
  });
  // 选择状态机：null → 已选起点（待选终点）→ 完成/重开
  const [pendingStart, setPendingStart] = React.useState<string | null>(null);
  // 左面板月份（右面板恒为其下一月）；打开时定位到范围起点 / 今天
  const [viewMonth, setViewMonth] = React.useState<Date>(() => {
    const base = parseISO(defaultValue?.[0] ?? '') ?? todayDate();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [singleMonth, setSingleMonth] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia?.('(max-width: 560px)');
    if (!media) return;
    const update = () => setSingleMonth(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // 面板聚焦日期（roving tabindex 的锚点）
  const [focusedDate, setFocusedDate] = React.useState<Date>(() => {
    return parseISO(defaultValue?.[0] ?? '') ?? todayDate();
  });
  React.useEffect(() => {
    if (open && singleMonth && monthIndex(focusedDate) !== monthIndex(viewMonth)) {
      setViewMonth(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));
    }
  }, [open, singleMonth, focusedDate, viewMonth]);
  // 关闭面板时焦点归还的目标输入位（打开时记录）
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  const minISO = min !== undefined && parseISO(min) ? min : '';
  const maxISO = max !== undefined && parseISO(max) ? max : '';

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
    const active = document.activeElement;
    returnFocusRef.current =
      active === startRef.current || active === endRef.current
        ? (active as HTMLElement)
        : startRef.current;
    const base = parseISO(range?.[0] ?? '') ?? todayDate();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocusedDate(base);
    setPendingStart(null);
    setOpen(true);
  };

  const closePanel = (refocus: boolean) => {
    setOpen(false);
    setPendingStart(null);
    if (refocus) returnFocusRef.current?.focus();
  };

  /** 状态机：无起点 → 记起点；新日期 < 起点 → 新日期成为起点（逆序重开）；否则完成范围并关闭 */
  const selectDate = (date: Date) => {
    const iso = toISO(date);
    if (isDateDisabled(iso)) return;
    setFocusedDate(date);
    if (pendingStart === null || iso < pendingStart) {
      setPendingStart(iso);
      return;
    }
    setRange([pendingStart, iso]);
    setPendingStart(null);
    closePanel(true);
  };

  const clearRange = () => {
    if (disabled) return;
    setRange(null);
    setPendingStart(null);
    startRef.current?.focus();
  };

  /* ------------------------------ 双月视图平移 ------------------------------ */

  /** 键盘移动焦点后：目标月不在 [viewMonth, viewMonth+1] 窗口时视图跟随 */
  const shiftViewTo = (next: Date) => {
    const m = monthIndex(next);
    const left = monthIndex(viewMonth);
    if (singleMonth && m !== left) {
      setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    } else if (m < left) {
      setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    } else if (m > left + 1) {
      setViewMonth(new Date(next.getFullYear(), next.getMonth() - 1, 1));
    }
  };

  /** 共享导航：‹ › 同时平移左右两月；焦点月被移出窗口时焦点同向平移一月 */
  const shiftView = (dir: 1 | -1) => {
    const nextView = addMonths(viewMonth, dir);
    const left = monthIndex(nextView);
    const m = monthIndex(focusedDate);
    if (m < left || m > left + (singleMonth ? 0 : 1)) {
      setFocusedDate(addMonths(focusedDate, dir));
    }
    setViewMonth(nextView);
  };

  /* ------------------------------- 键盘导航 ------------------------------- */

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const { key } = event;
    if (
      key === 'Enter' ||
      key === ' ' ||
      key === 'Spacebar' ||
      key === 'ArrowDown' ||
      key === 'ArrowUp'
    ) {
      event.preventDefault();
      if (open) closePanel(true);
      else openPanel();
      return;
    }
    if (key === 'Escape' && open) {
      event.preventDefault();
      closePanel(true);
    }
  };

  /** 日期格键盘导航（挂聚焦格自身，roving tabindex，焦点真实落在格子上时最可靠） */
  const onGridKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    const focused = focusedDate;
    const move = (next: Date) => {
      event.preventDefault();
      shiftViewTo(next);
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
          new Date(
            focused.getFullYear(),
            focused.getMonth(),
            daysInMonth(focused.getFullYear(), focused.getMonth())
          )
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
        // 选定聚焦日期（走状态机：定起点 / 完成范围），min/max 外禁选
        event.preventDefault();
        selectDate(focused);
        break;
      }
      case 'Escape':
        event.preventDefault();
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

  // 面板打开 / 聚焦日期变化 → DOM 焦点跟随日期格（按月窗口定位到对应面板，避开跨面板重复格）
  React.useEffect(() => {
    if (!open || !panelNode) return;
    const iso = toISO(focusedDate);
    const left = monthIndex(viewMonth);
    const m = monthIndex(focusedDate);
    const scoped =
      m === left
        ? leftGridRef.current
        : !singleMonth && m === left + 1
          ? rightGridRef.current
          : null;
    const cell = (scoped ?? panelNode).querySelector<HTMLElement>(`[data-date="${iso}"]`);
    cell?.focus();
  }, [open, panelNode, focusedDate, viewMonth, singleMonth]);

  // 点击外部关闭（root 含触发器，panel 在 Portal 内需一并纳入）
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => closePanel(false), open);

  /* -------------------------------- 渲染 --------------------------------- */

  const leftCells = buildMonthGrid(viewMonth);
  const rightCells = buildMonthGrid(addMonths(viewMonth, 1));
  const focusedISO = toISO(focusedDate);
  const todayISO = toISO(todayDate());
  // 待选起点期间隐藏已提交范围（重新选择的中间态只显示新起点）
  const startISO = pendingStart ?? range?.[0] ?? '';
  const endISO = pendingStart === null ? (range?.[1] ?? '') : '';
  const hasValue = range !== null;

  const monthLabel = (date: Date) =>
    locale.date.monthFormat
      .replace('{year}', String(date.getFullYear()))
      .replace('{month}', String(date.getMonth() + 1));

  const renderMonthGrid = (
    cells: Date[],
    inMonth: Date,
    labelId: string,
    gridRef: React.Ref<HTMLDivElement>
  ) => (
    <div
      role="grid"
      ref={gridRef}
      aria-labelledby={labelId}
      data-part="grid"
      className="z-daterange-grid"
    >
      <div role="row" data-part="week" className="z-daterange-week">
        {locale.date.weekdays.map((name) => (
          <span
            key={name}
            role="columnheader"
            data-part="weekday"
            className="z-daterange-weekday"
            aria-label={locale.date.weekdayFormat.replace('{name}', name)}
          >
            {name}
          </span>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, weekIndex) => (
        <div role="row" data-part="week" className="z-daterange-week" key={weekIndex}>
          {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
            const iso = toISO(date);
            const outMonth =
              date.getFullYear() !== inMonth.getFullYear() ||
              date.getMonth() !== inMonth.getMonth();
            const disabledDay = isDateDisabled(iso);
            const isSelected = iso === startISO || iso === endISO;
            const inRange = startISO !== '' && endISO !== '' && iso > startISO && iso < endISO;
            return (
              <span
                key={iso}
                role="gridcell"
                data-part="day"
                data-date={iso}
                className={cx('z-daterange-day', classNames?.day)}
                aria-selected={isSelected}
                aria-disabled={disabledDay || undefined}
                aria-current={iso === todayISO ? 'date' : undefined}
                tabIndex={iso === focusedISO && !outMonth ? 0 : -1}
                data-out-month={outMonth ? '' : undefined}
                data-today={iso === todayISO ? '' : undefined}
                data-in-range={inRange ? 'true' : undefined}
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
  );

  const setPanelRef = React.useCallback((element: HTMLDivElement | null) => {
    panelRef.current = element;
    setPanelNode(element);
  }, []);

  const showClear = allowClear && !disabled && hasValue;

  return (
    <div
      {...restProps}
      ref={(node) => {
        rootRef.current = node;
        if (typeof userRef === 'function') userRef(node);
        else if (userRef) userRef.current = node;
      }}
      data-part="root"
      className={cx('z-daterange', classNames?.root, className)}
      data-size={size}
      data-status={status}
      data-open={open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : undefined}
    >
      <div
        data-part="trigger"
        className={cx('z-daterange-trigger', classNames?.trigger)}
        data-open={open ? 'true' : 'false'}
      >
        <input
          ref={startRef}
          id={id}
          data-part="input-start"
          className="z-daterange-input"
          type="text"
          role="combobox"
          aria-label={locale.dateRange.startPlaceholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          placeholder={locale.dateRange.startPlaceholder}
          value={startISO}
          readOnly
          disabled={disabled}
          autoComplete="off"
          onClick={openPanel}
          onKeyDown={onTriggerKeyDown}
        />
        <span data-part="separator" aria-hidden="true" className="z-daterange-separator">
          {locale.dateRange.separator}
        </span>
        <input
          ref={endRef}
          data-part="input-end"
          className="z-daterange-input"
          type="text"
          role="combobox"
          aria-label={locale.dateRange.endPlaceholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          placeholder={locale.dateRange.endPlaceholder}
          value={endISO}
          readOnly
          disabled={disabled}
          autoComplete="off"
          onClick={openPanel}
          onKeyDown={onTriggerKeyDown}
        />
        <span data-part="icon" aria-hidden="true" className="z-daterange-icon">
          <CalendarIcon />
        </span>
        {showClear ? (
          <button
            type="button"
            data-part="clear"
            className="z-daterange-clear"
            aria-label={locale.input.clear}
            onClick={clearRange}
          >
            <Close size={12} />
          </button>
        ) : null}
      </div>

      {open ? (
        <FloatingPanel open anchorRef={rootRef}>
          <div
            ref={setPanelRef}
            id={panelId}
            role="dialog"
            aria-label={locale.dateRange.panelLabel}
            data-part="panel"
            className={cx('z-daterange-panel', classNames?.panel)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) {
                event.preventDefault();
                event.stopPropagation();
                closePanel(true);
              }
            }}
          >
            <div data-part="header" className={cx('z-daterange-header', classNames?.header)}>
              <button
                type="button"
                data-part="nav"
                className="z-daterange-nav"
                aria-label={locale.date.previousMonth}
                disabled={disabled}
                onClick={() => shiftView(-1)}
              >
                <ChevronIcon direction="left" />
              </button>
              <span id={leftLabelId} data-part="label" className="z-daterange-label">
                {monthLabel(viewMonth)}
              </span>
              {!singleMonth && (
                <span id={rightLabelId} data-part="label" className="z-daterange-label">
                  {monthLabel(addMonths(viewMonth, 1))}
                </span>
              )}
              <button
                type="button"
                data-part="nav"
                className="z-daterange-nav"
                aria-label={locale.date.nextMonth}
                disabled={disabled}
                onClick={() => shiftView(1)}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <div data-part="months" className="z-daterange-months">
              {renderMonthGrid(leftCells, viewMonth, leftLabelId, leftGridRef)}
              {!singleMonth &&
                renderMonthGrid(rightCells, addMonths(viewMonth, 1), rightLabelId, rightGridRef)}
            </div>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
