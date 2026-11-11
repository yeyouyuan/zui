'use client';

import * as React from 'react';
import { cx, useControllableState } from '../../utils';
import './Tabs.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical'; // 默认 'horizontal'
  activationMode?: 'automatic' | 'manual'; // 默认 'automatic'（焦点即选中）
  children?: React.ReactNode;
  className?: string;
  classNames?: { root?: string; list?: string; trigger?: string; panel?: string };
}

export interface TabsListProps extends React.ComponentPropsWithRef<'div'> {
  children?: React.ReactNode;
}

export interface TabsTriggerProps extends React.ComponentPropsWithRef<'button'> {
  value: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface TabsPanelProps extends React.ComponentPropsWithRef<'div'> {
  value: string;
  forceMount?: boolean;
}

/* --------------------------------- Context -------------------------------- */

interface TabsContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
  baseId: string;
  orientation: 'horizontal' | 'vertical';
  activationMode: 'automatic' | 'manual';
  classNames: TabsProps['classNames'];
  /** 触发器 DOM 注册表（Roving tabindex 导航用） */
  triggers: Map<string, HTMLButtonElement>;
  registerTrigger: (value: string, el: HTMLButtonElement | null) => void;
  /** 触发器注册顺序（tablist 内声明顺序） */
  triggerOrder: string[];
  registerOrder: (value: string) => void;
  unregisterOrder: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`\`${component}\` 必须在 \`Tabs\` 内部使用`);
  }
  return ctx;
}

/* ---------------------------------- Root ---------------------------------- */

function Tabs(props: TabsProps) {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    orientation = 'horizontal',
    activationMode = 'automatic',
    children,
    className,
    classNames,
  } = props;

  // onValueChange 回调；首次自动选中默认 tab 时静默（对齐 defaultValue 语义）
  const suppressChangeRef = React.useRef(false);
  const handleChange = React.useCallback(
    (next: string | undefined) => {
      if (suppressChangeRef.current) return; // 静默期：不触发回调
      if (next !== undefined) onValueChange?.(next);
    },
    [onValueChange]
  );

  const [value, setValue] = useControllableState<string | undefined>({
    value: valueProp,
    defaultValue: defaultValue,
    onChange: handleChange,
  });

  const baseId = React.useId();

  const triggersRef = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  /** 触发器注册顺序的唯一事实源（DOM ref，同步维护） */
  const orderRef = React.useRef<string[]>([]);
  // triggerOrder 是 orderRef 的渲染投影：注册/注销时仅在顺序实际变化时同步一次，
  // 避免 render/effect 反复 setState 造成无限重渲
  const [triggerOrder, setTriggerOrder] = React.useState<string[]>([]);
  /** 启用（未禁用）tab 的 value 列表，注册顺序 */
  const [enabledValues, setEnabledValues] = React.useState<string[]>([]);

  const registerTrigger = React.useCallback(
    (tabValue: string, el: HTMLButtonElement | null) => {
      const map = triggersRef.current;
      if (el) {
        map.set(tabValue, el);
      } else {
        map.delete(tabValue);
      }
      setEnabledValues(Array.from(map.entries()).filter(([, node]) => !node.disabled).map(([v]) => v));
    },
    []
  );

  const registerOrder = React.useCallback((tabValue: string) => {
    const order = orderRef.current;
    if (order.includes(tabValue)) return;
    order.push(tabValue);
    setTriggerOrder(order.slice());
  }, []);

  const unregisterOrder = React.useCallback((tabValue: string) => {
    const order = orderRef.current;
    const index = order.indexOf(tabValue);
    if (index === -1) return;
    order.splice(index, 1);
    setTriggerOrder(order.slice());
  }, []);

  // 非受控且未显式指定 defaultValue 时，默认选中第一个启用 tab（ARIA tabs 推荐）。
  // 首次自动选中不触发 onValueChange（对齐 defaultValue 语义），在 effect 中静默一次后解除。
  const defaultValueProvided = React.useRef(defaultValue !== undefined);
  React.useEffect(() => {
    if (!defaultValueProvided.current && value === undefined && enabledValues.length > 0) {
      defaultValueProvided.current = true;
      suppressChangeRef.current = true;
      setValue(enabledValues[0]);
    }
    // 任意后续渲染解除静默（只影响首次 mount 的那一次回调）
    return () => {
      suppressChangeRef.current = false;
    };
  }, [enabledValues, value, setValue]);

  const contextValue = React.useMemo<TabsContextValue>(
    () => ({
      value,
      setValue: (next: string) => setValue(next),
      baseId,
      orientation,
      activationMode,
      classNames,
      triggers: triggersRef.current,
      registerTrigger,
      triggerOrder,
      registerOrder,
      unregisterOrder,
    }),
    [
      value,
      setValue,
      baseId,
      orientation,
      activationMode,
      classNames,
      registerTrigger,
      triggerOrder,
      registerOrder,
      unregisterOrder,
    ]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        data-part="root"
        className={cx('z-tabs', classNames?.root, className)}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/* ---------------------------------- List ---------------------------------- */

function TabsList(props: TabsListProps) {
  const { children, className, ...rest } = props;
  const { orientation, classNames } = useTabsContext('Tabs.List');

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      data-part="list"
      className={cx('z-tabs-list', classNames?.list, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/* --------------------------------- Trigger -------------------------------- */

function TabsTrigger(props: TabsTriggerProps) {
  const {
    value: tabValue,
    disabled,
    icon,
    children,
    className,
    onClick,
    onFocus,
    onKeyDown,
    ...rest
  } = props;
  const {
    value,
    setValue,
    baseId,
    orientation,
    activationMode,
    classNames,
    triggers,
    registerTrigger,
    triggerOrder,
    registerOrder,
    unregisterOrder,
  } = useTabsContext('Tabs.Trigger');

  const id = `${baseId}-tab-${tabValue}`;
  const panelId = `${baseId}-panel-${tabValue}`;
  const selected = value === tabValue;

  const ref = React.useRef<HTMLButtonElement | null>(null);
  // 在 Trigger 的 effect 中注册声明顺序；卸载时注销，保证注册表与 DOM 一致
  React.useEffect(() => {
    registerOrder(tabValue);
    return () => {
      unregisterOrder(tabValue);
    };
  }, [registerOrder, unregisterOrder, tabValue]);
  const setRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      registerTrigger(tabValue, el);
    },
    [registerTrigger, tabValue]
  );

  /**
   * 当前导航顺序：成员集合来自注册表（triggerOrder），顺序按 tablist 内 DOM 位置排列。
   * 动态增删 Trigger 或 React 复用组件实例时，注册顺序可能与声明顺序不一致，
   * 导航时以 DOM 顺序为准（compareDocumentPosition）。
   */
  const getNavigationOrder = (): string[] => {
    return triggerOrder
      .map((navValue) => ({ navValue, el: triggers.get(navValue) }))
      .filter((entry): entry is { navValue: string; el: HTMLButtonElement } => entry.el != null)
      .sort((a, b) => {
        const position = a.el.compareDocumentPosition(b.el);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      })
      .map((entry) => entry.navValue);
  };

  /** 从 from 起按 step 方向找第一个启用 tab 的下标，环形（跳过 disabled） */
  const findEnabledIndex = (order: string[], from: number, step: number): number => {
    let index = from;
    for (let i = 0; i < order.length; i += 1) {
      index = (index + step + order.length) % order.length;
      const el = triggers.get(order[index]);
      if (el && !el.disabled) return index;
    }
    return -1;
  };

  /**
   * 移动焦点（roving tabindex）。
   * - automatic：焦点即选中由 Trigger 的 onFocus 处理，这里只移动焦点
   * - manual：仅聚焦，不触发选中
   */
  const moveFocus = (order: string[], index: number) => {
    const nextValue = order[index];
    const el = nextValue !== undefined ? triggers.get(nextValue) : undefined;
    if (!el) return;
    el.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const order = getNavigationOrder();
    const currentIndex = order.indexOf(tabValue);
    if (currentIndex === -1) return;

    const isNextKey =
      orientation === 'horizontal' ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
    const isPrevKey =
      orientation === 'horizontal' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';

    if (isNextKey || isPrevKey) {
      event.preventDefault();
      const step = isNextKey ? 1 : -1;
      const nextIndex = findEnabledIndex(order, currentIndex, step);
      if (nextIndex !== -1) moveFocus(order, nextIndex);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      const firstIndex = findEnabledIndex(order, -1, 1);
      if (firstIndex !== -1) moveFocus(order, firstIndex);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = findEnabledIndex(order, order.length, -1);
      if (lastIndex !== -1) moveFocus(order, lastIndex);
      return;
    }

    // manual 模式：Enter / Space 激活（Space 手动拦截，避免页面滚动）
    if (activationMode === 'manual' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setValue(tabValue);
    }
  };

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      data-part="trigger"
      className={cx('z-tab', classNames?.trigger, className)}
      ref={setRef}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        setValue(tabValue);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        // automatic：焦点即选中
        if (activationMode === 'automatic' && !disabled && value !== tabValue) {
          setValue(tabValue);
        }
      }}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {icon ? (
        <span className="z-tab-icon" data-part="icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/* ---------------------------------- Panel --------------------------------- */

function TabsPanel(props: TabsPanelProps) {
  const { value: panelValue, forceMount, children, className, ...rest } = props;
  const { value, baseId, classNames } = useTabsContext('Tabs.Panel');

  const id = `${baseId}-panel-${panelValue}`;
  const tabId = `${baseId}-tab-${panelValue}`;
  const active = value === panelValue;

  if (!active && !forceMount) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId}
      hidden={!active}
      tabIndex={0}
      data-part="panel"
      className={cx('z-tabs-panel', classNames?.panel, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------------------- Compound -------------------------------- */

const TabsRoot = Object.assign(Tabs, {
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
});

export { TabsRoot as Tabs, TabsList, TabsTrigger, TabsPanel };
