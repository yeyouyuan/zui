'use client';

import * as React from 'react';
import { Download, Maximize, Minimize, RefreshCw, Save } from '@zui/icons';
import {
  cx,
  isImeComposing,
  isTopmostLayer,
  registerLayer,
  useControllableState,
  useScrollLock,
} from '../../utils';
import { Button } from '../Button';
import { Spin } from '../Spin';
import {
  nativeOfficeConfig,
  officeConfigIdentity,
  officeCustomizationConfig,
  officeServerIdentity,
} from './office-config';
import { loadOfficeEditorApi } from './office-script';
import {
  OfficeEditorError,
  type OfficeEditorEvent,
  type OfficeEditorEvents,
  type OfficeEditorInstance,
  type OfficeEditorLabels,
  type OfficeEditorProps,
  type OfficeEditorStatus,
  type OfficeEditorToolbarContext,
} from './office-types';
import './OfficeEditor.css';

const defaults: OfficeEditorLabels = {
  editor: '在线文档编辑器',
  loading: '正在打开文档编辑器…',
  ready: '编辑器已就绪',
  error: '文档编辑器需要重试',
  save: '保存文件',
  saving: '正在保存…',
  download: '下载文件',
  downloading: '正在下载…',
  reload: '重新加载',
  retrySave: '重试保存',
  retryDownload: '重试下载',
  enterFullscreen: '全屏编辑',
  exitFullscreen: '退出全屏',
};

function identityOf(
  props: Pick<OfficeEditorProps, 'documentServerUrl' | 'config' | 'events' | 'rebuildKey'>
): string {
  return JSON.stringify([
    officeServerIdentity(props.documentServerUrl),
    officeConfigIdentity(props.config),
    props.rebuildKey ?? null,
  ]);
}

function asError(
  cause: unknown,
  code: ConstructorParameters<typeof OfficeEditorError>[0],
  fallback: string
) {
  return cause instanceof OfficeEditorError
    ? cause
    : new OfficeEditorError(code, cause instanceof Error ? cause.message : fallback, { cause });
}

function nativeError(event: OfficeEditorEvent): OfficeEditorError {
  const data = event?.data;
  const description =
    data && typeof data === 'object'
      ? (data as { errorDescription?: unknown }).errorDescription
      : data;
  return new OfficeEditorError(
    'editor',
    typeof description === 'string' && description ? description : '文档编辑器报告错误，请重试。',
    { cause: event }
  );
}

/** Embeds a complete ONLYOFFICE engine; document storage and saving stay with the host. */
export function OfficeEditor({
  ref,
  documentServerUrl,
  config,
  kind,
  customization,
  disabled = false,
  events,
  onReady,
  onStatusChange,
  onError,
  onSave,
  onDownload,
  title,
  header,
  toolbar,
  height = 640,
  fullscreen: fullscreenProp,
  defaultFullscreen = false,
  onFullscreenChange,
  allowFullscreen = true,
  loading,
  renderError,
  labels: labelsProp,
  scriptTimeout = 15000,
  readyTimeout = 60000,
  scriptNonce,
  rebuildKey,
  classNames,
  className,
  style,
  ...rootProps
}: OfficeEditorProps) {
  const labels = { ...defaults, ...labelsProp };
  // The host customization only fills keys the signed configuration leaves
  // unset; identity is computed from the merged result so a customization
  // change recreates the editor like any other structural config change.
  const effectiveConfig = React.useMemo(
    () => officeCustomizationConfig(config, customization),
    [config, customization]
  );
  const [fullscreen, setFullscreen] = useControllableState({
    value: fullscreenProp,
    defaultValue: defaultFullscreen,
    onChange: onFullscreenChange,
  });
  const [status, setStatus] = React.useState<OfficeEditorStatus>('loading');
  const [error, setError] = React.useState<OfficeEditorError | null>(null);
  const [editor, setEditor] = React.useState<OfficeEditorInstance | null>(null);
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [attempt, advanceAttempt] = React.useReducer((value: number) => value + 1, 0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<OfficeEditorInstance | null>(null);
  const readyRef = React.useRef(false);
  const generationRef = React.useRef(0);
  const activeRef = React.useRef({ active: false });
  const bindEventsRef = React.useRef<(() => void) | null>(null);
  const actions = React.useRef<Partial<Record<'save' | 'download', Promise<void>>>>({});
  const prefix = `z-office-editor-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const latest = React.useRef({
    documentServerUrl,
    config: effectiveConfig,
    disabled,
    events,
    onReady,
    onStatusChange,
    onError,
    onSave,
    onDownload,
    labels,
    scriptTimeout,
    readyTimeout,
    scriptNonce,
    rebuildKey,
  });
  latest.current = {
    documentServerUrl,
    config: effectiveConfig,
    disabled,
    events,
    onReady,
    onStatusChange,
    onError,
    onSave,
    onDownload,
    labels,
    scriptTimeout,
    readyTimeout,
    scriptNonce,
    rebuildKey,
  };
  const reload = React.useCallback(() => {
    if (!latest.current.disabled && !actions.current.save && !actions.current.download)
      advanceAttempt();
  }, []);
  const requestFullscreen = React.useCallback(
    (value: boolean) => {
      if (!latest.current.disabled) setFullscreen(value);
    },
    [setFullscreen]
  );
  const identity = identityOf(latest.current);

  const changeStatus = React.useCallback((value: OfficeEditorStatus) => {
    setStatus(value);
    try {
      latest.current.onStatusChange?.(value);
    } catch (cause) {
      console.error('[ZUI OfficeEditor] onStatusChange failed.', cause);
    }
  }, []);

  const reportError = React.useCallback(
    (failure: OfficeEditorError, lifecycle = true) => {
      setError(failure);
      if (lifecycle) changeStatus('error');
      try {
        latest.current.onError?.(failure);
      } catch (cause) {
        console.error('[ZUI OfficeEditor] onError failed.', cause);
      }
    },
    [changeStatus]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      reload,
      getEditor: () => editorRef.current,
      setFullscreen: requestFullscreen,
    }),
    [reload, requestFullscreen]
  );
  useScrollLock(fullscreen);
  React.useEffect(() => {
    const node = rootRef.current;
    if (!fullscreen || !node) return;
    const unregister = registerLayer(node);
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        isImeComposing(event) ||
        !isTopmostLayer(node)
      )
        return;
      event.preventDefault();
      setFullscreen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      unregister();
      document.removeEventListener('keydown', escape);
    };
  }, [fullscreen, setFullscreen]);

  React.useEffect(() => {
    const life = { active: true };
    activeRef.current = life;
    const generation = ++generationRef.current;
    const canvas = canvasRef.current;
    let instance: OfficeEditorInstance | null = null;
    let readyEvent: OfficeEditorEvent | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let bindEvents: (() => void) | undefined;
    readyRef.current = false;
    actions.current = {};
    setInitialized(false);
    setEditor(null);
    setSaving(false);
    setDownloading(false);
    setError(null);
    changeStatus('loading');

    const forward = (callback: (() => void) | undefined) => {
      if (!callback || !life.active) return;
      try {
        callback();
      } catch (cause) {
        reportError(asError(cause, 'event-handler', '文档事件处理失败。'), false);
      }
    };

    void loadOfficeEditorApi(latest.current.documentServerUrl, {
      timeout: latest.current.scriptTimeout,
      nonce: latest.current.scriptNonce,
    })
      .then((api) => {
        if (!life.active || !canvas || identityOf(latest.current) !== identity) return;
        const initial = latest.current.config;
        if (!initial.document?.key || typeof initial.document.key !== 'string')
          throw new OfficeEditorError('invalid-config', '文档配置缺少有效的文件标识。');
        const mount = document.createElement('div');
        mount.id = `${prefix}-${generation}`;
        mount.style.width = '100%';
        mount.style.height = '100%';
        canvas.replaceChildren(mount);
        const combined: OfficeEditorEvents = {};
        bindEvents = () => {
          if (!life.active) return;
          const names = new Set([
            'onAppReady',
            'onDocumentReady',
            'onDocumentStateChange',
            'onError',
            ...Object.keys(latest.current.config.events ?? {}),
            ...Object.keys(latest.current.events ?? {}),
          ]);
          for (const name of Object.keys(combined)) {
            if (!names.has(name)) delete combined[name];
          }
          for (const name of names) {
            if (combined[name]) continue;
            combined[name] = (event: OfficeEditorEvent) => {
              if (!life.active) return;
              if (name === 'onDocumentReady') {
                clearTimeout(timer);
                readyRef.current = true;
                readyEvent = event ?? {};
                setInitialized(true);
                setError(null);
                changeStatus('ready');
              } else if (name === 'onError') {
                clearTimeout(timer);
                reportError(nativeError(event));
              }
              // Each source retains its own handler, with updated references. A shared
              // function is invoked once even if it appears in both event maps.
              const handlers = new Set([
                latest.current.config.events?.[name],
                latest.current.events?.[name],
              ]);
              for (const handler of handlers) {
                if (typeof handler === 'function') forward(() => handler(event));
              }
              if (name === 'onDocumentReady' && instance) {
                forward(() => latest.current.onReady?.(instance!, readyEvent!));
                readyEvent = undefined;
              }
            };
          }
        };
        bindEventsRef.current = bindEvents;
        bindEvents();
        const wait = latest.current.readyTimeout;
        if (Number.isFinite(wait) && wait > 0) {
          timer = setTimeout(() => {
            if (life.active && !readyRef.current)
              reportError(new OfficeEditorError('ready-timeout', '打开文档超时，请重试。'));
          }, wait);
        }
        // Only the unsigned event callbacks are composed. The backend's token,
        // document permissions, editor mode and other fields stay untouched.
        instance = new api.DocEditor(mount.id, {
          ...nativeOfficeConfig(initial),
          events: combined,
        });
        editorRef.current = instance;
        setEditor(instance);
        const iframe = canvas.querySelector('iframe');
        if (iframe && !iframe.title) iframe.title = latest.current.labels.editor;
        if (readyEvent) {
          const event = readyEvent;
          readyEvent = undefined;
          forward(() => latest.current.onReady?.(instance!, event));
        }
      })
      .catch((cause: unknown) => {
        clearTimeout(timer);
        if (life.active) {
          if (!instance) setInitialized(false);
          reportError(asError(cause, 'editor-create', '无法打开文档编辑器，请重试。'));
        }
      });

    return () => {
      life.active = false;
      if (bindEventsRef.current === bindEvents) bindEventsRef.current = null;
      clearTimeout(timer);
      readyRef.current = false;
      if (editorRef.current === instance) editorRef.current = null;
      try {
        instance?.destroyEditor();
      } catch (cause) {
        console.error('[ZUI OfficeEditor] destroyEditor failed.', cause);
      } finally {
        canvas?.replaceChildren();
      }
    };
  }, [identity, attempt, prefix, changeStatus, reportError]);

  // DocsAPI retains this event map. New subscriptions extend the map without
  // replacing an active document; native UI capabilities may still need an explicit reload.
  React.useEffect(() => {
    bindEventsRef.current?.();
  });

  const runAction = React.useCallback(
    (action: 'save' | 'download'): Promise<void> => {
      const existing = actions.current[action];
      if (existing) return existing;
      const active = activeRef.current;
      const instance = editorRef.current;
      const callback = action === 'save' ? latest.current.onSave : latest.current.onDownload;
      if (!active.active || !instance || !readyRef.current || !callback || latest.current.disabled)
        return Promise.resolve();
      if (
        action === 'save' &&
        (latest.current.config.editorConfig?.mode === 'view' ||
          latest.current.config.document?.permissions?.edit === false)
      )
        return Promise.resolve();
      const setPending = action === 'save' ? setSaving : setDownloading;
      setPending(true);
      setError(null);
      const pending = Promise.resolve()
        .then(() => callback(instance))
        .catch((cause: unknown) => {
          const fallback = action === 'save' ? '文件保存失败，请重试。' : '文件下载失败，请重试。';
          const failure = new OfficeEditorError(
            action,
            cause instanceof Error ? cause.message : fallback,
            { cause }
          );
          if (active.active) reportError(failure, false);
          throw failure;
        })
        .finally(() => {
          if (actions.current[action] === pending) delete actions.current[action];
          if (active.active) setPending(false);
        });
      actions.current[action] = pending;
      return pending;
    },
    [reportError]
  );

  const context: OfficeEditorToolbarContext = {
    status,
    editor,
    error,
    saving,
    downloading,
    fullscreen,
    disabled,
    reload,
    save: () => runAction('save'),
    download: () => runAction('download'),
    setFullscreen: requestFullscreen,
  };
  const editable =
    config.editorConfig?.mode !== 'view' && config.document?.permissions?.edit !== false;
  const displayTitle = title ?? config.document?.title ?? labels.editor;
  const statusText =
    status === 'loading' ? labels.loading : status === 'error' ? labels.error : labels.ready;
  const customHeader = typeof header === 'function' ? header(context) : header;
  const customToolbar = typeof toolbar === 'function' ? toolbar(context) : toolbar;
  const defaultToolbar = (
    <>
      <div data-part="heading" className={cx('z-office-editor-heading', classNames?.heading)}>
        <span data-part="brand" className={cx('z-office-editor-brand', classNames?.brand)}>
          ONLYOFFICE
        </span>
        <strong data-part="title" className={cx('z-office-editor-title', classNames?.title)}>
          {displayTitle}
        </strong>
        <span
          data-part="status"
          className={cx('z-office-editor-status', classNames?.status)}
          role="status"
          data-save-state={status}
        >
          <span className="z-office-editor-status-dot" aria-hidden="true" />
          <span className="z-office-editor-status-label">{statusText}</span>
        </span>
      </div>
      <div data-part="actions" className={cx('z-office-editor-actions', classNames?.actions)}>
        {onDownload && (
          <Button
            size="sm"
            variant="outline"
            iconStart={<Download />}
            loading={downloading}
            disabled={disabled || !initialized}
            onClick={() => void context.download().catch(() => {})}
          >
            {downloading ? labels.downloading : labels.download}
          </Button>
        )}
        {onSave && editable && (
          <Button
            size="sm"
            iconStart={<Save />}
            loading={saving}
            disabled={disabled || !initialized}
            onClick={() => void context.save().catch(() => {})}
          >
            {saving ? labels.saving : labels.save}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          iconStart={<RefreshCw />}
          disabled={disabled || saving || downloading}
          onClick={reload}
        >
          {labels.reload}
        </Button>
        {allowFullscreen && (
          <Button
            size="sm"
            variant="ghost"
            iconStart={fullscreen ? <Minimize /> : <Maximize />}
            aria-pressed={fullscreen}
            disabled={disabled}
            onClick={() => requestFullscreen(!fullscreen)}
          >
            {fullscreen ? labels.exitFullscreen : labels.enterFullscreen}
          </Button>
        )}
      </div>
    </>
  );
  const retry = () => {
    if (error?.code === 'save') void context.save().catch(() => {});
    else if (error?.code === 'download') void context.download().catch(() => {});
    else reload();
  };
  const retryLabel =
    error?.code === 'save'
      ? labels.retrySave
      : error?.code === 'download'
        ? labels.retryDownload
        : labels.reload;
  const errorContent =
    error &&
    (renderError ? (
      renderError(error, retry)
    ) : (
      <div data-part="error" className={cx('z-office-editor-error', classNames?.error)}>
        <p>{error.message}</p>
        <Button
          size="sm"
          variant="outline"
          iconStart={<RefreshCw />}
          disabled={disabled || saving || downloading}
          onClick={retry}
        >
          {retryLabel}
        </Button>
      </div>
    ));

  return (
    <div
      {...rootProps}
      ref={rootRef}
      role={rootProps.role ?? 'region'}
      aria-label={
        rootProps['aria-label'] ?? (typeof displayTitle === 'string' ? displayTitle : labels.editor)
      }
      aria-busy={status === 'loading' || undefined}
      aria-disabled={disabled || undefined}
      data-part="root"
      data-kind={kind}
      data-status={status}
      data-disabled={disabled ? 'true' : undefined}
      data-fullscreen={fullscreen ? 'true' : undefined}
      className={cx('z-office-editor', className, classNames?.root)}
      style={{ height, ...style }}
    >
      {customHeader != null && customHeader !== false && (
        <div data-part="header" className={cx('z-office-editor-header', classNames?.header)}>
          {customHeader}
        </div>
      )}
      {toolbar !== false && (
        <div data-part="toolbar" className={cx('z-office-editor-toolbar', classNames?.toolbar)}>
          {toolbar === undefined ? defaultToolbar : customToolbar}
        </div>
      )}
      {error && initialized && (
        <div
          role="alert"
          data-part="notice"
          className={cx('z-office-editor-notice', classNames?.notice)}
        >
          {errorContent}
        </div>
      )}
      <div
        data-part="stage"
        inert={disabled || undefined}
        className={cx('z-office-editor-stage', classNames?.stage)}
      >
        <div
          data-part="canvas"
          ref={canvasRef}
          className={cx('z-office-editor-canvas', classNames?.canvas)}
        />
        {!initialized && (
          <div
            data-part="overlay"
            className={cx('z-office-editor-overlay', classNames?.overlay)}
            role={error ? 'alert' : 'status'}
          >
            {error ? errorContent : loading === undefined ? <Spin tip={labels.loading} /> : loading}
          </div>
        )}
      </div>
    </div>
  );
}
