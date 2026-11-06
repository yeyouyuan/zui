'use client';

import * as React from 'react';
import { Check, ChevronRight, Minus } from '@zui/icons';
import { cx, useControllableState } from '../../utils';
import './Tree.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TreeNode {
  key: string;
  title: React.ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
  isLeaf?: boolean;
  loading?: boolean;
}

export interface TreeProps {
  data: TreeNode[];
  checkable?: boolean;
  checkedKeys?: string[];
  defaultCheckedKeys?: string[];
  onCheck?: (keys: string[]) => void;
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  onExpand?: (keys: string[]) => void;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  loadData?: (node: TreeNode) => Promise<void>;
  className?: string;
  classNames?: { root?: string; node?: string; label?: string; icon?: string; checkbox?: string };
}

/* --------------------------------- 工具 ---------------------------------- */

interface TreeIndex {
  nodeMap: Map<string, TreeNode>;
  parentMap: Map<string, string | null>;
}

/** 扁平索引：key → 节点、key → 父 key */
function buildIndex(nodes: TreeNode[]): TreeIndex {
  const nodeMap = new Map<string, TreeNode>();
  const parentMap = new Map<string, string | null>();
  const walk = (list: TreeNode[], parentKey: string | null) => {
    for (const node of list) {
      nodeMap.set(node.key, node);
      parentMap.set(node.key, parentKey);
      if (node.children?.length) walk(node.children, node.key);
    }
  };
  walk(nodes, null);
  return { nodeMap, parentMap };
}

/** 可见节点（前序）：子节点仅在父节点展开时出现 */
function flattenVisible(nodes: TreeNode[], expanded: Set<string>, out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length && expanded.has(node.key)) flattenVisible(node.children, expanded, out);
  }
  return out;
}

/**
 * 勾选闭包（父子联动）：
 * - 向下：已勾选节点的所有非 disabled 子孙视为勾选；disabled 子树整棵不参与传导
 * - 向上：全部（非 disabled）直属子节点勾选 → 父节点收拢为勾选；子节点全 disabled 时按叶子处理
 */
function computeCheckedClosure(data: TreeNode[], checked: ReadonlySet<string>): Set<string> {
  const result = new Set(checked);

  const walkDown = (node: TreeNode, inherited: boolean): void => {
    if (node.disabled) return;
    const isChecked = inherited || result.has(node.key);
    if (isChecked) result.add(node.key);
    node.children?.forEach((child) => walkDown(child, isChecked));
  };
  data.forEach((node) => walkDown(node, false));

  const walkUp = (node: TreeNode): void => {
    const children = node.children ?? [];
    children.forEach(walkUp);
    if (children.length === 0) return;
    const enabled = children.filter((child) => !child.disabled);
    const relevant = enabled.length > 0 ? enabled : children;
    if (relevant.every((child) => result.has(child.key))) result.add(node.key);
  };
  data.forEach(walkUp);

  return result;
}

/** 半选：自身未勾选、但子树中存在勾选节点 */
function isHalfChecked(node: TreeNode, checked: ReadonlySet<string>): boolean {
  if (checked.has(node.key)) return false;
  return (node.children ?? []).some(
    (child) => checked.has(child.key) || isHalfChecked(child, checked)
  );
}

/** 按树序（前序）输出勾选 key */
function collectCheckedKeys(
  data: TreeNode[],
  checked: ReadonlySet<string>,
  out: string[] = []
): string[] {
  for (const node of data) {
    if (checked.has(node.key)) out.push(node.key);
    if (node.children?.length) collectCheckedKeys(node.children, checked, out);
  }
  return out;
}

/* -------------------------------- 图标（@zui/icons） -------------------------- */

function ChevronIcon(): React.ReactNode {
  // className 交给 CSS 旋转（展开时 rotate 90°）
  return <ChevronRight className="z-tree-node-chevron" size={12} />;
}

function CheckIcon(): React.ReactNode {
  return <Check size={10} />;
}

function MinusIcon(): React.ReactNode {
  return <Minus size={10} />;
}

/* ---------------------------------- Tree ---------------------------------- */

/**
 * 树形控件：勾选传播（父子联动 + 半选）、异步 loadData、
 * role="tree"/"treeitem" + aria-expanded/aria-checked，键盘 ←→/↑↓/Space/Enter。
 */
export function Tree({
  data,
  checkable = false,
  checkedKeys,
  defaultCheckedKeys,
  onCheck,
  expandedKeys,
  defaultExpandedKeys,
  onExpand,
  selectedKey,
  onSelect,
  loadData,
  className,
  classNames,
}: TreeProps) {
  /* ------------------------------ 受控状态 ------------------------------ */

  const [expanded, setExpanded] = useControllableState<string[]>({
    value: expandedKeys,
    defaultValue: defaultExpandedKeys ?? [],
    onChange: onExpand,
  });
  const [checked, setChecked] = useControllableState<string[]>({
    value: checkedKeys,
    defaultValue: defaultCheckedKeys ?? [],
    onChange: onCheck,
  });
  const [selected, setSelected] = useControllableState<string>({
    value: selectedKey,
    defaultValue: '',
    onChange: onSelect,
  });

  const expandedSet = React.useMemo(() => new Set(expanded), [expanded]);
  const checkedClosure = React.useMemo(
    () => computeCheckedClosure(data, new Set(checked)),
    [data, checked]
  );

  const { parentMap } = React.useMemo(() => buildIndex(data), [data]);
  const visibleNodes = React.useMemo(
    () => flattenVisible(data, expandedSet),
    [data, expandedSet]
  );
  const visibleKeys = React.useMemo(
    () => new Set(visibleNodes.map((node) => node.key)),
    [visibleNodes]
  );

  /* ------------------------------ 焦点管理 ------------------------------ */

  const [focusedKey, setFocusedKey] = React.useState('');
  const shouldFocusRef = React.useRef(false);
  const nodeRefs = React.useRef(new Map<string, HTMLLIElement>());

  const activeFocusKey =
    focusedKey && visibleKeys.has(focusedKey) ? focusedKey : (visibleNodes[0]?.key ?? '');

  React.useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    nodeRefs.current.get(activeFocusKey)?.focus();
  }, [activeFocusKey]);

  const focusNode = (key: string) => {
    shouldFocusRef.current = true;
    setFocusedKey(key);
  };

  /* ------------------------------ 异步加载 ------------------------------ */

  const loadingKeysRef = React.useRef(new Set<string>());
  const [loadingKeys, setLoadingKeys] = React.useState<ReadonlySet<string>>(new Set());

  const startLoad = React.useCallback(
    (node: TreeNode) => {
      if (!loadData || node.isLeaf || node.children?.length) return;
      if (loadingKeysRef.current.has(node.key)) return;
      loadingKeysRef.current.add(node.key);
      setLoadingKeys(new Set(loadingKeysRef.current));
      void (async () => {
        try {
          await loadData(node);
        } catch {
          // 加载失败：清除 loading 态，保留再次触发能力
        }
        loadingKeysRef.current.delete(node.key);
        setLoadingKeys(new Set(loadingKeysRef.current));
      })();
    },
    [loadData]
  );

  /* ------------------------------ 交互行为 ------------------------------ */

  const isExpandable = (node: TreeNode): boolean =>
    (node.children?.length ?? 0) > 0 || (!node.isLeaf && !!loadData);

  const toggleExpand = (node: TreeNode) => {
    if (!isExpandable(node)) return;
    const isOpen = expandedSet.has(node.key);
    if (isOpen) {
      setExpanded((prev) => prev.filter((key) => key !== node.key));
    } else {
      setExpanded((prev) => (prev.includes(node.key) ? prev : [...prev, node.key]));
      startLoad(node);
    }
  };

  const toggleCheck = (node: TreeNode) => {
    if (node.disabled) return;
    const isChecked = checkedClosure.has(node.key);
    if (isChecked) {
      // 取消：移除节点与非 disabled 子树；祖先收拢失效（全部从结果移除）
      const next = new Set(checkedClosure);
      const remove = (target: TreeNode) => {
        if (target.disabled) return;
        next.delete(target.key);
        target.children?.forEach(remove);
      };
      remove(node);
      let parentKey = parentMap.get(node.key) ?? null;
      while (parentKey) {
        next.delete(parentKey);
        parentKey = parentMap.get(parentKey) ?? null;
      }
      setChecked(collectCheckedKeys(data, next));
    } else {
      const next = new Set(checkedClosure);
      next.add(node.key);
      setChecked(collectCheckedKeys(data, computeCheckedClosure(data, next)));
    }
  };

  const selectNode = (node: TreeNode) => {
    if (node.disabled) return;
    setSelected(node.key);
  };

  /* ------------------------------ 键盘导航 ------------------------------ */

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (visibleNodes.length === 0) return;
    const index = visibleNodes.findIndex((node) => node.key === activeFocusKey);
    const current = visibleNodes[index] ?? visibleNodes[0];
    if (!current) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (index < visibleNodes.length - 1) focusNode(visibleNodes[index + 1]!.key);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) focusNode(visibleNodes[index - 1]!.key);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!isExpandable(current)) break;
        if (!expandedSet.has(current.key)) {
          toggleExpand(current);
        } else if (current.children?.length) {
          focusNode(current.children[0]!.key);
        }
        break;
      case 'ArrowLeft': {
        event.preventDefault();
        if (isExpandable(current) && expandedSet.has(current.key)) {
          toggleExpand(current);
        } else {
          const parentKey = parentMap.get(current.key);
          if (parentKey) focusNode(parentKey);
        }
        break;
      }
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        if (checkable) toggleCheck(current);
        break;
      case 'Enter':
        event.preventDefault();
        selectNode(current);
        break;
      default:
        break;
    }
  };

  /* ------------------------------- 渲染 -------------------------------- */

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const expandable = isExpandable(node);
    const isExpanded = hasChildren && expandedSet.has(node.key);
    const isChecked = checkedClosure.has(node.key);
    const isHalf = checkable && !isChecked && isHalfChecked(node, checkedClosure);
    const isLoading = node.loading === true || loadingKeys.has(node.key);
    const isSelected = node.key === selected;

    return (
      <li
        key={node.key}
        role="treeitem"
        data-part="node"
        className={cx('z-tree-node', classNames?.node)}
        ref={(element) => {
          if (element) nodeRefs.current.set(node.key, element);
          else nodeRefs.current.delete(node.key);
        }}
        aria-expanded={expandable ? isExpanded : undefined}
        aria-checked={
          checkable ? (isChecked ? 'true' : isHalf ? 'mixed' : 'false') : undefined
        }
        aria-selected={isSelected}
        aria-level={depth}
        aria-disabled={node.disabled ? true : undefined}
        aria-busy={isLoading ? true : undefined}
        tabIndex={node.key === activeFocusKey ? 0 : -1}
        data-selected={isSelected ? 'true' : undefined}
        data-checked={checkable ? (isChecked ? 'true' : isHalf ? 'mixed' : 'false') : undefined}
        data-disabled={node.disabled ? true : undefined}
        data-expanded={expandable ? (isExpanded ? 'true' : 'false') : undefined}
        onFocus={(event) => {
          if (event.currentTarget === event.target) setFocusedKey(node.key);
        }}
        onClick={() => {
          focusNode(node.key);
          selectNode(node);
        }}
      >
        <div className="z-tree-node-row" data-part="row">
          <span
            data-part="icon"
            className={cx('z-tree-node-icon', classNames?.icon)}
            aria-hidden="true"
            data-expanded={expandable ? (isExpanded ? 'true' : 'false') : undefined}
            onClick={(event) => {
              event.stopPropagation();
              focusNode(node.key);
              toggleExpand(node);
            }}
          >
            {isLoading ? (
              <span data-part="spinner" className="z-tree-node-spinner" />
            ) : expandable ? (
              <ChevronIcon />
            ) : null}
          </span>

          {checkable ? (
            <span
              data-part="checkbox"
              className={cx('z-tree-node-checkbox', classNames?.checkbox)}
              aria-hidden="true"
              data-checked={isChecked ? 'true' : 'false'}
              data-indeterminate={isHalf ? 'true' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                focusNode(node.key);
                toggleCheck(node);
              }}
            >
              {isChecked ? <CheckIcon /> : isHalf ? <MinusIcon /> : null}
            </span>
          ) : null}

          <span data-part="label" className={cx('z-tree-node-label', classNames?.label)}>
            {node.title}
          </span>
        </div>

        {hasChildren && isExpanded ? (
          <ul role="group" data-part="group" className="z-tree-node-children">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <ul
      role="tree"
      data-part="root"
      className={cx('z-tree', className, classNames?.root)}
      onKeyDown={onKeyDown}
    >
      {data.map((node) => renderNode(node, 1))}
    </ul>
  );
}
