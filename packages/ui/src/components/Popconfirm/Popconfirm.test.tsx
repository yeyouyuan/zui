import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popconfirm } from './index';

afterEach(cleanup);

function getTrigger() {
  return screen.getByRole('button', { name: '删除' });
}

function renderPopconfirm(props: Partial<React.ComponentProps<typeof Popconfirm>> = {}) {
  return render(
    <Popconfirm title="确认删除？" {...props}>
      <button type="button">删除</button>
    </Popconfirm>
  );
}

describe('Popconfirm 渲染', () => {
  it('默认渲染触发器，不显示面板', () => {
    renderPopconfirm();
    expect(getTrigger()).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-popconfirm');
    expect(root).toHaveAttribute('data-open', 'false');
  });

  it('点击触发器打开面板：role=dialog + 标题关联', async () => {
    const user = userEvent.setup();
    renderPopconfirm({ description: '删除后不可恢复' });
    await user.click(getTrigger());
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(dialog).toHaveTextContent('确认删除？');
    expect(dialog).toHaveTextContent('删除后不可恢复');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('默认按钮文案 确定/取消，可覆盖', async () => {
    const user = userEvent.setup();
    renderPopconfirm({ okText: 'YES', cancelText: 'NO' });
    await user.click(getTrigger());
    expect(screen.getByRole('button', { name: 'YES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NO' })).toBeInTheDocument();
  });
});

describe('Popconfirm 交互', () => {
  it('点击确定触发 onConfirm 并关闭', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderPopconfirm({ onConfirm });
    await user.click(getTrigger());
    await user.click(screen.getByRole('button', { name: '确定' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击取消触发 onCancel 并关闭', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderPopconfirm({ onCancel });
    await user.click(getTrigger());
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc 关闭并归还焦点到触发器', async () => {
    const user = userEvent.setup();
    renderPopconfirm();
    await user.click(getTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTrigger()).toHaveFocus();
  });

  it('再次点击触发器切换关闭', async () => {
    const user = userEvent.setup();
    renderPopconfirm();
    await user.click(getTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(getTrigger());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击外部关闭面板', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popconfirm title="确认删除？">
          <button type="button">删除</button>
        </Popconfirm>
        <button type="button">外部</button>
      </div>
    );
    await user.click(getTrigger());
    await user.click(screen.getByRole('button', { name: '外部' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('打开时焦点移入确定按钮', async () => {
    const user = userEvent.setup();
    renderPopconfirm();
    await user.click(getTrigger());
    expect(screen.getByRole('button', { name: '确定' })).toHaveFocus();
  });

  it('打开后 Tab 与 Shift+Tab 在弹层按钮间循环，不逃到背景', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popconfirm title="确认删除？">
          <button type="button">删除</button>
        </Popconfirm>
        <button type="button">背景按钮</button>
      </div>
    );
    await user.click(getTrigger());

    const ok = screen.getByRole('button', { name: '确定' });
    const cancel = screen.getByRole('button', { name: '取消' });
    const background = screen.getByRole('button', { name: '背景按钮' });
    expect(ok).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();
    expect(background).not.toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.tab({ shift: true });
    expect(ok).toHaveFocus();
    expect(background).not.toHaveFocus();
  });
});

describe('Popconfirm 定制', () => {
  it('classNames / className 透传，data-part 齐全', async () => {
    const user = userEvent.setup();
    renderPopconfirm({
      description: 'd',
      className: 'page-pop',
      classNames: { root: 'my-root', content: 'my-content', actions: 'my-actions' },
    });
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-popconfirm', 'my-root', 'page-pop');
    await user.click(getTrigger());
    expect(document.querySelector('[data-part="content"]')).toHaveClass('my-content');
    expect(document.querySelector('[data-part="actions"]')).toHaveClass('my-actions');
    expect(document.querySelector('[data-part="title"]')).toBeInTheDocument();
    expect(document.querySelector('[data-part="ok"]')).toBeInTheDocument();
    expect(document.querySelector('[data-part="cancel"]')).toBeInTheDocument();
  });
});
