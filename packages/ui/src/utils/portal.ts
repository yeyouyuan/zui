'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  container?: Element | DocumentFragment | null;
  /** 在独立兄弟节点中渲染浮层时，指定提供组件变量的源元素。 */
  inheritFrom?: React.RefObject<HTMLElement | null>;
}

/** 保留原位置的主题与组件变量，再渲染到 document.body。 */
export function Portal({ children, container, inheritFrom }: PortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const sourceRef = React.useRef<HTMLSpanElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);

  React.useLayoutEffect(() => {
    if (!mounted) return;
    const source = inheritFrom?.current ?? sourceRef.current;
    const host = hostRef.current;
    if (!source || !host) return;
    const copied = new Set<string>();
    const syncTheme = () => {
      const computed = window.getComputedStyle(source);
      const next = new Set<string>();
      for (let index = 0; index < computed.length; index += 1) {
        const property = computed.item(index);
        if (!property.startsWith('--z-')) continue;
        next.add(property);
        host.style.setProperty(property, computed.getPropertyValue(property));
      }
      for (const property of copied) {
        if (!next.has(property)) host.style.removeProperty(property);
      }
      copied.clear();
      for (const property of next) copied.add(property);
      host.style.fontFamily = computed.fontFamily;
      host.style.fontSize = computed.fontSize;
      host.style.direction = computed.direction;
      host.style.colorScheme = computed.colorScheme;
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    for (let element: HTMLElement | null = source; element; element = element.parentElement) {
      observer.observe(element, { attributes: true });
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', syncTheme);
    window.addEventListener('resize', syncTheme);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', syncTheme);
      window.removeEventListener('resize', syncTheme);
    };
  }, [mounted, inheritFrom]);

  return React.createElement(React.Fragment, null,
    React.createElement('span', { ref: sourceRef, hidden: true, 'data-zui-portal-source': '' }),
    mounted && typeof document !== 'undefined'
      ? createPortal(React.createElement('div', {
        ref: hostRef, 'data-zui-portal': '', style: { display: 'contents' },
      }, children), container ?? document.body)
      : null
  );
}
