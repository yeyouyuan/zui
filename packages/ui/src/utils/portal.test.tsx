import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Portal } from './portal';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Portal theme inheritance', () => {
  it('keeps local tokens and follows changes to the source theme', async () => {
    const { rerender } = render(<section data-theme="light"><Portal><button>浮层</button></Portal></section>);
    const source = document.querySelector<HTMLElement>('[data-zui-portal-source]')!;
    const nativeStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element !== source) return nativeStyle(element);
      const style = document.createElement('div').style;
      style.setProperty('--z-color-bg', source.parentElement?.dataset.theme === 'dark' ? 'black' : 'white');
      style.setProperty('--z-popover-padding', '12px');
      return style;
    });
    rerender(<section data-theme="dark"><Portal><button>浮层</button></Portal></section>);
    const host = screen.getByRole('button', { name: '浮层' }).parentElement!;
    await waitFor(() => expect(host.style.getPropertyValue('--z-color-bg')).toBe('black'));
    expect(host.style.getPropertyValue('--z-popover-padding')).toBe('12px');
    expect(host.parentElement).toBe(document.body);
    rerender(<section data-theme="light"><Portal><button>浮层</button></Portal></section>);
    await waitFor(() => expect(host.style.getPropertyValue('--z-color-bg')).toBe('white'));
  });

  it('inherits component variables from an explicit source and preserves a custom container', () => {
    const container = document.createElement('div');
    document.body.append(container);
    function Example() {
      const source = React.useRef<HTMLDivElement>(null);
      return <><div ref={source} style={{ '--z-image-preview-bg': 'red' } as React.CSSProperties} />
        <Portal container={container} inheritFrom={source}><span>预览</span></Portal></>;
    }
    const { unmount } = render(<Example />);
    const host = screen.getByText('预览').parentElement!;
    expect(host.style.getPropertyValue('--z-image-preview-bg')).toBe('red');
    expect(host.parentElement).toBe(container);
    unmount();
    expect(container).toBeEmptyDOMElement();
    container.remove();
  });
});
