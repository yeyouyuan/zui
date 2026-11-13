import { OfficeEditorError, type OfficeDocsApi } from './office-types';
import { officeServerIdentity } from './office-config';

interface ScriptEntry {
  promise: Promise<OfficeDocsApi>;
}

const scripts = new Map<string, ScriptEntry>();
const apiSources = new WeakMap<OfficeDocsApi['DocEditor'], string>();
const apiPath = '/web-apps/apps/api/documents/api.js';

function globalApi(): OfficeDocsApi | undefined {
  const api = (window as Window & { DocsAPI?: OfficeDocsApi }).DocsAPI;
  return typeof api?.DocEditor === 'function' ? api : undefined;
}

function scriptUrl(documentServerUrl: string): string {
  const server = officeServerIdentity(documentServerUrl);
  if (!server) throw new OfficeEditorError('invalid-config', '请提供有效的文档服务地址。');
  const url = new URL(`${server}${apiPath}`, document.baseURI);
  if (!['https:', 'http:'].includes(url.protocol))
    throw new OfficeEditorError('invalid-config', '文档服务地址需要使用 HTTP 或 HTTPS。');
  return url.href;
}

/** A shared request captures the API for its own server, rather than reusing an unrelated global. */
export function loadOfficeEditorApi(
  documentServerUrl: string,
  options: { timeout?: number; nonce?: string } = {}
): Promise<OfficeDocsApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return Promise.reject(
      new OfficeEditorError('api-unavailable', '文档编辑器需要在浏览器中加载。')
    );
  let src: string;
  try {
    src = scriptUrl(documentServerUrl);
  } catch (cause) {
    return Promise.reject(
      cause instanceof OfficeEditorError
        ? cause
        : new OfficeEditorError('invalid-config', '文档服务地址无效。', { cause })
    );
  }
  const cached = scripts.get(src);
  if (cached) return cached.promise;

  const existing = Array.from(document.scripts).find((script) => script.src === src);
  const api = globalApi();
  const source = api && apiSources.get(api.DocEditor);
  if (existing && api && (!source || source === src)) {
    apiSources.set(api.DocEditor, src);
    const promise = Promise.resolve(api);
    scripts.set(src, { promise });
    return promise;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.zOfficeApi = src;
  if (options.nonce) script.nonce = options.nonce;
  const timeout =
    Number.isFinite(options.timeout) && Number(options.timeout) > 0
      ? Number(options.timeout)
      : 15000;
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;
  const promise = new Promise<OfficeDocsApi>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };
    const fail = (error: OfficeEditorError) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      if (scripts.get(src) === entry) scripts.delete(src);
      reject(error);
    };
    script.onload = () => {
      const loaded = globalApi();
      const loadedSource = loaded && apiSources.get(loaded.DocEditor);
      if (!loaded || (loadedSource && loadedSource !== src)) {
        fail(new OfficeEditorError('api-unavailable', '文档编辑服务未提供可用的编辑器，请重试。'));
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      apiSources.set(loaded.DocEditor, src);
      resolve(loaded);
    };
    script.onerror = () =>
      fail(new OfficeEditorError('script-load', '无法连接文档编辑服务，请重试。'));
    timer = setTimeout(
      () => fail(new OfficeEditorError('script-timeout', '连接文档编辑服务超时，请重试。')),
      timeout
    );
    // Start after the cache entry is registered, including in test environments
    // where inserting a script may immediately dispatch an error event.
    Promise.resolve().then(() => {
      if (settled) return;
      try {
        document.head.append(script);
      } catch (cause) {
        fail(new OfficeEditorError('script-load', '无法加载文档编辑服务，请重试。', { cause }));
      }
    });
  });
  const entry: ScriptEntry = { promise };
  scripts.set(src, entry);
  return promise;
}
