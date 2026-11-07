'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Filter — 筛选 */
export function Filter({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </SvgIcon>
  );
}
