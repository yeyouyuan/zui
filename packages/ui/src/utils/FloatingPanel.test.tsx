import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FloatingPanel } from './FloatingPanel';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Example() {
  const anchor = React.useRef<HTMLButtonElement>(null);
  return <section style={{ position: 'relative', zIndex: 400 }}>
    <button ref={anchor}>触发</button>
    <FloatingPanel open anchorRef={anchor} matchWidth>
      <div role="listbox" style={{ zIndex: 200 }}>内容</div>
    </FloatingPanel>
  </section>;
}

describe('FloatingPanel', () => {
  it('avoids clipping, flips at viewport edge and rises above its source overlay', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.tagName === 'BUTTON') return { top: 600, left: 290, bottom: 632, right: 350, width: 60, height: 32 } as DOMRect;
      if (this.getAttribute('role') === 'listbox') return { top: 0, left: 0, bottom: 180, right: 60, width: 60, height: 180 } as DOMRect;
      return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 } as DOMRect;
    });
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('innerHeight', 667);
    const { container } = render(<Example />);
    const panel = screen.getByRole('listbox');
    expect(panel.parentElement?.parentElement).toBe(document.body);
    expect(container.contains(panel)).toBe(false);
    expect(panel).toHaveAttribute('data-floating-side', 'top');
    expect(panel.style.top).toBe('416px');
    expect(panel.style.left).toBe('290px');
    expect(panel.style.width).toBe('60px');
    expect(panel.style.zIndex).toBe('401');
    fireEvent.scroll(screen.getByRole('button'));
    expect(panel.style.top).toBe('416px');
    vi.unstubAllGlobals();
  });

  it('places a nested panel above the dialog layer and restores local tokens', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 80, left: 20, bottom: 112, right: 120, width: 100, height: 32,
    } as DOMRect);
    const anchor = React.createRef<HTMLButtonElement>();
    render(<div style={{ position: 'fixed', zIndex: 400 }}>
      <div>
        <button ref={anchor} style={{ '--z-select-listbox-bg': 'rgb(1, 2, 3)' } as React.CSSProperties}>触发</button>
        <FloatingPanel open anchorRef={anchor}>
          <div role="listbox" style={{ zIndex: 200 }}>选项</div>
        </FloatingPanel>
      </div>
    </div>);
    const panel = screen.getByRole('listbox');
    expect(panel.style.zIndex).toBe('401');
    expect(panel.parentElement?.style.getPropertyValue('--z-select-listbox-bg')).toBe('rgb(1, 2, 3)');
  });
});
