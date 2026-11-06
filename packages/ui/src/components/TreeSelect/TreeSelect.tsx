'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './TreeSelect.css';

/* ---------------------------------- 类型 ---------------------------------- */

/** 树节点（与 Tree 组件同构；不从 Tree 导入，避免组件间依赖） */
interface TreeNode {
  key: string;
  title: React.ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
  isLeaf?: boolean;
  loading?: boolean;
}

/** 供使用者命名节点类型（模块内 TreeNode 的导出别名） */
export type TreeSelectNode = TreeNode;

export interface TreeSelectProps {
  data: TreeNode[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (keys: string[]) => void;
  multiple?: boolean; // 默认 true
  placeholder?: string;
  /** 触发器的无障碍名称；默认使用 placeholder。 */
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  classNames?: { root?: string; trigger?: string; panel?: string; tags?: string };
}

/* --------------------------------- 工具 ---------------------------------- */

interface TreeIndex {
  nodeMap: Map<string, TreeNode>;
  parentMap: Map<string, string | null>;
}

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

/** 仅遍历当前展开后可见的节点，供方向键导航。 */
function flattenVisible(
  nodes: TreeNode[],
  expanded: ReadonlySet<string>,
  out: TreeNode[] = []
): TreeNode[] {
  for (const node of nodes) {
    out.push(node);
    if (expanded.has(node.key) && node.children?.length)
      flattenVisible(node.children, expanded, out);
  }
  return out;
}

/** 勾选闭包（父子联动，与 Tree 同语义）：向下传导非 disabled 子孙、向上收拢全勾父节点 */
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

function isHalfChecked(node: TreeNode, checked: ReadonlySet<string>): boolean {
  if (checked.has(node.key)) return false;
  return (node.children ?? []).some(
    (child) => checked.has(child.key) || isHalfChecked(child, checked)
  );
}

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

/** 节点标题纯文本（Tag 移除按钮 aria-label 用） */
function titleText(title: React.ReactNode, key: string): string {
  return typeof title === 'string' || typeof title === 'number' ? String(title) : key;
}

/* -------------------------------- 图标（内联） ------------------------------- */

function ChevronIcon(): React.ReactNode {
  return (
    <svg
      className="z-tree-select-node-chevron"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon(): React.ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MinusIcon(): React.ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8 12.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon(): React.ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="8" height="8" aria-hidden="true" focusable="false">
      <path
        d="M4 4 12 12 M12 4 4 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowDownIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/* -------------------------------- TreeSelect ------------------------------- */

/**
 * 树选择：触发器（Input 样式）+ 多值 Tag 显示 + 弹出 Tree 面板。
 * Popover 模式：外部点击 / Esc 关闭。多选勾选带父子联动。
 */
export function TreeSelect({
  data,
  value,
  defaultValue,
  onChange,
  multiple = true,
  placeholder,
  ariaLabel,
  disabled = false,
  size = 'md',
  className,
  classNames,
}: TreeSelectProps) {
  const { locale } = useZuiConfig();
  const placeholderText = placeholder === undefined ? locale.select.placeholder : placeholder;

  const panelRef = React.useRef<HTMLDivElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();
  const panelId = `${baseId}-panel`;

  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const [focusedKey, setFocusedKey] = React.useState('');
  const nodeRefs = React.useRef(new Map<string, HTMLLIElement>());
  const [currentValue, setCurrentValue] = useControllableState<string[]>({
    value,
    defaultValue: defaultValue ?? [],
    onChange,
  });

  const { nodeMap, parentMap } = React.useMemo(() => buildIndex(data), [data]);
  const expandedSet = React.useMemo(() => new Set(expanded), [expanded]);
  const visibleNodes = React.useMemo(() => flattenVisible(data, expandedSet), [data, expandedSet]);
  const visibleKeys = React.useMemo(
    () => new Set(visibleNodes.map((node) => node.key)),
    [visibleNodes]
  );
  const activeFocusKey =
    focusedKey && visibleKeys.has(focusedKey) ? focusedKey : (visibleNodes[0]?.key ?? '');
  const checkedClosure = React.useMemo(
    () => computeCheckedClosure(data, new Set(currentValue)),
    [data, currentValue]
  );

  /* ---------------------------- 打开/关闭 ---------------------------- */

  const closePanel = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  React.useEffect(() => {
    if (open && activeFocusKey) nodeRefs.current.get(activeFocusKey)?.focus();
  }, [open, activeFocusKey]);

  const focusNode = (key: string) => {
    setFocusedKey(key);
    nodeRefs.current.get(key)?.focus();
  };

  // 点击外部关闭
  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, () => closePanel(false), open);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel(true);
    }
  };

  const onRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      closePanel(true);
    }
  };

  const onTreeKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePanel(true);
      return;
    }
    const index = visibleNodes.findIndex((node) => node.key === activeFocusKey);
    const current = visibleNodes[index];
    if (!current) return;
    const hasChildren = !!current.children?.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (index < visibleNodes.length - 1) focusNode(visibleNodes[index + 1]!.key);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) focusNode(visibleNodes[index - 1]!.key);
        break;
      case 'Home':
        event.preventDefault();
        focusNode(visibleNodes[0]!.key);
        break;
      case 'End':
        event.preventDefault();
        focusNode(visibleNodes[visibleNodes.length - 1]!.key);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (hasChildren && !expandedSet.has(current.key)) {
          setExpanded((prev) => [...prev, current.key]);
        } else if (hasChildren) {
          focusNode(current.children![0]!.key);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (hasChildren && expandedSet.has(current.key)) {
          setExpanded((prev) => prev.filter((key) => key !== current.key));
        } else {
          const parent = parentMap.get(current.key);
          if (parent) focusNode(parent);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (multiple) toggleCheck(current);
        else selectSingle(current);
        break;
      default:
        break;
    }
  };

  /* ---------------------------- 选择行为 ---------------------------- */

  const uncheckKey = (key: string) => {
    const next = new Set(checkedClosure);
    const remove = (target: TreeNode) => {
      if (target.disabled) return;
      next.delete(target.key);
      target.children?.forEach(remove);
    };
    const node = nodeMap.get(key);
    if (node) remove(node);
    // 祖先收拢失效：自底向上移除
    const dropAncestors = (current: string) => {
      const parent = parentMap.get(current) ?? null;
      if (!parent) return;
      next.delete(parent);
      dropAncestors(parent);
    };
    dropAncestors(key);
    setCurrentValue(collectCheckedKeys(data, next));
  };

  const toggleCheck = (node: TreeNode) => {
    if (node.disabled) return;
    if (checkedClosure.has(node.key)) {
      uncheckKey(node.key);
    } else {
      const next = new Set(checkedClosure);
      next.add(node.key);
      setCurrentValue(collectCheckedKeys(data, computeCheckedClosure(data, next)));
    }
  };

  const selectSingle = (node: TreeNode) => {
    if (node.disabled) return;
    setCurrentValue([node.key]);
    closePanel(true);
  };

  const removeTag = (key: string) => {
    if (disabled) return;
    uncheckKey(key);
    triggerRef.current?.focus();
  };

  /* ---------------------------- 面板树渲染 ---------------------------- */

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isExpanded = hasChildren && expandedSet.has(node.key);
    const isChecked = checkedClosure.has(node.key);
    const isHalf = multiple && !isChecked && isHalfChecked(node, checkedClosure);
    const isSelected = currentValue.includes(node.key) && !multiple;

    return (
      <li
        key={node.key}
        ref={(element) => {
          if (element) nodeRefs.current.set(node.key, element);
          else nodeRefs.current.delete(node.key);
        }}
        role="treeitem"
        data-part="node"
        className="z-tree-select-node"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-checked={multiple ? (isChecked ? 'true' : isHalf ? 'mixed' : 'false') : undefined}
        aria-selected={multiple ? undefined : isSelected}
        aria-level={depth}
        tabIndex={open && node.key === activeFocusKey ? 0 : -1}
        aria-disabled={node.disabled ? true : undefined}
        data-disabled={node.disabled ? true : undefined}
        data-selected={isSelected ? 'true' : undefined}
        onFocus={(event) => {
          if (event.currentTarget === event.target) setFocusedKey(node.key);
        }}
      >
        <div className="z-tree-select-node-row">
          <span
            data-part="icon"
            className="z-tree-select-node-icon"
            aria-hidden="true"
            data-expanded={hasChildren ? (isExpanded ? 'true' : 'false') : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (!hasChildren) return;
              focusNode(node.key);
              setExpanded((prev) =>
                prev.includes(node.key)
                  ? prev.filter((key) => key !== node.key)
                  : [...prev, node.key]
              );
            }}
          >
            {hasChildren ? <ChevronIcon /> : null}
          </span>

          {multiple ? (
            <span
              data-part="checkbox"
              className="z-tree-select-node-checkbox"
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

          <span
            data-part="label"
            className="z-tree-select-node-label"
            onClick={() => {
              focusNode(node.key);
              if (multiple) toggleCheck(node);
              else selectSingle(node);
            }}
          >
            {node.title}
          </span>
        </div>

        {hasChildren && isExpanded ? (
          <ul role="group" data-part="group" className="z-tree-select-node-children">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  /* ------------------------------- 渲染 -------------------------------- */

  const selectedNodes = currentValue.map((key) => nodeMap.get(key)).filter(Boolean) as TreeNode[];
  const singleNode = selectedNodes[0];

  return (
    <div
      ref={rootRef}
      data-part="root"
      className={cx('z-tree-select', className, classNames?.root)}
      data-open={open ? 'true' : 'false'}
      data-size={size}
      data-disabled={disabled ? true : undefined}
      onKeyDown={onRootKeyDown}
    >
      <div
        ref={triggerRef}
        data-part="trigger"
        className={cx('z-tree-select-trigger', classNames?.trigger)}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel ?? placeholderText}
        aria-haspopup="tree"
        aria-expanded={open}
        aria-controls={panelId}
        aria-disabled={disabled ? true : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) closePanel(true);
          else setOpen(true);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {multiple ? (
          <span data-part="tags" className={cx('z-tree-select-tags', classNames?.tags)}>
            {selectedNodes.map((node) => (
              <span key={node.key} data-part="tag" className="z-tree-select-tag">
                <span className="z-tree-select-tag-label">{node.title}</span>
                <button
                  type="button"
                  data-part="remove"
                  className="z-tree-select-tag-remove"
                  aria-label={locale.accessibility.removeItem.replace(
                    '{item}',
                    titleText(node.title, node.key)
                  )}
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTag(node.key);
                  }}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
            {selectedNodes.length === 0 ? (
              <span data-part="placeholder" className="z-tree-select-placeholder">
                {placeholderText}
              </span>
            ) : null}
          </span>
        ) : singleNode ? (
          <span data-part="value" className="z-tree-select-value">
            {singleNode.title}
          </span>
        ) : (
          <span data-part="placeholder" className="z-tree-select-placeholder">
            {placeholderText}
          </span>
        )}

        <span data-part="arrow" className="z-tree-select-arrow" aria-hidden="true">
          <ArrowDownIcon />
        </span>
      </div>

      <FloatingPanel
        open={open}
        anchorRef={rootRef}
        matchWidth
        offsetVariable="--z-tree-select-panel-margin-top"
      >
        <div
          ref={panelRef}
          id={panelId}
          data-part="panel"
          className={cx('z-tree-select-panel', classNames?.panel)}
          data-open={open ? 'true' : 'false'}
        >
          {data.length === 0 ? (
            <div data-part="empty" className="z-tree-select-empty">
              {locale.empty.description}
            </div>
          ) : (
            <ul role="tree" className="z-tree-select-tree" onKeyDown={onTreeKeyDown}>
              {data.map((node) => renderNode(node, 1))}
            </ul>
          )}
        </div>
      </FloatingPanel>
    </div>
  );
}
