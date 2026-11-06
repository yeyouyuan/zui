'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ChevronUp — 上箭头（V 形） */
export function ChevronUp({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m18 15-6-6-6 6" />
    </SvgIcon>
  );
}
