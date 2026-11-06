'use client';

import * as React from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.getAttribute('aria-hidden') !== 'true' &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null &&
      !el.hasAttribute('disabled')
  );
}

interface UseFocusTrapOptions {
  active: boolean;
  /** 打开时优先聚焦的元素选择器 */
  initialFocusSelector?: string;
  /** 关闭时是否归还焦点到之前元素 */
  returnFocus?: boolean;
}

/**
 * 焦点陷阱（Modal / Dialog 使用）：
 * - 打开时聚焦容器内 initialFocusSelector 元素，否则首个可聚焦元素，最后容器本体
 * - Tab / Shift+Tab 在容器内循环
 * - 关闭时归还焦点到打开前的元素
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  { active, initialFocusSelector = '[data-autofocus]', returnFocus = true }: UseFocusTrapOptions
) {
  React.useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusInitial = () => {
      // A child may have received focus before the queued frame (including a
      // portaled picker). Do not move it back into the outer dialog.
      if (document.activeElement !== previouslyFocused) return;
      const target =
        container.querySelector<HTMLElement>(initialFocusSelector) ??
        getFocusableElements(container)[0] ??
        container;
      target.focus();
    };
    // 待 Portal/DOM 就绪后聚焦
    const raf = requestAnimationFrame(focusInitial);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('keydown', onKeyDown);
      if (returnFocus) {
        const layers = document.querySelectorAll<HTMLElement>('[data-zui-modal-layer][data-state="open"]');
        const outer = container.closest('[data-zui-modal-layer]')
          ? layers[layers.length - 1]?.querySelector<HTMLElement>('[role="dialog"]')
          : null;
        const target = outer && !outer.contains(previouslyFocused)
          ? outer
          : previouslyFocused;
        if (target?.isConnected) target.focus();
      }
    };
  }, [active, containerRef, initialFocusSelector, returnFocus]);
}
