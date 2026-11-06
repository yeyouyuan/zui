'use client';

import * as React from 'react';
import { cx, useControllableState } from '../../utils';
import './Checkbox.css';

export interface CheckboxProps
  extends Omit<
    React.ComponentPropsWithRef<'input'>,
    'type' | 'onChange' | 'checked' | 'defaultChecked' | 'size'
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  indeterminate?: boolean;
  classNames?: { root?: string; control?: string; label?: string };
}

export function Checkbox({
  checked,
  defaultChecked = false,
  onChange,
  label,
  indeterminate = false,
  classNames,
  className,
  disabled,
  ref,
  ...rest
}: CheckboxProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const el = inputRef.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);

  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });

  return (
    <label
      data-part="root"
      className={cx('z-checkbox', className, classNames?.root)}
    >
      <input
        {...rest}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
        }}
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        onChange={(event) => {
          setIsChecked(event.target.checked);
        }}
      />
      <span
        data-part="control"
        aria-hidden="true"
        className={cx('z-checkbox-box', classNames?.control)}
      />
      {label != null && label !== '' ? (
        <span data-part="label" className={cx('z-checkbox-label', classNames?.label)}>
          {label}
        </span>
      ) : null}
    </label>
  );
}
