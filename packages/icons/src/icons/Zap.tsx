'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Zap — 闪电 */
export function Zap({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </SvgIcon>
  );
}
