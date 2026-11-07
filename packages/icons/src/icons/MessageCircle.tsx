'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** MessageCircle — 圆形消息 */
export function MessageCircle({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </SvgIcon>
  );
}
