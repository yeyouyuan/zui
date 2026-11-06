import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

function BasicTabs(props: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  classNames?: { root?: string; list?: string; trigger?: string; panel?: string };
  disabledSecond?: boolean;
}) {
  return (
    <Tabs
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      orientation={props.orientation}
      activationMode={props.activationMode}
      classNames={props.classNames}
    >
      <Tabs.List>
        <Tabs.Trigger value="one">Tab One</Tabs.Trigger>
        <Tabs.Trigger value="two" disabled={props.disabledSecond}>
          Tab Two
        </Tabs.Trigger>
        <Tabs.Trigger value="three">Tab Three</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="one">Panel One</Tabs.Panel>
      <Tabs.Panel value="two">Panel Two</Tabs.Panel>
      <Tabs.Panel value="three">Panel Three</Tabs.Panel>
    </Tabs>
  );
}

/** 仅在单个容器内查询，避免多容器文本歧义 */
function tabsOf(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

function panelByText(container: HTMLElement, text: string): HTMLElement | null {
  const found = Array.from(container.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
    (el) => el.textContent === text
  );
  return found ?? null;
}

describe('Tabs', () => {
  it('默认选中第一个 tab，仅第一个面板渲染', () => {
    const { container } = render(<BasicTabs />);
    const tabs = tabsOf(container);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    expect(panelByText(container, 'Panel One')).not.toBeNull();
    expect(panelByText(container, 'Panel Two')).toBeNull();
    expect(panelByText(container, 'Panel Three')).toBeNull();
  });

  it('roving tabindex：选中 tab tabIndex=0 其余 -1', () => {
    const { container } = render(<BasicTabs />);
    const tabs = tabsOf(container);
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[2]).toHaveAttribute('tabindex', '-1');
  });

  it('点击切换面板并回调 onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<BasicTabs onValueChange={onValueChange} />);
    await user.click(tabsOf(container)[2]);
    expect(onValueChange).toHaveBeenCalledWith('three');
    expect(tabsOf(container)[2]).toHaveAttribute('aria-selected', 'true');
    expect(panelByText(container, 'Panel Three')).not.toBeNull();
    expect(panelByText(container, 'Panel One')).toBeNull();
  });

  it('受控 value：仅高亮传入值，点击回调但界面跟随 value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender, container } = render(
      <BasicTabs value="two" onValueChange={onValueChange} />
    );
    expect(tabsOf(container)[1]).toHaveAttribute('aria-selected', 'true');
    expect(panelByText(container, 'Panel Two')).not.toBeNull();

    await user.click(tabsOf(container)[0]);
    expect(onValueChange).toHaveBeenCalledWith('one');
    // 受控：父级未更新 value 前仍显示 two
    expect(tabsOf(container)[1]).toHaveAttribute('aria-selected', 'true');
    expect(panelByText(container, 'Panel Two')).not.toBeNull();

    rerender(<BasicTabs value="one" onValueChange={onValueChange} />);
    expect(tabsOf(container)[0]).toHaveAttribute('aria-selected', 'true');
    expect(panelByText(container, 'Panel One')).not.toBeNull();
  });

  it('水平模式：ArrowRight/ArrowLeft 移动焦点并选中（automatic）', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<BasicTabs onValueChange={onValueChange} />);
    const tabs = tabsOf(container);
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('two');

    await user.keyboard('{ArrowRight}');
    expect(tabs[2]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('three');

    // 环形：末尾再按右回到第一个
    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('one');

    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('three');
  });

  it('垂直模式：ArrowDown/ArrowUp 移动，ArrowRight 不移动', async () => {
    const user = userEvent.setup();
    const { container } = render(<BasicTabs orientation="vertical" />);
    const tabs = tabsOf(container);
    expect(container.querySelector('[role="tablist"]')).toHaveAttribute(
      'aria-orientation',
      'vertical'
    );
    tabs[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(tabs[1]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(tabs[0]).toHaveFocus();
    // 水平方向键在 vertical 模式不移动焦点
    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
  });

  it('Home/End 跳到首尾', async () => {
    const user = userEvent.setup();
    const { container } = render(<BasicTabs />);
    const tabs = tabsOf(container);
    tabs[0].focus();
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
  });

  it('automatic 模式：焦点即选中（onValueChange 由焦点触发）', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <BasicTabs activationMode="automatic" onValueChange={onValueChange} />
    );
    const tabs = tabsOf(container);
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledWith('two');
    expect(panelByText(container, 'Panel Two')).not.toBeNull();
  });

  it('manual 模式：方向键只移焦点不选中，Enter/Space 才选中', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <BasicTabs activationMode="manual" onValueChange={onValueChange} />
    );
    const tabs = tabsOf(container);
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tabsOf(container)[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('two');
    expect(tabsOf(container)[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onValueChange).toHaveBeenLastCalledWith('three');
    expect(panelByText(container, 'Panel Three')).not.toBeNull();
  });

  it('disabled tab 被跳过且不可点击', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<BasicTabs disabledSecond onValueChange={onValueChange} />);
    const tabs = tabsOf(container);
    expect(tabs[1]).toBeDisabled();

    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    // 跳过 disabled 的 two，直达 three
    expect(tabs[2]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith('three');

    await user.click(tabs[1]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('aria-controls/aria-labelledby 用 useId 双向关联', () => {
    const { container } = render(<BasicTabs />);
    const tabs = tabsOf(container);
    const panelOne = panelByText(container, 'Panel One')!;
    // tab -> panel
    expect(tabs[0]).toHaveAttribute('aria-controls', panelOne.id);
    // panel -> tab
    expect(panelOne).toHaveAttribute('aria-labelledby', tabs[0].id);
    // id 唯一且非空
    expect(tabs[0].id).toBeTruthy();
    expect(panelOne.id).toBeTruthy();
  });

  it('forceMount 面板保留在 DOM 但带 hidden，未激活面板默认卸载', () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">Tab One</Tabs.Trigger>
          <Tabs.Trigger value="two">Tab Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">Panel One</Tabs.Panel>
        <Tabs.Panel value="two" forceMount>
          Panel Two
        </Tabs.Panel>
      </Tabs>
    );
    const panelTwo = panelByText(container, 'Panel Two')!;
    expect(panelTwo).toHaveAttribute('role', 'tabpanel');
    expect(panelTwo).toHaveAttribute('hidden');
    expect(panelByText(container, 'Panel One')).not.toHaveAttribute('hidden');
  });

  it('custom classNames 与 data-part 透传', () => {
    const { container } = render(
      <BasicTabs
        classNames={{ root: 'my-root', list: 'my-list', trigger: 'my-trigger', panel: 'my-panel' }}
      />
    );
    const root = container.querySelector('.z-tabs') as HTMLElement;
    expect(root).toHaveClass('my-root');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-orientation', 'horizontal');

    const list = container.querySelector('[role="tablist"]') as HTMLElement;
    expect(list).toHaveClass('my-list');
    expect(list).toHaveAttribute('data-part', 'list');

    const tabs = tabsOf(container);
    expect(tabs[0]).toHaveClass('my-trigger');
    expect(tabs[0]).toHaveAttribute('data-part', 'trigger');

    const panelOne = panelByText(container, 'Panel One')!;
    expect(panelOne).toHaveClass('my-panel');
    expect(panelOne).toHaveAttribute('data-part', 'panel');
  });

  it('Trigger icon 渲染且 aria-hidden', () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one" icon={<svg data-testid="icon" />}>
            Tab One
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">Panel One</Tabs.Panel>
      </Tabs>
    );
    const icon = container.querySelector('[data-testid="icon"]') as HTMLElement;
    expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('tabs 按钮是 type=button，tablist 为 role=tablist', () => {
    const { container } = render(<BasicTabs />);
    const list = container.querySelector('[role="tablist"]');
    expect(list).toBeInTheDocument();
    for (const tab of tabsOf(container)) {
      expect(tab).toHaveAttribute('type', 'button');
    }
  });
});
