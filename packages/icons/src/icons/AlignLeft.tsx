'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** AlignLeft — 左对齐 */
export function AlignLeft({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M21 6H3" />
      <path d="M15 12H3" />
      <path d="M17 18H3" />
    </SvgIcon>
  );
}
