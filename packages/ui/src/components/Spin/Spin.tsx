'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Spin.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type SpinSize = 'sm' | 'md' | 'lg';

export interface SpinProps extends Omit<React.ComponentPropsWithRef<'div'>, 'children'> {
  spinning?: boolean; // 默认 true
  size?: SpinSize; // 默认 'md'
  tip?: React.ReactNode; // 底部文案
  children?: React.ReactNode; // 有 children 时包裹并半透明遮罩
  classNames?: { root?: string; spinner?: string; tip?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Spin({
  spinning = true,
  size = 'md',
  tip,
  children,
  classNames,
  className,
  ref,
  ...rest
}: SpinProps) {
  const indicator = (
    <span data-part="spinner" className={cx('z-spin-spinner', classNames?.spinner)}>
      <svg viewBox="0 0 50 50" aria-hidden="true" focusable="false" className="z-spin-svg">
        <circle className="z-spin-track" cx="25" cy="25" r="20" fill="none" />
        <circle className="z-spin-head" cx="25" cy="25" r="20" fill="none" />
      </svg>
    </span>
  );

  // 包裹模式：children + 半透明遮罩 + 内容 aria-busy
  if (children != null) {
    return (
      <div
        {...rest}
        ref={ref}
        data-part="root"
        data-size={size}
        data-spinning={spinning ? '' : undefined}
        className={cx('z-spin', 'z-spin--wrap', className, classNames?.root)}
      >
        <div
          className="z-spin-children"
          aria-busy={spinning || undefined}
          inert={spinning ? true : undefined}
        >
          {children}
        </div>
        {spinning ? (
          <div className="z-spin-mask">
            {indicator}
            {tip != null ? (
              <div data-part="tip" className={cx('z-spin-tip', classNames?.tip)}>
                {tip}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // 独立模式：仅渲染指示器（可带 tip），spinning=false 时不渲染任何内容
  if (!spinning) return null;

  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-size={size}
      data-spinning=""
      className={cx('z-spin', 'z-spin--inline', className, classNames?.root)}
    >
      {indicator}
      {tip != null ? (
        <div data-part="tip" className={cx('z-spin-tip', classNames?.tip)}>
          {tip}
        </div>
      ) : null}
    </div>
  );
}
