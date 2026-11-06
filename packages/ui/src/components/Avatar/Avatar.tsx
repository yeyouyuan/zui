'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Avatar.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type AvatarSize = 'sm' | 'md' | 'lg' | number;
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps extends Omit<React.ComponentPropsWithRef<'span'>, 'color' | 'onError'> {
  src?: string;
  alt?: string;
  name?: string; // 无图时取首字符（中文取第一个字，英文取首字母大写）
  icon?: React.ReactNode; // 无图无名时图标
  size?: AvatarSize; // sm 24 / md 32 / lg 40，number 自定义 px
  shape?: AvatarShape; // 默认 'circle'
  /** 图片加载失败回调（作用于 img） */
  onError?: React.ReactEventHandler<HTMLImageElement>;
  classNames?: { root?: string; image?: string; fallback?: string };
}

/* --------------------------------- 工具函数 -------------------------------- */

/** 名字哈希 → 5 组语义浅色之一（primary/success/warning/info/danger 的 subtle 对） */
const FALLBACK_COLORS = ['primary', 'success', 'warning', 'info', 'danger'] as const;
export type AvatarFallbackColor = (typeof FALLBACK_COLORS)[number];

export function hashNameColor(name: string): AvatarFallbackColor {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

/** 名字首字：中文取第一个字，英文取首字母大写 */
export function getNameInitial(name: string): string {
  const first = Array.from(name.trim())[0] ?? '';
  return /[a-z]/.test(first) ? first.toUpperCase() : first;
}

/** 内置默认图标：简洁用户轮廓（手绘线性，无版权问题） */
function DefaultUserIcon(): React.ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------- 组件实现 -------------------------------- */

export function Avatar({
  src,
  alt,
  name,
  icon,
  size = 'md',
  shape = 'circle',
  classNames,
  className,
  style,
  onError,
  ref,
  ...rest
}: AvatarProps) {
  // 图片加载失败记录失败的 src，换图后自动重试
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const hasImage = src != null && src !== '' && failedSrc !== src;

  const isNamedSize = typeof size === 'string';
  const sizeStyle: React.CSSProperties =
    !isNamedSize && typeof size === 'number'
      ? ({ '--z-avatar-size': `${size}px` } as React.CSSProperties)
      : {};

  // 三级回退：图 → 名字首字 → 图标（无图标时内置默认用户图标）
  let fallback: React.ReactNode;
  if (name != null && name !== '') {
    fallback = getNameInitial(name);
  } else {
    fallback = icon ?? <DefaultUserIcon />;
  }

  return (
    <span
      {...rest}
      ref={ref}
      data-part="root"
      data-size={isNamedSize ? size : 'custom'}
      data-shape={shape}
      data-color={name != null && name !== '' ? hashNameColor(name) : undefined}
      className={cx('z-avatar', className, classNames?.root)}
      style={{ ...style, ...sizeStyle }}
    >
      {hasImage ? (
        <img
          data-part="image"
          className={cx('z-avatar-image', classNames?.image)}
          src={src}
          alt={alt ?? name}
          onError={(event) => {
            setFailedSrc(src);
            onError?.(event);
          }}
        />
      ) : (
        <span data-part="fallback" className={cx('z-avatar-fallback', classNames?.fallback)}>
          {fallback}
        </span>
      )}
    </span>
  );
}
