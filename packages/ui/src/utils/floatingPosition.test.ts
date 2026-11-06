import { describe, expect, it } from 'vitest';
import { floatingPosition } from './floatingPosition';

const viewport = { width: 375, height: 667 };
const anchor = { left: 280, right: 360, top: 600, bottom: 632, width: 80, height: 32 };

describe('floatingPosition', () => {
  it('flips above a bottom-edge trigger and keeps the panel inside the right edge', () => {
    expect(floatingPosition(anchor, { width: 280, height: 300 }, viewport))
      .toEqual({ top: 296, left: 87, side: 'top' });
  });
  it('preserves requested alignment when there is enough space', () => {
    expect(floatingPosition({ ...anchor, top: 100, bottom: 132, left: 80, right: 160 },
      { width: 120, height: 100 }, viewport, { align: 'center', offset: 8 }))
      .toEqual({ top: 140, left: 60, side: 'bottom' });
  });
  it('flips a left popup to the right and clamps oversized content', () => {
    expect(floatingPosition({ ...anchor, left: 0, right: 80, top: 0, bottom: 32 },
      { width: 200, height: 800 }, viewport, { side: 'left', align: 'center' }))
      .toEqual({ top: 8, left: 84, side: 'right' });
  });
});
