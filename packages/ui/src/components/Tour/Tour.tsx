'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, floatingPosition, Portal, useControllableState } from '../../utils';
import './Tour.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TourStep {
  title: React.ReactNode;
  description?: React.ReactNode;
  target: string | (() => HTMLElement | null); // CSS 选择器或取元素函数
  placement?: 'top' | 'bottom' | 'left' | 'right'; // 默认 'bottom'
}

export interface TourProps {
  steps: TourStep[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  current?: number;
  onCurrentChange?: (i: number) => void;
  className?: string;
  classNames?: {
    root?: string;
    mask?: string;
    card?: string;
    title?: string;
    description?: string;
    footer?: string;
  };
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** 浮层与目标元素的间距 */
const GAP = 12;

/** 卡片定位（fixed 坐标） */
function getCardStyle(rect: Rect | null, placement: NonNullable<TourStep['placement']>, card: HTMLDivElement | null): React.CSSProperties {
  if (!rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const { top, left } = floatingPosition(
    { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height },
    card?.getBoundingClientRect() ?? { width: 320, height: 180 },
    { width: window.innerWidth, height: window.innerHeight },
    { side: placement, align: 'center', offset: GAP }
  );
  return { top, left };
}

/* --------------------------------- Tour ---------------------------------- */

export function Tour(props: TourProps) {
  const { locale } = useZuiConfig();
  const {
    steps,
    open,
    defaultOpen = false,
    onOpenChange,
    current,
    onCurrentChange,
    className,
    classNames,
  } = props;

  const [cardNode, setCardNode] = React.useState<HTMLDivElement | null>(null);
  const setCardRef = React.useCallback((node: HTMLDivElement | null) => {
    setCardNode(node);
  }, []);
  const baseId = React.useId();

  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const [stepIndex, setStepIndex] = useControllableState<number>({
    value: current,
    defaultValue: 0,
    onChange: onCurrentChange,
  });

  // 越界保护
  const index = steps.length === 0 ? 0 : Math.min(Math.max(stepIndex, 0), steps.length - 1);
  const step = steps[index];

  const [rect, setRect] = React.useState<Rect | null>(null);

  /* ------------------------------- 测量定位 ------------------------------ */

  const measure = React.useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const element =
      typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
    if (!element) {
      setRect(null);
      return;
    }
    const box = element.getBoundingClientRect();
    const next: Rect = { top: box.top, left: box.left, width: box.width, height: box.height };
    // 数值未变时返回原对象，避免 steps 内联数组导致的重复渲染
    setRect((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next
    );
  }, [step]);

  React.useEffect(() => {
    if (!isOpen) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, measure]);

  // 打开后焦点移入卡片
  React.useEffect(() => {
    if (!isOpen || !cardNode) return;
    const previous = document.activeElement as HTMLElement | null;
    cardNode.focus();
    return () => previous?.focus();
  }, [isOpen, cardNode]);

  const [cardStyle, setCardStyle] = React.useState<React.CSSProperties>({});
  React.useLayoutEffect(() => {
    if (!cardNode) return;
    const update = () => setCardStyle(getCardStyle(rect, step?.placement ?? 'bottom', cardNode));
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    observer?.observe(cardNode);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, [cardNode, rect, step?.placement]);

  // Esc 关闭
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setIsOpen]);

  /* ------------------------------- 交互 --------------------------------- */

  const goNext = () => {
    if (index < steps.length - 1) setStepIndex(index + 1);
    else setIsOpen(false);
  };

  const goPrev = () => {
    if (index > 0) setStepIndex(index - 1);
  };

  /* -------------------------------- 渲染 --------------------------------- */

  if (!isOpen || !step) return null;

  const placement = step.placement ?? 'bottom';
  const isLast = index === steps.length - 1;

  return (
    <Portal>
      <div
        data-part="root"
        className={cx('z-tour', classNames?.root, className)}
        data-open="true"
      >
        <div
          data-part="mask"
          className={cx('z-tour-mask', !rect ? 'z-tour-mask--full' : undefined, classNames?.mask)}
          aria-hidden="true"
          style={
            rect
              ? {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }
              : undefined
          }
        />

        <div
          ref={setCardRef}
          role="dialog"
          tabIndex={-1}
          data-part="card"
          className={cx('z-tour-card', classNames?.card)}
          data-placement={placement}
          data-step={index}
          aria-labelledby={`${baseId}-title`}
          aria-describedby={step.description ? `${baseId}-description` : undefined}
          style={cardStyle}
        >
          <div
            id={`${baseId}-title`}
            data-part="title"
            className={cx('z-tour-title', classNames?.title)}
          >
            {step.title}
          </div>
          {step.description ? (
            <div
              id={`${baseId}-description`}
              data-part="description"
              className={cx('z-tour-description', classNames?.description)}
            >
              {step.description}
            </div>
          ) : null}
          <div data-part="footer" className={cx('z-tour-footer', classNames?.footer)}>
            <span className="z-tour-progress">
              {index + 1}/{steps.length}
            </span>
            <div className="z-tour-actions">
              <button
                type="button"
                className="z-tour-button"
                disabled={index === 0}
                onClick={goPrev}
              >
                {locale.tour.prev}
              </button>
              {isLast ? (
                <button type="button" className="z-tour-button z-tour-button--primary" onClick={goNext}>
                  {locale.tour.finish}
                </button>
              ) : (
                <button type="button" className="z-tour-button z-tour-button--primary" onClick={goNext}>
                  {locale.tour.next}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
