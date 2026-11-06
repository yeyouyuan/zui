'use client';

import * as React from 'react';

/**
 * 点击/触摸到 refs 之外时触发 handler（Select 下拉、Modal 遮罩等）。
 * 用 pointerdown 判定更贴近点击意图。
 */
export function useOnClickOutside(
  refs: React.RefObject<HTMLElement | null> | Array<React.RefObject<HTMLElement | null>>,
  handler: (event: PointerEvent) => void,
  enabled = true
) {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inside = list.some((ref) => ref.current?.contains(target));
      if (!inside) handlerRef.current(event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [refs, enabled]);
}
