'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Statistic.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface StatisticProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'title' | 'value' | 'prefix'
> {
  title?: React.ReactNode;
  value: number | string;
  precision?: number; // 小数位
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
  classNames?: { root?: string; title?: string; value?: string; suffix?: string };
}

/* ---------------------------------- 工具 ---------------------------------- */

const MIN_PRECISION = 0;
/** ECMA-402 规范允许的 minimumFractionDigits / maximumFractionDigits 上限 */
const SPEC_MAX_PRECISION = 100;

/**
 * 运行时实际支持的小数位上限：规范上限为 100，但当前 V8（Node 18/20）仍只接受 ≤20。
 * 模块加载时探测一次，取「规范上限 ∩ 运行时上限」，保证 clamp 之后不会再抛 RangeError。
 */
const MAX_PRECISION = (() => {
  for (const candidate of [SPEC_MAX_PRECISION, 20]) {
    try {
      (0).toLocaleString('zh-CN', {
        minimumFractionDigits: candidate,
        maximumFractionDigits: candidate,
      });
      return candidate;
    } catch {
      // 该候选值不被当前运行时支持，降级探测
    }
  }
  return 20;
})();

/**
 * 将 precision 收敛到 Intl 数字格式化的合法区间 [0, MAX_PRECISION]（规范 [0, 100] 与
 * 运行时能力的交集）。越界（<0 或 >100，含 ±Infinity）直接 clamp，避免 toLocaleString
 * 抛 RangeError 导致渲染崩溃；NaN 无法比较，回退 undefined（不补零、按默认小数位展示）。
 */
function clampPrecision(precision: number | undefined): number | undefined {
  if (precision == null || Number.isNaN(precision)) return undefined;
  return Math.min(MAX_PRECISION, Math.max(MIN_PRECISION, Math.trunc(precision)));
}

/** 数字 → 千分位字符串；非数字原样返回；locale 缺省时沿用库默认 zh-CN */
function formatStatisticValue(
  value: number | string,
  precision?: number,
  locale?: string
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    const digits = clampPrecision(precision);
    return value.toLocaleString(locale || 'zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  // 字符串：纯数字（含负号/小数点）做千分位；否则原样返回
  if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return formatStatisticValue(Number(value), precision, locale);
  }
  return value;
}

/* -------------------------------- Statistic ------------------------------- */

/**
 * 统计数值：标题 + 千分位数字 + 前后缀。大数字字重 600。
 */
function Statistic({
  title,
  value,
  precision,
  prefix,
  suffix,
  valueStyle,
  className,
  classNames,
  ...rest
}: StatisticProps) {
  const { locale } = useZuiConfig();
  const text = formatStatisticValue(value, precision, locale.code);

  return (
    <div {...rest} data-part="root" className={cx('z-statistic', className, classNames?.root)}>
      {title != null ? (
        <div data-part="title" className={cx('z-statistic-title', classNames?.title)}>
          {title}
        </div>
      ) : null}
      <div
        data-part="value"
        className={cx('z-statistic-value', classNames?.value)}
        style={valueStyle}
      >
        {prefix != null ? (
          <span data-part="prefix" className="z-statistic-prefix">
            {prefix}
          </span>
        ) : null}
        <span className="z-statistic-number">{text}</span>
        {suffix != null ? (
          <span data-part="suffix" className={cx('z-statistic-suffix', classNames?.suffix)}>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- CountDown ------------------------------- */

/** 剩余毫秒 → `HH:mm:ss`（跨天累计小时数），tabular-nums 下等宽稳定 */
function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export interface StatisticCountDownProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'title' | 'value' | 'prefix'
> {
  title?: React.ReactNode;
  /** 目标时间：时间戳（毫秒）、可解析的时间字符串或 Date */
  value: number | string | Date;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** 倒计时到 0 时触发一次 */
  onFinish?: () => void;
  valueStyle?: React.CSSProperties;
  classNames?: { root?: string; title?: string; value?: string; suffix?: string };
}

/** 目标时间 → 毫秒时间戳；不可解析返回 null */
function normalizeCountdownTarget(value: number | string | Date): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 倒计时：到目标时间的剩余时长，秒级刷新；到点触发一次 onFinish。
 * 数字沿用 Statistic 的 tabular-nums 等宽渲染。
 */
function StatisticCountDown({
  title,
  value,
  prefix,
  suffix,
  onFinish,
  valueStyle,
  className,
  classNames,
  'aria-label': ariaLabel,
  ...rest
}: StatisticCountDownProps) {
  const { locale } = useZuiConfig();
  const target = normalizeCountdownTarget(value);
  // Absolute targets cannot be rendered against "now" on the server without a
  // hydration race. Keep the first server/client render deterministic, then
  // calculate the live value after hydration.
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const onFinishRef = React.useRef(onFinish);
  const finishedTargetsRef = React.useRef(new Set<number>());
  React.useEffect(() => {
    onFinishRef.current = onFinish;
  });

  React.useEffect(() => {
    if (target == null) {
      setRemaining(0);
      return undefined;
    }
    const finish = () => {
      if (finishedTargetsRef.current.has(target)) return;
      finishedTargetsRef.current.add(target);
      onFinishRef.current?.();
    };
    const initial = target - Date.now();
    if (initial <= 0) {
      setRemaining(0);
      finish();
      return undefined;
    }
    setRemaining(initial);
    const timer = window.setInterval(() => {
      const next = target - Date.now();
      if (next <= 0) {
        window.clearInterval(timer);
        setRemaining(0);
        finish();
      } else {
        setRemaining(next);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return (
    <div
      {...rest}
      role="timer"
      aria-label={ariaLabel ?? locale.statistic.countdown}
      data-part="root"
      className={cx('z-statistic', className, classNames?.root)}
    >
      {title != null ? (
        <div data-part="title" className={cx('z-statistic-title', classNames?.title)}>
          {title}
        </div>
      ) : null}
      <div
        data-part="value"
        className={cx('z-statistic-value', classNames?.value)}
        style={valueStyle}
      >
        {prefix != null ? (
          <span data-part="prefix" className="z-statistic-prefix">
            {prefix}
          </span>
        ) : null}
        <span className="z-statistic-number">
          {remaining == null ? '--:--:--' : formatCountdown(remaining)}
        </span>
        {suffix != null ? (
          <span data-part="suffix" className={cx('z-statistic-suffix', classNames?.suffix)}>
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------- Compound -------------------------------- */

const StatisticRoot = Object.assign(Statistic, {
  CountDown: StatisticCountDown,
});

export { StatisticRoot as Statistic, StatisticCountDown, formatCountdown, formatStatisticValue };
