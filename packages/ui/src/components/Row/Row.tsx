'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Row.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type RowJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type RowAlign = 'top' | 'middle' | 'bottom';

export interface RowGutterValue {
  /** 水平 gutter（px） */
  horizontal: number;
  /** 垂直 gutter（px） */
  vertical: number;
}

/**
 * gutter 经 Context 注入 Col（每个 Col 自取 padding-inline: g/2），
 * 禁止 children 遍历 cloneElement；无 Provider 时 gutter 默认 0。
 * Col 消费该 Context（同一 Layout 家族的受控耦合）。
 */
export const RowGutterContext = React.createContext<RowGutterValue>({
  horizontal: 0,
  vertical: 0,
});

export interface RowProps extends React.ComponentPropsWithRef<'div'> {
  /** 栅格间隔：数字或 [水平, 垂直]，默认 0 */
  gutter?: number | [number, number];
  /** 水平排列方式，默认 'start' */
  justify?: RowJustify;
  /** 垂直对齐方式，默认 'top' */
  align?: RowAlign;
  /** 是否自动换行，默认 true */
  wrap?: boolean;
  classNames?: { root?: string };
}

/* --------------------------------- 内部工具 -------------------------------- */

function normalizeGutter(gutter: RowProps['gutter']): RowGutterValue {
  if (gutter == null) {
    return { horizontal: 0, vertical: 0 };
  }
  if (Array.isArray(gutter)) {
    return { horizontal: gutter[0] ?? 0, vertical: gutter[1] ?? 0 };
  }
  return { horizontal: gutter, vertical: 0 };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Row({
  gutter,
  justify = 'start',
  align = 'top',
  wrap = true,
  classNames,
  className,
  style,
  ref,
  children,
  ...rest
}: RowProps) {
  const normalized = normalizeGutter(gutter);

  // 水平 gutter：自身负 margin-inline（每个 Col 经 Context 补 padding-inline: g/2）
  // 垂直 gutter：row-gap
  const gutterStyle: React.CSSProperties = {};
  if (normalized.horizontal > 0) {
    gutterStyle.marginInline = `-${normalized.horizontal / 2}px`;
  }
  if (normalized.vertical > 0) {
    gutterStyle.rowGap = `${normalized.vertical}px`;
  }

  return (
    <RowGutterContext.Provider value={normalized}>
      <div
        {...rest}
        ref={ref}
        data-part="root"
        data-justify={justify}
        data-align={align}
        data-wrap={wrap ? 'true' : 'false'}
        className={cx('z-row', className, classNames?.root)}
        style={{ ...gutterStyle, ...style }}
      >
        {children}
      </div>
    </RowGutterContext.Provider>
  );
}
