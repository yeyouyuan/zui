'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './BackTop.css';

export interface BackTopProps {
  /** 滚动容器，默认 window */
  target?: () => HTMLElement | Window;
  /** 超过该滚动距离才显示，默认 400 */
  visibilityHeight?: number;
  onClick?: () => void;
  /** 自定义按钮内容 */
  children?: React.ReactNode;
  className?: string;
  classNames?: { root?: string };
  'aria-label'?: string;
}

/** 取滚动目标的滚动距离与尺寸测量容器 */
function resolveScroller(target?: () => HTMLElement | Window): HTMLElement | Window {
  return target ? target() : window;
}

function getScrollTop(scroller: HTMLElement | Window): number {
  return scroller instanceof window.HTMLElement ? scroller.scrollTop : window.scrollY;
}

function isWindow(scroller: HTMLElement | Window): boolean {
  return !(scroller instanceof window.HTMLElement);
}

export function BackTop(props: BackTopProps) {
  const { locale } = useZuiConfig();
  const {
    target,
    visibilityHeight = 400,
    onClick,
    children,
    className,
    classNames,
    'aria-label': ariaLabel,
    ...rest
  } = props;

  const [visible, setVisible] = React.useState(false);
  const rafRef = React.useRef(0);

  React.useEffect(() => {
    const scroller = resolveScroller(target);
    const measure = () => {
      rafRef.current = 0;
      setVisible(getScrollTop(scroller) >= visibilityHeight);
    };
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(measure);
    };
    // 初始测量 + 监听（rAF 节流）
    measure();
    const listenerTarget = isWindow(scroller) ? window : (scroller as HTMLElement);
    listenerTarget.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      listenerTarget.removeEventListener('scroll', onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [target, visibilityHeight]);

  const handleClick = () => {
    onClick?.();
    const scroller = resolveScroller(target);
    if (isWindow(scroller)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (scroller as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      {...rest}
      type="button"
      data-part="root"
      className={cx('z-back-top', classNames?.root, className)}
      data-visible={visible ? 'true' : 'false'}
      aria-label={ariaLabel ?? locale.accessibility.backTop}
      aria-hidden={visible ? undefined : 'true'}
      tabIndex={visible ? 0 : -1}
      onClick={handleClick}
    >
      {children ?? (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 12.5V4M8 4 4 8M8 4l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
