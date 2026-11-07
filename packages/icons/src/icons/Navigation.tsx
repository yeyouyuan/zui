'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Navigation — 导航 */
export function Navigation({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m3 11 19-9-9 19-2-8-8-2z" />
    </SvgIcon>
  );
}
