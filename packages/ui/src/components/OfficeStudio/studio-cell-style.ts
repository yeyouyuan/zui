import type { CSSProperties } from 'react';
import type { StudioCell } from './studio-types';

export const studioBorderSides = ['top', 'bottom', 'left', 'right'] as const;
export const studioBorderStyles = [
  'thin',
  'medium',
  'thick',
  'double',
  'dotted',
  'dashed',
  'hair',
  'dashDot',
  'dashDotDot',
  'mediumDashed',
  'mediumDashDot',
  'mediumDashDotDot',
  'slantDashDot',
] as const;

export function studioCellStyleIssue(cell: { verticalAlign?: unknown; borders?: unknown }) {
  if (
    cell.verticalAlign !== undefined &&
    !['top', 'middle', 'bottom'].includes(String(cell.verticalAlign))
  )
    return '垂直对齐方式无效。';
  if (cell.borders === undefined) return null;
  if (!cell.borders || typeof cell.borders !== 'object' || Array.isArray(cell.borders))
    return '单元格边框无效。';
  for (const [side, border] of Object.entries(cell.borders)) {
    if (
      !studioBorderSides.includes(side as (typeof studioBorderSides)[number]) ||
      !border ||
      typeof border !== 'object' ||
      Array.isArray(border) ||
      !studioBorderStyles.includes(border.style) ||
      Object.keys(border).some((key) => !['style', 'color'].includes(key)) ||
      (border.color !== undefined &&
        (typeof border.color !== 'string' || !/^#[\da-f]{6}$/i.test(border.color)))
    )
      return '单元格边框线型或颜色无效。';
  }
  return null;
}

export function studioBorderCss(
  border: NonNullable<StudioCell['borders']>[(typeof studioBorderSides)[number]],
  fallback = 'var(--z-color-fg)'
) {
  if (!border) return undefined;
  const width =
    border.style === 'double' || border.style === 'thick'
      ? 3
      : border.style.startsWith('medium')
        ? 2
        : 1;
  const style =
    border.style === 'double'
      ? 'double'
      : border.style === 'dotted' || border.style === 'hair'
        ? 'dotted'
        : /dash/i.test(border.style)
          ? 'dashed'
          : 'solid';
  return `${width}px ${style} ${border.color ?? fallback}`;
}

export function studioCellBordersCss(cell: StudioCell): CSSProperties {
  return Object.fromEntries(
    studioBorderSides
      .filter((side) => cell.borders?.[side])
      .map((side) => [
        `border${side[0].toUpperCase()}${side.slice(1)}`,
        studioBorderCss(cell.borders?.[side]),
      ])
  ) as CSSProperties;
}
