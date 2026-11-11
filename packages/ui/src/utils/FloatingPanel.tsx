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

    // 浏览器将 rem/calc/嵌套变量解析为 px。公开间距变量只需在本次挂载时
    // 探测一次，避免每次滚动都 append/remove DOM 节点并强制布局。
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

    // 层级只依赖当前 panel 与锚点祖先的 stacking context；挂载时计算一次。
    const panelLayer = Number.parseInt(window.getComputedStyle(node).zIndex, 10) || 0;
    let layer = panelLayer;
    for (let parent: HTMLElement | null = anchor; parent; parent = parent.parentElement) {
      const parentLayer = Number.parseInt(window.getComputedStyle(parent).zIndex, 10);
      if (Number.isFinite(parentLayer) && parentLayer >= layer) layer = parentLayer + 1;
    }

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const width = matchWidth ? Math.min(rect.width, Math.max(0, viewport.width - 16)) : undefined;
      if (width !== undefined) node.style.width = `${width}px`;
      const next = floatingPosition(rect, node.getBoundingClientRect(), viewport, { side, align, offset });
      setPosition({ position: 'fixed', top: next.top, left: next.left, right: 'auto', bottom: 'auto',
        margin: 0, zIndex: layer, ...(width !== undefined ? { width } : {}) });
      node.dataset.floatingSide = next.side;
    };
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleUpdate) : undefined;
    observer?.observe(node);
    observer?.observe(anchor);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      observer?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
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
