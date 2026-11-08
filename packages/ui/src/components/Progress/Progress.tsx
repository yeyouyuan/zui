'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Progress.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type ProgressSize = 'sm' | 'md';
export type ProgressStatus = 'normal' | 'active' | 'success' | 'error';

export interface ProgressProps extends Pick<
  React.AriaAttributes,
  'aria-label' | 'aria-labelledby'
> {
  percent: number; // 0-100，必填
  size?: ProgressSize; // 默认 'md'（sm 6px / md 8px 高）
  status?: ProgressStatus; // 默认 'normal'
  showInfo?: boolean; // 右侧百分比文字，默认 true
  color?: string; // 自定义填充色
  className?: string;
  classNames?: { root?: string; track?: string; fill?: string; info?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Progress({
  percent,
  size = 'md',
  status = 'normal',
  showInfo = true,
  color,
  className,
  classNames,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ProgressProps) {
  // 夹取到 [0, 100]，非法值按 0 处理
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const displayPercent = Math.round(clamped * 10) / 10;

  return (
    <div
      data-part="root"
      data-size={size}
      data-status={status}
      className={cx('z-progress', className, classNames?.root)}
    >
      <div data-part="track" className={cx('z-progress-track', classNames?.track)}>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPercent}
          aria-valuetext={`${displayPercent}%`}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          data-part="fill"
          className={cx('z-progress-fill', classNames?.fill)}
          style={{
            width: `${clamped}%`,
            ...(color != null
              ? ({ ['--z-progress-color' as string]: color } as React.CSSProperties)
              : null),
          }}
        />
      </div>
      {showInfo ? (
        <div data-part="info" className={cx('z-progress-info', classNames?.info)}>
          {`${displayPercent}%`}
        </div>
      ) : null}
    </div>
  );
}
