'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle, Close, Info, XCircle } from '@zui/icons';
import { useZuiConfig } from '../../config';
import { cx, Portal } from '../../utils';
import {
  NotificationContext,
  type NotificationApi,
  type NotificationConfig,
  type NotificationItem,
  type NotificationPlacement,
  type NotificationVariant,
} from './useNotification';
import './Notification.css';

/** 退场动画时长：先置 closing，200ms 后移除 */
const EXIT_MS = 200;
const DEFAULT_DURATION = 4500;

export interface NotificationProviderProps {
  children?: React.ReactNode;
  /** 最多同时显示条数，超出挤掉最旧，默认 3 */
  max?: number;
  /** 默认出现位置，默认 'topRight' */
  placement?: NotificationPlacement;
  classNames?: { root?: string; item?: string };
}

const PLACEMENTS: NotificationPlacement[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function NotificationIcon({ variant }: { variant: NotificationVariant }) {
  // 图标来自 @zui/icons（容器 .z-notification-icon 控制最终尺寸）
  if (variant === 'default') return null;
  if (variant === 'success') return <CheckCircle />;
  if (variant === 'error') return <XCircle />;
  if (variant === 'warning') return <AlertTriangle />;
  return <Info />;
}

export function NotificationProvider({
  children,
  max = 3,
  placement = 'topRight',
  classNames,
}: NotificationProviderProps) {
  const { locale } = useZuiConfig();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const itemsRef = React.useRef<NotificationItem[]>([]);
  const timersRef = React.useRef(
    new Map<string, { auto?: ReturnType<typeof setTimeout>; exit?: ReturnType<typeof setTimeout> }>()
  );
  const idCounterRef = React.useRef(0);

  const commit = React.useCallback((updater: (prev: NotificationItem[]) => NotificationItem[]) => {
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
    (variant: NotificationVariant, config: NotificationConfig): string => {
      idCounterRef.current += 1;
      const id = `z-notification-${idCounterRef.current}`;
      const item: NotificationItem = {
        id,
        variant,
        title: config.title,
        description: config.description,
        duration: config.duration ?? DEFAULT_DURATION,
        closable: config.closable ?? true,
        placement: config.placement ?? placement,
        icon: config.icon,
        onClick: config.onClick,
        state: 'open',
      };

      // max 超出时挤掉最旧
      const overflow = Math.max(itemsRef.current.length + 1 - max, 0);
      const evicted = overflow > 0 ? itemsRef.current.slice(0, overflow) : [];
      for (const old of evicted) clearTimers(old.id);
      commit((prev) => [...prev.slice(evicted.length), item]);

      if (item.duration > 0) {
        const timers = timersRef.current.get(id) ?? {};
        timers.auto = setTimeout(() => startClose(id), item.duration);
        timersRef.current.set(id, timers);
      }
      return id;
    },
    [max, placement, clearTimers, commit, startClose]
  );

  const destroy = React.useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.state === 'open') startClose(item.id);
    }
  }, [startClose]);

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

  const api = React.useMemo<NotificationApi>(
    () => ({
      open: (config) => create('default', config),
      success: (config) => create('success', config),
      error: (config) => create('error', config),
      warning: (config) => create('warning', config),
      info: (config) => create('info', config),
      close: startClose,
      destroy,
    }),
    [create, startClose, destroy]
  );

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <Portal>
        {PLACEMENTS.map((place) => {
          const group = items.filter((item) => item.placement === place);
          if (group.length === 0) return null;
          return (
            <div
              key={place}
              className={cx('z-notification-list', classNames?.root)}
              data-part="root"
              data-placement={place}
            >
              {group.map((item) => (
                <div
                  key={item.id}
                  className={cx('z-notification', classNames?.item)}
                  data-part="item"
                  data-variant={item.variant}
                  data-state={item.state}
                  data-clickable={item.onClick ? 'true' : undefined}
                  role={item.variant === 'error' ? 'alert' : 'status'}
                  aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
                  onClick={item.onClick}
                >
                  {item.icon ? (
                    item.icon
                  ) : item.variant !== 'default' ? (
                    <span className="z-notification-icon" data-part="icon">
                      <NotificationIcon variant={item.variant} />
                    </span>
                  ) : null}
                  <div className="z-notification-body" data-part="body">
                    <div className="z-notification-title" data-part="title">
                      {item.title}
                    </div>
                    {item.description !== undefined && item.description !== null ? (
                      <div className="z-notification-description" data-part="description">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                  {item.closable ? (
                    <button
                      type="button"
                      className="z-notification-close"
                      data-part="close"
                      aria-label={locale.message.close}
                      onClick={(event) => {
                        event.stopPropagation();
                        startClose(item.id);
                      }}
                    >
                      <Close size={12} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </Portal>
    </NotificationContext.Provider>
  );
}
