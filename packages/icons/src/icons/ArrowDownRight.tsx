'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** ArrowDownRight — 右下箭头 */
export function ArrowDownRight({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </SvgIcon>
  );
}
