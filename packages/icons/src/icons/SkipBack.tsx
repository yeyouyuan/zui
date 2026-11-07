'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** SkipBack — 快退 / 上一个 */
export function SkipBack({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m19 20-10-8 10-8v16z" />
      <path d="M5 19V5" />
    </SvgIcon>
  );
}
