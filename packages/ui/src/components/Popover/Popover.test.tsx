import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from './index';
import { Modal } from '../Modal';

afterEach(cleanup);

// jsdom 无布局：offsetParent 恒为 null，会被 getFocusableElements 误判为不可见。
// 这里以 parentElement 模拟布局，令焦点管理逻辑（初始聚焦/Tab 循环）可被验证。
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

type TestPopoverProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'bottom' | 'top';
  classNames?: { content?: string };
  withoutFocusable?: boolean;
};

function TestPopover(props: TestPopoverProps) {
  return (
    <Popover open={props.open} defaultOpen={props.defaultOpen} onOpenChange={props.onOpenChange}>
      <Popover.Trigger data-testid="trigger">打开</Popover.Trigger>
      <Popover.Content align={props.align} side={props.side} classNames={props.classNames}>
        {props.withoutFocusable ? (
          <p>纯文本内容</p>
        ) : (
          <>
            <input data-testid="content-input" />
            <button data-testid="content-button">确定</button>
          </>
        )}
      </Popover.Content>
    </Popover>
  );
}

describe('Popover 开关', () => {
  it('初始渲染 trigger（aria-haspopup/aria-expanded），不渲染 content', () => {
    render(<TestPopover />);
    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('data-part', 'trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击触发器 toggle 打开（aria-expanded / aria-controls / data-state）', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);

    const content = screen.getByRole('dialog');
    expect(content).toHaveAttribute('data-part', 'content');
    expect(content).toHaveAttribute('data-state', 'open');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', content.id);
    expect(content.id).toBeTruthy();
  });

  it('再次点击触发器关闭', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);

    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('defaultOpen 初始渲染 content', () => {
    render(<TestPopover defaultOpen />);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open');
  });

  it('受控 open=false：点击只回调，不自行打开', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestPopover open={false} onOpenChange={onOpenChange} />);

    await user.click(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('受控 open=true：展示跟随 props', () => {
    const onOpenChange = vi.fn();
    render(<TestPopover open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('关闭后 content 卸载（退场结束后）', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);

    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open');
    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Popover 关闭方式', () => {
  it('Esc 在 Modal 内只关闭 Popover', async () => {
    const user = userEvent.setup();
    render(<Modal defaultOpen><Modal.Content style={{ position: 'relative', zIndex: 400 }}>
      <Modal.Title>弹窗标题</Modal.Title>
      <Popover><Popover.Trigger>打开详情</Popover.Trigger>
        <Popover.Content><button>确认</button></Popover.Content></Popover>
    </Modal.Content></Modal>);
    await user.click(screen.getByRole('button', { name: '打开详情' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: '弹窗标题' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '' }).style.zIndex).toBe('401');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '弹窗标题' })).toHaveAttribute('data-state', 'open');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog')).toHaveClass('z-modal');
  });
  it('Esc 关闭并回调 onOpenChange(false)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestPopover defaultOpen onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('点击外部关闭（useOnClickOutside）', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <TestPopover defaultOpen />
        <button data-testid="outside">外部</button>
      </div>
    );

    await user.click(screen.getByTestId('outside'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('点击 content 内部不关闭', async () => {
    const user = userEvent.setup();
    render(<TestPopover defaultOpen />);

    await user.click(screen.getByTestId('content-button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Popover 焦点管理', () => {
  it('打开后焦点进入 content 首个可聚焦元素', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => expect(screen.getByTestId('content-input')).toHaveFocus());
  });

  it('优先聚焦 [data-autofocus] 元素', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger data-testid="trigger">打开</Popover.Trigger>
        <Popover.Content>
          <input data-testid="first" />
          <button data-testid="auto" data-autofocus>
            自动聚焦
          </button>
        </Popover.Content>
      </Popover>
    );
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => expect(screen.getByTestId('auto')).toHaveFocus());
  });

  it('无可聚焦元素时聚焦 content 本体', async () => {
    const user = userEvent.setup();
    render(<TestPopover withoutFocusable />);
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  });

  it('Esc 关闭后焦点归还触发器', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);
    await waitFor(() => expect(screen.getByTestId('content-input')).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('点击外部关闭后不再持有焦点陷阱（焦点可移出）', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <TestPopover />
        <button data-testid="outside">外部</button>
      </div>
    );
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);
    await waitFor(() => expect(screen.getByTestId('content-input')).toHaveFocus());

    await user.click(screen.getByTestId('outside'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // 点击落点为外部按钮，焦点跟随用户点击（不强行拉回）
    expect(screen.getByTestId('outside')).toHaveFocus();
  });

  it('Tab 循环不逃出 content', async () => {
    const user = userEvent.setup();
    render(<TestPopover />);
    await user.click(screen.getByTestId('trigger'));

    const input = screen.getByTestId('content-input');
    const button = screen.getByTestId('content-button');
    await waitFor(() => expect(input).toHaveFocus());

    await user.tab();
    expect(button).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(button).toHaveFocus();
  });
});

describe('Popover.Trigger asChild 与定制出口', () => {
  it('asChild 克隆子元素并透传 toggle 与 aria 状态', async () => {
    const user = userEvent.setup();
    const childOnClick = vi.fn();
    render(
      <Popover>
        <Popover.Trigger asChild>
          <button data-testid="clone-trigger" onClick={childOnClick}>
            打开
          </button>
        </Popover.Trigger>
        <Popover.Content>内容</Popover.Content>
      </Popover>
    );
    const trigger = screen.getByTestId('clone-trigger');

    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(childOnClick).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(childOnClick).toHaveBeenCalledTimes(2);
  });

  it('align / side 写入 data 属性', async () => {
    const user = userEvent.setup();
    render(<TestPopover align="end" side="top" />);
    await user.click(screen.getByTestId('trigger'));

    const content = screen.getByRole('dialog');
    expect(content).toHaveAttribute('data-align', 'end');
    expect(content).toHaveAttribute('data-side', 'top');
  });

  it('classNames / className 透传到 content，root 带 data-part', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Popover>
        <Popover.Trigger data-testid="trigger">打开</Popover.Trigger>
        <Popover.Content className="my-popover" classNames={{ content: 'slot-content' }}>
          内容
        </Popover.Content>
      </Popover>
    );
    await user.click(screen.getByTestId('trigger'));

    const content = screen.getByRole('dialog');
    expect(content).toHaveClass('z-popover', 'my-popover', 'slot-content');

    const root = container.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-popover-root');
  });
});
