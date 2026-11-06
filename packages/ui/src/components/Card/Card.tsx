'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Card.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface CardProps extends Omit<React.ComponentPropsWithRef<'div'>, 'title'> {
  title?: React.ReactNode;
  extra?: React.ReactNode; // 头部右侧插槽
  cover?: React.ReactNode; // 顶部媒体区
  footer?: React.ReactNode;
  bordered?: boolean; // 默认 true
  hoverable?: boolean; // hover 阴影 + 上浮
  classNames?: {
    root?: string;
    header?: string;
    title?: string;
    extra?: string;
    cover?: string;
    body?: string;
    footer?: string;
  };
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Card({
  title,
  extra,
  cover,
  footer,
  bordered = true,
  hoverable = false,
  classNames,
  className,
  children,
  ref,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      data-bordered={bordered ? 'true' : 'false'}
      data-hoverable={hoverable ? 'true' : 'false'}
      className={cx('z-card', className, classNames?.root)}
    >
      {cover != null ? (
        <div data-part="cover" className={cx('z-card-cover', classNames?.cover)}>
          {cover}
        </div>
      ) : null}
      {title != null || extra != null ? (
        <div data-part="header" className={cx('z-card-header', classNames?.header)}>
          {title != null ? (
            <div data-part="title" className={cx('z-card-title', classNames?.title)}>
              {title}
            </div>
          ) : null}
          {extra != null ? (
            <div data-part="extra" className={cx('z-card-extra', classNames?.extra)}>
              {extra}
            </div>
          ) : null}
        </div>
      ) : null}
      {children != null ? (
        <div data-part="body" className={cx('z-card-body', classNames?.body)}>
          {children}
        </div>
      ) : null}
      {footer != null ? (
        <div data-part="footer" className={cx('z-card-footer', classNames?.footer)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
