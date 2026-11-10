import { useEffect, useSyncExternalStore } from 'react';
import coverSource from '../../assets/demo-cover.svg?raw';
import { createTextFile, textBlob, type Workspace } from './workspace-model';

const DATABASE = 'zui-content-workspace';
interface StoredWorkspace {
  token: string;
  data: Workspace;
}
type Status = 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
interface Snapshot {
  data: Workspace | null;
  status: Status;
  error: string;
}

class WorkspaceConflict extends Error {}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('workspace');
      request.result.createObjectStore('assets');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('存储升级被其他标签页阻止，请关闭旧标签页后重试。'));
  });
}
async function readWorkspace(): Promise<StoredWorkspace | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('workspace', 'readonly');
    const request = transaction.objectStore('workspace').get('current');
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
async function writeWorkspace(
  data: Workspace,
  expected: string | null,
  assets: Map<string, Blob>
): Promise<string> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();
    const transaction = database.transaction(['workspace', 'assets'], 'readwrite');
    let conflict = false;
    let writeError: unknown;
    const store = transaction.objectStore('workspace');
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const current = request.result as StoredWorkspace | undefined;
        if ((current?.token ?? null) !== expected) {
          conflict = true;
          transaction.abort();
          return;
        }
        store.put({ token, data } satisfies StoredWorkspace, 'current');
        const assetStore = transaction.objectStore('assets');
        const retained = new Set(
          data.files.flatMap((file) => (file.assetKey ? [file.assetKey] : []))
        );
        for (const [key, blob] of assets) if (retained.has(key)) assetStore.put(blob, key);
        const cursor = assetStore.openKeyCursor();
        cursor.onsuccess = () => {
          if (!cursor.result) return;
          if (!retained.has(String(cursor.result.key))) assetStore.delete(cursor.result.key);
          cursor.result.continue();
        };
      } catch (error) {
        writeError = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(token);
    };
    transaction.onabort = () => {
      database.close();
      reject(
        conflict
          ? new WorkspaceConflict(
              '另一个标签页已经更新工作区。当前修改已保留，请先导出备份，再载入最新版本。'
            )
          : (writeError ?? transaction.error)
      );
    };
  });
}
function initialWorkspace(): { data: Workspace; assets: Map<string, Blob> } {
  const brief = createTextFile('项目方案.txt');
  brief.id = 'brief';
  brief.revision = 2;
  brief.sample = true;
  brief.blocks = [
    {
      id: 'summary',
      title: '项目概述',
      body: '让文件、修改与讨论留在同一个工作空间。团队可以直接阅读方案、调整内容，并针对具体段落留下建议。',
    },
    {
      id: 'goals',
      title: '项目目标',
      body: '桌面与移动端都能清晰阅读、顺畅操作。\n把反馈关联到具体内容，让每一次修改都有上下文。',
    },
    {
      id: 'delivery',
      title: '交付范围',
      body: '支持导入文本、图片、PDF 和其他附件。\n保存内容与讨论后可以关闭页面，下次继续。',
    },
  ];
  brief.size = textBlob(brief).size;
  const cover = new Blob([coverSource], { type: 'image/svg+xml' });
  const archive = new Blob([new Uint8Array([80, 75, 5, 6, ...Array(18).fill(0)])], {
    type: 'application/zip',
  });
  const data: Workspace = {
    schema: 1,
    files: [
      brief,
      {
        id: 'cover',
        name: '封面设计.svg',
        kind: 'image',
        mime: cover.type,
        size: cover.size,
        revision: 1,
        blocks: [],
        assetKey: 'cover',
        updatedAt: brief.updatedAt,
        sample: true,
      },
      {
        id: 'archive',
        name: '项目归档.zip',
        kind: 'binary',
        mime: archive.type,
        size: archive.size,
        revision: 1,
        blocks: [],
        assetKey: 'archive',
        updatedAt: brief.updatedAt,
        sample: true,
      },
    ],
    activeFile: 'brief',
    author: '你',
    threads: [
      {
        id: 'scope',
        file: 'brief',
        anchor: 'goals',
        quote: brief.blocks[1].body,
        quoteRevision: 2,
        author: '林岸',
        body: '移动端也需要验证编辑和评论的完整流程。',
        createdAt: brief.updatedAt,
        resolved: false,
        replies: [],
      },
      {
        id: 'formats',
        file: 'brief',
        anchor: 'delivery',
        quote: brief.blocks[2].body,
        quoteRevision: 2,
        author: '周予',
        body: '不支持预览的附件也应该可以下载。',
        createdAt: brief.updatedAt,
        resolved: true,
        replies: [],
      },
    ],
    commentTargets: {},
    commentDrafts: {},
    editorDrafts: {},
  };
  return {
    data,
    assets: new Map([
      ['cover', cover],
      ['archive', archive],
    ]),
  };
}

class WorkspaceStore {
  private snapshot: Snapshot = { data: null, status: 'loading', error: '' };
  private listeners = new Set<() => void>();
  private token: string | null = null;
  private dirty = false;
  private writing = false;
  private initialized = false;
  private pendingAssets = new Map<string, Blob>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private channel: BroadcastChannel | undefined;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  initialize = async () => {
    if (this.initialized) return;
    this.initialized = true;
    window.addEventListener('beforeunload', (event) => {
      if (!this.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.flush();
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(DATABASE);
      this.channel.onmessage = () => {
        if (this.dirty || this.writing) return; // The atomic revision check catches concurrent edits.
        void this.load();
      };
    }
    await this.load();
  };
  private load = async () => {
    try {
      const stored = await readWorkspace();
      // A local change may have occurred while this read was in flight.
      if (this.dirty) return;
      if (stored) {
        if (stored.data?.schema !== 1 || !Array.isArray(stored.data.files))
          throw new Error('工作区数据格式无法读取，请保留浏览器数据并联系维护者。');
        this.token = stored.token;
        this.publish({ data: stored.data, status: 'saved', error: '' });
      } else {
        this.token = null;
        const initial = initialWorkspace();
        this.pendingAssets = initial.assets;
        this.dirty = true;
        this.publish({ data: initial.data, status: 'saving', error: '' });
        await this.flush();
      }
    } catch (error) {
      this.fail(error);
    }
  };
  update = (change: (current: Workspace) => Workspace, assets?: Map<string, Blob>) => {
    if (!this.snapshot.data || this.snapshot.status === 'conflict') return;
    const data = change(this.snapshot.data);
    for (const [key, blob] of assets ?? []) this.pendingAssets.set(key, blob);
    this.dirty = true;
    const failed = this.snapshot.status === 'error';
    this.publish({
      data,
      status: failed ? 'error' : 'saving',
      error: failed ? this.snapshot.error : '',
    });
    clearTimeout(this.timer);
    if (!failed) this.timer = setTimeout(() => void this.flush(), 80);
  };
  private fail(error: unknown) {
    this.publish({
      ...this.snapshot,
      status: error instanceof WorkspaceConflict ? 'conflict' : 'error',
      error:
        error instanceof WorkspaceConflict
          ? error.message
          : `未能保存或读取本机数据：${error instanceof Error ? error.message : '浏览器存储不可用'}。修改仍保留在当前页面，可重试或导出备份。`,
    });
  }
  flush = async () => {
    if (this.writing || !this.dirty || !this.snapshot.data || this.snapshot.status === 'conflict')
      return;
    this.writing = true;
    try {
      while (this.dirty && this.snapshot.data) {
        const data = this.snapshot.data;
        const assets = new Map(this.pendingAssets);
        this.token = await writeWorkspace(data, this.token, assets);
        for (const [key, blob] of assets)
          if (this.pendingAssets.get(key) === blob) this.pendingAssets.delete(key);
        this.dirty = data !== this.snapshot.data;
        this.publish({ ...this.snapshot, status: this.dirty ? 'saving' : 'saved', error: '' });
        this.channel?.postMessage(this.token);
      }
    } catch (error) {
      this.fail(error);
    } finally {
      this.writing = false;
    }
  };
  retry = async () => {
    if (this.snapshot.data) {
      this.publish({ ...this.snapshot, status: 'saving', error: '' });
      await this.flush();
    } else {
      await this.load();
    }
  };
  reload = async () => {
    clearTimeout(this.timer);
    this.dirty = false;
    this.pendingAssets.clear();
    await this.load();
  };
  asset = async (key: string): Promise<Blob> => {
    const pending = this.pendingAssets.get(key);
    if (pending) return pending;
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('assets', 'readonly');
      const request = transaction.objectStore('assets').get(key);
      transaction.oncomplete = () => {
        database.close();
        if (request.result instanceof Blob) resolve(request.result);
        else reject(new Error('附件数据缺失，请重新导入原文件。'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    });
  };
}
export const workspaceStore = new WorkspaceStore();
export function useWorkspace() {
  const snapshot = useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot);
  useEffect(() => {
    void workspaceStore.initialize();
  }, []);
  return snapshot;
}
