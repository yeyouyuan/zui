import type { OfficeStudioDocument } from '@zui/react';
import type {
  StudioFileSummary,
  StudioStorage,
  StudioStoredFile,
  StudioVersionSummary,
} from './studio-storage';

export interface StudioWorkspaceSnapshot {
  status: 'loading' | 'ready';
  files: StudioFileSummary[];
  active: StudioStoredFile | null;
  saveState: 'saved' | 'saving' | 'unsaved' | 'error';
  error: string;
}

export type StudioWorkspacePreparation = (file: StudioStoredFile) => Promise<OfficeStudioDocument>;

const summary = (file: StudioStoredFile): StudioFileSummary => ({
  id: file.id,
  name: file.document.name,
  kind: file.document.kind,
  savedAt: file.savedAt,
});
const message = (error: unknown) =>
  error instanceof Error ? error.message : '本地文档操作未完成，请重试。';

/** Serial local saves preserve edits made while an earlier transaction is committing. */
export class StudioWorkspace {
  private snapshot: StudioWorkspaceSnapshot = {
    status: 'loading',
    files: [],
    active: null,
    saveState: 'saved',
    error: '',
  };
  private listeners = new Set<() => void>();
  private inputVersion = 0;
  private savedVersion = 0;
  private pending: Promise<void> | null = null;
  private starting: Promise<void> | null = null;
  private changingFile = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private storage: StudioStorage,
    private autosaveMs = 700,
    private prepareDocument?: StudioWorkspacePreparation
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(next: Partial<StudioWorkspaceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }
  private cancelTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private async prepare(file: StudioStoredFile): Promise<StudioStoredFile> {
    if (!this.prepareDocument) return file;
    const document = await this.prepareDocument(file);
    if (document.id !== file.id || document.kind !== file.document.kind)
      throw new Error('准备后的文档与原始记录不匹配，草稿未替换。');
    return document === file.document ? file : { ...file, document };
  }
  private async changeFile(action: () => Promise<void>) {
    if (this.changingFile) throw new Error('正在切换文档，请稍后再操作。');
    this.changingFile = true;
    try {
      await action();
    } finally {
      this.changingFile = false;
    }
  }
  private schedule() {
    this.cancelTimer();
    if (
      this.autosaveMs < 0 ||
      this.pending ||
      this.snapshot.saveState === 'error' ||
      this.inputVersion === this.savedVersion
    )
      return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.save().catch(() => {});
    }, this.autosaveMs);
  }
  start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = Promise.resolve()
      .then(async () => {
        const [files, activeId] = await Promise.all([this.storage.list(), this.storage.activeId()]);
        const selected = files.find((file) => file.id === activeId) ?? files[0] ?? null;
        const active = selected ? await this.prepare(selected) : null;
        this.update({
          status: 'ready',
          files: files.map(summary),
          active,
          error: '',
          saveState: 'saved',
        });
      })
      .catch((error) => {
        this.starting = null;
        this.update({ status: 'ready', error: message(error), saveState: 'error' });
        throw error;
      });
    this.update({ status: 'loading', error: '' });
    return this.starting;
  }
  edit(document: OfficeStudioDocument) {
    const active = this.snapshot.active;
    if (!active || document.id !== active.id || document.kind !== active.document.kind)
      throw new Error('当前文档已切换，修改未应用。');
    this.inputVersion++;
    const next = { ...active, document };
    this.update({
      active: next,
      saveState: this.pending ? 'saving' : 'unsaved',
      files: this.snapshot.files.map((file) => (file.id === next.id ? summary(next) : file)),
    });
    this.schedule();
  }
  save(): Promise<void> {
    this.cancelTimer();
    if (this.pending) return this.pending;
    const active = this.snapshot.active;
    if (!active || this.inputVersion === this.savedVersion) return Promise.resolve();
    const version = this.inputVersion;
    const file = {
      ...active,
      document: structuredClone(active.document),
      revision: active.revision + 1,
      savedAt: Date.now(),
    };
    this.update({ saveState: 'saving' });
    const task = Promise.resolve()
      .then(() => this.storage.commit(file, active.revision))
      .then(() => {
        if (this.snapshot.active?.id !== file.id) return;
        const current = { ...this.snapshot.active, revision: file.revision, savedAt: file.savedAt };
        this.savedVersion = version;
        const files = this.snapshot.files.filter((item) => item.id !== file.id);
        this.update({
          active: current,
          files: [summary(current), ...files],
          saveState: this.inputVersion === version ? 'saved' : 'unsaved',
          error: '',
        });
      })
      .catch((error) => {
        this.update({ saveState: 'error', error: message(error) });
        throw error;
      })
      .finally(() => {
        this.pending = null;
        this.schedule();
      });
    this.pending = task;
    return task;
  }
  async flush() {
    this.cancelTimer();
    for (let pass = 0; pass < 3; pass++) {
      await this.save();
      if (this.inputVersion === this.savedVersion) {
        this.cancelTimer();
        return;
      }
    }
    throw new Error('文档仍有新输入，请暂停编辑后再切换文件。最新内容仍保留。');
  }
  /** Export remains available after storage failures. */
  async exportSnapshot(): Promise<StudioStoredFile> {
    if (this.pending) await this.pending.catch(() => {});
    const active = this.snapshot.active;
    if (!active) throw new Error('请先创建或导入一份文档。');
    return { ...active, document: structuredClone(active.document) };
  }
  async versions(): Promise<StudioVersionSummary[]> {
    const id = this.snapshot.active?.id;
    if (!id) throw new Error('请先打开一份文档。');
    if (!this.storage.listVersions) throw new Error('当前存储没有提供历史版本。');
    return this.storage.listVersions(id);
  }
  async version(revision: number): Promise<StudioStoredFile> {
    const id = this.snapshot.active?.id;
    if (!id) throw new Error('请先打开一份文档。');
    if (!this.storage.loadVersion) throw new Error('当前存储没有提供历史版本。');
    const version = await this.storage.loadVersion(id, revision);
    if (!version) throw new Error('历史版本已过期或不存在。');
    const prepared = await this.prepare(version);
    if (this.snapshot.active?.id !== id) throw new Error('当前文档已切换，请重新打开历史版本。');
    return prepared;
  }
  add(document: OfficeStudioDocument, source?: Blob): Promise<void> {
    return this.changeFile(async () => {
      await this.flush();
      if (this.snapshot.files.length >= 100) throw new Error('本地文档空间最多保存 100 份文档。');
      const activeId = this.snapshot.active?.id;
      const inputVersion = this.inputVersion;
      const prepared = await this.prepare({
        id: document.id,
        document,
        source,
        revision: 0,
        savedAt: Date.now(),
      });
      if (this.snapshot.active?.id !== activeId || this.inputVersion !== inputVersion)
        throw new Error('准备文档期间有新输入。最新内容仍保留，请保存后重试。');
      this.cancelTimer();
      this.inputVersion = 1;
      this.savedVersion = 0;
      this.update({
        active: prepared,
        saveState: 'unsaved',
        error: '',
      });
      await this.save();
    });
  }
  select(id: string): Promise<void> {
    return this.changeFile(async () => {
      if (id === this.snapshot.active?.id) return;
      await this.flush();
      const activeId = this.snapshot.active?.id;
      const version = this.inputVersion;
      const unchanged = () =>
        this.snapshot.active?.id === activeId && this.inputVersion === version;
      const changed = () => new Error('文档在切换期间有新输入。最新内容仍保留，请保存后重试。');
      const file = await this.storage.load(id);
      if (!unchanged()) throw changed();
      if (!file) throw new Error('本地文档不存在。');
      const prepared = await this.prepare(file);
      if (!unchanged()) throw changed();
      await this.storage.select(id);
      if (!unchanged()) {
        // The preference transaction can finish after more text was entered.
        // Restore the current file preference without replacing its dirty model.
        if (activeId) {
          try {
            await this.storage.select(activeId);
          } catch (error) {
            this.update({ error: message(error) });
          }
        }
        throw changed();
      }
      this.cancelTimer();
      this.inputVersion = 0;
      this.savedVersion = 0;
      this.update({ active: prepared, saveState: 'saved', error: '' });
    });
  }
  /** An explicit copy action resolves cross-tab conflicts without overwriting the other revision. */
  saveCopy(): Promise<void> {
    return this.changeFile(async () => {
      if (this.snapshot.files.length >= 100) throw new Error('本地文档空间最多保存 100 份文档。');
      const snapshot = await this.exportSnapshot();
      const id = globalThis.crypto.randomUUID();
      const name = snapshot.document.name.replace(/(\.[^.]+)?$/, ' - 副本$1');
      this.inputVersion = 1;
      this.savedVersion = 0;
      this.update({
        active: { ...snapshot, id, revision: 0, document: { ...snapshot.document, id, name } },
        saveState: 'unsaved',
        error: '',
      });
      await this.save();
    });
  }
  /** Restore into a new file so the latest document and original version remain recoverable. */
  restoreVersion(revision: number): Promise<void> {
    return this.changeFile(async () => {
      if (!this.storage.loadVersion) throw new Error('当前存储没有提供历史版本。');
      await this.flush();
      const activeId = this.snapshot.active?.id;
      const inputVersion = this.inputVersion;
      if (!activeId) throw new Error('请先打开一份文档。');
      if (this.snapshot.files.length >= 100) throw new Error('本地文档空间最多保存 100 份文档。');
      const historical = await this.storage.loadVersion(activeId, revision);
      if (this.snapshot.active?.id !== activeId || this.inputVersion !== inputVersion)
        throw new Error('读取历史版本期间有新输入。最新内容仍保留，请保存后重试。');
      if (!historical) throw new Error('历史版本已过期或不存在。');
      const prepared = await this.prepare(historical);
      if (this.snapshot.active?.id !== activeId || this.inputVersion !== inputVersion)
        throw new Error('准备历史版本期间有新输入。最新内容仍保留，请保存后重试。');
      const id = globalThis.crypto.randomUUID();
      const name = historical.document.name.replace(/(\.[^.]+)?$/, ` - 版本${revision}$1`);
      this.cancelTimer();
      this.inputVersion = 1;
      this.savedVersion = 0;
      this.update({
        active: { ...prepared, id, revision: 0, document: { ...prepared.document, id, name } },
        saveState: 'unsaved',
        error: '',
      });
      await this.save();
    });
  }
}
