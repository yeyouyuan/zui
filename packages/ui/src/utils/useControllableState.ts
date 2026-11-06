'use client';

import * as React from 'react';

interface ControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

/**
 * 受控/非受控统一状态：
 * - 传 value → 受控，内部不持久化，变更只回调 onChange
 * - 不传 value → 非受控，内部管理，变更回调 onChange
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: ControllableStateOptions<T>): [T, (next: T | ((prev: T) => T)) => void] {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<T>(defaultValue);
  const current = isControlled ? (value as T) : internal;

  const currentRef = React.useRef(current);
  React.useEffect(() => {
    currentRef.current = current;
  });

  const setValue = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(currentRef.current) : next;
      if (!isControlled) setInternal(resolved);
      onChange?.(resolved);
    },
    [isControlled, onChange]
  );

  return [current, setValue];
}
