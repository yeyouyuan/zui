'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { Close } from '@zui/icons';
import { cx } from '../../utils';
import './Tag.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TagColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface TagProps extends Omit<React.ComponentPropsWithRef<'span'>, 'color'> {
  color?: TagColor; // 默认 'neutral'
  closable?: boolean;
  onClose?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  classNames?: { root?: string; icon?: string; close?: string };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Tag({
  color = 'neutral',
  closable = false,
  onClose,
  icon,
  classNames,
  className,
  children,
  ...rest
}: TagProps) {
  const { locale } = useZuiConfig();
  // 关闭后自我隐藏（非受控），同时通知外部
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <span {...rest} data-part="root" data-color={color} className={cx('z-tag', className, classNames?.root)}>
      {icon != null ? (
        <span data-part="icon" aria-hidden="true" className={cx('z-tag-icon', classNames?.icon)}>
          {icon}
        </span>
      ) : null}
      <span className="z-tag-label">{children}</span>
      {closable ? (
        <button
          type="button"
          data-part="close"
          aria-label={locale.accessibility.removeTag}
          className={cx('z-tag-close', classNames?.close)}
          onClick={(e: React.MouseEvent) => {
            setDismissed(true);
            onClose?.(e);
          }}
        >
          <Close />
        </button>
      ) : null}
    </span>
  );
}
