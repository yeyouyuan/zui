'use client';

import * as React from 'react';
import { cx, useControllableState } from '../../utils';
import './Segmented.css';

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg'; // 默认 'md'
  /** 撑满宽度 */
  block?: boolean;
  className?: string;
  classNames?: { root?: string; item?: string; thumb?: string };
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Segmented(props: SegmentedProps) {
  const {
    options,
    value,
    defaultValue,
    onChange,
    size = 'md',
    block = false,
    className,
    classNames,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  } = props;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [current, setCurrent] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? options[0]?.value ?? '',
    onChange,
  });

  const selectedIndex = options.findIndex((option) => option.value === current);

  // 滑块几何：布局后测量（jsdom 中为 0，不影响语义断言）
  const [thumb, setThumb] = React.useState<{ width: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    const updateThumb = () => {
      const element = selectedIndex >= 0 ? itemRefs.current[selectedIndex] : null;
      setThumb(element ? { width: element.offsetWidth, left: element.offsetLeft } : null);
    };
    updateThumb();

    if (typeof ResizeObserver !== 'undefined' && rootRef.current) {
      const ro = new ResizeObserver(updateThumb);
      ro.observe(rootRef.current);
      return () => ro.disconnect();
    }
  }, [selectedIndex, options, size, block]);

  const selectAt = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setCurrent(option.value);
    itemRefs.current[index]?.focus();
  };

  /** roving tabindex：聚焦后方向键移动并选中（radiogroup 模式） */
  const move = (delta: 1 | -1) => {
    if (options.length === 0) return;
    const from = selectedIndex < 0 ? (delta > 0 ? -1 : options.length) : selectedIndex;
    for (let step = 1; step <= options.length; step += 1) {
      const index = (from + delta * step + options.length * step) % options.length;
      if (!options[index].disabled) {
        selectAt(index);
        return;
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        for (let i = 0; i < options.length; i += 1) {
          if (!options[i].disabled) {
            selectAt(i);
            break;
          }
        }
        break;
      case 'End':
        event.preventDefault();
        for (let i = options.length - 1; i >= 0; i -= 1) {
          if (!options[i].disabled) {
            selectAt(i);
            break;
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectAt(index);
        break;
      default:
    }
  };

  return (
    <div
      {...rest}
      ref={rootRef}
      data-part="root"
      className={cx('z-segmented', classNames?.root, className)}
      data-size={size}
      data-block={block ? 'true' : undefined}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-orientation="horizontal"
    >
      <div
        data-part="thumb"
        className={cx('z-segmented-thumb', classNames?.thumb)}
        data-hidden={!thumb ? 'true' : undefined}
        aria-hidden="true"
        style={
          thumb
            ? { width: thumb.width, transform: `translateX(${thumb.left}px)` }
            : undefined
        }
      />
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          data-part="item"
          className={cx('z-segmented-item', classNames?.item)}
          role="radio"
          aria-checked={option.value === current}
          aria-disabled={option.disabled || undefined}
          data-active={option.value === current ? 'true' : undefined}
          data-disabled={option.disabled ? 'true' : undefined}
          disabled={option.disabled}
          tabIndex={option.value === current || (selectedIndex < 0 && index === 0) ? 0 : -1}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => {
            if (option.disabled) return;
            setCurrent(option.value);
          }}
        >
          {option.icon ? (
            <span className="z-segmented-icon" aria-hidden="true">
              {option.icon}
            </span>
          ) : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
