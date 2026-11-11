'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Rate.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface RateProps
  extends Omit<React.ComponentPropsWithRef<'div'>, 'value' | 'defaultValue' | 'onChange'> {
  /** 受控值（0..count，allowHalf 时步进 0.5） */
  value?: number;
  /** 非受控初始值 */
  defaultValue?: number;
  /** 值变更回调 */
  onChange?: (v: number) => void;
  /** 星星数量，默认 5 */
  count?: number;
  /** 允许半星 */
  allowHalf?: boolean;
  /** 禁用（原生 disabled 星按钮） */
  disabled?: boolean;
  /** 只读展示（不可交互） */
  readonly?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    star?: string;
    half?: string;
  };
}

/* ---------------------------------- 图标 ---------------------------------- */

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="1em" height="1em">
      <path
        d="M12 2.2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.1 6.1 20.3l1.2-6.6-4.8-4.6 6.6-.9z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ---------------------------------- 工具 ---------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapStep(value: number, allowHalf: boolean): number {
  return Math.round(value * (allowHalf ? 2 : 1)) / (allowHalf ? 2 : 1);
}

/* ----------------------------------- Rate --------------------------------- */

export function Rate(props: RateProps) {
  const { locale } = useZuiConfig();
  const {
    value: valueProp,
    defaultValue,
    onChange,
    count = 5,
    allowHalf = false,
    disabled = false,
    readonly = false,
    className,
    classNames,
    style,
    'aria-label': ariaLabel,
    ...rest
  } = props;

  const [value, setValue] = useControllableState<number>({
    value: valueProp,
    defaultValue: clamp(snapStep(defaultValue ?? 0, allowHalf), 0, count),
    onChange,
  });

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const display = clamp(snapStep(value, allowHalf), 0, count);
  const interactive = !disabled && !readonly;
  // roving tabindex：当前值所在星（0 时落在第一颗）
  const focusIndex = display > 0 ? Math.min(count, Math.ceil(display)) : 1;

  const commit = (next: number) => {
    const snapped = clamp(snapStep(next, allowHalf), 0, count);
    if (snapped === display) return;
    setValue(snapped);
  };

  const handleStarClick = (event: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (!interactive) return;
    const halfEl = (event.target as HTMLElement).closest('[data-half]');
    const half = allowHalf && halfEl?.getAttribute('data-half') === '0.5' ? 0.5 : 1;
    commit(index - 1 + half);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const step = allowHalf ? 0.5 : 1;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = display + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = display - step;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = clamp(snapStep(next, allowHalf), 0, count);
    if (target === display) return;
    commit(target);
    // 焦点跟随新的 roving 星
    const nextFocus = target > 0 ? Math.min(count, Math.ceil(target)) : 1;
    rootRef.current?.querySelector<HTMLElement>(`[data-index="${nextFocus}"]`)?.focus();
  };

  const stars = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div
      {...rest}
      ref={rootRef}
      data-part="root"
      role="radiogroup"
      aria-label={ariaLabel ?? locale.accessibility.rating}
      aria-disabled={disabled}
      aria-readonly={readonly}
      data-disabled={disabled ? '' : undefined}
      data-readonly={readonly ? '' : undefined}
      className={cx('z-rate', className, classNames?.root)}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {stars.map((index) => {
        const fraction = clamp(display - (index - 1), 0, 1);
        return (
          <button
            key={index}
            type="button"
            role="radio"
            data-part="star"
            data-index={index}
            data-filled={fraction >= 1 ? 'full' : fraction >= 0.5 ? 'half' : 'none'}
            className={cx('z-rate-star', classNames?.star)}
            // 选中星 = 最后一颗满星（display 为 x.5 时落在第 x 颗），
            // 半星档不置 checked，保证 aria 与视觉填充一致
            aria-checked={Math.floor(display) === index}
            aria-label={locale.accessibility.ratingValue.replace('{index}', String(index))}
            disabled={disabled}
            tabIndex={interactive && focusIndex === index ? 0 : -1}
            onClick={(event) => handleStarClick(event, index)}
          >
            <span
              data-part="half"
              data-half="0.5"
              className={cx('z-rate-star-half', classNames?.half)}
            >
              <StarIcon />
            </span>
            <span
              data-part="half"
              data-half="1"
              className={cx('z-rate-star-half', classNames?.half)}
            >
              <StarIcon />
            </span>
          </button>
        );
      })}
    </div>
  );
}
