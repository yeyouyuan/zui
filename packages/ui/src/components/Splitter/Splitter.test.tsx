import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Splitter, normalizeSplitterSizes } from './index';

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.zSplitterDragging;
});

const captures = new WeakMap<Element, Set<number>>();
let rootWidth = 1000;
const rootHeight = 500;
const handleTrack = 8;

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    getBoundingClientRect: {
      configurable: true,
      value() {
        const part = (this as HTMLElement).dataset.part;
        const width = part === 'root' ? rootWidth : part === 'handle' ? handleTrack : 100;
        const height = part === 'root' ? rootHeight : part === 'handle' ? handleTrack : 100;
        return {
          width,
          height,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          x: 0,
          y: 0,
          toJSON() {},
        };
      },
    },
    setPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        const set = captures.get(this) ?? new Set<number>();
        set.add(pointerId);
        captures.set(this, set);
      },
    },
    hasPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        return captures.get(this)?.has(pointerId) ?? false;
      },
    },
    releasePointerCapture: {
      configurable: true,
      value(pointerId: number) {
        captures.get(this)?.delete(pointerId);
        dispatchPointerEvent(this as HTMLElement, 'lostpointercapture', { pointerId });
      },
    },
  });
});

const constraints = (count: number) =>
  Array.from({ length: count }, () => ({
    min: 0,
    max: 100,
    collapsible: false,
    collapsedSize: 0,
    collapsed: false,
  }));

function panels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-part="panel"]'));
}

function handles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-part="handle"]'));
}

function root(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-part="root"]')!;
}

function renderTwo(
  props: Partial<React.ComponentProps<typeof Splitter>> = {},
  before: Partial<React.ComponentProps<typeof Splitter.Panel>> = {},
  after: Partial<React.ComponentProps<typeof Splitter.Panel>> = {}
) {
  return render(
    <Splitter aria-label="工作台" defaultSizes={[40, 60]} {...props}>
      <Splitter.Panel key="before" label="目录" {...before}>
        <button type="button">目录按钮</button>
      </Splitter.Panel>
      <Splitter.Panel key="after" label="内容" {...after}>
        <button type="button">内容按钮</button>
      </Splitter.Panel>
    </Splitter>
  );
}

function dispatchPointerEvent(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  init: Record<string, unknown> = {}
) {
  const payload = { pointerId: 7, button: 0, isPrimary: true, clientX: 100, clientY: 100, ...init };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(
    event,
    Object.fromEntries(
      Object.entries(payload).map(([name, value]) => [name, { configurable: true, value }])
    )
  );
  fireEvent(target, event);
}

function pointer(
  type: 'down' | 'move' | 'up' | 'cancel' | 'lost',
  target: HTMLElement,
  init: Record<string, unknown>
) {
  dispatchPointerEvent(target, type === 'lost' ? 'lostpointercapture' : `pointer${type}`, init);
}

describe('normalizeSplitterSizes', () => {
  it('缺省均分并保持总和为 100', () => {
    const values = normalizeSplitterSizes(constraints(3), [null, null, null]);
    expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 4);
    expect(values[0]).toBeCloseTo(33.3333, 3);
  });

  it('按 min/max 夹紧并把剩余空间分配给仍有容量的 Panel', () => {
    const specs = constraints(2);
    specs[0].min = 30;
    specs[0].max = 60;
    expect(normalizeSplitterSizes(specs, [10, 90])).toEqual([30, 70]);
  });

  it('折叠 Panel 钉在 collapsedSize', () => {
    const specs = constraints(3);
    specs[0] = { ...specs[0], collapsible: true, collapsed: true, collapsedSize: 5 };
    expect(normalizeSplitterSizes(specs, [50, null, null])).toEqual([5, 47.5, 47.5]);
  });

  it('不可行约束回退为安全且不溢出的布局', () => {
    const specs = constraints(2);
    specs[0].min = 70;
    specs[1].min = 70;
    const values = normalizeSplitterSizes(specs, [70, 70]);
    expect(values).toEqual([50, 50]);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('无效 collapsedSize 也只生成有限、非负且总和为 100 的安全布局', () => {
    const specs = constraints(2);
    specs[0].collapsed = true;
    specs[0].collapsedSize = 150;
    const values = normalizeSplitterSizes(specs, [150, -50]);
    expect(values.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});

describe('Splitter DOM、API 与 ARIA', () => {
  it('只渲染 Panel，并自动生成 Panel 数量 - 1 个 Handle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Splitter aria-label="布局">
        <Splitter.Panel key="one">一</Splitter.Panel>
        <p>应忽略</p>
        <Splitter.Panel key="two">二</Splitter.Panel>
        <Splitter.Panel key="three">三</Splitter.Panel>
      </Splitter>
    );
    expect(panels()).toHaveLength(3);
    expect(handles()).toHaveLength(2);
    expect(screen.queryByText('应忽略')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('其他节点已忽略'));
    expect('Handle' in Splitter).toBe(false);
    warn.mockRestore();
  });

  it('null 与 boolean 空节点直接忽略且不产生 children 警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Splitter aria-label="布局">
        {null}
        <Splitter.Panel key="one">一</Splitter.Panel>
        {false}
        <Splitter.Panel key="two">二</Splitter.Panel>
      </Splitter>
    );
    expect(panels()).toHaveLength(2);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('其他节点已忽略'));
    warn.mockRestore();
  });

  it('defaultSizes 存在时缺失项均分剩余空间，不回退到 Panel.initialSize', () => {
    render(
      <Splitter aria-label="布局" defaultSizes={[50]}>
        <Splitter.Panel key="one" initialSize={90}>
          一
        </Splitter.Panel>
        <Splitter.Panel key="two" initialSize={10}>
          二
        </Splitter.Panel>
      </Splitter>
    );
    expect(root().style.gridTemplateColumns).toBe('50fr var(--z-splitter-handle-size) 50fr');
  });

  it('Handle 具名并同时控制前后稳定 Panel id', () => {
    renderTwo();
    const handle = handles()[0];
    const [before, after] = panels();
    expect(handle).toHaveAttribute('role', 'separator');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-controls', `${before.id} ${after.id}`);
    expect(handle).toHaveAccessibleName(/目录.*内容/);
    expect(handle).toHaveAttribute('aria-valuenow', '40');
  });

  it('未提供 Panel.label 时仍为多个 Handle 生成简洁且唯一的序号名称', () => {
    render(
      <Splitter aria-label="布局">
        <Splitter.Panel key="one">一</Splitter.Panel>
        <Splitter.Panel key="two">二</Splitter.Panel>
        <Splitter.Panel key="three">三</Splitter.Panel>
      </Splitter>
    );
    const names = handles().map((handle) => handle.getAttribute('aria-label'));
    expect(names[0]).toMatch(/1.*2/);
    expect(names[1]).toMatch(/2.*3/);
    expect(new Set(names).size).toBe(2);
  });

  it('handleProps 得到上下文；labelledby 优先、disabled 为不可聚焦视觉分隔', () => {
    const handleProps = vi.fn(() => ({
      disabled: true,
      'aria-label': '忽略名称',
      'aria-labelledby': 'custom-handle-name',
      'data-owner': 'app',
    }));
    render(
      <>
        <span id="custom-handle-name">自定义分隔条</span>
        <Splitter aria-label="布局" handleProps={handleProps}>
          <Splitter.Panel key="left" id="left-panel" label="左">
            左
          </Splitter.Panel>
          <Splitter.Panel key="right" id="right-panel" label="右">
            右
          </Splitter.Panel>
        </Splitter>
      </>
    );
    expect(handleProps).toHaveBeenCalledWith({
      index: 0,
      beforePanelId: 'left-panel',
      afterPanelId: 'right-panel',
      beforePanelLabel: '左',
      afterPanelLabel: '右',
    });
    expect(handles()[0]).toHaveAccessibleName('自定义分隔条');
    expect(handles()[0]).not.toHaveAttribute('aria-label');
    expect(handles()[0]).toHaveAttribute('aria-disabled', 'true');
    expect(handles()[0]).toHaveAttribute('tabindex', '-1');
    expect(handles()[0]).toHaveAttribute('data-owner', 'app');
  });

  it('Panel 转发原生属性、显式 id、ref 与 slot 类名', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Splitter aria-label="布局">
        <Splitter.Panel
          key="panel"
          ref={ref}
          id="custom-panel"
          title="原生标题"
          className="panel-class"
          classNames={{ root: 'panel-root', content: 'panel-content' }}
        >
          内容
        </Splitter.Panel>
      </Splitter>
    );
    expect(ref.current).toBe(panels()[0]);
    expect(ref.current).toHaveAttribute('id', 'custom-panel');
    expect(ref.current).toHaveAttribute('title', '原生标题');
    expect(ref.current).toHaveClass('panel-class', 'panel-root');
    expect(ref.current?.querySelector('[data-part="content"]')).toHaveClass('panel-content');
  });

  it('固定 Handle 轨道与 Panel fr 共用同一 grid，不把 Handle 叠加到 100% 之外', () => {
    renderTwo();
    expect(root().style.gridTemplateColumns).toBe('40fr var(--z-splitter-handle-size) 60fr');
    expect(panels()[0].style.flexBasis).toBe('');
  });

  it('垂直分栏使用 row 轨道和水平 separator', () => {
    renderTwo({ orientation: 'vertical' });
    expect(root().style.gridTemplateRows).toContain('40fr');
    expect(handles()[0]).toHaveAttribute('aria-orientation', 'horizontal');
  });
});

describe('Pointer 会话', () => {
  it('按 C-H 换算位移，持续请求并在 pointerup 只结束一次', () => {
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    renderTwo({ onSizesChange, onResizeEnd });
    const handle = handles()[0];
    pointer('down', handle, { clientX: 100 });
    pointer('move', handle, { clientX: 199.2 });
    expect(onSizesChange).toHaveBeenLastCalledWith([50, 50], {
      reason: 'pointer',
      handleIndex: 0,
    });
    expect(root()).toHaveAttribute('data-resizing');
    pointer('up', handle, { clientX: 199.2 });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenCalledWith([50, 50], {
      handleIndex: 0,
      input: 'pointer',
      cancelled: false,
      requestedSizes: [50, 50],
    });
    expect(root()).not.toHaveAttribute('data-resizing');
  });

  it('固定相邻总量并在成对 min/max 有效边界卡住', () => {
    const onSizesChange = vi.fn();
    renderTwo(
      { onSizesChange, defaultSizes: [50, 50] },
      { minSize: 30, maxSize: 80 },
      { minSize: 40, maxSize: 90 }
    );
    const handle = handles()[0];
    pointer('down', handle, { clientX: 100 });
    pointer('move', handle, { clientX: 500 });
    expect(onSizesChange).toHaveBeenLastCalledWith([60, 40], {
      reason: 'pointer',
      handleIndex: 0,
    });
  });

  it.each(['cancel', 'lost', 'escape'] as const)(
    '%s 恢复快照并只回调一次 cancelled end',
    (kind) => {
      const onSizesChange = vi.fn();
      const onResizeEnd = vi.fn();
      renderTwo({ onSizesChange, onResizeEnd });
      const handle = handles()[0];
      pointer('down', handle, { clientX: 100 });
      pointer('move', handle, { clientX: 199.2 });
      if (kind === 'cancel') pointer('cancel', handle, {});
      else if (kind === 'lost') pointer('lost', handle, {});
      else fireEvent.keyDown(document, { key: 'Escape' });
      expect(onSizesChange).toHaveBeenLastCalledWith([40, 60], {
        reason: 'pointer',
        handleIndex: 0,
      });
      expect(onResizeEnd).toHaveBeenCalledTimes(1);
      expect(onResizeEnd).toHaveBeenCalledWith([40, 60], {
        handleIndex: 0,
        input: 'pointer',
        cancelled: true,
        requestedSizes: [40, 60],
      });
    }
  );

  it('正常 release 触发 lostcapture 也不会重复结束', () => {
    const onResizeEnd = vi.fn();
    renderTwo({ onResizeEnd });
    const handle = handles()[0];
    pointer('down', handle, {});
    pointer('up', handle, {});
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('拖动时只标记当前 Handle，结束与卸载都会清理全局拖动态', () => {
    const view = renderTwo();
    const handle = handles()[0];
    pointer('down', handle, {});
    expect(handle).toHaveAttribute('data-active', 'true');
    expect(document.documentElement).toHaveAttribute('data-z-splitter-dragging', 'horizontal');
    view.unmount();
    expect(document.documentElement).not.toHaveAttribute('data-z-splitter-dragging');
  });

  it('Pointer Capture 失败时不启动拖动', () => {
    const onSizesChange = vi.fn();
    renderTwo({ onSizesChange });
    const handle = handles()[0];
    vi.spyOn(handle, 'setPointerCapture').mockImplementationOnce(() => {
      throw new Error('capture unavailable');
    });
    pointer('down', handle, {});
    pointer('move', handle, { clientX: 300 });
    expect(onSizesChange).not.toHaveBeenCalled();
  });

  it('setPointerCapture 未实际取得 capture 时不启动拖动', () => {
    const onSizesChange = vi.fn();
    renderTwo({ onSizesChange });
    const handle = handles()[0];
    vi.spyOn(handle, 'setPointerCapture').mockImplementationOnce(() => {});
    pointer('down', handle, {});
    pointer('move', handle, { clientX: 300 });
    expect(onSizesChange).not.toHaveBeenCalled();
    expect(root()).not.toHaveAttribute('data-resizing');
  });

  it('受控父级拒绝更新时 end 区分 actual 与 requested', () => {
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    renderTwo({ sizes: [40, 60], onSizesChange, onResizeEnd });
    const handle = handles()[0];
    pointer('down', handle, { clientX: 100 });
    pointer('move', handle, { clientX: 199.2 });
    pointer('up', handle, { clientX: 199.2 });
    expect(root().style.gridTemplateColumns).toContain('40fr');
    expect(onResizeEnd).toHaveBeenCalledWith([40, 60], {
      handleIndex: 0,
      input: 'pointer',
      cancelled: false,
      requestedSizes: [50, 50],
    });
  });

  it('RTL 水平拖动反转 before Panel 的数值变化', () => {
    const onSizesChange = vi.fn();
    renderTwo({ dir: 'rtl', onSizesChange });
    const handle = handles()[0];
    pointer('down', handle, { clientX: 100 });
    pointer('move', handle, { clientX: 199.2 });
    expect(onSizesChange).toHaveBeenLastCalledWith([30, 70], {
      reason: 'pointer',
      handleIndex: 0,
    });
  });
});

describe('键盘会话', () => {
  it('方向键逐步请求，keyup 确定结束且 key repeat 只属于一次会话', () => {
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    renderTwo({ onSizesChange, onResizeEnd });
    const handle = handles()[0];
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight', repeat: true });
    expect(onSizesChange).toHaveBeenLastCalledWith([42, 58], {
      reason: 'keyboard',
      handleIndex: 0,
    });
    expect(onResizeEnd).not.toHaveBeenCalled();
    fireEvent.keyUp(handle, { key: 'ArrowRight' });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onResizeEnd.mock.calls[0][1]).toEqual({
      handleIndex: 0,
      input: 'keyboard',
      cancelled: false,
      requestedSizes: [42, 58],
    });
  });

  it('PageUp/PageDown 与 Home/End 使用数值方向和成对范围', () => {
    const onSizesChange = vi.fn();
    renderTwo(
      { onSizesChange, defaultSizes: [50, 50] },
      { minSize: 30, maxSize: 80 },
      { minSize: 40, maxSize: 90 }
    );
    const handle = handles()[0];
    fireEvent.keyDown(handle, { key: 'PageUp' });
    expect(onSizesChange).toHaveBeenLastCalledWith([40, 60], expect.anything());
    fireEvent.keyUp(handle, { key: 'PageUp' });
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onSizesChange).toHaveBeenLastCalledWith([60, 40], expect.anything());
    fireEvent.keyUp(handle, { key: 'End' });
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onSizesChange).toHaveBeenLastCalledWith([30, 70], expect.anything());
  });

  it('blur 在没有 keyup 时结束一次，之后 keyup 不重复', () => {
    const onResizeEnd = vi.fn();
    renderTwo({ onResizeEnd });
    const handle = handles()[0];
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.blur(handle);
    fireEvent.keyUp(handle, { key: 'ArrowRight' });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('无关按键的 keyup 不会提前结束键盘调整会话', () => {
    const onResizeEnd = vi.fn();
    renderTwo({ onResizeEnd });
    const handle = handles()[0];
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyUp(handle, { key: 'Shift' });
    expect(onResizeEnd).not.toHaveBeenCalled();
    fireEvent.keyUp(handle, { key: 'ArrowRight' });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('用户事件先执行，preventDefault 可取消内部行为', () => {
    const onSizesChange = vi.fn();
    renderTwo({
      onSizesChange,
      handleProps: () => ({ onKeyDown: (event) => event.preventDefault() }),
    });
    fireEvent.keyDown(handles()[0], { key: 'ArrowRight' });
    expect(onSizesChange).not.toHaveBeenCalled();
  });

  it('RTL 仍按物理方向解释 ArrowRight', () => {
    const onSizesChange = vi.fn();
    renderTwo({ dir: 'rtl', onSizesChange });
    fireEvent.keyDown(handles()[0], { key: 'ArrowRight' });
    expect(onSizesChange).toHaveBeenLastCalledWith([39, 61], expect.anything());
  });
});

describe('折叠、焦点与受控状态', () => {
  it('Enter 仅操作明确 collapseTarget，并按约定顺序回调', () => {
    const order: string[] = [];
    renderTwo(
      {
        handleProps: () => ({ collapseTarget: 'after' }),
        onSizesChange: () => order.push('sizes'),
        onResizeEnd: () => order.push('end'),
      },
      {},
      { collapsible: true, collapsedSize: 5, onCollapsedChange: () => order.push('collapsed') }
    );
    fireEvent.keyDown(handles()[0], { key: 'Enter' });
    expect(order).toEqual(['collapsed', 'sizes', 'end']);
    expect(panels()[1]).toHaveAttribute('data-collapsed', 'true');
    const content = panels()[1].querySelector('[data-part="content"]');
    expect(content).toHaveAttribute('inert');
    expect(content).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: '内容按钮', hidden: true })).toBeInTheDocument();
  });

  it('Enter key repeat 只切换一次', () => {
    const onCollapsedChange = vi.fn();
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    renderTwo(
      { handleProps: () => ({ collapseTarget: 'before' }), onSizesChange, onResizeEnd },
      { collapsible: true, collapsedSize: 5, onCollapsedChange }
    );
    const handle = handles()[0];
    fireEvent.keyDown(handle, { key: 'Enter' });
    fireEvent.keyDown(handle, { key: 'Enter', repeat: true });
    fireEvent.keyDown(handle, { key: 'Enter', repeat: true });

    expect(onCollapsedChange).toHaveBeenCalledTimes(1);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onSizesChange).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(panels()[0]).toHaveAttribute('data-collapsed', 'true');
  });

  it('collapseTarget=none 或不可折叠目标不拦截 Enter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSizesChange = vi.fn();
    renderTwo({ onSizesChange, handleProps: () => ({ collapseTarget: 'before' }) });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    handles()[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onSizesChange).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('指向不可折叠 Panel'));
    warn.mockRestore();
  });

  it('受控 collapsed 被拒绝时只请求，UI 仍服从 props', () => {
    const onCollapsedChange = vi.fn();
    const onResizeEnd = vi.fn();
    renderTwo(
      { handleProps: () => ({ collapseTarget: 'before' }), onResizeEnd },
      { collapsible: true, collapsed: false, collapsedSize: 5, onCollapsedChange }
    );
    fireEvent.keyDown(handles()[0], { key: 'Enter' });
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(panels()[0]).toHaveAttribute('data-collapsed', 'false');
    expect(onResizeEnd.mock.calls[0][0]).toEqual([40, 60]);
  });

  it('受控 collapsed 拒绝后，之后接受同值不会套用旧请求尺寸或重复回调', () => {
    const onCollapsedChange = vi.fn();
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    const view = renderTwo(
      {
        defaultSizes: [40, 60],
        handleProps: () => ({ collapseTarget: 'before' }),
        onSizesChange,
        onResizeEnd,
      },
      { collapsible: true, collapsed: false, collapsedSize: 5, onCollapsedChange }
    );

    fireEvent.keyDown(handles()[0], { key: 'Enter' });
    expect(onSizesChange).toHaveBeenCalledTimes(1);
    expect(onSizesChange).toHaveBeenLastCalledWith([5, 95], {
      reason: 'collapse',
      handleIndex: 0,
    });

    view.rerender(
      <Splitter
        aria-label="工作台"
        defaultSizes={[40, 60]}
        handleProps={() => ({ collapseTarget: 'before' })}
        onSizesChange={onSizesChange}
        onResizeEnd={onResizeEnd}
      >
        <Splitter.Panel
          key="before"
          label="目录"
          collapsible
          collapsed
          collapsedSize={5}
          onCollapsedChange={onCollapsedChange}
        >
          <button type="button">目录按钮</button>
        </Splitter.Panel>
        <Splitter.Panel key="after" label="内容">
          <button type="button">内容按钮</button>
        </Splitter.Panel>
      </Splitter>
    );

    expect(root().style.gridTemplateColumns).toBe('5fr var(--z-splitter-handle-size) 95fr');
    expect(onSizesChange).toHaveBeenCalledTimes(2);
    expect(onSizesChange).toHaveBeenLastCalledWith([5, 95], {
      reason: 'collapse',
      handleIndex: null,
    });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('受控请求被拒绝后，其他 Panel 折叠不会套用旧尺寸或多发事件', () => {
    const onSizesChange = vi.fn();
    const onResizeEnd = vi.fn();
    const onFirstCollapsedChange = vi.fn();
    const view = render(
      <Splitter
        aria-label="布局"
        defaultSizes={[30, 30, 40]}
        handleProps={({ index }) => ({ collapseTarget: index === 0 ? 'before' : 'after' })}
        onSizesChange={onSizesChange}
        onResizeEnd={onResizeEnd}
      >
        <Splitter.Panel
          key="first"
          collapsible
          collapsed={false}
          collapsedSize={5}
          onCollapsedChange={onFirstCollapsedChange}
        >
          一
        </Splitter.Panel>
        <Splitter.Panel key="middle">二</Splitter.Panel>
        <Splitter.Panel key="last" collapsible collapsed={false} collapsedSize={10}>
          三
        </Splitter.Panel>
      </Splitter>
    );

    fireEvent.keyDown(handles()[0], { key: 'Enter' });
    expect(onSizesChange).toHaveBeenCalledTimes(1);
    expect(onSizesChange).toHaveBeenLastCalledWith([5, 55, 40], {
      reason: 'collapse',
      handleIndex: 0,
    });

    view.rerender(
      <Splitter
        aria-label="布局"
        defaultSizes={[30, 30, 40]}
        handleProps={({ index }) => ({ collapseTarget: index === 0 ? 'before' : 'after' })}
        onSizesChange={onSizesChange}
        onResizeEnd={onResizeEnd}
      >
        <Splitter.Panel
          key="first"
          collapsible
          collapsed={false}
          collapsedSize={5}
          onCollapsedChange={onFirstCollapsedChange}
        >
          一
        </Splitter.Panel>
        <Splitter.Panel key="middle">二</Splitter.Panel>
        <Splitter.Panel key="last" collapsible collapsed collapsedSize={10}>
          三
        </Splitter.Panel>
      </Splitter>
    );

    expect(root().style.gridTemplateColumns).toBe(
      '45fr var(--z-splitter-handle-size) 45fr var(--z-splitter-handle-size) 10fr'
    );
    expect(onSizesChange).toHaveBeenCalledTimes(2);
    expect(onSizesChange).toHaveBeenLastCalledWith([45, 45, 10], {
      reason: 'collapse',
      handleIndex: null,
    });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('外部受控折叠时，Panel 内焦点回退到相关 Handle', () => {
    const view = render(
      <Splitter aria-label="布局" handleProps={() => ({ collapseTarget: 'before' })}>
        <Splitter.Panel key="side" label="侧栏" collapsible collapsed={false}>
          <button type="button">内部按钮</button>
        </Splitter.Panel>
        <Splitter.Panel key="main" label="主区">
          主区
        </Splitter.Panel>
      </Splitter>
    );
    screen.getByRole('button', { name: '内部按钮' }).focus();
    view.rerender(
      <Splitter aria-label="布局" handleProps={() => ({ collapseTarget: 'before' })}>
        <Splitter.Panel key="side" label="侧栏" collapsible collapsed>
          <button type="button">内部按钮</button>
        </Splitter.Panel>
        <Splitter.Panel key="main" label="主区">
          主区
        </Splitter.Panel>
      </Splitter>
    );
    expect(handles()[0]).toHaveFocus();
  });

  it('defaultCollapsed 展开恢复初始未折叠尺寸', () => {
    renderTwo(
      { defaultSizes: [25, 75], handleProps: () => ({ collapseTarget: 'before' }) },
      { collapsible: true, collapsedSize: 5, defaultCollapsed: true }
    );
    expect(root().style.gridTemplateColumns).toContain('5fr');
    fireEvent.keyDown(handles()[0], { key: 'Enter' });
    expect(root().style.gridTemplateColumns).toContain('25fr');
  });
});

describe('动态模型、警告与 SSR', () => {
  it('受控 sizes 无效时忽略输入并保留最后有效布局', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = render(
      <Splitter aria-label="布局" sizes={[40, 60]}>
        <Splitter.Panel key="left">左</Splitter.Panel>
        <Splitter.Panel key="right">右</Splitter.Panel>
      </Splitter>
    );
    view.rerender(
      <Splitter aria-label="布局" sizes={[80]}>
        <Splitter.Panel key="left">左</Splitter.Panel>
        <Splitter.Panel key="right">右</Splitter.Panel>
      </Splitter>
    );
    expect(root().style.gridTemplateColumns).toContain('40fr');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('本次输入已忽略'));
    warn.mockRestore();
  });

  it('按 key 保留尺寸并在重排时回调 panels-change', () => {
    const onSizesChange = vi.fn();
    const view = render(
      <Splitter aria-label="布局" defaultSizes={[30, 70]} onSizesChange={onSizesChange}>
        <Splitter.Panel key="left">左</Splitter.Panel>
        <Splitter.Panel key="right">右</Splitter.Panel>
      </Splitter>
    );
    view.rerender(
      <Splitter aria-label="布局" onSizesChange={onSizesChange}>
        <Splitter.Panel key="right">右</Splitter.Panel>
        <Splitter.Panel key="left">左</Splitter.Panel>
      </Splitter>
    );
    expect(onSizesChange).toHaveBeenLastCalledWith([70, 30], {
      reason: 'panels-change',
      handleIndex: null,
    });
  });

  it('无 key Panel 给出开发警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Splitter aria-label="布局">
        <Splitter.Panel>一</Splitter.Panel>
        <Splitter.Panel>二</Splitter.Panel>
      </Splitter>
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('稳定 React key'));
    warn.mockRestore();
  });

  it('A=0 时暂停 Pointer 换算', () => {
    const onSizesChange = vi.fn();
    rootWidth = handleTrack;
    renderTwo({ onSizesChange });
    pointer('down', handles()[0], {});
    pointer('move', handles()[0], { clientX: 300 });
    expect(onSizesChange).not.toHaveBeenCalled();
    rootWidth = 1000;
  });

  it('SSR 输出稳定 grid、Panel 与 separator 关系', async () => {
    const { renderToString } = await import('react-dom/server');
    const html = renderToString(
      <Splitter aria-label="布局" defaultSizes={[40, 60]}>
        <Splitter.Panel key="left" label="左">
          左
        </Splitter.Panel>
        <Splitter.Panel key="right" label="右">
          右
        </Splitter.Panel>
      </Splitter>
    );
    expect(html).toContain('grid-template-columns:40fr var(--z-splitter-handle-size) 60fr');
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-controls=');
  });
});
