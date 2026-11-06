'use client';

import * as React from 'react';
import { ChevronRight } from '@zui/icons';
import { cx, useControllableState } from '../../utils';
import './Collapse.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface CollapseProps {
  items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode; disabled?: boolean }>;
  value?: string[];
  defaultValue?: string[];
  onChange?: (keys: string[]) => void;
  accordion?: boolean; // 手风琴模式（单开）
  className?: string;
  classNames?: { root?: string; item?: string; header?: string; content?: string };
}

/* -------------------------------- 图标（@zui/icons） -------------------------- */

function ArrowIcon(): React.ReactNode {
  // className 交给 CSS 旋转（展开时 rotate 90°）
  return <ChevronRight className="z-collapse-arrow-icon" size={12} />;
}

/* --------------------------------- Collapse -------------------------------- */

/**
 * 折叠面板：items 驱动 + 手风琴单开模式 + 展开高度动画（grid-template-rows 过渡）。
 * header 为 role="button" + aria-expanded/aria-controls（面板 aria-labelledby 回指）。
 */
export function Collapse({
  items,
  value,
  defaultValue,
  onChange,
  accordion = false,
  className,
  classNames,
}: CollapseProps) {
  const [activeKeys, setActiveKeys] = useControllableState<string[]>({
    value,
    defaultValue: defaultValue ?? [],
    onChange,
  });

  const baseId = React.useId();

  const toggle = (key: string, disabled?: boolean) => {
    if (disabled) return;
    if (accordion) {
      // 手风琴：单开；点开合面板 → 全收起
      setActiveKeys((prev) => (prev.includes(key) ? [] : [key]));
    } else {
      setActiveKeys((prev) =>
        prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
      );
    }
  };

  return (
    <div
      data-part="root"
      className={cx('z-collapse', className, classNames?.root)}
      data-accordion={accordion ? 'true' : undefined}
    >
      {items.map((item) => {
        const isOpen = activeKeys.includes(item.key);
        const headerId = `${baseId}-header-${item.key}`;
        const contentId = `${baseId}-content-${item.key}`;
        return (
          <div
            key={item.key}
            data-part="item"
            className={cx('z-collapse-item', classNames?.item)}
            data-expanded={isOpen ? 'true' : 'false'}
            data-disabled={item.disabled ? true : undefined}
          >
            <button
              type="button"
              role="button"
              id={headerId}
              data-part="header"
              className={cx('z-collapse-header', classNames?.header)}
              aria-expanded={isOpen}
              aria-controls={contentId}
              aria-disabled={item.disabled ? true : undefined}
              onClick={() => toggle(item.key, item.disabled)}
            >
              <span className="z-collapse-arrow" aria-hidden="true" data-expanded={isOpen ? 'true' : 'false'}>
                <ArrowIcon />
              </span>
              <span className="z-collapse-header-label">{item.label}</span>
            </button>

            <div
              id={contentId}
              role="region"
              aria-labelledby={headerId}
              data-part="content"
              className={cx('z-collapse-content', classNames?.content)}
              data-expanded={isOpen ? 'true' : 'false'}
            >
              <div className="z-collapse-content-inner" data-part="content-inner">
                {item.children}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
