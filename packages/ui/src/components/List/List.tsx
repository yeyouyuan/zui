'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './List.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface ListProps {
  items: Array<{
    key: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    extra?: React.ReactNode;
    avatar?: React.ReactNode;
  }>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bordered?: boolean; // 默认 true
  size?: 'sm' | 'md'; // 默认 'md'
  loading?: boolean;
  className?: string;
  classNames?: { root?: string; item?: string; meta?: string; extra?: string };
}

/* ---------------------------------- List ---------------------------------- */

/**
 * 列表：ul/li 语义 + 头像/标题/描述/右侧 extra，支持 bordered/size/loading。
 */
export function List({
  items,
  header,
  footer,
  bordered = true,
  size = 'md',
  loading = false,
  className,
  classNames,
}: ListProps) {
  const { locale } = useZuiConfig();
  return (
    <div
      data-part="root"
      className={cx('z-list', className, classNames?.root)}
      data-bordered={bordered ? 'true' : 'false'}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      aria-busy={loading ? true : undefined}
    >
      {header != null ? (
        <div data-part="header" className="z-list-header">
          {header}
        </div>
      ) : null}

      {loading ? (
        <div data-part="loading" className="z-list-loading" role="status" aria-label={locale.accessibility.loading}>
          <span className="z-list-spinner" aria-hidden="true" />
        </div>
      ) : (
        <ul data-part="body" className="z-list-body">
          {items.map((item) => (
            <li key={item.key} data-part="item" className={cx('z-list-item', classNames?.item)}>
              {item.avatar != null ? (
                <div data-part="avatar" className="z-list-item-avatar">
                  {item.avatar}
                </div>
              ) : null}

              <div data-part="meta" className={cx('z-list-item-meta', classNames?.meta)}>
                <div data-part="title" className="z-list-item-title">
                  {item.title}
                </div>
                {item.description != null ? (
                  <div data-part="description" className="z-list-item-description">
                    {item.description}
                  </div>
                ) : null}
              </div>

              {item.extra != null ? (
                <div data-part="extra" className={cx('z-list-item-extra', classNames?.extra)}>
                  {item.extra}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {footer != null ? (
        <div data-part="footer" className="z-list-footer">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
