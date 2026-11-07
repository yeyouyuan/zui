'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ArrowUp — 上箭头（带杆） */
export function ArrowUp({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </SvgIcon>
  );
}
