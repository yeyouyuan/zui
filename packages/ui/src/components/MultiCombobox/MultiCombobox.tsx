'use client';

import * as React from 'react';
import { ChevronDown, Close } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import type { ComboboxOption } from '../Combobox';
import './MultiCombobox.css';

/* ---------------------------------- 类型 ---------------------------------- */

/** 选项结构与 Combobox 完全一致，便于两个组件互换 */
export type MultiComboboxOption = ComboboxOption;

export type MultiComboboxChangeReason = 'selection' | 'remove' | 'backspace' | 'clear';
export type MultiComboboxInputChangeReason = 'input' | 'selection' | 'clear' | 'reset';
export type MultiComboboxOpenChangeReason =
  | 'input'
  | 'keyboard'
  | 'toggle'
  | 'selection'
  | 'clear'
  | 'blur'
  | 'outside'
  | 'escape'
  | 'reset'
  | 'focus';

export interface MultiComboboxChangeDetails {
  reason: MultiComboboxChangeReason;
}

export interface MultiComboboxInputChangeDetails {
  reason: MultiComboboxInputChangeReason;
  isComposing: boolean;
}

export interface MultiComboboxOpenChangeDetails {
  reason: MultiComboboxOpenChangeReason;
}

export interface MultiComboboxProps extends Omit<
  React.ComponentPropsWithRef<'input'>,
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'type'
  | 'size'
  | 'className'
  | 'style'
  | 'children'
> {
  options: readonly MultiComboboxOption[];

  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[], details: MultiComboboxChangeDetails) => void;

  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (inputValue: string, details: MultiComboboxInputChangeDetails) => void;
  onSearch?: (query: string) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: MultiComboboxOpenChangeDetails) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;

  filterOption?: false | ((option: MultiComboboxOption, query: string) => boolean);

  loading?: boolean;
  openOnFocus?: boolean;
  autoHighlight?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: 'default' | 'error' | 'success';

  loadingContent?: React.ReactNode;
  emptyContent?: React.ReactNode;
  errorContent?: React.ReactNode;

  className?: string;
  style?: React.CSSProperties;
  classNames?: {
    root?: string;
    control?: string;
    tags?: string;
    tag?: string;
    tagLabel?: string;
    tagRemove?: string;
    input?: string;
    clear?: string;
    toggle?: string;
    panel?: string;
    listbox?: string;
    option?: string;
    loading?: string;
    empty?: string;
    error?: string;
    status?: string;
  };
}

/* ---------------------------------- 工具 ---------------------------------- */

function getOptionText(option: MultiComboboxOption): string {
  if (option.textValue !== undefined) return option.textValue;
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return String(option.label);
  }
  return option.value;
}

function hasComplexLabel(option: MultiComboboxOption): boolean {
  return typeof option.label !== 'string' && typeof option.label !== 'number';
}

function isOptionDisabled(option: MultiComboboxOption): boolean {
  return option.disabled === true || option.value === '';
}

function defaultFilterOption(option: MultiComboboxOption, query: string): boolean {
  if (query === '') return true;
  const normalized = query.toLocaleLowerCase();
  const candidates = [getOptionText(option), option.value, ...(option.keywords ?? [])];
  return candidates.some((candidate) => candidate.toLocaleLowerCase().includes(normalized));
}

function findEnabledOption(
  options: readonly MultiComboboxOption[],
  direction: 'first' | 'last'
): MultiComboboxOption | null {
  if (direction === 'first') {
    return options.find((option) => !isOptionDisabled(option)) ?? null;
  }
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!isOptionDisabled(options[index])) return options[index];
  }
  return null;
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
  if (!isProductionRuntime()) console.warn(`[ZUI MultiCombobox] ${message}`);
}

/* --------------------------------- 组件实现 -------------------------------- */

export function MultiCombobox(props: MultiComboboxProps) {
  const { locale } = useZuiConfig();
  const {
    options,
    value: valueProp,
    defaultValue,
    onChange,
    inputValue: inputValueProp,
    defaultInputValue = '',
    onInputValueChange,
    onSearch,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    onBlur,
    filterOption,
    loading = false,
    openOnFocus = false,
    autoHighlight = true,
    clearable = false,
    disabled = false,
    readOnly = false,
    size = 'md',
    status = 'default',
    placeholder,
    loadingContent,
    emptyContent,
    errorContent,
    className,
    style,
    classNames,
    id,
    name,
    form,
    required = false,
    autoComplete = 'off',
    onFocus: onFocusProp,
    onKeyDown: onKeyDownProp,
    onCompositionStart: onCompositionStartProp,
    onCompositionEnd: onCompositionEndProp,
    ref,
    ...inputProps
  } = props;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const lastKnownTextByValueRef = React.useRef(new Map<string, string>());
  const compositionRef = React.useRef(false);
  const skipNextCompositionChangeRef = React.useRef<string | null>(null);
  const outsideClosingRef = React.useRef(false);

  const defaultsRef = React.useRef<{ value: string[]; input: string } | null>(null);
  if (defaultsRef.current === null) {
    defaultsRef.current = {
      value: defaultValue ?? [],
      input: defaultInputValue,
    };
  }
  const defaults = defaultsRef.current;

  const valueControlled = valueProp !== undefined;
  const inputControlled = inputValueProp !== undefined;
  const openControlled = openProp !== undefined;

  const [selectedValues, setSelectedValues] = useControllableState<string[]>({
    value: valueControlled ? valueProp : undefined,
    defaultValue: defaults.value,
  });
  const [draftValue, setDraftValue] = useControllableState<string>({
    value: inputControlled ? inputValueProp : undefined,
    defaultValue: defaults.input,
  });
  const [open, setOpen] = useControllableState<boolean>({
    value: openProp,
    defaultValue: defaultOpen,
  });

  const [activeValue, setActiveValue] = React.useState<string | null>(null);

  const selectedRef = React.useRef(selectedValues);
  const draftRef = React.useRef(draftValue);
  const openRef = React.useRef(open);
  const lastReportedInputRef = React.useRef(draftValue);
  selectedRef.current = selectedValues;
  draftRef.current = draftValue;
  openRef.current = open;

  const baseId = React.useId();
  const inputId = id ?? `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const placeholderText = placeholder === undefined ? locale.combobox.placeholder : placeholder;
  const loadingText = loadingContent === undefined ? locale.combobox.loading : loadingContent;
  const emptyText = emptyContent === undefined ? locale.combobox.empty : emptyContent;

  // 已选值的可显示文本：options 里找不到时（异步结果暂不含已选项）退回最近已知文本
  const resolveTagText = React.useCallback(
    (value: string): string => {
      const option = options.find((candidate) => candidate.value === value);
      if (option) return getOptionText(option);
      return lastKnownTextByValueRef.current.get(value) ?? value;
    },
    [options]
  );

  React.useEffect(() => {
    for (const selected of selectedRef.current) {
      const option = options.find((candidate) => candidate.value === selected);
      if (option) lastKnownTextByValueRef.current.set(selected, getOptionText(option));
    }
  }, [options, selectedValues]);

  const filteredOptions = React.useMemo(() => {
    if (filterOption === false) return options;
    const predicate = filterOption ?? defaultFilterOption;
    return options.filter((option) => predicate(option, draftValue));
  }, [draftValue, filterOption, options]);

  const activeIndex =
    activeValue === null ? -1 : filteredOptions.findIndex((option) => option.value === activeValue);
  const effectiveOpen = open && !disabled && !readOnly;
  const isLoading = loading === true;
  const showError = !isLoading && errorContent != null;
  const showEmpty = !isLoading && !showError && filteredOptions.length === 0;
  const resultsStatusText = locale.combobox.results.replace(
    '{count}',
    String(filteredOptions.length)
  );

  const requestInput = React.useCallback(
    (next: string, reason: MultiComboboxInputChangeReason, isComposing: boolean) => {
      draftRef.current = next;
      lastReportedInputRef.current = next;
      setDraftValue(next);
      onInputValueChange?.(next, { reason, isComposing });
    },
    [onInputValueChange, setDraftValue]
  );

  const requestOpen = React.useCallback(
    (next: boolean, reason: MultiComboboxOpenChangeReason) => {
      if (disabled || readOnly) return;
      if (openRef.current === next) return;
      if (!openControlled) openRef.current = next;
      setOpen(next);
      onOpenChange?.(next, { reason });
    },
    [disabled, onOpenChange, openControlled, readOnly, setOpen]
  );

  const focusInput = React.useCallback(() => {
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const commitValues = React.useCallback(
    (next: string[], details: MultiComboboxChangeDetails) => {
      if (!valueControlled) selectedRef.current = next;
      setSelectedValues(next);
      onChange?.(next, details);
    },
    [onChange, setSelectedValues, valueControlled]
  );

  /** 选中即 toggle：加入或移除，随后清空草稿继续搜索，面板保持打开 */
  const toggleOption = React.useCallback(
    (option: MultiComboboxOption) => {
      if (disabled || readOnly || isLoading || isOptionDisabled(option)) return;
      const isAdding = !selectedRef.current.includes(option.value);
      const next = isAdding
        ? [...selectedRef.current, option.value]
        : selectedRef.current.filter((value) => value !== option.value);
      lastKnownTextByValueRef.current.set(option.value, getOptionText(option));
      commitValues(next, { reason: isAdding ? 'selection' : 'remove' });
      requestInput('', 'selection', false);
      focusInput();
    },
    [commitValues, disabled, focusInput, isLoading, readOnly, requestInput]
  );

  const removeValue = React.useCallback(
    (value: string, reason: 'remove' | 'backspace') => {
      if (disabled || readOnly) return;
      commitValues(
        selectedRef.current.filter((candidate) => candidate !== value),
        { reason }
      );
      focusInput();
    },
    [commitValues, disabled, focusInput, readOnly]
  );

  const clear = React.useCallback(() => {
    if (disabled || readOnly) return;
    commitValues([], { reason: 'clear' });
    requestInput('', 'clear', false);
    requestOpen(false, 'clear');
    focusInput();
  }, [commitValues, disabled, focusInput, readOnly, requestInput, requestOpen]);

  const openList = React.useCallback(
    (fallback: 'first' | 'last', reason: MultiComboboxOpenChangeReason) => {
      if (disabled || readOnly) return;
      if (autoHighlight) {
        const selected = filteredOptions.find(
          (option) => selectedRef.current.includes(option.value) && !isOptionDisabled(option)
        );
        setActiveValue(
          selected?.value ?? findEnabledOption(filteredOptions, fallback)?.value ?? null
        );
      } else {
        setActiveValue(null);
      }
      requestOpen(true, reason);
    },
    [autoHighlight, disabled, filteredOptions, readOnly, requestOpen]
  );

  const moveActive = React.useCallback(
    (delta: 1 | -1) => {
      if (filteredOptions.length === 0) return;
      if (activeIndex < 0) {
        setActiveValue(
          findEnabledOption(filteredOptions, delta > 0 ? 'first' : 'last')?.value ?? null
        );
        return;
      }
      const nextIndex = Math.min(filteredOptions.length - 1, Math.max(0, activeIndex + delta));
      setActiveValue(filteredOptions[nextIndex]?.value ?? null);
    },
    [activeIndex, filteredOptions]
  );

  const findUniqueExactMatch = React.useCallback(
    (query: string): MultiComboboxOption | null => {
      const matches = filteredOptions.filter(
        (option) => !isOptionDisabled(option) && getOptionText(option) === query
      );
      return matches.length === 1 ? matches[0] : null;
    },
    [filteredOptions]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    const next = event.currentTarget.value;
    const isComposing =
      compositionRef.current ||
      Boolean((event.nativeEvent as InputEvent & { isComposing?: boolean }).isComposing);
    const pendingCompositionFinal = skipNextCompositionChangeRef.current;
    const duplicateCompositionFinal = pendingCompositionFinal === next;
    if (pendingCompositionFinal !== null) skipNextCompositionChangeRef.current = null;

    if (!duplicateCompositionFinal || lastReportedInputRef.current !== next) {
      requestInput(next, 'input', isComposing);
    }
    requestOpen(true, 'input');
    if (!isComposing && !duplicateCompositionFinal) {
      onSearch?.(next);
    }
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLInputElement>) => {
    compositionRef.current = true;
    skipNextCompositionChangeRef.current = null;
    onCompositionStartProp?.(event);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement>) => {
    compositionRef.current = false;
    const finalQuery = event.currentTarget.value;
    if (lastReportedInputRef.current !== finalQuery) {
      requestInput(finalQuery, 'input', false);
    }
    onSearch?.(finalQuery);
    skipNextCompositionChangeRef.current = finalQuery;
    requestOpen(true, 'input');
    onCompositionEndProp?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDownProp?.(event);
    if (event.defaultPrevented || disabled || readOnly) return;
    const native = event.nativeEvent as KeyboardEvent & {
      isComposing?: boolean;
      keyCode?: number;
    };
    if (compositionRef.current || native.isComposing || native.keyCode === 229) return;

    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      if (!effectiveOpen) openList('first', 'keyboard');
      return;
    }
    if (event.altKey && event.key === 'ArrowUp') {
      if (effectiveOpen) {
        event.preventDefault();
        requestOpen(false, 'keyboard');
      }
      return;
    }

    if (!effectiveOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openList(event.key === 'ArrowUp' ? 'last' : 'first', 'keyboard');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const match = isLoading ? null : findUniqueExactMatch(draftRef.current);
        if (match) toggleOption(match);
        else openList('first', 'keyboard');
      } else if (
        event.key === 'Backspace' &&
        draftRef.current === '' &&
        selectedRef.current.length > 0
      ) {
        event.preventDefault();
        removeValue(selectedRef.current[selectedRef.current.length - 1], 'backspace');
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Enter': {
        event.preventDefault();
        const option = activeIndex >= 0 ? filteredOptions[activeIndex] : undefined;
        if (option) toggleOption(option);
        break;
      }
      case 'Backspace':
        if (draftRef.current === '' && selectedRef.current.length > 0) {
          event.preventDefault();
          removeValue(selectedRef.current[selectedRef.current.length - 1], 'backspace');
        }
        break;
      case 'Escape':
        event.preventDefault();
        requestInput('', 'reset', false);
        requestOpen(false, 'escape');
        break;
      default:
        break;
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocusProp?.(event);
    if (!event.defaultPrevented && openOnFocus && !disabled && !readOnly) {
      openList('first', 'focus');
    }
  };

  const handleRootBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (
      (nextTarget && rootRef.current?.contains(nextTarget)) ||
      (nextTarget && panelRef.current?.contains(nextTarget))
    ) {
      return;
    }
    if (!outsideClosingRef.current) {
      requestInput('', 'reset', false);
      requestOpen(false, 'blur');
    }
    onBlur?.(event);
  };

  const handleOutside = React.useCallback(() => {
    outsideClosingRef.current = true;
    queueMicrotask(() => {
      outsideClosingRef.current = false;
    });
    requestInput('', 'reset', false);
    requestOpen(false, 'outside');
  }, [requestInput, requestOpen]);

  const outsideRefs = React.useMemo(() => [rootRef, panelRef], []);
  useOnClickOutside(outsideRefs, handleOutside, effectiveOpen);

  React.useEffect(() => {
    if (!effectiveOpen) {
      setActiveValue(null);
      return;
    }
    if (activeValue !== null && filteredOptions.some((option) => option.value === activeValue)) {
      return;
    }
    if (!autoHighlight) {
      setActiveValue(null);
      return;
    }
    const selected = filteredOptions.find(
      (option) => selectedValues.includes(option.value) && !isOptionDisabled(option)
    );
    setActiveValue(selected?.value ?? findEnabledOption(filteredOptions, 'first')?.value ?? null);
  }, [activeValue, autoHighlight, effectiveOpen, filteredOptions, selectedValues]);

  React.useEffect(() => {
    if (!effectiveOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, effectiveOpen]);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const invalid = required && selectedValues.length === 0;
    input.setCustomValidity(invalid ? locale.form.required : '');
  }, [locale.form.required, required, selectedValues.length]);

  React.useEffect(() => {
    const input = inputRef.current;
    const ownerForm = input?.form;
    if (!ownerForm) return undefined;
    const handleReset = () => {
      if (!valueControlled) {
        selectedRef.current = defaults.value;
        setSelectedValues(defaults.value);
      }
      if (!inputControlled) {
        draftRef.current = defaults.input;
        lastReportedInputRef.current = defaults.input;
        setDraftValue(defaults.input);
      }
      if (!openControlled) {
        openRef.current = false;
        setOpen(false);
      }
      setActiveValue(null);
    };
    ownerForm.addEventListener('reset', handleReset);
    return () => ownerForm.removeEventListener('reset', handleReset);
  }, [
    defaults,
    form,
    inputControlled,
    openControlled,
    setOpen,
    setDraftValue,
    setSelectedValues,
    valueControlled,
  ]);

  React.useEffect(() => {
    const seen = new Set<string>();
    for (const option of options) {
      if (option.value === '') {
        warnInDevelopment('option.value 不能为空字符串；空字符串保留为 Form 的空值哨兵。');
      }
      if (seen.has(option.value)) {
        warnInDevelopment(`检测到重复 option.value：${JSON.stringify(option.value)}。`);
      }
      seen.add(option.value);
      if (hasComplexLabel(option) && option.textValue === undefined) {
        warnInDevelopment(`复杂 label 的选项 ${JSON.stringify(option.value)} 必须提供 textValue。`);
      }
    }
  }, [options]);

  const showClear =
    clearable && !disabled && !readOnly && (selectedValues.length > 0 || draftValue !== '');
  const activeDescendantId = effectiveOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  return (
    <div
      ref={rootRef}
      data-part="root"
      data-open={effectiveOpen ? 'true' : 'false'}
      data-size={size}
      data-status={status}
      data-disabled={disabled ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      data-loading={isLoading ? 'true' : undefined}
      className={cx('z-multicombobox', classNames?.root, className)}
      style={style}
      onBlur={handleRootBlur}
    >
      <div data-part="control" className={cx('z-multicombobox-control', classNames?.control)}>
        {selectedValues.length > 0 ? (
          <span data-part="tags" className={cx('z-multicombobox-tags', classNames?.tags)}>
            {selectedValues.map((value) => (
              <span
                key={value}
                data-part="tag"
                className={cx('z-multicombobox-tag', classNames?.tag)}
              >
                <span
                  data-part="tag-label"
                  className={cx('z-multicombobox-tag-label', classNames?.tagLabel)}
                >
                  {resolveTagText(value)}
                </span>
                <button
                  type="button"
                  data-part="tag-remove"
                  className={cx('z-multicombobox-tag-remove', classNames?.tagRemove)}
                  aria-label={locale.accessibility.removeItem.replace(
                    '{item}',
                    resolveTagText(value)
                  )}
                  tabIndex={-1}
                  disabled={disabled}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => removeValue(value, 'remove')}
                >
                  <Close size={10} />
                </button>
              </span>
            ))}
          </span>
        ) : null}

        <input
          {...inputProps}
          type="text"
          id={inputId}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node;
          }}
          role="combobox"
          data-part="input"
          className={cx('z-multicombobox-input', classNames?.input)}
          value={draftValue}
          placeholder={selectedValues.length === 0 ? placeholderText : undefined}
          disabled={disabled}
          readOnly={readOnly}
          required={required && selectedValues.length === 0}
          form={form}
          autoComplete={autoComplete}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={effectiveOpen}
          aria-controls={effectiveOpen ? listboxId : undefined}
          aria-activedescendant={activeDescendantId}
          aria-busy={isLoading || undefined}
          aria-readonly={readOnly || undefined}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />

        {showClear ? (
          <button
            type="button"
            data-part="clear"
            className={cx('z-multicombobox-clear', classNames?.clear)}
            aria-label={locale.combobox.clear}
            onPointerDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            <Close size={14} />
          </button>
        ) : null}

        {!readOnly ? (
          <button
            type="button"
            tabIndex={-1}
            data-part="toggle"
            className={cx('z-multicombobox-toggle', classNames?.toggle)}
            aria-label={effectiveOpen ? locale.combobox.hideOptions : locale.combobox.showOptions}
            disabled={disabled}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              if (effectiveOpen) requestOpen(false, 'toggle');
              else openList('first', 'toggle');
              focusInput();
            }}
          >
            <ChevronDown size={16} />
          </button>
        ) : null}
      </div>

      {name
        ? selectedValues.map((value) => (
            <input
              key={value}
              type="hidden"
              name={name}
              form={form}
              value={value}
              disabled={disabled}
            />
          ))
        : null}

      {effectiveOpen ? (
        <FloatingPanel
          open
          anchorRef={rootRef}
          matchWidth
          offsetVariable="--z-multicombobox-panel-margin-top"
        >
          <div
            ref={panelRef}
            data-part="panel"
            data-open="true"
            data-loading={isLoading ? 'true' : undefined}
            className={cx('z-multicombobox-panel', classNames?.panel)}
          >
            <div
              id={listboxId}
              role="listbox"
              data-part="listbox"
              className={cx('z-multicombobox-listbox', classNames?.listbox)}
              aria-multiselectable="true"
              aria-busy={isLoading || undefined}
            >
              {filteredOptions.map((option, index) => (
                <div
                  key={`${option.value}-${index}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={optionId(index)}
                  role="option"
                  data-part="option"
                  className={cx('z-multicombobox-option', classNames?.option)}
                  aria-label={hasComplexLabel(option) ? getOptionText(option) : undefined}
                  aria-selected={selectedValues.includes(option.value)}
                  aria-disabled={isOptionDisabled(option) || undefined}
                  data-active={activeIndex === index ? 'true' : undefined}
                  data-stale={isLoading ? 'true' : undefined}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActiveValue(option.value)}
                  onClick={() => toggleOption(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div
                data-part="loading"
                className={cx('z-multicombobox-status', classNames?.loading, classNames?.status)}
                role="status"
                aria-live="polite"
              >
                {loadingText}
              </div>
            ) : showError ? (
              <div
                data-part="error"
                className={cx(
                  'z-multicombobox-status',
                  'z-multicombobox-status-error',
                  classNames?.error,
                  classNames?.status
                )}
                role="status"
                aria-live="polite"
              >
                {errorContent}
              </div>
            ) : showEmpty ? (
              <div
                data-part="empty"
                className={cx('z-multicombobox-status', classNames?.empty, classNames?.status)}
                role="status"
                aria-live="polite"
              >
                {emptyText}
              </div>
            ) : null}

            <div
              data-part="status"
              data-kind="results"
              data-hidden="true"
              className={cx('z-multicombobox-status', classNames?.status)}
              role="status"
              aria-live={isLoading || showError || showEmpty ? 'off' : 'polite'}
            >
              {resultsStatusText}
            </div>
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
