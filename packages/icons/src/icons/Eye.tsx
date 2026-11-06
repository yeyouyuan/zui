'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Eye — 可见（眼睛） */
export function Eye({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}
