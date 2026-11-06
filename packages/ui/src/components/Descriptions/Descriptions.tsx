'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Descriptions.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type DescriptionsSize = 'sm' | 'md';

export interface DescriptionsProps extends Omit<React.ComponentPropsWithRef<'div'>, 'title'> {
  title?: React.ReactNode;
  column?: number; // 默认 3（每行项数）
  size?: DescriptionsSize; // 默认 'md'
  bordered?: boolean; // 默认 false
  children?: React.ReactNode; // Descriptions.Item
  classNames?: {
    root?: string;
    title?: string;
    body?: string;
    item?: string;
    label?: string;
    content?: string;
  };
}

export interface DescriptionsItemProps extends React.ComponentPropsWithRef<'div'> {
  label: React.ReactNode;
  span?: number; // 占据列数，默认 1
  children?: React.ReactNode;
}

/* --------------------------------- Context -------------------------------- */

interface DescriptionsContextValue {
  column: number;
  classNames?: DescriptionsProps['classNames'];
}

const DescriptionsContext = React.createContext<DescriptionsContextValue | null>(null);

/* --------------------------------- Descriptions --------------------------- */

/**
 * 描述列表：dl/dt/dd 语义的键值对展示，支持每行列数、尺寸与表格边框。
 */
function Descriptions({
  title,
  column = 3,
  size = 'md',
  bordered = false,
  children,
  className,
  classNames,
  ...rest
}: DescriptionsProps) {
  const safeColumn = Math.max(1, Math.floor(column));
  const context = React.useMemo<DescriptionsContextValue>(
    () => ({ column: safeColumn, classNames }),
    [safeColumn, classNames]
  );

  return (
    <div
      {...rest}
      data-part="root"
      data-size={size}
      data-bordered={bordered ? 'true' : 'false'}
      className={cx('z-descriptions', className, classNames?.root)}
    >
      {title != null ? (
        <div data-part="title" className={cx('z-descriptions-title', classNames?.title)}>
          {title}
        </div>
      ) : null}
      <dl
        data-part="body"
        className={cx('z-descriptions-body', classNames?.body)}
        style={{ '--z-descriptions-columns': String(safeColumn) } as React.CSSProperties}
      >
        <DescriptionsContext.Provider value={context}>{children}</DescriptionsContext.Provider>
      </dl>
    </div>
  );
}

/* ------------------------------- Descriptions.Item ------------------------ */

/**
 * 描述项：dt 标签 + dd 内容，span 控制跨列数（自动收敛到 column）。
 */
function DescriptionsItem({
  label,
  span,
  children,
  className,
  style,
  ...rest
}: DescriptionsItemProps) {
  const context = React.useContext(DescriptionsContext);
  const column = context?.column ?? 3;
  const spanValue = Math.min(Math.max(1, Math.floor(span ?? 1)), column);

  return (
    <div
      {...rest}
      data-part="item"
      data-span={String(spanValue)}
      className={cx('z-descriptions-item', className, context?.classNames?.item)}
      style={
        {
          '--z-descriptions-item-span': String(spanValue),
          ...style,
        } as React.CSSProperties
      }
    >
      <dt data-part="label" className={cx('z-descriptions-label', context?.classNames?.label)}>
        {label}
      </dt>
      <dd data-part="content" className={cx('z-descriptions-content', context?.classNames?.content)}>
        {children}
      </dd>
    </div>
  );
}

/* -------------------------------- Compound -------------------------------- */

const DescriptionsRoot = Object.assign(Descriptions, {
  Item: DescriptionsItem,
});

export {
  DescriptionsRoot as Descriptions,
  DescriptionsRoot as DescriptionsRoot,
  DescriptionsItem,
  DescriptionsItem as Item,
};
