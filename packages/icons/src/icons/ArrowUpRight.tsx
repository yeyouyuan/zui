'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ArrowUpRight — 右上箭头 */
export function ArrowUpRight({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </SvgIcon>
  );
}
