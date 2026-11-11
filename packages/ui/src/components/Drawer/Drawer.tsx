'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { Close } from '@zui/icons';
import {
  cx,
  Portal,
  useControllableState,
  useFocusTrap,
  useScrollLock,
  registerLayer,
  isTopmostLayer,
  isImeComposing,
} from '../../utils';
import './Drawer.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export type DrawerTriggerProps = React.ComponentPropsWithRef<'button'>;

export interface DrawerContentProps extends React.ComponentPropsWithRef<'div'> {
  placement?: DrawerPlacement; // 默认 'right'
  size?: number | string; // 抽屉宽/高，默认 378
  closeOnOverlay?: boolean; // 默认 true
  closeOnEsc?: boolean; // 默认 true
  classNames?: { overlay?: string; content?: string };
}

export type DrawerHeaderProps = React.ComponentPropsWithRef<'div'>;
export type DrawerTitleProps = React.ComponentPropsWithRef<'h2'>;
export type DrawerBodyProps = React.ComponentPropsWithRef<'div'>;
export type DrawerFooterProps = React.ComponentPropsWithRef<'div'>;
export type DrawerCloseProps = React.ComponentPropsWithRef<'button'>;

/* --------------------------------- Context -------------------------------- */

interface DrawerContextValue {
  open: boolean;
  /** 是否挂载（含退场动画期间），Content 仅在此时渲染 */
  mounted: boolean;
  setOpen: (open: boolean) => void;
  onExitComplete: () => void;
  titleId: string;
  hasTitle: boolean;
  registerTitle: (present: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawerContext(component: string): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`Drawer\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- 工具 ---------------------------------- */

/** 退场动画兜底时长（ms），与 CSS 动画时长一致；浏览器内以 animationend 为准 */
const EXIT_ANIMATION_DURATION = 300;

/** size 转 CSS 长度：数字按 px，字符串原样（如 '50%' / '20rem'） */
function toCssSize(size: number | string): string {
  return typeof size === 'number' ? `${size}px` : size;
}

/* ------------------------------- Drawer（Root） ---------------------------- */

function Drawer(props: DrawerProps) {
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
  const titleId = `${baseId}-title`;

  const [hasTitle, setHasTitle] = React.useState(false);
  const registerTitle = React.useCallback((present: boolean) => setHasTitle(present), []);

  const contextValue = React.useMemo<DrawerContextValue>(
    () => ({
      open,
      mounted,
      setOpen,
      onExitComplete,
      titleId,
      hasTitle,
      registerTitle,
    }),
    [open, mounted, setOpen, onExitComplete, titleId, hasTitle, registerTitle]
  );

  return <DrawerContext.Provider value={contextValue}>{children}</DrawerContext.Provider>;
}

/* ------------------------------ Drawer.Trigger ---------------------------- */

function DrawerTrigger(props: DrawerTriggerProps) {
  const { onClick, className, children, ...rest } = props;
  const ctx = useDrawerContext('Drawer.Trigger');

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
      data-part="trigger"
      className={cx('z-drawer-trigger', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.setOpen(!ctx.open);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Drawer.Content ---------------------------- */

function DrawerContent(props: DrawerContentProps) {
  const ctx = useDrawerContext('Drawer.Content');
  if (!ctx.mounted) return null;
  return <DrawerContentInner {...props} />;
}

function DrawerContentInner(props: DrawerContentProps) {
  const {
    placement = 'right',
    size = 378,
    closeOnOverlay = true,
    closeOnEsc = true,
    classNames,
    className,
    style,
    children,
    ref: userRef,
    ...rest
  } = props;
  const ctx = useDrawerContext('Drawer.Content');
  const { open, setOpen, onExitComplete } = ctx;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  // Portal 首帧渲染 null，需等 dialog 真正挂载后再激活焦点陷阱
  const [dialogNode, setDialogNode] = React.useState<HTMLDivElement | null>(null);

  const setDialogRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      dialogRef.current = element;
      setDialogNode(element);
      if (typeof userRef === 'function') userRef(element);
      else if (userRef) (userRef as React.RefObject<HTMLDivElement | null>).current = element;
    },
    [userRef]
  );

  // 打开期间锁定页面滚动
  useScrollLock(true);

  // APG Dialog 焦点规则：[data-autofocus] → 首个可聚焦 → dialog 本体；Tab 循环；关闭归还焦点
  useFocusTrap(dialogRef, {
    active: ctx.open && dialogNode !== null,
    initialFocusSelector: '[data-autofocus]',
    returnFocus: true,
  });

  // 弹层仲裁：按打开顺序注册 overlay（[data-zui-modal-layer]），Esc 仅栈顶弹层响应
  const layerNode = dialogNode?.parentElement ?? null;
  React.useEffect(() => {
    if (!open || !layerNode) return;
    return registerLayer(layerNode);
  }, [open, layerNode]);

  // Esc 关闭（document 级监听，焦点在 Portal 内也可靠）
  React.useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isTopmost = isTopmostLayer(dialogRef.current?.parentElement);
      const inNestedPopup =
        event.target instanceof Element &&
        !!event.target.closest('[data-zui-portal]') &&
        !event.target.closest('[data-zui-modal-layer]') &&
        !dialogRef.current?.contains(event.target);
      const activePopup = Array.from(
        document.querySelectorAll<HTMLElement>('[data-zui-popover-popup="open"]')
      ).some((popup) => popup.contains(document.activeElement));
      const popoverTrigger =
        event.target instanceof Element &&
        !!event.target.closest<HTMLElement>('[data-zui-popover-trigger="open"]');
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !isImeComposing(event) &&
        isTopmost &&
        !inNestedPopup &&
        !activePopup &&
        !popoverTrigger
      ) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEsc, setOpen]);

  // 关闭后：退场动画结束（或兜底计时）再卸载
  React.useEffect(() => {
    if (open) return;
    const element = dialogRef.current;
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
        data-zui-modal-layer=""
        data-part="overlay"
        data-state={state}
        data-placement={placement}
        className={cx('z-drawer-overlay', classNames?.overlay)}
        onMouseDown={(event) => {
          if (closeOnOverlay && event.target === event.currentTarget) ctx.setOpen(false);
        }}
      >
        <div
          {...rest}
          ref={setDialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
          data-part="content"
          data-state={state}
          data-placement={placement}
          className={cx('z-drawer', classNames?.content, className)}
          style={
            {
              ...style,
              ['--z-drawer-size' as string]: toCssSize(size),
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

/* ---------------------------- Drawer 结构子组件 ---------------------------- */

function DrawerHeader(props: DrawerHeaderProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="header" className={cx('z-drawer-header', className)} {...rest}>
      {children}
    </div>
  );
}

function DrawerTitle(props: DrawerTitleProps) {
  const { className, children, ...rest } = props;
  const ctx = useDrawerContext('Drawer.Title');
  const { registerTitle } = ctx;

  React.useLayoutEffect(() => {
    registerTitle(true);
    return () => registerTitle(false);
  }, [registerTitle]);

  return (
    <h2 {...rest} id={ctx.titleId} data-part="title" className={cx('z-drawer-title', className)}>
      {children}
    </h2>
  );
}

function DrawerBody(props: DrawerBodyProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="body" className={cx('z-drawer-body', className)} {...rest}>
      {children}
    </div>
  );
}

function DrawerFooter(props: DrawerFooterProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="footer" className={cx('z-drawer-footer', className)} {...rest}>
      {children}
    </div>
  );
}

function DrawerClose(props: DrawerCloseProps) {
  const { onClick, className, children, ...rest } = props;
  const ctx = useDrawerContext('Drawer.Close');
  const { locale } = useZuiConfig();
  const iconOnly = children == null || (typeof children === 'string' && children.trim() === '×');

  return (
    <button
      type="button"
      aria-label={iconOnly ? locale.drawer.close : undefined}
      data-has-label={iconOnly ? undefined : ''}
      data-part="close"
      className={cx('z-drawer-close', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.setOpen(false);
      }}
      {...rest}
    >
      {children ?? <Close />}
    </button>
  );
}

/* -------------------------------- Compound -------------------------------- */

const DrawerRoot = Object.assign(Drawer, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Header: DrawerHeader,
  Title: DrawerTitle,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Close: DrawerClose,
});

export {
  DrawerRoot as Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
};
