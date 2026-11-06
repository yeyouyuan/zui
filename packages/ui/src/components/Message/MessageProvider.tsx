'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle, Close, Info, XCircle } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { Portal } from '../../utils';
import {
  MessageContext,
  type MessageApi,
  type MessageConfig,
  type MessageItem,
  type MessageVariant,
} from './useMessage';
import './Message.css';

/** 退场动画时长：先置 closing，200ms 后移除 */
const EXIT_MS = 200;
const DEFAULT_DURATION = 3000;

export interface MessageProviderProps {
  children?: React.ReactNode;
  /** 最多同时显示条数，超出挤掉最旧，默认 3 */
  max?: number;
  /** 出现位置，默认 'top' */
  placement?: 'top' | 'bottom';
}

function MessageIcon({ variant }: { variant: MessageVariant }) {
  // 图标来自 @zui/icons（容器 .z-message-icon 控制最终尺寸）
  if (variant === 'success') return <CheckCircle />;
  if (variant === 'error') return <XCircle />;
  if (variant === 'warning') return <AlertTriangle />;
  return <Info />;
}

export function MessageProvider({
  children,
  max = 3,
  placement = 'top',
}: MessageProviderProps) {
  const { locale } = useZuiConfig();
  const [items, setItems] = React.useState<MessageItem[]>([]);
  const itemsRef = React.useRef<MessageItem[]>([]);
  const timersRef = React.useRef(
    new Map<string, { auto?: ReturnType<typeof setTimeout>; exit?: ReturnType<typeof setTimeout> }>()
  );
  const idCounterRef = React.useRef(0);

  const commit = React.useCallback((updater: (prev: MessageItem[]) => MessageItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  const clearTimers = React.useCallback((id: string) => {
    const timers = timersRef.current.get(id);
    if (timers?.auto) clearTimeout(timers.auto);
    if (timers?.exit) clearTimeout(timers.exit);
    timersRef.current.delete(id);
  }, []);

  /** 关闭流程：置 closing → 200ms 后移除；重复调用只生效一次 */
  const startClose = React.useCallback(
    (id: string) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item || item.state === 'closing') return;
      item.onClose?.();
      commit((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, state: 'closing' } : entry))
      );
      const timers = timersRef.current.get(id) ?? {};
      if (timers.auto) clearTimeout(timers.auto);
      timers.exit = setTimeout(() => {
        timersRef.current.delete(id);
        commit((prev) => prev.filter((entry) => entry.id !== id));
      }, EXIT_MS);
      timersRef.current.set(id, timers);
    },
    [commit]
  );

  const create = React.useCallback(
    (variant: MessageVariant, config: MessageConfig | string): string => {
      const cfg: MessageConfig = typeof config === 'string' ? { content: config } : config;
      idCounterRef.current += 1;
      const id = `z-message-${idCounterRef.current}`;
      const item: MessageItem = {
        id,
        variant,
        content: cfg.content,
        duration: cfg.duration ?? DEFAULT_DURATION,
        closable: cfg.closable ?? false,
        onClose: cfg.onClose,
        state: 'open',
      };

      // max 超出时挤掉最旧：立即移除、清理计时器并触发 onClose
      const overflow = Math.max(itemsRef.current.length + 1 - max, 0);
      const evicted = overflow > 0 ? itemsRef.current.slice(0, overflow) : [];
      for (const old of evicted) {
        clearTimers(old.id);
        old.onClose?.();
      }
      commit((prev) => [...prev.slice(evicted.length), item]);

      if (item.duration > 0) {
        const timers = timersRef.current.get(id) ?? {};
        timers.auto = setTimeout(() => startClose(id), item.duration);
        timersRef.current.set(id, timers);
      }
      return id;
    },
    [max, clearTimers, commit, startClose]
  );

  const clear = React.useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.state === 'open') startClose(item.id);
    }
  }, [startClose]);

  // 组件卸载时清理所有计时器
  React.useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      for (const timers of activeTimers.values()) {
        if (timers.auto) clearTimeout(timers.auto);
        if (timers.exit) clearTimeout(timers.exit);
      }
      activeTimers.clear();
    };
  }, []);

  const api = React.useMemo<MessageApi>(
    () => ({
      show: (config) => create('info', config),
      success: (config) => create('success', config),
      error: (config) => create('error', config),
      warning: (config) => create('warning', config),
      info: (config) => create('info', config),
      dismiss: startClose,
      clear,
    }),
    [create, startClose, clear]
  );

  return (
    <MessageContext.Provider value={api}>
      {children}
      <Portal>
        <div className="z-message-list" data-part="root" data-placement={placement}>
          {items.map((item) => (
            <div
              key={item.id}
              className="z-message"
              data-part="item"
              data-variant={item.variant}
              data-state={item.state}
              role="status"
              aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
            >
              <span className="z-message-icon" data-part="icon">
                <MessageIcon variant={item.variant} />
              </span>
              <div className="z-message-content" data-part="content">
                {item.content}
              </div>
              {item.closable ? (
                <button
                  type="button"
                  className="z-message-close"
                  data-part="close"
                  aria-label={locale.message.close}
                  onClick={() => startClose(item.id)}
                >
                  <Close size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Portal>
    </MessageContext.Provider>
  );
}
