'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Statistic.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface StatisticProps
  extends Omit<React.ComponentPropsWithRef<'div'>, 'title' | 'value' | 'prefix'> {
  title?: React.ReactNode;
  value: number | string;
  precision?: number; // 小数位
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
  classNames?: { root?: string; title?: string; value?: string; suffix?: string };
}

/* ---------------------------------- 工具 ---------------------------------- */

/** 数字 → 千分位字符串；非数字原样返回 */
export function formatStatisticValue(value: number | string, precision?: number): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  // 字符串：纯数字（含负号/小数点）做千分位；否则原样返回
  if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return formatStatisticValue(Number(value), precision);
  }
  return value;
}

/* -------------------------------- Statistic ------------------------------- */

/**
 * 统计数值：标题 + 千分位数字 + 前后缀。大数字字重 600。
 */
export function Statistic({
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
  const text = formatStatisticValue(value, precision);

  return (
    <div {...rest} data-part="root" className={cx('z-statistic', className, classNames?.root)}>
      {title != null ? (
        <div data-part="title" className={cx('z-statistic-title', classNames?.title)}>
          {title}
        </div>
      ) : null}
      <div data-part="value" className={cx('z-statistic-value', classNames?.value)} style={valueStyle}>
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
