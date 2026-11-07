'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** SkipForward — 快进 / 下一个 */
export function SkipForward({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m5 4 10 8-10 8V4z" />
      <path d="M19 5v14" />
    </SvgIcon>
  );
}
