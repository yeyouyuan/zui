'use client';

import * as React from 'react';
import { cx } from '../../utils';
import { RowGutterContext } from '../Row';
import './Col.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface ColProps extends React.ComponentPropsWithRef<'div'> {
  /** 栅格占 1-24 格（宽度 calc(span/24*100%)） */
  span?: number;
  /** 栅格左侧偏移 0-23 格 */
  offset?: number;
  /** 弹性布局（flex-basis 语义），提供时覆盖 span */
  flex?: string | number | 'auto' | 'none';
  classNames?: { root?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Col({
  span,
  offset,
  flex,
  classNames,
  className,
  style,
  ref,
  children,
  ...rest
}: ColProps) {
  // gutter 经 Row 的 Context 注入：水平 gutter → 自身 padding-inline: g/2；
  // 无 Row（无 Context）时 gutter 默认 0，不产生内边距。
  const { horizontal } = React.useContext(RowGutterContext);

  const colStyle: React.CSSProperties = {
    // flex 提供时覆盖 span（flex-basis 语义接管主轴尺寸），span 变量不再下发
    ...(flex == null && span != null
      ? ({ '--z-col-span': String(span) } as React.CSSProperties)
      : null),
    ...(offset != null
      ? ({ '--z-col-offset': String(offset) } as React.CSSProperties)
      : null),
  };
  if (horizontal > 0) {
    colStyle.paddingInline = `${horizontal / 2}px`;
  }
  if (flex != null) {
    colStyle.flex = flex;
  }

  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-flex={flex != null ? 'true' : undefined}
      className={cx('z-col', className, classNames?.root)}
      style={{ ...colStyle, ...style }}
    >
      {children}
    </div>
  );
}
