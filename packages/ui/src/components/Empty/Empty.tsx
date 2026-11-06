'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Empty.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface EmptyProps extends React.ComponentPropsWithRef<'div'> {
  image?: React.ReactNode; // 自定义插图，默认内置简洁 SVG（两个矩形 + 圆）
  description?: React.ReactNode; // 默认「暂无数据」
  children?: React.ReactNode; // 操作区（如按钮）
  classNames?: { root?: string; image?: string; description?: string };
}

/* ------------------------------ 内置默认插图 ------------------------------ */

/** 手绘简洁插图：灰调两个矩形 + 一个圆（纯几何，无版权问题） */
function DefaultImage(): React.ReactNode {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      {/* 背景大矩形（文档/卡片轮廓） */}
      <rect x="8" y="12" width="32" height="42" rx="4" stroke="currentColor" strokeWidth="3" opacity="0.4" />
      {/* 前景小矩形（填充浅灰） */}
      <rect x="28" y="30" width="28" height="22" rx="3" fill="currentColor" opacity="0.22" />
      {/* 装饰圆 */}
      <circle cx="47" cy="18" r="8" stroke="currentColor" strokeWidth="3" opacity="0.4" />
    </svg>
  );
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Empty({
  image,
  description,
  children,
  classNames,
  className,
  ref,
  ...rest
}: EmptyProps) {
  const { locale } = useZuiConfig();
  return (
    <div
      {...rest}
      ref={ref}
      data-part="root"
      className={cx('z-empty', className, classNames?.root)}
    >
      <div data-part="image" className={cx('z-empty-image', classNames?.image)}>
        {image ?? <DefaultImage />}
      </div>
      <div data-part="description" className={cx('z-empty-description', classNames?.description)}>
        {description == null ? locale.empty.description : description}
      </div>
      {children != null ? (
        <div data-part="actions" className="z-empty-actions">
          {children}
        </div>
      ) : null}
    </div>
  );
}
