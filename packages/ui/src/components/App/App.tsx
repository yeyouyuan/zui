'use client';

import * as React from 'react';
import { MessageProvider, useMessage } from '../Message';
import { cx, Portal } from '../../utils';
import { useFocusTrap, useScrollLock } from '../../utils';
import { useZuiConfig } from '../../config';
import { NotificationProvider, useNotification } from '../Notification';
import type { NotificationPlacement } from '../Notification';
import { AppContext, type AppApi, type AppModalConfig, type ModalApi } from './useApp';
import './App.css';

export interface AppProps {
  children: React.ReactNode;
  message?: { max?: number; placement?: 'top' | 'bottom' };
  notification?: { max?: number; placement?: NotificationPlacement };
  className?: string;
  classNames?: { root?: string; modal?: string };
}

/** App 内部：位于 Message/Notification Provider 之内，聚合三个 API 并托管内置确认框 */
function AppInner({
  children,
  className,
  classNames,
}: Pick<AppProps, 'children' | 'className' | 'classNames'>) {
  const message = useMessage();
  const notification = useNotification();
  const [modalConfig, setModalConfig] = React.useState<AppModalConfig | null>(null);
  const { locale } = useZuiConfig();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [dialogNode, setDialogNode] = React.useState<HTMLDivElement | null>(null);
  const setDialogRef = React.useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    setDialogNode(node);
  }, []);
  useScrollLock(modalConfig !== null);
  useFocusTrap(dialogRef, { active: modalConfig !== null && dialogNode !== null });

  const modal = React.useMemo<ModalApi>(
    () => ({
      confirm: (config) => setModalConfig(config),
      close: () => setModalConfig(null),
    }),
    []
  );

  const api = React.useMemo<AppApi>(
    () => ({ message, notification, modal }),
    [message, notification, modal]
  );

  const closeModal = () => setModalConfig(null);

  return (
    <AppContext.Provider value={api}>
      <div ref={rootRef} data-part="root" className={cx('z-app', classNames?.root, className)}>
        {children}
      </div>
      {modalConfig ? (
        <Portal inheritFrom={rootRef}>
          <div
            data-part="modal"
            className={cx('z-app-modal', classNames?.modal)}
            ref={setDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={
              typeof modalConfig.title === 'string' ? modalConfig.title : locale.app.confirm
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) {
                // A nested Modal/Drawer portal can receive Escape after this
                // React handler. Leave the outer confirm open while that layer
                // is visually above it, even before the inner focus RAF runs.
                const layers = document.querySelectorAll<HTMLElement>(
                  '[data-zui-modal-layer][data-state="open"]'
                );
                const topLayer = layers[layers.length - 1];
                if (
                  topLayer &&
                  (event.currentTarget.compareDocumentPosition(topLayer) &
                    Node.DOCUMENT_POSITION_FOLLOWING) !==
                    0
                )
                  return;
                event.preventDefault();
                modalConfig.onCancel?.();
                closeModal();
              }
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                modalConfig.onCancel?.();
                closeModal();
              }
            }}
          >
            <div className="z-app-modal-content" onClick={(event) => event.stopPropagation()}>
              <div data-part="modal-title" className="z-app-modal-title">
                {modalConfig.title}
              </div>
              {modalConfig.content !== undefined && modalConfig.content !== null ? (
                <div data-part="modal-content" className="z-app-modal-desc">
                  {modalConfig.content}
                </div>
              ) : null}
              <div data-part="modal-actions" className="z-app-modal-actions">
                <button
                  type="button"
                  className="z-app-modal-btn z-app-modal-cancel"
                  onClick={() => {
                    modalConfig.onCancel?.();
                    closeModal();
                  }}
                >
                  {modalConfig.cancelText ?? locale.popconfirm.cancel}
                </button>
                <button
                  type="button"
                  data-autofocus
                  className="z-app-modal-btn z-app-modal-ok"
                  onClick={() => {
                    modalConfig.onConfirm?.();
                    closeModal();
                  }}
                >
                  {modalConfig.okText ?? locale.popconfirm.ok}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </AppContext.Provider>
  );
}

/**
 * App 容器：组合 MessageProvider + NotificationProvider + 内置确认框，
 * useApp() 统一出口，免去多 Provider 嵌套。
 */
export function App({ children, message, notification, className, classNames }: AppProps) {
  return (
    <MessageProvider max={message?.max} placement={message?.placement ?? 'top'}>
      <NotificationProvider
        max={notification?.max}
        placement={notification?.placement ?? 'topRight'}
      >
        <AppInner className={className} classNames={classNames}>
          {children}
        </AppInner>
      </NotificationProvider>
    </MessageProvider>
  );
}
