'use client';

import * as React from 'react';
import { FloatingPanel, cx } from '../../utils';
import './Tooltip.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode; // 提示内容
  children: React.ReactElement; // 单个子元素（作为触发器）
  placement?: TooltipPlacement; // 默认 'top'
  delay?: number; // 显示延迟 ms，默认 200
  disabled?: boolean;
  className?: string;
  classNames?: { root?: string; content?: string };
}

/* --------------------------------- Tooltip -------------------------------- */

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 200,
  disabled = false,
  className,
  classNames,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef(0);

  const baseId = React.useId();
  const tooltipId = `${baseId}-tooltip`;

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== 0) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const show = React.useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate || delay <= 0) {
        setOpen(true);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = 0;
        setOpen(true);
      }, delay);
    },
    [clearTimer, delay]
  );

  const hide = React.useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  // 组件卸载时清掉未触发的延迟计时器
  React.useEffect(() => clearTimer, [clearTimer]);

  // Esc 隐藏（文档级 keydown，焦点在任何位置都可靠）
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, hide]);

  if (!React.isValidElement(children)) {
    return null;
  }

  // cloneElement 注入打开态控制与 aria-describedby，保留触发器原 props（链式调用）
  const child = children as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props;

  const chain =
    <E,>(theirs: unknown, ours: (event: E) => void) =>
    (event: E) => {
      (theirs as ((event: E) => void) | undefined)?.(event);
      ours(event);
    };

  const describedBy =
    open && !disabled
      ? [childProps['aria-describedby'], tooltipId].filter(Boolean).join(' ')
      : childProps['aria-describedby'];

  const trigger = React.cloneElement(child, {
    'aria-describedby': describedBy,
    onMouseEnter: chain(childProps.onMouseEnter, () => {
      if (!disabled) show(false);
    }),
    onMouseLeave: chain(childProps.onMouseLeave, () => {
      if (!disabled) hide();
    }),
    onFocus: chain(childProps.onFocus, () => {
      if (!disabled) show(true);
    }),
    onBlur: chain(childProps.onBlur, () => {
      if (!disabled) hide();
    }),
  });

  return (
    <div ref={rootRef} data-part="root" className={cx('z-tooltip-root', className, classNames?.root)}>
      {trigger}
      {open && !disabled ? (
        <FloatingPanel open={open} anchorRef={rootRef} side={placement} align="center" offsetVariable="--z-tooltip-offset">
        <div
          role="tooltip"
          id={tooltipId}
          data-part="content"
          data-placement={placement}
          className={cx('z-tooltip', classNames?.content)}
        >
          {content}
        </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
