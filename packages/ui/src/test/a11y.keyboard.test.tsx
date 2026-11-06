/**
 * a11y.keyboard.test.tsx —— 键盘流抽样（a11y 组）
 *
 * 覆盖 CONTRACTS-V2.md §4 / CONTRACTS.md §2 的键盘一票否决项抽样：
 * Tabs ←→/Home/End、Select Enter/↑↓/Esc、Modal Esc+焦点归还+Tab 陷阱、
 * Checkbox Space、Switch Space/Enter、Message 不吞 Esc。
 * 每个用例走完整「按键 → 状态/焦点」流，而非逐属性点名。
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../components/Checkbox';
import { MessageProvider, useMessage, type MessageApi } from '../components/Message';
import { Modal } from '../components/Modal';
import { Select, type SelectOption } from '../components/Select';
import { Switch } from '../components/Switch';
import { Tabs } from '../components/Tabs';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

// jsdom 无布局：offsetParent 恒为 null，会被 getFocusableElements 误判为不可见。
// 以 parentElement 模拟布局，令 Modal 焦点管理（初始聚焦/Tab 循环/焦点归还）可被验证。
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement;
  },
});

const fruitOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

describe('Tabs 键盘流', () => {
  function BasicTabs() {
    return (
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">Tab One</Tabs.Trigger>
          <Tabs.Trigger value="two">Tab Two</Tabs.Trigger>
          <Tabs.Trigger value="three">Tab Three</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">Panel One</Tabs.Panel>
        <Tabs.Panel value="two">Panel Two</Tabs.Panel>
        <Tabs.Panel value="three">Panel Three</Tabs.Panel>
      </Tabs>
    );
  }

  it('←/→ 环形移动焦点（automatic：焦点即选中）', async () => {
    const user = userEvent.setup();
    render(<BasicTabs />);
    const tabs = screen.getAllByRole('tab');

    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(tabs[2]).toHaveFocus();

    // 末尾再右移环形回首个
    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('Home/End 跳到首尾', async () => {
    const user = userEvent.setup();
    render(<BasicTabs />);
    const tabs = screen.getAllByRole('tab');

    tabs[0].focus();
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Select 键盘流', () => {
  it('Enter 打开 → ↑↓ 移动 active → Esc 关闭且焦点回触发器', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = screen.getByRole('button') as HTMLButtonElement;
    trigger.focus();

    // Enter 打开
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);

    // ↑↓ 移动虚拟活动项（焦点保持在触发器）
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(trigger).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);

    // Esc 关闭并回焦触发器
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('Modal 键盘流', () => {
  it('Esc 关闭且焦点归还 Trigger', async () => {
    const user = userEvent.setup();
    render(
      <Modal>
        <Modal.Trigger>打开弹窗</Modal.Trigger>
        <Modal.Content>
          <Modal.Title>弹窗标题</Modal.Title>
          <Modal.Body>
            <button>内容按钮</button>
          </Modal.Body>
        </Modal.Content>
      </Modal>
    );
    const trigger = screen.getByRole('button', { name: '打开弹窗' });

    await user.click(trigger);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('Tab 陷阱：焦点不出 dialog（正反向循环）', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Trigger>打开</Modal.Trigger>
        <Modal.Content>
          <button data-testid="first">第一个</button>
          <button data-testid="last">最后一个</button>
        </Modal.Content>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');

    // 等初始聚焦落定后从末位开始循环
    await waitFor(() => expect(first).toHaveFocus());
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: '打开' })).not.toHaveFocus();
  });
});

describe('Checkbox 键盘流', () => {
  it('Space 切换选中态（true ↔ false）', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="同意协议" defaultChecked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    box.focus();

    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(box).toBeChecked();

    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(box).not.toBeChecked();
  });
});

describe('Switch 键盘流', () => {
  it('Space / Enter 均可切换 role="switch"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="深色模式" defaultChecked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '深色模式' });
    sw.focus();

    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(sw).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveFocus();
  });
});

describe('Message 键盘流', () => {
  let api: MessageApi;

  function Harness() {
    api = useMessage();
    return null;
  }

  it('不吞 Esc：消息显示时 Esc 不关闭消息，事件照常传播', async () => {
    const user = userEvent.setup();
    render(
      <MessageProvider>
        <Harness />
      </MessageProvider>
    );
    act(() => {
      api.show({ content: '常驻提示', duration: 0 });
    });

    const onKeyDown = vi.fn();
    document.addEventListener('keydown', onKeyDown);
    try {
      await user.keyboard('{Escape}');
      // 事件未被吞掉（document 级监听照常收到）
      expect(onKeyDown).toHaveBeenCalled();
      // 消息未被 Esc 关闭
      expect(screen.getByText('常驻提示')).toBeInTheDocument();
    } finally {
      document.removeEventListener('keydown', onKeyDown);
    }
  });
});
