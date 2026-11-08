import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './index';
import type { CommandPaletteCommand } from './index';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const commands: CommandPaletteCommand[] = [
  { key: 'home', label: '回到首页', onSelect: vi.fn(), keywords: ['go'] },
  {
    key: 'theme',
    label: '切换主题',
    group: '视图',
    shortcut: '⌘⇧L',
    onSelect: vi.fn(),
  },
  { key: 'docs', label: '打开文档', group: '视图', onSelect: vi.fn() },
  { key: 'export', label: '导出数据', group: '数据', disabled: true, onSelect: vi.fn() },
  { key: 'settings', label: '设置', onSelect: vi.fn() },
];

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

function expectActive(name: string): void {
  expect(getInput()).toHaveAttribute(
    'aria-activedescendant',
    screen.getByRole('option', { name }).id
  );
}

describe('CommandPalette DOM 与 ARIA', () => {
  it('分别命名 dialog 与 input，并保持 listbox popup 展开', async () => {
    render(<CommandPalette open commands={commands} aria-label="全局命令" />);
    const dialog = screen.getByRole('dialog', { name: '全局命令' });
    const input = getInput();
    const listbox = screen.getByRole('listbox');

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(input).toHaveAccessibleName('搜索命令');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(listbox).toHaveAttribute('aria-busy', 'false');
    expect(within(listbox).getAllByRole('group')).toHaveLength(2);
    await waitFor(() => expectActive('回到首页'));
    expect(screen.getByText('⌘⇧L')).toHaveAttribute('aria-hidden', 'true');
  });

  it('aria-labelledby 优先于 aria-label，输入名称和 placeholder 可独立覆盖', () => {
    render(
      <>
        <h2 id="palette-title">项目命令</h2>
        <CommandPalette
          open
          commands={commands}
          aria-label="冗余名称"
          aria-labelledby="palette-title"
          inputAriaLabel="查找项目动作"
          placeholder="输入动作"
        />
      </>
    );
    const dialog = screen.getByRole('dialog', { name: '项目命令' });
    expect(dialog).not.toHaveAttribute('aria-label');
    expect(getInput()).toHaveAccessibleName('查找项目动作');
    expect(getInput()).toHaveAttribute('placeholder', '输入动作');
  });

  it('零结果和 loading 状态位于 listbox 外，loading 优先于 empty', () => {
    const { rerender } = render(
      <CommandPalette open commands={[]} emptyContent="没有结果" aria-label="命令面板" />
    );
    const listbox = screen.getByRole('listbox');
    const status = screen.getByRole('status');
    expect(listbox).toBeEmptyDOMElement();
    expect(listbox.contains(status)).toBe(false);
    expect(status).toHaveTextContent('没有结果');
    expect(getInput()).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <CommandPalette
        open
        commands={[]}
        loading
        loadingContent="正在同步"
        emptyContent="没有结果"
        aria-label="命令面板"
      />
    );
    expect(listbox).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('正在同步');
    expect(status).not.toHaveTextContent('没有结果');
  });

  it('空 key 与重复 key 被裁剪；缺少处理器的 enabled 命令按 disabled 渲染', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <CommandPalette
        open
        commands={[
          { key: '', label: '空 key', onSelect: () => {} },
          { key: 'same', label: <strong>首项</strong>, onSelect: () => {} },
          { key: 'same', label: '重复项', onSelect: () => {} },
          { key: 'noop', label: '无处理器' },
        ]}
        aria-label="命令面板"
      />
    );

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.queryByText('空 key')).not.toBeInTheDocument();
    expect(screen.queryByText('重复项')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '无处理器' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('重复的 command key：same'))).toBe(true);
    expect(messages.some((message) => message.includes('非空 textValue'))).toBe(true);
    expect(messages.some((message) => message.includes('已按 disabled 处理'))).toBe(true);
  });
});

describe('CommandPalette query、过滤与动态结果', () => {
  it('默认过滤覆盖 NFKC、label 和 keywords，Home/End 保留给文本编辑', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        open
        commands={[
          { key: 'full', label: 'ＡＢＣ 设置', onSelect: () => {} },
          { key: 'home', label: '首页', keywords: ['start'], onSelect: () => {} },
        ]}
        aria-label="命令面板"
      />
    );
    await user.type(getInput(), 'abc');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'ＡＢＣ 设置' })).toBeInTheDocument();
    expect(fireEvent.keyDown(getInput(), { key: 'Home' })).toBe(true);
    expect(fireEvent.keyDown(getInput(), { key: 'End' })).toBe(true);

    await user.clear(getInput());
    await user.type(getInput(), 'start');
    expect(screen.getByRole('option', { name: '首页' })).toBeInTheDocument();
  });

  it('filter=false 仍通过受控 query 通道驱动异步结果', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const { rerender } = render(
      <CommandPalette
        open
        query=""
        onQueryChange={onQueryChange}
        commands={commands}
        filter={false}
        aria-label="命令面板"
      />
    );
    await user.type(getInput(), '报');
    expect(onQueryChange).toHaveBeenLastCalledWith(
      '报',
      expect.objectContaining({ reason: 'input' })
    );
    expect(getInput()).toHaveValue('');

    rerender(
      <CommandPalette
        open
        query="报"
        onQueryChange={onQueryChange}
        commands={[{ key: 'report', label: '交付报告', onSelect: () => {} }]}
        filter={false}
        loading
        aria-label="命令面板"
      />
    );
    expect(getInput()).toHaveValue('报');
    expect(screen.getByRole('option', { name: '交付报告' })).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
  });

  it('动态命令保留 active key；删除 active 后优先落到旧视觉位置', async () => {
    const first = [
      { key: 'a', label: 'A', onSelect: () => {} },
      { key: 'b', label: 'B', onSelect: () => {} },
      { key: 'c', label: 'C', onSelect: () => {} },
    ];
    const { rerender } = render(
      <CommandPalette open commands={first} filter={false} aria-label="命令面板" />
    );
    await waitFor(() => expectActive('A'));
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    expectActive('B');

    rerender(
      <CommandPalette
        open
        commands={[first[2], first[1], first[0]]}
        filter={false}
        aria-label="命令面板"
      />
    );
    await waitFor(() => expectActive('B'));

    rerender(
      <CommandPalette open commands={[first[2], first[0]]} filter={false} aria-label="命令面板" />
    );
    await waitFor(() => expectActive('A'));
  });

  it('query 只在实际关闭后 reset；受控父级拒绝关闭时不伪造清空', async () => {
    const onOpenChange = vi.fn();
    const onQueryChange = vi.fn();
    const { rerender } = render(
      <CommandPalette
        open
        query="报告"
        commands={[{ key: 'report', label: '报告', onSelect: () => {} }]}
        onOpenChange={onOpenChange}
        onQueryChange={onQueryChange}
        aria-label="命令面板"
      />
    );
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'select', commandKey: 'report' })
    );
    expect(onQueryChange).not.toHaveBeenCalledWith(
      '',
      expect.objectContaining({ reason: 'close-reset' })
    );
    expect(getInput()).toHaveValue('报告');

    rerender(
      <CommandPalette
        open={false}
        query="报告"
        commands={[]}
        onOpenChange={onOpenChange}
        onQueryChange={onQueryChange}
        aria-label="命令面板"
      />
    );
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith('', { reason: 'close-reset' }));
  });
});

describe('CommandPalette 导航与选择契约', () => {
  it('上下箭头按视觉顺序跨分组且跳过 disabled，边界不循环', async () => {
    render(<CommandPalette open commands={commands} aria-label="命令面板" />);
    await waitFor(() => expectActive('回到首页'));
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    expectActive('设置');
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    expectActive('切换主题');
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    expectActive('打开文档');
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    expectActive('打开文档');
    fireEvent.keyDown(getInput(), { key: 'ArrowUp' });
    expectActive('切换主题');
  });

  it('item 后 root 的顺序固定，事件携带 query/source/meta，preventDefault 可保持打开', async () => {
    const order: string[] = [];
    const itemSelect = vi.fn((event) => {
      order.push(`item:${event.query}:${event.source}`);
      event.preventDefault();
    });
    const rootSelect = vi.fn((command, event) => {
      order.push(`root:${String(command.meta)}:${String(event.defaultPrevented)}`);
    });
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        defaultOpen
        defaultQuery="报"
        commands={[{ key: 'report', label: '报告', meta: '/reports', onSelect: itemSelect }]}
        onCommandSelect={rootSelect}
        onOpenChange={onOpenChange}
        aria-label="命令面板"
      />
    );
    await waitFor(() => expectActive('报告'));
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(order).toEqual(['item:报:keyboard', 'root:/reports:true']);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pointer 选择保持输入焦点并报告 select 关闭原因', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <CommandPalette
        open
        commands={[{ key: 'a', label: '动作 A', onSelect }]}
        onOpenChange={onOpenChange}
        aria-label="命令面板"
      />
    );
    getInput().focus();
    await user.click(screen.getByRole('option', { name: '动作 A' }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ query: '', source: 'pointer' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'select', commandKey: 'a' })
    );
  });

  it('IME composition 中 Enter 与 Escape 都不执行或关闭', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        open
        commands={[{ key: 'a', label: '动作 A', onSelect }]}
        onOpenChange={onOpenChange}
        aria-label="命令面板"
      />
    );
    const input = getInput();
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true, keyCode: 229 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Escape 与遮罩点击提供准确关闭原因', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <CommandPalette open commands={commands} onOpenChange={onOpenChange} aria-label="命令面板" />
    );
    fireEvent.keyDown(getInput(), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape' })
    );

    rerender(
      <CommandPalette open commands={commands} onOpenChange={onOpenChange} aria-label="命令面板" />
    );
    fireEvent.mouseDown(document.querySelector('.z-modal-overlay') as HTMLElement);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'overlay' })
    );
  });
});

describe('CommandPalette 全局热键', () => {
  it('mod 按平台精确映射；显式 ctrl 不接受 Meta', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const onOpenChange = vi.fn();
    render(
      <CommandPalette commands={commands} onOpenChange={onOpenChange} aria-label="命令面板" />
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'hotkey' }));

    cleanup();
    const explicitCtrl = vi.fn();
    render(
      <CommandPalette
        commands={commands}
        hotkey="ctrl+k"
        onOpenChange={explicitCtrl}
        aria-label="命令面板"
      />
    );
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(explicitCtrl).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(explicitCtrl).toHaveBeenCalledTimes(1);
  });

  it('忽略 repeat、defaultPrevented、IME、AltGraph 与非法裸键', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Linux x86_64');
    const onOpenChange = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <CommandPalette commands={commands} onOpenChange={onOpenChange} aria-label="命令面板" />
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, repeat: true });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, isComposing: true, keyCode: 229 });
    const prevented = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    document.dispatchEvent(prevented);
    const altGraph = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    vi.spyOn(altGraph, 'getModifierState').mockReturnValue(true);
    document.dispatchEvent(altGraph);
    expect(onOpenChange).not.toHaveBeenCalled();

    cleanup();
    render(<CommandPalette commands={commands} hotkey="k" aria-label="命令面板" />);
    fireEvent.keyDown(document, { key: 'k' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(warn.mock.calls.some((call) => String(call[0]).includes('无效热键'))).toBe(true);
  });

  it('相同 hotkey 只有注册栈顶部实例响应', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Linux x86_64');
    const first = vi.fn();
    const second = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <CommandPalette commands={commands} onOpenChange={first} aria-label="第一面板" />
        <CommandPalette commands={commands} onOpenChange={second} aria-label="第二面板" />
      </>
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '第一面板' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '第二面板' })).toBeInTheDocument();
  });
});

describe('CommandPalette 焦点与定制出口', () => {
  it('returnFocusRef 优先恢复焦点，业务显式外部聚焦不会被抢回', async () => {
    const targetRef = { current: null as HTMLButtonElement | null };
    const externalRef = { current: null as HTMLHeadingElement | null };
    const { rerender } = render(
      <>
        <button ref={targetRef}>命令入口</button>
        <h2 ref={externalRef} tabIndex={-1}>
          新页面标题
        </h2>
        <CommandPalette
          defaultOpen
          commands={[{ key: 'close', label: '关闭', onSelect: () => {} }]}
          returnFocusRef={targetRef}
          aria-label="命令面板"
        />
      </>
    );
    fireEvent.keyDown(getInput(), { key: 'Escape' });
    await waitFor(() => expect(targetRef.current).toHaveFocus());

    rerender(
      <>
        <button ref={targetRef}>命令入口</button>
        <h2 ref={externalRef} tabIndex={-1}>
          新页面标题
        </h2>
        <CommandPalette
          key="route-palette"
          defaultOpen
          commands={[
            {
              key: 'route',
              label: '前往页面',
              onSelect: () => externalRef.current?.focus(),
            },
          ]}
          returnFocusRef={targetRef}
          aria-label="命令面板"
        />
      </>
    );
    await waitFor(() => expectActive('前往页面'));
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(externalRef.current).toHaveFocus();
  });

  it('className 和全部新增 slot className 落在约定节点', () => {
    render(
      <CommandPalette
        open
        commands={commands}
        className="custom-root"
        loading
        classNames={{
          dialog: 'custom-dialog',
          root: 'root-slot',
          input: 'input-slot',
          listbox: 'listbox-slot',
          group: 'group-slot',
          groupLabel: 'group-label-slot',
          option: 'option-slot',
          optionIcon: 'icon-slot',
          optionLabel: 'label-slot',
          optionShortcut: 'shortcut-slot',
          status: 'status-slot',
          loading: 'loading-slot',
        }}
        aria-label="命令面板"
      />
    );
    expect(screen.getByRole('dialog')).toHaveClass('custom-dialog');
    expect(document.querySelector('[data-part="root"]')).toHaveClass('custom-root', 'root-slot');
    expect(getInput()).toHaveClass('input-slot');
    expect(screen.getByRole('listbox')).toHaveClass('listbox-slot');
    expect(screen.getAllByRole('group')[0]).toHaveClass('group-slot');
    expect(screen.getByText('视图')).toHaveClass('group-label-slot');
    expect(screen.getByRole('option', { name: '回到首页' })).toHaveClass('option-slot');
    expect(screen.getByText('⌘⇧L')).toHaveClass('shortcut-slot');
    expect(screen.getByRole('status')).toHaveClass('status-slot');
    expect(screen.getByText('正在加载命令')).toHaveClass('loading-slot');
  });
});
