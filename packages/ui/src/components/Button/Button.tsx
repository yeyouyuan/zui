'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Button.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ComponentPropsWithRef<'button'>, 'prefix'> {
  variant?: ButtonVariant; // 默认 'primary'
  size?: ButtonSize; // 默认 'md'
  loading?: boolean; // 置灰 + spinner + aria-busy，阻止点击（保留可聚焦）
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
  classNames?: { root?: string; icon?: string; label?: string; spinner?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconStart,
  iconEnd,
  fullWidth = false,
  classNames,
  className,
  children,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      ref={ref}
      data-part="root"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      data-full-width={fullWidth ? 'true' : undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cx('z-button', className, classNames?.root)}
      onClick={(event) => {
        // loading 时不设 disabled，用 aria-disabled 保留可聚焦，但拦截点击
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {iconStart != null ? (
        <span data-part="icon" aria-hidden="true" className={cx('z-button-icon', classNames?.icon)}>
          {iconStart}
        </span>
      ) : null}
      {loading ? (
        <span
          data-part="spinner"
          aria-hidden="true"
          className={cx('z-button-spinner', classNames?.spinner)}
        />
      ) : null}
      <span data-part="label" className={cx('z-button-label', classNames?.label)}>
        {children}
      </span>
      {iconEnd != null ? (
        <span data-part="icon" aria-hidden="true" className={cx('z-button-icon', classNames?.icon)}>
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}
