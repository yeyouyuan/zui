import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

/* ---------------------------------- 工具 ---------------------------------- */

function getStartInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: '开始日期' }) as HTMLInputElement;
}

function getEndInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: '结束日期' }) as HTMLInputElement;
}

function getPanel(): HTMLElement {
  return screen.getByRole('dialog', { name: '选择日期范围' });
}

function getGrids(): HTMLElement[] {
  return screen.getAllByRole('grid');
}

/** 2024-03 视图（左月）下 03-08 ~ 04-07 每个日期只出现在左网格，04-01 起在右网格有重复，
 *  取首匹配即可断言（两份副本的选中/禁用属性一致） */
function getDayCell(iso: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`[data-date="${iso}"]`);
  if (!cell) throw new Error(`未找到日期格 ${iso}`);
  return cell;
}

function focusedDateISO(): string | null {
  return document.activeElement?.getAttribute('data-date') ?? null;
}

/** 固定日期基线：2024-03-15 是周五，2024 是闰年（2 月 29 天），04-01 是周一 */
const RANGE = ['2024-03-15', '2024-03-20'] as [string, string];

describe('DateRangePicker 渲染与受控', () => {
  it('默认渲染：双输入位 + 分隔符 + 图标，data-part 全套，关闭态无面板', () => {
    render(<DateRangePicker />);
    const start = getStartInput();
    const end = getEndInput();
    expect(start).toHaveValue('');
    expect(end).toHaveValue('');
    expect(start).toHaveAttribute('placeholder', '开始日期');
    expect(end).toHaveAttribute('placeholder', '结束日期');
    expect(start).toHaveAttribute('aria-haspopup', 'dialog');
    expect(start).toHaveAttribute('aria-expanded', 'false');
    expect(end).toHaveAttribute('aria-expanded', 'false');
    // 双输入位之间是 locale.dateRange.separator
    expect(document.querySelector('[data-part="separator"]')).toHaveTextContent('至');
    expect(document.querySelector('[data-part="icon"]')).toBeInTheDocument();

    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-daterange');
    expect(document.querySelector('[data-part="trigger"]')).toBeInTheDocument();
    expect(document.querySelector('[data-part="input-start"]')).toBe(start);
    expect(document.querySelector('[data-part="input-end"]')).toBe(end);
    // 关闭态无面板，默认值无清除钮
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
  });

  it('defaultValue 显示范围两端', () => {
    render(<DateRangePicker defaultValue={RANGE} />);
    expect(getStartInput()).toHaveValue('2024-03-15');
    expect(getEndInput()).toHaveValue('2024-03-20');
  });

  it('受控：完成选择触发 onChange 元组，显示仍以 value 为准', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker value={RANGE} onChange={onChange} />);
    expect(getStartInput()).toHaveValue('2024-03-15');

    await user.click(getStartInput());
    await user.click(getDayCell('2024-03-22'));
    await user.click(getDayCell('2024-03-25'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['2024-03-22', '2024-03-25']);
    // 受控显示仍以 value prop 为准
    expect(getStartInput()).toHaveValue('2024-03-15');
    expect(getEndInput()).toHaveValue('2024-03-20');
  });

  it('非受控：完成选择后输入位更新且面板关闭', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    await user.click(getStartInput());
    await user.click(getDayCell('2024-03-25'));
    await user.click(getDayCell('2024-03-28'));
    expect(onChange).toHaveBeenCalledWith(['2024-03-25', '2024-03-28']);
    expect(getStartInput()).toHaveValue('2024-03-25');
    expect(getEndInput()).toHaveValue('2024-03-28');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('size 与 status 写入 data 属性', () => {
    const { rerender } = render(<DateRangePicker size="lg" status="error" />);
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(root).toHaveAttribute('data-status', 'error');
    rerender(<DateRangePicker size="sm" status="success" />);
    expect(root).toHaveAttribute('data-size', 'sm');
    expect(root).toHaveAttribute('data-status', 'success');
  });
});

describe('DateRangePicker 双月面板', () => {
  it('双月并排：两个 grid 各 42 格，月份标题 / 星期表头 / 面板 aria 复用 locale', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    const panel = getPanel();
    expect(panel).toHaveAttribute('aria-label', '选择日期范围');
    const grids = getGrids();
    expect(grids).toHaveLength(2);
    for (const grid of grids) {
      expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
      const headers = within(grid).getAllByRole('columnheader');
      expect(headers).toHaveLength(7);
      expect(headers[0]).toHaveTextContent('一');
      expect(headers[6]).toHaveTextContent('日');
    }
    // 左 = viewMonth，右 = 下月，各自 aria-labelledby 关联标题
    expect(screen.getByText('2024年3月')).toBeInTheDocument();
    expect(screen.getByText('2024年4月')).toBeInTheDocument();
    const leftLabel = screen.getByText('2024年3月');
    const rightLabel = screen.getByText('2024年4月');
    expect(grids[0]).toHaveAttribute('aria-labelledby', leftLabel.id);
    expect(grids[1]).toHaveAttribute('aria-labelledby', rightLabel.id);
  });

  it('共享导航：‹ › 同时平移左右两月标题', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());
    const panel = getPanel();

    await user.click(within(panel).getByRole('button', { name: '下一月' }));
    expect(screen.getByText('2024年4月')).toBeInTheDocument();
    expect(screen.getByText('2024年5月')).toBeInTheDocument();

    await user.click(within(getPanel()).getByRole('button', { name: '上一月' }));
    await user.click(within(getPanel()).getByRole('button', { name: '上一月' }));
    expect(screen.getByText('2024年2月')).toBeInTheDocument();
    expect(screen.getByText('2024年3月')).toBeInTheDocument();
  });

  it('跨月选择：左面板起点 + 右面板终点', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    await user.click(getStartInput());

    // 打开时焦点落在起点格（roving tabindex）
    expect(focusedDateISO()).toBe('2024-03-15');
    await user.click(getDayCell('2024-03-15'));
    await user.click(getDayCell('2024-04-20'));
    expect(onChange).toHaveBeenCalledWith(['2024-03-15', '2024-04-20']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DateRangePicker 选择状态机', () => {
  it('顺序选择：起点 aria-selected → 终点完成并关闭', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // defaultValue 仅用于把视图定位到 2024-03+04；重新点选走同一状态机
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    await user.click(getStartInput());

    await user.click(getDayCell('2024-03-15'));
    // 只有起点：面板保持打开，起点 aria-selected，无 onChange
    expect(getDayCell('2024-03-15')).toHaveAttribute('aria-selected', 'true');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeNull();

    await user.click(getDayCell('2024-03-18'));
    expect(onChange).toHaveBeenCalledWith(['2024-03-15', '2024-03-18']);
    expect(screen.queryByRole('dialog')).toBeNull();
    // 焦点归还触发器
    expect(document.activeElement).toBe(getStartInput());
  });

  it('逆序重开：B < A 时 B 成为新起点，不触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    await user.click(getStartInput());

    await user.click(getDayCell('2024-03-20'));
    await user.click(getDayCell('2024-03-10'));
    expect(onChange).not.toHaveBeenCalled();
    // 03-10 成为新起点，03-20 不再选中
    expect(getDayCell('2024-03-10')).toHaveAttribute('aria-selected', 'true');
    expect(getDayCell('2024-03-20')).toHaveAttribute('aria-selected', 'false');
    // 面板保持打开，继续点击终点完成
    expect(screen.queryByRole('dialog')).not.toBeNull();
    await user.click(getDayCell('2024-03-20'));
    expect(onChange).toHaveBeenCalledWith(['2024-03-10', '2024-03-20']);
  });

  it('范围高亮：start/end aria-selected，中间格 data-in-range=true', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    expect(getDayCell('2024-03-15')).toHaveAttribute('aria-selected', 'true');
    expect(getDayCell('2024-03-20')).toHaveAttribute('aria-selected', 'true');
    expect(getDayCell('2024-03-14')).toHaveAttribute('aria-selected', 'false');
    for (const iso of ['2024-03-16', '2024-03-17', '2024-03-18', '2024-03-19']) {
      expect(getDayCell(iso)).toHaveAttribute('data-in-range', 'true');
    }
    expect(getDayCell('2024-03-15')).not.toHaveAttribute('data-in-range');
    expect(getDayCell('2024-03-21')).not.toHaveAttribute('data-in-range');
  });

  it('min/max 之外禁选：aria-disabled，点击与 Enter 均不生效，边界可选', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateRangePicker
        defaultValue={['2024-03-15', '2024-03-18']}
        min="2024-03-10"
        max="2024-03-20"
        onChange={onChange}
      />
    );
    await user.click(getStartInput());

    expect(getDayCell('2024-03-09')).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell('2024-03-21')).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell('2024-04-10')).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell('2024-03-15')).not.toHaveAttribute('aria-disabled');

    // 点击禁用日无效
    await user.click(getDayCell('2024-03-09'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeNull();

    // 键盘聚焦到禁用日（Home → 03-01），Enter 不选中、面板不关
    await user.keyboard('{Home}');
    expect(focusedDateISO()).toBe('2024-03-01');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeNull();

    // min/max 边界可选
    await user.click(getDayCell('2024-03-10'));
    await user.click(getDayCell('2024-03-20'));
    expect(onChange).toHaveBeenCalledWith(['2024-03-10', '2024-03-20']);
  });
});

describe('DateRangePicker 清除与禁用', () => {
  it('allowClear 默认显示清除钮：点击 onChange(null) 并清空输入位', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    const clear = screen.getByRole('button', { name: '清除' });
    await user.click(clear);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(getStartInput()).toHaveValue('');
    expect(getEndInput()).toHaveValue('');
    // 清空后清除钮消失，焦点还给开始输入位
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
    expect(document.activeElement).toBe(getStartInput());
  });

  it('allowClear=false 不渲染清除钮', () => {
    render(<DateRangePicker defaultValue={RANGE} allowClear={false} />);
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
  });

  it('disabled：输入位禁用、无法打开面板、不显示清除钮', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} disabled />);
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveAttribute('data-disabled', 'true');
    expect(getStartInput()).toBeDisabled();
    expect(getEndInput()).toBeDisabled();
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();

    await user.click(getStartInput());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DateRangePicker 键盘', () => {
  it('触发器 Enter / Space / ArrowDown / ArrowUp 打开面板，焦点落起点格', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    const start = getStartInput();
    start.focus();

    await user.keyboard('{Enter}');
    expect(getPanel()).toBeInTheDocument();
    expect(focusedDateISO()).toBe('2024-03-15');
    expect(getDayCell('2024-03-15')).toHaveAttribute('tabindex', '0');
    expect(getDayCell('2024-03-16')).toHaveAttribute('tabindex', '-1');
    expect(start).toHaveAttribute('aria-expanded', 'true');

    // Esc 关闭后依次用 Space / ArrowDown / ArrowUp 重开
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(start, { key: ' ' });
    expect(getPanel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowDown}');
    expect(getPanel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(getPanel()).toBeInTheDocument();
  });

  it('←→±1 天，周一/周日循环换行', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-16');
    await user.keyboard('{ArrowLeft}');
    expect(focusedDateISO()).toBe('2024-03-15');

    // 周日（03-17）→ 循环回本周一（03-11）
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-17');
    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-11');
    // 周一 ← 循环到本周日
    await user.keyboard('{ArrowLeft}');
    expect(focusedDateISO()).toBe('2024-03-17');
  });

  it('↑↓±7 天跨周移动', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    await user.keyboard('{ArrowUp}');
    expect(focusedDateISO()).toBe('2024-03-08');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(focusedDateISO()).toBe('2024-03-22');
  });

  it('Home / End 移动到月首/月末', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    await user.keyboard('{Home}');
    expect(focusedDateISO()).toBe('2024-03-01');
    await user.keyboard('{End}');
    expect(focusedDateISO()).toBe('2024-03-31');
  });

  it('PageUp / PageDown 跨月移动，双月视图跟随平移', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    await user.keyboard('{PageUp}');
    expect(focusedDateISO()).toBe('2024-02-15');
    // 视图跟随：左月切到 2 月，右月 3 月
    expect(screen.getByText('2024年2月')).toBeInTheDocument();
    expect(screen.getByText('2024年3月')).toBeInTheDocument();

    await user.keyboard('{PageDown}');
    await user.keyboard('{PageDown}');
    expect(focusedDateISO()).toBe('2024-04-15');
    // 视图最小平移：4 月成为右面板（3 月仍留在左面板）
    expect(screen.getByText('2024年3月')).toBeInTheDocument();
    expect(screen.getByText('2024年4月')).toBeInTheDocument();
  });

  it('Enter 走状态机：定起点 → 移动 → Enter 完成并归还焦点', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker defaultValue={RANGE} onChange={onChange} />);
    await user.click(getStartInput());

    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    // 第一个 Enter 只定起点，面板保持打开
    expect(onChange).not.toHaveBeenCalled();
    expect(getDayCell('2024-03-16')).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['2024-03-16', '2024-03-23']);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(getStartInput());
  });

  it('Esc 关闭面板并归还焦点到触发器', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getEndInput());
    expect(getPanel()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    // 焦点归还给打开面板时所在的输入位（结束输入位）
    expect(document.activeElement).toBe(getEndInput());
  });

  it('网格内 Tab（AT 合成事件）关闭面板并退回触发器', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());
    expect(focusedDateISO()).toBe('2024-03-15');

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(getStartInput());
  });
});

describe('DateRangePicker 定制出口', () => {
  it('classNames 追加到对应 slot，data-part 透传', async () => {
    const user = userEvent.setup();
    render(
      <DateRangePicker
        defaultValue={RANGE}
        className="my-outer"
        classNames={{
          root: 'my-root',
          trigger: 'my-trigger',
          panel: 'my-panel',
          day: 'my-day',
          header: 'my-header',
        }}
      />
    );
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveClass('my-root');
    expect(root).toHaveClass('my-outer');
    expect(document.querySelector('[data-part="trigger"]')).toHaveClass('my-trigger');

    await user.click(getStartInput());
    expect(getPanel()).toHaveClass('my-panel');
    expect(getPanel()).toHaveAttribute('data-part', 'panel');
    expect(getPanel().querySelector('[data-part="header"]')).toHaveClass('my-header');
    const cell = getDayCell('2024-03-15');
    expect(cell).toHaveClass('my-day');
    expect(cell).toHaveAttribute('data-part', 'day');
    expect(getGrids()[0]).toHaveAttribute('data-part', 'grid');
  });

  it('点击外部关闭面板', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());
    expect(getPanel()).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('今天格 aria-current="date" + data-today', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker defaultValue={RANGE} />);
    await user.click(getStartInput());

    // 导航到今天所在月份后断言
    const today = new Date();
    const months = (today.getFullYear() - 2024) * 12 + (today.getMonth() - 2);
    const panel = getPanel();
    for (let i = 0; i < months; i += 1) {
      await user.click(within(panel).getByRole('button', { name: '下一月' }));
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    expect(getDayCell(todayISO)).toHaveAttribute('aria-current', 'date');
    expect(getDayCell(todayISO)).toHaveAttribute('data-today');
  });
});
