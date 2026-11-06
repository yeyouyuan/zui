'use client';

import * as React from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

/**
 * 滚动锁定（Modal / Message 场景）：引用计数，支持多层叠加；
 * 锁定期间补偿滚动条宽度防布局跳动。
 */
export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (lockCount === 0) {
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        const prevPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${prevPadding + scrollbarWidth}px`;
      }
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [active]);
}
