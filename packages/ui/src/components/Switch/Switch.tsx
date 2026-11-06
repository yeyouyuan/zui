'use client';

import * as React from 'react';
import { cx, useControllableState } from '../../utils';
import './Switch.css';

export interface SwitchProps
  extends Omit<React.ComponentPropsWithRef<'button'>, 'onChange' | 'value' | 'type'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  classNames?: { root?: string; track?: string; thumb?: string; label?: string };
}

export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  size = 'md',
  label,
  classNames,
  className,
  disabled,
  onClick,
  ref,
  ...rest
}: SwitchProps) {
  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="switch"
      data-part="root"
      data-size={size}
      data-checked={isChecked || undefined}
      className={cx('z-switch', className, classNames?.root)}
      disabled={disabled}
      aria-checked={isChecked}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setIsChecked((prev) => !prev);
      }}
    >
      <span
        data-part="track"
        aria-hidden="true"
        className={cx('z-switch-track', classNames?.track)}
      >
        <span className={cx('z-switch-thumb', classNames?.thumb)} />
      </span>
      {label != null && label !== '' ? (
        <span data-part="label" className={cx('z-switch-label', classNames?.label)}>
          {label}
        </span>
      ) : null}
    </button>
  );
}
