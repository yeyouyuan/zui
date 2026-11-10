import type { CSSProperties, ReactNode } from 'react';
import { useNodeLogic } from './BuilderLogicRuntime';
import type { BuilderNodeLogic } from './builder-logic';
import {
  builderStyleKey,
  designCss,
  type BuilderDesign,
  type BuilderNodeMeta,
  type BuilderStateDesign,
} from './builder-design';

export function BuilderDesignFrame({
  id,
  design,
  meta,
  editing,
  dragRef,
  children,
  layoutStyle,
  component,
  states,
  logic,
}: {
  id: string;
  design?: BuilderDesign;
  meta?: BuilderNodeMeta;
  editing?: boolean;
  dragRef?: ((element: Element | null) => void) | null;
  children: ReactNode;
  layoutStyle?: CSSProperties;
  component?: string;
  states?: BuilderStateDesign;
  logic?: BuilderNodeLogic;
}) {
  const { visible, disabled, events } = useNodeLogic(logic, editing);
  if ((meta?.hidden && !editing) || !visible) return null;
  const css = designCss(id, design, states);
  return (
    <div
      ref={dragRef}
      id={meta?.htmlId || undefined}
      title={meta?.title || undefined}
      aria-label={meta?.ariaLabel || undefined}
      role={meta?.ariaLabel ? 'group' : undefined}
      inert={disabled || undefined}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (!editing && logic?.click?.length) {
          event.stopPropagation();
          if ((event.target as Element).closest('a')) event.preventDefault();
        }
        events('click', event.target);
      }}
      onChange={(event) => {
        if (!editing && logic?.change?.length) event.stopPropagation();
        events('change', event.target);
      }}
      onSubmit={(event) => {
        if (!editing && logic?.submit?.length) {
          event.stopPropagation();
          event.preventDefault();
        }
        events('submit', event.target);
      }}
      className="z-builder-element"
      style={layoutStyle}
      data-builder-component={component}
      data-builder-node={builderStyleKey(id)}
      data-builder-hidden={meta?.hidden || undefined}
      data-builder-locked={meta?.locked || undefined}
    >
      {meta?.hidden ? (
        <div className="z-builder-hidden-placeholder">
          已隐藏 · {meta.label || '组件'}（导出时不显示）
        </div>
      ) : (
        children
      )}
      {css && <style>{css}</style>}
    </div>
  );
}
