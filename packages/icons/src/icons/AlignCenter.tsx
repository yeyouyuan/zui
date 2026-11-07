'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** AlignCenter — 居中对齐 */
export function AlignCenter({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M21 6H3" />
      <path d="M17 12H7" />
      <path d="M19 18H5" />
    </SvgIcon>
  );
}
