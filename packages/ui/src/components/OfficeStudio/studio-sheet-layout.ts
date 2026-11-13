/** Row sizes use points in the document and CSS pixels in the viewport. */
export const STUDIO_POINTS_TO_PIXELS = 4 / 3;
export const STUDIO_DEFAULT_ROW_HEIGHT = 18;
export const STUDIO_MAX_ROW_HEIGHT = 409.5;

export interface StudioRowLayout {
  rows: readonly number[];
  indexes: Map<number, number>;
  /** Cumulative pixel offsets, with one trailing offset for the bottom edge. */
  offsets: number[];
}

export function studioBuildRowLayout(
  rows: readonly number[],
  heights?: Record<string, number>,
  defaultHeight = STUDIO_DEFAULT_ROW_HEIGHT
): StudioRowLayout {
  const offsets = [0];
  const fallback =
    Number.isFinite(defaultHeight) && defaultHeight > 0
      ? Math.min(STUDIO_MAX_ROW_HEIGHT, defaultHeight)
      : STUDIO_DEFAULT_ROW_HEIGHT;
  for (const row of rows) {
    const value = heights?.[String(row)];
    const points =
      value !== undefined && Number.isFinite(value) && value > 0
        ? Math.min(STUDIO_MAX_ROW_HEIGHT, value)
        : fallback;
    offsets.push(offsets[offsets.length - 1] + points * STUDIO_POINTS_TO_PIXELS);
  }
  return { rows, indexes: new Map(rows.map((row, index) => [row, index])), offsets };
}

function upperBound(values: readonly number[], target: number) {
  let first = 0;
  let last = values.length;
  while (first < last) {
    const middle = (first + last) >>> 1;
    if (values[middle] <= target) first = middle + 1;
    else last = middle;
  }
  return first;
}

function lowerBound(values: readonly number[], target: number) {
  let first = 0;
  let last = values.length;
  while (first < last) {
    const middle = (first + last) >>> 1;
    if (values[middle] < target) first = middle + 1;
    else last = middle;
  }
  return first;
}

export function studioViewportRows(
  layout: StudioRowLayout,
  scrollTop: number,
  viewportHeight: number,
  frozenCount = 0,
  headerHeight = 24,
  overscan = 3
): number[] {
  const frozen = Math.max(0, Math.min(layout.rows.length, frozenCount));
  const top = Math.max(0, scrollTop) + layout.offsets[frozen];
  if (top >= layout.offsets[layout.rows.length]) return [...layout.rows.slice(0, frozen)];
  const bottom = Math.max(top, Math.max(0, scrollTop) + viewportHeight - headerHeight);
  const first = Math.max(frozen, upperBound(layout.offsets, top) - 1 - overscan);
  const last = Math.min(layout.rows.length, lowerBound(layout.offsets, bottom) + overscan);
  return [...layout.rows.slice(0, frozen), ...layout.rows.slice(first, Math.max(first, last))];
}

/** Hidden rows occupy no space; their visible merged origin still needs a valid top. */
export function studioRowTop(layout: StudioRowLayout, row: number): number {
  return layout.offsets[lowerBound(layout.rows, row)];
}

export function studioRowSpanHeight(layout: StudioRowLayout, first: number, last = first): number {
  if (last < first) return 0;
  return layout.offsets[upperBound(layout.rows, last)] - studioRowTop(layout, first);
}

export interface StudioRowFitCell {
  text: string;
  width: number;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  wrap?: boolean;
}

/** Browser measurement is injected, with a deterministic fallback for unavailable layout. */
export function studioFitRowHeight(
  cells: readonly StudioRowFitCell[],
  defaultHeight = STUDIO_DEFAULT_ROW_HEIGHT,
  measure?: (cell: StudioRowFitCell) => number
): number {
  let height = defaultHeight * STUDIO_POINTS_TO_PIXELS;
  for (const cell of cells) {
    if (!cell.text) continue;
    const measured = measure?.(cell) ?? 0;
    if (Number.isFinite(measured) && measured > 0) {
      height = Math.max(height, measured + 4);
      continue;
    }
    const fontPixels = (cell.fontSize ?? 11) * STUDIO_POINTS_TO_PIXELS;
    const width = Math.max(1, cell.width - 10);
    const lines = cell.text.split(/\r\n|\r|\n/).reduce((count, line) => {
      const textWidth = Array.from(line).reduce(
        (total, character) => total + fontPixels * (character.codePointAt(0)! > 255 ? 1 : 0.55),
        0
      );
      return count + (cell.wrap ? Math.max(1, Math.ceil(textWidth / width)) : 1);
    }, 0);
    height = Math.max(height, lines * fontPixels * 1.15 + 4);
  }
  return Math.min(STUDIO_MAX_ROW_HEIGHT, Math.ceil((height * 4) / STUDIO_POINTS_TO_PIXELS) / 4);
}
