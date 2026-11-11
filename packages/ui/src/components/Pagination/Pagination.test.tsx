import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

afterEach(cleanup);

function getNav(): HTMLElement {
  return screen.getByRole('navigation', { name: '分页' });
}

/** 页码按钮（数字内容），按 DOM 顺序 */
function pageButtons(): HTMLButtonElement[] {
  return Array.from(getNav().querySelectorAll<HTMLButtonElement>('button[data-part="item"]')).filter(
    (button) => /^\d+$/.test(button.textContent ?? '')
  );
}

function pageLabels(): string[] {
  return pageButtons().map((button) => button.textContent ?? '');
}

function getButton(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function currentPageLabel(): string | undefined {
  return pageButtons().find((button) => button.getAttribute('aria-current') === 'page')?.textContent;
}

describe('Pagination', () => {
  it('渲染默认态：nav 语义、1 起始、默认折叠', () => {
    render(<Pagination total={50} />);
    const nav = getNav();
    expect(nav.tagName).toBe('NAV');
    expect(nav).toHaveAttribute('data-part', 'root');
    expect(nav).toHaveClass('z-pagination');

    // total=50 / pageSize=10 → 5 页；当前第 1 页、siblings=1 → 1 2 … 5
    expect(pageLabels()).toEqual(['1', '2', '5']);
    expect(currentPageLabel()).toBe('1');
    expect(pageButtons().filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('defaultPage 非受控初始页为 1 起始', () => {
    render(<Pagination total={50} defaultPage={3} />);
    // 当前 3、siblings=1 → 范围 2..4 与首尾衔接，全部平铺
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5']);
    expect(currentPageLabel()).toBe('3');
  });

  it('siblings 折叠省略号：范围外折叠为 …（+1/+2），首尾固定', () => {
    render(<Pagination total={100} defaultPage={5} siblings={1} />);
    // 10 页，当前 5，两侧各 1 → 1 … 4 5 6 … 10
    expect(pageLabels()).toEqual(['1', '4', '5', '6', '10']);

    const ellipses = getNav().querySelectorAll(".z-pagination-ellipsis");
    expect(ellipses).toHaveLength(2);
    for (const el of ellipses) {
      expect(el).toHaveClass('z-pagination-ellipsis');
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(el.textContent).toBe('…');
    }
    // 被折叠的页码不渲染
    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
    expect(screen.queryByRole('button', { name: '9' })).toBeNull();
  });

  it('siblings=0：仅当前页与首尾，两侧省略号', () => {
    render(<Pagination total={100} defaultPage={5} siblings={0} />);
    expect(pageLabels()).toEqual(['1', '5', '10']);
    expect(getNav().querySelectorAll(".z-pagination-ellipsis")).toHaveLength(2);
  });

  it('范围与首尾衔接时全部平铺，无省略号', () => {
    render(<Pagination total={50} defaultPage={3} siblings={2} />);
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5']);
    expect(getNav().querySelectorAll(".z-pagination-ellipsis")).toHaveLength(0);
  });

  it('仅一页时只渲染 1，上一页/下一页均禁用', () => {
    render(<Pagination total={5} />);
    expect(pageLabels()).toEqual(['1']);
    expect(getButton('上一页')).toBeDisabled();
    expect(getButton('下一页')).toBeDisabled();
  });

  it('非受控：点击页码切换 aria-current 并回调 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination total={50} defaultPage={3} onPageChange={onPageChange} />);

    // 当前 3 → 全平铺 1 2 3 4 5，点击 2
    await user.click(getButton('2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(currentPageLabel()).toBe('2');

    // 当前 2 → 1 2 3 … 5（5 仍可见），点击 5 后折叠为 1 … 4 5
    await user.click(getButton('5'));
    expect(onPageChange).toHaveBeenCalledWith(5);
    expect(currentPageLabel()).toBe('5');
  });

  it('受控：page 驱动显示，点击仅回调不自变', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination total={100} page={5} siblings={1} onPageChange={onPageChange} />
    );

    await user.click(getButton('4'));
    expect(onPageChange).toHaveBeenCalledWith(4);
    // 受控：显示仍为 5
    expect(currentPageLabel()).toBe('5');

    rerender(<Pagination total={100} page={4} siblings={1} onPageChange={onPageChange} />);
    expect(currentPageLabel()).toBe('4');
  });

  it('上一页/下一页：步进回调', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination total={50} defaultPage={1} onPageChange={onPageChange} />);

    expect(getButton('上一页')).toBeDisabled();
    expect(getButton('下一页')).toBeEnabled();

    await user.click(getButton('下一页'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('最后一页时下一页禁用', () => {
    render(<Pagination total={50} defaultPage={5} />);
    expect(getButton('下一页')).toBeDisabled();
    expect(getButton('上一页')).toBeEnabled();
  });

  it('点击当前页不触发 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination total={50} defaultPage={3} onPageChange={onPageChange} />);
    await user.click(getButton('3'));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('showJumper：数字输入 + Enter 跳页（1 起始，越界收敛）', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination total={50} showJumper onPageChange={onPageChange} />);

    const input = screen.getByRole('spinbutton', { name: '跳至页码' }) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'number');

    await user.type(input, '4{Enter}');
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    expect(input.value).toBe(''); // 跳页后清空

    // 越界收敛到最后一页
    await user.type(input, '99{Enter}');
    expect(onPageChange).toHaveBeenLastCalledWith(5);

    // 越界收敛到第一页
    await user.type(input, '0{Enter}');
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('showJumper：非有限数 + Enter 不回调并清空文本', () => {
    const onPageChange = vi.fn();
    render(<Pagination total={50} showJumper onPageChange={onPageChange} />);
    const input = screen.getByRole('spinbutton', { name: '跳至页码' }) as HTMLInputElement;

    // jsdom 会过滤 number 输入中的非有限文本，因此覆盖一次 getter 来验证 Enter 防御分支。
    let reads = 0;
    const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => (reads++ === 0 ? '1e309' : nativeValue.get!.call(input)),
      set: (value: string) => nativeValue.set!.call(input, value),
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPageChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('disabled：页码/上下页/跳页全部禁用且不可点击', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination total={50} showJumper disabled onPageChange={onPageChange} />);

    expect(getNav()).toHaveAttribute('data-disabled', 'true');
    for (const button of getNav().querySelectorAll('button')) {
      expect(button).toBeDisabled();
    }
    const input = screen.getByRole('spinbutton', { name: '跳至页码' });
    expect(input).toBeDisabled();

    await user.click(getButton('2')).catch(() => undefined);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('未禁用时根节点无 data-disabled', () => {
    render(<Pagination total={50} />);
    expect(getNav()).not.toHaveAttribute('data-disabled');
  });

  it('ARIA：role=navigation + aria-label=分页，当前页 aria-current=page', () => {
    render(<Pagination total={50} defaultPage={2} />);
    const nav = getNav();
    expect(nav).toHaveAttribute('role', 'navigation');
    expect(nav).toHaveAttribute('aria-label', '分页');
    const current = pageButtons().filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-current', 'page');
    expect(current[0].textContent).toBe('2');
  });

  it('classNames / data-part 透传', () => {
    render(
      <Pagination
        total={50}
        showJumper
        className="my-root"
        classNames={{ root: 'cls-root', item: 'cls-item', jumper: 'cls-jumper' }}
      />
    );
    const nav = getNav();
    expect(nav).toHaveClass('z-pagination', 'my-root', 'cls-root');

    const items = nav.querySelectorAll('[data-part="item"]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toHaveClass('z-pagination-item', 'cls-item');
    }

    const jumper = nav.querySelector('[data-part="jumper"]');
    expect(jumper).toHaveClass('z-pagination-jumper', 'cls-jumper');
  });

  it('forwards ref to the nav element', () => {
    const ref = React.createRef<HTMLElement>();
    render(<Pagination total={50} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(getNav());
  });

  it('passes native props through to the nav element', () => {
    render(<Pagination total={50} id="pg" data-testid="pg" aria-describedby="pg-desc" />);
    const nav = document.getElementById('pg') as HTMLElement;
    expect(nav).toHaveAttribute('id', 'pg');
    expect(nav).toHaveAttribute('data-testid', 'pg');
    expect(nav).toHaveAttribute('aria-describedby', 'pg-desc');
  });

  it('pageSize 影响总页数', () => {
    render(<Pagination total={30} pageSize={5} defaultPage={3} siblings={3} />);
    // 30 条 / 每页 5 条 → 6 页
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('total=0 时至少渲染 1 页且上下页禁用', () => {
    render(<Pagination total={0} />);
    expect(pageLabels()).toEqual(['1']);
    expect(getButton('上一页')).toBeDisabled();
    expect(getButton('下一页')).toBeDisabled();
  });
});
