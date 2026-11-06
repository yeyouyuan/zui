'use client';

import * as React from 'react';
import { Close } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Input.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type InputSize = 'sm' | 'md' | 'lg';
export type InputStatus = 'default' | 'error' | 'success';

export interface InputProps
  extends Omit<React.ComponentPropsWithRef<'input'>, 'prefix' | 'size'> {
  size?: InputSize; // 默认 'md'
  status?: InputStatus; // 默认 'default'
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  clearable?: boolean; // 有值时显示清除按钮
  onClear?: () => void;
  classNames?: {
    root?: string;
    input?: string;
    prefix?: string;
    suffix?: string;
    clear?: string;
  };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Input({
  size = 'md',
  status = 'default',
  prefix,
  suffix,
  clearable = false,
  onClear,
  classNames,
  className,
  style,
  disabled,
  readOnly,
  value: valueProp,
  defaultValue,
  onChange,
  ref,
  ...rest
}: InputProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp === undefined ? undefined : String(valueProp),
    defaultValue: defaultValue === undefined ? '' : String(defaultValue),
  });

  const { locale } = useZuiConfig();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // clear 按钮：clearable 且有值时显示，只读/禁用时隐藏
  const showClear = clearable && value !== '' && !readOnly && !disabled;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    onChange?.(event);
  };

  const handleClear = () => {
    if (disabled || readOnly) return;
    const input = inputRef.current;
    if (input) {
      // 通过原生输入事件同步 Form.Item 和仅监听 onChange 的受控使用者。
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    onClear?.();
  };

  return (
    <div
      data-part="root"
      data-size={size}
      data-status={status}
      className={cx('z-input', className, classNames?.root)}
      style={style}
    >
      {prefix != null && prefix !== '' ? (
        <span data-part="prefix" className={cx('z-input-prefix', classNames?.prefix)}>
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        data-part="input"
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
        }}
        className={cx('z-input-field', classNames?.input)}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
      />
      {showClear ? (
        <button
          type="button"
          data-part="clear"
          className={cx('z-input-clear', classNames?.clear)}
          aria-label={locale.input.clear}
          onClick={handleClear}
        >
          <Close />
        </button>
      ) : null}
      {suffix != null && suffix !== '' ? (
        <span data-part="suffix" className={cx('z-input-suffix', classNames?.suffix)}>
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
