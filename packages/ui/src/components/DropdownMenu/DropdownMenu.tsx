'use client';

import * as React from 'react';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './DropdownMenu.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export type DropdownMenuTriggerProps = React.ComponentPropsWithRef<'button'>;

export interface DropdownMenuContentProps extends React.ComponentPropsWithRef<'div'> {
  classNames?: { content?: string };
}

export interface DropdownMenuItemProps
  extends Omit<React.ComponentPropsWithRef<'div'>, 'onSelect' | 'danger'> {
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean; // 红色危险项（删除类）
  icon?: React.ReactNode;
  children: React.ReactNode;
  classNames?: { item?: string; icon?: string };
}

export type DropdownMenuSeparatorProps = React.ComponentPropsWithRef<'div'>;
export type DropdownMenuLabelProps = React.ComponentPropsWithRef<'div'>;

/* --------------------------------- Context -------------------------------- */

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  initialFocusRef: React.MutableRefObject<'first' | 'last'>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(component: string): DropdownMenuContextValue {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`DropdownMenu\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- 工具 ---------------------------------- */

const ITEM_SELECTOR = '[data-part="item"]';

function getItemElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

function isEnabledItem(element: HTMLElement): boolean {
  return element.getAttribute('aria-disabled') !== 'true';
}

/** typeahead 匹配用纯文本：文本内容前缀匹配 */
function getItemText(element: HTMLElement): string {
  return (element.textContent ?? '').trim();
}

/** typeahead 前缀缓冲时长（ms），对齐 APG 惯例 */
const TYPEAHEAD_TIMEOUT = 500;

/* ----------------------------- DropdownMenu（Root） ----------------------- */

function DropdownMenu(props: DropdownMenuProps) {
  const { open: openProp, defaultOpen = false, onOpenChange, children } = props;

  const [open, setOpen] = useControllableState<boolean>({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const baseId = React.useId();
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const initialFocusRef = React.useRef<'first' | 'last'>('first');

  const contextValue = React.useMemo<DropdownMenuContextValue>(
    () => ({
      open,
      setOpen,
      triggerId,
      contentId,
      rootRef,
      triggerRef,
      contentRef,
      initialFocusRef,
    }),
    [open, setOpen, triggerId, contentId]
  );

  return (
    <DropdownMenuContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        data-part="root"
        className="z-dropdown-menu-root"
        data-state={open ? 'open' : 'closed'}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

/* --------------------------- DropdownMenu.Trigger ------------------------- */

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  const { onClick, onKeyDown, className, children, ref: userRef, ...rest } = props;
  const ctx = useDropdownMenuContext('DropdownMenu.Trigger');

  const setTriggerRef = React.useCallback(
    (element: HTMLButtonElement | null) => {
      ctx.triggerRef.current = element;
      if (typeof userRef === 'function') userRef(element);
      else if (userRef) (userRef as React.RefObject<HTMLButtonElement | null>).current = element;
    },
    [ctx, userRef]
  );

  return (
    <button
      type="button"
      {...rest}
      ref={setTriggerRef}
      id={ctx.triggerId}
      data-part="trigger"
      className={cx('z-dropdown-menu-trigger', className)}
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      aria-controls={ctx.open ? ctx.contentId : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!ctx.open) ctx.initialFocusRef.current = 'first';
        ctx.setOpen(!ctx.open);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        // 关闭态方向键打开菜单，并按按键决定挂载后的初始焦点。
        if (!ctx.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          ctx.initialFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
          ctx.setOpen(true);
        }
      }}
    >
      {children}
    </button>
  );
}

/* --------------------------- DropdownMenu.Content ------------------------- */

function DropdownMenuContent(props: DropdownMenuContentProps) {
  const ctx = useDropdownMenuContext('DropdownMenu.Content');
  if (!ctx.open) return null;
  return <DropdownMenuContentInner {...props} />;
}

function DropdownMenuContentInner(props: DropdownMenuContentProps) {
  const { classNames, className, children, onKeyDown, ref: userRef, ...rest } = props;
  const ctx = useDropdownMenuContext('DropdownMenu.Content');

  const [contentNode, setContentNode] = React.useState<HTMLDivElement | null>(null);
  const setContentRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      ctx.contentRef.current = element;
      setContentNode(element);
      if (typeof userRef === 'function') userRef(element);
      else if (userRef) (userRef as React.RefObject<HTMLDivElement | null>).current = element;
    },
    [ctx, userRef]
  );

  const typeaheadRef = React.useRef({ query: '', timer: 0 });

  const closeAndRefocusTrigger = React.useCallback(() => {
    ctx.setOpen(false);
    ctx.triggerRef.current?.focus();
  }, [ctx]);

  /** roving tabindex：目标项 0，其余 -1，随后聚焦 */
  const focusItem = React.useCallback((target: HTMLElement, items: HTMLElement[]) => {
    for (const item of items) {
      item.tabIndex = item === target ? 0 : -1;
    }
    target.focus();
  }, []);

  /** 首字母 typeahead：单字符重复输入循环匹配，连续输入按前缀匹配（跳过 disabled） */
  const handleTypeahead = React.useCallback(
    (char: string) => {
      const state = typeaheadRef.current;
      window.clearTimeout(state.timer);
      const isRepeat =
        state.query.length > 0 &&
        state.query.toLowerCase().split('').every((c) => c === char.toLowerCase());
      const query = isRepeat ? char : state.query + char;
      state.query = query;
      state.timer = window.setTimeout(() => {
        state.query = '';
      }, TYPEAHEAD_TIMEOUT);

      const prefix = query.toLowerCase();
      const items = getItemElements(ctx.contentRef.current);
      const enabled = items.filter(isEnabledItem);
      const total = enabled.length;
      if (total === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const current = enabled.indexOf(active as HTMLElement);
      const start = current < 0 ? 0 : current;
      const offset = isRepeat ? 1 : 0;
      for (let step = offset; step < total + offset; step += 1) {
        const index = (start + step) % total;
        if (getItemText(enabled[index]).toLowerCase().startsWith(prefix)) {
          focusItem(enabled[index], items);
          return;
        }
      }
    },
    [ctx.contentRef, focusItem]
  );

  const onContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const items = getItemElements(ctx.contentRef.current);
    const enabled = items.filter(isEnabledItem);
    const total = enabled.length;
    const active = document.activeElement as HTMLElement | null;
    const current = enabled.indexOf(active as HTMLElement);
    const isSpace = event.key === ' ' || event.key === 'Spacebar';
    const isPrintable =
      event.key.length === 1 && !isSpace && !event.ctrlKey && !event.metaKey && !event.altKey;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (total > 0) {
          focusItem(enabled[(current + 1 + total) % total], items);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (total > 0) {
          focusItem(enabled[(current - 1 + total) % total], items);
        }
        break;
      case 'Home':
        event.preventDefault();
        if (total > 0) focusItem(enabled[0], items);
        break;
      case 'End':
        event.preventDefault();
        if (total > 0) focusItem(enabled[total - 1], items);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndRefocusTrigger();
        break;
      case 'Tab':
        // Tab 关闭菜单，焦点由浏览器按文档流接管
        ctx.setOpen(false);
        break;
      default:
        if (isPrintable) handleTypeahead(event.key);
    }
  };

  // 打开时按 Trigger 的打开手势进入首项或末项（其余项保持 tabindex=-1）。
  React.useEffect(() => {
    if (!contentNode) return;
    const items = getItemElements(contentNode);
    for (const item of items) item.tabIndex = -1;
    const enabled = items.filter(isEnabledItem);
    const target =
      ctx.initialFocusRef.current === 'last' ? enabled[enabled.length - 1] : enabled[0];
    // 本次打开消费完方向；点击或后续默认打开仍从首项开始。
    ctx.initialFocusRef.current = 'first';
    if (target) {
      target.tabIndex = 0;
      target.focus();
    } else {
      contentNode.focus();
    }
  }, [contentNode, ctx.initialFocusRef]);

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [ctx.rootRef, ctx.contentRef], [ctx.rootRef, ctx.contentRef]);
  useOnClickOutside(outsideRefs, () => ctx.setOpen(false), ctx.open);

  return (
    <FloatingPanel open={ctx.open} anchorRef={ctx.rootRef} offsetVariable="--z-dropdown-menu-offset">
    <div
      {...rest}
      ref={setContentRef}
      role="menu"
      id={ctx.contentId}
      tabIndex={-1}
      data-part="content"
      className={cx('z-dropdown-menu', classNames?.content, className)}
      onKeyDown={onContentKeyDown}
    >
      {children}
    </div>
    </FloatingPanel>
  );
}

/* ----------------------------- DropdownMenu.Item -------------------------- */

function DropdownMenuItem(props: DropdownMenuItemProps) {
  const {
    onSelect,
    disabled = false,
    danger = false,
    icon,
    children,
    classNames,
    className,
    onClick,
    onKeyDown,
    onPointerDown,
    ref: userRef,
    ...rest
  } = props;
  const ctx = useDropdownMenuContext('DropdownMenu.Item');

  const handleSelect = () => {
    if (disabled) return;
    onSelect?.();
    // 触发后关闭并把焦点归还 Trigger
    ctx.setOpen(false);
    ctx.triggerRef.current?.focus();
  };

  return (
    <div
      {...rest}
      ref={userRef}
      role="menuitem"
      data-part="item"
      data-danger={danger ? 'true' : undefined}
      className={cx('z-dropdown-menu-item', className, classNames?.item)}
      aria-disabled={disabled || undefined}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // 防止点击菜单项时触发器/菜单失焦
        event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        handleSelect();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      {icon != null ? (
        <span
          data-part="icon"
          aria-hidden="true"
          className={cx('z-dropdown-menu-item-icon', classNames?.icon)}
        >
          {icon}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/* -------------------------- DropdownMenu.Separator ------------------------ */

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
  const { className, ...rest } = props;
  return (
    <div
      {...rest}
      role="separator"
      data-part="separator"
      className={cx('z-dropdown-menu-separator', className)}
    />
  );
}

/* ----------------------------- DropdownMenu.Label ------------------------- */

function DropdownMenuLabel(props: DropdownMenuLabelProps) {
  const { className, children, ...rest } = props;
  return (
    <div
      {...rest}
      role="presentation"
      data-part="label"
      className={cx('z-dropdown-menu-label', className)}
    >
      {children}
    </div>
  );
}

/* -------------------------------- Compound -------------------------------- */

const DropdownMenuRoot = Object.assign(DropdownMenu, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Label: DropdownMenuLabel,
});

export {
  DropdownMenuRoot as DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
