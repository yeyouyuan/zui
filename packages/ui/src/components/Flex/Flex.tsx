'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Flex.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type FlexJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type FlexAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';

export type FlexGap = 'sm' | 'md' | 'lg' | number | string;

export type FlexComponent = 'div' | 'span' | 'ul' | 'ol';

export interface FlexProps extends React.ComponentPropsWithRef<'div'> {
  /** 主轴是否垂直（flex-direction: column），默认 false */
  vertical?: boolean;
  /** 主轴排列方式，默认 'start' */
  justify?: FlexJustify;
  /** 交叉轴对齐方式，默认 'start' */
  align?: FlexAlign;
  /** 间距：sm/md/lg 映射 --z-space-2/3/4；number → px；string 原样（内联 gap） */
  gap?: FlexGap;
  /** 是否允许换行，默认 false */
  wrap?: boolean;
  /** flex 属性（内联覆盖） */
  flex?: string | number;
  /** 渲染的语义标签，默认 'div' */
  component?: FlexComponent;
  classNames?: { root?: string };
}

/* --------------------------------- 内部工具 -------------------------------- */

const GAP_TOKEN: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'var(--z-space-2)',
  md: 'var(--z-space-3)',
  lg: 'var(--z-space-4)',
};

function resolveGap(gap: FlexProps['gap']): string | undefined {
  if (gap == null) {
    return undefined;
  }
  if (typeof gap === 'number') {
    return `${gap}px`;
  }
  if (gap === 'sm' || gap === 'md' || gap === 'lg') {
    return GAP_TOKEN[gap];
  }
  return gap;
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Flex({
  vertical = false,
  justify = 'start',
  align = 'start',
  gap,
  wrap = false,
  flex,
  component = 'div',
  classNames,
  className,
  style,
  ref,
  children,
  ...rest
}: FlexProps) {
  const Tag = component as React.ElementType;

  const flexStyle: React.CSSProperties = {};
  const resolvedGap = resolveGap(gap);
  if (resolvedGap != null) {
    flexStyle.gap = resolvedGap;
  }
  if (flex != null) {
    flexStyle.flex = flex;
  }

  return (
    <Tag
      {...rest}
      ref={ref}
      data-part="root"
      data-vertical={vertical ? 'true' : 'false'}
      data-justify={justify}
      data-align={align}
      data-wrap={wrap ? 'true' : 'false'}
      className={cx('z-flex', className, classNames?.root)}
      style={{ ...flexStyle, ...style }}
    >
      {children}
    </Tag>
  );
}
