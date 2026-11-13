import {
  isOfficeStudioDocument,
  type OfficeStudioDocument,
  type OfficeStudioKind,
} from '@zui/react';

export interface StudioStoredFile {
  id: string;
  document: OfficeStudioDocument;
  source?: Blob;
  revision: number;
  savedAt: number;
}

export interface StudioFileSummary {
  id: string;
  name: string;
  kind: OfficeStudioKind;
  savedAt: number;
}

export interface StudioVersionSummary {
  id: string;
  revision: number;
  savedAt: number;
  name: string;
}

export interface StudioStorage {
  list(): Promise<StudioStoredFile[]>;
  load(id: string): Promise<StudioStoredFile | undefined>;
  activeId(): Promise<string | null>;
  select(id: string): Promise<void>;
  commit(file: StudioStoredFile, expectedRevision: number): Promise<void>;
  listVersions?(id: string): Promise<StudioVersionSummary[]>;
  loadVersion?(id: string, revision: number): Promise<StudioStoredFile | undefined>;
}

export const STUDIO_HISTORY_LIMIT = 20;

export class StudioStorageConflict extends Error {
  constructor() {
    super('另一页面已经保存了这份文档。当前修改仍保留，可导出文件或另存本地副本。');
    this.name = 'StudioStorageConflict';
  }
}

function validFile(file: unknown): file is StudioStoredFile {
  if (!file || typeof file !== 'object') return false;
  const item = file as StudioStoredFile;
  return (
    isOfficeStudioDocument(item.document) &&
    item.id === item.document.id &&
    Number.isInteger(item.revision) &&
    item.revision > 0 &&
    Number.isFinite(item.savedAt) &&
    (item.source === undefined || item.source instanceof Blob)
  );
}

/** Each write checks its revision and resolves only after the IndexedDB commit. */
export function createStudioStorage(factory: IDBFactory = globalThis.indexedDB): StudioStorage {
  let opening: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!factory)
      return Promise.reject(new Error('当前浏览器没有可用的本地文档存储，可继续编辑并导出文件。'));
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('zui-office-studio', 2);
      let finished = false;
      const timeout = globalThis.setTimeout(() => {
        if (finished) return;
        finished = true;
        opening = null;
        reject(new Error('本地文档存储被其他页面占用，请关闭旧页面后重试。'));
      }, 8000);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('files'))
          database.createObjectStore('files', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('preferences'))
          database.createObjectStore('preferences');
        if (!database.objectStoreNames.contains('versions')) {
          const versions = database.createObjectStore('versions', { keyPath: ['id', 'revision'] });
          versions.createIndex('file', 'id');
        }
      };
      request.onsuccess = () => {
        if (finished) {
          request.result.close();
          return;
        }
        finished = true;
        globalThis.clearTimeout(timeout);
        request.result.onversionchange = () => {
          request.result.close();
          opening = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        if (finished) return;
        finished = true;
        globalThis.clearTimeout(timeout);
        opening = null;
        reject(request.error ?? new Error('本地文档存储无法打开。'));
      };
    }).catch((error) => {
      opening = null;
      throw error;
    });
    return opening;
  };
  const read = async <T>(
    store: string,
    operation: (objectStore: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(store, 'readonly');
      const request = operation(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(transaction.error ?? request.error ?? new Error('本地文档读取失败。'));
      transaction.onerror = () => {
        /* onabort carries the final transaction error. */
      };
    });
  };
  return {
    async list() {
      const files: unknown[] = await read('files', (store) => store.getAll());
      if (files.some((file) => !validFile(file)))
        throw new Error('本地文档记录不完整。已保留原记录，请导出当前内容后检查存储。');
      return (files as StudioStoredFile[]).sort((a, b) => b.savedAt - a.savedAt);
    },
    async load(id) {
      const file: unknown = await read('files', (store) => store.get(id));
      if (file === undefined) return undefined;
      if (!validFile(file)) throw new Error('这份本地文档无法恢复，原记录已保留。');
      return file;
    },
    async listVersions(id) {
      const versions: unknown[] = await read('versions', (store) => store.index('file').getAll(id));
      if (versions.some((version) => !validFile(version)))
        throw new Error('历史版本记录不完整，原记录已保留。');
      return (versions as StudioStoredFile[])
        .sort((a, b) => b.revision - a.revision)
        .map((version) => ({
          id: version.id,
          revision: version.revision,
          savedAt: version.savedAt,
          name: version.document.name,
        }));
    },
    async loadVersion(id, revision) {
      if (!Number.isInteger(revision) || revision < 1) throw new Error('历史版本编号无效。');
      const version: unknown = await read('versions', (store) => store.get([id, revision]));
      if (version === undefined) return undefined;
      if (!validFile(version)) throw new Error('这份历史版本无法恢复，原记录已保留。');
      return version;
    },
    async activeId() {
      const id: unknown = await read('preferences', (store) => store.get('active'));
      return typeof id === 'string' ? id : null;
    },
    async select(id) {
      const database = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('preferences', 'readwrite');
        transaction.objectStore('preferences').put(id, 'active');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('当前文档位置无法保存。'));
        transaction.onerror = () => {};
      });
    },
    async commit(file, expectedRevision) {
      if (!validFile(file) || file.revision !== expectedRevision + 1)
        throw new Error('文档保存记录无效。');
      const database = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['files', 'preferences', 'versions'], 'readwrite');
        const files = transaction.objectStore('files');
        let failure: Error | null = null;
        const request = files.get(file.id);
        request.onsuccess = () => {
          const previous = request.result as StudioStoredFile | undefined;
          if ((previous?.revision ?? 0) !== expectedRevision) {
            failure = new StudioStorageConflict();
            transaction.abort();
            return;
          }
          if (previous && !validFile(previous)) {
            failure = new Error('原文档记录不完整，保存已取消以保留原记录。');
            transaction.abort();
            return;
          }
          try {
            if (previous) {
              const versions = transaction.objectStore('versions');
              versions.put(previous);
              const history = versions.index('file').getAll(file.id);
              history.onsuccess = () => {
                const ordered = (history.result as StudioStoredFile[]).sort(
                  (a, b) => b.revision - a.revision
                );
                for (const old of ordered.slice(STUDIO_HISTORY_LIMIT))
                  versions.delete([old.id, old.revision]);
              };
            }
            files.put(file);
            transaction.objectStore('preferences').put(file.id, 'active');
          } catch (error) {
            failure = error instanceof Error ? error : new Error('文档无法写入本地存储。');
            transaction.abort();
          }
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
          reject(failure ?? transaction.error ?? new Error('本地保存失败，请导出副本或重试。'));
        transaction.onerror = () => {};
      });
    },
  };
}
