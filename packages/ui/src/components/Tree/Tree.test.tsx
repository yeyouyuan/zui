import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from './Tree';
import type { TreeNode } from './Tree';

afterEach(cleanup);

/** p 下挂 c1（含 g1）与 c2；s 为独立节点 */
const TREE_DATA: TreeNode[] = [
  {
    key: 'p',
    title: '父节点',
    children: [
      { key: 'c1', title: '子节点一', children: [{ key: 'g1', title: '孙节点一' }] },
      { key: 'c2', title: '子节点二' },
    ],
  },
  { key: 's', title: '独立节点' },
];

function getItem(title: string): HTMLElement {
  return screen.getByText(title).closest('[role="treeitem"]') as HTMLElement;
}

describe('Tree', () => {
  /* ------------------------------- 渲染/结构 ------------------------------- */

  it('renders root with role=tree, data-part and treeitems', () => {
    render(<Tree data={TREE_DATA} />);
    const root = screen.getByRole('tree');
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveClass('z-tree');
    expect(root.querySelectorAll('[role="treeitem"]')).toHaveLength(2); // 未展开只渲染顶层
    expect(getItem('父节点')).toHaveAttribute('data-part', 'node');
    expect(getItem('独立节点')).toHaveAttribute('aria-level', '1');
  });

  it('defaultExpandedKeys shows children with nested role=group and aria-level', () => {
    render(<Tree data={TREE_DATA} defaultExpandedKeys={['p', 'c1']} />);
    expect(screen.getByText('子节点一')).toBeInTheDocument();
    expect(screen.getByText('孙节点一')).toBeInTheDocument();
    expect(getItem('子节点一')).toHaveAttribute('aria-level', '2');
    expect(getItem('孙节点一')).toHaveAttribute('aria-level', '3');
    expect(getItem('父节点').querySelector('[role="group"]')).toBeInTheDocument();
  });

  it('collapsed children are not rendered', () => {
    render(<Tree data={TREE_DATA} />);
    expect(screen.queryByText('子节点一')).not.toBeInTheDocument();
    expect(getItem('父节点')).toHaveAttribute('aria-expanded', 'false');
    expect(getItem('独立节点')).not.toHaveAttribute('aria-expanded'); // 叶子无 aria-expanded
  });

  it('passes className, classNames and data-part to slots', () => {
    render(
      <Tree
        data={TREE_DATA}
        checkable
        className="my-root"
        classNames={{ root: 'c-root', node: 'c-node', label: 'c-label', icon: 'c-icon', checkbox: 'c-checkbox' }}
      />
    );
    const root = screen.getByRole('tree');
    expect(root).toHaveClass('z-tree', 'my-root', 'c-root');
    const item = getItem('独立节点');
    expect(item).toHaveClass('z-tree-node', 'c-node');
    expect(item.querySelector('[data-part="label"]')).toHaveClass('z-tree-node-label', 'c-label');
    expect(item.querySelector('[data-part="icon"]')).toHaveClass('z-tree-node-icon', 'c-icon');
    const checkbox = item.querySelector('[data-part="checkbox"]') as HTMLElement;
    expect(checkbox).toHaveClass('z-tree-node-checkbox', 'c-checkbox');
  });

  /* -------------------------------- 展开 -------------------------------- */

  it('uncontrolled: switcher click toggles expand and fires onExpand', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<Tree data={TREE_DATA} onExpand={onExpand} />);
    const icon = getItem('父节点').querySelector('[data-part="icon"]') as HTMLElement;
    await user.click(icon);
    expect(onExpand).toHaveBeenLastCalledWith(['p']);
    expect(screen.getByText('子节点一')).toBeInTheDocument();
    expect(getItem('父节点')).toHaveAttribute('aria-expanded', 'true');
    await user.click(getItem('父节点').querySelector('[data-part="icon"]') as HTMLElement);
    expect(onExpand).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText('子节点一')).not.toBeInTheDocument();
  });

  it('controlled: expandedKeys reflects prop and onExpand reports without internal toggle', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    const { rerender } = render(<Tree data={TREE_DATA} expandedKeys={['p']} onExpand={onExpand} />);
    expect(screen.getByText('子节点一')).toBeInTheDocument();
    await user.click(getItem('父节点').querySelector('[data-part="icon"]') as HTMLElement);
    expect(onExpand).toHaveBeenCalledWith([]);
    // 受控：数据未回流前不自行收起
    expect(screen.getByText('子节点一')).toBeInTheDocument();
    rerender(<Tree data={TREE_DATA} expandedKeys={[]} onExpand={onExpand} />);
    expect(screen.queryByText('子节点一')).not.toBeInTheDocument();
  });

  /* -------------------------------- 勾选 -------------------------------- */

  it('checkable: renders visual checkbox and aria-checked=false on treeitem', () => {
    render(<Tree data={TREE_DATA} checkable />);
    const item = getItem('独立节点');
    expect(item).toHaveAttribute('aria-checked', 'false');
    expect(item.querySelector('[data-part="checkbox"]')).toBeInTheDocument();
  });

  it('checks parent with propagation to whole subtree (tree-order keys)', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Tree data={TREE_DATA} checkable defaultExpandedKeys={['p', 'c1']} onCheck={onCheck} />);
    await user.click(getItem('父节点').querySelector('[data-part="checkbox"]') as HTMLElement);
    expect(onCheck).toHaveBeenCalledWith(['p', 'c1', 'g1', 'c2']);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('孙节点一')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('子节点二')).toHaveAttribute('aria-checked', 'true');
  });

  it('propagates up: child check makes parent indeterminate, all children checks parent', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Tree data={TREE_DATA} checkable defaultExpandedKeys={['p', 'c1']} onCheck={onCheck} />);
    await user.click(getItem('子节点二').querySelector('[data-part="checkbox"]') as HTMLElement);
    expect(onCheck).toHaveBeenLastCalledWith(['c2']);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'mixed');
    await user.click(getItem('子节点一').querySelector('[data-part="checkbox"]') as HTMLElement);
    // c1 勾选向下传导 g1，向上收拢 p
    expect(onCheck).toHaveBeenLastCalledWith(['p', 'c1', 'g1', 'c2']);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('孙节点一')).toHaveAttribute('aria-checked', 'true');
  });

  it('uncheck removes subtree and invalidates ancestors (parent becomes mixed)', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(
      <Tree
        data={TREE_DATA}
        checkable
        defaultExpandedKeys={['p', 'c1']}
        defaultCheckedKeys={['p', 'c1', 'g1', 'c2']}
        onCheck={onCheck}
      />
    );
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'true');
    await user.click(getItem('子节点二').querySelector('[data-part="checkbox"]') as HTMLElement);
    expect(onCheck).toHaveBeenCalledWith(['c1', 'g1']);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'mixed');
    expect(getItem('子节点二')).toHaveAttribute('aria-checked', 'false');
  });

  it('defaultCheckedKeys on parent checks entire subtree via closure', () => {
    render(<Tree data={TREE_DATA} checkable defaultExpandedKeys={['p', 'c1']} defaultCheckedKeys={['p']} />);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('子节点一')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('孙节点一')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('子节点二')).toHaveAttribute('aria-checked', 'true');
    expect(getItem('独立节点')).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled nodes: excluded from propagation and cannot be toggled', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    const data: TreeNode[] = [
      {
        key: 'p2',
        title: '父二',
        children: [
          { key: 'd', title: '禁用子', disabled: true },
          { key: 'e', title: '正常子' },
        ],
      },
    ];
    render(<Tree data={data} checkable defaultExpandedKeys={['p2']} onCheck={onCheck} />);
    await user.click(getItem('父二').querySelector('[data-part="checkbox"]') as HTMLElement);
    expect(onCheck).toHaveBeenLastCalledWith(['p2', 'e']); // 禁用子不参与传导
    expect(getItem('禁用子')).toHaveAttribute('aria-checked', 'false');
    expect(getItem('禁用子')).toHaveAttribute('aria-disabled', 'true');
    await user.click(getItem('禁用子').querySelector('[data-part="checkbox"]') as HTMLElement);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  /* -------------------------------- 异步 -------------------------------- */

  it('loadData: expand triggers load with spinner + aria-busy, then renders children', async () => {
    const user = userEvent.setup();
    let resolveLoad: () => void = () => undefined;
    const loadData = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        })
    );
    const lazyData: TreeNode[] = [{ key: 'lazy', title: '待加载' }];
    const { rerender } = render(<Tree data={lazyData} loadData={loadData} />);
    await user.click(getItem('待加载').querySelector('[data-part="icon"]') as HTMLElement);
    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData).toHaveBeenCalledWith(expect.objectContaining({ key: 'lazy' }));
    expect(getItem('待加载')).toHaveAttribute('aria-busy', 'true');
    expect(getItem('待加载').querySelector('[data-part="spinner"]')).toBeInTheDocument();

    act(() => resolveLoad());
    await act(async () => undefined);
    rerender(
      <Tree
        data={[{ key: 'lazy', title: '待加载', children: [{ key: 'lazy-1', title: '懒加载子节点' }] }]}
        loadData={loadData}
      />
    );
    expect(screen.getByText('懒加载子节点')).toBeInTheDocument();
    expect(getItem('待加载')).not.toHaveAttribute('aria-busy');
    expect(getItem('待加载').querySelector('[data-part="spinner"]')).not.toBeInTheDocument();
  });

  it('loadData is not called for isLeaf nodes or nodes with existing children', async () => {
    const user = userEvent.setup();
    const loadData = vi.fn(() => Promise.resolve());
    const data: TreeNode[] = [
      { key: 'leaf', title: '叶子节点', isLeaf: true },
      { key: 'has', title: '已有子节点', children: [{ key: 'has-1', title: '已有子一' }] },
    ];
    render(<Tree data={data} defaultExpandedKeys={['has']} loadData={loadData} />);
    await user.click(getItem('叶子节点').querySelector('[data-part="icon"]') as HTMLElement);
    await user.click(getItem('已有子节点').querySelector('[data-part="icon"]') as HTMLElement); // 收起
    await user.click(getItem('已有子节点').querySelector('[data-part="icon"]') as HTMLElement); // 再展开
    expect(loadData).not.toHaveBeenCalled();
  });

  it('node.loading renders spinner and aria-busy without loadData', () => {
    const data: TreeNode[] = [{ key: 'a', title: '外部加载中', loading: true }];
    render(<Tree data={data} />);
    const item = getItem('外部加载中');
    expect(item).toHaveAttribute('aria-busy', 'true');
    expect(item.querySelector('[data-part="spinner"]')).toBeInTheDocument();
    expect(item.querySelector('[data-part="icon"]')).toBeInTheDocument();
  });

  /* -------------------------------- 键盘 -------------------------------- */

  it('keyboard: ArrowDown/ArrowUp move focus between visible nodes', async () => {
    const user = userEvent.setup();
    render(<Tree data={TREE_DATA} defaultExpandedKeys={['p']} />);
    act(() => { getItem('父节点').focus(); });
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(getItem('子节点一'));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(getItem('子节点二'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(getItem('子节点一'));
  });

  it('keyboard: Home/End move focus to the first/last visible node', async () => {
    const user = userEvent.setup();
    render(<Tree data={TREE_DATA} defaultExpandedKeys={['p', 'c1']} />);
    act(() => { getItem('子节点一').focus(); });
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(getItem('独立节点'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(getItem('父节点'));
  });

  it('keyboard: ArrowRight expands then jumps to first child; ArrowLeft collapses then jumps to parent', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<Tree data={TREE_DATA} onExpand={onExpand} />);
    act(() => { getItem('父节点').focus(); });
    await user.keyboard('{ArrowRight}'); // 折叠 → 展开
    expect(onExpand).toHaveBeenLastCalledWith(['p']);
    expect(getItem('父节点')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}'); // 已展开 → 跳到第一个子节点
    expect(document.activeElement).toBe(getItem('子节点一'));
    await user.keyboard('{ArrowLeft}'); // 未展开 → 跳父
    expect(document.activeElement).toBe(getItem('父节点'));
    await user.keyboard('{ArrowLeft}'); // 已展开 → 折叠
    expect(onExpand).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText('子节点一')).not.toBeInTheDocument();
  });

  it('keyboard: Space toggles check with propagation', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Tree data={TREE_DATA} checkable defaultExpandedKeys={['p']} onCheck={onCheck} />);
    act(() => { getItem('父节点').focus(); });
    await user.keyboard(' ');
    expect(onCheck).toHaveBeenLastCalledWith(['p', 'c1', 'g1', 'c2']);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(onCheck).toHaveBeenLastCalledWith([]);
    expect(getItem('父节点')).toHaveAttribute('aria-checked', 'false');
  });

  it('keyboard: Space selects the active node when the tree is not checkable', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree data={TREE_DATA} onSelect={onSelect} />);
    act(() => { getItem('父节点').focus(); });
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledWith('p');
    expect(getItem('父节点')).toHaveAttribute('aria-selected', 'true');
  });

  it('keyboard: Enter selects node with aria-selected and onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree data={TREE_DATA} onSelect={onSelect} />);
    act(() => { getItem('父节点').focus(); });
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p');
    expect(getItem('父节点')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('s');
    expect(getItem('独立节点')).toHaveAttribute('aria-selected', 'true');
    expect(getItem('父节点')).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps DOM focus in the tree when a controlled ancestor collapse hides the active node', () => {
    const { rerender } = render(<Tree data={TREE_DATA} expandedKeys={['p', 'c1']} />);
    act(() => { getItem('孙节点一').focus(); });
    expect(document.activeElement).toBe(getItem('孙节点一'));

    rerender(<Tree data={TREE_DATA} expandedKeys={[]} />);

    expect(screen.queryByText('孙节点一')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(getItem('父节点'));
    expect(getItem('父节点')).toHaveAttribute('tabindex', '0');
  });

  /* ------------------------------ 选中/禁用 ------------------------------ */

  it('selectedKey controlled + click on label selects; disabled node click is ignored', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const data: TreeNode[] = [
      { key: 'x', title: '可选节点' },
      { key: 'y', title: '禁用节点', disabled: true },
    ];
    const { rerender } = render(<Tree data={data} selectedKey="x" onSelect={onSelect} />);
    expect(getItem('可选节点')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByText('禁用节点'));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByText('可选节点'));
    expect(onSelect).toHaveBeenLastCalledWith('x');
    rerender(<Tree data={data} selectedKey="" onSelect={onSelect} />);
    expect(getItem('可选节点')).toHaveAttribute('aria-selected', 'false');
  });
});
