import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionBlock, DEMO_MEMBERS, DEMO_PERMISSION_TREE } from '../src/permission';

afterEach(cleanup);

describe('permission block', () => {
  it('renders the permission tree and the member table', () => {
    const { container } = render(
      <PermissionBlock
        treeData={DEMO_PERMISSION_TREE}
        defaultExpandedKeys={['console']}
        members={DEMO_MEMBERS}
      />
    );
    expect(screen.getByText('角色权限')).toBeInTheDocument();
    expect(screen.getByText('成员列表')).toBeInTheDocument();
    // 树节点
    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();
    expect(screen.getByText('数据概览')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
    // 成员表格与角色 Tag
    expect(screen.getByText('陈默')).toBeInTheDocument();
    expect(screen.getByText('超级管理员')).toBeInTheDocument();
    expect(container.querySelector('.z-table')).toBeInTheDocument();
  });

  it('reports checked keys when a tree node is checked', () => {
    const onCheckedKeysChange = vi.fn();
    render(
      <PermissionBlock
        treeData={DEMO_PERMISSION_TREE}
        defaultExpandedKeys={['console']}
        members={DEMO_MEMBERS}
        onCheckedKeysChange={onCheckedKeysChange}
      />
    );
    const leaf = screen.getByText('数据概览').closest('[role="treeitem"]')!;
    const checkbox = leaf.querySelector('[data-part="checkbox"]')!;
    expect(checkbox).toHaveAttribute('data-checked', 'false');
    fireEvent.click(checkbox);
    expect(onCheckedKeysChange).toHaveBeenCalledWith(['console:overview']);
  });

  it('toggles a member switch and passes the member back', async () => {
    const onMemberToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <PermissionBlock
        treeData={DEMO_PERMISSION_TREE}
        members={DEMO_MEMBERS}
        onMemberToggle={onMemberToggle}
      />
    );
    await user.click(screen.getByRole('switch', { name: '启用 陈默' }));
    expect(onMemberToggle).toHaveBeenCalledTimes(1);
    expect(onMemberToggle).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'm-2', name: '陈默', enabled: true }),
      false
    );
  });

  it('renders an empty hint when no members are provided', () => {
    render(<PermissionBlock treeData={DEMO_PERMISSION_TREE} members={[]} />);
    expect(screen.getByText('暂无成员')).toBeInTheDocument();
  });

  it('reports expansion changes for a controlled permission tree', () => {
    const onExpandedKeysChange = vi.fn();
    render(
      <PermissionBlock
        treeData={DEMO_PERMISSION_TREE}
        members={[]}
        expandedKeys={[]}
        onExpandedKeysChange={onExpandedKeysChange}
      />
    );
    const consoleNode = screen.getByText('控制台').closest('[role="treeitem"]')!;
    fireEvent.keyDown(consoleNode, { key: 'ArrowRight' });
    expect(onExpandedKeysChange).toHaveBeenCalledWith(['console']);
  });
});
