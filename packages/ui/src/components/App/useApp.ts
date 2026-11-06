'use client';

import * as React from 'react';
import type { MessageApi } from '../Message';
import type { NotificationApi } from '../Notification/useNotification';

/** App 内置轻量确认框配置 */
export interface AppModalConfig {
  title: React.ReactNode;
  content?: React.ReactNode;
  /** 默认 '确定' */
  okText?: string;
  /** 默认 '取消' */
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ModalApi {
  /** 弹出确认框 */
  confirm: (config: AppModalConfig) => void;
  /** 关闭当前确认框 */
  close: () => void;
}

export interface AppApi {
  message: MessageApi;
  notification: NotificationApi;
  modal: ModalApi;
}

export const AppContext = React.createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = React.useContext(AppContext);
  if (ctx === null) {
    throw new Error('useApp must be used within App');
  }
  return ctx;
}
