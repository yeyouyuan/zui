'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx } from '../../utils';
import './Splitter.css';

export type SplitterOrientation = 'horizontal' | 'vertical';
export type SplitterCollapseTarget = 'before' | 'after' | 'none';

export interface SplitterPanelProps extends Omit<React.ComponentPropsWithRef<'div'>, 'className'> {
  label?: string;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsedSize?: number;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  classNames?: { root?: string; content?: string };
  children?: React.ReactNode;
}

export interface SplitterHandleContext {
  index: number;
  beforePanelId: string;
  afterPanelId: string;
  beforePanelLabel: string;
  afterPanelLabel: string;
}

export interface SplitterHandleProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  | 'children'
  | 'className'
  | 'role'
  | 'aria-controls'
  | 'aria-orientation'
  | 'aria-valuemin'
  | 'aria-valuemax'
  | 'aria-valuenow'
> {
  disabled?: boolean;
  collapseTarget?: SplitterCollapseTarget;
  className?: string;
}

export interface SplitterSizesChangeDetails {
  reason: 'pointer' | 'keyboard' | 'collapse' | 'panels-change';
  handleIndex: number | null;
}

export interface SplitterResizeEndDetails {
  handleIndex: number | null;
  input: 'pointer' | 'keyboard';
  cancelled: boolean;
  requestedSizes: number[];
}

export interface SplitterProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'children' | 'className'
> {
  orientation?: SplitterOrientation;
  sizes?: number[];
  defaultSizes?: number[];
  onSizesChange?: (sizes: number[], details: SplitterSizesChangeDetails) => void;
  onResizeEnd?: (sizes: number[], details: SplitterResizeEndDetails) => void;
  handleProps?: (context: SplitterHandleContext) => SplitterHandleProps;
  className?: string;
  classNames?: { root?: string; handle?: string; handleIndicator?: string };
  children: React.ReactNode;
}

interface PanelSpec {
  key?: string;
  min: number;
  max: number;
  collapsible: boolean;
  collapsedSize: number;
  collapsed: boolean;
  initialSize?: number;
}

interface PanelRecord {
  key: string;
  element: React.ReactElement<SplitterPanelProps>;
  id: string;
  label: string;
}

interface DragSession {
  pointerId: number;
  handleIndex: number;
  startCoordinate: number;
  availableSize: number;
  startSizes: number[];
  lastRequested: number[];
  rtl: boolean;
}

interface KeyboardSession {
  handleIndex: number;
  key: string;
  lastRequested: number[];
}

interface HandleConfig {
  context: SplitterHandleContext;
  props: SplitterHandleProps;
  disabled: boolean;
  collapseTarget: SplitterCollapseTarget;
}

const EPSILON = 0.01;
const PERCENT = 100;
const round = (value: number) => Math.round(value * 10000) / 10000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function roundToPercent(values: readonly number[], targetIndex: number): number[] {
  const rounded = values.map(round);
  if (targetIndex < 0 || targetIndex >= rounded.length) return rounded;
  const residual = round(PERCENT - rounded.reduce((sum, value) => sum + value, 0));
  rounded[targetIndex] = round(rounded[targetIndex] + residual);
  return rounded;
}

function isProductionRuntime(): boolean {
  const meta = import.meta as ImportMeta & { env?: { PROD?: boolean } };
  if (meta.env?.PROD !== undefined) return meta.env.PROD;
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return runtime.process?.env?.NODE_ENV === 'production';
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

function finitePercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validSpecs(specs: readonly PanelSpec[]): boolean {
  if (specs.length === 0) return true;
  if (
    specs.some(
      (spec) =>
        !finitePercent(spec.min) ||
        !finitePercent(spec.max) ||
        spec.min > spec.max ||
        !finitePercent(spec.collapsedSize) ||
        spec.collapsedSize > spec.max ||
        (spec.initialSize !== undefined && !finitePercent(spec.initialSize))
    )
  )
    return false;
  const minimum = specs.reduce(
    (total, spec) => total + (spec.collapsed ? spec.collapsedSize : spec.min),
    0
  );
  const maximum = specs.reduce(
    (total, spec) => total + (spec.collapsed ? spec.collapsedSize : spec.max),
    0
  );
  return minimum <= PERCENT + EPSILON && maximum >= PERCENT - EPSILON;
}

function fallbackSizes(specs: readonly PanelSpec[]): number[] {
  if (specs.length === 0) return [];
  const result = specs.map((spec) =>
    spec.collapsed && finitePercent(spec.collapsedSize) ? spec.collapsedSize : 0
  );
  const active = specs
    .map((spec, index) => (!spec.collapsed ? index : -1))
    .filter((index) => index >= 0);
  const collapsedTotal = result.reduce((sum, value) => sum + value, 0);
  if (active.length === 0 || collapsedTotal >= PERCENT) {
    if (collapsedTotal > EPSILON) {
      let target = result.length - 1;
      while (target > 0 && result[target] <= 0) target -= 1;
      return roundToPercent(
        result.map((value) => (value / collapsedTotal) * PERCENT),
        target
      );
    }
    const equal = specs.map(() => PERCENT / specs.length);
    return roundToPercent(equal, specs.length - 1);
  }
  const remaining = PERCENT - collapsedTotal;
  const share = remaining / active.length;
  for (const index of active) result[index] = share;
  return roundToPercent(result, active[active.length - 1]);
}

/** Pure constraint solver used by the component tests and layout state. */
export function normalizeSplitterSizes(
  specs: readonly PanelSpec[],
  raw: readonly (number | null | undefined)[]
): number[] {
  if (specs.length === 0) return [];
  if (!validSpecs(specs)) return fallbackSizes(specs);

  const result = specs.map((spec, index) => {
    if (spec.collapsed) return spec.collapsedSize;
    const candidate = raw[index];
    const value =
      typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : spec.initialSize;
    return clamp(value ?? 0, spec.min, spec.max);
  });
  const missing = specs
    .map((spec, index) =>
      !spec.collapsed && raw[index] == null && spec.initialSize == null ? index : -1
    )
    .filter((index) => index >= 0);
  if (missing.length > 0) {
    const assigned = result.reduce(
      (sum, value, index) => (missing.includes(index) ? sum : sum + value),
      0
    );
    const share = Math.max(0, PERCENT - assigned) / missing.length;
    for (const index of missing) result[index] = clamp(share, specs[index].min, specs[index].max);
  }

  for (let pass = 0; pass < specs.length * 2; pass += 1) {
    const difference = PERCENT - result.reduce((sum, value) => sum + value, 0);
    if (Math.abs(difference) <= EPSILON) break;
    const candidates = specs
      .map((spec, index) => {
        if (spec.collapsed) return -1;
        const capacity = difference > 0 ? spec.max - result[index] : result[index] - spec.min;
        return capacity > EPSILON ? index : -1;
      })
      .filter((index) => index >= 0);
    if (candidates.length === 0) return fallbackSizes(specs);
    const share = difference / candidates.length;
    for (const index of candidates) {
      result[index] = clamp(result[index] + share, specs[index].min, specs[index].max);
    }
  }
  const residual = PERCENT - result.reduce((sum, value) => sum + value, 0);
  if (Math.abs(residual) > EPSILON) return fallbackSizes(specs);
  let target = -1;
  for (let index = specs.length - 1; index >= 0; index -= 1) {
    if (!specs[index].collapsed) {
      target = index;
      break;
    }
  }
  if (target >= 0) result[target] += residual;
  return roundToPercent(result, target >= 0 ? target : specs.length - 1);
}

function pairRange(specs: readonly PanelSpec[], sizes: readonly number[], handleIndex: number) {
  const before = specs[handleIndex];
  const after = specs[handleIndex + 1];
  const total = sizes[handleIndex] + sizes[handleIndex + 1];
  if (!before || !after || before.collapsed || after.collapsed) {
    const current = sizes[handleIndex] ?? 0;
    return { min: current, max: current };
  }
  return {
    min: Math.max(before.min, total - after.max),
    max: Math.min(before.max, total - after.min),
  };
}

function adjustPair(
  sizes: readonly number[],
  specs: readonly PanelSpec[],
  handleIndex: number,
  requestedBefore: number
): number[] {
  const before = specs[handleIndex];
  const after = specs[handleIndex + 1];
  if (!before || !after || before.collapsed || after.collapsed) return [...sizes];
  const total = sizes[handleIndex] + sizes[handleIndex + 1];
  const range = pairRange(specs, sizes, handleIndex);
  const nextBefore = clamp(requestedBefore, range.min, range.max);
  const next = [...sizes];
  next[handleIndex] = round(nextBefore);
  next[handleIndex + 1] = round(total - nextBefore);
  return next;
}

function validControlledSizes(
  values: readonly number[] | undefined,
  count: number
): values is number[] {
  return (
    values !== undefined &&
    values.length === count &&
    values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) &&
    Math.abs(values.reduce((sum, value) => sum + value, 0) - PERCENT) <= EPSILON
  );
}

function panelIdentity(element: React.ReactElement<SplitterPanelProps>, index: number): string {
  return element.key == null ? `index-${index}` : `key-${String(element.key)}`;
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.split(`{${name}}`).join(value),
    template
  );
}

function gridTemplate(sizes: readonly number[]): string {
  const tracks: string[] = [];
  sizes.forEach((size, index) => {
    if (index > 0) tracks.push('var(--z-splitter-handle-size)');
    tracks.push(`${Math.max(0, size)}fr`);
  });
  const value = tracks.join(' ');
  return value || 'minmax(0, 1fr)';
}

function resizePanel(
  sizes: readonly number[],
  specs: readonly PanelSpec[],
  panelIndex: number,
  desired: number,
  handleIndex: number
): number[] {
  const next = [...sizes];
  const current = sizes[panelIndex];
  const targetSpec = specs[panelIndex];
  const target = targetSpec.collapsed
    ? targetSpec.collapsedSize
    : clamp(desired, targetSpec.min, targetSpec.max);
  let remaining = target - current;
  if (Math.abs(remaining) <= EPSILON) return next;

  const firstDirection = panelIndex === handleIndex ? 1 : -1;
  const order: number[] = [];
  for (let distance = 1; distance < specs.length; distance += 1) {
    const preferred = panelIndex + firstDirection * distance;
    const opposite = panelIndex - firstDirection * distance;
    if (preferred >= 0 && preferred < specs.length) order.push(preferred);
    if (opposite >= 0 && opposite < specs.length) order.push(opposite);
  }

  next[panelIndex] = target;
  for (const index of order) {
    if (Math.abs(remaining) <= EPSILON || specs[index].collapsed) continue;
    if (remaining > 0) {
      const take = Math.min(remaining, next[index] - specs[index].min);
      next[index] -= take;
      remaining -= take;
    } else {
      const give = Math.min(-remaining, specs[index].max - next[index]);
      next[index] += give;
      remaining += give;
    }
  }
  if (Math.abs(remaining) > EPSILON) next[panelIndex] -= remaining;
  return next.map(round);
}

function SplitterPanel(_props: SplitterPanelProps): null {
  return null;
}
SplitterPanel.displayName = 'Splitter.Panel';

function Splitter({
  ref,
  orientation = 'horizontal',
  sizes: sizesProp,
  defaultSizes,
  onSizesChange,
  onResizeEnd,
  handleProps,
  className,
  classNames = {},
  children,
  tabIndex = -1,
  onFocusCapture,
  style,
  ...rootProps
}: SplitterProps) {
  const { locale } = useZuiConfig();
  const rootId = React.useId();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const handleRefs = React.useRef(new Map<number, HTMLDivElement>());
  const contentRefs = React.useRef(new Map<string, HTMLDivElement>());
  const warned = React.useRef(new Set<string>());
  const dragRef = React.useRef<DragSession | null>(null);
  const keyboardRef = React.useRef<KeyboardSession | null>(null);
  const availableSizeRef = React.useRef(0);
  const previousExpanded = React.useRef(new Map<string, number>());
  const pendingCollapse = React.useRef<{
    key: string;
    value: boolean;
    requested: number[];
  } | null>(null);
  const [, forceMeasurement] = React.useReducer((value) => value + 1, 0);
  const [collapseRequestVersion, advanceCollapseRequest] = React.useReducer(
    (value: number) => value + 1,
    0
  );

  const childArray: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (child !== null && child !== undefined && typeof child !== 'boolean') childArray.push(child);
  });
  const foreignChildren = childArray.filter(
    (child) => !(React.isValidElement(child) && child.type === SplitterPanel)
  );
  const panelElements = childArray.filter(
    (child): child is React.ReactElement<SplitterPanelProps> =>
      React.isValidElement(child) && child.type === SplitterPanel
  );
  const rootIdPart = safeIdPart(rootId);
  const panelRecords: PanelRecord[] = panelElements.map((element, index) => {
    const key = panelIdentity(element, index);
    const panelLabelTemplate = locale.splitter.panelLabel;
    return {
      key,
      element,
      id: element.props.id ?? `${rootIdPart}-panel-${safeIdPart(key)}`,
      label:
        element.props.label ?? formatTemplate(panelLabelTemplate, { index: String(index + 1) }),
    };
  });
  const panelKeys = panelRecords.map((panel) => panel.key);
  const panelSignature = panelKeys.join('|');

  const [internalCollapsed, setInternalCollapsed] = React.useState<Map<string, boolean>>(
    () => new Map(panelRecords.map((panel) => [panel.key, !!panel.element.props.defaultCollapsed]))
  );
  const collapsedStates = panelRecords.map((panel) =>
    panel.element.props.collapsed === undefined
      ? (internalCollapsed.get(panel.key) ?? !!panel.element.props.defaultCollapsed)
      : panel.element.props.collapsed
  );
  const collapsedSignature = collapsedStates.map((value) => (value ? '1' : '0')).join('');
  const specs: PanelSpec[] = panelRecords.map((panel, index) => ({
    key: panel.key,
    min: panel.element.props.minSize ?? 0,
    max: panel.element.props.maxSize ?? 100,
    collapsible: panel.element.props.collapsible ?? false,
    collapsedSize: panel.element.props.collapsedSize ?? 0,
    collapsed: collapsedStates[index],
    initialSize: panel.element.props.initialSize,
  }));
  const constraintsValid = validSpecs(specs);
  const initialRaw = panelRecords.map((panel, index) =>
    defaultSizes === undefined ? panel.element.props.initialSize : defaultSizes[index]
  );
  const initialSpecs =
    defaultSizes === undefined ? specs : specs.map((spec) => ({ ...spec, initialSize: undefined }));
  const initialLayout = normalizeSplitterSizes(initialSpecs, initialRaw);
  const [internalSizes, setInternalSizes] = React.useState<Map<string, number>>(
    () => new Map(panelRecords.map((panel, index) => [panel.key, initialLayout[index] ?? 0]))
  );
  const internalRaw = panelRecords.map(
    (panel, index) =>
      internalSizes.get(panel.key) ?? panel.element.props.initialSize ?? initialLayout[index]
  );
  const controlledValid = validControlledSizes(sizesProp, panelRecords.length);
  const lastValidControlled = React.useRef<number[]>(initialLayout);
  if (controlledValid) lastValidControlled.current = normalizeSplitterSizes(specs, sizesProp);
  const rawActual =
    sizesProp === undefined
      ? internalRaw
      : controlledValid
        ? sizesProp
        : lastValidControlled.current;
  const candidateSizes = normalizeSplitterSizes(specs, rawActual);
  const lastValidConstraints = React.useRef<number[]>(candidateSizes);
  const actualSizes = constraintsValid
    ? candidateSizes
    : lastValidConstraints.current.length === panelRecords.length
      ? lastValidConstraints.current
      : fallbackSizes(specs);
  if (constraintsValid) lastValidConstraints.current = candidateSizes;
  const sizesRef = React.useRef(actualSizes);
  sizesRef.current = actualSizes;

  const setInternalLayout = React.useCallback(
    (next: readonly number[]) => {
      setInternalSizes(new Map(panelRecords.map((panel, index) => [panel.key, next[index] ?? 0])));
      sizesRef.current = [...next];
    },
    // panelSignature represents the ordered key set used by the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelSignature]
  );

  const requestSizes = React.useCallback(
    (next: number[], details: SplitterSizesChangeDetails) => {
      const normalized = normalizeSplitterSizes(specs, next);
      if (sizesProp === undefined) setInternalLayout(normalized);
      onSizesChange?.(normalized, details);
      return normalized;
    },
    [onSizesChange, setInternalLayout, sizesProp, specs]
  );

  const warn = React.useCallback((message: string) => {
    if (isProductionRuntime() || warned.current.has(message)) return;
    warned.current.add(message);
    console.warn(`[ZUI Splitter] ${message}`);
  }, []);

  React.useEffect(() => {
    if (foreignChildren.length > 0) warn('children 只接受 Splitter.Panel；其他节点已忽略。');
    if (panelRecords.length > 1 && panelElements.some((element) => element.key == null))
      warn('多个 Panel 应提供稳定 React key，以便增删和重排时保留布局。');
    if (!constraintsValid)
      warn('Panel 的 minSize/maxSize/collapsedSize 约束不可行，已回退安全布局。');
    if (sizesProp !== undefined && !controlledValid)
      warn('受控 sizes 必须长度等于 Panel 数量、值非负且总和为 100；本次输入已忽略。');
  }, [
    constraintsValid,
    controlledValid,
    foreignChildren.length,
    panelElements,
    panelRecords.length,
    sizesProp,
    warn,
  ]);

  const previousPanelSignature = React.useRef(panelSignature);
  React.useEffect(() => {
    if (previousPanelSignature.current === panelSignature) return;
    previousPanelSignature.current = panelSignature;
    setInternalCollapsed((previous) => {
      const next = new Map<string, boolean>();
      panelRecords.forEach((panel) =>
        next.set(panel.key, previous.get(panel.key) ?? !!panel.element.props.defaultCollapsed)
      );
      return next;
    });
    if (sizesProp === undefined) {
      setInternalLayout(actualSizes);
      onSizesChange?.(actualSizes, { reason: 'panels-change', handleIndex: null });
    }
  }, [actualSizes, onSizesChange, panelRecords, panelSignature, setInternalLayout, sizesProp]);

  const previousCollapsedSignature = React.useRef(collapsedSignature);
  React.useEffect(() => {
    const previousSignature = previousCollapsedSignature.current;
    const pending = pendingCollapse.current;
    const pendingIndex = pending
      ? panelRecords.findIndex((panel) => panel.key === pending.key)
      : -1;
    const changedIndexes = collapsedStates
      .map((value, index) => (value !== (previousSignature[index] === '1') ? index : -1))
      .filter((index) => index >= 0);
    const acceptsOnlyPendingRequest =
      pending !== null &&
      pendingIndex >= 0 &&
      changedIndexes.length === 1 &&
      changedIndexes[0] === pendingIndex &&
      collapsedStates[pendingIndex] === pending.value;

    // 每个受控请求只允许当前 commit 接受；未改变 props 即视为拒绝，不能留给未来变化套用。
    pendingCollapse.current = null;
    if (previousSignature === collapsedSignature) return;
    previousCollapsedSignature.current = collapsedSignature;
    if (acceptsOnlyPendingRequest) {
      if (sizesProp === undefined) setInternalLayout(pending.requested);
      return;
    }
    const requested = normalizeSplitterSizes(specs, sizesRef.current);
    if (sizesProp === undefined) setInternalLayout(requested);
    onSizesChange?.(requested, { reason: 'collapse', handleIndex: null });
  }, [
    collapseRequestVersion,
    collapsedSignature,
    collapsedStates,
    onSizesChange,
    panelRecords,
    setInternalLayout,
    sizesProp,
    specs,
  ]);

  React.useLayoutEffect(() => {
    panelRecords.forEach((panel, index) => {
      if (!collapsedStates[index]) previousExpanded.current.set(panel.key, actualSizes[index]);
    });
  }, [actualSizes, collapsedStates, panelRecords]);

  if (previousExpanded.current.size === 0 && panelRecords.length > 0) {
    const expandedSpecs = initialSpecs.map((spec) => ({ ...spec, collapsed: false }));
    const expandedInitial = normalizeSplitterSizes(expandedSpecs, initialRaw);
    panelRecords.forEach((panel, index) =>
      previousExpanded.current.set(panel.key, expandedInitial[index] ?? actualSizes[index])
    );
  }

  const handleContexts: SplitterHandleContext[] = panelRecords.slice(0, -1).map((panel, index) => ({
    index,
    beforePanelId: panel.id,
    afterPanelId: panelRecords[index + 1].id,
    beforePanelLabel: panel.label,
    afterPanelLabel: panelRecords[index + 1].label,
  }));
  const handleConfigs: HandleConfig[] = handleContexts.map((context) => {
    const props = handleProps?.(context) ?? {};
    return {
      context,
      props,
      disabled: props.disabled ?? false,
      collapseTarget: props.collapseTarget ?? 'none',
    };
  });

  React.useEffect(() => {
    handleConfigs.forEach((config) => {
      if (config.collapseTarget === 'none') return;
      const panelIndex = config.context.index + (config.collapseTarget === 'after' ? 1 : 0);
      if (!specs[panelIndex]?.collapsible)
        warn(`第 ${config.context.index + 1} 个 Handle 的 collapseTarget 指向不可折叠 Panel。`);
    });
  }, [handleConfigs, specs, warn]);

  const previousCollapsedByKey = React.useRef(new Map<string, boolean>());
  React.useLayoutEffect(() => {
    panelRecords.forEach((panel, panelIndex) => {
      const before = previousCollapsedByKey.current.get(panel.key) ?? false;
      const now = collapsedStates[panelIndex];
      if (!before && now) {
        const content = contentRefs.current.get(panel.key);
        const active = typeof document === 'undefined' ? null : document.activeElement;
        const contained = !!active && !!content?.contains(active);
        if (contained) {
          const adjacent = [panelIndex, panelIndex - 1].filter(
            (handleIndex) => handleIndex >= 0 && handleIndex < handleConfigs.length
          );
          const explicit = adjacent.find((handleIndex) => {
            const config = handleConfigs[handleIndex];
            const target = handleIndex + (config.collapseTarget === 'after' ? 1 : 0);
            return !config.disabled && config.collapseTarget !== 'none' && target === panelIndex;
          });
          const fallback = adjacent.find((handleIndex) => !handleConfigs[handleIndex].disabled);
          (handleRefs.current.get(explicit ?? fallback ?? -1) ?? rootRef.current)?.focus({
            preventScroll: true,
          });
        }
      }
      previousCollapsedByKey.current.set(panel.key, now);
    });
  }, [collapsedStates, handleConfigs, panelRecords]);

  const vertical = orientation === 'vertical';
  const measureAvailable = React.useCallback(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return 0;
    const computed = window.getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    const content = vertical
      ? rect.height -
        parseFloat(computed.borderTopWidth || '0') -
        parseFloat(computed.borderBottomWidth || '0') -
        parseFloat(computed.paddingTop || '0') -
        parseFloat(computed.paddingBottom || '0')
      : rect.width -
        parseFloat(computed.borderLeftWidth || '0') -
        parseFloat(computed.borderRightWidth || '0') -
        parseFloat(computed.paddingLeft || '0') -
        parseFloat(computed.paddingRight || '0');
    const handleTotal = Array.from(handleRefs.current.values()).reduce((sum, handle) => {
      const handleRect = handle.getBoundingClientRect();
      return sum + (vertical ? handleRect.height : handleRect.width);
    }, 0);
    availableSizeRef.current = Math.max(0, content - handleTotal);
    return availableSizeRef.current;
  }, [vertical]);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    measureAvailable();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      measureAvailable();
      forceMeasurement();
    });
    observer.observe(root);
    handleRefs.current.forEach((handle) => observer.observe(handle));
    return () => observer.disconnect();
  }, [measureAvailable, panelSignature]);

  const currentDirection = (): 'ltr' | 'rtl' => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return 'ltr';
    const explicit = root.getAttribute('dir') ?? root.closest('[dir]')?.getAttribute('dir');
    if (explicit === 'ltr' || explicit === 'rtl') return explicit;
    const computed = window.getComputedStyle(root).direction;
    if (computed === 'ltr' || computed === 'rtl') return computed;
    return root.ownerDocument.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
  };

  const finishPointer = React.useCallback(
    (cancelled: boolean) => {
      const session = dragRef.current;
      if (!session) return;
      dragRef.current = null;
      handleRefs.current.get(session.handleIndex)?.removeAttribute('data-active');
      rootRef.current?.removeAttribute('data-resizing');
      delete document.documentElement.dataset.zSplitterDragging;
      const requested = cancelled
        ? requestSizes([...session.startSizes], {
            reason: 'pointer',
            handleIndex: session.handleIndex,
          })
        : session.lastRequested;
      onResizeEnd?.(
        cancelled && sizesProp === undefined ? [...session.startSizes] : [...sizesRef.current],
        {
          handleIndex: session.handleIndex,
          input: 'pointer',
          cancelled,
          requestedSizes: [...requested],
        }
      );
    },
    [onResizeEnd, requestSizes, sizesProp]
  );

  React.useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      const pointerId = dragRef.current.pointerId;
      const handle = handleRefs.current.get(dragRef.current.handleIndex);
      finishPointer(true);
      try {
        if (handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // Capture may already be gone; the cancellation still has a single owner.
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => document.removeEventListener('keydown', onDocumentKeyDown);
  }, [finishPointer]);

  React.useEffect(
    () => () => {
      dragRef.current = null;
      keyboardRef.current = null;
      delete document.documentElement.dataset.zSplitterDragging;
    },
    []
  );

  const finishKeyboard = React.useCallback(() => {
    const session = keyboardRef.current;
    if (!session) return;
    keyboardRef.current = null;
    onResizeEnd?.([...sizesRef.current], {
      handleIndex: session.handleIndex,
      input: 'keyboard',
      cancelled: false,
      requestedSizes: [...session.lastRequested],
    });
  }, [onResizeEnd]);

  const toggleCollapsed = (handleIndex: number, target: SplitterCollapseTarget): boolean => {
    if (target === 'none') return false;
    const panelIndex = handleIndex + (target === 'after' ? 1 : 0);
    const panel = panelRecords[panelIndex];
    const spec = specs[panelIndex];
    if (!panel || !spec?.collapsible) return false;
    const nextCollapsed = !collapsedStates[panelIndex];
    const targetSpecs = specs.map((item, index) =>
      index === panelIndex ? { ...item, collapsed: nextCollapsed } : item
    );
    if (nextCollapsed) previousExpanded.current.set(panel.key, actualSizes[panelIndex]);
    const desired = nextCollapsed
      ? spec.collapsedSize
      : (previousExpanded.current.get(panel.key) ?? spec.min);
    const requested = resizePanel(actualSizes, targetSpecs, panelIndex, desired, handleIndex);
    panel.element.props.onCollapsedChange?.(nextCollapsed);
    pendingCollapse.current = { key: panel.key, value: nextCollapsed, requested };
    if (panel.element.props.collapsed === undefined) {
      setInternalCollapsed((previous) => new Map(previous).set(panel.key, nextCollapsed));
      if (sizesProp === undefined) setInternalLayout(requested);
    }
    onSizesChange?.(requested, { reason: 'collapse', handleIndex });
    onResizeEnd?.(
      sizesProp === undefined && panel.element.props.collapsed === undefined
        ? requested
        : actualSizes,
      {
        handleIndex,
        input: 'keyboard',
        cancelled: false,
        requestedSizes: requested,
      }
    );
    advanceCollapseRequest();
    return true;
  };

  const rootStyle: React.CSSProperties = {
    ...style,
    ...(vertical
      ? { gridTemplateRows: gridTemplate(actualSizes) }
      : { gridTemplateColumns: gridTemplate(actualSizes) }),
  };

  return (
    <div
      {...rootProps}
      ref={(element) => {
        rootRef.current = element;
        assignRef(ref, element);
      }}
      tabIndex={tabIndex}
      data-part="root"
      data-orientation={orientation}
      className={cx('z-splitter', vertical && 'z-splitter--vertical', className, classNames.root)}
      style={rootStyle}
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
      }}
    >
      {panelRecords.map((panel, panelIndex) => {
        const element = panel.element;
        const collapsed = collapsedStates[panelIndex];
        const {
          label: _label,
          initialSize: _initialSize,
          minSize: _minSize,
          maxSize: _maxSize,
          collapsible: _collapsible,
          collapsedSize: _collapsedSize,
          collapsed: _collapsed,
          defaultCollapsed: _defaultCollapsed,
          onCollapsedChange: _onCollapsedChange,
          className: panelClassName,
          classNames: panelClassNames = {},
          children: panelChildren,
          ref: panelRef,
          id: _panelId,
          style: panelStyle,
          ...panelProps
        } = element.props;
        const panelNode = (
          <div
            {...panelProps}
            key={`panel-${panel.key}`}
            ref={(node) => assignRef(panelRef, node)}
            id={panel.id}
            data-part="panel"
            data-panel-key={panel.key}
            data-collapsed={collapsed ? 'true' : 'false'}
            className={cx('z-splitter-panel', panelClassName, panelClassNames.root)}
            style={panelStyle}
          >
            <div
              ref={(node) => {
                if (node) contentRefs.current.set(panel.key, node);
                else contentRefs.current.delete(panel.key);
              }}
              data-part="content"
              inert={collapsed ? true : undefined}
              aria-hidden={collapsed || undefined}
              className={cx('z-splitter-content', panelClassNames.content)}
            >
              {panelChildren}
            </div>
          </div>
        );
        if (panelIndex === panelRecords.length - 1) return panelNode;

        const config = handleConfigs[panelIndex];
        const range = pairRange(specs, actualSizes, panelIndex);
        const {
          disabled: _disabled,
          collapseTarget: _collapseTarget,
          className: handleClassName,
          ref: handleRef,
          tabIndex: requestedTabIndex,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
          onLostPointerCapture,
          onKeyDown,
          onKeyUp,
          onBlur,
          'aria-label': explicitLabel,
          'aria-labelledby': labelledBy,
          ...customHandleProps
        } = config.props;
        const resizeHandleTemplate = locale.splitter.resizeHandle;
        const defaultLabel =
          resizeHandleTemplate.includes('{before}') || resizeHandleTemplate.includes('{after}')
            ? formatTemplate(resizeHandleTemplate, {
                before: config.context.beforePanelLabel,
                after: config.context.afterPanelLabel,
              })
            : `${resizeHandleTemplate}: ${config.context.beforePanelLabel} / ${config.context.afterPanelLabel}`;
        const resizeBlocked = specs[panelIndex].collapsed || specs[panelIndex + 1].collapsed;
        const handleNode = (
          <div
            {...customHandleProps}
            key={`handle-${panel.key}`}
            ref={(node) => {
              if (node) handleRefs.current.set(panelIndex, node);
              else handleRefs.current.delete(panelIndex);
              assignRef(handleRef, node);
            }}
            data-part="handle"
            data-handle-index={panelIndex}
            role="separator"
            tabIndex={config.disabled ? -1 : (requestedTabIndex ?? 0)}
            aria-disabled={config.disabled || undefined}
            aria-orientation={vertical ? 'horizontal' : 'vertical'}
            aria-controls={`${config.context.beforePanelId} ${config.context.afterPanelId}`}
            aria-valuemin={Math.round(range.min)}
            aria-valuemax={Math.round(range.max)}
            aria-valuenow={Math.round(actualSizes[panelIndex])}
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : (explicitLabel ?? defaultLabel)}
            className={cx('z-splitter-handle', classNames.handle, handleClassName)}
            onPointerDown={(event) => {
              onPointerDown?.(event);
              if (
                event.defaultPrevented ||
                config.disabled ||
                resizeBlocked ||
                dragRef.current !== null ||
                event.button !== 0 ||
                event.isPrimary === false
              )
                return;
              const available = measureAvailable();
              if (available <= 0) return;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              } catch {
                return;
              }
              const session: DragSession = {
                pointerId: event.pointerId,
                handleIndex: panelIndex,
                startCoordinate: vertical ? event.clientY : event.clientX,
                availableSize: available,
                startSizes: [...actualSizes],
                lastRequested: [...actualSizes],
                rtl: !vertical && currentDirection() === 'rtl',
              };
              dragRef.current = session;
              event.currentTarget.setAttribute('data-active', 'true');
              rootRef.current?.setAttribute('data-resizing', '');
              document.documentElement.dataset.zSplitterDragging = orientation;
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              onPointerMove?.(event);
              if (event.defaultPrevented) return;
              const session = dragRef.current;
              if (!session || session.pointerId !== event.pointerId) return;
              const coordinate = vertical ? event.clientY : event.clientX;
              let delta =
                ((coordinate - session.startCoordinate) / session.availableSize) * PERCENT;
              if (session.rtl) delta = -delta;
              const requested = adjustPair(
                session.startSizes,
                specs,
                panelIndex,
                session.startSizes[panelIndex] + delta
              );
              session.lastRequested = requestSizes(requested, {
                reason: 'pointer',
                handleIndex: panelIndex,
              });
            }}
            onPointerUp={(event) => {
              onPointerUp?.(event);
              if (event.defaultPrevented) return;
              const session = dragRef.current;
              if (!session || session.pointerId !== event.pointerId) return;
              finishPointer(false);
              try {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                // The completion callback already has single ownership.
              }
            }}
            onPointerCancel={(event) => {
              onPointerCancel?.(event);
              if (event.defaultPrevented) return;
              const session = dragRef.current;
              if (!session || session.pointerId !== event.pointerId) return;
              finishPointer(true);
            }}
            onLostPointerCapture={(event) => {
              onLostPointerCapture?.(event);
              if (event.defaultPrevented) return;
              const session = dragRef.current;
              if (session && session.pointerId === event.pointerId) finishPointer(true);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.defaultPrevented || config.disabled) return;
              if (event.key === 'Enter') {
                // 长按 Enter 的自动重复仍属于同一次切换。
                if (!event.repeat && toggleCollapsed(panelIndex, config.collapseTarget))
                  event.preventDefault();
                return;
              }
              if (resizeBlocked) return;
              const rtl = !vertical && currentDirection() === 'rtl';
              let delta: number | null = null;
              let absolute: number | null = null;
              if (vertical && event.key === 'ArrowDown') delta = 1;
              else if (vertical && event.key === 'ArrowUp') delta = -1;
              else if (!vertical && event.key === 'ArrowRight') delta = rtl ? -1 : 1;
              else if (!vertical && event.key === 'ArrowLeft') delta = rtl ? 1 : -1;
              else if (event.key === 'PageUp') delta = -10;
              else if (event.key === 'PageDown') delta = 10;
              else if (event.key === 'Home') absolute = range.min;
              else if (event.key === 'End') absolute = range.max;
              else return;
              const base =
                keyboardRef.current?.handleIndex === panelIndex
                  ? keyboardRef.current.lastRequested
                  : actualSizes;
              const requested = adjustPair(
                base,
                specs,
                panelIndex,
                absolute ?? base[panelIndex] + (delta ?? 0)
              );
              const normalized = requestSizes(requested, {
                reason: 'keyboard',
                handleIndex: panelIndex,
              });
              keyboardRef.current = {
                handleIndex: panelIndex,
                key:
                  keyboardRef.current?.handleIndex === panelIndex
                    ? keyboardRef.current.key
                    : event.key,
                lastRequested: normalized,
              };
              event.preventDefault();
            }}
            onKeyUp={(event) => {
              onKeyUp?.(event);
              if (event.defaultPrevented) return;
              if (
                keyboardRef.current?.handleIndex === panelIndex &&
                keyboardRef.current.key === event.key
              )
                finishKeyboard();
            }}
            onBlur={(event) => {
              onBlur?.(event);
              if (event.defaultPrevented) return;
              if (keyboardRef.current?.handleIndex === panelIndex) finishKeyboard();
            }}
          >
            <span
              data-part="handle-indicator"
              aria-hidden="true"
              className={cx('z-splitter-handle-indicator', classNames.handleIndicator)}
            />
          </div>
        );
        return (
          <React.Fragment key={`pair-${panel.key}`}>
            {panelNode}
            {handleNode}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const SplitterRoot = Object.assign(Splitter, { Panel: SplitterPanel });

export { SplitterRoot as Splitter, SplitterPanel };
