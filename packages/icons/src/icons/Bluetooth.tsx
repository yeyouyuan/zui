'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** Bluetooth — 蓝牙 */
export function Bluetooth({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="m7 7 10 10-5 5V2l5 5L7 17" />
    </SvgIcon>
  );
}
