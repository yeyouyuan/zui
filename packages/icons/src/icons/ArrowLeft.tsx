'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ArrowLeft — 左箭头（带杆） */
export function ArrowLeft({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </SvgIcon>
  );
}
