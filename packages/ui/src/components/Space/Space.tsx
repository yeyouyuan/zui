'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Space.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type SpaceSize = 'sm' | 'md' | 'lg' | number;

export type SpaceDirection = 'horizontal' | 'vertical';

export type SpaceAlign = 'start' | 'center' | 'end' | 'baseline';

export interface SpaceProps extends React.ComponentPropsWithRef<'div'> {
  /** 间距尺寸，默认 'md'（8px，即 --z-space-2） */
  size?: SpaceSize;
  /** 排列方向，默认 'horizontal' */
  direction?: SpaceDirection;
  /** 是否允许换行，默认 false */
  wrap?: boolean;
  /** 交叉轴对齐方式，默认 'start' */
  align?: SpaceAlign;
  classNames?: { root?: string };
}

/* --------------------------------- 内部工具 -------------------------------- */

// 契约 §2：默认 'md' = 8px = --z-space-2，三档取相邻令牌 sm/md/lg → --z-space-1/2/3
const SIZE_TOKEN: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'var(--z-space-1)',
  md: 'var(--z-space-2)',
  lg: 'var(--z-space-3)',
};

function resolveSize(size: SpaceProps['size']): string {
  if (size == null) {
    return SIZE_TOKEN.md;
  }
  if (typeof size === 'number') {
    return `${size}px`;
  }
  return SIZE_TOKEN[size];
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Space({
  size = 'md',
  direction = 'horizontal',
  wrap = false,
  align = 'start',
  classNames,
  className,
  style,
  ref,
  children,
  ...rest
}: SpaceProps) {
  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-direction={direction}
      data-align={align}
      data-wrap={wrap ? 'true' : 'false'}
      className={cx('z-space', className, classNames?.root)}
      style={{ gap: resolveSize(size), ...style }}
    >
      {children}
    </div>
  );
}
