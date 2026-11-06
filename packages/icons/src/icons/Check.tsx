'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Check — 对勾 */
export function Check({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M20 6 9 17l-5-5" />
    </SvgIcon>
  );
}
