'use client';

import * as React from 'react';
import { cx } from '../../utils';
import { RadioGroupContext } from './RadioGroup.context';
import './Radio.css';

export interface RadioProps
  extends Omit<
    React.ComponentPropsWithRef<'input'>,
    'type' | 'onChange' | 'checked' | 'defaultChecked' | 'size'
  > {
  value: string;
  label?: React.ReactNode;
  disabled?: boolean;
  /** 原生 change 回调；组内选中值由 RadioGroup.onChange 统一报告，两者都会触发 */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  classNames?: { root?: string; control?: string; label?: string };
}

export function Radio({
  value,
  label,
  disabled,
  classNames,
  className,
  name,
  onChange: onChangeProp,
  ref,
  ...rest
}: RadioProps) {
  const group = React.useContext(RadioGroupContext);

  return (
    <label data-part="root" className={cx('z-radio', className, classNames?.root)}>
      <input
        {...rest}
        ref={ref}
        type="radio"
        value={value}
        name={group ? group.name : name}
        checked={group ? group.value === value : undefined}
        disabled={disabled || group?.disabled}
        onChange={(event) => {
          onChangeProp?.(event);
          if (event.target.checked) group?.onChange(value);
        }}
      />
      <span
        data-part="control"
        aria-hidden="true"
        className={cx('z-radio-dot', classNames?.control)}
      />
      {label != null && label !== '' ? (
        <span data-part="label" className={cx('z-radio-label', classNames?.label)}>
          {label}
        </span>
      ) : null}
    </label>
  );
}
