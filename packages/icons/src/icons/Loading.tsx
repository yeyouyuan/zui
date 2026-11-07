'use client';

import * as React from 'react';
import type { IconProps } from '../IconProps.js';
import { SvgIcon } from '../SvgIcon.js';

/**
 * Loading — 加载中（环形转圈）。
 * `spin` 默认 true（加载图标默认带动画）；传 `spin={false}` 可静态展示。
 * 旋转用 Web Animations API（浏览器原生，无 SMIL 兼容性问题、无 CSS 文件依赖）；
 * 自动遵循 prefers-reduced-motion: reduce，并在系统设置改变时停止或恢复动画。
 * 复制出的 SVG 需自行加 CSS 动画（gallery 的「复制原始 SVG」会包含注释提示）。
 */
export function Loading({ spin = true, ref, ...rest }: IconProps) {
  const gRef = React.useRef<SVGGElement | null>(null);

  React.useEffect(() => {
    const g = gRef.current;
    if (!g || !spin || typeof g.animate !== 'function') return;
    g.style.transformBox = 'view-box';
    g.style.transformOrigin = 'center';
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : undefined;
    let animation: Animation | undefined;
    const updateMotion = () => {
      animation?.cancel();
      animation = undefined;
      if (media?.matches) return;
      animation = g.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
        duration: 1000,
        iterations: Infinity,
      });
    };
    updateMotion();
    if (media?.addEventListener) media.addEventListener('change', updateMotion);
    else media?.addListener(updateMotion);
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', updateMotion);
      else media?.removeListener(updateMotion);
      animation?.cancel();
    };
  }, [spin]);

  return (
    <SvgIcon ref={ref} {...rest}>
      <g ref={gRef}>
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      </g>
    </SvgIcon>
  );
}
