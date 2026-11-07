'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/** AlignRight — 右对齐 */
export function AlignRight({ spin, ...rest }: IconProps) {
  // spin 仅 Loading 有意义，此处按契约「接受但忽略」
  return (
    <SvgIcon {...rest}>
      <path d="M21 6H3" />
      <path d="M21 12H9" />
      <path d="M21 18H7" />
    </SvgIcon>
  );
}
