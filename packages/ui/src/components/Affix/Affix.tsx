'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Affix.css';

export interface AffixProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange'> {
  /** 固定阈值（距容器顶部），与 offsetBottom 二选一，offsetTop 优先 */
  offsetTop?: number;
  /** 固定阈值（距容器底部） */
  offsetBottom?: number;
  /** 滚动容器，默认 window */
  target?: () => HTMLElement | Window;
  /** 固定态切换回调 */
  onChange?: (affixed: boolean) => void;
  children: React.ReactNode;
  classNames?: { root?: string; content?: string };
}

function isWindow(scroller: HTMLElement | Window): boolean {
  return !(scroller instanceof window.HTMLElement);
}

/** 参考系视口高度：window 取 innerHeight，容器取其可视高度 */
function getViewportHeight(scroller: HTMLElement | Window): number {
  return isWindow(scroller) ? window.innerHeight : (scroller as HTMLElement).clientHeight;
}

export function Affix(props: AffixProps) {
  const {
    offsetTop,
    offsetBottom,
    target,
    onChange,
    children,
    className,
    classNames,
    ...rest
  } = props;

  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [affixed, setAffixed] = React.useState(false);
  const [placeholderStyle, setPlaceholderStyle] = React.useState<React.CSSProperties>({});
  const [fixedStyle, setFixedStyle] = React.useState<React.CSSProperties>({});
  const rafRef = React.useRef(0);
  const affixedRef = React.useRef(false);

  const update = React.useCallback(() => {
    rafRef.current = 0;
    const placeholder = placeholderRef.current;
    if (!placeholder) return;
    const scroller = target ? target() : window;
    const rect = placeholder.getBoundingClientRect();

    // 判定阈值：offsetTop 优先，否则 offsetBottom
    let shouldAffix: boolean;
    if (offsetBottom !== undefined && offsetTop === undefined) {
      const bottomLimit = getViewportHeight(scroller) - offsetBottom;
      shouldAffix = rect.bottom <= bottomLimit;
    } else {
      shouldAffix = rect.top <= (offsetTop ?? 0);
    }

    if (shouldAffix) {
      setPlaceholderStyle({
        width: rect.width,
        height: rect.height,
      });
      const style: React.CSSProperties = {
        position: 'fixed',
        width: rect.width,
        height: rect.height,
      };
      if (offsetBottom !== undefined && offsetTop === undefined) style.bottom = offsetBottom;
      else style.top = offsetTop ?? 0;
      // 横向跟随占位符
      style.left = rect.left;
      setFixedStyle(style);
    } else {
      setPlaceholderStyle({});
      setFixedStyle({});
    }

    if (shouldAffix !== affixedRef.current) {
      affixedRef.current = shouldAffix;
      setAffixed(shouldAffix);
      onChange?.(shouldAffix);
    }
  }, [target, offsetTop, offsetBottom, onChange]);

  React.useEffect(() => {
    const scroller = target ? target() : window;
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(update);
    };
    update();
    const listenerTarget = isWindow(scroller) ? window : (scroller as HTMLElement);
    listenerTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      listenerTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [target, update]);

  return (
    <div
      {...rest}
      data-part="root"
      className={cx('z-affix', classNames?.root, className)}
      data-affixed={affixed ? 'true' : 'false'}
      style={affixed ? { ...placeholderStyle, ...rest.style } : rest.style}
      ref={placeholderRef}
    >
      <div
        data-part="content"
        className={cx('z-affix-content', classNames?.content)}
        ref={contentRef}
        style={affixed ? fixedStyle : undefined}
      >
        {children}
      </div>
    </div>
  );
}
