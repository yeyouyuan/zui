'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Skeleton.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface SkeletonProps extends Omit<React.ComponentPropsWithRef<'div'>, 'width' | 'height'> {
  lines?: number; // 文本行数，默认 3
  width?: number | string;
  height?: number | string;
  circle?: boolean; // 圆形（头像位）
  active?: boolean; // 渐变扫光动画，默认 true
}

/* --------------------------------- 工具函数 -------------------------------- */

function toCssSize(value: number | string | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Skeleton({
  lines = 3,
  width,
  height,
  circle = false,
  active = true,
  className,
  style,
  ref,
  ...rest
}: SkeletonProps) {
  // circle 时单一尺寸：只给一个方向时另一方向跟随，避免椭圆
  let widthValue = toCssSize(width);
  let heightValue = toCssSize(height);
  if (circle) {
    const sizeValue = widthValue ?? heightValue;
    widthValue = sizeValue;
    heightValue = sizeValue;
  }

  const sizeStyle: React.CSSProperties = {
    ...(widthValue != null ? { '--z-skeleton-width': widthValue } : null),
    ...(heightValue != null ? { '--z-skeleton-height': heightValue } : null),
  } as React.CSSProperties;

  const lineCount = Math.max(1, Math.floor(lines));

  return (
    <div
      aria-hidden="true"
      {...rest}
      ref={ref}
      data-part="root"
      data-circle={circle ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      data-lines={circle ? undefined : String(lineCount)}
      className={cx('z-skeleton', className)}
      style={{ ...style, ...sizeStyle }}
    >
      {circle ? (
        <span data-part="line" className="z-skeleton-line" />
      ) : (
        Array.from({ length: lineCount }, (_, index) => (
          <span
            key={index}
            data-part="line"
            data-last={index === lineCount - 1 ? 'true' : undefined}
            className="z-skeleton-line"
          />
        ))
      )}
    </div>
  );
}
