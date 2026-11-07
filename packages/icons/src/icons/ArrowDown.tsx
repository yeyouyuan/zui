'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ArrowDown — 下箭头（带杆） */
export function ArrowDown({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m19 12-7 7-7-7" />
      <path d="M12 5v14" />
    </SvgIcon>
  );
}
