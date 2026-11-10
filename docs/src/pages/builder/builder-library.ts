import { builderId, validateBuilderData } from './builder-model';
import type { BuilderData } from './builder-model';
import type { BuilderDataSource } from './builder-data-sources';
import type { BuilderToken } from './builder-tokens';
import type { BuilderVariable } from './builder-logic';
import { flattenNodes, type BuilderNode } from './builder-tree';

export interface SavedBuilderBlock {
  id: string;
  name: string;
  node: BuilderNode;
  sources: BuilderDataSource[];
  tokens?: BuilderToken[];
  variables?: BuilderVariable[];
}
export const BLOCK_LIBRARY_KEY = 'zui-builder-blocks-v1';
export function parseBlockLibrary(raw: string): SavedBuilderBlock[] {
  const input = JSON.parse(raw);
  if (!Array.isArray(input) || input.length > 20) throw new Error('区块库最多保存 20 个区块。');
  return input.map((item) => {
    if (
      !item ||
      typeof item.name !== 'string' ||
      !item.name ||
      item.name.length > 80 ||
      typeof item.id !== 'string'
    )
      throw new Error('区块名称不正确。');
    const clean = validateBuilderData({
      root: {
        props: {
          datasets: item.sources || [],
          tokens: item.tokens || [],
          variables: item.variables || [],
        },
      },
      content: [item.node],
    });
    return {
      id: item.id,
      name: item.name,
      node: clean.content[0],
      sources: clean.root.props?.datasets || [],
      tokens: clean.root.props?.tokens || [],
      variables: clean.root.props?.variables || [],
    };
  });
}
export function createSavedBlock(
  name: string,
  node: BuilderNode,
  sources: BuilderDataSource[],
  dependencies?: { tokens?: BuilderToken[]; variables?: BuilderVariable[] }
): SavedBuilderBlock {
  const ids = new Set(
    flattenNodes([node])
      .map(({ node: item }) => item.props.source)
      .filter(Boolean)
  );
  const standalone = structuredClone(node);
  for (const { node: child } of flattenNodes([standalone])) delete child.props._instance;
  return {
    id: builderId('block'),
    name: name.trim().slice(0, 80),
    node: standalone,
    sources: structuredClone(sources.filter((source) => ids.has(source.id))),
    tokens: structuredClone(dependencies?.tokens || []),
    variables: structuredClone(dependencies?.variables || []),
  };
}
export function mergeSavedBlockData(
  block: SavedBuilderBlock,
  node: BuilderNode,
  data: BuilderData
): BuilderData {
  const tokens = data.root.props?.tokens || [],
    variables = data.root.props?.variables || [];
  for (const token of block.tokens || [])
    if (tokens.some((item) => item.key === token.key && item.type !== token.type))
      throw new Error(`区块设计变量 ${token.key} 类型冲突。`);
  for (const variable of block.variables || [])
    if (
      variables.some(
        (item) => item.key === variable.key && typeof item.initial !== typeof variable.initial
      )
    )
      throw new Error(`区块状态 ${variable.key} 类型冲突。`);
  return {
    ...data,
    root: {
      ...data.root,
      props: {
        ...data.root.props,
        datasets: mergeBlockSources(block, node, data.root.props?.datasets || []),
        tokens: [
          ...tokens,
          ...(block.tokens || []).filter((token) => !tokens.some((item) => item.key === token.key)),
        ],
        variables: [
          ...variables,
          ...(block.variables || []).filter(
            (variable) => !variables.some((item) => item.key === variable.key)
          ),
        ],
      },
    },
  };
}
/** A reusable block brings its data without replacing an existing data source. */
export function mergeBlockSources(
  block: SavedBuilderBlock,
  node: BuilderNode,
  existing: BuilderDataSource[]
) {
  const sources = structuredClone(existing);
  const aliases = new Map<string, string>();
  for (const source of block.sources) {
    const same = sources.find((item) => item.id === source.id);
    if (same && JSON.stringify(same) === JSON.stringify(source)) continue;
    let id = source.id,
      suffix = 1;
    while (sources.some((item) => item.id === id)) id = `${source.id.slice(0, 50)}-${suffix++}`;
    aliases.set(source.id, id);
    sources.push({ ...structuredClone(source), id });
  }
  for (const entry of flattenNodes([node]))
    if (typeof entry.node.props.source === 'string')
      entry.node.props.source = aliases.get(entry.node.props.source) || entry.node.props.source;
  return sources;
}
