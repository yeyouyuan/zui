import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatButton } from './index';

afterEach(cleanup);

function getTrigger() {
  return screen.getByRole('button', { name: '悬浮操作' });
}

describe('FloatButton 渲染', () => {
  it('默认渲染圆形按钮与 data-part', () => {
    render(<FloatButton />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-float-button');
    expect(root).toHaveAttribute('data-shape', 'circle');
    expect(root).toHaveAttribute('data-type', 'default');
    expect(root).toHaveAttribute('data-open', 'false');
    expect(getTrigger()).toBeInTheDocument();
  });

  it('icon / description / type / shape 渲染', () => {
    render(
      <FloatButton icon={<svg data-testid="icon" />} description="设置" type="primary" shape="square" />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(getTrigger()).toHaveTextContent('设置');
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-type', 'primary');
    expect(root).toHaveAttribute('data-shape', 'square');
  });

  it('点击触发 onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FloatButton onClick={onClick} />);
    await user.click(getTrigger());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('FloatButton 菜单', () => {
  const menu = [
    { icon: <svg data-testid="m1" />, description: '编辑', onClick: vi.fn() },
    { description: '删除', onClick: vi.fn() },
  ];

  it('带 menu 时 trigger 有 aria-haspopup/aria-expanded，点击展开', async () => {
    const user = userEvent.setup();
    render(<FloatButton menu={menu} />);
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-part="menu"]')).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('点击菜单项触发 onClick 并收起', async () => {
    const user = userEvent.setup();
    const itemClick = vi.fn();
    render(<FloatButton menu={[{ description: '操作项', onClick: itemClick }]} />);
    await user.click(getTrigger());
    await user.click(screen.getByRole('menuitem', { name: '操作项' }));
    expect(itemClick).toHaveBeenCalledTimes(1);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc 关闭菜单并归还焦点', async () => {
    const user = userEvent.setup();
    render(<FloatButton menu={menu} />);
    const trigger = getTrigger();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('点击外部关闭菜单', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <FloatButton menu={menu} />
        <button type="button">外部</button>
      </div>
    );
    await user.click(getTrigger());
    await user.click(screen.getByRole('button', { name: '外部' }));
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('hover 触发：鼠标进入展开、离开收起', async () => {
    const user = userEvent.setup();
    render(<FloatButton menu={menu} trigger="hover" />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    await user.hover(root);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    await user.unhover(root);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('hover 模式仍支持键盘和触控点击，菜单语义完整', async () => {
    const user = userEvent.setup();
    render(<FloatButton menu={menu} trigger="hover" />);
    const trigger = getTrigger();
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(menu.length);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('FloatButton 定制', () => {
  it('classNames / className / aria-label 透传', () => {
    render(
      <FloatButton
        className="page-fab"
        aria-label="快捷入口"
        classNames={{ root: 'my-root', menu: 'my-menu', item: 'my-item' }}
        menu={[{ description: 'a' }]}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-float-button', 'my-root', 'page-fab');
    expect(screen.getByRole('button', { name: '快捷入口' })).toBeInTheDocument();
    expect(document.querySelector('[data-part="menu"]')).toHaveClass('my-menu');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('my-item');
  });
});
