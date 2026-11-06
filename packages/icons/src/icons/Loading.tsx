'use client';

import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/**
 * Loading — 加载中（环形转圈）。
 * `spin` 默认 true（加载图标默认带动画）；传 `spin={false}` 可静态展示。
 * 动画用 SVG 内嵌 `<animateTransform>` 旋转 360° 循环，纯 SVG 实现、零 CSS 文件。
 */
export function Loading({ spin = true, ...rest }: IconProps) {
  return (
    <SvgIcon {...rest}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      {spin ? (
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      ) : null}
    </SvgIcon>
  );
}
