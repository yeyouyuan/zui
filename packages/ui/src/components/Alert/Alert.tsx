'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { AlertTriangle, CheckCircle, Close, Info, XCircle } from '@zui/icons';
import { cx } from '../../utils';
import './Alert.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<React.ComponentPropsWithRef<'div'>, 'title'> {
  type?: AlertType; // 默认 'info'
  title?: React.ReactNode;
  children?: React.ReactNode; // 辅助描述
  closable?: boolean;
  onClose?: () => void;
  showIcon?: boolean; // 默认 true
  classNames?: { root?: string; icon?: string; title?: string; description?: string; close?: string };
}

/* --------------------------------- 内置图标 ------------------------------- */

function AlertIcon({ type }: { type: AlertType }): React.ReactNode {
  // 图标来自 @zui/icons（24 视窗、currentColor、stroke 2）
  if (type === 'success') return <CheckCircle />;
  if (type === 'error') return <XCircle />;
  if (type === 'warning') return <AlertTriangle />;
  return <Info />;
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Alert({
  type = 'info',
  title,
  children,
  closable = false,
  onClose,
  showIcon = true,
  classNames,
  className,
  ref,
  ...rest
}: AlertProps) {
  const { locale } = useZuiConfig();
  // 关闭后自我隐藏（非受控），同时通知外部
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-type={type}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={cx('z-alert', className, classNames?.root)}
    >
      {showIcon ? (
        <span data-part="icon" aria-hidden="true" className={cx('z-alert-icon', classNames?.icon)}>
          <AlertIcon type={type} />
        </span>
      ) : null}
      <div className="z-alert-body">
        {title != null ? (
          <div data-part="title" className={cx('z-alert-title', classNames?.title)}>
            {title}
          </div>
        ) : null}
        {children != null ? (
          <div data-part="description" className={cx('z-alert-description', classNames?.description)}>
            {children}
          </div>
        ) : null}
      </div>
      {closable ? (
        <button
          type="button"
          data-part="close"
          aria-label={locale.modal.close}
          className={cx('z-alert-close', classNames?.close)}
          onClick={() => {
            setDismissed(true);
            onClose?.();
          }}
        >
          <Close />
        </button>
      ) : null}
    </div>
  );
}
