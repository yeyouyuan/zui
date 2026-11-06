'use client';

import * as React from 'react';

export type NotificationVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export type NotificationPlacement = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface NotificationConfig {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 自动关闭时间（ms），默认 4500；0 表示不自动关闭 */
  duration?: number;
  /** 是否显示关闭按钮，默认 true */
  closable?: boolean;
  /** 出现位置（单条可覆盖 Provider 默认），默认 'topRight' */
  placement?: NotificationPlacement;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface NotificationApi {
  /** 通用打开（无状态色），返回通知 id */
  open: (config: NotificationConfig) => string;
  success: (config: NotificationConfig) => string;
  error: (config: NotificationConfig) => string;
  warning: (config: NotificationConfig) => string;
  info: (config: NotificationConfig) => string;
  /** 关闭指定通知 */
  close: (id: string) => void;
  /** 关闭全部 */
  destroy: () => void;
}

/** Provider 内部通知条目（已解析 duration/closable/placement） */
export interface NotificationItem {
  id: string;
  variant: NotificationVariant;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration: number;
  closable: boolean;
  placement: NotificationPlacement;
  icon?: React.ReactNode;
  onClick?: () => void;
  state: 'open' | 'closing';
}

export const NotificationContext = React.createContext<NotificationApi | null>(null);

export function useNotification(): NotificationApi {
  const ctx = React.useContext(NotificationContext);
  if (ctx === null) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return ctx;
}
