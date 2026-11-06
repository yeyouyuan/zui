import { useState } from 'react';
import { Tree, type TreeNode } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_DATA: TreeNode[] = [
  {
    key: 'fruits',
    title: '水果',
    children: [
      { key: 'apple', title: '苹果' },
      { key: 'banana', title: '香蕉' },
    ],
  },
  {
    key: 'veggies',
    title: '蔬菜',
    children: [
      { key: 'carrot', title: '胡萝卜' },
      { key: 'potato', title: '土豆', disabled: true },
    ],
  },
  { key: 'tea', title: '茶饮（叶子）', isLeaf: true },
];

const BASIC_CODE = `<Tree
  data={[
    { key: 'fruits', title: '水果', children: [
      { key: 'apple', title: '苹果' },
      { key: 'banana', title: '香蕉' },
    ] },
    { key: 'veggies', title: '蔬菜', children: [
      { key: 'carrot', title: '胡萝卜' },
      { key: 'potato', title: '土豆', disabled: true },
    ] },
    { key: 'tea', title: '茶饮（叶子）', isLeaf: true },
  ]}
  defaultExpandedKeys={['fruits']}
  onSelect={(key) => console.log(key)}
/>`;

const CHECK_CODE = `const [checked, setChecked] = useState(['apple']);

<Tree
  data={data}
  checkable
  defaultExpandedKeys={['fruits', 'veggies']}
  checkedKeys={checked}
  onCheck={setChecked}
/>`;

const ASYNC_CODE = `const [data, setData] = useState([{ key: 'root', title: '部门' }]);

const loadData = (node) =>
  new Promise((resolve) => {
    setTimeout(() => {
      setData((prev) => withChildren(prev, node.key, [
        { key: node.key + '-1', title: '子部门 1', isLeaf: true },
        { key: node.key + '-2', title: '子部门 2' },
      ]));
      resolve();
    }, 600);
  });

<Tree data={data} loadData={loadData} />`;

const KEYBOARD_CODE = `// 焦点进入树后：
// ↑ ↓        移动节点
// →          展开 / 跳到第一个子节点
// ←          折叠 / 跳到父节点
// Space      勾选（checkable 时）
// Enter      选中`;

/** 在树中为指定 key 的节点挂上 children（不可变更新） */
function withChildren(nodes: TreeNode[], key: string, children: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children) return { ...node, children: withChildren(node.children, key, children) };
    return node;
  });
}

export default function TreePage(): React.ReactNode {
  usePageTitle('Tree 树');
  const [checked, setChecked] = useState<string[]>(['apple']);
  const [asyncData, setAsyncData] = useState<TreeNode[]>([{ key: 'root', title: '部门（点击展开异步加载）' }]);

  const loadData = (node: TreeNode) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        setAsyncData((prev) =>
          withChildren(prev, node.key, [
            { key: `${node.key}-1`, title: `${node.title}-子部门 1`, isLeaf: true },
            { key: `${node.key}-2`, title: `${node.title}-子部门 2` },
          ])
        );
        resolve();
      }, 600);
    });

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Tree 树</h1>
      <p className="doc-lead">
        树形结构展示与选择：勾选传播（父子联动 + 半选）、异步加载子节点（node.loading 态 + spinner）、
        完整键盘导航（←→/↑↓/Space/Enter）。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="data 驱动的树形结构；defaultExpandedKeys 控制初始展开，点击节点触发 onSelect，展开图标支持点击与键盘操作。"
        code={BASIC_CODE}
      >
        <Tree data={BASIC_DATA} defaultExpandedKeys={['fruits']} onSelect={() => undefined} />
      </Demo>

      <Demo
        title="勾选传播"
        description={'checkable 开启勾选框：勾选父节点传导全部非 disabled 子孙，全部子节点勾选收拢父节点，半选显示 indeterminate（aria-checked="mixed"）。'}
        code={CHECK_CODE}
      >
        <Tree
          data={BASIC_DATA}
          checkable
          defaultExpandedKeys={['fruits', 'veggies']}
          checkedKeys={checked}
          onCheck={setChecked}
        />
        <p className="doc-p">
          当前勾选：<code className="doc-code-inline">{JSON.stringify(checked)}</code>
        </p>
      </Demo>

      <Demo
        title="异步加载"
        description="传入 loadData 后，展开无子节点的非叶子节点会自动调用（节点显示 spinner + aria-busy），数据回填后渲染子节点。"
        code={ASYNC_CODE}
      >
        <Tree data={asyncData} loadData={loadData} />
      </Demo>

      <Demo title="键盘导航" description="焦点进入树后可用键盘完成全部操作：" code={KEYBOARD_CODE} stack>
        <ul className="doc-chip-list">
          <li className="doc-chip">↑ ↓ 移动节点</li>
          <li className="doc-chip">→ 展开 / 跳子</li>
          <li className="doc-chip">← 折叠 / 跳父</li>
          <li className="doc-chip">Space 勾选</li>
          <li className="doc-chip">Enter 选中</li>
        </ul>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'data',
            type: 'TreeNode[]',
            description: '树数据：{ key, title, children?, disabled?, isLeaf?, loading? }。',
          },
          { name: 'checkable', type: 'boolean', defaultValue: 'false', description: '显示勾选框（父子联动 + 半选）。' },
          { name: 'checkedKeys / defaultCheckedKeys', type: 'string[]', defaultValue: '[]', description: '勾选 key（受控/非受控）。onCheck 输出全选闭包（树序）。' },
          { name: 'onCheck', type: '(keys: string[]) => void', description: '勾选变更回调。' },
          { name: 'expandedKeys / defaultExpandedKeys', type: 'string[]', defaultValue: '[]', description: '展开 key（受控/非受控）。' },
          { name: 'onExpand', type: '(keys: string[]) => void', description: '展开变更回调。' },
          { name: 'selectedKey', type: 'string', description: '受控选中 key。' },
          { name: 'onSelect', type: '(key: string) => void', description: '选中回调（Enter / 点击标签）。' },
          { name: 'loadData', type: '(node: TreeNode) => Promise<void>', description: '异步加载子节点；期间节点 spinner + aria-busy。' },
          { name: 'classNames', type: '{ root?; node?; label?; icon?; checkbox? }', description: 'slot 级类名追加。' },
        ]}
      />

      <CustomizeOutlet
        name="Tree"
        parts={['root', 'node', 'row', 'group', 'icon', 'spinner', 'checkbox', 'label']}
        vars={[
          '--z-tree-font-size',
          '--z-tree-fg',
          '--z-tree-node-height',
          '--z-tree-node-gap',
          '--z-tree-node-radius',
          '--z-tree-node-hover-bg',
          '--z-tree-node-selected-bg',
          '--z-tree-node-selected-fg',
          '--z-tree-node-disabled-fg',
          '--z-tree-indent',
          '--z-tree-icon-size',
          '--z-tree-icon-color',
          '--z-tree-checkbox-size',
          '--z-tree-checkbox-radius',
          '--z-tree-checkbox-bg',
          '--z-tree-checkbox-border',
          '--z-tree-checkbox-checked-bg',
          '--z-tree-checkbox-checked-border',
          '--z-tree-checkbox-fg',
          '--z-tree-checkbox-indeterminate-bg',
          '--z-tree-focus-ring',
          '--z-tree-spinner-size',
          '--z-tree-spinner-color',
          '--z-tree-transition',
        ]}
      />
    </div>
  );
}
