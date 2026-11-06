'use client';

import * as React from 'react';
import {
  cx,
  floatingPosition,
  Portal,
  useControllableState,
  useFocusTrap,
  useOnClickOutside,
} from '../../utils';
import './Popover.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export interface PopoverTriggerProps extends React.ComponentPropsWithRef<'button'> {
  /** asChild 语义：克隆子元素并透传 toggle onClick 与 aria 状态 */
  asChild?: boolean;
}

export type PopoverAlign = 'start' | 'center' | 'end';
export type PopoverSide = 'bottom' | 'top';

export interface PopoverContentProps extends React.ComponentPropsWithRef<'div'> {
  align?: PopoverAlign; // 相对触发器对齐，默认 'start'
  side?: PopoverSide; // 默认 'bottom'
  classNames?: { content?: string };
}

/* --------------------------------- Context -------------------------------- */

interface PopoverContextValue {
  open: boolean;
  mounted: boolean;
  setOpen: (open: boolean) => void;
  onExitComplete: () => void;
  triggerId: string;
  contentId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string): PopoverContextValue {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`Popover\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- 工具 ---------------------------------- */

/** 退场动画兜底时长（ms），与 CSS 动画时长一致 */
const EXIT_ANIMATION_DURATION = 150;

/* ------------------------------- Popover（Root） -------------------------- */

function Popover(props: PopoverProps) {
  const { open: openProp, defaultOpen = false, onOpenChange, children } = props;

  const [open, setOpen] = useControllableState<boolean>({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const [mounted, setMounted] = React.useState(open);

  React.useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const onExitComplete = React.useCallback(() => setMounted(false), []);

  const baseId = React.useId();
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const contextValue = React.useMemo<PopoverContextValue>(
    () => ({
      open,
      mounted,
      setOpen,
      onExitComplete,
      triggerId,
      contentId,
      rootRef,
      triggerRef,
    }),
    [open, mounted, setOpen, onExitComplete, triggerId, contentId]
  );

  return (
    <PopoverContext.Provider value={contextValue}>
      <div ref={rootRef} data-part="root" className="z-popover-root">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

/* ------------------------------ Popover.Trigger --------------------------- */

function PopoverTrigger(props: PopoverTriggerProps) {
  const { asChild = false, onClick, className, children, ref: userRef, ...rest } = props;
  const ctx = usePopoverContext('Popover.Trigger');

  const setTriggerRef = React.useCallback(
    (element: HTMLElement | null) => {
      ctx.triggerRef.current = element;
      if (typeof userRef === 'function') userRef(element as HTMLButtonElement);
      else if (userRef) (userRef as React.RefObject<HTMLElement | null>).current = element;
    },
    [ctx, userRef]
  );

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) ctx.setOpen(!ctx.open);
  };

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error('Popover.Trigger 使用 asChild 时需要一个元素子节点');
    }
    const child = children as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(child, {
      ref: setTriggerRef,
      'aria-haspopup': 'dialog',
      'aria-expanded': ctx.open,
      'data-zui-popover-trigger': ctx.open ? 'open' : undefined,
      'aria-controls': ctx.open ? ctx.contentId : undefined,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        (child.props.onClick as ((event: React.MouseEvent) => void) | undefined)?.(event);
        toggle(event);
      },
    });
  }

  return (
    <button
      type="button"
      {...rest}
      ref={setTriggerRef}
      id={ctx.triggerId}
      data-part="trigger"
      className={cx('z-popover-trigger', className)}
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
      data-zui-popover-trigger={ctx.open ? 'open' : undefined}
      aria-controls={ctx.open ? ctx.contentId : undefined}
      onClick={toggle}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Popover.Content --------------------------- */

function PopoverContent(props: PopoverContentProps) {
  const ctx = usePopoverContext('Popover.Content');
  if (!ctx.mounted) return null;
  return <PopoverContentInner {...props} />;
}

function PopoverContentInner(props: PopoverContentProps) {
  const {
    align = 'start',
    side = 'bottom',
    classNames,
    className,
    children,
    style,
    onKeyDown: userOnKeyDown,
    ref: userRef,
    role = 'dialog',
    ...rest
  } = props;
  const ctx = usePopoverContext('Popover.Content');
  const { open, setOpen, onExitComplete } = ctx;

  const contentRef = React.useRef<HTMLDivElement | null>(null);
  // Portal 首帧渲染 null，需等 content 真正挂载后再激活焦点管理
  const [contentNode, setContentNode] = React.useState<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number; side: PopoverSide; zIndex?: number }>({
    top: 0,
    left: 0,
    side,
  });

  const setContentRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element;
      setContentNode(element);
      if (typeof userRef === 'function') userRef(element);
      else if (userRef) (userRef as React.RefObject<HTMLDivElement | null>).current = element;
    },
    [userRef]
  );

  // 以触发器为锚点计算 fixed 定位（jsdom 矩形全 0，仅影响样式不影响行为）
  const updatePosition = React.useCallback(() => {
    const trigger = ctx.triggerRef.current;
    const element = contentRef.current;
    if (!trigger || !element) return;
    const t = trigger.getBoundingClientRect();
    const c = element.getBoundingClientRect();
    const offset = parseFloat(window.getComputedStyle(element).rowGap) || 8;
    const next = floatingPosition(t, c, { width: window.innerWidth, height: window.innerHeight }, { side, align, offset });
    let layer = Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
    for (let parent: HTMLElement | null = trigger; parent; parent = parent.parentElement) {
      const parentLayer = Number.parseInt(window.getComputedStyle(parent).zIndex, 10);
      if (Number.isFinite(parentLayer) && parentLayer >= layer) layer = parentLayer + 1;
    }
    setPosition({ ...next, side: next.side as PopoverSide, zIndex: layer });
  }, [align, side, ctx.triggerRef]);

  React.useLayoutEffect(() => {
    if (!contentNode) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : undefined;
    observer?.observe(contentNode);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      observer?.disconnect();
    };
  }, [contentNode, updatePosition]);

  // 打开焦点进 content 首个可聚焦元素（[data-autofocus] 优先），关闭归还触发元素
  useFocusTrap(contentRef, {
    active: ctx.open && contentNode !== null,
    initialFocusSelector: '[data-autofocus]',
    returnFocus: true,
  });

  // Esc 关闭（文档级监听，焦点在 Portal 内也可靠）
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  // 点击外部关闭（root 含触发器，触发器自身点击走 toggle）
  const outsideRefs = React.useMemo(() => [ctx.rootRef, contentRef], [ctx.rootRef]);
  useOnClickOutside(outsideRefs, () => ctx.setOpen(false), ctx.open);

  // 关闭后：退场动画结束（或兜底计时）再卸载
  React.useEffect(() => {
    if (open) return;
    const element = contentRef.current;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onExitComplete();
    };
    const timer = window.setTimeout(finish, EXIT_ANIMATION_DURATION);
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target === element) finish();
    };
    element?.addEventListener('animationend', onAnimationEnd);
    return () => {
      window.clearTimeout(timer);
      element?.removeEventListener('animationend', onAnimationEnd);
    };
  }, [open, onExitComplete]);

  const state = ctx.open ? 'open' : 'closed';

  return (
    <Portal>
      <div
        {...rest}
        ref={setContentRef}
        role={role}
        id={ctx.contentId}
        tabIndex={-1}
        data-part="content"
        data-state={state}
        data-zui-popover-popup={state}
        data-side={side}
        data-placement={position.side}
        data-align={align}
        className={cx('z-popover', classNames?.content, className)}
        style={{ position: 'fixed', top: position.top, left: position.left,
          zIndex: position.zIndex, ...style }}
        onKeyDown={(event) => {
          userOnKeyDown?.(event);
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

/* -------------------------------- Compound -------------------------------- */

const PopoverRoot = Object.assign(Popover, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
});

export { PopoverRoot as Popover, PopoverTrigger, PopoverContent };
