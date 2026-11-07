import type { ComponentPropsWithRef } from 'react';

/**
 * 图标组件公共 props（142 个图标统一遵循）。
 *
 * - `size`：图标边长（同时作用于 width/height），默认 `'1em'`，随字号缩放。
 * - `color`：描边颜色（stroke），默认 `'currentColor'`，随文字色继承。
 * - `spin`：仅 Loading 有意义（Web Animations API 旋转，遵循系统减少动态效果设置，
 *   零 CSS 依赖）；其它图标接受但忽略。
 * - 其余属性原生透传 `<svg>`（含 React 19 原生 `ref`，无 forwardRef）。
 */
export interface IconProps extends ComponentPropsWithRef<'svg'> {
  /** 图标边长，同时作用于 width/height，默认 '1em' */
  size?: number | string;
  /** 描边颜色（stroke），默认 currentColor */
  color?: string;
  /** 仅 Loading 有意义（旋转动画开关），其它图标接受但忽略 */
  spin?: boolean;
}
