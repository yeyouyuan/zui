'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Battery — 电池 */
export function Battery({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2" />
    </SvgIcon>
  );
}
