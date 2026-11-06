'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Plus — 加号 */
export function Plus({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </SvgIcon>
  );
}
