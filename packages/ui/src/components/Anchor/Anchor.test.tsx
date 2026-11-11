import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Anchor } from './index';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// jsdom 无 scrollIntoView，注入 mock 供「点击平滑滚动」断言
const scrollIntoViewMock = vi.fn();
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoViewMock,
  });
});

/** mock getBoundingClientRect 的 top（激活判定与点击滚动都依赖它） */
function setTop(el: HTMLElement, top: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

function makeSection(id: string, top: number): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  setTop(el, top);
  document.body.appendChild(el);
  return el;
}

async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

async function fireScroll(el: HTMLElement | Window = window) {
  await act(async () => {
    el.dispatchEvent(new Event('scroll'));
  });
  await flushRaf();
}

describe('Anchor 渲染与语义', () => {
  it('渲染 nav + ul + 原生锚点链接，aria-label 来自 locale', () => {
    render(
      <Anchor>
        <Anchor.Link href="#intro" title="组件介绍" />
        <Anchor.Link href="#usage" title="使用方式" />
      </Anchor>
    );
    const nav = screen.getByRole('navigation', { name: '锚点导航' });
    expect(nav).toHaveClass('z-anchor');
    expect(nav).toHaveAttribute('data-part', 'root');
    expect(nav.querySelector('ul')).toHaveAttribute('data-part', 'list');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '#intro');
    expect(links[0]).toHaveAttribute('data-part', 'link');
    expect(links[0]).toHaveTextContent('组件介绍');
    // 无节元素时不存在激活项
    expect(links[0]).not.toHaveAttribute('aria-current');
  });

  it('初始测量：所有节高于阈值时取第一节为 active（aria-current="true"）', () => {
    makeSection('s1', 200);
    makeSection('s2', 400);
    render(
      <Anchor>
        <Anchor.Link href="#s1" title="第一节" />
        <Anchor.Link href="#s2" title="第二节" />
      </Anchor>
    );
    const first = screen.getByRole('link', { name: '第一节' });
    const second = screen.getByRole('link', { name: '第二节' });
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(first).toHaveAttribute('data-active', 'true');
    expect(second).not.toHaveAttribute('aria-current');
    expect(second).toHaveAttribute('data-active', 'false');
  });

  it('Anchor.Link 必须在 Anchor 内部使用', () => {
    expect(() => render(<Anchor.Link href="#x" title="孤儿链接" />)).toThrow(/Anchor/);
  });
});

describe('Anchor 滚动侦测', () => {
  it('rAF 侦测切换：取 top ≤ offsetTop+8 的最后一节，全部高于阈值回退第一节', async () => {
    const s1 = makeSection('d1', 100);
    const s2 = makeSection('d2', 300);
    const s3 = makeSection('d3', 600);
    render(
      <Anchor>
        <Anchor.Link href="#d1" title="一" />
        <Anchor.Link href="#d2" title="二" />
        <Anchor.Link href="#d3" title="三" />
      </Anchor>
    );
    expect(screen.getByRole('link', { name: '一' })).toHaveAttribute('aria-current', 'true');
    // 滚到第二节：s2.top=5 ≤ 8，s3 仍高于阈值 → 取最后一节 s2
    setTop(s2, 5);
    setTop(s3, 400);
    await fireScroll();
    expect(screen.getByRole('link', { name: '二' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: '一' })).not.toHaveAttribute('aria-current');
    // 滚到第三节：s3.top=2 ≤ 8 且是最后一节
    setTop(s2, 50);
    setTop(s3, 2);
    await fireScroll();
    expect(screen.getByRole('link', { name: '三' })).toHaveAttribute('aria-current', 'true');
    // 全部高于阈值 → 回退第一节
    setTop(s1, 200);
    setTop(s3, 500);
    await fireScroll();
    expect(screen.getByRole('link', { name: '一' })).toHaveAttribute('aria-current', 'true');
  });

  it('offsetTop 提高判定阈值', async () => {
    makeSection('o1', 105);
    const s2 = makeSection('o2', 400);
    render(
      <Anchor offsetTop={100}>
        <Anchor.Link href="#o1" title="甲" />
        <Anchor.Link href="#o2" title="乙" />
      </Anchor>
    );
    // 阈值 108：s1.top=105 ≤ 108 → 初始即激活
    expect(screen.getByRole('link', { name: '甲' })).toHaveAttribute('aria-current', 'true');
    // s1 高于阈值、s2 进入阈值 → 切到 s2
    setTop(s2, 4);
    await fireScroll();
    expect(screen.getByRole('link', { name: '乙' })).toHaveAttribute('aria-current', 'true');
    // 都高于阈值 → 回退第一节
    setTop(s2, 300);
    await fireScroll();
    expect(screen.getByRole('link', { name: '甲' })).toHaveAttribute('aria-current', 'true');
  });

  it('resize 触发重新测量', async () => {
    makeSection('r1', 200);
    makeSection('r2', 300);
    render(
      <Anchor>
        <Anchor.Link href="#r1" title="壹" />
        <Anchor.Link href="#r2" title="贰" />
      </Anchor>
    );
    expect(screen.getByRole('link', { name: '壹' })).toHaveAttribute('aria-current', 'true');
    document.getElementById('r2')!.getBoundingClientRect = () => ({ top: 6 }) as DOMRect;
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    await flushRaf();
    expect(screen.getByRole('link', { name: '贰' })).toHaveAttribute('aria-current', 'true');
  });

  it('target 容器：滚动事件监听容器而非 window', async () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const s1 = makeSection('c1', 100);
    scroller.appendChild(s1);
    const s2 = makeSection('c2', 300);
    scroller.appendChild(s2);
    render(
      <Anchor target={() => scroller}>
        <Anchor.Link href="#c1" title="容器一" />
        <Anchor.Link href="#c2" title="容器二" />
      </Anchor>
    );
    expect(screen.getByRole('link', { name: '容器一' })).toHaveAttribute('aria-current', 'true');
    setTop(s2, 3);
    await fireScroll(scroller);
    expect(screen.getByRole('link', { name: '容器二' })).toHaveAttribute('aria-current', 'true');
  });

  it('target 容器位于窗口中部时按容器顶部、边框和 offsetTop 判定章节', async () => {
    const scroller = document.createElement('div');
    setTop(scroller, 300);
    Object.defineProperty(scroller, 'clientTop', { value: 2 });
    document.body.appendChild(scroller);
    scroller.appendChild(makeSection('relative-first', 200));
    const second = makeSection('relative-second', 600);
    scroller.appendChild(second);
    render(
      <Anchor offsetTop={20} target={() => scroller}>
        <Anchor.Link href="#relative-first" title="容器第一节" />
        <Anchor.Link href="#relative-second" title="容器第二节" />
      </Anchor>
    );
    setTop(second, 330);
    await fireScroll(scroller);
    expect(screen.getByRole('link', { name: '容器第二节' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    setTop(second, 331);
    await fireScroll(scroller);
    expect(screen.getByRole('link', { name: '容器第一节' })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  it('target 容器重挂后迁移滚动监听', async () => {
    let scroller = document.createElement('div');
    document.body.appendChild(scroller);
    makeSection('remount-first', 100);
    const second = makeSection('remount-second', 300);
    render(
      <Anchor target={() => scroller}>
        <Anchor.Link href="#remount-first" title="重挂一" />
        <Anchor.Link href="#remount-second" title="重挂二" />
      </Anchor>
    );
    expect(screen.getByRole('link', { name: '重挂一' })).toHaveAttribute('aria-current', 'true');

    const previous = scroller;
    const replacement = document.createElement('div');
    previous.replaceWith(replacement);
    scroller = replacement;
    await act(async () => undefined);

    setTop(second, 2);
    await fireScroll(replacement);
    expect(screen.getByRole('link', { name: '重挂二' })).toHaveAttribute('aria-current', 'true');
  });

  it('卸载时移除滚动、scrollend 与 resize 监听', () => {
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    makeSection('cleanup-section', 100);
    const scrollerRemove = vi.spyOn(scroller, 'removeEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <Anchor target={() => scroller}>
        <Anchor.Link href="#cleanup-section" title="卸载清理" />
      </Anchor>
    );
    unmount();

    expect(scrollerRemove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(scrollerRemove).toHaveBeenCalledWith('scrollend', expect.any(Function));
    expect(windowRemove).toHaveBeenCalledWith('resize', expect.any(Function));
    scrollerRemove.mockRestore();
    windowRemove.mockRestore();
  });
});

describe('Anchor 点击行为', () => {
  it('自定义容器内点击只滚动该容器，保留窗口位置并抵消 offsetTop', async () => {
    const user = userEvent.setup();
    const scroller = document.createElement('div');
    setTop(scroller, 300);
    scroller.scrollTop = 40;
    Object.defineProperty(scroller, 'clientTop', { value: 2 });
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    document.body.appendChild(scroller);
    const section = makeSection('container-click', 600);
    scroller.appendChild(section);
    render(
      <Anchor offsetTop={20} target={() => scroller}>
        <Anchor.Link href="#container-click" title="容器章节" />
      </Anchor>
    );
    scrollIntoViewMock.mockClear();
    await user.click(screen.getByRole('link', { name: '容器章节' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 318, behavior: 'smooth' });
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('点击 preventDefault + 不改写 location.hash + 立即激活 + 平滑滚动', async () => {
    const user = userEvent.setup();
    makeSection('k1', 100);
    const s2 = makeSection('k2', 300);
    const clickEvents: MouseEvent[] = [];
    const listener = (event: MouseEvent) => clickEvents.push(event);
    document.addEventListener('click', listener);
    try {
      render(
        <Anchor>
          <Anchor.Link href="#k1" title="点一" />
          <Anchor.Link href="#k2" title="点二" />
        </Anchor>
      );
      scrollIntoViewMock.mockClear();
      await user.click(screen.getByRole('link', { name: '点二' }));
      // preventDefault（事件冒泡到 document 时默认行为已被阻止）
      expect(clickEvents[0]?.defaultPrevented).toBe(true);
      // 不改写 location.hash
      expect(window.location.hash).toBe('');
      // 点击即置 active（无需等待滚动侦测）
      expect(screen.getByRole('link', { name: '点二' })).toHaveAttribute('aria-current', 'true');
      // 平滑滚动到目标节
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(scrollIntoViewMock.mock.contexts[0]).toBe(s2);
    } finally {
      document.removeEventListener('click', listener);
    }
  });

  it('平滑滚动途中锁定点击项，scrollend 后才恢复位置侦测', async () => {
    const user = userEvent.setup();
    makeSection('lock-1', 0);
    const middle = makeSection('lock-2', 300);
    makeSection('lock-3', 600);
    render(
      <Anchor>
        <Anchor.Link href="#lock-1" title="锁定一" />
        <Anchor.Link href="#lock-2" title="锁定二" />
        <Anchor.Link href="#lock-3" title="锁定三" />
      </Anchor>
    );

    await user.click(screen.getByRole('link', { name: '锁定三' }));
    setTop(middle, 2);
    await fireScroll();
    expect(screen.getByRole('link', { name: '锁定三' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: '锁定二' })).not.toHaveAttribute('aria-current');

    await act(async () => {
      window.dispatchEvent(new Event('scrollend'));
    });
    expect(screen.getByRole('link', { name: '锁定二' })).toHaveAttribute('aria-current', 'true');
  });

  it('offsetTop 通过 scroll-margin-top 抵消，滚动目的地计算后还原', async () => {
    const user = userEvent.setup();
    makeSection('m1', 200);
    const s2 = makeSection('m2', 500);
    render(
      <Anchor offsetTop={80}>
        <Anchor.Link href="#m1" title="甲" />
        <Anchor.Link href="#m2" title="乙" />
      </Anchor>
    );
    scrollIntoViewMock.mockClear();
    const restoreFrames: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        restoreFrames.push(callback);
        return restoreFrames.length;
      });
    try {
      await user.click(screen.getByRole('link', { name: '乙' }));
      expect(s2.style.scrollMarginTop).toBe('80px');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(restoreFrames).toHaveLength(1);
      act(() => restoreFrames[0](performance.now()));
      expect(s2.style.scrollMarginTop).toBe('');
    } finally {
      rafSpy.mockRestore();
    }
  });

  it('onClick 回调收到 event 与 { href, title }', async () => {
    const user = userEvent.setup();
    makeSection('u1', 100);
    makeSection('u2', 300);
    const onClick = vi.fn();
    render(
      <Anchor onClick={onClick}>
        <Anchor.Link href="#u1" title="第一" />
        <Anchor.Link href="#u2" title="第二" />
      </Anchor>
    );
    await user.click(screen.getByRole('link', { name: '第二' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    const [event, link] = onClick.mock.calls[0];
    expect(link.href).toBe('#u2');
    expect(link.title).toBe('第二');
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Anchor 结构与定制', () => {
  it('嵌套 Link 渲染 ul 内嵌 ul 缩进', () => {
    render(
      <Anchor>
        <Anchor.Link href="#p" title="父级">
          <Anchor.Link href="#c1" title="子级一" />
          <Anchor.Link href="#c2" title="子级二" />
        </Anchor.Link>
        <Anchor.Link href="#q" title="另一父级" />
      </Anchor>
    );
    const sublist = document.querySelector('ul ul.z-anchor-sublist');
    expect(sublist).not.toBeNull();
    expect(sublist).toHaveAttribute('data-part', 'sublist');
    // 嵌套 ul 位于父级 li 内
    expect(sublist?.parentElement).toHaveClass('z-anchor-item');
    const childLinks = sublist?.querySelectorAll('a');
    expect(childLinks).toHaveLength(2);
    expect(childLinks?.[0]).toHaveAttribute('href', '#c1');
    // 顶层列表只有两个 li（父级链接自己不进入子列表）
    const topList = document.querySelector('.z-anchor-list');
    expect(topList?.children).toHaveLength(2);
  });

  it('classNames / className / data-part 透传', () => {
    makeSection('z1', 50);
    render(
      <Anchor className="page-toc" classNames={{ root: 'my-root', link: 'my-link' }}>
        <Anchor.Link href="#z1" title="定制" className="extra-link" />
      </Anchor>
    );
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('z-anchor', 'page-toc', 'my-root');
    const link = screen.getByRole('link', { name: '定制' });
    expect(link).toHaveClass('z-anchor-link', 'my-link', 'extra-link');
    expect(link.getAttribute('data-part')).toBe('link');
    expect(nav.querySelector('[data-part="item"]')).not.toBeNull();
  });

  it('Link 其余 props 透传到 a 元素', () => {
    render(
      <Anchor>
        <Anchor.Link href="#t" title="透传" id="link-t" aria-label="跳转透传" />
      </Anchor>
    );
    const link = screen.getByLabelText('跳转透传');
    expect(link).toHaveAttribute('id', 'link-t');
    expect(link).toHaveAttribute('href', '#t');
  });
});
