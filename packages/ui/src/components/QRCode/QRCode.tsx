'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import { encodeQR, qrMatrixToPathData, type ErrorCorrectionLevel } from './qrcode-encoder';
import './QRCode.css';

/* ---------------------------------- 类型 ---------------------------------- */

export type QRCodeLevel = ErrorCorrectionLevel;

export interface QRCodeProps
  extends Omit<React.ComponentPropsWithRef<'svg'>, 'value' | 'color' | 'width' | 'height'> {
  /** 二维码内容（数字 / 字母数字 / UTF-8 字节，容量见文档） */
  value: string;
  /** 边长 px（默认 160） */
  size?: number;
  /** 纠错级别（默认 'M'） */
  level?: QRCodeLevel;
  /** 前景色（默认 --z-color-fg，经 --z-qrcode-fg） */
  color?: string;
  /** 背景色（默认 --z-color-bg，经 --z-qrcode-bg） */
  bgColor?: string;
  className?: string;
  classNames?: { root?: string; bg?: string; modules?: string };
}

/** 标准静区：4 模块（白边，扫码器定位依赖） */
const QUIET_ZONE = 4;

/* --------------------------------- QRCode --------------------------------- */

export function QRCode(props: QRCodeProps) {
  const { locale } = useZuiConfig();
  const {
    value,
    size = 160,
    level = 'M',
    color,
    bgColor,
    className,
    classNames,
    'aria-label': ariaLabel,
    ref,
    ...rest
  } = props;

  // 空值或超出容量（版本 1-10）→ 空白占位，不抛错
  const encoded = React.useMemo(() => {
    if (!value) return null;
    try {
      return encodeQR(value, level);
    } catch {
      return null;
    }
  }, [value, level]);

  const total = (encoded?.size ?? 1) + QUIET_ZONE * 2;

  return (
    <svg
      {...rest}
      ref={ref}
      data-part="root"
      className={cx('z-qrcode', classNames?.root, className)}
      role="img"
      aria-label={ariaLabel ?? locale.accessibility.qrCode.replace('{value}', value)}
      data-level={level}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
    >
      <rect
        data-part="bg"
        className={cx('z-qrcode-bg', classNames?.bg)}
        x={0}
        y={0}
        width={total}
        height={total}
        style={bgColor ? { fill: bgColor } : undefined}
      />
      {encoded ? (
        <path
          data-part="modules"
          className={cx('z-qrcode-modules', classNames?.modules)}
          d={qrMatrixToPathData(encoded.modules, QUIET_ZONE)}
          style={color ? { fill: color } : undefined}
        />
      ) : null}
    </svg>
  );
}
