import { StrictMode, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeEditor } from './OfficeEditor';
import { loadOfficeEditorApi } from './office-script';
import type {
  OfficeDocsApi,
  OfficeEditorConfig,
  OfficeEditorEvent,
  OfficeEditorHandle,
  OfficeEditorInstance,
  OfficeEditorToolbarContext,
} from './office-types';

let serverCount = 0;
const apiPath = '/web-apps/apps/api/documents/api.js';
const nextServer = () => `https://office-${++serverCount}.test`;
const config = (): OfficeEditorConfig => ({
  documentType: 'word',
  type: 'desktop',
  width: '100%',
  height: '100%',
  token: 'signed-token-1',
  document: {
    key: 'document-key-1',
    title: '合同.docx',
    url: 'https://files.test/contract.docx',
    fileType: 'docx',
    permissions: { edit: true, download: true },
  },
  editorConfig: { mode: 'edit', callbackUrl: 'https://files.test/callback', lang: 'zh' },
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function installApi(api: OfficeDocsApi) {
  (window as Window & { DocsAPI?: OfficeDocsApi }).DocsAPI = api;
}
function engine(server = nextServer()) {
  const records: {
    id: string;
    config: OfficeEditorConfig;
    instance: OfficeEditorInstance & { destroyEditor: ReturnType<typeof vi.fn> };
    iframe: HTMLIFrameElement;
  }[] = [];
  const f = { server, records, failCreation: false, synchronousReady: false, mutateConfig: false };
  const constructor = vi.fn(function (id: string, nativeConfig: OfficeEditorConfig) {
    if (f.failCreation) throw new Error('native construction failed');
    if (f.mutateConfig) {
      nativeConfig.editorConfig!.canRequestClose = false;
      nativeConfig.document.permissions!.nativeDefault = true;
    }
    const mount = document.getElementById(id);
    if (!mount) throw new Error('native placeholder is missing');
    const iframe = document.createElement('iframe');
    iframe.dataset.officeTestFrame = id;
    mount.replaceWith(iframe);
    const instance = {
      destroyEditor: vi.fn(() => {
        iframe.remove();
      }),
    };
    records.push({ id, config: nativeConfig, instance, iframe });
    if (f.synchronousReady) nativeConfig.events?.onDocumentReady?.({ data: 'ready' });
    return instance;
  });
  const api: OfficeDocsApi = { DocEditor: constructor as unknown as OfficeDocsApi['DocEditor'] };
  const preload = () => {
    const script = document.createElement('script');
    script.src = `${server}${apiPath}`;
    script.dataset.officeTestPreload = 'true';
    document.head.append(script);
    installApi(api);
  };
  const emit = (index: number, name: string, event: OfficeEditorEvent = {}) => {
    records[index].config.events?.[name]?.(event);
  };
  return { ...f, state: f, api, constructor, preload, emit };
}
const pendingScript = (server: string) =>
  document.querySelector<HTMLScriptElement>(`script[data-z-office-api="${server}${apiPath}"]`);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const script of Array.from(document.scripts)) {
    if (script.src.endsWith(apiPath)) script.remove();
  }
  delete (window as Window & { DocsAPI?: OfficeDocsApi }).DocsAPI;
});

describe('OfficeEditor native lifecycle', () => {
  it('StrictMode creates one active editor, preserves signed config and waits for document readiness', async () => {
    const f = engine();
    f.preload();
    const source = config();
    Object.freeze(source.document.permissions);
    Object.freeze(source.document);
    Object.freeze(source.editorConfig);
    const nativeState = vi.fn();
    source.events = { onDocumentStateChange: nativeState };
    const hostState = vi.fn();
    const onReady = vi.fn();
    const onStatusChange = vi.fn();
    const ref = createRef<OfficeEditorHandle>();
    const view = render(
      <StrictMode>
        <OfficeEditor
          ref={ref}
          documentServerUrl={f.server}
          config={source}
          events={{ onDocumentStateChange: hostState }}
          onReady={onReady}
          onStatusChange={onStatusChange}
        />
      </StrictMode>
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    const native = f.records[0];
    expect(native.config.document).toEqual(source.document);
    expect(native.config.editorConfig).toEqual(source.editorConfig);
    expect(native.config.document).not.toBe(source.document);
    expect(native.config.editorConfig).not.toBe(source.editorConfig);
    expect(native.config.token).toBe(source.token);
    expect(native.config.events).not.toBe(source.events);
    expect(ref.current?.getEditor()).toBe(native.instance);
    const root = screen.getByRole('region', { name: '合同.docx' });
    act(() => f.emit(0, 'onAppReady'));
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(onReady).not.toHaveBeenCalled();
    const ready = { data: 'ready' };
    act(() => f.emit(0, 'onDocumentReady', ready));
    expect(root).toHaveAttribute('data-status', 'ready');
    expect(root).not.toHaveAttribute('aria-busy');
    expect(onReady).toHaveBeenCalledWith(native.instance, ready);
    expect(native.iframe).toHaveAttribute('title', '在线文档编辑器');
    const changed = { data: true };
    act(() => f.emit(0, 'onDocumentStateChange', changed));
    expect(nativeState).toHaveBeenCalledWith(changed);
    expect(hostState).toHaveBeenCalledWith(changed);
    expect(onStatusChange).toHaveBeenLastCalledWith('ready');
    view.unmount();
    expect(native.instance.destroyEditor).toHaveBeenCalledTimes(1);
    act(() => f.emit(0, 'onDocumentReady'));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeNull();
  });

  it('token, object order, title and callback updates preserve the instance; reload uses the latest signature', async () => {
    const f = engine();
    f.preload();
    const first = config();
    const oldState = vi.fn();
    const newState = vi.fn();
    const oldReady = vi.fn();
    const newReady = vi.fn();
    const ref = createRef<OfficeEditorHandle>();
    const view = render(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={first}
        events={{ onDocumentStateChange: oldState }}
        onReady={oldReady}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    act(() => f.emit(0, 'onDocumentReady'));
    const latest: OfficeEditorConfig = {
      ...first,
      token: 'signed-token-2',
      width: 900,
      height: 700,
      document: {
        ...first.document,
        title: '新名称.docx',
        permissions: { download: true, edit: true },
      },
      editorConfig: { lang: 'zh', callbackUrl: 'https://files.test/callback', mode: 'edit' },
    };
    view.rerender(
      <OfficeEditor
        ref={ref}
        documentServerUrl={`${f.server}/`}
        config={latest}
        events={{ onDocumentStateChange: newState }}
        onReady={newReady}
      />
    );
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
    act(() => f.emit(0, 'onDocumentStateChange', { data: true }));
    expect(oldState).not.toHaveBeenCalled();
    expect(newState).toHaveBeenCalledTimes(1);
    await act(async () => {
      ref.current?.reload();
    });
    expect(f.records).toHaveLength(2);
    expect(f.records[0].instance.destroyEditor).toHaveBeenCalledTimes(1);
    expect(f.records[1].config.token).toBe('signed-token-2');
    expect(f.records[1].config.document).toEqual(latest.document);
    act(() => f.emit(0, 'onDocumentReady'));
    expect(newReady).not.toHaveBeenCalled();
    act(() => f.emit(1, 'onDocumentReady'));
    expect(newReady).toHaveBeenCalledWith(f.records[1].instance, {});
  });

  it('isolates native nested-config mutations so JWT polling cannot trigger a false rebuild', async () => {
    const f = engine();
    f.preload();
    f.state.mutateConfig = true;
    const source = config();
    Object.freeze(source.document.permissions);
    Object.freeze(source.editorConfig);
    const view = render(<OfficeEditor documentServerUrl={f.server} config={source} />);
    await waitFor(() => expect(f.records).toHaveLength(1));
    act(() => f.emit(0, 'onDocumentReady'));
    expect(source.editorConfig?.canRequestClose).toBeUndefined();
    expect(source.document.permissions?.nativeDefault).toBeUndefined();
    expect(f.records[0].config.editorConfig?.canRequestClose).toBe(false);
    expect(f.records[0].config.document.permissions?.nativeDefault).toBe(true);
    view.rerender(
      <OfficeEditor
        documentServerUrl={f.server}
        config={{ ...source, token: 'polled-signature' }}
      />
    );
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
    expect(source.editorConfig?.mode).toBe('edit');
    expect(source.document.permissions?.edit).toBe(true);
  });

  it('a signed mode or permissions change rebuilds the editor without rewriting the backend config', async () => {
    const f = engine();
    f.preload();
    const first = config();
    const view = render(<OfficeEditor documentServerUrl={f.server} config={first} />);
    await waitFor(() => expect(f.records).toHaveLength(1));
    const readonly: OfficeEditorConfig = {
      ...first,
      token: 'view-token',
      editorConfig: { ...first.editorConfig, mode: 'view' },
      document: { ...first.document, permissions: { edit: false, download: false } },
    };
    view.rerender(<OfficeEditor documentServerUrl={f.server} config={readonly} />);
    await waitFor(() => expect(f.records).toHaveLength(2));
    expect(f.records[0].instance.destroyEditor).toHaveBeenCalledTimes(1);
    expect(f.records[1].config.editorConfig).toEqual(readonly.editorConfig);
    expect(f.records[1].config.document.permissions).toEqual({ edit: false, download: false });
    expect(f.records[1].config.token).toBe('view-token');
    const changed = {
      ...readonly,
      document: { ...readonly.document, permissions: { edit: false, download: true } },
    };
    view.rerender(<OfficeEditor documentServerUrl={f.server} config={changed} />);
    await waitFor(() => expect(f.records).toHaveLength(3));
    expect(f.records[1].instance.destroyEditor).toHaveBeenCalledTimes(1);
  });

  it('adds and removes subscriptions without destroying the editor or overriding config handlers', async () => {
    const f = engine();
    f.preload();
    const source = config();
    const shared = vi.fn();
    source.events = { onDocumentStateChange: shared };
    const close = vi.fn();
    const view = render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        events={{ onDocumentStateChange: shared }}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    expect(f.records[0].config.events?.onRequestClose).toBeUndefined();
    view.rerender(
      <OfficeEditor
        documentServerUrl={f.server}
        config={{ ...source, token: 'new-token' }}
        events={{ onDocumentStateChange: shared, onRequestClose: close }}
      />
    );
    act(() => {
      f.emit(0, 'onDocumentStateChange');
      f.emit(0, 'onRequestClose');
    });
    expect(shared).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    view.rerender(<OfficeEditor documentServerUrl={f.server} config={source} events={{}} />);
    act(() => f.emit(0, 'onRequestClose'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
  });

  it('unmounts during shared script loading without creating an orphan editor', async () => {
    const f = engine();
    const view = render(
      <StrictMode>
        <OfficeEditor documentServerUrl={f.server} config={config()} />
      </StrictMode>
    );
    await waitFor(() => expect(pendingScript(f.server)).not.toBeNull());
    expect(document.querySelectorAll(`script[src="${f.server}${apiPath}"]`)).toHaveLength(1);
    view.unmount();
    installApi(f.api);
    await act(async () => {
      pendingScript(f.server)!.dispatchEvent(new Event('load'));
    });
    expect(f.constructor).not.toHaveBeenCalled();
  });

  it('handles synchronous readiness and constructor failures with a reusable reload action', async () => {
    const f = engine();
    f.preload();
    f.state.failCreation = true;
    const ref = createRef<OfficeEditorHandle>();
    const onError = vi.fn();
    const onReady = vi.fn();
    render(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={config()}
        onError={onError}
        onReady={onReady}
      />
    );
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'editor-create' }))
    );
    expect(screen.getByRole('alert')).toHaveTextContent('native construction failed');
    f.state.failCreation = false;
    f.state.synchronousReady = true;
    await act(async () => {
      ref.current?.reload();
    });
    expect(f.records).toHaveLength(1);
    expect(onReady).toHaveBeenCalledWith(f.records[0].instance, { data: 'ready' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('times out an unopened document and clears the old timer after reload and readiness', async () => {
    vi.useFakeTimers();
    const f = engine();
    f.preload();
    const ref = createRef<OfficeEditorHandle>();
    const onError = vi.fn();
    await act(async () => {
      render(
        <OfficeEditor
          ref={ref}
          documentServerUrl={f.server}
          config={config()}
          readyTimeout={40}
          onError={onError}
        />
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(41);
    });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'ready-timeout' }));
    await act(async () => {
      ref.current?.reload();
    });
    act(() => f.emit(1, 'onDocumentReady'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: '合同.docx' })).toHaveAttribute(
      'data-status',
      'ready'
    );
  });

  it('forwards native errors to both event maps and keeps a ready document mounted for recovery', async () => {
    const f = engine();
    f.preload();
    const source = config();
    const configError = vi.fn();
    const eventError = vi.fn();
    const onError = vi.fn();
    source.events = { onError: configError };
    render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        events={{ onError: eventError }}
        onError={onError}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    act(() => f.emit(0, 'onDocumentReady'));
    const event = { data: { errorCode: 3, errorDescription: 'connection interrupted' } };
    act(() => f.emit(0, 'onError', event));
    expect(configError).toHaveBeenCalledWith(event);
    expect(eventError).toHaveBeenCalledWith(event);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'editor', message: 'connection interrupted' })
    );
    expect(f.records[0].iframe).toBeInTheDocument();
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
  });

  it('renders on the server without touching DOM or loading native APIs', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    try {
      const html = renderToString(
        <OfficeEditor documentServerUrl="https://office.test" config={config()} toolbar={false} />
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('data-part="canvas"');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('OfficeEditor business actions and layout', () => {
  for (const action of ['save', 'download'] as const) {
    it(`deduplicates the async ${action} callback and retries the same action after failure`, async () => {
      const f = engine();
      f.preload();
      const release = deferred();
      const callback = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary business failure'))
        .mockImplementation(() => release.promise);
      const onError = vi.fn();
      const props = action === 'save' ? { onSave: callback } : { onDownload: callback };
      const ref = createRef<OfficeEditorHandle>();
      render(
        <OfficeEditor
          ref={ref}
          documentServerUrl={f.server}
          config={config()}
          onError={onError}
          {...props}
        />
      );
      await waitFor(() => expect(f.records).toHaveLength(1));
      act(() => f.emit(0, 'onDocumentReady'));
      fireEvent.click(
        screen.getByRole('button', { name: action === 'save' ? '保存文件' : '下载文件' })
      );
      await waitFor(() =>
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: action }))
      );
      fireEvent.click(
        within(screen.getByRole('alert')).getByRole('button', {
          name: action === 'save' ? '重试保存' : '重试下载',
        })
      );
      await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('button', { name: '重新加载' })).toBeDisabled();
      await act(async () => {
        ref.current?.reload();
      });
      expect(f.constructor).toHaveBeenCalledTimes(1);
      fireEvent.click(
        screen.getByRole('button', { name: action === 'save' ? '正在保存…' : '正在下载…' })
      );
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(f.records[0].instance);
      expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
      await act(async () => {
        release.resolve();
        await release.promise;
      });
      expect(screen.getByRole('button', { name: '重新加载' })).not.toBeDisabled();
      expect(f.constructor).toHaveBeenCalledTimes(1);
    });
  }

  it('pauses disabled actions and canvas interaction without changing signed permissions or destroying the editor', async () => {
    const f = engine();
    f.preload();
    const source = config();
    const save = vi.fn();
    const download = vi.fn();
    const ref = createRef<OfficeEditorHandle>();
    let context: OfficeEditorToolbarContext | undefined;
    const header = (next: OfficeEditorToolbarContext) => {
      context = next;
      return '业务工具栏';
    };
    const view = render(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={source}
        onSave={save}
        onDownload={download}
        header={header}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    act(() => f.emit(0, 'onDocumentReady'));
    view.rerender(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={source}
        onSave={save}
        onDownload={download}
        header={header}
        disabled
      />
    );
    expect(view.container.querySelector('[data-part="stage"]')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: '保存文件' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下载文件' })).toBeDisabled();
    await act(async () => {
      await context!.save();
      await context!.download();
      ref.current?.reload();
    });
    expect(save).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
    expect(f.records[0].config.editorConfig?.mode).toBe('edit');
    expect(f.records[0].config.document.permissions?.edit).toBe(true);
    view.rerender(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={source}
        onSave={save}
        onDownload={download}
        header={header}
      />
    );
    expect(view.container.querySelector('[data-part="stage"]')).not.toHaveAttribute('inert');
    await act(async () => {
      await context!.save();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(f.constructor).toHaveBeenCalledTimes(1);
  });

  it('readonly signed config never starts a save callback even through a custom toolbar', async () => {
    const f = engine();
    f.preload();
    const source = config();
    source.editorConfig = { ...source.editorConfig, mode: 'view' };
    const save = vi.fn();
    let context: OfficeEditorToolbarContext | undefined;
    render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        onSave={save}
        toolbar={(next) => {
          context = next;
          return '只读';
        }}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    act(() => f.emit(0, 'onDocumentReady'));
    await act(async () => {
      await context!.save();
    });
    expect(save).not.toHaveBeenCalled();
    expect(f.records[0].config.editorConfig?.mode).toBe('view');
  });

  it('supports a canvas-only percentage layout and controlled fullscreen without recreating native content', async () => {
    const f = engine();
    f.preload();
    const ref = createRef<OfficeEditorHandle>();
    const onFullscreenChange = vi.fn();
    const source = config();
    const view = render(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={source}
        toolbar={false}
        header={false}
        height="100%"
        style={{ minHeight: 0 }}
        fullscreen={false}
        onFullscreenChange={onFullscreenChange}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    expect(view.container.querySelector('[data-part="toolbar"]')).toBeNull();
    expect(view.container.querySelector('[data-part="header"]')).toBeNull();
    const root = screen.getByRole('region', { name: '合同.docx' });
    expect(root).toHaveStyle({ height: '100%', minHeight: '0' });
    act(() => ref.current?.setFullscreen(true));
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
    expect(root).not.toHaveAttribute('data-fullscreen');
    view.rerender(
      <OfficeEditor
        ref={ref}
        documentServerUrl={f.server}
        config={source}
        toolbar={false}
        fullscreen
        onFullscreenChange={onFullscreenChange}
      />
    );
    expect(root).toHaveAttribute('data-fullscreen', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
  });

  it('keeps scroll locked while another uncontrolled fullscreen editor remains open', async () => {
    const f = engine();
    f.preload();
    const before = document.body.style.overflow;
    const first = render(
      <OfficeEditor documentServerUrl={f.server} config={config()} defaultFullscreen />
    );
    const second = render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={{ ...config(), document: { ...config().document, key: 'another' } }}
        defaultFullscreen
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(2));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(second.container.querySelector('[data-part="root"]')).not.toHaveAttribute(
      'data-fullscreen'
    );
    expect(first.container.querySelector('[data-part="root"]')).toHaveAttribute(
      'data-fullscreen',
      'true'
    );
    expect(document.body.style.overflow).toBe('hidden');
    first.unmount();
    expect(document.body.style.overflow).toBe(before);
  });
});

describe('OfficeEditor chrome theme and host customization', () => {
  it('marks the document kind on the chrome and fills unset customization keys without touching the source', async () => {
    const f = engine();
    f.preload();
    const source = config();
    const view = render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        kind="excel"
        customization={{ compactHeader: true, hideRightMenu: true }}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    expect(view.container.querySelector('[data-part="root"]')).toHaveAttribute(
      'data-kind',
      'excel'
    );
    expect(f.records[0].config.editorConfig?.customization).toEqual({
      compactHeader: true,
      hideRightMenu: true,
    });
    expect(source.editorConfig?.customization).toBeUndefined();
    view.rerender(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        kind="excel"
        customization={{ compactHeader: true, hideRightMenu: true }}
      />
    );
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
    view.rerender(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        kind="pdf"
        customization={{ compactHeader: true, hideRightMenu: true }}
      />
    );
    expect(f.constructor).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[data-part="root"]')).toHaveAttribute('data-kind', 'pdf');
    expect(f.records[0].instance.destroyEditor).not.toHaveBeenCalled();
  });

  it('keeps every backend customization value and rebuilds only when the host customization changes', async () => {
    const f = engine();
    f.preload();
    const source = config();
    source.editorConfig = {
      ...source.editorConfig,
      customization: { compactHeader: false, uiTheme: 'theme-dark' },
    };
    const view = render(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        customization={{ compactHeader: true, hideRightMenu: true }}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(1));
    expect(f.records[0].config.editorConfig?.customization).toEqual({
      compactHeader: false,
      hideRightMenu: true,
      uiTheme: 'theme-dark',
    });
    expect(source.editorConfig.customization).toEqual({
      compactHeader: false,
      uiTheme: 'theme-dark',
    });
    expect(f.constructor).toHaveBeenCalledTimes(1);
    view.rerender(
      <OfficeEditor
        documentServerUrl={f.server}
        config={source}
        customization={{ compactHeader: true, hideRightMenu: false }}
      />
    );
    await waitFor(() => expect(f.records).toHaveLength(2));
    expect(f.records[0].instance.destroyEditor).toHaveBeenCalledTimes(1);
    expect(f.records[1].config.editorConfig?.customization).toEqual({
      compactHeader: false,
      hideRightMenu: false,
      uiTheme: 'theme-dark',
    });
  });
});

describe('OfficeEditor shared script loading', () => {
  it('shares one request per server and permits retry after a failed load', async () => {
    const f = engine();
    const first = loadOfficeEditorApi(f.server, { nonce: 'host-nonce' });
    const second = loadOfficeEditorApi(`${f.server}/`);
    expect(second).toBe(first);
    await Promise.resolve();
    const script = pendingScript(f.server)!;
    expect(script.nonce).toBe('host-nonce');
    const failed = expect(first).rejects.toMatchObject({ code: 'script-load' });
    script.dispatchEvent(new Event('error'));
    await failed;
    expect(script).not.toBeInTheDocument();
    const retry = loadOfficeEditorApi(f.server);
    expect(retry).not.toBe(first);
    await Promise.resolve();
    installApi(f.api);
    pendingScript(f.server)!.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(f.api);
  });

  it('times out and clears the failed request so it can load again', async () => {
    vi.useFakeTimers();
    const f = engine();
    const first = loadOfficeEditorApi(f.server, { timeout: 30 });
    const failed = expect(first).rejects.toMatchObject({ code: 'script-timeout' });
    await vi.advanceTimersByTimeAsync(31);
    await failed;
    expect(pendingScript(f.server)).toBeNull();
    const retry = loadOfficeEditorApi(f.server);
    await Promise.resolve();
    installApi(f.api);
    pendingScript(f.server)!.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(f.api);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a stale global from another server and keeps each successful server API separate', async () => {
    const a = engine();
    const b = engine();
    const first = loadOfficeEditorApi(a.server);
    await Promise.resolve();
    installApi(a.api);
    pendingScript(a.server)!.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(a.api);
    const wrong = loadOfficeEditorApi(b.server);
    await Promise.resolve();
    expect(pendingScript(b.server)).not.toBeNull();
    const failed = expect(wrong).rejects.toMatchObject({ code: 'api-unavailable' });
    pendingScript(b.server)!.dispatchEvent(new Event('load'));
    await failed;
    const second = loadOfficeEditorApi(b.server);
    await Promise.resolve();
    installApi(b.api);
    pendingScript(b.server)!.dispatchEvent(new Event('load'));
    await expect(second).resolves.toBe(b.api);
    await expect(loadOfficeEditorApi(a.server)).resolves.toBe(a.api);
  });
});
