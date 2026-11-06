import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackTop } from './index';

afterEach(cleanup);

/** 构造一个可滚动容器（jsdom 中 HTMLElement.scrollTop 可写） */
function makeScroller() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  el.scrollTo = vi.fn();
  return el;
}

async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe('BackTop 渲染与可见性', () => {
  it('默认渲染 button，滚动未超阈值时隐藏（aria-hidden + tabIndex -1）', async () => {
    const scroller = makeScroller();
    render(<BackTop target={() => scroller} />);
    const root = screen.getByRole('button', { hidden: true });
    expect(root).toHaveClass('z-back-top');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-visible', 'false');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('tabindex', '-1');
    await flushRaf();
    scroller.remove();
  });

  it('滚动超过 visibilityHeight 后显示并可聚焦', async () => {
    const scroller = makeScroller();
    render(<BackTop target={() => scroller} visibilityHeight={400} />);
    scroller.scrollTop = 500;
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    const root = screen.getByRole('button');
    expect(root).toHaveAttribute('data-visible', 'true');
    expect(root).toHaveAttribute('tabindex', '0');
    expect(root).not.toHaveAttribute('aria-hidden');
    scroller.remove();
  });

  it('滚回阈值以下重新隐藏', async () => {
    const scroller = makeScroller();
    render(<BackTop target={() => scroller} visibilityHeight={100} />);
    scroller.scrollTop = 300;
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByRole('button')).toHaveAttribute('data-visible', 'true');
    scroller.scrollTop = 10;
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByRole('button', { hidden: true })).toHaveAttribute('data-visible', 'false');
    scroller.remove();
  });
});

describe('BackTop 交互', () => {
  it('点击滚动到顶部并触发 onClick', async () => {
    const user = userEvent.setup();
    const scroller = makeScroller();
    const onClick = vi.fn();
    render(<BackTop target={() => scroller} visibilityHeight={0} onClick={onClick} />);
    scroller.scrollTop = 800;
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scroller.remove();
  });

  it('自定义 children 替代默认图标', () => {
    render(<BackTop visibilityHeight={0}>TOP</BackTop>);
    expect(screen.getByRole('button', { hidden: true })).toHaveTextContent('TOP');
  });

  it('aria-label 默认"返回顶部"，可覆盖', () => {
    render(<BackTop visibilityHeight={0} />);
    render(<BackTop visibilityHeight={0} aria-label="back to top" />);
    const buttons = screen.getAllByRole('button', { hidden: true });
    expect(buttons[0]).toHaveAttribute('aria-label', '返回顶部');
    expect(buttons[1]).toHaveAttribute('aria-label', 'back to top');
  });
});

describe('BackTop 定制', () => {
  it('classNames / className 透传', () => {
    render(<BackTop visibilityHeight={0} className="page-top" classNames={{ root: 'my-root' }} />);
    const root = screen.getByRole('button', { hidden: true });
    expect(root).toHaveClass('z-back-top', 'my-root', 'page-top');
    expect(root.getAttribute('data-part')).toBe('root');
  });

  it('默认 target 为 window，点击回顶走 window.scrollTo', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    const original = window.scrollTo;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    try {
      render(<BackTop visibilityHeight={0} />);
      await user.click(screen.getByRole('button', { hidden: true }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    } finally {
      window.scrollTo = original;
    }
  });
});
