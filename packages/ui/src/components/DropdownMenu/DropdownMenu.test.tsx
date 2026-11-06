import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu } from './index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type TestMenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectNew?: () => void;
  onSelectDelete?: () => void;
};

function TestMenu(props: TestMenuProps) {
  return (
    <DropdownMenu open={props.open} defaultOpen={props.defaultOpen} onOpenChange={props.onOpenChange}>
      <DropdownMenu.Trigger data-testid="trigger">操作</DropdownMenu.Trigger>
      <DropdownMenu.Content data-testid="content">
        <DropdownMenu.Label data-testid="label">文件</DropdownMenu.Label>
        <DropdownMenu.Item data-testid="item-new" onSelect={props.onSelectNew}>
          新建
        </DropdownMenu.Item>
        <DropdownMenu.Item data-testid="item-open" disabled>
          打开
        </DropdownMenu.Item>
        <DropdownMenu.Item data-testid="item-save">保存</DropdownMenu.Item>
        <DropdownMenu.Separator data-testid="separator" />
        <DropdownMenu.Item data-testid="item-delete" danger onSelect={props.onSelectDelete}>
          删除
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function openMenu() {
  return userEvent.setup().click(screen.getByTestId('trigger'));
}

function getContent(): HTMLElement {
  return screen.getByTestId('content');
}

describe('DropdownMenu 渲染与结构', () => {
  it('初始渲染 trigger（aria-haspopup="menu"/aria-expanded=false），菜单未挂载', () => {
    render(<TestMenu />);
    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('data-part', 'trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('打开后渲染 role=menu，trigger aria-expanded/aria-controls 关联', async () => {
    render(<TestMenu />);
    await openMenu();

    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-part', 'content');
    expect(menu).toHaveAttribute('id');
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', menu.id);
  });

  it('menuitem / separator / label 结构与 ARIA', async () => {
    render(<TestMenu />);
    await openMenu();

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(screen.getByRole('separator')).toHaveAttribute('data-part', 'separator');
    expect(screen.getByTestId('label')).toHaveClass('z-dropdown-menu-label');
    expect(screen.getByTestId('label')).toHaveAttribute('data-part', 'label');
  });

  it('danger 项 data-danger，disabled 项 aria-disabled', async () => {
    render(<TestMenu />);
    await openMenu();

    expect(screen.getByTestId('item-delete')).toHaveAttribute('data-danger', 'true');
    expect(screen.getByTestId('item-delete')).toHaveClass('z-dropdown-menu-item');
    expect(screen.getByTestId('item-open')).toHaveAttribute('aria-disabled', 'true');
  });

  it('defaultOpen 初始展开菜单', () => {
    render(<TestMenu defaultOpen />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('受控 open=false：点击只回调，不自行打开', async () => {
    const onOpenChange = vi.fn();
    render(<TestMenu open={false} onOpenChange={onOpenChange} />);
    await openMenu();

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('受控 open=true：展示跟随 props', () => {
    const onOpenChange = vi.fn();
    render(<TestMenu open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('DropdownMenu 打开/关闭', () => {
  it('点击触发器 toggle 打开/关闭', async () => {
    render(<TestMenu />);
    await openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await openMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('关闭态 ArrowDown 打开', () => {
    render(<TestMenu />);
    fireEvent.keyDown(screen.getByTestId('trigger'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('关闭态 ArrowUp 打开', () => {
    render(<TestMenu />);
    fireEvent.keyDown(screen.getByTestId('trigger'), { key: 'ArrowUp' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Esc 关闭并焦点归还 Trigger', async () => {
    render(<TestMenu />);
    await openMenu();
    expect(screen.getByTestId('item-new')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('Tab 关闭菜单', async () => {
    render(<TestMenu />);
    await openMenu();

    fireEvent.keyDown(getContent(), { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('点击外部关闭（useOnClickOutside）', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <TestMenu />
        <button data-testid="outside">外部</button>
      </div>
    );
    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('DropdownMenu 键盘导航（APG menu-button）', () => {
  it('打开时焦点进入菜单首项，roving tabindex：首项 0 其余 -1', async () => {
    render(<TestMenu />);
    await openMenu();

    expect(screen.getByTestId('item-new')).toHaveFocus();
    expect(screen.getByTestId('item-new')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('item-open')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('item-save')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('item-delete')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowDown 移动焦点（roving tabindex 跟随），到底回绕到首项', async () => {
    render(<TestMenu />);
    await openMenu();

    fireEvent.keyDown(getContent(), { key: 'ArrowDown' });
    expect(screen.getByTestId('item-save')).toHaveFocus();
    expect(screen.getByTestId('item-save')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('item-new')).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(getContent(), { key: 'ArrowDown' });
    expect(screen.getByTestId('item-delete')).toHaveFocus();

    // 回绕：末项 → 首项
    fireEvent.keyDown(getContent(), { key: 'ArrowDown' });
    expect(screen.getByTestId('item-new')).toHaveFocus();
  });

  it('ArrowUp 移动焦点，到首回绕到末项', async () => {
    render(<TestMenu />);
    await openMenu();

    // 回绕：首项 → 末项
    fireEvent.keyDown(getContent(), { key: 'ArrowUp' });
    expect(screen.getByTestId('item-delete')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'ArrowUp' });
    expect(screen.getByTestId('item-save')).toHaveFocus();
    expect(screen.getByTestId('item-save')).toHaveAttribute('tabindex', '0');
  });

  it('↑↓ 移动跳过 disabled 项', async () => {
    render(<TestMenu />);
    await openMenu();

    // item-open（disabled）在 item-new 与 item-save 之间，双向都要跳过
    fireEvent.keyDown(getContent(), { key: 'ArrowDown' });
    expect(screen.getByTestId('item-save')).toHaveFocus();
    expect(screen.getByTestId('item-open')).not.toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'ArrowUp' });
    expect(screen.getByTestId('item-new')).toHaveFocus();
    expect(screen.getByTestId('item-open')).not.toHaveFocus();
  });

  it('Home/End 跳到首个/末个可用项', async () => {
    render(<TestMenu />);
    await openMenu();

    fireEvent.keyDown(getContent(), { key: 'End' });
    expect(screen.getByTestId('item-delete')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'Home' });
    expect(screen.getByTestId('item-new')).toHaveFocus();
  });

  it('Enter 触发 onSelect，关闭菜单并把焦点归还 Trigger', async () => {
    const onSelectNew = vi.fn();
    render(<TestMenu onSelectNew={onSelectNew} />);
    await openMenu();
    expect(screen.getByTestId('item-new')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('item-new'), { key: 'Enter' });
    expect(onSelectNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('Space 触发 onSelect，关闭菜单并把焦点归还 Trigger', async () => {
    const onSelectDelete = vi.fn();
    render(<TestMenu onSelectDelete={onSelectDelete} />);
    await openMenu();

    fireEvent.keyDown(getContent(), { key: 'End' });
    expect(screen.getByTestId('item-delete')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('item-delete'), { key: ' ' });
    expect(onSelectDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('disabled 项 Enter 不触发 onSelect 也不关闭', async () => {
    const onSelectNew = vi.fn();
    render(<TestMenu onSelectNew={onSelectNew} />);
    await openMenu();

    fireEvent.keyDown(screen.getByTestId('item-open'), { key: 'Enter' });
    expect(onSelectNew).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('DropdownMenu typeahead', () => {
  function TypeaheadMenu({ onPick }: { onPick?: (id: string) => void }) {
    return (
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger data-testid="trigger">操作</DropdownMenu.Trigger>
        <DropdownMenu.Content data-testid="content">
          <DropdownMenu.Item data-testid="t-apple" onSelect={() => onPick?.('apple')}>
            Apple
          </DropdownMenu.Item>
          <DropdownMenu.Item data-testid="t-avocado" onSelect={() => onPick?.('avocado')}>
            Avocado
          </DropdownMenu.Item>
          <DropdownMenu.Item data-testid="t-banana" onSelect={() => onPick?.('banana')}>
            Banana
          </DropdownMenu.Item>
          <DropdownMenu.Item data-testid="t-cherry" onSelect={() => onPick?.('cherry')}>
            Cherry
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  }

  it('首字母 typeahead 快速定位（缓冲期后换首字母直接跳转）', () => {
    vi.useFakeTimers();
    render(<TypeaheadMenu />);
    expect(screen.getByTestId('t-apple')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'b' });
    expect(screen.getByTestId('t-banana')).toHaveFocus();

    // 超过 typeahead 缓冲期（500ms）后，新首字母从头匹配
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.keyDown(getContent(), { key: 'c' });
    expect(screen.getByTestId('t-cherry')).toHaveFocus();
    vi.useRealTimers();
  });

  it('连续输入按前缀匹配', async () => {
    render(<TypeaheadMenu />);
    expect(screen.getByTestId('t-apple')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'a' });
    fireEvent.keyDown(getContent(), { key: 'v' });
    expect(screen.getByTestId('t-avocado')).toHaveFocus();
  });

  it('单字符重复输入循环匹配', async () => {
    render(<TypeaheadMenu />);
    expect(screen.getByTestId('t-apple')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'a' });
    expect(screen.getByTestId('t-apple')).toHaveFocus();

    fireEvent.keyDown(getContent(), { key: 'a' });
    expect(screen.getByTestId('t-avocado')).toHaveFocus();
  });
});

describe('DropdownMenu 指针交互与定制出口', () => {
  it('点击菜单项触发 onSelect，关闭并归还焦点到 Trigger', async () => {
    const user = userEvent.setup();
    const onSelectDelete = vi.fn();
    render(<TestMenu onSelectDelete={onSelectDelete} />);

    await user.click(screen.getByTestId('trigger'));
    await user.click(screen.getByTestId('item-delete'));

    expect(onSelectDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('点击 disabled 项不触发 onSelect 也不关闭', async () => {
    const user = userEvent.setup();
    render(<TestMenu />);

    await user.click(screen.getByTestId('trigger'));
    await user.click(screen.getByTestId('item-open'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    // pointerdown preventDefault：点击 disabled 项不夺焦，焦点仍在首项
    expect(screen.getByTestId('item-new')).toHaveFocus();
  });

  it('菜单项 pointerdown preventDefault 防失焦', async () => {
    render(<TestMenu />);
    await openMenu();

    // fireEvent 返回 false 表示 preventDefault 已被调用
    expect(fireEvent.pointerDown(screen.getByTestId('item-save'))).toBe(false);
  });

  it('classNames / className 透传', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger data-testid="trigger">操作</DropdownMenu.Trigger>
        <DropdownMenu.Content
          data-testid="content"
          className="my-menu"
          classNames={{ content: 'slot-content' }}
        >
          <DropdownMenu.Item
            data-testid="item"
            className="my-item"
            classNames={{ item: 'slot-item', icon: 'slot-icon' }}
            icon={<span>+</span>}
          >
            新建
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
    await user.click(screen.getByTestId('trigger'));

    const content = getContent();
    expect(content).toHaveClass('z-dropdown-menu', 'my-menu', 'slot-content');

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('z-dropdown-menu-item', 'my-item', 'slot-item');
    expect(item.querySelector('[data-part="icon"]')).toHaveClass(
      'z-dropdown-menu-item-icon',
      'slot-icon'
    );
    expect(item).toHaveAttribute('data-part', 'item');
  });
});
