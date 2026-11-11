import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Calendar } from './Calendar';

afterEach(cleanup);

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

function getDay(container: HTMLElement, iso: string): HTMLElement {
  return container.querySelector(`[data-date="${iso}"]`) as HTMLElement;
}

describe('Calendar', () => {
  it('renders default structure: header label, weekday headers and 42 day cells', () => {
    const { container } = render(<Calendar defaultValue="2026-11-04" />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-calendar');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-fullscreen', 'true');
    expect(screen.getByText('2026年11月')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    // 首格为当月 1 日所在周的周一（2026-11-01 为周日 → 网格始于 2026-10-26）
    expect(getDay(container, '2026-10-26')).toBeInTheDocument();
    expect(getDay(container, '2026-12-06')).toBeInTheDocument();
  });

  it('defaultValue marks the day selected via aria-selected', () => {
    const { container } = render(<Calendar defaultValue="2026-11-04" />);
    const day = getDay(container, '2026-11-04');
    expect(day).toHaveAttribute('aria-selected', 'true');
    expect(getDay(container, '2026-11-05')).toHaveAttribute('aria-selected', 'false');
  });

  it('uncontrolled: clicking a day selects it and fires onChange with ISO date', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Calendar defaultValue="2026-11-04" onChange={onChange} />);
    await user.click(getDay(container, '2026-11-12'));
    expect(onChange).toHaveBeenCalledWith('2026-11-12');
    expect(getDay(container, '2026-11-12')).toHaveAttribute('aria-selected', 'true');
    expect(getDay(container, '2026-11-04')).toHaveAttribute('aria-selected', 'false');
    await user.click(getDay(container, '2026-11-20'));
    expect(onChange).toHaveBeenCalledWith('2026-11-20');
    expect(getDay(container, '2026-11-20')).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a day focuses its cell so arrow navigation continues from it', async () => {
    const user = userEvent.setup();
    const { container } = render(<Calendar defaultValue="2026-11-04" />);

    await user.click(getDay(container, '2026-11-04'));
    expect(getDay(container, '2026-11-04')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(getDay(container, '2026-11-05')).toHaveFocus();

    await user.click(getDay(container, '2026-12-01'));
    expect(getDay(container, '2026-12-01')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(getDay(container, '2026-12-02')).toHaveFocus();
  });

  it('controlled: selection follows value prop only', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Calendar value="2026-11-04" onChange={onChange} />
    );
    await user.click(getDay(container, '2026-11-12'));
    expect(onChange).toHaveBeenCalledWith('2026-11-12');
    // 受控：外部不更新 value 时选中日保持不变
    expect(getDay(container, '2026-11-04')).toHaveAttribute('aria-selected', 'true');
    expect(getDay(container, '2026-11-12')).toHaveAttribute('aria-selected', 'false');
    rerender(<Calendar value="2026-11-12" onChange={onChange} />);
    expect(getDay(container, '2026-11-12')).toHaveAttribute('aria-selected', 'true');
  });

  it('highlights today with data-today and aria-current="date"', () => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const { container } = render(<Calendar />);
    const today = getDay(container, todayISO);
    expect(today).toHaveAttribute('data-today', '');
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('aria-selected', 'false');
  });

  it('month navigation buttons move the view', async () => {
    const user = userEvent.setup();
    const { container } = render(<Calendar defaultValue="2026-11-04" />);
    await user.click(screen.getByRole('button', { name: '下一月' }));
    expect(screen.getByText('2026年12月')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '上一月' }));
    await user.click(screen.getByRole('button', { name: '上一月' }));
    expect(screen.getByText('2026年10月')).toBeInTheDocument();
    // 视图切换后网格日期随月份更新
    expect(getDay(container, '2026-10-01')).toHaveAttribute('aria-selected', 'false');
  });

  it('keyboard: roving tabindex, arrows move focus, Enter selects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Calendar defaultValue="2026-11-04" onChange={onChange} />
    );
    const day = getDay(container, '2026-11-04');
    expect(day).toHaveAttribute('tabindex', '0');
    expect(getDay(container, '2026-11-05')).toHaveAttribute('tabindex', '-1');

    day.focus();
    expect(day).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(getDay(container, '2026-11-05')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(getDay(container, '2026-11-12')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-11-12');
    expect(getDay(container, '2026-11-12')).toHaveAttribute('aria-selected', 'true');
  });

  it('keyboard: Home/End jump to month edges, week wraps at boundaries', async () => {
    const user = userEvent.setup();
    const { container } = render(<Calendar defaultValue="2026-11-15" />);
    const day = getDay(container, '2026-11-15');
    day.focus();
    await user.keyboard('{Home}');
    expect(getDay(container, '2026-11-01')).toHaveFocus();
    await user.keyboard('{End}');
    expect(getDay(container, '2026-11-30')).toHaveFocus();

    // 周循环：周一 ← 到本周日、周日 → 到本周一
    const monday = getDay(container, '2026-11-02');
    monday.focus();
    await user.keyboard('{ArrowLeft}');
    expect(getDay(container, '2026-11-08')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(getDay(container, '2026-11-02')).toHaveFocus();
  });

  it('keyboard: PageUp/PageDown switch month view', async () => {
    const user = userEvent.setup();
    const { container } = render(<Calendar defaultValue="2026-11-04" />);
    const day = getDay(container, '2026-11-04');
    day.focus();
    await user.keyboard('{PageUp}');
    expect(screen.getByText('2026年10月')).toBeInTheDocument();
    expect(getDay(container, '2026-10-04')).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(screen.getByText('2026年11月')).toBeInTheDocument();
  });

  it('passes className and classNames to parts with data-part anchors', () => {
    const { container } = render(
      <Calendar
        defaultValue="2026-11-04"
        className="my-root"
        classNames={{
          root: 'cls-root',
          header: 'cls-header',
          grid: 'cls-grid',
          day: 'cls-day',
          label: 'cls-label',
          nav: 'cls-nav',
          week: 'cls-week',
          weekday: 'cls-weekday',
        }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-calendar', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="header"]')).toHaveClass('z-calendar-header', 'cls-header');
    expect(root.querySelector('[data-part="label"]')).toHaveClass('z-calendar-label', 'cls-label');
    expect(root.querySelector('[data-part="grid"]')).toHaveClass('z-calendar-grid', 'cls-grid');
    expect(root.querySelector('[data-part="nav"]')).toHaveClass('z-calendar-nav', 'cls-nav');
    expect(root.querySelector('[data-part="week"]')).toHaveClass('z-calendar-week', 'cls-week');
    expect(root.querySelector('[data-part="weekday"]')).toHaveClass('z-calendar-weekday', 'cls-weekday');
    expect(root.querySelector('[data-part="day"]')).toHaveClass('z-calendar-day', 'cls-day');
  });

  it('fullscreen=false collapses to content width via data-fullscreen', () => {
    const { container, rerender } = render(<Calendar defaultValue="2026-11-04" fullscreen={false} />);
    expect(getRoot(container)).toHaveAttribute('data-fullscreen', 'false');
    rerender(<Calendar defaultValue="2026-11-04" fullscreen />);
    expect(getRoot(container)).toHaveAttribute('data-fullscreen', 'true');
  });

  it('forwards ref and native props to the root element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Calendar
        ref={ref}
        defaultValue="2026-11-04"
        id="my-cal"
        data-testid="cal"
        aria-label="月历"
      />
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    const root = screen.getByTestId('cal');
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute('id', 'my-cal');
    expect(root).toHaveAttribute('aria-label', '月历');
  });
});
