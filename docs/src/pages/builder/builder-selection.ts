import { builderId, type BuilderData } from './builder-model';
import {
  effectiveStyles,
  validateDesign,
  type BuilderBreakpoint,
  type BuilderDesign,
  type BuilderNodeMeta,
  type BuilderStyles,
} from './builder-design';
import {
  checkedStructure,
  childNodes,
  cloneNode,
  flattenNodes,
  updateZone,
  type BuilderNode,
} from './builder-tree';

export function selectionRoots(data: BuilderData, ids: string[]) {
  const wanted = new Set(ids),
    entries = flattenNodes(data.content);
  return entries.filter((entry) => {
    if (!wanted.has(entry.node.props.id)) return false;
    let parent = entry.parent;
    while (parent) {
      if (wanted.has(parent.props.id)) return false;
      const id = parent.props.id;
      parent = entries.find(({ node }) => node.props.id === id)?.parent || null;
    }
    return true;
  });
}
export function isNodeLocked(data: BuilderData, id: string): boolean {
  const entries = flattenNodes(data.content);
  let entry = entries.find(({ node }) => node.props.id === id);
  while (entry) {
    if ((entry.node.props._editor as BuilderNodeMeta | undefined)?.locked) return true;
    const parentId = entry.parent?.props.id;
    entry = entries.find(({ node }) => node.props.id === parentId);
  }
  return false;
}
function assertEditable(data: BuilderData, ids: string[]) {
  if (!ids.length) throw new Error('请先选择组件。');
  if (ids.some((id) => isNodeLocked(data, id)))
    throw new Error('选择中包含锁定图层，请先解锁；没有修改任何组件。');
}
export function mapBuilderNodes(
  nodes: BuilderNode[],
  change: (node: BuilderNode) => BuilderNode
): BuilderNode[] {
  return nodes.map((node) =>
    change(
      Array.isArray(node.props.content)
        ? { ...node, props: { ...node.props, content: mapBuilderNodes(childNodes(node), change) } }
        : node
    )
  );
}
export function styleSelection(
  data: BuilderData,
  ids: string[],
  breakpoint: BuilderBreakpoint,
  patch: BuilderStyles
): BuilderData {
  assertEditable(data, ids);
  validateDesign({ [breakpoint]: patch });
  const roots = new Set(selectionRoots(data, ids).map(({ node }) => node.props.id));
  return checkedStructure({
    ...data,
    content: mapBuilderNodes(data.content, (node) => {
      if (!roots.has(node.props.id)) return node;
      const design = (node.props._design || {}) as BuilderDesign;
      return {
        ...node,
        props: {
          ...node.props,
          _design: { ...design, [breakpoint]: { ...design[breakpoint], ...patch } },
        },
      };
    }),
  });
}
export function deleteSelection(data: BuilderData, ids: string[]): BuilderData {
  assertEditable(data, ids);
  const selected = new Set(selectionRoots(data, ids).map(({ node }) => node.props.id));
  const remove = (nodes: BuilderNode[]): BuilderNode[] =>
    nodes
      .filter((node) => !selected.has(node.props.id))
      .map((node) =>
        Array.isArray(node.props.content)
          ? { ...node, props: { ...node.props, content: remove(childNodes(node)) } }
          : node
      );
  return checkedStructure({ ...data, content: remove(data.content) });
}
export function duplicateSelection(data: BuilderData, ids: string[]) {
  assertEditable(data, ids);
  const roots = selectionRoots(data, ids),
    wanted = new Set(roots.map(({ node }) => node.props.id));
  const created: string[] = [];
  const visit = (nodes: BuilderNode[]): BuilderNode[] =>
    nodes.flatMap((node) => {
      if (wanted.has(node.props.id)) {
        const copy = cloneNode(node);
        created.push(copy.props.id);
        return [node, copy];
      }
      return [
        Array.isArray(node.props.content)
          ? { ...node, props: { ...node.props, content: visit(childNodes(node)) } }
          : node,
      ];
    });
  return { data: checkedStructure({ ...data, content: visit(data.content) }), ids: created };
}
export function groupSelection(
  data: BuilderData,
  ids: string[],
  breakpoint: BuilderBreakpoint,
  layout: BuilderStyles = { display: 'flex', flexDirection: 'column', gap: 16 }
) {
  assertEditable(data, ids);
  const roots = selectionRoots(data, ids);
  if (roots.length < 2 || roots.some((entry) => entry.zone !== roots[0].zone))
    throw new Error('分组需要选择同一父容器中的至少两个组件。');
  const selected = new Set(roots.map(({ node }) => node.props.id));
  const id = builderId('Container');
  const group: BuilderNode = {
    type: 'Container',
    props: {
      id,
      _editor: { label: '布局组' },
      _design: {
        desktop: { display: 'flex', flexDirection: 'column', gap: 16 },
        [breakpoint]: layout,
      },
      content: roots.map(({ node }) => node),
    },
  };
  const next = updateZone(data, roots[0].zone, (nodes) =>
    nodes.flatMap((node) =>
      node.props.id === roots[0].node.props.id ? [group] : selected.has(node.props.id) ? [] : [node]
    )
  );
  return { data: checkedStructure(next), id };
}
export interface SelectionRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export type AlignSelection =
  'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeX' | 'distributeY';
export function alignSelection(
  data: BuilderData,
  ids: string[],
  breakpoint: BuilderBreakpoint,
  rects: SelectionRect[],
  operation: AlignSelection
) {
  assertEditable(data, ids);
  const roots = selectionRoots(data, ids);
  if (roots.length < 2 || roots.some((entry) => entry.zone !== roots[0].zone))
    throw new Error('对齐需要选择同一父容器中的至少两个组件。');
  if (
    roots.some(
      ({ node }) =>
        effectiveStyles((node.props._design || {}) as BuilderDesign, breakpoint).position !==
        'absolute'
    )
  )
    throw new Error('请先使用“转为自由布局组”，或将同级组件设为绝对定位，再进行坐标对齐。');
  if (operation.startsWith('distribute') && roots.length < 3)
    throw new Error('等距分布需要至少三个组件。');
  const selected = roots.map(({ node }) => {
    const rect = rects.find((item) => item.id === node.props.id);
    if (!rect) throw new Error('有组件在当前内容视图中不可见，请展开所在视图后重试。');
    return rect;
  });
  const horizontal = ['left', 'centerX', 'right', 'distributeX'].includes(operation);
  const axis = horizontal ? 'x' : 'y',
    size = horizontal ? 'width' : 'height';
  const ordered = [...selected].sort((a, b) => a[axis] - b[axis]);
  const start = Math.min(...selected.map((r) => r[axis])),
    end = Math.max(...selected.map((r) => r[axis] + r[size]));
  const gap = (end - start - selected.reduce((sum, r) => sum + r[size], 0)) / (selected.length - 1);
  let cursor = start,
    next = data;
  for (const rect of ordered) {
    const value = operation.startsWith('distribute')
      ? cursor
      : ['left', 'top'].includes(operation)
        ? start
        : ['right', 'bottom'].includes(operation)
          ? end - rect[size]
          : (start + end - rect[size]) / 2;
    next = styleSelection(next, [rect.id], breakpoint, {
      [horizontal ? 'left' : 'top']: `${Math.round(value * 100) / 100}px`,
      [horizontal ? 'right' : 'bottom']: 'auto',
    });
    cursor += rect[size] + gap;
  }
  return next;
}
export function freeLayoutSelection(
  data: BuilderData,
  ids: string[],
  breakpoint: BuilderBreakpoint,
  rects: SelectionRect[]
) {
  const roots = selectionRoots(data, ids);
  const selected = roots.map(({ node }) => {
    const rect = rects.find((item) => item.id === node.props.id);
    if (!rect) throw new Error('请先展开所选组件所在的内容视图。');
    return rect;
  });
  const x = Math.min(...selected.map((r) => r.x)),
    y = Math.min(...selected.map((r) => r.y));
  const width = Math.max(...selected.map((r) => r.x + r.width)) - x,
    height = Math.max(...selected.map((r) => r.y + r.height)) - y;
  const grouped = groupSelection(data, ids, breakpoint, {
    position: 'relative',
    width: `${Math.ceil(width)}px`,
    height: `${Math.ceil(height)}px`,
    display: 'block',
  });
  let next = grouped.data;
  for (const rect of selected)
    next = styleSelection(next, [rect.id], breakpoint, {
      position: 'absolute',
      left: `${Math.round(rect.x - x)}px`,
      top: `${Math.round(rect.y - y)}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
      marginTop: 0,
      marginLeft: 0,
      marginRight: 0,
      marginBottom: 0,
    });
  // A desktop composition starts with a usable small-screen flow, which stays editable.
  if (breakpoint === 'desktop') {
    next = styleSelection(next, [grouped.id], 'mobile', {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      width: '100%',
      height: 'auto',
    });
    for (const rect of selected)
      next = styleSelection(next, [rect.id], 'mobile', {
        position: 'static',
        left: 'auto',
        top: 'auto',
        width: '100%',
        height: 'auto',
      });
  }
  return { data: checkedStructure(next), id: grouped.id };
}
