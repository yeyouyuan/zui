import type { BuilderData } from './builder-model';
import { builderId, validateBuilderData } from './builder-model';
import type { BuilderNodeMeta } from './builder-design';
import { catalogContainerTypes } from './builder-catalog-data';
import type { BuilderInstance } from './builder-symbols';

export type BuilderNode = BuilderData['content'][number];
export const ROOT_ZONE = 'root:default-zone';
export const containerTypes = new Set([
  'Section',
  'Columns',
  'Container',
  'Form',
  'Card',
  'AppShell',
  'AppView',
  ...catalogContainerTypes,
]);
export function childNodes(node: BuilderNode): BuilderNode[] {
  return Array.isArray(node.props.content) ? (node.props.content as BuilderNode[]) : [];
}
export function flattenNodes(
  nodes: BuilderNode[],
  parent: BuilderNode | null = null,
  depth = 0
): {
  node: BuilderNode;
  parent: BuilderNode | null;
  index: number;
  depth: number;
  zone: string;
}[] {
  return nodes.flatMap((node, index) => [
    { node, parent, index, depth, zone: parent ? `${parent.props.id}:content` : ROOT_ZONE },
    ...flattenNodes(childNodes(node), node, depth + 1),
  ]);
}
export function nodeLabel(node: BuilderNode, fallback: string) {
  return (
    (node.props._editor as BuilderNodeMeta | undefined)?.label ||
    String(
      node.props.title ||
        node.props.label ||
        node.props.caption ||
        node.props.text ||
        (typeof node.props.children === 'string' ? node.props.children : '') ||
        fallback
    ).slice(0, 36)
  );
}
export function cloneNode(node: BuilderNode): BuilderNode {
  const next = structuredClone(node);
  const anchors = new Map<string, string>();
  const nodes = flattenNodes([next]).map(({ node: child }) => child);
  const aliases = new Map<string, string>();
  for (const child of nodes) {
    const previousId = child.props.id;
    child.props.id = builderId(child.type);
    aliases.set(previousId, child.props.id);
    const meta = child.props._editor as BuilderNodeMeta | undefined;
    for (const anchor of [
      meta?.htmlId,
      child.type === 'Section' ? child.props.anchor : undefined,
    ]) {
      if (typeof anchor === 'string' && anchor)
        anchors.set(anchor, `${anchor.slice(0, 70)}-${builderId().slice(-8)}`);
    }
  }
  for (const child of nodes) {
    const instance = child.props._instance as BuilderInstance | undefined;
    if (instance) {
      instance.mapping = Object.fromEntries(
        Object.entries(instance.mapping).map(([template, id]) => [template, aliases.get(id) || id])
      );
      if (instance.anchors)
        instance.anchors = Object.fromEntries(
          Object.entries(instance.anchors).map(([template, anchor]) => [
            template,
            anchors.get(anchor) || anchor,
          ])
        );
    }
  }
  return remapNodeAnchors(next, anchors);
}
/** Rewrites both anchor declarations and local links without changing component IDs. */
export function remapNodeAnchors(node: BuilderNode, anchors: Map<string, string>): BuilderNode {
  const next = structuredClone(node);
  for (const { node: child } of flattenNodes([next])) {
    const meta = child.props._editor as BuilderNodeMeta | undefined;
    if (meta?.htmlId) meta.htmlId = anchors.get(meta.htmlId) || meta.htmlId;
    if (typeof child.props.anchor === 'string')
      child.props.anchor = anchors.get(child.props.anchor) || child.props.anchor;
    if (typeof child.props.targetId === 'string')
      child.props.targetId = anchors.get(child.props.targetId) || child.props.targetId;
    const updateLinks = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(updateLinks);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          key === 'href' && typeof entry === 'string' && entry.startsWith('#')
            ? `#${anchors.get(entry.slice(1)) || entry.slice(1)}`
            : key === 'content'
              ? entry
              : updateLinks(entry),
        ])
      );
    };
    child.props = updateLinks(child.props) as BuilderNode['props'];
  }
  return next;
}
export function updateZone(
  data: BuilderData,
  zone: string,
  change: (nodes: BuilderNode[]) => BuilderNode[]
): BuilderData {
  if (zone === ROOT_ZONE) return { ...data, content: change(data.content) };
  const id = zone.slice(0, -':content'.length);
  const visit = (nodes: BuilderNode[]): BuilderNode[] =>
    nodes.map((node) => {
      if (node.props.id === id)
        return { ...node, props: { ...node.props, content: change(childNodes(node)) } };
      if (Array.isArray(node.props.content))
        return { ...node, props: { ...node.props, content: visit(childNodes(node)) } };
      return node;
    });
  return { ...data, content: visit(data.content) };
}
export function insertNode(
  data: BuilderData,
  node: BuilderNode,
  zone: string,
  index: number
): BuilderData {
  return updateZone(data, zone, (nodes) => [...nodes.slice(0, index), node, ...nodes.slice(index)]);
}
export function checkedStructure(data: BuilderData): BuilderData {
  const checkForms = (nodes: BuilderNode[], insideForm = false) => {
    for (const node of nodes) {
      if (insideForm && node.type === 'Form') throw new Error('表单不能放入另一个表单中。');
      checkForms(childNodes(node), insideForm || node.type === 'Form');
    }
  };
  checkForms(data.content);
  validateBuilderData(data, true);
  return data;
}
