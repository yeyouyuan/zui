import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { useApp, type AppApi } from './useApp';
import { Select } from '../Select';
import { Modal } from '../Modal';

afterEach(cleanup);

let api: AppApi;

function Harness() {
  api = useApp();
  return <div>内容</div>;
}

describe('App hooks 契约', () => {
  it('useApp 在 App 外抛明确错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useApp();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/useApp must be used within App/);
    spy.mockRestore();
  });

  it('useApp 同时提供 message / notification / modal 三个 API', () => {
    render(
      <App>
        <Harness />
      </App>
    );
    expect(api.message).toBeDefined();
    expect(api.notification).toBeDefined();
    expect(api.modal).toBeDefined();
    expect(typeof api.message.success).toBe('function');
    expect(typeof api.notification.success).toBe('function');
    expect(typeof api.modal.confirm).toBe('function');
  });
});

describe('App 组合 Message / Notification', () => {
  it('api.message 经 App 调用生效（MessageProvider 感知）', () => {
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.message.success('消息成功');
    });
    expect(screen.getByText('消息成功')).toBeInTheDocument();
  });

  it('api.notification 经 App 调用生效（NotificationProvider 感知）', () => {
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.notification.error({ title: '出错了', duration: 0 });
    });
    expect(screen.getByText('出错了')).toBeInTheDocument();
    expect(screen.getByText('出错了').closest('[data-part="item"]')).toHaveAttribute(
      'data-variant',
      'error'
    );
  });
});

describe('App 内置确认框', () => {
  it('traps Tab focus, locks scrolling, and restores focus on close', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement;
      },
    });
    const user = userEvent.setup();
    const overflow = document.body.style.overflow;
    try {
      render(
        <App>
          <Harness />
          <button onClick={() => api.modal.confirm({ title: '焦点测试' })}>打开确认</button>
        </App>
      );
      const trigger = screen.getByRole('button', { name: '打开确认' });
      await user.click(trigger);
      const ok = screen.getByRole('button', { name: '确定' });
      const cancel = screen.getByRole('button', { name: '取消' });
      await waitFor(() => expect(ok).toHaveFocus());
      expect(document.body.style.overflow).toBe('hidden');
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(ok).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).toBe(overflow);
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'offsetParent', descriptor);
    }
  });

  it('modal.confirm 弹出 role=dialog，确定触发 onConfirm 并关闭', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({ title: '确认提交？', content: '提交后不可撤回', onConfirm });
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('确认提交？');
    expect(dialog).toHaveTextContent('提交后不可撤回');
    await user.click(screen.getByRole('button', { name: '确定' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('取消按钮触发 onCancel 并关闭', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({ title: 'T', onCancel });
    });
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc 关闭并触发 onCancel；modal.close 直接关闭', () => {
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({ title: 'T' });
    });
    const dialog = screen.getByRole('dialog');
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      api.modal.confirm({ title: 'T2' });
    });
    act(() => {
      api.modal.close();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc 先关闭确认框内容中的选择面板，再关闭确认框', async () => {
    const user = userEvent.setup();
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({
        title: '选择项目',
        content: <Select options={[{ value: 'a', label: '项目 A' }]} />,
      });
    });
    const trigger = screen.getByRole('button', { name: '请选择' });
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('listbox')).toHaveAttribute('data-open', 'false');
    expect(screen.getByRole('dialog', { name: '选择项目' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('确认框内容中的嵌套 Modal 先响应 Esc', async () => {
    const user = userEvent.setup();
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({
        title: '外层确认框',
        content: (
          <Modal defaultOpen>
            <Modal.Content>
              <Modal.Title>内层弹窗</Modal.Title>
            </Modal.Content>
          </Modal>
        ),
      });
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: '外层确认框' })).toBeInTheDocument();
  });

  it('自定义 okText/cancelText', () => {
    render(
      <App>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({ title: 'T', okText: 'YES', cancelText: 'NO' });
    });
    expect(screen.getByRole('button', { name: 'YES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NO' })).toBeInTheDocument();
  });
});

describe('App 定制', () => {
  it('className / classNames.root 应用到 z-app 根', () => {
    render(
      <App className="page-app" classNames={{ root: 'my-root' }}>
        <Harness />
      </App>
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-app', 'my-root', 'page-app');
    expect(root).toHaveTextContent('内容');
  });

  it('classNames.modal 应用到确认框', () => {
    render(
      <App classNames={{ modal: 'my-modal' }}>
        <Harness />
      </App>
    );
    act(() => {
      api.modal.confirm({ title: 'T' });
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('z-app-modal', 'my-modal');
    expect(document.querySelector('[data-part="modal-title"]')).toHaveTextContent('T');
    expect(document.querySelector('[data-part="modal-actions"]')).toBeInTheDocument();
  });
});
