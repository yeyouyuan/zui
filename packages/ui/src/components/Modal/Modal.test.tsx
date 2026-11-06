import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './index';
import { ColorPicker } from '../ColorPicker';
import { Drawer } from '../Drawer';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

// jsdom 无布局：offsetParent 恒为 null，会被 getFocusableElements 误判为不可见。
// 这里以 parentElement 模拟布局，令焦点管理逻辑（初始聚焦/Tab 循环）可被验证。
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

type TestModalProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  classNames?: { overlay?: string; content?: string };
  autofocus?: 'input' | 'footer';
  withoutDescription?: boolean;
};

function TestModal(props: TestModalProps) {
  return (
    <Modal open={props.open} defaultOpen={props.defaultOpen} onOpenChange={props.onOpenChange}>
      <Modal.Trigger data-testid="trigger">打开弹窗</Modal.Trigger>
      <Modal.Content
        size={props.size}
        closeOnOverlay={props.closeOnOverlay}
        closeOnEsc={props.closeOnEsc}
        classNames={props.classNames}
      >
        <Modal.Header>
          <Modal.Title>弹窗标题</Modal.Title>
          {props.withoutDescription ? null : <Modal.Description>弹窗描述</Modal.Description>}
        </Modal.Header>
        <Modal.Body>
          <input
            data-testid="body-input"
            data-autofocus={props.autofocus === 'input' ? '' : undefined}
          />
          <button data-testid="body-button">内容按钮</button>
        </Modal.Body>
        <Modal.Footer>
          <button
            data-testid="footer-button"
            data-autofocus={props.autofocus === 'footer' ? '' : undefined}
          >
            确定
          </button>
          <Modal.Close data-testid="close">关闭弹窗</Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

describe('Modal 开关', () => {
  it('Esc 先关闭浮层，再关闭对话框', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <ColorPicker />
        </Modal.Content>
      </Modal>
    );
    const trigger = screen.getByRole('button', { name: '颜色选择器' });
    await user.click(trigger);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(trigger).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('嵌套 Modal 的 Esc 每次只关闭最内层', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <Modal.Title>外层</Modal.Title>
          <Modal defaultOpen>
            <Modal.Content>
              <Modal.Title>内层</Modal.Title>
            </Modal.Content>
          </Modal>
        </Modal.Content>
      </Modal>
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: '外层' })).toBeInTheDocument();
  });
  it('Modal 中的 Drawer 先响应 Esc', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <Modal.Title>外层弹窗</Modal.Title>
          <button>外层操作</button>
          <Drawer defaultOpen>
            <Drawer.Content>
              <Drawer.Title>内层抽屉</Drawer.Title>
            </Drawer.Content>
          </Drawer>
        </Modal.Content>
      </Modal>
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    screen.getByRole('button', { name: '外层操作' }).focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: '外层弹窗' })).toBeInTheDocument();
  });
  it('关闭最内层后把焦点归还给仍打开的外层', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <Modal.Title>外层</Modal.Title>
          <button>外层按钮</button>
          <Modal defaultOpen>
            <Modal.Content>
              <Modal.Title>内层</Modal.Title>
              <button>内层按钮</button>
            </Modal.Content>
          </Modal>
        </Modal.Content>
      </Modal>
    );
    screen.getByRole('button', { name: '内层按钮' }).focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: '外层' }).contains(document.activeElement)).toBe(
      true
    );
  });
  it('Trigger 打开出现 dialog（role/aria-modal）', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('trigger'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('Trigger 再次点击关闭（开关切换）', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('defaultOpen 初始渲染 dialog', () => {
    render(<TestModal defaultOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('受控 open：变更只回调，展示跟随 props', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<TestModal open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // 受控未跟随
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<TestModal open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('打开时渲染、关闭后卸载', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    // 关闭后先 data-state="closed" 退场动画，随后卸载
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Modal 关闭方式', () => {
  it('Esc 关闭并回调 onOpenChange(false)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closeOnEsc=false 时 Esc 不关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen closeOnEsc={false} onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('overlay 点击关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen onOpenChange={onOpenChange} />);
    const overlay = document.querySelector('[data-part="overlay"]') as HTMLElement;

    await user.click(overlay);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closeOnOverlay=false 时点遮罩不关', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen closeOnOverlay={false} onOpenChange={onOpenChange} />);
    const overlay = document.querySelector('[data-part="overlay"]') as HTMLElement;

    await user.click(overlay);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('点击 dialog 内部空白不关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole('dialog');

    await user.click(dialog);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Close 按钮关闭', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TestModal defaultOpen onOpenChange={onOpenChange} />);
    const close = screen.getByRole('button', { name: '关闭弹窗' });

    await user.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Close 有可见文字时以文字作为无障碍名称', () => {
    render(<TestModal defaultOpen />);
    const close = screen.getByRole('button', { name: '关闭弹窗' });
    expect(close).toHaveTextContent('关闭弹窗');
    expect(close).toHaveAttribute('data-has-label');
    expect(close).not.toHaveAttribute('aria-label');
  });

  it('Close 无文字时使用本地化关闭标签', () => {
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <Modal.Close />
        </Modal.Content>
      </Modal>
    );
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).not.toHaveAttribute('data-has-label');
  });
});

describe('Modal 焦点管理', () => {
  it('打开后焦点进入 dialog 内', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('优先聚焦 [data-autofocus] 元素', async () => {
    const user = userEvent.setup();
    render(<TestModal autofocus="footer" />);
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => expect(screen.getByTestId('footer-button')).toHaveFocus());
  });

  it('无 [data-autofocus] 时聚焦首个可聚焦元素', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => expect(screen.getByTestId('body-input')).toHaveFocus());
  });

  it('无可聚焦元素时聚焦 dialog 本体', async () => {
    render(
      <Modal defaultOpen>
        <Modal.Trigger data-testid="trigger">打开</Modal.Trigger>
        <Modal.Content>
          <Modal.Body>纯文本内容</Modal.Body>
        </Modal.Content>
      </Modal>
    );

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  });

  it('Tab 循环不逃出 dialog', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Trigger data-testid="trigger">打开</Modal.Trigger>
        <Modal.Content>
          <button data-testid="first">第一个</button>
          <button data-testid="last">最后一个</button>
        </Modal.Content>
      </Modal>
    );
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');

    // 等初始聚焦落定后从末位开始循环
    await waitFor(() => expect(first).toHaveFocus());
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    expect(last).not.toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    expect(first).not.toHaveFocus();
  });

  it('关闭后焦点归还 Trigger', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    const trigger = screen.getByTestId('trigger');

    await user.click(trigger);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe('Modal ARIA 关联', () => {
  it('Title/Description 自动关联 aria-labelledby/aria-describedby', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByTestId('trigger'));

    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('弹窗标题');
    const description = screen.getByText('弹窗描述');

    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
    expect(dialog).toHaveAttribute('aria-describedby', description.id);
    expect(title.id).toBeTruthy();
    expect(description.id).toBeTruthy();
  });

  it('无 Title/Description 时不产生悬空 aria 引用', async () => {
    render(
      <Modal defaultOpen>
        <Modal.Trigger data-testid="trigger">打开</Modal.Trigger>
        <Modal.Content>
          <Modal.Body>没有标题和描述</Modal.Body>
        </Modal.Content>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });
});

describe('Modal 滚动锁', () => {
  it('打开锁定 body 滚动，关闭恢复', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    expect(document.body.style.overflow).not.toBe('hidden');

    await user.click(screen.getByTestId('trigger'));
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('Modal 透传与定制出口', () => {
  it('data-part / classNames / size / className 透传', async () => {
    render(
      <TestModal
        defaultOpen
        size="lg"
        classNames={{ overlay: 'c-overlay', content: 'c-content' }}
      />
    );

    const overlay = document.querySelector('[data-part="overlay"]');
    expect(overlay).toHaveClass('z-modal-overlay', 'c-overlay');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-part', 'content');
    expect(dialog).toHaveAttribute('data-size', 'lg');
    expect(dialog).toHaveClass('z-modal', 'c-content');

    expect(screen.getByText('弹窗标题')).toHaveAttribute('data-part', 'title');
    expect(screen.getByText('弹窗描述')).toHaveAttribute('data-part', 'description');

    const header = document.querySelector('[data-part="header"]');
    expect(header).toHaveClass('z-modal-header');
    const body = document.querySelector('[data-part="body"]');
    expect(body).toHaveClass('z-modal-body');
    const footer = document.querySelector('[data-part="footer"]');
    expect(footer).toHaveClass('z-modal-footer');
    const close = document.querySelector('[data-part="close"]');
    expect(close).toHaveClass('z-modal-close');
  });

  it('Trigger 透传 props 与 className', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Trigger data-testid="trigger" className="c-trigger" data-foo="bar">
          打开
        </Modal.Trigger>
        <Modal.Content>
          <Modal.Body>内容</Modal.Body>
        </Modal.Content>
      </Modal>
    );

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-part', 'trigger');
    expect(trigger).toHaveAttribute('data-foo', 'bar');
    expect(trigger).toHaveClass('z-modal-trigger', 'c-trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    // 触发器仍可切换
    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('data-state 标记进出场状态', async () => {
    const user = userEvent.setup();
    render(<TestModal />);
    await user.click(screen.getByTestId('trigger'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'open');
    const overlay = document.querySelector('[data-part="overlay"]');
    expect(overlay).toHaveAttribute('data-state', 'open');

    // 关闭后退场期间 data-state="closed"，随后卸载
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
