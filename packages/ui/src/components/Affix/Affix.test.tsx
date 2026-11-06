import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Affix } from './index';

afterEach(cleanup);

// jsdom getBoundingClientRect 恒为 0，注入可变 mock 控制 top/bottom
let rect = { top: 0, bottom: 0, left: 0, width: 200 };
beforeEach(() => {
  rect = { top: 0, bottom: 0, left: 0, width: 200 };
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => rect as DOMRect
  );
});

async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function scroll(target: HTMLElement) {
  return act(async () => {
    target.dispatchEvent(new Event('scroll'));
    await flushRaf();
  });
}

function makeScroller() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function getContent() {
  return document.querySelector('[data-part="content"]') as HTMLElement;
}

describe('Affix 固定切换', () => {
  it('未达阈值时不固定，data-affixed=false', async () => {
    const scroller = makeScroller();
    rect.top = 300;
    render(
      <Affix target={() => scroller} offsetTop={10}>
        <nav>导航</nav>
      </Affix>
    );
    await flushRaf();
    const root = screen.getByText('导航').closest('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-affixed', 'false');
    expect(getContent().style.position).not.toBe('fixed');
    scroller.remove();
  });

  it('滚动到阈值内固定：position fixed + top 偏移 + onChange(true)', async () => {
    const scroller = makeScroller();
    const onChange = vi.fn();
    rect.top = 300;
    render(
      <Affix target={() => scroller} offsetTop={10} onChange={onChange}>
        <nav>导航</nav>
      </Affix>
    );
    await flushRaf();
    rect.top = 5;
    rect.width = 200;
    rect.left = 30;
    await scroll(scroller);
    expect(onChange).toHaveBeenCalledWith(true);
    const root = screen.getByText('导航').closest('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-affixed', 'true');
    const content = getContent();
    expect(content.style.position).toBe('fixed');
    expect(content.style.top).toBe('10px');
    expect(content.style.width).toBe('200px');
    scroller.remove();
  });

  it('offsetBottom 模式：rect.bottom 低于视口阈值时固定在底部', async () => {
    const scroller = makeScroller();
    const onChange = vi.fn();
    // clientHeight 0，bottomLimit = 0 - 20 = -20；bottom <= -20 才固定
    rect.bottom = 100;
    render(
      <Affix target={() => scroller} offsetBottom={20} onChange={onChange}>
        <nav>工具条</nav>
      </Affix>
    );
    await flushRaf();
    expect(onChange).not.toHaveBeenCalledWith(true);
    rect.bottom = -50;
    await scroll(scroller);
    expect(onChange).toHaveBeenCalledWith(true);
    const content = getContent();
    expect(content.style.position).toBe('fixed');
    expect(content.style.bottom).toBe('20px');
    scroller.remove();
  });

  it('离开阈值时解除固定并 onChange(false)', async () => {
    const scroller = makeScroller();
    const onChange = vi.fn();
    rect.top = 5;
    render(
      <Affix target={() => scroller} offsetTop={10} onChange={onChange}>
        <nav>导航</nav>
      </Affix>
    );
    await flushRaf();
    expect(onChange).toHaveBeenCalledWith(true);
    rect.top = 500;
    await scroll(scroller);
    expect(onChange).toHaveBeenCalledWith(false);
    const root = screen.getByText('导航').closest('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-affixed', 'false');
    scroller.remove();
  });
});

describe('Affix 定制与透传', () => {
  it('classNames / className 透传 root 与 content', () => {
    render(
      <Affix className="page-affix" classNames={{ root: 'my-root', content: 'my-content' }}>
        <nav>导航</nav>
      </Affix>
    );
    const root = screen.getByText('导航').closest('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-affix', 'my-root', 'page-affix');
    expect(getContent()).toHaveClass('z-affix-content', 'my-content');
  });

  it('children 原样渲染', () => {
    render(
      <Affix>
        <button type="button">操作</button>
      </Affix>
    );
    expect(screen.getByRole('button', { name: '操作' })).toBeInTheDocument();
  });

  it('默认 target 为 window，不报错', async () => {
    render(
      <Affix offsetTop={0}>
        <nav>窗口导航</nav>
      </Affix>
    );
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await flushRaf();
    });
    expect(screen.getByText('窗口导航')).toBeInTheDocument();
  });

  it('resize 也触发重新计算', async () => {
    const onChange = vi.fn();
    rect.top = 5;
    render(
      <Affix offsetTop={10} onChange={onChange}>
        <nav>导航</nav>
      </Affix>
    );
    await flushRaf();
    expect(onChange).toHaveBeenCalledWith(true);
    rect.top = 900;
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await flushRaf();
    });
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
