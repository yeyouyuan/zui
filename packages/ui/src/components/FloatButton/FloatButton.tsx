'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, useOnClickOutside } from '../../utils';
import './FloatButton.css';

export interface FloatButtonMenuItem {
  icon?: React.ReactNode;
  description?: React.ReactNode;
  onClick?: () => void;
}

export interface FloatButtonProps {
  icon?: React.ReactNode;
  description?: React.ReactNode;
  shape?: 'circle' | 'square'; // 默认 'circle'
  type?: 'default' | 'primary'; // 默认 'default'
  /** 菜单展开方式，默认 'click' */
  trigger?: 'click' | 'hover';
  onClick?: () => void;
  /** 触发展开菜单 */
  menu?: FloatButtonMenuItem[];
  className?: string;
  classNames?: { root?: string; menu?: string; item?: string };
  'aria-label'?: string;
}

export function FloatButton(props: FloatButtonProps) {
  const { locale } = useZuiConfig();
  const {
    icon,
    description,
    shape = 'circle',
    type = 'default',
    trigger = 'click',
    onClick,
    menu,
    className,
    classNames,
    'aria-label': ariaLabel,
    ...rest
  } = props;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);

  const hasMenu = (menu?.length ?? 0) > 0;

  const closeMenu = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useOnClickOutside(rootRef, () => closeMenu(false), open);

  const onRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const onTriggerClick = () => {
    onClick?.();
    if (!hasMenu) return;
    // hover 模式的 mouseenter 会先于 click 打开；点击保持打开，避免立即反向关闭。
    // 收起仍由 pointerleave、Escape 或点击外部负责。
    if (trigger === 'hover') setOpen(true);
    else setOpen((prev) => !prev);
  };

  return (
    <div
      {...rest}
      ref={rootRef}
      data-part="root"
      className={cx('z-float-button', classNames?.root, className)}
      data-shape={shape}
      data-type={type}
      data-open={open ? 'true' : 'false'}
      onKeyDown={onRootKeyDown}
      onMouseEnter={trigger === 'hover' && hasMenu ? () => setOpen(true) : undefined}
      onMouseLeave={trigger === 'hover' && hasMenu ? () => setOpen(false) : undefined}
    >
      {hasMenu ? (
        <ul
          data-part="menu"
          role="menu"
          className={cx('z-float-button-menu', classNames?.menu)}
          data-open={open ? 'true' : 'false'}
        >
          {menu?.map((item, index) => (
            <li key={index} data-part="item" className={cx('z-float-button-item', classNames?.item)}>
              <button
                type="button"
                role="menuitem"
                tabIndex={open ? 0 : -1}
                className="z-float-button-item-button"
                onClick={() => {
                  item.onClick?.();
                  closeMenu(false);
                }}
              >
                {item.icon ? (
                  <span className="z-float-button-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                {item.description ? (
                  <span className="z-float-button-desc">{item.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        ref={triggerRef}
        data-part="trigger"
        className="z-float-button-trigger"
        aria-label={ariaLabel ?? locale.accessibility.floatAction}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={hasMenu ? open : undefined}
        onFocus={trigger === 'hover' && hasMenu ? () => setOpen(true) : undefined}
        onClick={onTriggerClick}
      >
        {icon ?? (
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 3.5v9M3.5 8h9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
        {description ? (
          <span className="z-float-button-desc">{description}</span>
        ) : null}
      </button>
    </div>
  );
}
