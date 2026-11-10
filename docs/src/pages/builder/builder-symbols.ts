import type { BuilderData, BuilderWorkspace } from './builder-model';
import { builderId, validateBuilderData } from './builder-model';
import { childNodes, flattenNodes, remapNodeAnchors, type BuilderNode } from './builder-tree';
import type { BuilderNodeMeta } from './builder-design';
import { isNodeLocked, mapBuilderNodes } from './builder-selection';
import { createSavedBlock, mergeBlockSources } from './builder-library';
import type { BuilderDataSource } from './builder-data-sources';
import type { BuilderToken } from './builder-tokens';
import type { BuilderVariable } from './builder-logic';

export interface BuilderInstance {
  symbolId: string;
  variantId: string;
  version: number;
  mapping: Record<string, string>;
  anchors?: Record<string, string>;
}
export interface BuilderSymbolVariant {
  id: string;
  name: string;
  node: BuilderNode;
}
export interface BuilderSymbol {
  id: string;
  name: string;
  version: number;
  variants: BuilderSymbolVariant[];
  sources: BuilderDataSource[];
  tokens: BuilderToken[];
  variables: BuilderVariable[];
}
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function validateInstance(value: unknown): BuilderInstance {
  if (
    !plain(value) ||
    Object.keys(value).some(
      (key) => !['symbolId', 'variantId', 'version', 'mapping', 'anchors'].includes(key)
    ) ||
    typeof value.symbolId !== 'string' ||
    value.symbolId.length > 150 ||
    typeof value.variantId !== 'string' ||
    value.variantId.length > 150 ||
    typeof value.version !== 'number' ||
    !Number.isInteger(value.version) ||
    value.version < 1 ||
    !plain(value.mapping) ||
    Object.keys(value.mapping).length > 500
  )
    throw new Error('组件实例信息无效。');
  const mapping: Record<string, string> = {};
  for (const [key, id] of Object.entries(value.mapping)) {
    if (
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      key.length > 150 ||
      typeof id !== 'string' ||
      id.length > 150
    )
      throw new Error('组件实例节点映射无效。');
    Object.defineProperty(mapping, key, {
      value: id,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  if (new Set(Object.values(mapping)).size !== Object.values(mapping).length)
    throw new Error('组件实例包含重复节点映射。');
  let anchors: Record<string, string> | undefined;
  if (value.anchors !== undefined) {
    if (!plain(value.anchors) || Object.keys(value.anchors).length > 500)
      throw new Error('组件实例锚点映射无效。');
    anchors = {};
    for (const [key, anchor] of Object.entries(value.anchors)) {
      if (
        !key ||
        !/^[\w\u4e00-\u9fff-]{1,100}$/.test(key) ||
        ['__proto__', 'constructor', 'prototype'].includes(key) ||
        typeof anchor !== 'string' ||
        !/^[\w\u4e00-\u9fff-]{1,100}$/.test(anchor)
      )
        throw new Error('组件实例锚点映射无效。');
      Object.defineProperty(anchors, key, {
        value: anchor,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return {
    symbolId: value.symbolId,
    variantId: value.variantId,
    version: value.version,
    mapping,
    ...(anchors ? { anchors } : {}),
  };
}
export function validateSymbols(value: unknown): BuilderSymbol[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('工作区最多 50 个主组件。');
  const ids = new Set<string>();
  return value.map((symbol: BuilderSymbol) => {
    if (
      !symbol ||
      typeof symbol.id !== 'string' ||
      !symbol.id ||
      symbol.id.length > 150 ||
      ids.has(symbol.id) ||
      typeof symbol.name !== 'string' ||
      !symbol.name.trim() ||
      symbol.name.length > 80 ||
      !Number.isInteger(symbol.version) ||
      symbol.version < 1 ||
      !Array.isArray(symbol.variants) ||
      !symbol.variants.length ||
      symbol.variants.length > 12
    )
      throw new Error('主组件名称、版本或变体无效。');
    ids.add(symbol.id);
    const variants = new Set<string>();
    const clean = symbol.variants.map((variant) => {
      if (
        !variant ||
        typeof variant.id !== 'string' ||
        !variant.id ||
        variant.id.length > 150 ||
        variants.has(variant.id) ||
        typeof variant.name !== 'string' ||
        !variant.name.trim() ||
        variant.name.length > 80
      )
        throw new Error('组件变体信息无效。');
      variants.add(variant.id);
      const data = validateBuilderData({
        root: {
          props: {
            datasets: symbol.sources || [],
            tokens: symbol.tokens || [],
            variables: symbol.variables || [],
          },
        },
        content: [variant.node],
      });
      if (flattenNodes(data.content).some(({ node }) => node.props._instance))
        throw new Error('主组件不能嵌套关联实例，请先解除内部实例关联。');
      return { id: variant.id, name: variant.name, node: data.content[0] };
    });
    const root = validateBuilderData({
      root: {
        props: {
          datasets: symbol.sources || [],
          tokens: symbol.tokens || [],
          variables: symbol.variables || [],
        },
      },
      content: [],
    }).root.props!;
    return {
      id: symbol.id,
      name: symbol.name,
      version: symbol.version,
      variants: clean,
      sources: root.datasets || [],
      tokens: root.tokens || [],
      variables: root.variables || [],
    };
  });
}
export function findInstance(data: BuilderData, selectedId?: string) {
  const entries = flattenNodes(data.content);
  let entry = entries.find(({ node }) => node.props.id === selectedId);
  while (entry) {
    if (entry.node.props._instance)
      return { node: entry.node, instance: entry.node.props._instance as BuilderInstance };
    const parentId = entry.parent?.props.id;
    entry = parentId ? entries.find(({ node }) => node.props.id === parentId) : undefined;
  }
  return undefined;
}
function stripInstance(node: BuilderNode): BuilderNode {
  return mapBuilderNodes([node], (item) => {
    const props = { ...item.props };
    delete props._instance;
    return { ...item, props };
  })[0];
}
function definitionFrom(node: BuilderNode, instance?: BuilderInstance) {
  const reverse = new Map(
    Object.entries(instance?.mapping || {}).map(([template, id]) => [id, template])
  );
  const definition = remapNodeAnchors(
    stripInstance(node),
    new Map(Object.entries(instance?.anchors || {}).map(([template, anchor]) => [anchor, template]))
  );
  return mapBuilderNodes([definition], (item) => ({
    ...item,
    props: { ...item.props, id: reverse.get(item.props.id) || item.props.id },
  }))[0];
}
function dependencies(node: BuilderNode, data: BuilderData) {
  const block = createSavedBlock('依赖', node, data.root.props?.datasets || []);
  // Retain named state and design variables so a cross-page instance remains interactive.
  return {
    sources: block.sources,
    tokens: structuredClone(data.root.props?.tokens || []),
    variables: structuredClone(data.root.props?.variables || []),
  };
}
export function createSymbol(name: string, node: BuilderNode, data: BuilderData): BuilderSymbol {
  if (flattenNodes([node]).some(({ node: child }) => child.props._instance))
    throw new Error('请先解除选区中的实例关联，再创建新的主组件。');
  return validateSymbols([
    {
      id: builderId('symbol'),
      name: name.trim(),
      version: 1,
      variants: [{ id: builderId('variant'), name: '默认', node: structuredClone(node) }],
      ...dependencies(node, data),
    },
  ])[0];
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function mergeProps(base: unknown, local: unknown, next: unknown): unknown {
  if (equal(base, local)) return structuredClone(next);
  if (!plain(base) || !plain(local) || !plain(next)) return structuredClone(local);
  const result = structuredClone(next);
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (['id', 'content', '_instance'].includes(key) || equal(base[key], local[key])) continue;
    if (!Object.hasOwn(local, key)) delete result[key];
    else if (plain(base[key]) && plain(local[key]) && plain(next[key]))
      result[key] = mergeProps(base[key], local[key], next[key]);
    else result[key] = structuredClone(local[key]);
  }
  return result;
}
function instantiate(
  symbol: BuilderSymbol,
  variant: BuilderSymbolVariant,
  existing?: BuilderNode,
  oldVariant?: BuilderSymbolVariant,
  reset = false
): BuilderNode {
  const previous = existing?.props._instance as BuilderInstance | undefined;
  const mapping = { ...previous?.mapping };
  const anchors = { ...previous?.anchors };
  for (const { node } of flattenNodes([variant.node])) {
    const meta = node.props._editor as BuilderNodeMeta | undefined;
    for (const anchor of [meta?.htmlId, node.type === 'Section' ? node.props.anchor : undefined])
      if (typeof anchor === 'string' && anchor && !anchors[anchor])
        anchors[anchor] = `${anchor.slice(0, 70)}-${builderId().slice(-8)}`;
  }
  const mappedVariant = remapNodeAnchors(variant.node, new Map(Object.entries(anchors)));
  const localNodes = existing ? flattenNodes([existing]) : [];
  const oldNodes = oldVariant
    ? flattenNodes([
        remapNodeAnchors(oldVariant.node, new Map(Object.entries(previous?.anchors || {}))),
      ])
    : [];
  const visit = (template: BuilderNode): BuilderNode => {
    const id =
      mapping[template.props.id] ||
      (template === mappedVariant && existing ? existing.props.id : builderId(template.type));
    mapping[template.props.id] = id;
    const old = oldNodes.find(({ node }) => node.props.id === template.props.id)?.node;
    const local = localNodes.find(({ node }) => node.props.id === id)?.node;
    const props = (
      !reset && old && local && old.type === template.type && local.type === template.type
        ? mergeProps(old.props, local.props, template.props)
        : structuredClone(template.props)
    ) as BuilderNode['props'];
    props.id = id;
    if (Array.isArray(template.props.content)) {
      const content = childNodes(template).map(visit);
      // Locally inserted children survive a master update; removed master children do not.
      if (!reset && old && local) {
        const originalIds = new Set(Object.values(previous?.mapping || {}));
        const additions = childNodes(local).filter((child) => !originalIds.has(child.props.id));
        content.push(...structuredClone(additions));
      }
      props.content = content;
    }
    return { type: template.type, props };
  };
  const result = visit(mappedVariant);
  const templateIds = new Set(flattenNodes([variant.node]).map(({ node }) => node.props.id));
  result.props._instance = {
    symbolId: symbol.id,
    variantId: variant.id,
    version: symbol.version,
    mapping: Object.fromEntries(Object.entries(mapping).filter(([id]) => templateIds.has(id))),
    anchors,
  } satisfies BuilderInstance;
  return result;
}
function withDependencies(
  data: BuilderData,
  symbol: BuilderSymbol,
  node: BuilderNode
): BuilderData {
  const sources = mergeBlockSources(
    { id: symbol.id, name: symbol.name, node, sources: symbol.sources },
    node,
    data.root.props?.datasets || []
  );
  const existingTokens = data.root.props?.tokens || [],
    existingVariables = data.root.props?.variables || [];
  // Conflicting names get an explicit error instead of silently changing instance appearance or state.
  for (const token of symbol.tokens)
    if (existingTokens.some((item) => item.key === token.key && item.type !== token.type))
      throw new Error(`目标页面的设计变量 ${token.key} 类型冲突。`);
  for (const variable of symbol.variables)
    if (
      existingVariables.some(
        (item) => item.key === variable.key && typeof item.initial !== typeof variable.initial
      )
    )
      throw new Error(`目标页面的状态 ${variable.key} 类型冲突。`);
  return {
    ...data,
    root: {
      ...data.root,
      props: {
        ...data.root.props,
        datasets: sources,
        tokens: [
          ...existingTokens,
          ...symbol.tokens.filter(
            (token) => !existingTokens.some((item) => item.key === token.key)
          ),
        ],
        variables: [
          ...existingVariables,
          ...symbol.variables.filter(
            (variable) => !existingVariables.some((item) => item.key === variable.key)
          ),
        ],
      },
    },
  };
}
export function newSymbolInstance(data: BuilderData, symbol: BuilderSymbol, variantId: string) {
  const variant = symbol.variants.find((item) => item.id === variantId);
  if (!variant) throw new Error('组件变体不存在。');
  const node = instantiate(symbol, variant);
  return { node, data: withDependencies(data, symbol, node) };
}
export function linkOriginal(
  data: BuilderData,
  symbol: BuilderSymbol,
  selectedId: string
): BuilderData {
  const variant = symbol.variants[0];
  return {
    ...data,
    content: mapBuilderNodes(data.content, (node) =>
      node.props.id !== selectedId
        ? node
        : {
            ...node,
            props: {
              ...node.props,
              _instance: {
                symbolId: symbol.id,
                variantId: variant.id,
                version: symbol.version,
                mapping: Object.fromEntries(
                  flattenNodes([node]).map(({ node }) => [node.props.id, node.props.id])
                ),
                anchors: Object.fromEntries(
                  flattenNodes([node]).flatMap(({ node: child }) =>
                    [
                      (child.props._editor as BuilderNodeMeta | undefined)?.htmlId,
                      child.type === 'Section' ? child.props.anchor : undefined,
                    ]
                      .filter((anchor): anchor is string => typeof anchor === 'string' && !!anchor)
                      .map((anchor) => [anchor, anchor])
                  )
                ),
              },
            },
          }
    ),
  };
}
export function switchSymbolVariant(
  data: BuilderData,
  rootId: string,
  symbol: BuilderSymbol,
  variantId: string,
  reset = false
): BuilderData {
  if (isNodeLocked(data, rootId)) throw new Error('请先解锁组件实例。');
  const root = flattenNodes(data.content).find(({ node }) => node.props.id === rootId)?.node;
  if (!root) throw new Error('实例不存在。');
  const previous = root.props._instance as BuilderInstance;
  const variant = symbol.variants.find((item) => item.id === variantId);
  if (!variant) throw new Error('变体不存在。');
  const next = instantiate(
    symbol,
    variant,
    root,
    symbol.variants.find((item) => item.id === previous.variantId),
    reset
  );
  const merged = withDependencies(data, symbol, next);
  return {
    ...merged,
    content: mapBuilderNodes(merged.content, (node) => (node.props.id === rootId ? next : node)),
  };
}
export function detachSymbol(data: BuilderData, rootId: string): BuilderData {
  if (isNodeLocked(data, rootId)) throw new Error('请先解锁组件实例。');
  return {
    ...data,
    content: mapBuilderNodes(data.content, (node) => {
      if (node.props.id !== rootId) return node;
      const props = { ...node.props };
      delete props._instance;
      return { ...node, props };
    }),
  };
}
export function updateSymbol(
  workspace: BuilderWorkspace,
  pageId: string,
  rootId: string,
  variantName?: string
): BuilderWorkspace {
  const page = workspace.pages.find((item) => item.id === pageId)!;
  const root = flattenNodes(page.data.content).find(({ node }) => node.props.id === rootId)?.node;
  if (!root || isNodeLocked(page.data, rootId)) throw new Error('组件实例不存在或已锁定。');
  const instance = root.props._instance as BuilderInstance;
  const previous = workspace.symbols?.find((item) => item.id === instance?.symbolId);
  if (!previous) throw new Error('关联的主组件不存在。');
  if (variantName !== undefined && (!variantName.trim() || previous.variants.length >= 12))
    throw new Error('每个主组件最多 12 个变体，名称不能为空。');
  if (flattenNodes(childNodes(root)).some(({ node: child }) => child.props._instance))
    throw new Error('主组件不支持嵌套关联实例。');
  const node = definitionFrom(root, instance);
  const variant: BuilderSymbolVariant = {
    id: variantName ? builderId('variant') : instance.variantId,
    name:
      variantName?.trim() ||
      previous.variants.find((item) => item.id === instance.variantId)?.name ||
      '默认',
    node,
  };
  const symbol = validateSymbols([
    {
      ...previous,
      version: previous.version + 1,
      ...dependencies(root, page.data),
      variants: variantName
        ? [...previous.variants, variant]
        : previous.variants.map((item) => (item.id === variant.id ? variant : item)),
    },
  ])[0];
  const pages = workspace.pages.map((entry) => {
    let data = entry.data;
    for (const { node: local } of flattenNodes(entry.data.content).filter(
      ({ node }) => (node.props._instance as BuilderInstance | undefined)?.symbolId === symbol.id
    )) {
      const localInstance = local.props._instance as BuilderInstance;
      const isOriginal = entry.id === pageId && local.props.id === rootId;
      if (!isOriginal && isNodeLocked(entry.data, local.props.id))
        throw new Error(`“${entry.name}”有锁定的关联实例，请先解锁再同步主组件。`);
      const nextVariant = symbol.variants.find(
        (item) => item.id === (isOriginal ? variant.id : localInstance.variantId)
      );
      if (!nextVariant) throw new Error('实例关联了不存在的变体。');
      const next = instantiate(
        symbol,
        nextVariant,
        local,
        previous.variants.find((item) => item.id === localInstance.variantId),
        isOriginal
      );
      data = withDependencies(data, symbol, next);
      data = {
        ...data,
        content: mapBuilderNodes(data.content, (node) =>
          node.props.id === local.props.id ? next : node
        ),
      };
    }
    validateBuilderData(data, true);
    return { ...entry, data, updatedAt: new Date().toISOString() };
  });
  return {
    ...workspace,
    pages,
    symbols: workspace.symbols!.map((item) => (item.id === symbol.id ? symbol : item)),
  };
}
