'use client';

import * as React from 'react';

export type MessageVariant = 'success' | 'error' | 'warning' | 'info';

export interface MessageConfig {
  content: React.ReactNode;
  /** 自动关闭时间（ms），默认 3000；0 表示不自动关闭 */
  duration?: number;
  /** 是否显示关闭按钮，默认 false */
  closable?: boolean;
  onClose?: () => void;
}

export interface MessageApi {
  show: (config: MessageConfig | string) => string;
  success: (config: MessageConfig | string) => string;
  error: (config: MessageConfig | string) => string;
  warning: (config: MessageConfig | string) => string;
  info: (config: MessageConfig | string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** Provider 内部消息条目（已解析 duration/closable） */
export interface MessageItem {
  id: string;
  variant: MessageVariant;
  content: React.ReactNode;
  duration: number;
  closable: boolean;
  onClose?: () => void;
  state: 'open' | 'closing';
}

export const MessageContext = React.createContext<MessageApi | null>(null);

export function useMessage(): MessageApi {
  const ctx = React.useContext(MessageContext);
  if (ctx === null) {
    throw new Error('useMessage must be used within MessageProvider');
  }
  return ctx;
}
