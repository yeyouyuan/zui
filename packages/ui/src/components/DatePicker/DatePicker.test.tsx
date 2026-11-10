import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './index';
import { Modal } from '../Modal';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

/* ---------------------------------- 工具 ---------------------------------- */

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox', { name: '日期' }) as HTMLInputElement;
}

function getPanel(): HTMLElement {
  return screen.getByRole('dialog', { name: '选择日期' });
}

function getGrid(): HTMLElement {
  return screen.getByRole('grid');
}

function getDayCell(iso: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`[data-date="${iso}"]`);
  if (!cell) throw new Error(`未找到日期格 ${iso}`);
  return cell;
}

function focusedDateISO(): string | null {
  return document.activeElement?.getAttribute('data-date') ?? null;
}

function localISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 固定日期基线：2024-03-11 是周一，2024 是闰年（2 月 29 天） */
const MON = '2024-03-11';

describe('DatePicker 渲染与受控', () => {
  it('默认渲染：placeholder + 触发器结构 data-part', async () => {
    render(<DatePicker />);
    const input = getInput();
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', '请选择日期');
    expect(input).toHaveAttribute('aria-haspopup', 'dialog');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-datepicker');
    expect(document.querySelector('[data-part="trigger"]')).toBeInTheDocument();
    expect(document.querySelector('[data-part="input"]')).toBe(input);
    expect(document.querySelector('[data-part="icon"]')).toBeInTheDocument();
    // 关闭态无面板
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('defaultValue 显示 ISO 文本', () => {
    render(<DatePicker defaultValue="2024-03-15" />);
    expect(getInput()).toHaveValue('2024-03-15');
  });

  it('受控：显示 value，点击日期触发 onChange 且不自行改显示', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2024-03-15" onChange={onChange} />);
    expect(getInput()).toHaveValue('2024-03-15');

    await user.click(getInput());
    await user.click(getDayCell('2024-03-20'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2024-03-20');
    // 受控组件显示仍以 value prop 为准
    expect(getInput()).toHaveValue('2024-03-15');
  });

  it('非受控：点击日期更新输入框并关闭面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2024-03-15" />);
    await user.click(getInput());
    await user.click(getDayCell('2024-03-20'));
    expect(getInput()).toHaveValue('2024-03-20');
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('size 传递 data-size', () => {
    const { rerender } = render(<DatePicker size="lg" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'lg');
    rerender(<DatePicker size="sm" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'sm');
  });
});

describe('DatePicker 打开与关闭', () => {
  it('Modal 内日历面板高于遮罩，Esc 逐层关闭', async () => {
    const user = userEvent.setup();
    render(<Modal defaultOpen>
      <Modal.Content style={{ position: 'relative', zIndex: 400 }}>
        <Modal.Title>日期设置</Modal.Title>
        <DatePicker defaultValue={MON} />
      </Modal.Content>
    </Modal>);

    await user.click(getInput());
    expect(getPanel().style.zIndex).toBe('401');
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await waitFor(() => expect(getDayCell(MON)).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(getInput()).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('Modal 内日历按 Tab 后焦点仍在对话框内', async () => {
    const user = userEvent.setup();
    render(<Modal defaultOpen><Modal.Content>
      <Modal.Title>日期设置</Modal.Title>
      <DatePicker defaultValue={MON} />
      <button>下一项</button>
    </Modal.Content></Modal>);
    await user.click(getInput());
    await waitFor(() => expect(getDayCell(MON)).toHaveFocus());
    await user.tab();
    expect(screen.queryByRole('dialog', { name: '选择日期' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus();
  });
  it('点击打开面板：grid 42 格 + 焦点落在 value 日期格（roving tabindex）', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());

    expect(getInput()).toHaveAttribute('aria-expanded', 'true');
    const grid = getGrid();
    expect(grid).toBeInTheDocument();
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
    // 面板为 dialog 语义
    expect(getPanel()).toBeInTheDocument();
    // 焦点跟随聚焦日期
    expect(focusedDateISO()).toBe(MON);
    expect(getDayCell(MON)).toHaveAttribute('tabindex', '0');
    expect(getDayCell('2024-03-12')).toHaveAttribute('tabindex', '-1');
  });

  it('Enter 打开面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    // 聚焦触发器（点击不触发打开逻辑以外的路径）后 Esc 关闭，再用 Enter 重新打开
    await user.click(getInput());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).toBeNull();

    await user.keyboard('{Enter}');
    expect(getGrid()).toBeInTheDocument();
  });

  it('ArrowDown 打开面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).toBeNull();

    await user.keyboard('{ArrowDown}');
    expect(getGrid()).toBeInTheDocument();
  });

  it('Esc 关闭面板并归还焦点到触发器', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    expect(getGrid()).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(document.activeElement).toBe(getInput());
  });

  it('点击外部关闭面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    expect(getGrid()).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('disabled：输入框禁用且无法打开面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} disabled />);
    const input = getInput();
    expect(input).toBeDisabled();
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute(
      'data-disabled',
      'true'
    );

    await user.click(input);
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('月份导航按钮切换月份标签', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    const panel = getPanel();
    expect(panel).toHaveTextContent('2024年3月');

    await user.click(within(panel).getByRole('button', { name: '下一月' }));
    expect(getPanel()).toHaveTextContent('2024年4月');

    await user.click(within(getPanel()).getByRole('button', { name: '上一月' }));
    await user.click(within(getPanel()).getByRole('button', { name: '上一月' }));
    expect(getPanel()).toHaveTextContent('2024年2月');
  });
});

describe('DatePicker 键盘导航', () => {
  it('ArrowLeft/ArrowRight 移动一天（周内）', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    expect(focusedDateISO()).toBe('2024-03-11');

    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-12');

    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-13');

    await user.keyboard('{ArrowLeft}');
    expect(focusedDateISO()).toBe('2024-03-12');
  });

  it('周循环：周一 ArrowLeft 跳本周日，周日 ArrowRight 跳本周一', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());

    // 周一（03-11）← 循环到本周日（03-17）
    await user.keyboard('{ArrowLeft}');
    expect(focusedDateISO()).toBe('2024-03-17');

    // 周日（03-17）→ 循环回本周一（03-11）
    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-11');
  });

  it('ArrowUp/ArrowDown 按周移动（±7 天，可跨月并切月显示）', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());

    await user.keyboard('{ArrowUp}');
    expect(focusedDateISO()).toBe('2024-03-04');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(focusedDateISO()).toBe('2024-03-18');

    // 跨月：03-18 ↑ 三次到 02-26，月份标签跟随切换
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowUp}');
    expect(focusedDateISO()).toBe('2024-02-26');
    expect(getPanel()).toHaveTextContent('2024年2月');
  });

  it('Home/End 移动到月首/月末', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2024-03-15" />);
    await user.click(getInput());

    await user.keyboard('{Home}');
    expect(focusedDateISO()).toBe('2024-03-01');

    await user.keyboard('{End}');
    expect(focusedDateISO()).toBe('2024-03-31');
  });

  it('PageUp/PageDown 切换上/下月（同日，月末 clamp）', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2024-03-15" />);
    await user.click(getInput());

    await user.keyboard('{PageUp}');
    expect(focusedDateISO()).toBe('2024-02-15');
    expect(getPanel()).toHaveTextContent('2024年2月');

    await user.keyboard('{PageDown}');
    await user.keyboard('{PageDown}');
    expect(focusedDateISO()).toBe('2024-04-15');

    // 1-31 下一月 clamp 到 2-29（2024 闰年）
    await user.keyboard('{PageUp}');
    await user.keyboard('{PageUp}');
    await user.keyboard('{PageUp}');
    expect(focusedDateISO()).toBe('2024-01-15');
    await user.keyboard('{End}');
    expect(focusedDateISO()).toBe('2024-01-31');
    await user.keyboard('{PageDown}');
    expect(focusedDateISO()).toBe('2024-02-29');
  });

  it('Enter 选中聚焦日期并关闭，焦点归还触发器', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue={MON} onChange={onChange} />);
    await user.click(getInput());

    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2024-03-12');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(document.activeElement).toBe(getInput());
  });

  it('min/max 之外日期禁用：不可点击、Enter 不选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        defaultValue="2024-03-15"
        min="2024-03-10"
        max="2024-03-20"
        onChange={onChange}
      />
    );
    await user.click(getInput());

    expect(getDayCell('2024-03-09')).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell('2024-03-21')).toHaveAttribute('aria-disabled', 'true');
    expect(getDayCell('2024-03-15')).not.toHaveAttribute('aria-disabled');

    // 点击禁用日无效
    await user.click(getDayCell('2024-03-09'));
    expect(onChange).not.toHaveBeenCalled();

    // Home 聚焦到 03-01（禁用日），Enter 不选中、面板不关
    await user.keyboard('{Home}');
    expect(focusedDateISO()).toBe('2024-03-01');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('grid')).not.toBeNull();

    // 03-01 → 03-02 → 03-09（禁用）→ 03-10（min 边界）可选
    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-02');
    await user.keyboard('{ArrowDown}');
    expect(focusedDateISO()).toBe('2024-03-09');
    await user.keyboard('{ArrowRight}');
    expect(focusedDateISO()).toBe('2024-03-10');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2024-03-10');
  });

  it('网格内 Tab 关闭面板', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    await user.click(getInput());
    expect(getGrid()).toBeInTheDocument();
    expect(focusedDateISO()).toBe(MON);

    // 直接向聚焦的日期格派发 Tab（AT 场景焦点真实落在 cell 上）
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab' });
    expect(screen.queryByRole('grid')).toBeNull();
    expect(document.activeElement).toBe(getInput());
  });
});

describe('DatePicker 输入解析与高亮', () => {
  it('触发器输入合法 ISO 并回车提交', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue={MON} onChange={onChange} />);
    const input = getInput();

    await user.click(input);
    await user.clear(input);
    await user.type(input, '2024-03-20{Enter}');
    expect(onChange).toHaveBeenCalledWith('2024-03-20');
    // 面板同步到提交日期
    expect(getPanel()).toHaveTextContent('2024年3月');
    expect(getDayCell('2024-03-20')).toHaveAttribute('aria-selected', 'true');
  });

  it('非法输入 blur 还原为当前值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker defaultValue={MON} onChange={onChange} />);
    const input = getInput();

    await user.click(input);
    await user.clear(input);
    await user.type(input, '2024-13-99');
    await user.tab();
    expect(input).toHaveValue(MON);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('今天高亮 aria-current="date"，选中日 aria-selected', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2024-03-15" />);
    await user.click(getInput());

    // 选中日高亮（2024-03 视图内）
    expect(getDayCell('2024-03-15')).toHaveAttribute('aria-selected', 'true');
    expect(getDayCell('2024-03-16')).toHaveAttribute('aria-selected', 'false');

    // 今天 aria-current：用「下月」按钮导航到今天所在月份
    const today = new Date();
    const months =
      (today.getFullYear() - 2024) * 12 + (today.getMonth() - 2); // 自 2024-03 起
    for (let i = 0; i < months; i += 1) {
      await user.click(within(getPanel()).getByRole('button', { name: '下一月' }));
    }
    const todayIso = localISO(today);
    expect(getDayCell(todayIso)).toHaveAttribute('aria-current', 'date');
  });

  it('classNames 与 data-part 透传', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        defaultValue={MON}
        classNames={{
          root: 'my-root',
          trigger: 'my-trigger',
          panel: 'my-panel',
          day: 'my-day',
          header: 'my-header',
        }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('my-root');
    expect(document.querySelector('[data-part="trigger"]')).toHaveClass('my-trigger');

    await user.click(getInput());
    expect(getPanel()).toHaveClass('my-panel');
    expect(getPanel().querySelector('[data-part="header"]')).toHaveClass('my-header');
    const cell = getDayCell(MON);
    expect(cell).toHaveClass('my-day');
    expect(cell).toHaveAttribute('data-part', 'day');
    expect(getGrid()).toHaveAttribute('data-part', 'grid');
  });

  it('ARIA：grid/gridcell/columnheader 结构与 aria-controls 关联', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue={MON} />);
    const input = getInput();
    await user.click(input);

    const panel = getPanel();
    expect(input.getAttribute('aria-controls')).toBe(panel.id);
    const grid = getGrid();
    expect(grid).toHaveAttribute('aria-labelledby');

    // 行结构：1 行表头 + 6 行日期
    expect(within(grid).getAllByRole('row')).toHaveLength(7);
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent('一');
    expect(headers[6]).toHaveTextContent('日');
  });
});
