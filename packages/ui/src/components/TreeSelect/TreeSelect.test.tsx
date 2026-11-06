import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeSelect } from './TreeSelect';
import type { TreeSelectNode } from './TreeSelect';

afterEach(cleanup);

const DATA: TreeSelectNode[] = [
  {
    key: 'p',
    title: '父节点',
    children: [
      { key: 'c1', title: '子节点一' },
      { key: 'c2', title: '子节点二' },
    ],
  },
  { key: 's', title: '独立节点' },
];

function getTrigger(): HTMLElement {
  return document.querySelector('[data-part="trigger"]') as HTMLElement;
}

function getPanel(): HTMLElement {
  return document.querySelector('[data-part="panel"]') as HTMLElement;
}

function getTags(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-part="tag"]'));
}

describe('TreeSelect', () => {
  it('renders trigger with placeholder, data-part and classNames slots', () => {
    render(
      <TreeSelect
        data={DATA}
        className="my-root"
        classNames={{ root: 'c-root', trigger: 'c-trigger', panel: 'c-panel', tags: 'c-tags' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-tree-select', 'my-root', 'c-root');
    expect(root).toHaveAttribute('data-open', 'false');
    expect(getTrigger()).toHaveClass('z-tree-select-trigger', 'c-trigger');
    expect(getTrigger()).toHaveAttribute('role', 'combobox');
    expect(getTrigger()).toHaveAttribute('aria-label', '请选择');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'tree');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('请选择')).toHaveAttribute('data-part', 'placeholder');
    expect(getPanel()).toHaveClass('z-tree-select-panel', 'c-panel');
    expect(document.querySelector('[data-part="tags"]')).toHaveClass(
      'z-tree-select-tags',
      'c-tags'
    );
  });

  it('shows one tag per selected key and hides placeholder when value present', () => {
    render(<TreeSelect data={DATA} defaultValue={['p', 'c1']} />);
    const tags = getTags();
    expect(tags).toHaveLength(2);
    expect(tags[0]).toHaveTextContent('父节点');
    expect(tags[1]).toHaveTextContent('子节点一');
    expect(screen.queryByText('请选择')).not.toBeInTheDocument();
    expect(tags[0]!.querySelector('[data-part="remove"]')).toHaveAttribute(
      'aria-label',
      '移除 父节点'
    );
  });

  it('allows a stable accessible name independent of the placeholder', () => {
    render(<TreeSelect data={DATA} ariaLabel="选择部门" defaultValue={['p']} />);
    expect(screen.getByRole('combobox', { name: '选择部门' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('click toggles panel open state', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} />);
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(getPanel()).toHaveAttribute('data-open', 'true');
    expect(within(getPanel()).getByText('独立节点')).toBeInTheDocument();
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(getPanel()).toHaveAttribute('data-open', 'false');
  });

  it('keyboard: Enter opens, Esc closes and returns focus to trigger', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} />);
    getTrigger().focus();
    await user.keyboard('{Enter}');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: '父节点' })
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: '独立节点' })
    );
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getTrigger());
  });

  it('keyboard: navigates branches and toggles checked nodes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TreeSelect data={DATA} onChange={onChange} />);
    getTrigger().focus();
    await user.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: '子节点一' })
    );
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['c1']);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: /父节点/ })
    );
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: '独立节点' })
    );
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(
      within(getPanel()).getByRole('treeitem', { name: /父节点/ })
    );
  });

  it('keyboard: single selection closes panel and returns focus', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TreeSelect data={DATA} multiple={false} onChange={onChange} />);
    getTrigger().focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith(['s']);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getTrigger());
  });

  it('closes on outside pointerdown', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} />);
    await user.click(getTrigger());
    expect(getPanel()).toHaveAttribute('data-open', 'true');
    fireEvent.pointerDown(document.body);
    expect(getPanel()).toHaveAttribute('data-open', 'false');
  });

  it('multiple: checking parent fires onChange with closure keys and adds tags', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TreeSelect data={DATA} defaultValue={[]} onChange={onChange} />);
    await user.click(getTrigger());
    const panel = getPanel();
    await user.click(within(panel).getByText('父节点'));
    expect(onChange).toHaveBeenCalledWith(['p', 'c1', 'c2']);
    expect(getTags()).toHaveLength(3);
    // 展开后取消 c2（同时移除祖先 p 收拢）
    await user.click(
      within(panel).getAllByRole('treeitem')[0]!.querySelector('[data-part="icon"]') as HTMLElement
    );
    await user.click(within(panel).getByText('子节点二'));
    expect(onChange).toHaveBeenLastCalledWith(['c1']);
  });

  it('multiple: parent shows mixed state before all children checked', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} defaultValue={['c1']} />);
    await user.click(getTrigger());
    const panel = getPanel();
    await user.click(
      within(panel).getAllByRole('treeitem')[0]!.querySelector('[data-part="icon"]') as HTMLElement
    );
    const items = within(panel).getAllByRole('treeitem');
    const parent = items[0]!;
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    await user.click(within(panel).getByText('子节点一'));
    expect(items[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('tag remove button unchecks key with ancestors invalidated', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TreeSelect data={DATA} defaultValue={['p', 'c1', 'c2']} onChange={onChange} />);
    const removeButtons = document.querySelectorAll('[data-part="remove"]');
    await user.click(removeButtons[1] as HTMLElement); // 移除 子节点一
    expect(onChange).toHaveBeenCalledWith(['c2']);
    expect(getTags()).toHaveLength(1);
  });

  it('disabled: cannot open panel and root/trigger expose disabled state', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} disabled />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveAttribute('data-disabled', 'true');
    expect(getTrigger()).toHaveAttribute('aria-disabled', 'true');
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('single mode: clicking node label selects, closes panel and shows plain value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TreeSelect data={DATA} multiple={false} defaultValue={[]} onChange={onChange} />);
    await user.click(getTrigger());
    await user.click(within(getPanel()).getByText('独立节点'));
    expect(onChange).toHaveBeenCalledWith(['s']);
    expect(getPanel()).toHaveAttribute('data-open', 'false');
    const value = document.querySelector('[data-part="value"]') as HTMLElement;
    expect(value).toHaveTextContent('独立节点');
    expect(document.querySelectorAll('[data-part="remove"]')).toHaveLength(0);
    const items = within(getPanel()).getAllByRole('treeitem');
    expect(items[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('switcher click expands children in panel; size maps to data-size', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={DATA} size="lg" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'lg');
    await user.click(getTrigger());
    expect(within(getPanel()).queryByText('子节点一')).not.toBeInTheDocument();
    const parentItem = within(getPanel()).getAllByRole('treeitem')[0]!;
    await user.click(parentItem.querySelector('[data-part="icon"]') as HTMLElement);
    expect(within(getPanel()).getByText('子节点一')).toBeInTheDocument();
    expect(parentItem).toHaveAttribute('aria-expanded', 'true');
  });

  it('empty data renders empty state in panel', async () => {
    const user = userEvent.setup();
    render(<TreeSelect data={[]} />);
    await user.click(getTrigger());
    expect(screen.getByText('暂无数据')).toHaveAttribute('data-part', 'empty');
  });
});
