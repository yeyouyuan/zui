import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

function getTrigger() {
  return screen.getByRole('button');
}

function getColumns() {
  return document.querySelectorAll('[data-part="column"]');
}

function getColumn(unit: 'hour' | 'minute' | 'second') {
  return document.querySelector(`[data-part="column"][data-unit="${unit}"]`) as HTMLElement;
}

describe('TimePicker 渲染', () => {
  it('默认渲染 placeholder', () => {
    render(<TimePicker />);
    expect(getTrigger()).toHaveTextContent('请选择时间');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('默认 format 为 HH:mm：时/分两列', async () => {
    const user = userEvent.setup();
    render(<TimePicker />);
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(getColumns()).toHaveLength(2);
    expect(getColumn('hour')).toHaveAttribute('aria-label', '时');
    expect(getColumn('minute')).toHaveAttribute('aria-label', '分');
    expect(within(getColumn('hour')).getAllByRole('option')).toHaveLength(24);
    expect(within(getColumn('minute')).getAllByRole('option')).toHaveLength(60);
  });

  it('format HH:mm:ss 显示秒列', async () => {
    const user = userEvent.setup();
    render(<TimePicker format="HH:mm:ss" defaultValue="09:30:45" />);
    expect(getTrigger()).toHaveTextContent('09:30:45');
    await user.click(getTrigger());
    expect(getColumns()).toHaveLength(3);
    expect(getColumn('second')).toHaveAttribute('aria-label', '秒');
  });

  it('当前值高亮（data-active + aria-selected）', async () => {
    const user = userEvent.setup();
    render(<TimePicker defaultValue="09:30" />);
    await user.click(getTrigger());
    expect(within(getColumn('hour')).getByRole('option', { name: '09' })).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(within(getColumn('minute')).getByRole('option', { name: '30' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

describe('TimePicker 交互', () => {
  it('点击选项更新草稿高亮', async () => {
    const user = userEvent.setup();
    render(<TimePicker />);
    await user.click(getTrigger());
    await user.click(within(getColumn('hour')).getByRole('option', { name: '08' }));
    expect(within(getColumn('hour')).getByRole('option', { name: '08' })).toHaveAttribute(
      'data-active',
      'true'
    );
    // 尚未确认，触发器不变
    expect(getTrigger()).toHaveTextContent('请选择时间');
  });

  it('Enter 确认：onChange 输出 HH:mm 并关闭', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker onChange={onChange} />);
    await user.click(getTrigger());
    await user.keyboard('{ArrowDown}{ArrowRight}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('01:01');
    expect(getTrigger()).toHaveTextContent('01:01');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('format HH:mm:ss 时 onChange 输出带秒', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker format="HH:mm:ss" onChange={onChange} />);
    await user.click(getTrigger());
    await user.click(within(getColumn('second')).getByRole('option', { name: '45' }));
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('00:00:45');
  });

  it('Esc 关闭且不触发 onChange，焦点归还触发器', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker onChange={onChange} />);
    await user.click(getTrigger());
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getTrigger());
  });

  it('键盘 ↑↓ 滚动三列、←→ 切换列，活动引用始终指向已挂载 option', async () => {
    const user = userEvent.setup();
    render(<TimePicker format="HH:mm:ss" />);
    await user.click(getTrigger());

    await user.keyboard('{ArrowDown}'); // 时 00 → 01
    const hourOption = within(getColumn('hour')).getByRole('option', { name: '01' });
    const panel = document.querySelector('[data-part="panel"]') as HTMLElement;
    expect(hourOption).toHaveAttribute('data-active', 'true');
    expect(hourOption.id).not.toBe('');
    expect(document.getElementById(hourOption.id)).toBe(hourOption);
    expect(panel).toHaveAttribute('aria-activedescendant', hourOption.id);
    expect(getTrigger()).toHaveAttribute('aria-activedescendant', hourOption.id);

    await user.keyboard('{ArrowRight}'); // 切到分列
    const minuteZero = within(getColumn('minute')).getByRole('option', { name: '00' });
    expect(getColumn('minute')).toHaveAttribute('data-focused', 'true');
    expect(document.getElementById(minuteZero.id)).toBe(minuteZero);
    expect(panel).toHaveAttribute('aria-activedescendant', minuteZero.id);
    expect(getTrigger()).toHaveAttribute('aria-activedescendant', minuteZero.id);

    await user.keyboard('{ArrowUp}'); // 分 00 → 59（循环）
    const minuteOption = within(getColumn('minute')).getByRole('option', { name: '59' });
    expect(minuteOption).toHaveAttribute('data-active', 'true');
    expect(document.getElementById(minuteOption.id)).toBe(minuteOption);
    expect(panel).toHaveAttribute('aria-activedescendant', minuteOption.id);
    expect(getTrigger()).toHaveAttribute('aria-activedescendant', minuteOption.id);

    await user.keyboard('{ArrowRight}{ArrowDown}'); // 切到秒列，秒 00 → 01
    const secondOption = within(getColumn('second')).getByRole('option', { name: '01' });
    expect(getColumn('second')).toHaveAttribute('data-focused', 'true');
    expect(secondOption).toHaveAttribute('data-active', 'true');
    expect(document.getElementById(secondOption.id)).toBe(secondOption);
    expect(panel).toHaveAttribute('aria-activedescendant', secondOption.id);
    expect(getTrigger()).toHaveAttribute('aria-activedescendant', secondOption.id);

    await user.keyboard('{ArrowLeft}{ArrowLeft}'); // 切回时列
    expect(getColumn('hour')).toHaveAttribute('data-focused', 'true');
    expect(document.getElementById(hourOption.id)).toBe(hourOption);
    expect(panel).toHaveAttribute('aria-activedescendant', hourOption.id);
    expect(getTrigger()).toHaveAttribute('aria-activedescendant', hourOption.id);
  });

  it('受控模式：onChange 上抛、父组件不更新则显示不变', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TimePicker value="08:00" onChange={onChange} />);
    expect(getTrigger()).toHaveTextContent('08:00');
    await user.click(getTrigger());
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('08:00');
    rerender(<TimePicker value="08:00" onChange={onChange} />);
    expect(getTrigger()).toHaveTextContent('08:00');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('disabled 时无法打开', async () => {
    const user = userEvent.setup();
    render(<TimePicker disabled />);
    expect(getTrigger()).toBeDisabled();
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('TimePicker 定制出口', () => {
  it('classNames 追加到对应 part', async () => {
    const user = userEvent.setup();
    render(
      <TimePicker
        className="my-time"
        classNames={{ root: 'r', trigger: 't', panel: 'p', column: 'c', item: 'i' }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-time-picker', 'r', 'my-time');
    expect(document.querySelector('[data-part="trigger"]')).toHaveClass('z-time-picker-trigger', 't');
    expect(document.querySelector('[data-part="panel"]')).toHaveClass('z-time-picker-panel', 'p');
    await user.click(getTrigger());
    expect(document.querySelector('[data-part="column"]')).toHaveClass('z-time-picker-column', 'c');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('z-time-picker-item', 'i');
  });

  it('data-part 与 data-size 完整', () => {
    render(<TimePicker size="sm" defaultValue="10:20" />);
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveAttribute('data-size', 'sm');
    expect(root).toHaveAttribute('data-open', 'false');
    expect(document.querySelectorAll('[data-part="column"]')).toHaveLength(2);
  });
});
