'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ChevronRight — 右箭头（V 形） */
export function ChevronRight({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}
