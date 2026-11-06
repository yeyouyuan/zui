'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './InputNumber.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type InputNumberSize = 'sm' | 'md' | 'lg';

export interface InputNumberProps
  extends Omit<
    React.ComponentPropsWithRef<'input'>,
    'value' | 'defaultValue' | 'onChange' | 'size'
  > {
  /** 受控值（null 表示空） */
  value?: number | null;
  /** 非受控初始值 */
  defaultValue?: number | null;
  /** 值变更回调（清空时为 null） */
  onChange?: (v: number | null) => void;
  /** 最小值，默认 -Infinity */
  min?: number;
  /** 最大值，默认 Infinity */
  max?: number;
  /** 步进，默认 1 */
  step?: number;
  /** 小数位数（提交与显示按此舍入） */
  precision?: number;
  /** 禁用 */
  disabled?: boolean;
  /** 尺寸，默认 'md' */
  size?: InputNumberSize;
  /** 显示 +/- 按钮，默认 true */
  controls?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    input?: string;
    increase?: string;
    decrease?: string;
  };
}

/* ---------------------------------- 工具 ---------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 步进值的小数位数（0.1 → 1；25 → 0；1e-3 → 3） */
function stepDecimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  if (dot === -1) {
    const exp = text.indexOf('e-');
    return exp === -1 ? 0 : Number(text.slice(exp + 2));
  }
  return text.length - dot - 1;
}

/** 按小数位数舍入（消除 0.1 + 0.2 类浮点误差） */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: number | null, precision?: number): string {
  if (value === null || Number.isNaN(value)) return '';
  return precision !== undefined ? value.toFixed(precision) : String(value);
}

/* --------------------------------- 组件实现 -------------------------------- */

export function InputNumber({
  value: valueProp,
  defaultValue = null,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision,
  disabled = false,
  size = 'md',
  controls = true,
  className,
  classNames,
  style,
  ref,
  onBlur,
  onKeyDown,
  ...rest
}: InputNumberProps) {
  const { locale } = useZuiConfig();
  const [value, setValue] = useControllableState<number | null>({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // 输入草稿：键入过程保留原始文本（如 '5.'、'1e'），值变化时按需回写
  const [draft, setDraft] = React.useState(() => formatValue(value, precision));
  const decimals = precision ?? stepDecimals(step);

  // 值变化时同步显示：草稿与当前值一致（键入中）则不覆盖，否则回写归一化文本
  React.useEffect(() => {
    setDraft((prev) => {
      const parsed = parseNumber(prev);
      const draftRounded = parsed === null ? null : roundTo(parsed, decimals);
      const valueRounded = value === null ? null : roundTo(value, decimals);
      const inSync =
        (draftRounded === null && valueRounded === null) ||
        (draftRounded !== null && draftRounded === valueRounded);
      return inSync ? prev : formatValue(value, precision);
    });
  }, [value, precision, decimals]);

  const commit = (next: number | null) => {
    const resolved = next === null ? null : roundTo(next, decimals);
    if (resolved === value) return;
    setValue(resolved);
  };

  /** 步进：空值以 0 为基准，结果按 min/max clamp */
  const stepValue = (direction: 1 | -1) => {
    const base = value ?? 0;
    commit(clamp(roundTo(base + direction * step, decimals), min, max));
  };

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
    },
    [ref]
  );

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    // 失焦时做边界 clamp + 精度归一，并回写显示
    const clamped = value === null ? null : clamp(roundTo(value, decimals), min, max);
    if (clamped !== value) commit(clamped);
    setDraft(formatValue(clamped, precision));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDraft(raw);
    if (raw.trim() === '') {
      commit(null);
      return;
    }
    const parsed = parseNumber(raw);
    if (parsed !== null) commit(parsed);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      // 阻止浏览器原生步进，统一走 clamp / 舍入
      event.preventDefault();
      stepValue(event.key === 'ArrowUp' ? 1 : -1);
    }
  };

  const atMax = value !== null && value >= max;
  const atMin = value !== null && value <= min;

  return (
    <div
      data-part="root"
      data-size={size}
      data-disabled={disabled ? '' : undefined}
      className={cx('z-input-number', className, classNames?.root)}
      style={style}
    >
      <input
        {...rest}
        data-part="input"
        ref={setInputRef}
        type="number"
        className={cx('z-input-number-input', classNames?.input)}
        value={draft}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        disabled={disabled}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {controls ? (
        <span data-part="controls" className="z-input-number-controls">
          <button
            type="button"
            data-part="increase"
            className={cx('z-input-number-btn', 'z-input-number-increase', classNames?.increase)}
            aria-label={locale.accessibility.increase}
            disabled={disabled || atMax}
            onClick={() => stepValue(1)}
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            data-part="decrease"
            className={cx('z-input-number-btn', 'z-input-number-decrease', classNames?.decrease)}
            aria-label={locale.accessibility.decrease}
            disabled={disabled || atMin}
            onClick={() => stepValue(-1)}
          >
            <span aria-hidden="true">−</span>
          </button>
        </span>
      ) : null}
    </div>
  );
}
