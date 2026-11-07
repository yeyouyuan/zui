'use client';

import * as React from 'react';
import { CheckCircle, XCircle } from '@zui/icons';
import { cx } from '../../utils';
import { useZuiConfig } from '../../config';
import './Steps.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type StepStatus = 'wait' | 'process' | 'finish' | 'error';

export interface StepsItem {
  key?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** 显式覆盖派生状态（error 可出现在任意位置） */
  status?: StepStatus;
  disabled?: boolean;
}

export interface StepsProps {
  items: StepsItem[];
  /** 当前步骤下标（从 0 开始），默认 0 */
  current?: number;
  direction?: 'horizontal' | 'vertical'; // 默认 'horizontal'
  size?: 'md' | 'sm'; // 默认 'md'
  /** 提供后步骤可点击（按钮 + roving tabindex 键盘导航） */
  onChange?: (index: number) => void;
  className?: string;
  classNames?: { root?: string; item?: string; icon?: string; content?: string; connector?: string };
}

/* ------------------------------ 状态派生逻辑 ------------------------------- */

/**
 * 派生规则：idx < current → finish；== current → process；> current → wait。
 * `item.status` 显式覆盖派生结果（error 可出现在任意位置）。
 */
function deriveStatus(index: number, current: number, explicit?: StepStatus): StepStatus {
  if (explicit) return explicit;
  if (index < current) return 'finish';
  if (index === current) return 'process';
  return 'wait';
}

/* --------------------------------- Steps ---------------------------------- */

/**
 * 步骤条：`<nav>` + `<ol role="list">` + `<li>`；
 * 派生状态 finish/process/wait + `item.status` 显式覆盖；
 * onChange 提供时每项渲染为 `<button>`（disabled 除外），
 * roving tabindex + ↑←/↓→/Home/End 移动焦点 + Enter/Space 确认。
 */
export function Steps({
  items,
  current = 0,
  direction = 'horizontal',
  size = 'md',
  onChange,
  className,
  classNames,
}: StepsProps) {
  const { locale } = useZuiConfig();
  const label = locale.steps.label;

  const interactive = typeof onChange === 'function';

  /* ---------------- 键盘导航（roving tabindex）---------------- */
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  // 用户最近聚焦的步骤；null 表示尚未交互（tab 停靠在默认位置）
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null);

  /** 启用（未禁用）步骤的下标列表 */
  const enabledIndexes = React.useMemo(
    () => items.reduce<number[]>((acc, item, index) => {
      if (!item.disabled) acc.push(index);
      return acc;
    }, []),
    [items]
  );

  const clampedCurrent = Math.min(Math.max(current, 0), Math.max(items.length - 1, 0));
  // 默认停靠：current 本身（若启用），否则第一个启用步骤
  const defaultTabbable = enabledIndexes.includes(clampedCurrent)
    ? clampedCurrent
    : (enabledIndexes[0] ?? -1);
  const tabbable = focusIndex != null && enabledIndexes.includes(focusIndex)
    ? focusIndex
    : defaultTabbable;

  const focusStep = React.useCallback(
    (index: number) => {
      const el = buttonRefs.current[index];
      if (!el) return;
      setFocusIndex(index);
      el.focus();
    },
    []
  );

  /** 从 from 起按 step 方向找第一个启用步骤（不环形回绕，到边界即停） */
  const moveFocus = React.useCallback(
    (from: number, step: 1 | -1) => {
      let next = from + step;
      while (next >= 0 && next < items.length) {
        if (!items[next].disabled) {
          focusStep(next);
          return;
        }
        next += step;
      }
    },
    [items, focusStep]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(index, 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(index, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      if (enabledIndexes.length > 0) focusStep(enabledIndexes[0]);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      if (enabledIndexes.length > 0) focusStep(enabledIndexes[enabledIndexes.length - 1]);
      return;
    }
    // Enter / Space：不拦截，走原生 button click → onChange
  };

  /* ------------------------------ 渲染 ------------------------------ */

  return (
    <nav
      data-part="nav"
      className="z-steps-nav"
      aria-label={label}
    >
      <ol
        role="list"
        aria-label={label}
        data-part="root"
        data-direction={direction}
        data-size={size}
        data-clickable={interactive ? 'true' : undefined}
        className={cx('z-steps', classNames?.root, className)}
      >
        {items.map((item, index) => {
          const status = deriveStatus(index, clampedCurrent, item.status);
          const isCurrent = index === clampedCurrent;
          const disabled = item.disabled === true;
          const key = item.key ?? `z-steps-item-${index}`;

          const iconNode = (
            <span
              data-part="icon"
              className={cx('z-steps-icon', classNames?.icon)}
              aria-hidden={item.icon != null ? undefined : true}
            >
              {item.icon != null ? (
                item.icon
              ) : status === 'finish' ? (
                <CheckCircle className="z-steps-icon-svg" />
              ) : status === 'error' ? (
                <XCircle className="z-steps-icon-svg" />
              ) : (
                <span className="z-steps-icon-number">{index + 1}</span>
              )}
            </span>
          );

          const contentNode = (
            <span data-part="content" className={cx('z-steps-content', classNames?.content)}>
              <span data-part="title" className="z-steps-title">
                {item.title}
              </span>
              {item.description != null ? (
                <span data-part="description" className="z-steps-description">
                  {item.description}
                </span>
              ) : null}
            </span>
          );

          const triggerClass = 'z-steps-trigger';

          return (
            <li
              key={key}
              data-part="item"
              data-status={status}
              data-disabled={disabled ? 'true' : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              className={cx('z-steps-item', classNames?.item)}
            >
              {interactive && !disabled ? (
                <button
                  type="button"
                  data-part="trigger"
                  className={triggerClass}
                  tabIndex={index === tabbable ? 0 : -1}
                  onClick={() => onChange?.(index)}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  ref={(el: HTMLButtonElement | null) => {
                    buttonRefs.current[index] = el;
                  }}
                >
                  {iconNode}
                  {contentNode}
                </button>
              ) : interactive && disabled ? (
                <span
                  data-part="trigger"
                  className={cx(triggerClass, 'z-steps-trigger-disabled')}
                  aria-disabled="true"
                >
                  {iconNode}
                  {contentNode}
                </span>
              ) : (
                <div data-part="trigger" className={triggerClass}>
                  {iconNode}
                  {contentNode}
                </div>
              )}

              {index < items.length - 1 ? (
                <span
                  data-part="connector"
                  aria-hidden="true"
                  className={cx('z-steps-connector', classNames?.connector)}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
