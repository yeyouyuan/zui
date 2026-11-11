'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Timeline.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type TimelineColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
export type TimelineMode = 'left' | 'right' | 'alternate';

export interface TimelineItem {
  key?: string;
  label?: React.ReactNode;
  children: React.ReactNode;
  color?: TimelineColor;
  dot?: React.ReactNode;
}

export interface TimelineProps extends Omit<React.ComponentPropsWithRef<'div'>, 'children'> {
  items: TimelineItem[];
  mode?: TimelineMode; // 默认 'left'
  pending?: React.ReactNode;
  classNames?: { root?: string; item?: string; dot?: string; label?: string; content?: string };
}

/* -------------------------------- Timeline -------------------------------- */

/**
 * 时间轴：竖线 + 节点圆点 + 内容；支持左侧/右侧/交替布局与 pending 尾节点。
 */
export function Timeline({
  items,
  mode = 'left',
  pending,
  className,
  classNames,
  ...rest
}: TimelineProps) {
  return (
    <div
      {...rest}
      role="list"
      data-part="root"
      data-mode={mode}
      className={cx('z-timeline', className, classNames?.root)}
    >
      {items.map((item, index) => {
        const key = item.key ?? `z-timeline-${index}`;
        return (
          <div
            key={key}
            role="listitem"
            data-part="item"
            data-color={item.color ?? 'neutral'}
            data-side={index % 2 === 1 ? 'right' : 'left'}
            className={cx('z-timeline-item', classNames?.item)}
          >
            <div data-part="dot" className={cx('z-timeline-dot', classNames?.dot)}>
              {item.dot != null ? (
                <span data-part="dot-custom" className="z-timeline-dot-custom">
                  {item.dot}
                </span>
              ) : (
                <span data-part="dot-default" className="z-timeline-dot-default" aria-hidden="true" />
              )}
            </div>
            {item.label != null ? (
              <div data-part="label" className={cx('z-timeline-label', classNames?.label)}>
                {item.label}
              </div>
            ) : null}
            <div data-part="content" className={cx('z-timeline-content', classNames?.content)}>
              {item.children}
            </div>
          </div>
        );
      })}

      {pending != null ? (
        <div
          role="listitem"
          data-part="pending"
          data-pending="true"
          className={cx('z-timeline-item', classNames?.item)}
        >
          <div data-part="dot" className={cx('z-timeline-dot', classNames?.dot)}>
            <span data-part="dot-pending" className="z-timeline-dot-pending" aria-hidden="true" />
          </div>
          <div data-part="content" className={cx('z-timeline-content', classNames?.content)}>
            {pending}
          </div>
        </div>
      ) : null}
    </div>
  );
}
