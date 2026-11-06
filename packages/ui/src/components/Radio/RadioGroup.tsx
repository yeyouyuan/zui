'use client';

import * as React from 'react';
import { cx, useControllableState } from '../../utils';
import { RadioGroupContext } from './RadioGroup.context';
import './Radio.css';

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
  className?: string;
  classNames?: { root?: string };
}

export function RadioGroup({
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  orientation = 'vertical',
  children,
  className,
  classNames,
  ...rest
}: RadioGroupProps) {
  const [groupValue, setGroupValue] = useControllableState<string | undefined>({
    value,
    defaultValue,
    onChange: (next) => {
      if (next !== undefined) onChange?.(next);
    },
  });

  return (
    <div
      role="radiogroup"
      aria-orientation={orientation}
      data-part="root"
      data-orientation={orientation}
      className={cx('z-radio-group', className, classNames?.root)}
      {...rest}
    >
      <RadioGroupContext.Provider
        value={{ name, value: groupValue, onChange: setGroupValue, disabled }}
      >
        {children}
      </RadioGroupContext.Provider>
    </div>
  );
}
