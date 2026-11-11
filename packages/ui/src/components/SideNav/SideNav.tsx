'use client';

import * as React from 'react';
import { useZuiConfig } from '../../config';
import { cx, floatingPosition, Portal } from '../../utils';
import './SideNav.css';

export interface SideNavLinkItem {
  key: string;
  label: React.ReactNode;
  textValue?: string;
  href: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  linkProps?: Omit<
    React.ComponentPropsWithoutRef<'a'>,
    'href' | 'children' | 'className' | 'aria-current' | 'tabIndex'
  >;
}

export interface SideNavGroupItem {
  key: string;
  label: React.ReactNode;
  textValue?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  children: readonly SideNavLinkItem[];
}

export type SideNavItem = SideNavLinkItem | SideNavGroupItem;
export interface SideNavSection {
  key: string;
  label?: React.ReactNode;
  items: readonly SideNavItem[];
}
export type SideNavExpandedChangeDetails =
  { reason: 'toggle' | 'current'; key: string } | { reason: 'items-change'; removedKeys: string[] };
export type SideNavLinkRenderProps = Omit<React.ComponentPropsWithRef<'a'>, 'href' | 'children'> & {
  href: string;
  children: React.ReactNode;
  ref: React.Ref<HTMLAnchorElement>;
  'data-part': 'link';
  'data-key': string;
};
export interface SideNavProps extends Omit<
  React.ComponentPropsWithRef<'nav'>,
  'children' | 'className' | 'onSelect'
> {
  sections: readonly SideNavSection[];
  currentKey?: string | null;
  onNavigate?: (
    key: string,
    item: SideNavLinkItem,
    event: React.MouseEvent<HTMLAnchorElement>
  ) => void;
  expandedKeys?: readonly string[];
  defaultExpandedKeys?: readonly string[];
  onExpandedKeysChange?: (keys: string[], details: SideNavExpandedChangeDetails) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsible?: boolean;
  renderLink?: (item: SideNavLinkItem, props: SideNavLinkRenderProps) => React.ReactElement;
  className?: string;
  classNames?: Partial<
    Record<
      | 'root'
      | 'viewport'
      | 'section'
      | 'sectionLabel'
      | 'list'
      | 'item'
      | 'link'
      | 'groupToggle'
      | 'groupIndicator'
      | 'icon'
      | 'label'
      | 'badge'
      | 'children'
      | 'flyout'
      | 'tooltip'
      | 'collapseToggle',
      string
    >
  >;
}

type Entry = { item: SideNavItem; parent: string | null; list: string; enabled: boolean };
type FocusRecord = {
  key: string;
  element: HTMLElement;
  parent: string | null;
  listKeys: string[];
  topKeys: string[];
  collapsed: boolean;
  flyout: boolean;
};
const useClientLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;
const isGroup = (item: SideNavItem): item is SideNavGroupItem => 'children' in item;
const hasDestination = (item: SideNavLinkItem) => !!item.href?.trim() && !item.disabled;

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (
    React.isValidElement<{
      children?: React.ReactNode;
      'aria-hidden'?: boolean | 'true' | 'false';
    }>(node)
  ) {
    return node.props['aria-hidden'] === true || node.props['aria-hidden'] === 'true'
      ? ''
      : textOf(node.props.children);
  }
  return '';
}

function hasInteractive(node: React.ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasInteractive);
  if (
    !React.isValidElement<{
      children?: React.ReactNode;
      tabIndex?: number;
      contentEditable?: unknown;
    }>(node)
  )
    return false;
  return (
    (typeof node.type === 'string' &&
      ['a', 'button', 'input', 'select', 'textarea', 'summary', 'iframe'].includes(node.type)) ||
    (node.props.tabIndex !== undefined && node.props.tabIndex >= 0) ||
    !!node.props.contentEditable ||
    hasInteractive(node.props.children)
  );
}

function usable(element: HTMLElement | null | undefined): element is HTMLElement {
  return (
    !!element?.isConnected &&
    !element.matches(':disabled, [aria-disabled="true"]') &&
    !element.closest('[hidden], [inert]') &&
    getComputedStyle(element).visibility !== 'hidden' &&
    element.getClientRects().length > 0
  );
}

function focus(element: HTMLElement | null | undefined) {
  if (!usable(element)) return false;
  element.focus({ preventScroll: true });
  return element.ownerDocument.activeElement === element;
}

/** Native same-context navigation intent; the Router still handles its own click last. */
function ordinaryNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.hasAttribute('download')
  )
    return false;
  const target = event.currentTarget.target;
  if (!target || target.toLowerCase() === '_self') return true;
  if (typeof window === 'undefined') return false;
  return (
    target === window.name ||
    (target.toLowerCase() === '_parent' && window.parent === window) ||
    (target.toLowerCase() === '_top' && window.top === window)
  );
}

function outsideNext(root: HTMLElement, flyout: HTMLElement | null) {
  const candidates = root.ownerDocument.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, [tabindex], summary, [contenteditable="true"]'
  );
  return Array.from(candidates).find(
    (element) =>
      element.tabIndex >= 0 &&
      usable(element) &&
      !root.contains(element) &&
      !flyout?.contains(element) &&
      !!(root.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
}

function isProductionRuntime(): boolean {
  const meta = import.meta as ImportMeta & { env?: { PROD?: boolean } };
  if (meta.env?.PROD !== undefined) return meta.env.PROD;
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return runtime.process?.env?.NODE_ENV === 'production';
}

/** Fixed positioning uses this instance's direction and never scrolls ancestors. */
function FloatingSurface({
  rootRef,
  anchor,
  className,
  children,
  visual,
  onReady,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  rootRef: React.RefObject<HTMLElement | null>;
  anchor: HTMLElement | undefined;
  visual?: boolean;
  onReady?: (element: HTMLDivElement) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const ready = React.useRef(onReady);
  ready.current = onReady;
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    direction: 'ltr' | 'rtl';
  }>();
  useClientLayoutEffect(() => {
    const element = ref.current;
    const root = rootRef.current;
    if (!element || !root || !anchor) return;
    const update = () => {
      const direction = getComputedStyle(root).direction === 'rtl' ? 'rtl' : 'ltr';
      const rect = anchor.getBoundingClientRect();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const gap = 8;
      const next = floatingPosition(
        rect,
        { width, height },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
        {
          side: direction === 'rtl' ? 'left' : 'right',
          align: 'start',
          offset: gap,
          margin: gap,
        }
      );
      setPosition((previous) =>
        previous?.left === next.left &&
        previous.top === next.top &&
        previous.direction === direction
          ? previous
          : { left: next.left, top: next.top, direction }
      );
    };
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
    observer?.observe(element);
    observer?.observe(root);
    const mutations = new MutationObserver(scheduleUpdate);
    const mutationOptions: MutationObserverInit = {
      attributes: true,
      attributeFilter: ['class', 'style', 'dir', 'data-theme'],
    };
    // 触发器自身可能因布局/动画修改 class/style；根节点需要覆盖子树，
    // 但只观察会影响几何/方向的属性，避免 characterData/childList 全量开销。
    mutations.observe(root, { ...mutationOptions, subtree: true });
    for (let source = root.parentElement; source; source = source.parentElement)
      mutations.observe(source, mutationOptions);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [anchor, rootRef]);
  const positioned = !!position;
  useClientLayoutEffect(() => {
    if (positioned && ref.current) ready.current?.(ref.current);
  }, [positioned, anchor]);
  return (
    <div
      {...props}
      ref={ref}
      className={className}
      aria-hidden={visual || undefined}
      dir={position?.direction}
      style={{
        ...props.style,
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** 侧边导航：原生 nav/ul/li/a 语义 + 分组 disclosure + 桌面收窄 flyout（RFC-002）。 */
export function SideNav({
  ref: forwardedRef,
  sections,
  currentKey,
  onNavigate,
  expandedKeys,
  defaultExpandedKeys = [],
  onExpandedKeysChange,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  collapsible = true,
  renderLink,
  className,
  classNames = {},
  'aria-labelledby': labelledBy,
  'aria-label': ariaLabel,
  tabIndex = -1,
  onFocusCapture,
  onKeyDown,
  onKeyDownCapture,
  onPointerDownCapture,
  ...navProps
}: SideNavProps) {
  const { locale } = useZuiConfig();
  const id = React.useId();
  const viewportId = `${id}-viewport`;
  const rootRef = React.useRef<HTMLElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const collapseRef = React.useRef<HTMLButtonElement>(null);
  const flyoutRef = React.useRef<HTMLDivElement | null>(null);
  const topRefs = React.useRef(new Map<string, HTMLElement>());
  const linkRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const focused = React.useRef<FocusRecord | null>(null);
  const modality = React.useRef('keyboard');
  const keyboardOpen = React.useRef(false);
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const [openFlyoutKey, setOpenFlyoutKey] = React.useState<string | null>(null);
  const [tooltipKey, setTooltipKey] = React.useState<string | null>(null);

  const model = React.useMemo(() => {
    const entries = new Map<string, Entry>();
    const known = new Map<string, SideNavItem>();
    const groups: string[] = [];
    const top: string[] = [];
    const lists = new Map<string, string[]>();
    const warnings: string[] = [];
    const seen = new Set<string>();
    const acceptKey = (key: string) => {
      if (!key?.trim() || seen.has(key)) {
        warnings.push(!key?.trim() ? 'Keys must be nonempty.' : `Duplicate key: ${key}`);
        return false;
      }
      seen.add(key);
      return true;
    };
    const checkContent = (item: SideNavItem, topLevel: boolean) => {
      if (typeof item.label !== 'string' && typeof item.label !== 'number' && !item.textValue)
        warnings.push(`Complex label requires textValue: ${item.key}`);
      if ([item.label, item.icon, item.badge].some(hasInteractive))
        warnings.push(`Navigation content must not be interactive: ${item.key}`);
      if (topLevel && (collapsible || collapsed) && !item.icon)
        warnings.push(`Collapsible top-level item requires an icon: ${item.key}`);
    };
    const cleaned: SideNavSection[] = [];
    for (const section of sections) {
      if (!acceptKey(section.key)) continue;
      const items: SideNavItem[] = [];
      const listKey = `section:${section.key}`;
      const list: string[] = [];
      for (const item of section.items) {
        if (!acceptKey(item.key)) continue;
        known.set(item.key, item);
        checkContent(item, true);
        if (isGroup(item)) {
          const children = item.children.filter((child) => {
            if (!acceptKey(child.key)) return false;
            known.set(child.key, child);
            checkContent(child, false);
            if (!child.href?.trim()) {
              warnings.push(`Link requires href: ${child.key}`);
              return false;
            }
            return true;
          });
          if (!children.length) {
            warnings.push(`Empty group: ${item.key}`);
            continue;
          }
          const enabled = !item.disabled && children.some(hasDestination);
          if (!children.some(hasDestination))
            warnings.push(`Group has no available destination: ${item.key}`);
          const group = { ...item, children };
          entries.set(item.key, { item: group, parent: null, list: listKey, enabled });
          const childList = `group:${item.key}`;
          lists.set(
            childList,
            children.filter((child) => enabled && hasDestination(child)).map((child) => child.key)
          );
          children.forEach((child) =>
            entries.set(child.key, {
              item: child,
              parent: item.key,
              list: childList,
              enabled: enabled && hasDestination(child),
            })
          );
          if (enabled) groups.push(item.key);
          items.push(group);
          if (enabled) {
            top.push(item.key);
            list.push(item.key);
          }
        } else {
          if (!item.href?.trim()) {
            warnings.push(`Link requires href: ${item.key}`);
            continue;
          }
          const enabled = hasDestination(item);
          entries.set(item.key, { item, parent: null, list: listKey, enabled });
          items.push(item);
          if (enabled) {
            top.push(item.key);
            list.push(item.key);
          }
        }
      }
      lists.set(listKey, list);
      if (items.length) cleaned.push({ ...section, items });
      else warnings.push(`Empty section: ${section.key}`);
    }
    return { sections: cleaned, entries, known, groups, top, lists, warnings };
  }, [sections, collapsible, collapsed]);
  const ordered = React.useCallback(
    (keys: readonly string[]) => model.groups.filter((key) => keys.includes(key)),
    [model.groups]
  );
  const currentEntry = currentKey ? model.entries.get(currentKey) : undefined;
  const current = currentEntry?.enabled && !isGroup(currentEntry.item) ? currentEntry : undefined;
  const resolution = current ? JSON.stringify([current.item.key, current.parent]) : null;
  const [internalExpanded, setInternalExpanded] = React.useState(() =>
    ordered([...defaultExpandedKeys, ...(current?.parent ? [current.parent] : [])])
  );
  const expanded = React.useMemo(
    () => ordered(expandedKeys ?? internalExpanded),
    [expandedKeys, internalExpanded, ordered]
  );
  const validFlyout = openFlyoutKey ? model.entries.get(openFlyoutKey) : undefined;
  const flyoutGroup =
    collapsed && validFlyout?.enabled && isGroup(validFlyout.item) ? validFlyout.item : null;
  const tooltip =
    collapsed && !flyoutGroup && tooltipKey ? model.entries.get(tooltipKey)?.item : undefined;
  const mounted = React.useRef(false);
  const lastResolution = React.useRef<string | null>(null);
  const lastScrollTarget = React.useRef<string | null>(null);
  const previousCurrent = React.useRef(currentKey);
  const warned = React.useRef(new Set<string>());

  const fallbackTop = React.useCallback(
    (record: Pick<FocusRecord, 'key' | 'topKeys'>) => {
      const index = record.topKeys.indexOf(record.key);
      for (const key of record.topKeys.slice(index + 1)) if (focus(topRefs.current.get(key))) return;
      for (const key of record.topKeys.slice(0, index).reverse())
        if (focus(topRefs.current.get(key))) return;
      if (!focus(collapseRef.current)) focus(rootRef.current);
    },
    []
  );

  const openFlyoutKeyRef = React.useRef(openFlyoutKey);
  openFlyoutKeyRef.current = openFlyoutKey;
  const closeFlyout = React.useCallback(
    (reason: 'escape' | 'navigation' | 'outside' | 'tab') => {
      const oldFlyout = flyoutRef.current;
      const oldFocus = rootRef.current?.ownerDocument.activeElement;
      const triggerKey = openFlyoutKeyRef.current;
      const trigger = triggerKey ? topRefs.current.get(triggerKey) : undefined;
      setOpenFlyoutKey(null);
      setTooltipKey(null);
      // Route focus and the new pointer target belong to the application.
      if (reason === 'navigation' || reason === 'outside') focused.current = null;
      if (reason === 'escape') focus(trigger);
      if (reason === 'navigation') {
        requestAnimationFrame(() => {
          const active = rootRef.current?.ownerDocument.activeElement;
          if (
            active &&
            (active === document.body ||
              oldFlyout?.contains(active) ||
              (active === oldFocus && !active.isConnected))
          )
            focus(rootRef.current);
        });
      }
    },
    []
  );

  // Resolution identity resets while unknown/filtered, so asynchronous reappearance is a new cycle.
  useClientLayoutEffect(() => {
    let next = ordered(internalExpanded);
    const removedKeys = internalExpanded.filter((key) => !model.groups.includes(key));
    if (
      expandedKeys === undefined &&
      (removedKeys.length || next.join('\0') !== internalExpanded.join('\0'))
    ) {
      setInternalExpanded(next);
      if (removedKeys.length)
        onExpandedKeysChange?.(next, {
          reason: 'items-change',
          removedKeys: [...new Set(removedKeys)],
        });
    }
    if (resolution !== lastResolution.current) {
      lastResolution.current = resolution;
      lastScrollTarget.current = null;
      if (current?.parent && !expanded.includes(current.parent)) {
        next = ordered([...(expandedKeys === undefined ? next : expanded), current.parent]);
        if (expandedKeys === undefined) setInternalExpanded(next);
        if (expandedKeys !== undefined || mounted.current)
          onExpandedKeysChange?.(next, { reason: 'current', key: current.parent });
      }
    }
    mounted.current = true;
    if (previousCurrent.current !== currentKey) {
      previousCurrent.current = currentKey;
      if (openFlyoutKey) closeFlyout('navigation');
    }
    if (openFlyoutKey && !flyoutGroup) {
      setOpenFlyoutKey(null);
      setTooltipKey(null);
    }
    if (!collapsed && tooltipKey) setTooltipKey(null);
  }, [
    closeFlyout,
    collapsed,
    current,
    currentKey,
    expanded,
    expandedKeys,
    flyoutGroup,
    internalExpanded,
    model.groups,
    onExpandedKeysChange,
    openFlyoutKey,
    ordered,
    resolution,
    tooltipKey,
  ]);

  useClientLayoutEffect(() => {
    const record = focused.current;
    if (!record) return;
    const active = record.element.ownerDocument.activeElement;
    if (active !== record.element && active !== record.element.ownerDocument.body) return;
    const entry = model.entries.get(record.key);
    if (usable(record.element)) {
      if (entry) {
        record.parent = entry.parent;
        record.listKeys = model.lists.get(entry.list) ?? [];
        record.topKeys = [...model.top];
        record.collapsed = collapsed;
        record.flyout = !!flyoutRef.current?.contains(record.element);
      }
      return;
    }
    const sameKey = entry?.enabled
      ? entry.parent
        ? linkRefs.current.get(record.key)
        : topRefs.current.get(record.key)
      : undefined;
    if (focus(sameKey)) return;
    if (
      record.parent &&
      (collapsed || record.flyout || (entry && !expanded.includes(record.parent)))
    ) {
      if (focus(topRefs.current.get(record.parent))) return;
      if (collapsed) {
        fallbackTop({ key: record.parent, topKeys: record.topKeys });
        return;
      }
      if (!focus(collapseRef.current)) focus(rootRef.current);
      return;
    }
    if (record.collapsed && !record.parent) {
      fallbackTop(record);
      return;
    }
    const index = record.listKeys.indexOf(record.key);
    for (const key of record.listKeys.slice(index + 1))
      if (focus(linkRefs.current.get(key) ?? topRefs.current.get(key))) return;
    for (const key of record.listKeys.slice(0, index).reverse())
      if (focus(linkRefs.current.get(key) ?? topRefs.current.get(key))) return;
    if (record.parent && focus(topRefs.current.get(record.parent))) return;
    if (!focus(collapseRef.current)) focus(rootRef.current);
  }, [collapsed, expanded, fallbackTop, model]);

  useClientLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!current || !viewport || !resolution) return;
    const useParent = !!current.parent && (collapsed || !expanded.includes(current.parent));
    const targetKey = useParent ? current.parent! : current.item.key;
    const target =
      collapsed || useParent ? topRefs.current.get(targetKey) : linkRefs.current.get(targetKey);
    const identity = JSON.stringify([resolution, collapsed, targetKey]);
    if (lastScrollTarget.current === identity || !target || !viewport.contains(target)) return;
    lastScrollTarget.current = identity;
    const bounds = viewport.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = bounds.top + viewport.clientTop;
    const bottom = top + viewport.clientHeight;
    if (rect.top < top) viewport.scrollTop += rect.top - top;
    else if (rect.bottom > bottom) viewport.scrollTop += rect.bottom - bottom;
  }, [collapsed, current, expanded, resolution]);

  React.useEffect(() => {
    if (isProductionRuntime()) return;
    const messages = [...model.warnings];
    if (currentKey && model.known.has(currentKey) && !current)
      messages.push(`currentKey is a group or disabled destination: ${currentKey}`);
    for (const key of expandedKeys ?? internalExpanded)
      if (model.known.has(key) && !isGroup(model.known.get(key)!))
        messages.push(`expandedKeys contains a link: ${key}`);
    for (const message of messages)
      if (!warned.current.has(message)) {
        warned.current.add(message);
        console.warn(`[ZUI SideNav] ${message}`);
      }
  }, [model, currentKey, current, expandedKeys, internalExpanded]);

  React.useEffect(() => {
    const pointer = (event: PointerEvent) => {
      modality.current = event.pointerType;
      const target = event.target as Node;
      if (
        openFlyoutKey &&
        !rootRef.current?.contains(target) &&
        !flyoutRef.current?.contains(target)
      )
        closeFlyout('outside');
    };
    const keyboard = () => {
      modality.current = 'keyboard';
    };
    const movedFocus = (event: FocusEvent) => {
      const target = event.target as Node;
      if (
        target !== document.body &&
        !rootRef.current?.contains(target) &&
        !flyoutRef.current?.contains(target)
      ) {
        focused.current = null;
        setTooltipKey(null);
        if (openFlyoutKey) closeFlyout('outside');
      }
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('focusin', movedFocus);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('focusin', movedFocus);
    };
  }, [closeFlyout, openFlyoutKey]);

  const recordFocus = (event: React.FocusEvent<HTMLElement>) => {
    onFocusCapture?.(event);
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
    const key = element?.dataset.key;
    const entry = key ? model.entries.get(key) : undefined;
    if (!element || !key || !entry) {
      focused.current = null;
      return;
    }
    focused.current = {
      key,
      element,
      parent: entry.parent,
      listKeys: model.lists.get(entry.list) ?? [],
      topKeys: [...model.top],
      collapsed,
      flyout: !!flyoutRef.current?.contains(element),
    };
    if (
      collapsed &&
      !entry.parent &&
      !flyoutGroup &&
      modality.current !== 'touch' &&
      modality.current !== 'pen'
    )
      setTooltipKey(key);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      setTooltipKey(null);
      if (flyoutGroup) {
        event.preventDefault();
        event.stopPropagation();
        closeFlyout('escape');
      }
      return;
    }
    if (event.key !== 'Tab' || !flyoutGroup) return;
    const element = event.target as HTMLElement;
    const key = element.closest<HTMLElement>('[data-key]')?.dataset.key;
    const children = flyoutGroup.children.filter(hasDestination);
    if (key === flyoutGroup.key) {
      if (event.shiftKey) closeFlyout('tab');
      else if (focus(linkRefs.current.get(children[0]?.key))) event.preventDefault();
      return;
    }
    const index = children.findIndex((item) => item.key === key);
    if (index < 0) return;
    if (event.shiftKey && index === 0) {
      if (focus(topRefs.current.get(flyoutGroup.key))) {
        event.preventDefault();
        closeFlyout('tab');
      }
    } else if (event.shiftKey || index < children.length - 1) {
      const nextChild = children[index + (event.shiftKey ? -1 : 1)];
      if (focus(linkRefs.current.get(nextChild?.key))) event.preventDefault();
    } else {
      const topIndex = model.top.indexOf(flyoutGroup.key);
      const candidates = [
        ...model.top.slice(topIndex + 1).map((itemKey) => topRefs.current.get(itemKey)),
        collapseRef.current,
        rootRef.current ? outsideNext(rootRef.current, flyoutRef.current) : undefined,
      ];
      const moved = candidates.some((candidate) => focus(candidate));
      if (moved) {
        event.preventDefault();
        closeFlyout('tab');
      } else
        setTimeout(() => {
          // Let the browser move focus out of the document. The removed flyout
          // must not be interpreted as a dynamic-data loss that restores focus.
          focused.current = null;
          closeFlyout('tab');
        }, 0);
    }
  };

  const toggleGroup = (group: SideNavGroupItem, event: React.MouseEvent<HTMLButtonElement>) => {
    setTooltipKey(null);
    if (collapsed) {
      keyboardOpen.current = event.detail === 0;
      setOpenFlyoutKey((key) => (key === group.key ? null : group.key));
    } else {
      const next = expanded.includes(group.key)
        ? expanded.filter((key) => key !== group.key)
        : ordered([...expanded, group.key]);
      if (expanded.includes(group.key) && focused.current?.parent === group.key)
        focus(topRefs.current.get(group.key));
      if (expandedKeys === undefined) setInternalExpanded(next);
      onExpandedKeysChange?.(next, { reason: 'toggle', key: group.key });
    }
  };

  const content = (item: SideNavItem, topLevel: boolean) => (
    <>
      {(item.icon || (topLevel && (collapsible || collapsed))) && (
        <span data-part="icon" aria-hidden="true" className={cx('z-sidenav-icon', classNames.icon)}>
          {item.icon ?? <span className="z-sidenav-icon-placeholder" />}
        </span>
      )}
      <span data-part="label" className={cx('z-sidenav-label', classNames.label)}>
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span data-part="badge" className={cx('z-sidenav-badge', classNames.badge)}>
          {item.badge}
        </span>
      )}
    </>
  );
  const pointerTip = (key: string) => ({
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
      if (collapsed && !flyoutGroup && event.pointerType === 'mouse') setTooltipKey(key);
    },
    onPointerLeave: () => setTooltipKey(null),
    onBlur: () => setTooltipKey(null),
  });

  const renderLeaf = (item: SideNavLinkItem, parent: string | null = null) => {
    const entry = model.entries.get(item.key)!;
    const active = current?.item.key === item.key;
    const children = content(item, !parent);
    const linkClass = cx('z-sidenav-link', classNames.link);
    let node: React.ReactNode;
    if (!entry.enabled)
      node = (
        <span data-part="link" data-key={item.key} className={linkClass} aria-disabled="true">
          {children}
        </span>
      );
    else {
      const supplied = item.linkProps ?? {};
      const name = item.textValue
        ? [item.textValue, textOf(item.badge)].filter(Boolean).join(' ')
        : undefined;
      const props: SideNavLinkRenderProps = {
        ...supplied,
        ...(!parent ? pointerTip(item.key) : {}),
        'aria-labelledby': supplied['aria-labelledby'],
        'aria-label': supplied['aria-labelledby'] ? undefined : (supplied['aria-label'] ?? name),
        href: item.href,
        children,
        className: linkClass,
        'aria-current': active ? 'page' : undefined,
        'data-part': 'link',
        'data-key': item.key,
        tabIndex: 0,
        ref: (element) => {
          if (element) {
            linkRefs.current.set(item.key, element);
            if (!parent) topRefs.current.set(item.key, element);
          } else {
            linkRefs.current.delete(item.key);
            if (!parent) topRefs.current.delete(item.key);
          }
        },
        onClick: (event) => {
          supplied.onClick?.(event);
          if (!ordinaryNavigation(event)) return;
          onNavigate?.(item.key, item, event);
          if (!event.defaultPrevented && flyoutGroup) closeFlyout('navigation');
        },
        onBlur: (event) => {
          supplied.onBlur?.(event);
          if (!parent) setTooltipKey(null);
        },
        onPointerEnter: (event) => {
          supplied.onPointerEnter?.(event);
          if (!parent && collapsed && !flyoutGroup && event.pointerType === 'mouse')
            setTooltipKey(item.key);
        },
        onPointerLeave: (event) => {
          supplied.onPointerLeave?.(event);
          setTooltipKey(null);
        },
      };
      node = renderLink ? renderLink(item, props) : <a {...props} />;
    }
    return (
      <li
        key={item.key}
        data-part="item"
        data-current={active || undefined}
        className={cx('z-sidenav-item', classNames.item)}
      >
        {node}
      </li>
    );
  };

  const renderGroup = (group: SideNavGroupItem) => {
    const entry = model.entries.get(group.key)!;
    const open = collapsed ? flyoutGroup?.key === group.key : expanded.includes(group.key);
    const childId = `${id}-group-${encodeURIComponent(group.key)}`;
    const flyoutId = `${id}-flyout-${encodeURIComponent(group.key)}`;
    return (
      <li
        key={group.key}
        data-part="item"
        data-expanded={open}
        data-current-descendant={current?.parent === group.key || undefined}
        className={cx('z-sidenav-item', classNames.item)}
      >
        <button
          {...pointerTip(group.key)}
          type="button"
          data-part="group-toggle"
          data-key={group.key}
          className={cx('z-sidenav-group-toggle', classNames.groupToggle)}
          disabled={!entry.enabled}
          ref={(element) => {
            if (element) topRefs.current.set(group.key, element);
            else topRefs.current.delete(group.key);
          }}
          aria-label={
            group.textValue
              ? [group.textValue, textOf(group.badge)].filter(Boolean).join(' ')
              : undefined
          }
          aria-expanded={!!open}
          aria-controls={collapsed ? (open ? flyoutId : undefined) : childId}
          onClick={(event) => toggleGroup(group, event)}
        >
          {content(group, true)}
          <span
            data-part="group-indicator"
            aria-hidden="true"
            className={cx('z-sidenav-group-indicator', classNames.groupIndicator)}
          >
            <svg viewBox="0 0 16 16">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </span>
        </button>
        {!collapsed && (
          <ul
            id={childId}
            data-part="children"
            hidden={!open}
            className={cx('z-sidenav-children', classNames.children)}
          >
            {group.children.map((item) => renderLeaf(item, group.key))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav
      {...navProps}
      ref={(element) => {
        rootRef.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      tabIndex={tabIndex}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : (ariaLabel ?? locale.sideNav.navigation)}
      data-part="root"
      data-collapsed={collapsed}
      className={cx('z-sidenav', classNames.root, className)}
      onFocusCapture={recordFocus}
      onKeyDown={handleKeyDown}
      onKeyDownCapture={(event) => {
        modality.current = 'keyboard';
        onKeyDownCapture?.(event);
      }}
      onPointerDownCapture={(event) => {
        modality.current = event.pointerType;
        onPointerDownCapture?.(event);
      }}
    >
      <div
        ref={viewportRef}
        id={viewportId}
        data-part="viewport"
        className={cx('z-sidenav-viewport', classNames.viewport)}
      >
        {model.sections.map((section) => {
          const labelId = `${id}-section-${encodeURIComponent(section.key)}`;
          const hasLabel =
            section.label !== undefined && section.label !== null && section.label !== '';
          return (
            <div
              key={section.key}
              data-part="section"
              role={hasLabel ? 'group' : undefined}
              aria-labelledby={hasLabel ? labelId : undefined}
              className={cx('z-sidenav-section', classNames.section)}
            >
              {hasLabel && (
                <div
                  id={labelId}
                  data-part="section-label"
                  className={cx('z-sidenav-section-label', classNames.sectionLabel)}
                >
                  {section.label}
                </div>
              )}
              <ul data-part="list" className={cx('z-sidenav-list', classNames.list)}>
                {section.items.map((item) =>
                  isGroup(item) ? renderGroup(item) : renderLeaf(item)
                )}
              </ul>
            </div>
          );
        })}
      </div>
      {collapsible && (
        <button
          ref={collapseRef}
          type="button"
          data-part="collapse-toggle"
          className={cx('z-sidenav-collapse-toggle', classNames.collapseToggle)}
          aria-label={collapsed ? locale.sideNav.expand : locale.sideNav.collapse}
          aria-expanded={!collapsed}
          aria-controls={viewportId}
          onClick={() => {
            if (controlledCollapsed === undefined) setInternalCollapsed(!collapsed);
            onCollapsedChange?.(!collapsed);
            setTooltipKey(null);
          }}
        >
          <span aria-hidden="true" className="z-sidenav-collapse-icon">
            <svg viewBox="0 0 20 20">
              <path d="m11 5-5 5 5 5M16 4v12" />
            </svg>
          </span>
          <span className="z-sidenav-label">
            {collapsed ? locale.sideNav.expand : locale.sideNav.collapse}
          </span>
        </button>
      )}
      {flyoutGroup && (
        <Portal inheritFrom={rootRef}>
          <FloatingSurface
            key={flyoutGroup.key}
            rootRef={rootRef}
            anchor={topRefs.current.get(flyoutGroup.key)}
            data-part="flyout"
            className={cx('z-sidenav-flyout', classNames.flyout)}
            role="navigation"
            aria-labelledby={`${id}-flyout-label-${encodeURIComponent(flyoutGroup.key)}`}
            onReady={(element) => {
              flyoutRef.current = element;
              if (keyboardOpen.current) {
                keyboardOpen.current = false;
                focus(linkRefs.current.get(flyoutGroup.children.find(hasDestination)!.key));
              }
            }}
          >
            <div
              role="group"
              aria-labelledby={`${id}-flyout-label-${encodeURIComponent(flyoutGroup.key)}`}
            >
              <div
                id={`${id}-flyout-label-${encodeURIComponent(flyoutGroup.key)}`}
                className="z-sidenav-flyout-label"
              >
                {flyoutGroup.label}
              </div>
              <ul
                id={`${id}-flyout-${encodeURIComponent(flyoutGroup.key)}`}
                data-part="children"
                className={cx('z-sidenav-flyout-list', classNames.children)}
              >
                {flyoutGroup.children.map((item) => renderLeaf(item, flyoutGroup.key))}
              </ul>
            </div>
          </FloatingSurface>
        </Portal>
      )}
      {tooltip && (
        <Portal inheritFrom={rootRef}>
          <FloatingSurface
            rootRef={rootRef}
            anchor={topRefs.current.get(tooltip.key)}
            data-part="tooltip"
            visual
            className={cx('z-sidenav-tooltip', classNames.tooltip)}
          >
            {tooltip.textValue ?? textOf(tooltip.label)}
          </FloatingSurface>
        </Portal>
      )}
    </nav>
  );
}
