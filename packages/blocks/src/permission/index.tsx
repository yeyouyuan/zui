'use client';

import * as React from 'react';
import {
  Card,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tag,
  Tree,
} from '@zui/react';
import type { TreeNode } from '@zui/react';
import { useControllableState } from '@zui/react';

/* ---------------------------------- 类型 ---------------------------------- */

/** 成员行（数据 props 化） */
export interface PermissionMember {
  key: string;
  name: string;
  /** 角色 / 职位 */
  role: string;
  email: string;
  /** 是否启用该成员的管理权限 */
  enabled: boolean;
}

export interface PermissionBlockProps {
  title?: React.ReactNode;
  /** 角色权限树（checkable） */
  treeData: TreeNode[];
  checkedKeys?: string[];
  defaultCheckedKeys?: string[];
  /** 勾选变化回调（返回树勾选闭包的 key 集合） */
  onCheckedKeysChange?: (keys: string[]) => void;
  /** 树默认展开（演示/受控均可） */
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  onExpandedKeysChange?: (keys: string[]) => void;
  /** 成员列表 */
  members: PermissionMember[];
  /** 成员启用开关切换 */
  onMemberToggle?: (member: PermissionMember, checked: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    treeCard?: string;
    tableCard?: string;
    layout?: string;
  };
}

/* -------------------------------- 演示数据 -------------------------------- */

export const DEMO_PERMISSION_TREE: TreeNode[] = [
  {
    key: 'console',
    title: '控制台',
    children: [
      { key: 'console:overview', title: '数据概览' },
      { key: 'console:report', title: '报表导出' },
      {
        key: 'console:settings',
        title: '系统设置',
        children: [{ key: 'console:settings:security', title: '安全策略' }],
      },
    ],
  },
  {
    key: 'content',
    title: '内容管理',
    children: [
      { key: 'content:article', title: '文章管理' },
      { key: 'content:media', title: '媒体库' },
    ],
  },
  {
    key: 'members',
    title: '成员管理',
    children: [
      { key: 'members:list', title: '成员列表' },
      { key: 'members:invite', title: '邀请成员' },
    ],
  },
];

export const DEMO_MEMBERS: PermissionMember[] = [
  {
    key: 'm-1',
    name: '林小满',
    role: '超级管理员',
    email: 'xiaoman.lin@example.com',
    enabled: true,
  },
  { key: 'm-2', name: '陈默', role: '内容运营', email: 'mo.chen@example.com', enabled: true },
  {
    key: 'm-3',
    name: '赵一鸣',
    role: '只读访客',
    email: 'yiming.zhao@example.com',
    enabled: false,
  },
];

/* ---------------------------------- 区块 ---------------------------------- */

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--z-text-lg)',
  fontWeight: 'var(--z-weight-semibold)',
  color: 'var(--z-color-fg)',
};

/** 权限管理区块：Tree（角色权限树，checkable）+ Table（成员）+ Switch 开关列 */
export function PermissionBlock({
  title = '权限管理',
  treeData,
  checkedKeys: checkedKeysProp,
  defaultCheckedKeys,
  onCheckedKeysChange,
  expandedKeys,
  defaultExpandedKeys,
  onExpandedKeysChange,
  members,
  onMemberToggle,
  className,
  style,
  classNames,
}: PermissionBlockProps) {
  // useControllableState 在受控/非受控下都会回调 onChange，无需显式转发
  const [checkedKeys, setCheckedKeys] = useControllableState<string[]>({
    value: checkedKeysProp,
    defaultValue: defaultCheckedKeys ?? [],
    onChange: onCheckedKeysChange,
  });

  const handleCheck = (keys: string[]) => {
    setCheckedKeys(keys);
  };

  return (
    <div
      data-part="root"
      className={[className, classNames?.root].filter(Boolean).join(' ') || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--z-space-4)',
        maxWidth: 1080,
        margin: '0 auto',
        padding: 'var(--z-space-6) var(--z-space-4)',
        ...style,
      }}
    >
      <h2 style={titleStyle}>{title}</h2>

      <div
        className={classNames?.layout}
        data-part="layout"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--z-space-4)',
          alignItems: 'start',
        }}
      >
        {/* 左：角色权限树 */}
        <Card className={classNames?.treeCard} style={{ flex: '1 1 280px', minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 var(--z-space-3)',
              fontSize: 'var(--z-text-md)',
              fontWeight: 'var(--z-weight-medium)',
              color: 'var(--z-color-fg)',
            }}
          >
            角色权限
          </h3>
          <Tree
            data={treeData}
            checkable
            checkedKeys={checkedKeys}
            onCheck={handleCheck}
            expandedKeys={expandedKeys}
            defaultExpandedKeys={defaultExpandedKeys}
            onExpand={onExpandedKeysChange}
          />
        </Card>

        {/* 右：成员表格 */}
        <Card className={classNames?.tableCard} style={{ flex: '2 1 380px', minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 var(--z-space-3)',
              fontSize: 'var(--z-text-md)',
              fontWeight: 'var(--z-weight-medium)',
              color: 'var(--z-color-fg)',
            }}
          >
            成员列表
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <Table striped>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>成员</TableHeaderCell>
                  <TableHeaderCell>角色</TableHeaderCell>
                  <TableHeaderCell>邮箱</TableHeaderCell>
                  <TableHeaderCell align="center">启用</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <span
                        style={{ color: 'var(--z-color-fg-muted)', fontSize: 'var(--z-text-sm)' }}
                      >
                        暂无成员
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.key}>
                      <TableCell>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--z-space-2)',
                            fontWeight: 'var(--z-weight-medium)',
                            color: 'var(--z-color-fg)',
                          }}
                        >
                          {member.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Tag color={member.role.includes('管理员') ? 'primary' : 'neutral'}>
                          {member.role}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        <span
                          style={{ color: 'var(--z-color-fg-muted)', fontSize: 'var(--z-text-sm)' }}
                        >
                          {member.email}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          size="sm"
                          checked={member.enabled}
                          onChange={(checked) => onMemberToggle?.(member, checked)}
                          aria-label={`启用 ${member.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default PermissionBlock;
