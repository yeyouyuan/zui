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
  /** 优先归还焦点的显式目标 */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

function canRestoreFocus(
  element: HTMLElement | null,
  container: HTMLElement
): element is HTMLElement {
  if (!element?.isConnected || container.contains(element)) return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * 焦点陷阱（Modal / Dialog 使用）：
 * - 打开时聚焦容器内 initialFocusSelector 元素，否则首个可聚焦元素，最后容器本体
 * - Tab / Shift+Tab 在容器内循环
 * - 关闭时归还焦点到打开前的元素
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  {
    active,
    initialFocusSelector = '[data-autofocus]',
    returnFocus = true,
    returnFocusRef,
  }: UseFocusTrapOptions
) {
  React.useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // cleanup 里读取 ref 会拿到过期值；effect 建立时固定一次
    const explicitReturnTarget = returnFocusRef?.current ?? null;

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
        const activeElement = document.activeElement as HTMLElement | null;
        // 业务回调可能已经把焦点交给新页面标题或另一个界面；不要抢回旧触发点。
        if (
          activeElement &&
          activeElement !== document.body &&
          activeElement !== document.documentElement &&
          canRestoreFocus(activeElement, container)
        ) {
          return;
        }
        const layers = document.querySelectorAll<HTMLElement>(
          '[data-zui-modal-layer][data-state="open"]'
        );
        const outer = container.closest('[data-zui-modal-layer]')
          ? layers[layers.length - 1]?.querySelector<HTMLElement>('[role="dialog"]')
          : null;
        const explicitTarget = explicitReturnTarget;
        const target = canRestoreFocus(explicitTarget, container)
          ? explicitTarget
          : outer && canRestoreFocus(outer, container) && !outer.contains(previouslyFocused)
            ? outer
            : canRestoreFocus(previouslyFocused, container)
              ? previouslyFocused
              : null;
        if (target) target.focus();
        else document.body.focus();
      }
    };
  }, [active, containerRef, initialFocusSelector, returnFocus, returnFocusRef]);
}
