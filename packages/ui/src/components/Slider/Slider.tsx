'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './Slider.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface SliderProps
  extends Omit<React.ComponentPropsWithRef<'div'>, 'value' | 'defaultValue' | 'onChange'> {
  /** 受控值 */
  value?: number;
  /** 非受控初始值 */
  defaultValue?: number;
  /** 值变更回调 */
  onChange?: (v: number) => void;
  /** 最小值，默认 0 */
  min?: number;
  /** 最大值，默认 100 */
  max?: number;
  /** 步进，默认 1 */
  step?: number;
  /** 禁用 */
  disabled?: boolean;
  /** 刻度：值 → 标签 */
  marks?: Record<number, React.ReactNode>;
  /** 拖动/聚焦时显示数值气泡，默认 true */
  tooltip?: boolean;
  className?: string;
  classNames?: {
    root?: string;
    track?: string;
    fill?: string;
    thumb?: string;
    mark?: string;
  };
}

/* ---------------------------------- 工具 ---------------------------------- */

function countDecimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}

/** 向 min 对齐的步进吸附 + 边界 clamp */
function snapValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  if (!(step > 0)) return clamped;
  const steps = Math.round((clamped - min) / step);
  const snapped = min + steps * step;
  const precision = Math.min(countDecimals(step), 10);
  return Math.min(max, Math.max(min, Number(snapped.toFixed(precision))));
}

/* ---------------------------------- Slider -------------------------------- */

export function Slider(props: SliderProps) {
  const { locale } = useZuiConfig();
  const {
    value: valueProp,
    defaultValue,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    marks,
    tooltip = true,
    className,
    classNames,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = props;

  const [value, setValue] = useControllableState<number>({
    value: valueProp,
    defaultValue: defaultValue === undefined ? min : snapValue(defaultValue, min, max, step),
    onChange,
  });

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const thumbRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const display = Math.min(max, Math.max(min, value));
  const percent = max === min ? 0 : ((display - min) / (max - min)) * 100;
  const valuetext = String(display);

  /* ------------------------------ 指针拖动 ------------------------------ */

  const valueFromClientX = React.useCallback(
    (clientX: number): number | null => {
      const track = trackRef.current;
      if (!track || !Number.isFinite(clientX)) return null;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      const bounded = Math.min(1, Math.max(0, ratio));
      return snapValue(min + bounded * (max - min), min, max, step);
    },
    [min, max, step]
  );

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    thumbRef.current?.focus({ preventScroll: true });
    setDragging(true);
    const next = valueFromClientX(event.clientX);
    if (next !== null && next !== value) setValue(next);
  };

  const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // 不 preventDefault：保留 thumb 的可聚焦性（键盘用户）
    event.stopPropagation();
    setDragging(true);
  };

  React.useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (event: PointerEvent) => {
      const next = valueFromClientX(event.clientX);
      if (next !== null && next !== value) setValue(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, value, valueFromClientX, setValue]);

  /* -------------------------------- 键盘 -------------------------------- */

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const largeStep = step * 10;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'PageUp':
        next = value + largeStep;
        break;
      case 'PageDown':
        next = value - largeStep;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    const snapped = snapValue(next, min, max, step);
    if (snapped !== value) setValue(snapped);
  };

  /* -------------------------------- 渲染 -------------------------------- */

  const markEntries = marks
    ? Object.entries(marks)
        .map(([key, content]) => ({ pos: Number(key), content }))
        .filter((entry) => Number.isFinite(entry.pos))
        .sort((a, b) => a.pos - b.pos)
    : [];

  const showTooltip = tooltip && !disabled && (dragging || focused);

  return (
    <div
      {...rest}
      data-part="root"
      data-disabled={disabled ? '' : undefined}
      className={cx('z-slider', className, classNames?.root)}
      style={style}
    >
      <div
        data-part="track"
        ref={trackRef}
        className={cx('z-slider-track', classNames?.track)}
        onPointerDown={handleTrackPointerDown}
      >
        <div
          data-part="fill"
          className={cx('z-slider-fill', classNames?.fill)}
          style={{ width: `${percent}%` }}
        />
        <div
          ref={thumbRef}
          data-part="thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          className={cx('z-slider-thumb', classNames?.thumb)}
          style={{ left: `${percent}%` }}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={display}
          aria-valuetext={valuetext}
          aria-disabled={disabled}
          aria-label={ariaLabel ?? locale.accessibility.slider}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onPointerDown={handleThumbPointerDown}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          {showTooltip ? (
            <span data-part="tooltip" className="z-slider-tooltip" aria-hidden="true">
              {valuetext}
            </span>
          ) : null}
        </div>
      </div>
      {markEntries.length > 0 ? (
        <div className="z-slider-marks">
          {markEntries.map((entry) => (
            <span
              key={entry.pos}
              data-part="mark"
              data-active={display >= entry.pos ? '' : undefined}
              className={cx('z-slider-mark', classNames?.mark)}
              style={{ left: `${max === min ? 0 : ((entry.pos - min) / (max - min)) * 100}%` }}
            >
              {entry.content}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
