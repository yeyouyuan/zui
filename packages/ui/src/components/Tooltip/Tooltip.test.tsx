import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from './index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function getTrigger(): HTMLButtonElement {
  return screen.getByRole('button');
}

describe('Tooltip 渲染与显隐', () => {
  it('初始不渲染 tooltip，hover 延迟 200ms 后显示', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="提示内容">
        <button>触发器</button>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseOver(getTrigger());
    // 延迟未到：不显示
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('提示内容');
    expect(tooltip).toHaveAttribute('data-part', 'content');
    expect(tooltip).toHaveAttribute('data-placement', 'top');
  });

  it('delay=0 时 hover 立即显示', () => {
    render(
      <Tooltip content="即时提示" delay={0}>
        <button>触发器</button>
      </Tooltip>
    );

    fireEvent.mouseOver(getTrigger());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('离开触发器立即隐藏，并取消未触发的延迟显示', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="提示内容">
        <button>触发器</button>
      </Tooltip>
    );
    const trigger = getTrigger();

    // 延迟中离开：不应出现
    fireEvent.mouseOver(trigger);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.mouseOut(trigger);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // 显示后离开：立即隐藏
    fireEvent.mouseOver(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseOut(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('focus 立即显示（不受 delay 影响），blur 隐藏', () => {
    render(
      <Tooltip content="提示内容" delay={300}>
        <button>触发器</button>
      </Tooltip>
    );
    const trigger = getTrigger();

    act(() => {
      trigger.focus();
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => {
      trigger.blur();
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('Esc 隐藏 tooltip（文档级 keydown）', () => {
    render(
      <Tooltip content="提示内容" delay={0}>
        <button>触发器</button>
      </Tooltip>
    );

    fireEvent.mouseOver(getTrigger());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('disabled 时 hover/focus 均不显示', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="提示内容" disabled>
        <button>触发器</button>
      </Tooltip>
    );
    const trigger = getTrigger();

    fireEvent.mouseOver(trigger);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      trigger.focus();
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('Tooltip ARIA 关联', () => {
  it('显示时通过 aria-describedby 关联 tooltip id，隐藏后解除', () => {
    render(
      <Tooltip content="提示内容" delay={0}>
        <button>触发器</button>
      </Tooltip>
    );
    const trigger = getTrigger();

    expect(trigger).not.toHaveAttribute('aria-describedby');

    fireEvent.mouseOver(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.id).toBeTruthy();
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.mouseOut(trigger);
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('保留触发器原有 aria-describedby 并追加 tooltip id', () => {
    render(
      <Tooltip content="提示内容" delay={0}>
        <button aria-describedby="origin-desc">触发器</button>
      </Tooltip>
    );
    const trigger = getTrigger();

    fireEvent.mouseOver(trigger);
    const tooltip = screen.getByRole('tooltip');
    const describedBy = trigger.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toContain('origin-desc');
    expect(describedBy.split(' ')).toContain(tooltip.id);

    fireEvent.mouseOut(trigger);
    expect(trigger).toHaveAttribute('aria-describedby', 'origin-desc');
  });

  it('链式调用触发器原有的 onMouseEnter / onFocus', () => {
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    render(
      <Tooltip content="提示内容" delay={0}>
        <button onMouseEnter={onMouseEnter} onFocus={onFocus}>
          触发器
        </button>
      </Tooltip>
    );
    const trigger = getTrigger();

    fireEvent.mouseOver(trigger);
    act(() => {
      trigger.focus();
    });

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});

describe('Tooltip 定制出口', () => {
  it('placement 写入 data-placement', () => {
    const placements = ['top', 'bottom', 'left', 'right'] as const;
    for (const placement of placements) {
      const { unmount } = render(
        <Tooltip content="提示" delay={0} placement={placement}>
          <button>触发器</button>
        </Tooltip>
      );
      fireEvent.mouseOver(getTrigger());
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-placement', placement);
      unmount();
    }
  });

  it('className / classNames / data-part 透传', () => {
    render(
      <Tooltip
        content="提示"
        delay={0}
        className="my-tooltip-root"
        classNames={{ root: 'slot-root', content: 'slot-content' }}
      >
        <button>触发器</button>
      </Tooltip>
    );

    const root = screen.getByRole('button').parentElement as HTMLElement;
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveClass('z-tooltip-root', 'my-tooltip-root', 'slot-root');

    fireEvent.mouseOver(getTrigger());
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('z-tooltip', 'slot-content');
  });
});
