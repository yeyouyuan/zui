'use client';

import * as React from 'react';
import { Combobox } from '../Combobox';
import { cx } from '../../utils';
import {
  studioFontFamilyInput,
  studioFontSizeInput,
  type StudioFontOption,
} from './studio-font-input';
import './StudioFontControl.css';

export type StudioFontCommitReason = 'enter' | 'selection' | 'blur';

interface StudioFontControlProps {
  label: string;
  kind: 'family' | 'size';
  maxSize?: number;
  sizeStep?: number;
  value: string;
  options: readonly StudioFontOption[];
  disabled?: boolean;
  className?: string;
  contextKey?: string;
  onEditStart?: () => void;
  onCommit: (value: string, reason: StudioFontCommitReason) => boolean | void;
  onCancel?: () => void;
}

/** Internal editable ribbon control composed from the public ZUI Combobox. */
export function StudioFontControl({
  label,
  kind,
  maxSize = 409,
  sizeStep,
  value,
  options,
  disabled = false,
  className,
  contextKey,
  onEditStart,
  onCommit,
  onCancel,
}: StudioFontControlProps) {
  const display = options.find((option) => option.value === value)?.label ?? value;
  const [draft, setDraft] = React.useState(display);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const draftRef = React.useRef(display);
  const dirtyRef = React.useRef(false);
  const composingRef = React.useRef(false);
  const blurPendingRef = React.useRef(false);
  const latest = React.useRef({ value, display, options, kind, disabled, onCommit, onCancel });
  latest.current = { value, display, options, kind, disabled, onCommit, onCancel };
  const errorId = React.useId();

  const reset = () => {
    dirtyRef.current = false;
    blurPendingRef.current = false;
    draftRef.current = latest.current.display;
    setDraft(latest.current.display);
    setError('');
    setOpen(false);
  };

  React.useLayoutEffect(() => {
    dirtyRef.current = false;
    composingRef.current = false;
    blurPendingRef.current = false;
    draftRef.current = display;
    setDraft(display);
    setError('');
    setOpen(false);
  }, [value, display, disabled, contextKey]);

  const finish = (reason: StudioFontCommitReason, optionValue?: string) => {
    const state = latest.current;
    if (state.disabled) {
      reset();
      return false;
    }
    if (composingRef.current) {
      blurPendingRef.current = reason === 'blur';
      setError('请先完成输入，再保存文档。');
      return false;
    }
    if (!dirtyRef.current && optionValue === undefined) return true;
    const normalized =
      state.kind === 'family'
        ? studioFontFamilyInput(optionValue ?? draftRef.current, state.options)
        : studioFontSizeInput(optionValue ?? draftRef.current, maxSize, sizeStep);
    if (normalized === null) {
      setError(
        state.kind === 'family'
          ? '字体名称须为 1 至 255 个有效字符。请修正输入或按 Esc 取消。'
          : `字号须为 1 至 ${maxSize} 磅。请修正输入或按 Esc 取消。`
      );
      return false;
    }
    // Clear the pending flag before calling the host, which can synchronously blur us.
    dirtyRef.current = false;
    blurPendingRef.current = false;
    setError('');
    setOpen(false);
    const accepted = normalized === state.value || state.onCommit(normalized, reason) !== false;
    if (!accepted) {
      reset();
      return false;
    }
    const next = state.options.find((option) => option.value === normalized)?.label ?? normalized;
    draftRef.current = next;
    setDraft(next);
    return true;
  };

  return (
    <span className={cx('z-studio-font-control', className)} data-part="font-control">
      <Combobox
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-studio-input-error={error || undefined}
        title={error || label}
        size="sm"
        value={value}
        inputValue={draft}
        open={open}
        options={options}
        autoHighlight={false}
        disabled={disabled}
        status={error ? 'error' : 'default'}
        inputMode={kind === 'size' ? 'decimal' : undefined}
        onFocus={(event) => {
          onEditStart?.();
          event.currentTarget.select();
        }}
        onInputValueChange={(next, details) => {
          if (details.reason !== 'input') return;
          draftRef.current = next;
          dirtyRef.current = true;
          setDraft(next);
          setError('');
        }}
        onChange={(next) => {
          if (next !== null) finish('selection', next);
        }}
        onOpenChange={(next, details) => {
          if (!next && (details.reason === 'outside' || details.reason === 'blur')) finish('blur');
          setOpen(next);
        }}
        onBlur={() => finish('blur')}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          draftRef.current = event.currentTarget.value;
          dirtyRef.current = true;
          setDraft(event.currentTarget.value);
          setError('');
          if (blurPendingRef.current) finish('blur');
        }}
        onKeyDown={(event) => {
          const native = event.nativeEvent;
          if (composingRef.current || native.isComposing || native.keyCode === 229) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            reset();
            latest.current.onCancel?.();
          } else if (
            event.key === 'Enter' &&
            !event.currentTarget.getAttribute('aria-activedescendant')
          ) {
            event.preventDefault();
            event.stopPropagation();
            finish('enter');
          }
        }}
      />
      {error && (
        <span id={errorId} className="z-studio-font-control-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
