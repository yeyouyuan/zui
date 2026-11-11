import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tour } from './index';
import type { TourProps, TourStep } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// jsdom 无布局：让 useFocusTrap 能识别卡片内按钮为可聚焦元素。
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

const steps: TourStep[] = [
  { title: '第一步', description: '介绍一', target: '#tour-target' },
  { title: '第二步', target: '#tour-target', placement: 'top' },
  { title: '第三步', target: () => document.getElementById('tour-target') },
];

function renderTour(props: Partial<TourProps> = {}) {
  return render(
    <>
      <div id="tour-target">目标</div>
      <Tour steps={steps} {...props} />
    </>
  );
}

describe('Tour 渲染', () => {
  it('浮层就绪后获取焦点，关闭恢复到打开前的控件', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    renderTour({ defaultOpen: true });
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toHaveFocus());
    await userEvent.setup().keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('dialog 标记 aria-modal，Tab 在卡片操作间循环', async () => {
    const user = userEvent.setup();
    renderTour({ defaultOpen: true });
    const dialog = screen.getByRole('dialog');
    const prev = screen.getByRole('button', { name: '上一步' });
    const next = screen.getByRole('button', { name: '下一步' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(next).toHaveFocus());
    await user.tab();
    expect(next).toHaveFocus();
    await user.tab({ shift: true });
    expect(next).toHaveFocus();
    expect(prev).not.toHaveFocus();
  });

  it('跟随嵌套容器滚动并将卡片约束在视口内', async () => {
    let top = 500;
    const target = document.createElement('div');
    target.getBoundingClientRect = () => ({ top, left: 1000, right: 1040, bottom: top + 40, width: 40, height: 40, x: 1000, y: top, toJSON: () => ({}) });
    document.body.appendChild(target);
    render(<Tour defaultOpen steps={[{ title: '边缘', target: () => target }]} />);
    const mask = document.querySelector<HTMLElement>('[data-part="mask"]')!;
    const card = screen.getByRole('dialog');
    expect(mask.style.top).toBe('500px');
    top = 100;
    fireEvent.scroll(target);
    await waitFor(() => expect(mask.style.top).toBe('100px'));
    expect(parseFloat(card.style.left)).toBeLessThan(window.innerWidth);
    expect(parseFloat(card.style.top)).toBeGreaterThanOrEqual(8);
    target.remove();
  });

  it('scroll/resize 在一帧内合并测量，内联 steps 重渲染不重绑监听', () => {
    let frame: FrameRequestCallback | undefined;
    const requestSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frame = callback;
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const target = document.createElement('div');
    const rectSpy = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 40,
      left: 20,
      right: 60,
      bottom: 80,
      width: 40,
      height: 40,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect);
    target.id = 'inline-tour-target';
    document.body.appendChild(target);

    function InlineStepsHarness() {
      const [, rerender] = React.useReducer((value) => value + 1, 0);
      return (
        <>
          <button type="button" onClick={rerender}>重渲染</button>
          <Tour defaultOpen steps={[{ title: '内联步骤', target: '#inline-tour-target' }]} />
        </>
      );
    }

    render(<InlineStepsHarness />);
    const scrollAddsBefore = addSpy.mock.calls.filter(([type]) => type === 'scroll').length;
    const scrollRemovesBefore = removeSpy.mock.calls.filter(([type]) => type === 'scroll').length;
    fireEvent.click(screen.getByRole('button', { name: '重渲染' }));
    expect(addSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(scrollAddsBefore);
    expect(removeSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(scrollRemovesBefore);

    const beforeEvents = rectSpy.mock.calls.length;
    const beforeFrames = requestSpy.mock.calls.length;
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(requestSpy).toHaveBeenCalledTimes(beforeFrames + 1);
    expect(rectSpy).toHaveBeenCalledTimes(beforeEvents);

    act(() => frame?.(16));
    expect(rectSpy).toHaveBeenCalledTimes(beforeEvents + 1);
    target.remove();
  });

  it('默认关闭时渲染为空', () => {
    renderTour();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('defaultOpen 展示第一步标题与描述', () => {
    renderTour({ defaultOpen: true });
    const dialog = screen.getByRole('dialog', { name: '第一步' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('介绍一')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('遮罩挖洞元素存在（box-shadow 技巧）', () => {
    renderTour({ defaultOpen: true });
    const mask = document.querySelector('[data-part="mask"]');
    expect(mask).toBeInTheDocument();
    expect(mask).toHaveClass('z-tour-mask');
    expect(mask).toHaveAttribute('aria-hidden', 'true');
    // 目标存在时用挖洞遮罩而非全屏遮罩
    expect(mask).not.toHaveClass('z-tour-mask--full');
  });

  it('目标缺失时退化为全屏遮罩', () => {
    render(
      <Tour
        steps={[{ title: '孤立步骤', target: '#not-exist' }]}
        defaultOpen
      />
    );
    expect(document.querySelector('[data-part="mask"]')).toHaveClass('z-tour-mask--full');
    expect(screen.getByRole('dialog', { name: '孤立步骤' })).toBeInTheDocument();
  });

  it('target 支持取元素函数', () => {
    renderTour({ defaultOpen: true, current: 2 });
    expect(screen.getByRole('dialog', { name: '第三步' })).toBeInTheDocument();
    expect(document.querySelector('[data-part="mask"]')).not.toHaveClass('z-tour-mask--full');
  });

  it('placement 记录在卡片 data-placement 上', () => {
    renderTour({ defaultOpen: true, current: 1 });
    expect(screen.getByRole('dialog', { name: '第二步' })).toHaveAttribute('data-placement', 'top');
  });

  it('steps 为空渲染为空', () => {
    render(<Tour steps={[]} defaultOpen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Tour 步骤切换', () => {
  it('下一步前进一步并触发 onCurrentChange', async () => {
    const user = userEvent.setup();
    const onCurrentChange = vi.fn();
    renderTour({ defaultOpen: true, onCurrentChange });
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(onCurrentChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole('dialog', { name: '第二步' })).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('上一步在首步禁用，可回退', async () => {
    const user = userEvent.setup();
    renderTour({ defaultOpen: true });
    expect(screen.getByRole('button', { name: '上一步' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '下一步' }));
    const prev = screen.getByRole('button', { name: '上一步' });
    expect(prev).toBeEnabled();
    await user.click(prev);
    expect(screen.getByRole('dialog', { name: '第一步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一步' })).toBeDisabled();
  });

  it('末步显示完成，点击关闭并触发 onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderTour({ defaultOpen: true, current: 2, onOpenChange });
    expect(screen.getByRole('button', { name: '完成' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下一步' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '完成' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc 关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderTour({ defaultOpen: true, onOpenChange });
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Tour 受控', () => {
  it('受控 open：关闭请求上抛，父组件不更新则不关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = renderTour({ open: true, current: 2, onOpenChange });
    await user.click(screen.getByRole('button', { name: '完成' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // 受控：仍展示
    expect(screen.getByRole('dialog', { name: '第三步' })).toBeInTheDocument();

    rerender(
      <>
        <div id="tour-target">目标</div>
        <Tour steps={steps} open={false} current={2} onOpenChange={onOpenChange} />
      </>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('受控 current：切换请求上抛，展示跟随 current', async () => {
    const user = userEvent.setup();
    const onCurrentChange = vi.fn();
    const { rerender } = renderTour({ open: true, current: 0, onCurrentChange });
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(onCurrentChange).toHaveBeenCalledWith(1);
    // 受控：仍停在第一步
    expect(screen.getByRole('dialog', { name: '第一步' })).toBeInTheDocument();

    rerender(
      <>
        <div id="tour-target">目标</div>
        <Tour steps={steps} open current={1} onCurrentChange={onCurrentChange} />
      </>
    );
    expect(screen.getByRole('dialog', { name: '第二步' })).toBeInTheDocument();
  });
});

describe('Tour 定制出口', () => {
  it('classNames 追加到对应 part', () => {
    renderTour({
      defaultOpen: true,
      classNames: { root: 'r', mask: 'm', card: 'c', title: 'ti', description: 'd', footer: 'f' },
    });
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-tour', 'r');
    expect(document.querySelector('[data-part="mask"]')).toHaveClass('z-tour-mask', 'm');
    expect(document.querySelector('[data-part="card"]')).toHaveClass('z-tour-card', 'c');
    expect(document.querySelector('[data-part="title"]')).toHaveClass('z-tour-title', 'ti');
    expect(document.querySelector('[data-part="description"]')).toHaveClass('z-tour-description', 'd');
    expect(document.querySelector('[data-part="footer"]')).toHaveClass('z-tour-footer', 'f');
  });
});
