'use client';

import * as React from 'react';
import { Close, Eye, EyeOff, Search } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Input.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type InputSize = 'sm' | 'md' | 'lg';
export type InputStatus = 'default' | 'error' | 'success';

export interface InputProps extends Omit<React.ComponentPropsWithRef<'input'>, 'prefix' | 'size'> {
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

export interface InputTextareaProps extends React.ComponentPropsWithRef<'textarea'> {
  size?: InputSize; // 默认 'md'
  status?: InputStatus; // 默认 'default'
  clearable?: boolean; // 有值时显示清除按钮
  onClear?: () => void;
  classNames?: {
    root?: string;
    textarea?: string;
    clear?: string;
  };
}

export interface InputPasswordProps extends Omit<
  React.ComponentPropsWithRef<'input'>,
  'prefix' | 'size' | 'type'
> {
  size?: InputSize; // 默认 'md'
  status?: InputStatus; // 默认 'default'
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  visibilityToggle?: boolean; // 默认 true，显示可见性切换按钮
  classNames?: {
    root?: string;
    input?: string;
    prefix?: string;
    suffix?: string;
    toggle?: string;
  };
}

export interface InputSearchProps extends Omit<
  React.ComponentPropsWithRef<'input'>,
  'prefix' | 'size' | 'type'
> {
  size?: InputSize; // 默认 'md'
  status?: InputStatus; // 默认 'default'
  prefix?: React.ReactNode;
  clearable?: boolean; // 有值时显示清除按钮
  onClear?: () => void;
  onSearch?: (value: string) => void; // 点击搜索按钮或按 Enter（IME 组合中除外）触发
  classNames?: {
    root?: string;
    input?: string;
    prefix?: string;
    clear?: string;
    search?: string;
  };
}

/* --------------------------------- 通用实现 -------------------------------- */

type InputChrome = {
  size: InputSize;
  status: InputStatus;
  className?: string;
  style?: React.CSSProperties;
  classNames?: { root?: string };
};

function InputRootBox({
  size,
  status,
  className,
  style,
  classNames,
  modifier,
  children,
}: InputChrome & { modifier: string; children: React.ReactNode }) {
  return (
    <div
      data-part="root"
      data-size={size}
      data-status={status}
      className={cx('z-input', modifier, className, classNames?.root)}
      style={style}
    >
      {children}
    </div>
  );
}

/* --------------------------------- 组件实现 -------------------------------- */

function Input({
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
    <InputRootBox
      size={size}
      status={status}
      className={className}
      style={style}
      classNames={classNames}
      modifier=""
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
    </InputRootBox>
  );
}

/* --------------------------------- Textarea -------------------------------- */

function InputTextarea({
  size = 'md',
  status = 'default',
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
}: InputTextareaProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp === undefined ? undefined : String(valueProp),
    defaultValue: defaultValue === undefined ? '' : String(defaultValue),
  });

  const { locale } = useZuiConfig();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const showClear = clearable && value !== '' && !readOnly && !disabled;

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    onChange?.(event);
  };

  const handleClear = () => {
    if (disabled || readOnly) return;
    const textarea = textareaRef.current;
    if (textarea) {
      // 与 Input 相同：通过原生输入事件同步 Form.Item 与受控使用者。
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, '');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
    onClear?.();
  };

  return (
    <InputRootBox
      size={size}
      status={status}
      className={className}
      style={style}
      classNames={classNames}
      modifier="z-input-textarea"
    >
      <textarea
        {...rest}
        data-part="textarea"
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
        }}
        className={cx('z-input-field', classNames?.textarea)}
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
    </InputRootBox>
  );
}

/* --------------------------------- Password -------------------------------- */

function InputPassword({
  size = 'md',
  status = 'default',
  prefix,
  suffix,
  visibilityToggle = true,
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
}: InputPasswordProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp === undefined ? undefined : String(valueProp),
    defaultValue: defaultValue === undefined ? '' : String(defaultValue),
  });
  const [visible, setVisible] = React.useState(false);

  const { locale } = useZuiConfig();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    onChange?.(event);
  };

  return (
    <InputRootBox
      size={size}
      status={status}
      className={className}
      style={style}
      classNames={classNames}
      modifier=""
    >
      {prefix != null && prefix !== '' ? (
        <span data-part="prefix" className={cx('z-input-prefix', classNames?.prefix)}>
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
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
      {visibilityToggle ? (
        <button
          type="button"
          data-part="toggle"
          className={cx('z-input-toggle', classNames?.toggle)}
          aria-label={visible ? locale.input.hidePassword : locale.input.showPassword}
          disabled={disabled}
          onClick={() => setVisible((prev) => !prev)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      ) : null}
      {suffix != null && suffix !== '' ? (
        <span data-part="suffix" className={cx('z-input-suffix', classNames?.suffix)}>
          {suffix}
        </span>
      ) : null}
    </InputRootBox>
  );
}

/* ---------------------------------- Search --------------------------------- */

function InputSearch({
  size = 'md',
  status = 'default',
  prefix,
  clearable = false,
  onClear,
  onSearch,
  classNames,
  className,
  style,
  disabled,
  readOnly,
  value: valueProp,
  defaultValue,
  onChange,
  onKeyDown,
  ref,
  ...rest
}: InputSearchProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp === undefined ? undefined : String(valueProp),
    defaultValue: defaultValue === undefined ? '' : String(defaultValue),
  });

  const { locale } = useZuiConfig();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const showClear = clearable && value !== '' && !readOnly && !disabled;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    onChange?.(event);
  };

  const handleClear = () => {
    if (disabled || readOnly) return;
    const input = inputRef.current;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    onClear?.();
  };

  const handleSearch = () => {
    if (disabled || readOnly) return;
    onSearch?.(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // IME 组合中的 Enter 是选字确认，不触发搜索
    const native = event.nativeEvent as KeyboardEvent & { keyCode?: number };
    if (event.key === 'Enter' && !native.isComposing && native.keyCode !== 229) {
      handleSearch();
    }
  };

  return (
    <InputRootBox
      size={size}
      status={status}
      className={className}
      style={style}
      classNames={classNames}
      modifier="z-input-search"
    >
      {prefix != null && prefix !== '' ? (
        <span data-part="prefix" className={cx('z-input-prefix', classNames?.prefix)}>
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        type="search"
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
        onKeyDown={handleKeyDown}
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
      <button
        type="button"
        data-part="search"
        className={cx('z-input-search-button', classNames?.search)}
        aria-label={locale.input.search}
        disabled={disabled || readOnly}
        onClick={handleSearch}
      >
        <Search />
      </button>
    </InputRootBox>
  );
}

/* -------------------------------- Compound -------------------------------- */

const InputRoot = Object.assign(Input, {
  Textarea: InputTextarea,
  Password: InputPassword,
  Search: InputSearch,
});

export { InputRoot as Input, InputTextarea, InputPassword, InputSearch };
