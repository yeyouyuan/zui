'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Divider.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type DividerOrientation = 'horizontal' | 'vertical';

export interface DividerProps extends React.ComponentPropsWithRef<'div'> {
  orientation?: DividerOrientation; // 默认 'horizontal'
  dashed?: boolean;
  children?: React.ReactNode; // 中间文字（仅 horizontal）
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Divider({
  orientation = 'horizontal',
  dashed = false,
  className,
  children,
  ref,
  ...rest
}: DividerProps) {
  // 中间文字仅 horizontal 生效
  const hasText = orientation === 'horizontal' && children != null;

  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-orientation={orientation}
      data-dashed={dashed ? 'true' : undefined}
      data-has-text={hasText ? 'true' : undefined}
      className={cx('z-divider', className)}
    >
      <span data-part="line" aria-hidden="true" className="z-divider-line" />
      {hasText ? (
        <span data-part="text" className="z-divider-text">
          {children}
        </span>
      ) : null}
      {hasText ? <span data-part="line" aria-hidden="true" className="z-divider-line" /> : null}
    </div>
  );
}
