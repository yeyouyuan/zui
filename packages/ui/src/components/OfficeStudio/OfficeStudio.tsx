'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { ArrowUp, Download, FileText, Maximize, Minimize, Plus, Printer, Save } from '@zui/icons';
import {
  cx,
  isImeComposing,
  isTopmostLayer,
  registerLayer,
  useControllableState,
  useScrollLock,
} from '../../utils';
import { Button } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { Input } from '../Input';
import { createOfficeStudioDocument } from './studio-model';
import { StudioRibbonFileContext } from './StudioRibbon';
import type { OfficeStudioDocument, OfficeStudioKind, OfficeStudioProps } from './studio-types';
import './OfficeStudio.css';

const StudioWord = React.lazy(() =>
  import('./StudioWord').then((module) => ({ default: module.StudioWord }))
);
const StudioSheet = React.lazy(() =>
  import('./StudioSheet').then((module) => ({ default: module.StudioSheet }))
);
const StudioPdf = React.lazy(() =>
  import('./StudioPdf').then((module) => ({ default: module.StudioPdf }))
);

type Operation = 'save' | 'export' | 'import' | 'create' | 'print';
const kindLabels = { word: 'Word', excel: 'Excel', pdf: 'PDF' } as const;
const stateLabels = {
  saved: '已保存',
  saving: '正在保存…',
  unsaved: '有未保存修改',
  error: '保存失败，请重试',
} as const;

/** A ZUI document workspace; file codecs and persistence are host callbacks. */
export function OfficeStudio({
  ref,
  value,
  defaultValue,
  onChange,
  source,
  pdfRenderer,
  onSave,
  onExport,
  onPrint,
  onImport,
  onCreate,
  onError,
  disabled = false,
  readOnly = false,
  height = 760,
  fullscreen: fullscreenProp,
  defaultFullscreen = false,
  onFullscreenChange,
  saveState,
  classNames,
  className,
  style,
  onKeyDown,
  ...rootProps
}: OfficeStudioProps) {
  const [initial] = React.useState(() => defaultValue ?? createOfficeStudioDocument());
  const [documentValue, setDocument] = useControllableState({
    value,
    defaultValue: initial,
    onChange,
  });
  const [fullscreen, setFullscreen] = useControllableState({
    value: fullscreenProp,
    defaultValue: defaultFullscreen,
    onChange: onFullscreenChange,
  });
  const [internalState, setInternalState] = React.useState<
    'saved' | 'saving' | 'unsaved' | 'error'
  >('saved');
  const [operation, setOperation] = React.useState<Operation | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const rootRef = React.useRef<HTMLElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const documentRef = React.useRef(documentValue);
  const versionRef = React.useRef(0);
  const savedVersionRef = React.useRef(0);
  const pendingRef = React.useRef<Promise<void> | null>(null);
  const pendingOperationRef = React.useRef<Operation | null>(null);
  const retryRef = React.useRef<(() => Promise<void>) | null>(null);
  const mountedRef = React.useRef(false);
  const latest = React.useRef({
    disabled,
    readOnly,
    onSave,
    onExport,
    onPrint,
    onImport,
    onCreate,
    onError,
  });
  latest.current = { disabled, readOnly, onSave, onExport, onPrint, onImport, onCreate, onError };
  const titleId = React.useId();

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  React.useLayoutEffect(() => {
    if (documentRef.current === documentValue) return;
    const switched = documentRef.current.id !== documentValue.id;
    documentRef.current = documentValue;
    versionRef.current += 1;
    if (switched) {
      savedVersionRef.current = versionRef.current;
      setInternalState('saved');
      setError(null);
      retryRef.current = null;
    } else setInternalState('unsaved');
  }, [documentValue]);
  useScrollLock(fullscreen);
  React.useEffect(() => {
    const element = rootRef.current;
    if (!fullscreen || !element) return;
    const unregister = registerLayer(element);
    const close = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        isImeComposing(event) ||
        !isTopmostLayer(element)
      )
        return;
      event.preventDefault();
      setFullscreen(false);
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      unregister();
    };
  }, [fullscreen, setFullscreen]);

  const change = (next: OfficeStudioDocument) => {
    if (latest.current.disabled || latest.current.readOnly) return;
    if (value === undefined) {
      documentRef.current = next;
      versionRef.current += 1;
      setInternalState('unsaved');
    }
    setDocument(next);
  };

  const run = (
    nextOperation: Operation,
    action: () => void | Promise<void>,
    retry: () => Promise<void>
  ): Promise<void> => {
    if (pendingRef.current)
      return pendingOperationRef.current === nextOperation
        ? pendingRef.current
        : pendingRef.current.then(retry, retry);
    if (latest.current.disabled) return Promise.reject(new Error('编辑器已禁用。'));
    setOperation(nextOperation);
    setError(null);
    retryRef.current = retry;
    const task = Promise.resolve()
      .then(action)
      .catch((cause) => {
        const failure = cause instanceof Error ? cause : new Error('操作未完成，请重试。');
        if (mountedRef.current) {
          setError(failure);
          if (nextOperation === 'save') setInternalState('error');
          latest.current.onError?.(failure);
        }
        throw failure;
      })
      .finally(() => {
        pendingRef.current = null;
        pendingOperationRef.current = null;
        if (mountedRef.current) setOperation(null);
      });
    pendingRef.current = task;
    pendingOperationRef.current = nextOperation;
    return task;
  };

  const commitFocusedInput = (retry?: () => Promise<void>): Error | undefined => {
    const active = globalThis.document?.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active))
      flushSync(() => active.blur());
    const message = rootRef.current?.querySelector<HTMLElement>('[data-studio-input-error]')
      ?.dataset.studioInputError;
    if (!message) return;
    const failure = new Error(message);
    setError(failure);
    retryRef.current = retry ?? null;
    latest.current.onError?.(failure);
    return failure;
  };

  const save = (): Promise<void> => {
    const commitError = commitFocusedInput(save);
    if (commitError) {
      setInternalState('error');
      return Promise.reject(commitError);
    }
    if (pendingRef.current)
      return pendingOperationRef.current === 'save'
        ? pendingRef.current
        : pendingRef.current.then(save, save);
    if (!latest.current.onSave || latest.current.readOnly || latest.current.disabled)
      return Promise.resolve();
    const snapshot = documentRef.current;
    const version = versionRef.current;
    const onSave = latest.current.onSave;
    setInternalState('saving');
    return run(
      'save',
      async () => {
        await onSave(snapshot);
        if (!mountedRef.current || documentRef.current.id !== snapshot.id) return;
        savedVersionRef.current = version;
        setInternalState(versionRef.current === version ? 'saved' : 'unsaved');
      },
      save
    );
  };
  const exportDocument = (): Promise<void> => {
    const onExport = latest.current.onExport;
    if (!onExport) return Promise.resolve();
    const commitError = commitFocusedInput(exportDocument);
    if (commitError) return Promise.reject(commitError);
    const snapshot = documentRef.current;
    return run('export', () => onExport(snapshot), exportDocument);
  };
  const printDocument = (): Promise<void> => {
    const onPrint = latest.current.onPrint;
    if (!onPrint) return Promise.resolve();
    const commitError = commitFocusedInput(printDocument);
    if (commitError) return Promise.reject(commitError);
    const snapshot = documentRef.current;
    return run('print', () => onPrint(snapshot), printDocument);
  };
  const create = (kind: OfficeStudioKind): Promise<void> => {
    if (latest.current.readOnly || latest.current.disabled) return Promise.resolve();
    const commitError = commitFocusedInput(() => create(kind));
    if (commitError) return Promise.reject(commitError);
    const onCreate = latest.current.onCreate;
    return run(
      'create',
      async () => {
        if (onCreate) await onCreate(kind);
        else change(createOfficeStudioDocument(kind));
      },
      () => create(kind)
    );
  };
  const importFile = (file: File): Promise<void> => {
    const onImport = latest.current.onImport;
    if (!onImport || latest.current.readOnly || latest.current.disabled) return Promise.resolve();
    const commitError = commitFocusedInput(() => importFile(file));
    if (commitError) return Promise.reject(commitError);
    return run(
      'import',
      () => onImport(file),
      () => importFile(file)
    );
  };
  React.useImperativeHandle(ref, () => ({
    getDocument: () => {
      const commitError = commitFocusedInput();
      if (commitError) throw commitError;
      return documentRef.current;
    },
    save,
    export: exportDocument,
    print: printDocument,
    setFullscreen,
  }));

  const busy = operation !== null;
  const replacing = operation === 'import' || operation === 'create';
  const actionDisabled = disabled || busy;
  const editingDisabled = actionDisabled || readOnly;
  const state =
    saveState ??
    (operation === 'save'
      ? 'saving'
      : versionRef.current > savedVersionRef.current && internalState === 'saved'
        ? 'unsaved'
        : internalState);
  const editorProps = {
    onChange: change,
    disabled: disabled || replacing,
    readOnly,
    source,
    pdfRenderer,
  };
  const consume = (task: Promise<void>) => {
    void task.catch(() => {});
  };
  const fileMenu = (
    <DropdownMenu>
      <div className="z-office-studio-file-menu">
        <DropdownMenu.Trigger
          className="z-office-studio-file-trigger"
          disabled={actionDisabled}
          aria-label="文件"
        >
          文件
        </DropdownMenu.Trigger>
      </div>
      <DropdownMenu.Content className="z-office-studio-file-content">
        <DropdownMenu.Label>新建</DropdownMenu.Label>
        {(['word', 'excel', 'pdf'] as const).map((kind) => (
          <DropdownMenu.Item
            key={kind}
            disabled={editingDisabled || (kind === 'pdf' && !onCreate)}
            onSelect={() => consume(create(kind))}
          >
            {kindLabels[kind]} 文档
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          disabled={!onImport || editingDisabled}
          onSelect={() => fileRef.current?.click()}
        >
          <span className="z-office-studio-file-action">
            <ArrowUp size={16} />
            打开文件
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={!onSave || editingDisabled} onSelect={() => consume(save())}>
          <span className="z-office-studio-file-action">
            <Save size={16} />
            保存
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={!onExport || actionDisabled}
          onSelect={() => consume(exportDocument())}
        >
          <span className="z-office-studio-file-action">
            <Download size={16} />
            导出文件
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={!onPrint || actionDisabled}
          onSelect={() => consume(printDocument())}
        >
          <span className="z-office-studio-file-action">
            <Printer size={16} />
            打印
          </span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );

  return (
    <section
      {...rootProps}
      ref={rootRef}
      data-part="root"
      data-kind={documentValue.kind}
      data-fullscreen={fullscreen ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      aria-label={rootProps['aria-label'] ?? `${kindLabels[documentValue.kind]} 文档编辑器`}
      aria-busy={busy || undefined}
      className={cx('z-office-studio', classNames?.root, className)}
      style={{ height, ...style }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || isImeComposing(event.nativeEvent)) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          consume(save());
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && onPrint) {
          event.preventDefault();
          consume(printDocument());
        }
      }}
    >
      <header data-part="header" className={cx('z-office-studio-header', classNames?.header)}>
        <div className="z-office-studio-header-start">
          <div className="z-office-studio-brand" aria-hidden="true">
            <FileText size={18} />
            <span>{kindLabels[documentValue.kind]}</span>
          </div>
          <div
            data-part="status"
            className={cx('z-office-studio-status', classNames?.status)}
            title={replacing ? '正在准备文档…' : readOnly ? '只读预览' : '可编辑 · ⌘ / Ctrl S 保存'}
          >
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-save-state={state}
              title={replacing ? '正在准备文档…' : stateLabels[state]}
            >
              <span className="z-office-studio-status-dot" aria-hidden="true" />
              <span className="z-office-studio-save-label">
                {replacing ? '正在准备文档…' : stateLabels[state]}
              </span>
            </span>
            {readOnly && <span className="z-office-studio-readonly">只读</span>}
          </div>
        </div>
        <div data-part="title" className={cx('z-office-studio-title', classNames?.title)}>
          <Input
            id={titleId}
            size="sm"
            aria-label="文档名称"
            value={documentValue.name}
            readOnly={readOnly}
            disabled={disabled || replacing}
            spellCheck={false}
            onChange={(event) => change({ ...documentRef.current, name: event.target.value })}
          />
        </div>
        <div data-part="actions" className={cx('z-office-studio-actions', classNames?.actions)}>
          <DropdownMenu>
            <DropdownMenu.Trigger
              disabled={editingDisabled}
              className="z-office-studio-new"
              aria-label="新建"
              title="新建文档"
            >
              <Plus size={15} aria-hidden="true" />
              <span className="z-office-studio-action-label">新建</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Label>新建文档</DropdownMenu.Label>
              {(['word', 'excel', 'pdf'] as const).map((kind) => (
                <DropdownMenu.Item
                  key={kind}
                  disabled={editingDisabled || (kind === 'pdf' && !onCreate)}
                  onSelect={() => consume(create(kind))}
                >
                  {kindLabels[kind]} 文档
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={<ArrowUp size={15} />}
            aria-label="导入"
            title="打开文件"
            disabled={!onImport || disabled || readOnly || busy}
            onClick={() => fileRef.current?.click()}
          >
            <span className="z-office-studio-action-label">导入</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={<Download size={15} />}
            aria-label="导出文件"
            title="导出文件"
            loading={operation === 'export'}
            disabled={!onExport || disabled || (busy && operation !== 'export')}
            onClick={() => consume(exportDocument())}
          >
            <span className="z-office-studio-action-label">导出文件</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={<Printer size={15} />}
            aria-label="打印"
            title="打印（Ctrl / ⌘ + P）"
            loading={operation === 'print'}
            disabled={!onPrint || disabled || (busy && operation !== 'print')}
            onClick={() => consume(printDocument())}
          >
            <span className="z-office-studio-action-label">打印</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={<Save size={15} />}
            aria-label="保存"
            title="保存（Ctrl / ⌘ + S）"
            loading={operation === 'save'}
            disabled={!onSave || disabled || readOnly || (busy && operation !== 'save')}
            onClick={() => consume(save())}
          >
            <span className="z-office-studio-action-label">保存</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            aria-label={fullscreen ? '退出全屏' : '全屏编辑'}
            aria-pressed={fullscreen}
            onClick={() => setFullscreen(!fullscreen)}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.xlsx,.pdf"
          aria-label="导入文档文件"
          hidden
          disabled={disabled || readOnly || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) consume(importFile(file));
          }}
        />
      </header>
      {error && (
        <div
          role="alert"
          data-part="error"
          className={cx('z-office-studio-error', classNames?.error)}
        >
          <span>{error.message}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => {
              if (retryRef.current) consume(retryRef.current());
            }}
          >
            重试
          </Button>
        </div>
      )}
      <StudioRibbonFileContext.Provider value={fileMenu}>
        <div data-part="stage" className={cx('z-office-studio-stage', classNames?.stage)}>
          <React.Suspense
            fallback={
              <div
                data-part="loading"
                className={cx('z-office-studio-loading', classNames?.loading)}
                role="status"
                aria-live="polite"
              >
                正在加载 {kindLabels[documentValue.kind]} 编辑器…
              </div>
            }
          >
            {documentValue.kind === 'word' ? (
              <StudioWord key={documentValue.id} {...editorProps} document={documentValue} />
            ) : documentValue.kind === 'excel' ? (
              <StudioSheet key={documentValue.id} {...editorProps} document={documentValue} />
            ) : (
              <StudioPdf key={documentValue.id} {...editorProps} document={documentValue} />
            )}
          </React.Suspense>
        </div>
      </StudioRibbonFileContext.Provider>
    </section>
  );
}
