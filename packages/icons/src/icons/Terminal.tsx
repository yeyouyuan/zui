'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Terminal — 终端 */
export function Terminal({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </SvgIcon>
  );
}
