'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useOnClickOutside } from '../../utils';
import './Popconfirm.css';

export interface PopconfirmProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** 默认走 locale.popconfirm.ok */
  okText?: string;
  /** 默认走 locale.popconfirm.cancel */
  cancelText?: string;
  /** 触发元素（单个 ReactElement，自动注入点击与 aria） */
  children: React.ReactElement;
  className?: string;
  classNames?: { root?: string; content?: string; actions?: string };
}

export function Popconfirm(props: PopconfirmProps) {
  const { locale } = useZuiConfig();
  const {
    title,
    description,
    onConfirm,
    onCancel,
    okText = locale.popconfirm.ok,
    cancelText = locale.popconfirm.cancel,
    children,
    className,
    classNames,
  } = props;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  const baseId = React.useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => close(false), open);

  const handleConfirm = () => {
    onConfirm?.();
    close(true);
  };

  const handleCancel = () => {
    onCancel?.();
    close(true);
  };

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  // 注入子元素：ref + onClick 开关 + aria-haspopup/expanded
  const childProps = children.props as Record<string, unknown>;
  const trigger = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const originalRef = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof originalRef === 'function') originalRef(node);
      else if (originalRef && typeof originalRef === 'object') {
        (originalRef as React.RefObject<HTMLElement | null>).current = node;
      }
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    onClick: (event: React.MouseEvent) => {
      (childProps.onClick as ((e: React.MouseEvent) => void) | undefined)?.(event);
      if (!event.defaultPrevented) setOpen((prev) => !prev);
    },
  });

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-popconfirm', classNames?.root, className)}
      data-open={open ? 'true' : 'false'}
    >
      {trigger}

      {open ? (
        <FloatingPanel
          open
          anchorRef={rootRef}
          align="center"
          offsetVariable="--z-popconfirm-gap"
          focusOnOpen
          initialFocusSelector="[data-part='ok']"
        >
          <div
            ref={panelRef}
            data-part="content"
            className={cx('z-popconfirm-content', classNames?.content)}
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            onKeyDown={onPanelKeyDown}
          >
            <div data-part="title" className="z-popconfirm-title" id={titleId}>
              {title}
            </div>
            {description ? (
              <div data-part="description" className="z-popconfirm-description" id={descId}>
                {description}
              </div>
            ) : null}
            <div data-part="actions" className={cx('z-popconfirm-actions', classNames?.actions)}>
              <button
                type="button"
                data-part="cancel"
                className="z-popconfirm-btn z-popconfirm-cancel"
                onClick={handleCancel}
              >
                {cancelText}
              </button>
              <button
                type="button"
                data-part="ok"
                className="z-popconfirm-btn z-popconfirm-ok"
                onClick={handleConfirm}
              >
                {okText}
              </button>
            </div>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
