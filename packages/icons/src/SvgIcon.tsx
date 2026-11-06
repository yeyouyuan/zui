'use client';

import type { IconProps } from './IconProps.js';

/** SvgIcon 的 props：IconProps 去掉 spin（spin 由 Loading 自行处理，不落到 DOM） */
export type SvgIconProps = Omit<IconProps, 'spin'>;

/**
 * 图标公共骨架（内部实现，不对外导出）：
 * 24 视窗、stroke=currentColor、stroke-width 2、fill none、圆角线帽线段（Feather/Lucide 风格）。
 * 统一处理 size/color 默认值、React 19 原生 ref、aria-hidden 约定。
 */
export function SvgIcon({
  size = '1em',
  color = 'currentColor',
  children,
  ref,
  ...rest
}: SvgIconProps) {
  // aria-hidden 默认 true；调用方传了可访问名（aria-label / aria-labelledby）时露出给读屏
  const hasAccessibleName = rest['aria-label'] != null || rest['aria-labelledby'] != null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={hasAccessibleName ? undefined : true}
      {...rest}
      ref={ref}
    >
      {children}
    </svg>
  );
}
