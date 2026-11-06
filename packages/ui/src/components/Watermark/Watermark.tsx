'use client';

import * as React from 'react';
import { cx } from '../../utils';
import './Watermark.css';

export interface WatermarkProps {
  /** 文本水印内容（字符串/数字会平铺绘制） */
  content?: React.ReactNode | React.ReactNode[];
  /** 图片水印（data-uri/base64，优先于 content） */
  image?: string;
  /** 旋转角度（deg），默认 -22 */
  rotate?: number;
  /** 平铺间距 [x, y]，默认 [100, 100] */
  gap?: [number, number];
  children: React.ReactNode;
  className?: string;
  classNames?: { root?: string; overlay?: string };
}

/** ReactNode 树扁平化为可绘制的文本行 */
function toLines(node: React.ReactNode | React.ReactNode[]): string[] {
  const lines: string[] = [];
  const walk = (value: React.ReactNode) => {
    if (value === null || value === undefined || typeof value === 'boolean') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) lines.push(text);
      return;
    }
    if (React.isValidElement(value)) walk((value.props as { children?: React.ReactNode }).children);
  };
  walk(node);
  return lines;
}

/** RFC3986 完全百分号编码：jsdom/部分解析器对 url() 内未转义括号敏感，
 *  将 !'()* 也转义后对真实浏览器同样合法（encodeURI 超集）。 */
function encodeDataUri(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )}")`;
}

/** 单元格 SVG data-uri：按 gap 平铺 */
function buildTile(lines: string[], image: string | undefined, rotate: number, gap: [number, number]): string {
  const [gx, gy] = gap;
  if (image) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${gx}" height="${gy}">` +
      `<image href="${image}" width="${gx}" height="${gy}" preserveAspectRatio="xMidYMid meet"/>` +
      `</svg>`;
    return encodeDataUri(svg);
  }
  const font = Math.min(16, Math.max(12, Math.floor(gy / 6)));
  const textNodes = lines
    .map((line, index) => {
      const dy = (index - (lines.length - 1) / 2) * font * 1.4;
      return `<text x="50%" y="50%" dy="${dy}" text-anchor="middle" dominant-baseline="middle" font-size="${font}" fill="rgba(0,0,0,0.15)" font-family="sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${gx}" height="${gy}">` +
    `<g transform="rotate(${rotate} ${gx / 2} ${gy / 2})">${textNodes}</g>` +
    `</svg>`;
  return encodeDataUri(svg);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function Watermark(props: WatermarkProps) {
  const {
    content,
    image,
    rotate = -22,
    gap = [100, 100],
    children,
    className,
    classNames,
    ...rest
  } = props;

  const lines = React.useMemo(() => (image ? [] : toLines(content)), [content, image]);
  const tile = React.useMemo(
    () => buildTile(lines, image, rotate, gap),
    [lines, image, rotate, gap]
  );

  return (
    <div
      {...rest}
      data-part="root"
      className={cx('z-watermark', classNames?.root, className)}
      data-rotate={rotate}
    >
      {children}
      <div
        data-part="overlay"
        className={cx('z-watermark-overlay', classNames?.overlay)}
        aria-hidden="true"
        style={{ backgroundImage: tile, backgroundSize: `${gap[0]}px ${gap[1]}px` }}
      />
    </div>
  );
}
