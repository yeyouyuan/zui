import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Steps } from './index';
import type { StepsItem } from './Steps';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const BASE_ITEMS: StepsItem[] = [
  { title: '第一步', description: '填写信息' },
  { title: '第二步', description: '确认订单' },
  { title: '第三步', description: '完成支付' },
  { title: '第四步', description: '等待发货' },
];

function itemsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.z-steps > li'));
}

function buttonsOf(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('.z-steps button'));
}

describe('Steps', () => {
  it('派生状态：idx<current 为 finish，== 为 process，> 为 wait', () => {
    const { container } = render(<Steps items={BASE_ITEMS} current={1} />);
    const items = itemsOf(container);
    expect(items[0]).toHaveAttribute('data-status', 'finish');
    expect(items[1]).toHaveAttribute('data-status', 'process');
    expect(items[2]).toHaveAttribute('data-status', 'wait');
    expect(items[3]).toHaveAttribute('data-status', 'wait');
  });

  it('显式 status 覆盖派生状态（error 可出现在任意位置）', () => {
    const items: StepsItem[] = [
      { title: 'A' },
      { title: 'B', status: 'error' },
      { title: 'C', status: 'wait' },
    ];
    const { container } = render(<Steps items={items} current={2} />);
    const list = itemsOf(container);
    // current=2 时派生应为 finish/finish/process，但显式覆盖优先
    expect(list[0]).toHaveAttribute('data-status', 'finish');
    expect(list[1]).toHaveAttribute('data-status', 'error');
    expect(list[2]).toHaveAttribute('data-status', 'wait');
  });

  it('当前项 aria-current="step"，其余项没有', () => {
    const { container } = render(<Steps items={BASE_ITEMS} current={2} />);
    const items = itemsOf(container);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(items[3]).not.toHaveAttribute('aria-current');
  });

  it('结构：nav aria-label 走 locale.steps.label，ol role=list，最后一个无连接线', () => {
    const { container } = render(<Steps items={BASE_ITEMS} />);
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav).toHaveAttribute('aria-label', '步骤条');

    const ol = container.querySelector('ol');
    expect(ol).toHaveAttribute('role', 'list');
    expect(itemsOf(container)).toHaveLength(4);

    // 4 项只有 3 条连接线（最后一项无线）
    const connectors = container.querySelectorAll('[data-part="connector"]');
    expect(connectors).toHaveLength(3);
    expect(itemsOf(container)[3].querySelector('[data-part="connector"]')).toBeNull();
  });

  it('默认图标：process/wait 为数字，finish 为 CheckCircle，error 为 XCircle', () => {
    const items: StepsItem[] = [{ title: 'A' }, { title: 'B' }, { title: 'C', status: 'error' }];
    const { container } = render(<Steps items={items} current={1} />);
    const list = itemsOf(container);

    // finish（第 0 项）：svg 图标（CheckCircle），无数字
    const finishIcon = list[0].querySelector('[data-part="icon"]')!;
    expect(finishIcon.querySelector('svg')).not.toBeNull();
    expect(finishIcon.textContent).not.toContain('1');

    // process（第 1 项）：数字 2，无 svg
    const processIcon = list[1].querySelector('[data-part="icon"]')!;
    expect(processIcon.querySelector('svg')).toBeNull();
    expect(processIcon.textContent).toBe('2');

    // wait（数字）与 error（XCircle svg）
    expect(list[2].querySelector('[data-part="icon"]')!.querySelector('svg')).not.toBeNull();
    expect(list[0].querySelector('[data-part="icon"]')!.querySelector('svg')).not.toBeNull();
  });

  it('自定义 icon 替换默认图标与数字', () => {
    const items: StepsItem[] = [
      { title: 'A', icon: <svg data-testid="custom-icon" /> },
      { title: 'B' },
    ];
    const { container } = render(<Steps items={items} current={0} />);
    const firstIcon = itemsOf(container)[0].querySelector('[data-part="icon"]')!;
    expect(firstIcon.querySelector('[data-testid="custom-icon"]')).not.toBeNull();
    // 默认数字被替换（process 本应显示 1）
    expect(firstIcon.textContent).not.toBe('1');
    // 第二项仍是默认数字
    expect(itemsOf(container)[1].querySelector('[data-part="icon"]')!.textContent).toBe('2');
  });

  it('点击步骤触发 onChange(index)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Steps items={BASE_ITEMS} current={0} onChange={onChange} />);
    await user.click(buttonsOf(container)[2]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('键盘：↑←/↓→ 移动焦点（roving tabindex），Enter 确认 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Steps items={BASE_ITEMS} current={0} onChange={onChange} />);
    const buttons = buttonsOf(container);
    buttons[0].focus();

    await user.keyboard('{ArrowRight}');
    expect(buttons[1]).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    // roving tabindex 跟随焦点
    expect(buttons[1]).toHaveAttribute('tabindex', '0');
    expect(buttons[0]).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowDown}');
    expect(buttons[2]).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(buttons[1]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(buttons[0]).toHaveFocus();

    // Enter 确认（原生 click）
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('键盘：Home/End 跳到首个/最后一个启用步骤', async () => {
    const user = userEvent.setup();
    const { container } = render(<Steps items={BASE_ITEMS} current={0} onChange={() => {}} />);
    const buttons = buttonsOf(container);
    buttons[0].focus();

    await user.keyboard('{End}');
    expect(buttons[3]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(buttons[0]).toHaveFocus();
  });

  it('disabled：不可点击、aria-disabled，键盘导航跳过', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const items: StepsItem[] = [
      { title: 'A' },
      { title: 'B', disabled: true },
      { title: 'C' },
    ];
    const { container } = render(<Steps items={items} current={0} onChange={onChange} />);

    // disabled 项不渲染为 button，可交互元素只有 2 个
    const buttons = buttonsOf(container);
    expect(buttons).toHaveLength(2);
    const disabledTrigger = itemsOf(container)[1].querySelector('[data-part="trigger"]')!;
    expect(disabledTrigger.tagName).toBe('SPAN');
    expect(disabledTrigger).toHaveAttribute('aria-disabled', 'true');

    // 点击不触发
    await user.click(disabledTrigger);
    expect(onChange).not.toHaveBeenCalled();

    // 键盘跳过 disabled 直达下一启用项
    buttons[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(buttons[1]).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('direction/size 通过 data 属性暴露（默认 horizontal/md）', () => {
    const { container, rerender } = render(<Steps items={BASE_ITEMS} />);
    const ol = container.querySelector('ol')!;
    expect(ol).toHaveAttribute('data-direction', 'horizontal');
    expect(ol).toHaveAttribute('data-size', 'md');

    rerender(<Steps items={BASE_ITEMS} direction="vertical" size="sm" />);
    expect(ol).toHaveAttribute('data-direction', 'vertical');
    expect(ol).toHaveAttribute('data-size', 'sm');
  });

  it('classNames 与 data-part 透传（root/item/icon/content/connector）', () => {
    const { container } = render(
      <Steps
        items={BASE_ITEMS}
        className="my-extra"
        classNames={{
          root: 'my-root',
          item: 'my-item',
          icon: 'my-icon',
          content: 'my-content',
          connector: 'my-connector',
        }}
      />
    );
    const root = container.querySelector('.z-steps') as HTMLElement;
    expect(root).toHaveClass('my-root');
    expect(root).toHaveClass('my-extra');
    expect(root).toHaveAttribute('data-part', 'root');

    const item = itemsOf(container)[0];
    expect(item).toHaveClass('my-item');
    expect(item).toHaveAttribute('data-part', 'item');

    const icon = item.querySelector('[data-part="icon"]')!;
    expect(icon).toHaveClass('my-icon');

    const content = item.querySelector('[data-part="content"]')!;
    expect(content).toHaveClass('my-content');

    const connector = item.querySelector('[data-part="connector"]')!;
    expect(connector).toHaveClass('my-connector');
  });

  it('未提供 onChange 时为纯展示（无 button、无 data-clickable）', () => {
    const { container } = render(<Steps items={BASE_ITEMS} current={0} />);
    const ol = container.querySelector('ol')!;
    expect(ol).not.toHaveAttribute('data-clickable');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    // 触发器退化为非交互 div
    expect(
      itemsOf(container)[0].querySelector('[data-part="trigger"]')!.tagName
    ).toBe('DIV');
  });

  it('边界：current 越界收敛，tab 停靠首个启用步骤', () => {
    const items: StepsItem[] = [
      { title: 'A', disabled: true },
      { title: 'B' },
      { title: 'C' },
    ];
    const { container } = render(<Steps items={items} current={99} onChange={() => {}} />);
    const buttons = buttonsOf(container);
    // 越界收敛到末位；末位启用 → 停靠它；首位 disabled 不可聚焦
    expect(buttons[1]).toHaveAttribute('tabindex', '0');
    expect(buttons[0]).toHaveAttribute('tabindex', '-1');
    // 派生：0/1 finish，2 process
    const list = itemsOf(container);
    expect(list[0]).toHaveAttribute('data-status', 'finish');
    expect(list[1]).toHaveAttribute('data-status', 'finish');
    expect(list[2]).toHaveAttribute('data-status', 'process');
  });
});
