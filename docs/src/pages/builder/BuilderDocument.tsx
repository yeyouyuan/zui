import {
  createElement,
  useMemo,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import type { SlotComponent } from '@puckeditor/core';
import { builderConfig } from './builder-config';
import { childNodes, type BuilderNode } from './builder-tree';
import { componentProps, type BuilderData } from './builder-model';
import { BuilderLogicProvider, useLogicRuntime } from './BuilderLogicRuntime';
import { resolveLogicValue, type BuilderNodeLogic } from './builder-logic';

/** A small renderer for the public document; it does not ship Puck's editor or drag engine. */
function DocumentNodes({ nodes }: { nodes: BuilderNode[] }) {
  return (
    <>
      {nodes.map((node) => (
        <DocumentNode key={node.props.id} node={node} />
      ))}
    </>
  );
}
function DocumentNode({ node }: { node: BuilderNode }) {
  const { scope } = useLogicRuntime();
  const config = builderConfig.components[node.type];
  if (!config) throw new Error(`未注册的组件：${node.type}`);
  const resolved = { ...node.props };
  for (const binding of (node.props._logic as BuilderNodeLogic | undefined)?.bindings || []) {
    const value = resolveLogicValue(binding.value, scope),
      schema = componentProps[node.type]?.[binding.property];
    if (schema === 'boolean') resolved[binding.property] = value === true;
    else if (
      schema?.startsWith('range:') ||
      ['number', 'percent', 'spacing', 'columns', 'width', 'imageHeight', 'rows'].includes(schema)
    ) {
      const numeric = Number(value),
        [, min, max] = schema.split(':').map(Number);
      resolved[binding.property] = Number.isFinite(numeric)
        ? schema.startsWith('range:')
          ? Math.max(min, Math.min(max, numeric))
          : numeric
        : config.defaultProps?.[binding.property];
    } else if (schema?.includes('|'))
      resolved[binding.property] = schema.split('|').includes(String(value))
        ? value
        : config.defaultProps?.[binding.property];
    else resolved[binding.property] = String(value ?? '');
  }
  // Keep the slot component type stable when state changes, preserving input focus
  // and native widget state inside nested layout containers.
  const Slot = useMemo(
    () =>
      (({
        as: As = 'div',
        minEmptyHeight: _minHeight,
        ...props
      }: HTMLAttributes<HTMLElement> & { as?: ElementType; minEmptyHeight?: number }) =>
        createElement(As, props, <DocumentNodes nodes={childNodes(node)} />)) as SlotComponent,
    [node]
  );
  return createElement(config.render, {
    key: node.props.id,
    ...config.defaultProps,
    ...resolved,
    ...(node.type === 'Splitter'
      ? {
          _splitterPanels: childNodes(node).map((child) => (
            <DocumentNodes key={child.props.id} nodes={[child]} />
          )),
        }
      : {}),
    ...(node.type === 'Tabs'
      ? {
          _panelValues: childNodes(node)
            .filter((child) => child.type === 'TabPanel')
            .map((child) => child.props.value),
        }
      : {}),
    ...(config.fields?.content?.type === 'slot' ? { content: Slot } : {}),
    puck: { isEditing: false, dragRef: null },
  });
}

export function BuilderDocument({
  data,
  designPreview = false,
  navigate,
}: {
  data: BuilderData;
  designPreview?: boolean;
  navigate?: (pageId: string) => boolean;
}): ReactNode {
  const content = (
    <div data-builder-runtime-content>
      <DocumentNodes nodes={data.content} />
    </div>
  );
  const Root = builderConfig.root?.render;
  const document = Root
    ? createElement(Root, {
        ...builderConfig.root?.defaultProps,
        ...data.root.props,
        id: 'root',
        children: content,
        puck: {
          isEditing: designPreview,
          dragRef: null,
          metadata: {},
          renderDropZone: () => <></>,
        },
      })
    : content;
  return (
    <BuilderLogicProvider
      key={data.root.props?.dataKey || 'page'}
      variables={data.root.props?.variables}
      navigate={navigate}
    >
      {document}
    </BuilderLogicProvider>
  );
}
