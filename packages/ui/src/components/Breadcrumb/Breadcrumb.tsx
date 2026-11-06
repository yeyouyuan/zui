'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Breadcrumb.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface BreadcrumbProps extends React.ComponentPropsWithRef<'nav'> {
  /** 分隔符内容，默认 '/' */
  separator?: React.ReactNode;
  children?: React.ReactNode;
  classNames?: { root?: string; item?: string; separator?: string };
}

export interface BreadcrumbItemProps extends Omit<React.ComponentPropsWithRef<'a'>, 'ref'> {
  /** 有 href 渲染 <a>，否则渲染 <span> */
  href?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLAnchorElement | HTMLSpanElement>;
}

/* --------------------------------- Context -------------------------------- */

interface BreadcrumbContextValue {
  classNames?: BreadcrumbProps['classNames'];
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null);

/* ---------------------------------- Root ---------------------------------- */

function Breadcrumb({
  separator = '/',
  children,
  className,
  classNames,
  ref,
  ...rest
}: BreadcrumbProps) {
  const { locale } = useZuiConfig();
  const items = React.Children.toArray(children);
  const lastIndex = items.length - 1;

  const contextValue = React.useMemo<BreadcrumbContextValue>(
    () => ({ classNames }),
    [classNames]
  );

  return (
    <BreadcrumbContext.Provider value={contextValue}>
      <nav
        {...rest}
        ref={ref}
        role="navigation"
        aria-label={locale.accessibility.breadcrumb}
        data-part="root"
        className={cx('z-breadcrumb', className, classNames?.root)}
      >
        <ol>
          {items.map((child, index) => {
            const isLast = index === lastIndex;
            // 最后一项 aria-current="page"
            const item =
              isLast && React.isValidElement(child)
                ? React.cloneElement(
                    child as React.ReactElement<{ 'aria-current'?: 'page' }>,
                    { 'aria-current': 'page' }
                  )
                : child;
            return (
              <li key={index}>
                {item}
                {isLast ? null : (
                  <span
                    data-part="separator"
                    aria-hidden="true"
                    className={cx('z-breadcrumb-separator', classNames?.separator)}
                  >
                    {separator}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </BreadcrumbContext.Provider>
  );
}

/* ---------------------------------- Item ---------------------------------- */

function BreadcrumbItem({ href, children, className, ref, ...rest }: BreadcrumbItemProps) {
  const context = React.useContext(BreadcrumbContext);
  const itemClassName = cx('z-breadcrumb-item', className, context?.classNames?.item);

  if (href !== undefined) {
    return (
      <a
        {...rest}
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        data-part="item"
        className={itemClassName}
      >
        {children}
      </a>
    );
  }

  return (
    <span
      {...rest}
      ref={ref as React.Ref<HTMLSpanElement>}
      data-part="item"
      className={itemClassName}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Compound -------------------------------- */

const BreadcrumbRoot = Object.assign(Breadcrumb, {
  Item: BreadcrumbItem,
});

export { BreadcrumbRoot as Breadcrumb, BreadcrumbItem };
