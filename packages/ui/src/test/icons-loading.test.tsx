import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { Loading } from '@zui/icons';

const originalAnimate = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'animate');
let reducedMotion = false;
let listeners: Set<() => void>;
let cancellations: ReturnType<typeof vi.fn>[];
let animate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reducedMotion = false;
  listeners = new Set();
  cancellations = [];
  animate = vi.fn(() => {
    const cancel = vi.fn();
    cancellations.push(cancel);
    return { cancel };
  });
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: animate });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return reducedMotion;
      },
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(SVGElement.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(SVGElement.prototype, 'animate');
});

function setReducedMotion(matches: boolean) {
  act(() => {
    reducedMotion = matches;
    listeners.forEach((listener) => listener());
  });
}

describe('Loading 动画与系统动态效果设置', () => {
  it('系统设置改变时停止和恢复旋转，卸载后清理动画与监听', () => {
    const { unmount } = render(<Loading />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);

    setReducedMotion(true);
    expect(cancellations[0]).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(1);

    setReducedMotion(false);
    expect(animate).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancellations[1]).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('初始减少动态效果时保持静态，关闭 spin 后取消动画', () => {
    reducedMotion = true;
    const { rerender } = render(<Loading />);
    expect(animate).not.toHaveBeenCalled();
    setReducedMotion(false);
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(<Loading spin={false} />);
    expect(cancellations[0]).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    setReducedMotion(false);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('不支持动画 API 时仍能渲染并透传原生 SVG ref', () => {
    Reflect.deleteProperty(SVGElement.prototype, 'animate');
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<Loading ref={ref} aria-label="加载中" />);
    expect(ref.current).toBe(container.querySelector('svg'));
    expect(ref.current).toHaveAttribute('aria-label', '加载中');
    expect(container.querySelector('path')).toBeInTheDocument();
  });
});
