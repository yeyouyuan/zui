type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';
interface AnchorRect { top: number; left: number; right: number; bottom: number; width: number; height: number }

/** 将浮层限制在视口内；首选方向空间不足时，优先放到空间更大的一侧。 */
export function floatingPosition(
  anchor: AnchorRect,
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
  { side = 'bottom', align = 'start', offset = 4, margin = 8 }: { side?: Side; align?: Align; offset?: number; margin?: number } = {}
): { top: number; left: number; side: Side } {
  const room = {
    top: anchor.top - margin - offset,
    bottom: viewport.height - anchor.bottom - margin - offset,
    left: anchor.left - margin - offset,
    right: viewport.width - anchor.right - margin - offset,
  };
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
  const vertical = side === 'top' || side === 'bottom';
  const needed = vertical ? popup.height : popup.width;
  const actual = room[side] < needed && room[opposite[side]] > room[side] ? opposite[side] : side;
  let top = anchor.top;
  let left = anchor.left;
  if (vertical) {
    top = actual === 'top' ? anchor.top - popup.height - offset : anchor.bottom + offset;
    if (align === 'center') left += (anchor.width - popup.width) / 2;
    else if (align === 'end') left = anchor.right - popup.width;
  } else {
    left = actual === 'left' ? anchor.left - popup.width - offset : anchor.right + offset;
    if (align === 'center') top += (anchor.height - popup.height) / 2;
    else if (align === 'end') top = anchor.bottom - popup.height;
  }
  return {
    top: Math.max(margin, Math.min(top, viewport.height - popup.height - margin)),
    left: Math.max(margin, Math.min(left, viewport.width - popup.width - margin)),
    side: actual,
  };
}
