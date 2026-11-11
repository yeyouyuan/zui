'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Badge.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps {
  count?: number; // 数字；0 时默认隐藏
  dot?: boolean; // 小圆点模式
  max?: number; // 超出显示 `${max}+`，默认 99
  showZero?: boolean; // 默认 false
  color?: BadgeColor; // 默认 'error'
  children?: React.ReactNode; // 有 children 则右上角角标包裹，无则独立展示数字
  className?: string;
  classNames?: { root?: string; indicator?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

function formatCount(count: number, max: number): string {
  return count > max ? `${max}+` : String(count);
}

export function Badge({
  count = 0,
  dot = false,
  max = 99,
  showZero = false,
  color = 'error',
  children,
  className,
  classNames,
}: BadgeProps) {
  const visible = dot || count > 0 || showZero;
  const wrapped = children != null;
  const formatted = dot ? null : formatCount(count, max);
  const isSingle = !dot && formatted != null && formatted.length === 1;

  // 独立模式也遵循零值可见性；dot 始终可见。
  if (!wrapped) {
    if (!visible) return null;
    return (
      <span
        data-part="indicator"
        data-color={color}
        data-dot={dot ? 'true' : undefined}
        data-single={isSingle ? 'true' : undefined}
        className={cx('z-badge-indicator', 'z-badge-indicator--standalone', className, classNames?.indicator)}
      >
        {formatted}
      </span>
    );
  }

  // 包裹型角标：children 右上角定位
  return (
    <span
      data-part="root"
      data-color={color}
      className={cx('z-badge', className, classNames?.root)}
    >
      {children}
      {visible ? (
        <span
          data-part="indicator"
          data-dot={dot ? 'true' : undefined}
          data-single={isSingle ? 'true' : undefined}
          className={cx('z-badge-indicator', classNames?.indicator)}
        >
          {formatted}
        </span>
      ) : null}
    </span>
  );
}
