'use client';

import * as React from 'react';
import { ChevronDown, Close } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { FloatingPanel, cx, useControllableState, useOnClickOutside } from '../../utils';
import './Combobox.css';

export interface ComboboxOption {
  value: string;
  label: React.ReactNode;
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
}

export type ComboboxInputChangeReason = 'input' | 'selection' | 'clear' | 'reset';

export type ComboboxOpenChangeReason =
  'input' | 'focus' | 'toggle' | 'keyboard' | 'selection' | 'escape' | 'blur' | 'outside' | 'clear';

export interface ComboboxInputChangeDetails {
  reason: ComboboxInputChangeReason;
  isComposing: boolean;
}

export interface ComboboxOpenChangeDetails {
  reason: ComboboxOpenChangeReason;
}

export interface ComboboxChangeDetails {
  reason: 'selection' | 'clear';
}

export interface ComboboxProps extends Omit<
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
  options: readonly ComboboxOption[];

  value?: string | null;
  defaultValue?: string | null;
  onChange?: (
    value: string | null,
    option: ComboboxOption | null,
    details: ComboboxChangeDetails
  ) => void;

  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (inputValue: string, details: ComboboxInputChangeDetails) => void;
  onSearch?: (query: string) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: ComboboxOpenChangeDetails) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;

  filterOption?: false | ((option: ComboboxOption, query: string) => boolean);
  displayValue?: (value: string, option: ComboboxOption | undefined) => string;

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

function normalizeCommittedValue(value: string | null | undefined): string | null {
  return value == null || value === '' ? null : value;
}

function getOptionText(option: ComboboxOption): string {
  if (option.textValue !== undefined) return option.textValue;
  if (typeof option.label === 'string' || typeof option.label === 'number') {
    return String(option.label);
  }
  return option.value;
}

function hasComplexLabel(option: ComboboxOption): boolean {
  return typeof option.label !== 'string' && typeof option.label !== 'number';
}

function isOptionDisabled(option: ComboboxOption): boolean {
  return option.disabled === true || option.value === '';
}

function defaultFilterOption(option: ComboboxOption, query: string): boolean {
  if (query === '') return true;
  const normalized = query.toLocaleLowerCase();
  const candidates = [getOptionText(option), option.value, ...(option.keywords ?? [])];
  return candidates.some((candidate) => candidate.toLocaleLowerCase().includes(normalized));
}

function findEnabledOption(
  options: readonly ComboboxOption[],
  direction: 'first' | 'last'
): ComboboxOption | null {
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
  if (!isProductionRuntime()) console.warn(`[ZUI Combobox] ${message}`);
}

export function Combobox(props: ComboboxProps) {
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
    displayValue,
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

  const resolveCommittedText = React.useCallback(
    (committed: string | null): string => {
      if (committed === null) return '';
      const option = options.find((candidate) => candidate.value === committed);
      if (option) return getOptionText(option);
      const explicit = displayValue?.(committed, undefined);
      if (explicit !== undefined) return explicit;
      return lastKnownTextByValueRef.current.get(committed) ?? committed;
    },
    [displayValue, options]
  );

  const defaultsRef = React.useRef<{
    value: string | null;
    input: string;
    editing: boolean;
  } | null>(null);
  if (defaultsRef.current === null) {
    const initialValue = normalizeCommittedValue(defaultValue);
    let initialInput = defaultInputValue;
    let initialEditing = initialValue === null && defaultInputValue !== '';
    if (initialValue !== null) {
      const option = options.find((candidate) => candidate.value === initialValue);
      const explicit = option ? getOptionText(option) : displayValue?.(initialValue, undefined);
      if (explicit !== undefined) initialInput = explicit;
      else if (defaultInputValue !== '') {
        lastKnownTextByValueRef.current.set(initialValue, defaultInputValue);
      } else {
        initialInput = initialValue;
      }
      initialEditing = false;
    }
    defaultsRef.current = { value: initialValue, input: initialInput, editing: initialEditing };
  }
  const defaults = defaultsRef.current;

  const valueControlled = valueProp !== undefined;
  const inputControlled = inputValueProp !== undefined;
  const openControlled = openProp !== undefined;

  const [committedValue, setCommittedValue] = useControllableState<string | null>({
    value: valueControlled ? normalizeCommittedValue(valueProp) : undefined,
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

  const initialEditing =
    committedValue === null && (inputControlled ? inputValueProp !== '' : defaults.editing);
  const [editing, setEditing] = React.useState(initialEditing);
  const [filterQuery, setFilterQuery] = React.useState(initialEditing ? draftValue : '');
  const [activeValue, setActiveValue] = React.useState<string | null>(null);

  const committedText = resolveCommittedText(committedValue);
  const effectiveEditing = editing || (inputControlled && draftValue !== committedText);
  const effectiveFilterQuery = inputControlled ? (effectiveEditing ? draftValue : '') : filterQuery;

  const committedRef = React.useRef(committedValue);
  const draftRef = React.useRef(draftValue);
  const editingRef = React.useRef(editing);
  const openRef = React.useRef(open);
  const lastReportedInputRef = React.useRef(draftValue);
  committedRef.current = committedValue;
  draftRef.current = draftValue;
  editingRef.current = effectiveEditing;
  openRef.current = open;

  if (committedValue !== null) {
    const committedOption = options.find((option) => option.value === committedValue);
    if (committedOption) {
      lastKnownTextByValueRef.current.set(committedValue, getOptionText(committedOption));
    }
  }

  const baseId = React.useId();
  const inputId = id ?? `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const placeholderText = placeholder === undefined ? locale.combobox.placeholder : placeholder;
  const loadingText = loadingContent === undefined ? locale.combobox.loading : loadingContent;
  const emptyText = emptyContent === undefined ? locale.combobox.empty : emptyContent;

  const filteredOptions = React.useMemo(() => {
    if (filterOption === false) return options;
    const predicate = filterOption ?? defaultFilterOption;
    return options.filter((option) => predicate(option, effectiveFilterQuery));
  }, [effectiveFilterQuery, filterOption, options]);

  const activeIndex =
    activeValue === null ? -1 : filteredOptions.findIndex((option) => option.value === activeValue);
  const effectiveOpen = open && !disabled && !readOnly;
  const visibleInputValue = effectiveEditing ? draftValue : committedText;
  const isLoading = loading === true;
  const showError = !isLoading && errorContent != null;
  const showEmpty = !isLoading && !showError && filteredOptions.length === 0;
  const resultsStatusText = locale.combobox.results.replace(
    '{count}',
    String(filteredOptions.length)
  );

  const requestInput = React.useCallback(
    (next: string, reason: ComboboxInputChangeReason, isComposing: boolean) => {
      draftRef.current = next;
      lastReportedInputRef.current = next;
      setDraftValue(next);
      onInputValueChange?.(next, { reason, isComposing });
    },
    [onInputValueChange, setDraftValue]
  );

  const requestOpen = React.useCallback(
    (next: boolean, reason: ComboboxOpenChangeReason) => {
      if (disabled || readOnly) return;
      if (openRef.current === next) return;
      if (!openControlled) openRef.current = next;
      setOpen(next);
      onOpenChange?.(next, { reason });
    },
    [disabled, onOpenChange, openControlled, readOnly, setOpen]
  );

  const setEditingState = React.useCallback((next: boolean) => {
    editingRef.current = next;
    setEditing(next);
  }, []);

  const restoreCommittedText = React.useCallback(() => {
    const next = resolveCommittedText(committedRef.current);
    const current = editingRef.current ? draftRef.current : next;
    setEditingState(false);
    setFilterQuery('');
    if (current !== next) requestInput(next, 'reset', false);
  }, [requestInput, resolveCommittedText, setEditingState]);

  const focusInput = React.useCallback(() => {
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const commitOption = React.useCallback(
    (option: ComboboxOption) => {
      if (disabled || readOnly || isLoading || isOptionDisabled(option)) return;
      const text = getOptionText(option);
      if (!valueControlled) committedRef.current = option.value;
      setCommittedValue(option.value);
      onChange?.(option.value, option, { reason: 'selection' });
      requestInput(text, 'selection', false);
      setEditingState(false);
      setFilterQuery('');
      requestOpen(false, 'selection');
      focusInput();
    },
    [
      disabled,
      focusInput,
      isLoading,
      onChange,
      readOnly,
      requestInput,
      requestOpen,
      setCommittedValue,
      setEditingState,
      valueControlled,
    ]
  );

  const clear = React.useCallback(() => {
    if (disabled || readOnly) return;
    if (!valueControlled) committedRef.current = null;
    setCommittedValue(null);
    onChange?.(null, null, { reason: 'clear' });
    requestInput('', 'clear', false);
    setEditingState(false);
    setFilterQuery('');
    requestOpen(false, 'clear');
    focusInput();
  }, [
    disabled,
    focusInput,
    onChange,
    readOnly,
    requestInput,
    requestOpen,
    setCommittedValue,
    setEditingState,
    valueControlled,
  ]);

  const openList = React.useCallback(
    (fallback: 'first' | 'last', reason: ComboboxOpenChangeReason) => {
      if (disabled || readOnly) return;
      if (autoHighlight) {
        const selected =
          committedRef.current === null
            ? undefined
            : filteredOptions.find(
                (option) => option.value === committedRef.current && !isOptionDisabled(option)
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
    (query: string): ComboboxOption | null => {
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

    setEditingState(true);
    if (!duplicateCompositionFinal || lastReportedInputRef.current !== next) {
      requestInput(next, 'input', isComposing);
    }
    requestOpen(true, 'input');
    if (!isComposing && !duplicateCompositionFinal) {
      setFilterQuery(next);
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
    setEditingState(true);
    if (lastReportedInputRef.current !== finalQuery) {
      requestInput(finalQuery, 'input', false);
    }
    setFilterQuery(finalQuery);
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
        restoreCommittedText();
        requestOpen(false, 'keyboard');
      }
      return;
    }

    if (!effectiveOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openList(event.key === 'ArrowUp' ? 'last' : 'first', 'keyboard');
      } else if (event.key === 'Enter' && editingRef.current) {
        event.preventDefault();
        const match = isLoading ? null : findUniqueExactMatch(draftRef.current);
        if (match) commitOption(match);
        else openList('first', 'keyboard');
      } else if (event.key === 'Escape' && editingRef.current) {
        event.preventDefault();
        restoreCommittedText();
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
        if (option) commitOption(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        restoreCommittedText();
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
      restoreCommittedText();
      requestOpen(false, 'blur');
    }
    onBlur?.(event);
  };

  const handleOutside = React.useCallback(() => {
    outsideClosingRef.current = true;
    queueMicrotask(() => {
      outsideClosingRef.current = false;
    });
    restoreCommittedText();
    requestOpen(false, 'outside');
  }, [requestOpen, restoreCommittedText]);

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
    const selected =
      committedValue === null
        ? undefined
        : filteredOptions.find(
            (option) => option.value === committedValue && !isOptionDisabled(option)
          );
    setActiveValue(selected?.value ?? findEnabledOption(filteredOptions, 'first')?.value ?? null);
  }, [activeValue, autoHighlight, committedValue, effectiveOpen, filteredOptions]);

  const previousCommittedValueRef = React.useRef(committedValue);
  React.useEffect(() => {
    if (previousCommittedValueRef.current === committedValue) return;
    previousCommittedValueRef.current = committedValue;

    const nextText = resolveCommittedText(committedValue);
    if (!inputControlled) {
      draftRef.current = nextText;
      lastReportedInputRef.current = nextText;
      setDraftValue(nextText);
    }
    setEditingState(false);
    setFilterQuery('');
  }, [committedValue, inputControlled, resolveCommittedText, setDraftValue, setEditingState]);

  React.useEffect(() => {
    if (!effectiveOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, effectiveOpen]);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const invalid = required && committedValue === null;
    input.setCustomValidity(invalid ? locale.form.required : '');
  }, [committedValue, locale.form.required, required]);

  React.useEffect(() => {
    const input = inputRef.current;
    const ownerForm = input?.form;
    if (!ownerForm) return undefined;
    const handleReset = () => {
      const resetValue = valueControlled ? committedRef.current : defaults.value;
      const resetInput = inputControlled ? draftRef.current : defaults.input;
      if (!valueControlled) {
        committedRef.current = defaults.value;
        setCommittedValue(defaults.value);
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
      const resetEditing = resetValue === null && resetInput !== '';
      setEditingState(resetEditing);
      setFilterQuery(resetEditing ? resetInput : '');
      setActiveValue(null);
    };
    ownerForm.addEventListener('reset', handleReset);
    return () => ownerForm.removeEventListener('reset', handleReset);
  }, [
    defaults,
    form,
    inputControlled,
    openControlled,
    setCommittedValue,
    setDraftValue,
    setEditingState,
    setOpen,
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

    const initialValue = defaults.value;
    if (initialValue !== null && defaultInputValue !== '') {
      const option = options.find((candidate) => candidate.value === initialValue);
      const resolved = option ? getOptionText(option) : displayValue?.(initialValue, undefined);
      if (resolved !== undefined && resolved !== defaultInputValue) {
        warnInDevelopment('defaultValue 可解析时会忽略不一致的 defaultInputValue。');
      }
    }
  }, [defaultInputValue, defaults.value, displayValue, options]);

  const showClear =
    clearable && !disabled && !readOnly && (committedValue !== null || visibleInputValue !== '');
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
      className={cx('z-combobox', classNames?.root, className)}
      style={style}
      onBlur={handleRootBlur}
    >
      <div data-part="control" className={cx('z-combobox-control', classNames?.control)}>
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
          className={cx('z-combobox-input', classNames?.input)}
          value={visibleInputValue}
          placeholder={placeholderText}
          disabled={disabled}
          readOnly={readOnly}
          required={required && committedValue === null}
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
            className={cx('z-combobox-clear', classNames?.clear)}
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
            className={cx('z-combobox-toggle', classNames?.toggle)}
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

      {name ? (
        <input
          type="hidden"
          name={name}
          form={form}
          value={committedValue ?? ''}
          disabled={disabled}
        />
      ) : null}

      {effectiveOpen ? (
        <FloatingPanel
          open
          anchorRef={rootRef}
          matchWidth
          offsetVariable="--z-combobox-panel-margin-top"
        >
          <div
            ref={panelRef}
            data-part="panel"
            data-open="true"
            data-loading={isLoading ? 'true' : undefined}
            className={cx('z-combobox-panel', classNames?.panel)}
          >
            <div
              id={listboxId}
              role="listbox"
              data-part="listbox"
              className={cx('z-combobox-listbox', classNames?.listbox)}
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
                  className={cx('z-combobox-option', classNames?.option)}
                  aria-label={hasComplexLabel(option) ? getOptionText(option) : undefined}
                  aria-selected={committedValue === option.value}
                  aria-disabled={isOptionDisabled(option) || undefined}
                  data-active={activeIndex === index ? 'true' : undefined}
                  data-stale={isLoading ? 'true' : undefined}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActiveValue(option.value)}
                  onClick={() => commitOption(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div
                data-part="loading"
                className={cx('z-combobox-status', classNames?.loading, classNames?.status)}
                role="status"
                aria-live="polite"
              >
                {loadingText}
              </div>
            ) : showError ? (
              <div
                data-part="error"
                className={cx(
                  'z-combobox-status',
                  'z-combobox-status-error',
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
                className={cx('z-combobox-status', classNames?.empty, classNames?.status)}
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
              className={cx('z-combobox-status', classNames?.status)}
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
