'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ChevronLeft — 左箭头（V 形） */
export function ChevronLeft({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m15 18-6-6 6-6" />
    </SvgIcon>
  );
}
