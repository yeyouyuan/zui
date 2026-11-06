'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Calendar.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface CalendarProps
  extends Omit<React.ComponentPropsWithRef<'div'>, 'onChange' | 'value' | 'defaultValue'> {
  /** 选中日期（ISO 'YYYY-MM-DD'） */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** 全幅展示（默认 true）；false 时收缩为内容宽度 */
  fullscreen?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    header?: string;
    grid?: string;
    day?: string;
    label?: string;
    nav?: string;
    week?: string;
    weekday?: string;
  };
}

/* -------------------------------- 日期工具（独立实现，不依赖其他组件） -------------------------------- */

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

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return direction === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />;
}

/* --------------------------------- Calendar ------------------------------- */

export function Calendar(props: CalendarProps) {
  const {
    value,
    defaultValue,
    onChange,
    fullscreen = true,
    className,
    classNames,
    ...rest
  } = props;

  const { locale } = useZuiConfig();
  const baseId = React.useId();
  const labelId = `${baseId}-label`;

  const [currentValue, setCurrentValue] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? '',
    onChange,
  });

  // 视图聚焦日期：驱动显示月份与 roving tabindex
  const [focusedDate, setFocusedDate] = React.useState<Date>(
    () => parseISO(currentValue) ?? todayDate()
  );

  // 受控值外部变化 → 视图跟随
  React.useEffect(() => {
    const parsed = parseISO(currentValue);
    if (parsed) setFocusedDate(parsed);
  }, [currentValue]);

  const gridRef = React.useRef<HTMLDivElement>(null);
  // 键盘导航意图：跨月切换时旧格卸载、activeElement 回落 body，据此仍延续焦点
  const navFocusRef = React.useRef(false);

  const selectDate = (date: Date) => {
    const iso = toISO(date);
    setCurrentValue(iso);
    setFocusedDate(date);
  };

  /** 日期格键盘导航（挂聚焦格自身，兼容 AT 的 cell 级焦点） */
  const onDayKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    // 以实际聚焦格为起点（AT/测试可能直接聚焦非 roving 格）
    const focused = parseISO(event.currentTarget.dataset.date ?? '') ?? focusedDate;
    const move = (next: Date) => {
      event.preventDefault();
      navFocusRef.current = true;
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
        event.preventDefault();
        selectDate(focused);
        break;
      }
      default:
        break;
    }
  };

  // 聚焦日期变化 → DOM 焦点跟随日期格（roving tabindex）
  // 仅当焦点已在网格内（键盘导航中）才移动，静态展示不抢焦点
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const inGrid = grid.contains(document.activeElement);
    if (!inGrid && !navFocusRef.current) return;
    navFocusRef.current = false;
    const iso = toISO(focusedDate);
    const cell = grid.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    cell?.focus();
  }, [focusedDate]);

  const viewYear = focusedDate.getFullYear();
  const viewMonth = focusedDate.getMonth();
  const cells = buildMonthGrid(focusedDate);
  const focusedISO = toISO(focusedDate);
  const todayISO = toISO(todayDate());
  const monthLabel = locale.date.monthFormat
    .replace('{year}', String(viewYear))
    .replace('{month}', String(viewMonth + 1));

  return (
    <div
      {...rest}
      data-part="root"
      className={cx('z-calendar', classNames?.root, className)}
      data-fullscreen={fullscreen ? 'true' : 'false'}
    >
      <div data-part="header" className={cx('z-calendar-header', classNames?.header)}>
        <button
          type="button"
          data-part="nav"
          className={cx('z-calendar-nav', classNames?.nav)}
          aria-label={locale.date.previousMonth}
          onClick={() => setFocusedDate(addMonths(focusedDate, -1))}
        >
          <ChevronIcon direction="left" />
        </button>
        <span
          id={labelId}
          data-part="label"
          className={cx('z-calendar-label', classNames?.label)}
        >
          {monthLabel}
        </span>
        <button
          type="button"
          data-part="nav"
          className={cx('z-calendar-nav', classNames?.nav)}
          aria-label={locale.date.nextMonth}
          onClick={() => setFocusedDate(addMonths(focusedDate, 1))}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={labelId}
        data-part="grid"
        className={cx('z-calendar-grid', classNames?.grid)}
      >
        <div role="row" data-part="week" className={cx('z-calendar-week', classNames?.week)}>
          {locale.date.weekdays.map((name) => (
            <span
              key={name}
              role="columnheader"
              data-part="weekday"
              className={cx('z-calendar-weekday', classNames?.weekday)}
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
            className={cx('z-calendar-week', classNames?.week)}
            key={weekIndex}
          >
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
              const iso = toISO(date);
              const inMonth = date.getMonth() === viewMonth;
              return (
                <span
                  key={iso}
                  role="gridcell"
                  data-part="day"
                  data-date={iso}
                  className={cx('z-calendar-day', classNames?.day)}
                  aria-selected={iso === currentValue}
                  aria-current={iso === todayISO ? 'date' : undefined}
                  tabIndex={iso === focusedISO ? 0 : -1}
                  data-out-month={inMonth ? undefined : ''}
                  data-today={iso === todayISO ? '' : undefined}
                  onMouseDown={(event) => {
                    // 避免点击日期格触发焦点竞争：由 selectDate 统一驱动
                    event.preventDefault();
                  }}
                  onKeyDown={onDayKeyDown}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
