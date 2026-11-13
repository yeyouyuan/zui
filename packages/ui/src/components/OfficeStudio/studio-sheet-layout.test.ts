import { describe, expect, it } from 'vitest';
import {
  studioBuildRowLayout,
  studioFitRowHeight,
  studioRowSpanHeight,
  studioRowTop,
  studioViewportRows,
} from './studio-sheet-layout';

describe('sheet row layout', () => {
  it('uses point sizes and sums only visible rows, including fractional defaults', () => {
    const layout = studioBuildRowLayout([1, 3, 4], { 1: 30.75, 2: 80, 4: 12 }, 18.75);
    expect(layout.offsets).toEqual([0, 41, 66, 82]);
    expect(studioRowTop(layout, 2)).toBe(41);
    expect(studioRowSpanHeight(layout, 1, 3)).toBe(66);
    expect(studioRowSpanHeight(layout, 2, 4)).toBe(41);
    expect(studioRowSpanHeight(layout, 2)).toBe(0);
  });

  it('keeps tall rows mounted while their upper edge is above the viewport', () => {
    const layout = studioBuildRowLayout([1, 2, 3, 4], { 2: 300 });
    expect(studioViewportRows(layout, 200, 100, 0, 24, 0)).toEqual([2]);
    expect(studioViewportRows(layout, 424, 100, 0, 24, 0)).toEqual([3, 4]);
  });

  it('counts the visible frozen height when finding the scrollable viewport', () => {
    const rows = Array.from({ length: 10000 }, (_, index) => index + 1);
    const layout = studioBuildRowLayout(rows, { 1: 60, 2: 30 });
    const visible = studioViewportRows(layout, 1000, 420, 2);
    expect(visible.slice(0, 2)).toEqual([1, 2]);
    expect(new Set(visible).size).toBe(visible.length);
    expect(visible.length).toBeLessThan(30);
    expect(visible).not.toContain(3);
  });

  it('handles all hidden rows and a viewport beyond the final row', () => {
    expect(studioViewportRows(studioBuildRowLayout([]), 0, 420)).toEqual([]);
    expect(studioRowSpanHeight(studioBuildRowLayout([]), 1, 100)).toBe(0);
    expect(studioViewportRows(studioBuildRowLayout([1, 2]), 10000, 420)).toHaveLength(0);
  });

  it('does not let malformed legacy heights produce NaN coordinates', () => {
    const layout = studioBuildRowLayout([1, 2, 3, 4], { 1: NaN, 2: Infinity, 3: 0, 4: 1000 });
    expect(layout.offsets).toEqual([0, 24, 48, 72, 618]);
  });
});

describe('sheet auto-fit row height', () => {
  it('uses actual measured font and wrapping height, including fractional points', () => {
    const cell = { text: '中文换行', width: 70, fontSize: 12.5, wrap: true };
    const heights = studioFitRowHeight([cell], 18, (current) => {
      expect(current).toEqual(cell);
      return 49;
    });
    expect(heights).toBe(39.75);
  });

  it('fits multiline and wrapped Unicode text when browser measurements are unavailable', () => {
    const plain = studioFitRowHeight([{ text: '中文中文中文', width: 40 }]);
    const wrapped = studioFitRowHeight([{ text: '中文中文中文', width: 40, wrap: true }]);
    expect(wrapped).toBeGreaterThan(plain);
    expect(studioFitRowHeight([{ text: 'a\nb\nc', width: 100 }])).toBeGreaterThan(18);
    expect(studioFitRowHeight([{ text: 'a', width: 100, fontSize: 409 }])).toBe(409.5);
    expect(studioFitRowHeight([{ text: '', width: 100, fontSize: 409 }])).toBe(18);
  });
});
