'use client';

import * as React from 'react';
import { Close } from '@zui/icons';
import { useZuiConfig } from '../../config';
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
import './Modal.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export type ModalTriggerProps = React.ComponentPropsWithRef<'button'>;

export interface ModalContentProps extends React.ComponentPropsWithRef<'div'> {
  size?: 'sm' | 'md' | 'lg'; // 默认 'md'
  closeOnOverlay?: boolean; // 默认 true
  closeOnEsc?: boolean; // 默认 true
  restoreFocus?: boolean; // 默认 true
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onOverlayMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  classNames?: { overlay?: string; content?: string };
}

export type ModalHeaderProps = React.ComponentPropsWithRef<'div'>;
export type ModalTitleProps = React.ComponentPropsWithRef<'h2'>;
export type ModalDescriptionProps = React.ComponentPropsWithRef<'p'>;
export type ModalBodyProps = React.ComponentPropsWithRef<'div'>;
export type ModalFooterProps = React.ComponentPropsWithRef<'div'>;
export type ModalCloseProps = React.ComponentPropsWithRef<'button'>;

/* --------------------------------- Context -------------------------------- */

interface ModalContextValue {
  open: boolean;
  /** 是否挂载（含退场动画期间），Content 仅在此时渲染 */
  mounted: boolean;
  setOpen: (open: boolean) => void;
  onExitComplete: () => void;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  registerTitle: (present: boolean) => void;
  registerDescription: (present: boolean) => void;
}

const ModalContext = React.createContext<ModalContextValue | null>(null);

function useModalContext(component: string): ModalContextValue {
  const ctx = React.useContext(ModalContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`Modal\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- 工具 ---------------------------------- */

/** 退场动画兜底时长（ms），与 CSS 动画时长一致；浏览器内以 animationend 为准 */
const EXIT_ANIMATION_DURATION = 300;

/* ------------------------------- Modal（Root） ----------------------------- */

function Modal(props: ModalProps) {
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
  const descriptionId = `${baseId}-description`;

  const [hasTitle, setHasTitle] = React.useState(false);
  const [hasDescription, setHasDescription] = React.useState(false);
  const registerTitle = React.useCallback((present: boolean) => setHasTitle(present), []);
  const registerDescription = React.useCallback(
    (present: boolean) => setHasDescription(present),
    []
  );

  const contextValue = React.useMemo<ModalContextValue>(
    () => ({
      open,
      mounted,
      setOpen,
      onExitComplete,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      registerTitle,
      registerDescription,
    }),
    [
      open,
      mounted,
      setOpen,
      onExitComplete,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      registerTitle,
      registerDescription,
    ]
  );

  return <ModalContext.Provider value={contextValue}>{children}</ModalContext.Provider>;
}

/* ------------------------------- Modal.Trigger ---------------------------- */

function ModalTrigger(props: ModalTriggerProps) {
  const { onClick, className, children, ...rest } = props;
  const ctx = useModalContext('Modal.Trigger');

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
      data-part="trigger"
      className={cx('z-modal-trigger', className)}
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

/* ------------------------------- Modal.Content ---------------------------- */

function ModalContent(props: ModalContentProps) {
  const ctx = useModalContext('Modal.Content');
  if (!ctx.mounted) return null;
  return <ModalContentInner {...props} />;
}

function ModalContentInner(props: ModalContentProps) {
  const {
    size = 'md',
    closeOnOverlay = true,
    closeOnEsc = true,
    restoreFocus = true,
    returnFocusRef,
    onEscapeKeyDown,
    onOverlayMouseDown,
    classNames,
    className,
    children,
    ref: userRef,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = props;
  const ctx = useModalContext('Modal.Content');
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
    returnFocus: restoreFocus,
    returnFocusRef,
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
        onEscapeKeyDown?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEsc, onEscapeKeyDown, setOpen]);

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
        data-size={size}
        className={cx('z-modal-overlay', classNames?.overlay)}
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return;
          onOverlayMouseDown?.(event);
          if (closeOnOverlay && !event.defaultPrevented) ctx.setOpen(false);
        }}
      >
        <div
          {...rest}
          ref={setDialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy ?? (ctx.hasTitle ? ctx.titleId : undefined)}
          aria-describedby={ariaDescribedBy ?? (ctx.hasDescription ? ctx.descriptionId : undefined)}
          data-part="content"
          data-state={state}
          data-size={size}
          className={cx('z-modal', classNames?.content, className)}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

/* ---------------------------- Modal 结构子组件 ---------------------------- */

function ModalHeader(props: ModalHeaderProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="header" className={cx('z-modal-header', className)} {...rest}>
      {children}
    </div>
  );
}

function ModalTitle(props: ModalTitleProps) {
  const { className, children, ...rest } = props;
  const ctx = useModalContext('Modal.Title');
  const { registerTitle } = ctx;

  React.useLayoutEffect(() => {
    registerTitle(true);
    return () => registerTitle(false);
  }, [registerTitle]);

  return (
    <h2 {...rest} id={ctx.titleId} data-part="title" className={cx('z-modal-title', className)}>
      {children}
    </h2>
  );
}

function ModalDescription(props: ModalDescriptionProps) {
  const { className, children, ...rest } = props;
  const ctx = useModalContext('Modal.Description');
  const { registerDescription } = ctx;

  React.useLayoutEffect(() => {
    registerDescription(true);
    return () => registerDescription(false);
  }, [registerDescription]);

  return (
    <p
      {...rest}
      id={ctx.descriptionId}
      data-part="description"
      className={cx('z-modal-description', className)}
    >
      {children}
    </p>
  );
}

function ModalBody(props: ModalBodyProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="body" className={cx('z-modal-body', className)} {...rest}>
      {children}
    </div>
  );
}

function ModalFooter(props: ModalFooterProps) {
  const { className, children, ...rest } = props;
  return (
    <div data-part="footer" className={cx('z-modal-footer', className)} {...rest}>
      {children}
    </div>
  );
}

function ModalClose(props: ModalCloseProps) {
  const { onClick, className, children, ...rest } = props;
  const ctx = useModalContext('Modal.Close');
  const { locale } = useZuiConfig();
  const iconOnly = children == null || (typeof children === 'string' && children.trim() === '×');

  return (
    <button
      type="button"
      aria-label={iconOnly ? locale.modal.close : undefined}
      data-has-label={iconOnly ? undefined : ''}
      data-part="close"
      className={cx('z-modal-close', className)}
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

const ModalRoot = Object.assign(Modal, {
  Trigger: ModalTrigger,
  Content: ModalContent,
  Header: ModalHeader,
  Title: ModalTitle,
  Description: ModalDescription,
  Body: ModalBody,
  Footer: ModalFooter,
  Close: ModalClose,
});

export {
  ModalRoot as Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
};
