'use client';

import * as React from 'react';
import { floatingPosition } from './floatingPosition';
import { Portal } from './portal';

interface FloatingPanelProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactElement<React.ComponentPropsWithRef<'div'>>;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  matchWidth?: boolean;
  offsetVariable?: string;
  focusOnOpen?: boolean;
  initialFocusSelector?: string;
}

/** 浮层脱离滚动容器，保留源主题并跟随锚点和内容尺寸重新定位。 */
export function FloatingPanel({ open, anchorRef, children, side = 'bottom', align = 'start',
  matchWidth = false, offsetVariable, focusOnOpen = false, initialFocusSelector }: FloatingPanelProps) {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const childRef = children.props.ref;
  const ref = React.useCallback((element: HTMLDivElement | null) => {
    setNode(element);
    if (typeof childRef === 'function') childRef(element);
    else if (childRef) childRef.current = element;
  }, [childRef]);
  const [position, setPosition] = React.useState<React.CSSProperties>({});

  React.useLayoutEffect(() => {
    if (!open || !node || !anchorRef.current) return;
    const anchor = anchorRef.current;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const width = matchWidth ? Math.min(rect.width, Math.max(0, viewport.width - 16)) : undefined;
      if (width !== undefined) node.style.width = `${width}px`;
      // 浏览器将 rem/calc/嵌套变量解析为 px，保留组件公开的间距变量。
      let offset = 4;
      if (offsetVariable) {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;display:block;height:0;padding:0;border:0;pointer-events:none';
        probe.style.width = `var(${offsetVariable}, 4px)`;
        node.append(probe);
        const pixels = parseFloat(window.getComputedStyle(probe).width);
        if (Number.isFinite(pixels)) offset = pixels;
        probe.remove();
      }
      const next = floatingPosition(rect, node.getBoundingClientRect(), viewport, { side, align, offset });
      const panelLayer = Number.parseInt(window.getComputedStyle(node).zIndex, 10) || 0;
      let layer = panelLayer;
      for (let parent: HTMLElement | null = anchor; parent; parent = parent.parentElement) {
        const parentLayer = Number.parseInt(window.getComputedStyle(parent).zIndex, 10);
        if (Number.isFinite(parentLayer) && parentLayer >= layer) layer = parentLayer + 1;
      }
      setPosition({ position: 'fixed', top: next.top, left: next.left, right: 'auto', bottom: 'auto',
        margin: 0, zIndex: layer, ...(width !== undefined ? { width } : {}) });
      node.dataset.floatingSide = next.side;
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    observer?.observe(node);
    observer?.observe(anchor);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, node, anchorRef, side, align, matchWidth, offsetVariable]);

  React.useEffect(() => {
    if (open && node && focusOnOpen) {
      (initialFocusSelector ? node.querySelector<HTMLElement>(initialFocusSelector) : null)?.focus();
      if (!node.contains(document.activeElement)) node.focus();
    }
  }, [open, node, focusOnOpen, initialFocusSelector]);

  return <Portal inheritFrom={anchorRef}>{React.cloneElement(children, {
    ref, style: { ...children.props.style, ...position },
  })}</Portal>;
}
