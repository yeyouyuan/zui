'use client';

import * as React from 'react';
import { Modal } from '../Modal';
import { useZuiConfig } from '../../config';
import { cx, useControllableState } from '../../utils';
import './CommandPalette.css';

/* ---------------------------------- 类型 ---------------------------------- */

export interface CommandPaletteCommand {
  /** 全局唯一且非空 */
  key: string;
  label: React.ReactNode;
  /** 复杂 label 的可访问名与默认过滤文本 */
  textValue?: string;
  /** 简单分组名；空串等同未分组 */
  group?: string;
  /** 仅展示，不注册快捷键 */
  shortcut?: string;
  icon?: React.ReactNode;
  keywords?: readonly string[];
  disabled?: boolean;
  /** 应用可携带 Router 目标或业务数据，组件本身不解释 */
  meta?: unknown;
  onSelect?: (event: CommandPaletteSelectEvent) => void;
}

export type CommandPaletteSelectOriginalEvent =
  React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLElement>;

export interface CommandPaletteSelectEvent {
  command: CommandPaletteCommand;
  query: string;
  source: 'keyboard' | 'pointer';
  originalEvent: CommandPaletteSelectOriginalEvent;
  preventDefault(): void;
  readonly defaultPrevented: boolean;
}

export interface CommandPaletteOpenChangeDetails {
  reason: 'hotkey' | 'escape' | 'overlay' | 'select';
  originalEvent?: Event | React.SyntheticEvent;
  commandKey?: string;
}

export interface CommandPaletteQueryChangeDetails {
  reason: 'input' | 'close-reset';
  originalEvent?: React.ChangeEvent<HTMLInputElement>;
}

/** 触发热键，如 'mod+k'（Apple = Meta，其他平台 = Control）；false 关闭全局热键 */
export type CommandPaletteHotkey = string | false;

export interface CommandPaletteProps {
  commands: readonly CommandPaletteCommand[];

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CommandPaletteOpenChangeDetails) => void;

  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string, details: CommandPaletteQueryChangeDetails) => void;
  resetQueryOnClose?: boolean;

  /**
   * false 关闭本地过滤，由受控 query + commands 承担异步结果。当前列表不虚拟化；
   * 首版建议最多使用数百条本地命令，更多命令请走异步查询并设置 filter={false}。
   */
  filter?: false | ((command: CommandPaletteCommand, query: string) => boolean);
  loading?: boolean;
  loadingContent?: React.ReactNode;
  emptyContent?: React.ReactNode;

  hotkey?: CommandPaletteHotkey;
  onCommandSelect?: (command: CommandPaletteCommand, event: CommandPaletteSelectEvent) => void;

  placeholder?: string;
  inputAriaLabel?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  restoreFocus?: boolean;

  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  classNames?: {
    dialog?: string;
    root?: string;
    input?: string;
    listbox?: string;
    group?: string;
    groupLabel?: string;
    option?: string;
    optionIcon?: string;
    optionLabel?: string;
    optionShortcut?: string;
    status?: string;
    empty?: string;
    loading?: string;
  };
}

/* ---------------------------------- 热键 ---------------------------------- */

interface ParsedHotkey {
  mod: boolean;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
  canonical: string;
}

interface HotkeyRegistration {
  id: symbol;
  parsed: ParsedHotkey;
  accept: (event: KeyboardEvent) => void;
}

interface HotkeyRegistry {
  registrations: HotkeyRegistration[];
  warnedConflicts: Set<string>;
  listener: (event: KeyboardEvent) => void;
}

const HOTKEY_MODIFIERS = new Set(['mod', 'meta', 'ctrl', 'alt', 'shift']);
const hotkeyRegistries = new WeakMap<Document, HotkeyRegistry>();

function parseHotkey(value: string): ParsedHotkey | null {
  const parts = value
    .toLocaleLowerCase()
    .split('+')
    .map((part) => part.trim());
  if (parts.length < 2 || parts.some((part) => part === '')) return null;

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  if (HOTKEY_MODIFIERS.has(key) || modifiers.some((part) => !HOTKEY_MODIFIERS.has(part))) {
    return null;
  }
  if (new Set(modifiers).size !== modifiers.length) return null;

  const parsed = {
    mod: modifiers.includes('mod'),
    meta: modifiers.includes('meta'),
    ctrl: modifiers.includes('ctrl'),
    shift: modifiers.includes('shift'),
    alt: modifiers.includes('alt'),
    key,
  };
  if (!parsed.mod && !parsed.meta && !parsed.ctrl && !parsed.shift && !parsed.alt) return null;

  const canonicalModifiers = ['mod', 'meta', 'ctrl', 'alt', 'shift'].filter((part) =>
    modifiers.includes(part)
  );
  return { ...parsed, canonical: [...canonicalModifiers, key].join('+') };
}

function isApplePlatform(event: KeyboardEvent): boolean {
  const eventNavigator = event.view?.navigator;
  const runtimeNavigator =
    eventNavigator ?? (typeof navigator === 'undefined' ? undefined : navigator);
  const modernPlatform = (runtimeNavigator as Navigator & { userAgentData?: { platform?: string } })
    ?.userAgentData?.platform;
  const platform =
    modernPlatform ?? runtimeNavigator?.platform ?? runtimeNavigator?.userAgent ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

function matchesHotkey(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  const native = event as KeyboardEvent & { keyCode?: number };
  if (
    event.defaultPrevented ||
    event.repeat ||
    native.isComposing ||
    native.keyCode === 229 ||
    event.key === 'Dead' ||
    event.getModifierState?.('AltGraph')
  ) {
    return false;
  }
  if (event.key.toLocaleLowerCase() !== parsed.key) return false;

  const apple = isApplePlatform(event);
  const expectedMeta = parsed.meta || (parsed.mod && apple);
  const expectedCtrl = parsed.ctrl || (parsed.mod && !apple);
  return (
    event.metaKey === expectedMeta &&
    event.ctrlKey === expectedCtrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt
  );
}

function getHotkeyRegistry(doc: Document): HotkeyRegistry {
  const existing = hotkeyRegistries.get(doc);
  if (existing) return existing;

  const registry: HotkeyRegistry = {
    registrations: [],
    warnedConflicts: new Set(),
    listener: () => {},
  };
  registry.listener = (event) => {
    for (let index = registry.registrations.length - 1; index >= 0; index -= 1) {
      const registration = registry.registrations[index];
      if (!matchesHotkey(event, registration.parsed)) continue;
      registration.accept(event);
      event.preventDefault();
      return;
    }
  };
  doc.addEventListener('keydown', registry.listener);
  hotkeyRegistries.set(doc, registry);
  return registry;
}

function registerHotkey(doc: Document, registration: HotkeyRegistration): () => void {
  const registry = getHotkeyRegistry(doc);
  const conflict = registry.registrations.some(
    (candidate) => candidate.parsed.canonical === registration.parsed.canonical
  );
  if (conflict && !registry.warnedConflicts.has(registration.parsed.canonical)) {
    registry.warnedConflicts.add(registration.parsed.canonical);
    warnInDevelopment(
      `多个实例注册了热键 ${registration.parsed.canonical}；仅最后注册的实例会响应。`
    );
  }
  registry.registrations.push(registration);

  return () => {
    const index = registry.registrations.findIndex((candidate) => candidate.id === registration.id);
    if (index >= 0) registry.registrations.splice(index, 1);
    if (registry.registrations.length === 0) {
      doc.removeEventListener('keydown', registry.listener);
      hotkeyRegistries.delete(doc);
    }
  };
}

/* ---------------------------------- 工具 ---------------------------------- */

interface CommandRecord {
  command: CommandPaletteCommand;
  disabled: boolean;
  accessibleName: string;
}

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

function hasInteractiveDescendant(node: React.ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasInteractiveDescendant);
  if (!React.isValidElement<Record<string, unknown>>(node)) return false;
  const props = node.props;
  if (typeof node.type === 'string') {
    const interactiveTags = new Set([
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      'iframe',
      'object',
      'embed',
    ]);
    if (interactiveTags.has(node.type)) return true;
  }
  if (
    props.contentEditable === true ||
    props.contentEditable === 'true' ||
    (typeof props.tabIndex === 'number' && props.tabIndex >= 0)
  ) {
    return true;
  }
  return hasInteractiveDescendant(props.children as React.ReactNode);
}

function isProductionRuntime(): boolean {
  const meta = import.meta as ImportMeta & { env?: { PROD?: boolean } };
  if (meta.env?.PROD !== undefined) return meta.env.PROD;
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return runtime.process?.env?.NODE_ENV === 'production';
}

function warnInDevelopment(message: string): void {
  if (!isProductionRuntime()) console.warn(`[ZUI CommandPalette] ${message}`);
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function matchesDefaultFilter(record: CommandRecord, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true;
  const candidates = [record.accessibleName, ...(record.command.keywords ?? [])];
  return candidates.some((candidate) => normalizeSearchText(candidate).includes(normalizedQuery));
}

function stableIdToken(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

function formatCountMessage(template: string, count: number): string {
  return template.replace(/\{count\}/g, String(count));
}

function createSelectEvent(
  command: CommandPaletteCommand,
  query: string,
  source: 'keyboard' | 'pointer',
  originalEvent: CommandPaletteSelectOriginalEvent
): CommandPaletteSelectEvent {
  let prevented = false;
  return {
    command,
    query,
    source,
    originalEvent,
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  };
}

/* --------------------------------- 组件实现 -------------------------------- */

function CommandPalette(props: CommandPaletteProps) {
  const { locale } = useZuiConfig();
  const {
    commands,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    query: queryProp,
    defaultQuery = '',
    onQueryChange,
    resetQueryOnClose = true,
    filter,
    loading = false,
    loadingContent,
    emptyContent,
    hotkey = 'mod+k',
    onCommandSelect,
    placeholder,
    inputAriaLabel,
    returnFocusRef,
    restoreFocus = true,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    classNames = {},
  } = props;

  const [open, setOpen] = useControllableState<boolean>({
    value: openProp,
    defaultValue: defaultOpen,
  });
  const [query, setQuery] = useControllableState<string>({
    value: queryProp,
    defaultValue: defaultQuery,
  });
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const optionRefs = React.useRef(new Map<string, HTMLElement>());
  const compositionRef = React.useRef(false);
  const openRef = React.useRef(open);
  openRef.current = open;
  const pendingModalCloseRef = React.useRef<CommandPaletteOpenChangeDetails | null>(null);
  const warnedMessagesRef = React.useRef(new Set<string>());

  const requestOpen = React.useCallback(
    (next: boolean, details: CommandPaletteOpenChangeDetails) => {
      setOpen(next);
      onOpenChange?.(next, details);
    },
    [onOpenChange, setOpen]
  );

  const requestQuery = React.useCallback(
    (next: string, details: CommandPaletteQueryChangeDetails) => {
      setQuery(next);
      onQueryChange?.(next, details);
    },
    [onQueryChange, setQuery]
  );

  const hotkeyActionRef = React.useRef<(event: KeyboardEvent) => void>(() => {});
  hotkeyActionRef.current = (event) => {
    requestOpen(!openRef.current, { reason: 'hotkey', originalEvent: event });
  };

  React.useEffect(() => {
    if (hotkey === false) return undefined;
    const parsed = parseHotkey(hotkey);
    if (!parsed) {
      warnInDevelopment(`无效热键“${hotkey}”；必须包含至少一个受支持的修饰键和一个最终按键。`);
      return undefined;
    }
    return registerHotkey(document, {
      id: Symbol('command-palette-hotkey'),
      parsed,
      accept: (event) => hotkeyActionRef.current(event),
    });
  }, [hotkey]);

  const analysis = React.useMemo(() => {
    const seen = new Set<string>();
    const records: CommandRecord[] = [];
    const warnings: string[] = [];
    for (const command of commands) {
      if (typeof command.key !== 'string' || command.key.trim() === '') {
        warnings.push('command key 不能为空；该命令已忽略。');
        continue;
      }
      if (seen.has(command.key)) {
        warnings.push(`重复的 command key：${command.key}；仅保留首项。`);
        continue;
      }
      seen.add(command.key);

      const textValue = command.textValue?.trim();
      const labelText = textOf(command.label).trim();
      const complexLabel = typeof command.label !== 'string' && typeof command.label !== 'number';
      if (complexLabel && !textValue) {
        warnings.push(`复杂 label 的命令 ${command.key} 必须提供非空 textValue。`);
      }
      if (hasInteractiveDescendant(command.label) || hasInteractiveDescendant(command.icon)) {
        warnings.push(`命令 ${command.key} 的 label / icon 不能包含可交互后代。`);
      }

      const hasHandler =
        typeof command.onSelect === 'function' || typeof onCommandSelect === 'function';
      if (!command.disabled && !hasHandler) {
        warnings.push(`命令 ${command.key} 缺少选择处理器，已按 disabled 处理。`);
      }
      records.push({
        command,
        disabled: Boolean(command.disabled) || !hasHandler,
        accessibleName: textValue || labelText || command.key,
      });
    }
    return { records, warnings };
  }, [commands, onCommandSelect]);

  React.useEffect(() => {
    for (const message of analysis.warnings) {
      if (warnedMessagesRef.current.has(message)) continue;
      warnedMessagesRef.current.add(message);
      warnInDevelopment(message);
    }
  }, [analysis.warnings]);

  const normalizedQuery = React.useMemo(() => normalizeSearchText(query), [query]);
  const visibleRecords = React.useMemo(() => {
    if (filter === false) return analysis.records;
    if (typeof filter === 'function') {
      return analysis.records.filter((record) => filter(record.command, query));
    }
    return analysis.records.filter((record) => matchesDefaultFilter(record, normalizedQuery));
  }, [analysis.records, filter, normalizedQuery, query]);

  const sections = React.useMemo(() => {
    const ungrouped: CommandRecord[] = [];
    const grouped = new Map<string, CommandRecord[]>();
    for (const record of visibleRecords) {
      const group = record.command.group?.trim();
      if (!group) ungrouped.push(record);
      else {
        const bucket = grouped.get(group);
        if (bucket) bucket.push(record);
        else grouped.set(group, [record]);
      }
    }
    const result: Array<{ label: string | null; records: CommandRecord[] }> = [];
    if (ungrouped.length > 0) result.push({ label: null, records: ungrouped });
    for (const [label, records] of grouped) result.push({ label, records });
    return result;
  }, [visibleRecords]);

  // 键盘顺序必须与 listbox 的真实 DOM 顺序一致：未分组项在前，其后才是各分组。
  const enabledRecords = React.useMemo(
    () => sections.flatMap((section) => section.records.filter((record) => !record.disabled)),
    [sections]
  );
  const enabledKeys = React.useMemo(
    () => enabledRecords.map((record) => record.command.key),
    [enabledRecords]
  );
  const enabledIndexByKey = React.useMemo(() => {
    const indexByKey = new Map<string, number>();
    for (let index = 0; index < enabledRecords.length; index += 1) {
      indexByKey.set(enabledRecords[index].command.key, index);
    }
    return indexByKey;
  }, [enabledRecords]);
  const enabledSignature = React.useMemo(() => JSON.stringify(enabledKeys), [enabledKeys]);
  const previousOpenRef = React.useRef(false);
  const previousQueryRef = React.useRef(query);
  const previousEnabledKeysRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const queryChanged = previousQueryRef.current !== query;
    const previousKeys = previousEnabledKeysRef.current;
    setActiveKey((current) => {
      if (!open || enabledKeys.length === 0) return null;
      if (!wasOpen || queryChanged) return enabledKeys[0] ?? null;
      if (current && enabledKeys.includes(current)) return current;
      const previousIndex = current ? previousKeys.indexOf(current) : -1;
      if (previousIndex >= 0) {
        return enabledKeys[Math.min(previousIndex, enabledKeys.length - 1)] ?? null;
      }
      return enabledKeys[0] ?? null;
    });
    previousOpenRef.current = open;
    previousQueryRef.current = query;
    previousEnabledKeysRef.current = enabledKeys;
    // enabledSignature 是序列化后的 key 顺序，避免仅因 record 对象重建重置 active。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledSignature, open, query]);

  const actualOpenBeforeResetRef = React.useRef(open);
  React.useEffect(() => {
    const wasOpen = actualOpenBeforeResetRef.current;
    actualOpenBeforeResetRef.current = open;
    if (wasOpen && !open && resetQueryOnClose && query !== '') {
      requestQuery('', { reason: 'close-reset' });
    }
  }, [open, query, requestQuery, resetQueryOnClose]);

  const effectiveActiveKey =
    open && activeKey && enabledIndexByKey.has(activeKey) ? activeKey : null;

  React.useEffect(() => {
    if (!effectiveActiveKey) return;
    optionRefs.current.get(effectiveActiveKey)?.scrollIntoView?.({ block: 'nearest' });
  }, [effectiveActiveKey]);

  const runCommand = React.useCallback(
    (
      record: CommandRecord,
      source: 'keyboard' | 'pointer',
      originalEvent: CommandPaletteSelectOriginalEvent
    ) => {
      if (!openRef.current || record.disabled) return;
      const selectEvent = createSelectEvent(record.command, query, source, originalEvent);
      record.command.onSelect?.(selectEvent);
      onCommandSelect?.(record.command, selectEvent);
      if (!selectEvent.defaultPrevented) {
        requestOpen(false, {
          reason: 'select',
          commandKey: record.command.key,
          originalEvent,
        });
      }
    },
    [onCommandSelect, query, requestOpen]
  );

  const moveActive = (delta: 1 | -1): boolean => {
    if (enabledRecords.length === 0) return false;
    const index =
      effectiveActiveKey === null ? undefined : enabledIndexByKey.get(effectiveActiveKey);
    const nextIndex =
      index === undefined
        ? delta > 0
          ? 0
          : enabledRecords.length - 1
        : Math.min(enabledRecords.length - 1, Math.max(0, index + delta));
    setActiveKey(enabledRecords[nextIndex]?.command.key ?? null);
    return true;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const native = event.nativeEvent as KeyboardEvent & { keyCode?: number };
    if (compositionRef.current || native.isComposing || native.keyCode === 229) {
      if (event.key === 'Escape') event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown') {
      if (moveActive(1)) event.preventDefault();
      return;
    }
    if (event.key === 'ArrowUp') {
      if (moveActive(-1)) event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && effectiveActiveKey) {
      const activeIndex = enabledIndexByKey.get(effectiveActiveKey);
      const record = activeIndex === undefined ? undefined : enabledRecords[activeIndex];
      if (record) {
        event.preventDefault();
        runCommand(record, 'keyboard', event);
      }
    }
  };

  const baseId = React.useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (key: string) => `${baseId}-option-${stableIdToken(key)}`;
  const placeholderText = placeholder ?? locale.commandPalette.placeholder;
  const inputLabel = inputAriaLabel ?? locale.commandPalette.search;
  const dialogLabel = ariaLabel ?? locale.commandPalette.title;
  const statusContent = loading
    ? (loadingContent ?? locale.commandPalette.loading)
    : visibleRecords.length === 0
      ? (emptyContent ?? locale.commandPalette.empty)
      : formatCountMessage(locale.commandPalette.results, visibleRecords.length);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        const details = pendingModalCloseRef.current ?? { reason: 'overlay' as const };
        pendingModalCloseRef.current = null;
        requestOpen(next, details);
      }}
    >
      <Modal.Content
        size="lg"
        aria-label={ariaLabelledBy ? undefined : dialogLabel}
        aria-labelledby={ariaLabelledBy}
        className={cx('z-command-palette-dialog', classNames.dialog)}
        restoreFocus={restoreFocus}
        returnFocusRef={returnFocusRef}
        onEscapeKeyDown={(event) => {
          pendingModalCloseRef.current = { reason: 'escape', originalEvent: event };
        }}
        onOverlayMouseDown={(event) => {
          pendingModalCloseRef.current = { reason: 'overlay', originalEvent: event };
        }}
      >
        <div
          data-part="root"
          data-open={open ? '' : undefined}
          data-loading={loading ? '' : undefined}
          className={cx('z-command-palette', className, classNames.root)}
        >
          <input
            data-part="input"
            data-autofocus
            type="text"
            role="combobox"
            className={cx('z-command-palette-input', classNames.input)}
            value={query}
            placeholder={placeholderText}
            aria-label={inputLabel}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-activedescendant={effectiveActiveKey ? optionId(effectiveActiveKey) : undefined}
            aria-expanded="true"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) =>
              requestQuery(event.target.value, { reason: 'input', originalEvent: event })
            }
            onCompositionStart={() => {
              compositionRef.current = true;
            }}
            onCompositionEnd={() => {
              compositionRef.current = false;
            }}
            onKeyDown={handleKeyDown}
          />
          <div
            id={listboxId}
            role="listbox"
            aria-busy={loading}
            data-part="listbox"
            className={cx('z-command-palette-listbox', classNames.listbox)}
          >
            {sections.map((section) => {
              const items = section.records.map((record) => {
                const { command } = record;
                const active = command.key === effectiveActiveKey;
                return (
                  <div
                    key={command.key}
                    id={optionId(command.key)}
                    ref={(node) => {
                      if (node) optionRefs.current.set(command.key, node);
                      else optionRefs.current.delete(command.key);
                    }}
                    role="option"
                    aria-label={command.textValue?.trim() || undefined}
                    aria-selected={active}
                    aria-disabled={record.disabled || undefined}
                    data-part="option"
                    data-key={command.key}
                    data-active={active ? '' : undefined}
                    data-disabled={record.disabled ? '' : undefined}
                    className={cx('z-command-palette-option', classNames.option)}
                    onPointerEnter={(event) => {
                      if (
                        !record.disabled &&
                        (event.pointerType === 'mouse' || event.pointerType === 'pen')
                      ) {
                        setActiveKey(command.key);
                      }
                    }}
                    onPointerDown={(event) => {
                      if (event.pointerType !== 'touch') event.preventDefault();
                    }}
                    onClick={(event) => runCommand(record, 'pointer', event)}
                  >
                    {command.icon != null ? (
                      <span
                        data-part="option-icon"
                        aria-hidden="true"
                        className={cx('z-command-palette-option-icon', classNames.optionIcon)}
                      >
                        {command.icon}
                      </span>
                    ) : null}
                    <span
                      data-part="option-label"
                      className={cx('z-command-palette-option-label', classNames.optionLabel)}
                    >
                      {command.label}
                    </span>
                    {command.shortcut != null ? (
                      <kbd
                        data-part="option-shortcut"
                        aria-hidden="true"
                        dir="ltr"
                        className={cx(
                          'z-command-palette-option-shortcut',
                          classNames.optionShortcut
                        )}
                      >
                        {command.shortcut}
                      </kbd>
                    ) : null}
                  </div>
                );
              });

              if (section.label == null) {
                return <React.Fragment key="ungrouped">{items}</React.Fragment>;
              }
              const groupId = `${baseId}-group-${stableIdToken(section.label)}`;
              return (
                <div
                  key={section.label}
                  role="group"
                  aria-labelledby={groupId}
                  data-part="group"
                  className={cx('z-command-palette-group', classNames.group)}
                >
                  <div
                    id={groupId}
                    data-part="group-label"
                    className={cx('z-command-palette-group-label', classNames.groupLabel)}
                  >
                    {section.label}
                  </div>
                  {items}
                </div>
              );
            })}
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-part="status"
            className={cx('z-command-palette-status', classNames.status)}
          >
            <span
              data-part={loading ? 'loading' : visibleRecords.length === 0 ? 'empty' : 'results'}
              className={cx(
                loading && 'z-command-palette-loading',
                loading && classNames.loading,
                !loading && visibleRecords.length === 0 && 'z-command-palette-empty',
                !loading && visibleRecords.length === 0 && classNames.empty,
                !loading && visibleRecords.length > 0 && 'z-command-palette-results'
              )}
            >
              {statusContent}
            </span>
          </div>
        </div>
      </Modal.Content>
    </Modal>
  );
}

export { CommandPalette };
