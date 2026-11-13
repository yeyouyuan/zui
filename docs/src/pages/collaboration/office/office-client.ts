import { workspaceStore } from '../workspace-store';
import type { WorkspaceFile } from '../workspace-model';
import type { OfficeDraft } from './office-model';

export interface OfficeConfiguration {
  documentType: 'word' | 'cell' | 'pdf';
  document: { key: string; [key: string]: unknown };
  editorConfig: Record<string, unknown>;
  token: string;
  type: string;
  [key: string]: unknown;
}
export interface OfficeHealth {
  available: boolean;
  documentServerUrl: string;
  version?: string | null;
  error?: string;
}
interface SessionState {
  id: string;
  key: string;
  fileId: string;
  mode: 'edit' | 'view';
  sequence: number;
  ackSequence: number;
  baseRevision: number;
  ackRevision: number;
  state: string;
  error?: string;
  config: OfficeConfiguration;
  result?: { sequence: number; hash: string; size: number; requestId?: string };
}
interface SessionCredentials {
  id: string;
  accessToken: string;
  fileId: string;
  mode: 'edit' | 'view';
}
export interface OfficeSession extends SessionCredentials {
  key: string;
  config: OfficeConfiguration;
  revision: number;
  baseRevision: number;
  state: string;
  dirty: boolean;
  saving: boolean;
  ready: boolean;
  error: string;
  sequence: number;
  inputVersion: number;
  editorDirty: boolean;
  /** Monotonic clock of the last editor input; gates the idle auto-save. */
  lastInputAt: number;
  listeners: Set<() => void>;
  pendingSave?: Promise<void>;
  polling?: Promise<void>;
  synchronizing?: Promise<void>;
  closed: boolean;
}

class OfficeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
const credentialsKey = 'zui-office-sessions-v1';
const autoSaveKey = 'zui-office-autosave-v1';
/** Idle window before the background poller force-saves a dirty session. */
export const OFFICE_AUTOSAVE_IDLE_MS = 5000;
const sessions = new Map<string, OfficeSession>();
const current = new Map<string, OfficeSession>();
const opening = new Map<string, Promise<OfficeSession>>();
let pollTimer: ReturnType<typeof setInterval> | undefined;

/** Auto-save defaults to on; the toggle is host UI state, not a session field. */
export function isOfficeAutoSaveEnabled(): boolean {
  try {
    return localStorage.getItem(autoSaveKey) !== '0';
  } catch {
    return true;
  }
}
export function setOfficeAutoSaveEnabled(enabled: boolean) {
  try {
    localStorage.setItem(autoSaveKey, enabled ? '1' : '0');
  } catch {
    // Storage may be unavailable; manual saving continues to work.
  }
}

function credentials(): SessionCredentials[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(credentialsKey) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.filter((entry): entry is SessionCredentials =>
      Boolean(
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.accessToken === 'string' &&
        typeof entry.fileId === 'string' &&
        ['edit', 'view'].includes(entry.mode)
      )
    );
  } catch {
    return [];
  }
}
function remember(session: SessionCredentials) {
  const list = credentials().filter(
    (entry) => entry.fileId !== session.fileId || entry.mode !== session.mode
  );
  list.push({
    id: session.id,
    accessToken: session.accessToken,
    fileId: session.fileId,
    mode: session.mode,
  });
  localStorage.setItem(credentialsKey, JSON.stringify(list));
}
function workspaceId() {
  let id = localStorage.getItem('zui-office-workspace-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('zui-office-workspace-id', id);
  }
  return id;
}
function notify(session: OfficeSession) {
  for (const listener of session.listeners) listener();
}
async function json<T>(
  path: string,
  init: RequestInit = {},
  session?: SessionCredentials
): Promise<T> {
  const headers = new Headers(init.headers);
  if (session) headers.set('x-office-session-token', session.accessToken);
  const response = await fetch(`/api/office${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('本机文档服务未启动。请启动文档服务后重试。');
  const value = await response.json();
  if (!response.ok)
    throw new OfficeRequestError(value.error || '文档服务请求失败。', response.status);
  return value as T;
}
export async function officeHealth(): Promise<OfficeHealth> {
  return json('/health', { signal: AbortSignal.timeout(5000) });
}
async function hash(blob: Blob) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function record(meta: SessionCredentials, state: SessionState): OfficeSession {
  const session: OfficeSession = {
    ...meta,
    key: state.key,
    config: state.config,
    revision: state.ackRevision,
    baseRevision: state.baseRevision,
    state: state.state,
    dirty: false,
    saving: false,
    ready: false,
    error: state.error ?? '',
    sequence: state.ackSequence,
    inputVersion: 0,
    editorDirty: false,
    lastInputAt: Date.now(),
    listeners: new Set(),
    closed: state.state === 'closed',
  };
  sessions.set(session.id, session);
  current.set(`${session.fileId}:${session.mode}`, session);
  remember(session);
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      for (const active of sessions.values()) {
        if (!active.closed || active.dirty || active.saving) void refreshOfficeSession(active);
        if (
          active.ready &&
          active.dirty &&
          !active.editorDirty &&
          !active.pendingSave &&
          !active.error &&
          isOfficeAutoSaveEnabled() &&
          Date.now() - active.lastInputAt >= OFFICE_AUTOSAVE_IDLE_MS
        )
          void saveOfficeSession(active).catch(() => {});
      }
    }, 2500);
    window.addEventListener('beforeunload', (event) => {
      if (![...sessions.values()].some((entry) => entry.dirty || entry.saving)) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }
  return session;
}

// Polls, explicit saves and closing callbacks can observe the same result. Only
// one of them may commit the new file and acknowledge its IndexedDB transaction.
function synchronize(session: OfficeSession, state: SessionState): Promise<void> {
  const next = (session.synchronizing ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      if (state.fileId !== session.fileId || state.mode !== session.mode)
        throw new Error('编辑会话与当前文件不一致，已保留服务端副本。');
      session.state = state.state;
      session.closed = state.state === 'closed';
      session.config = state.config;
      if (state.error) throw new Error(state.error);
      const result = state.result;
      if (result && result.sequence > session.sequence) {
        const blob = await resultBlob(session, result);
        const file = workspaceStore
          .getSnapshot()
          .data?.files.find((entry) => entry.id === session.fileId);
        if (!file?.assetKey) throw new Error('原工作区文件已移除，文档服务中的编辑副本仍可下载。');
        const existing = await workspaceStore.asset(file.assetKey);
        // A previous attempt may have committed successfully before its ACK was
        // interrupted. Verify the durable copy instead of incrementing twice.
        const sameFile = (await hash(existing)) === result.hash;
        if (state.ackSequence >= result.sequence) {
          if (!sameFile || file.revision !== state.ackRevision)
            throw new Error('已确认文件与工作区版本不一致，编辑副本已保留。');
          await workspaceStore.confirmOfficeFile(file.id, file.revision);
          session.revision = file.revision;
          session.sequence = result.sequence;
        } else {
          if (file.revision > state.ackRevision && sameFile) {
            await workspaceStore.confirmOfficeFile(file.id, file.revision);
            session.revision = file.revision;
          } else {
            session.revision = await workspaceStore.commitOfficeFile(
              session.fileId,
              blob,
              session.revision
            );
          }
          await json(
            `/sessions/${session.id}/ack`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                sequence: result.sequence,
                revision: session.revision,
                hash: result.hash,
              }),
            },
            session
          );
          session.sequence = result.sequence;
        }
      }
      if (session.closed) {
        session.editorDirty = false;
        session.dirty = false;
      }
      session.error = '';
      notify(session);
    });
  session.synchronizing = next;
  void next
    .finally(() => {
      if (session.synchronizing === next) session.synchronizing = undefined;
    })
    .catch(() => {});
  return next;
}
async function resultBlob(
  session: SessionCredentials,
  result: NonNullable<SessionState['result']>
) {
  const response = await fetch(`/api/office/sessions/${session.id}/results/${result.sequence}`, {
    headers: { 'x-office-session-token': session.accessToken },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('无法取回编辑文件，本机文档服务中的副本已保留。');
  const blob = await response.blob();
  if (blob.size !== result.size || (await hash(blob)) !== result.hash)
    throw new Error('编辑文件校验未通过，本机服务副本已保留。');
  return blob;
}
export function refreshOfficeSession(session: OfficeSession): Promise<void> {
  if (session.polling) return session.polling;
  session.polling = (async () => {
    try {
      const state = await json<SessionState>(`/sessions/${session.id}`, {}, session);
      await synchronize(session, state);
    } catch (error) {
      session.error = error instanceof Error ? error.message : '同步失败，编辑副本已保留。';
      notify(session);
    } finally {
      session.polling = undefined;
    }
  })();
  return session.polling;
}

export function currentOfficeSession(fileId: string, disabled = false): OfficeSession | undefined {
  return current.get(`${fileId}:${disabled ? 'view' : 'edit'}`);
}

export function releaseOfficeFile(fileId: string) {
  for (const session of sessions.values()) {
    if (session.fileId !== fileId) continue;
    sessions.delete(session.id);
    current.delete(`${fileId}:${session.mode}`);
  }
}

async function legacySource(source: Blob, draft: OfficeDraft): Promise<Blob> {
  if (draft.kind === 'word')
    return (await import('./word-document')).exportWord(
      source,
      draft.changes as import('./office-model').WordChanges
    );
  if (draft.kind === 'excel')
    return (await import('./excel-document')).exportExcel(
      source,
      draft.changes as import('./office-model').ExcelChanges
    );
  return (await import('./pdf-document')).exportPdf(
    source,
    draft.changes as import('./office-model').PdfChanges
  );
}

export function openOfficeSession(
  file: WorkspaceFile,
  disabled: boolean,
  draft?: OfficeDraft
): Promise<OfficeSession> {
  const key = `${file.id}:${disabled ? 'view' : 'edit'}`;
  const existing = opening.get(key);
  if (existing) return existing;
  const pending = startOfficeSession(file, disabled, draft);
  opening.set(key, pending);
  void pending
    .finally(() => {
      if (opening.get(key) === pending) opening.delete(key);
    })
    .catch(() => {});
  return pending;
}

async function startOfficeSession(
  file: WorkspaceFile,
  disabled: boolean,
  draft?: OfficeDraft
): Promise<OfficeSession> {
  const mode = disabled ? 'view' : 'edit';
  let latest = workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === file.id);
  if (!latest?.assetKey) throw new Error('文件已移除或尚未恢复，请重新打开工作区文件。');
  const live = current.get(`${file.id}:${mode}`);
  if (live && !live.closed) {
    await refreshOfficeSession(live);
    if (live.error) throw new Error(live.error);
    if (!live.closed) {
      latest = workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === file.id);
      if (!latest) throw new Error('原工作区文件已移除。');
      if (live.revision !== latest.revision)
        throw new Error('文件版本已变化，请先下载编辑副本再处理版本冲突。');
      return live;
    }
  }
  const previous = credentials().find((entry) => entry.fileId === file.id && entry.mode === mode);
  if (previous && !sessions.has(previous.id)) {
    let state: SessionState | undefined;
    try {
      state = await json<SessionState>(`/sessions/${previous.id}`, {}, previous);
    } catch (error) {
      if (!(error instanceof OfficeRequestError) || error.status !== 404) throw error;
    }
    if (state) {
      const recovered = record(previous, state);
      // Recover before replacing credentials. A storage or version conflict
      // keeps this session accessible for retry and downloading its real file.
      await synchronize(recovered, state).catch((error: unknown) => {
        recovered.error = error instanceof Error ? error.message : '编辑副本恢复失败。';
        throw error;
      });
      if (!recovered.closed) {
        latest = workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === file.id);
        if (latest?.revision !== recovered.revision)
          throw new Error('文件版本与文档服务副本不一致，请先处理版本冲突。');
        recovered.dirty = mode === 'edit';
        return recovered;
      }
    }
  }
  latest = workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === file.id);
  if (!latest?.assetKey) throw new Error('原工作区文件已移除。');
  let source = await workspaceStore.asset(latest.assetKey);
  const savedDraft =
    workspaceStore.getSnapshot().data?.officeDrafts?.[file.id] ??
    (file.revision === latest.revision ? draft : undefined);
  if (savedDraft) {
    if (savedDraft.kind !== latest.kind || savedDraft.baseRevision !== latest.revision)
      throw new Error('旧版编辑草稿与文件版本不一致，草稿已保留在工作区备份中。');
    source = await legacySource(source, savedDraft);
    if (mode === 'edit') {
      await workspaceStore.commitOfficeFile(latest.id, source, latest.revision);
      latest = workspaceStore.getSnapshot().data!.files.find((entry) => entry.id === file.id)!;
    }
  }
  const query = new URLSearchParams({
    fileId: latest.id,
    name: latest.name,
    revision: String(latest.revision),
    mode,
    workspaceId: workspaceId(),
  });
  const created = await json<{
    id: string;
    key: string;
    accessToken: string;
    config: OfficeConfiguration;
  }>(`/sessions?${query}`, {
    method: 'POST',
    body: source,
    headers: { 'content-type': source.type || 'application/octet-stream' },
    signal: AbortSignal.timeout(60000),
  });
  return record(
    { id: created.id, accessToken: created.accessToken, fileId: file.id, mode },
    {
      ...created,
      fileId: file.id,
      mode,
      state: 'opening',
      sequence: 0,
      ackSequence: 0,
      baseRevision: latest.revision,
      ackRevision: latest.revision,
    }
  );
}

export function officeDocumentChanged(session: OfficeSession, changed: boolean) {
  if (session.mode !== 'edit') return;
  session.editorDirty = changed;
  if (changed) {
    session.inputVersion++;
    session.lastInputAt = Date.now();
    session.dirty = true;
  }
  notify(session);
}

const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));
export function saveOfficeSession(session: OfficeSession): Promise<void> {
  if (session.pendingSave) return session.pendingSave;
  if (session.mode !== 'edit') return Promise.resolve();
  session.pendingSave = (async () => {
    session.saving = true;
    session.error = '';
    notify(session);
    try {
      const deadline = Date.now() + 60000;
      while (session.editorDirty && !session.closed && Date.now() < deadline) await pause(250);
      if (session.editorDirty) throw new Error('编辑器仍在提交内容，请稍后再保存。');
      if (session.closed) {
        await refreshOfficeSession(session);
        if (session.error) throw new Error(session.error);
        return;
      }
      const version = session.inputVersion;
      const requestId = crypto.randomUUID();
      const result = await json<{ noChanges?: boolean }>(
        `/sessions/${session.id}/force-save`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestId }),
        },
        session
      );
      if (result.noChanges) {
        await refreshOfficeSession(session);
        if (session.error) throw new Error(session.error);
      } else {
        let completed = false;
        while (Date.now() < deadline) {
          const state = await json<SessionState>(`/sessions/${session.id}`, {}, session);
          await synchronize(session, state);
          // Docs may produce identical bytes and reuse the sequence. The UUID
          // proves this result belongs to this save, even without a new version.
          if (state.result?.requestId === requestId && session.sequence >= state.result.sequence) {
            completed = true;
            break;
          }
          if (session.closed) {
            completed = true;
            break;
          }
          await pause(500);
        }
        if (!completed)
          throw new Error('保存回写尚未完成，编辑内容仍在本机文档服务中。可以重试保存。');
      }
      if (session.inputVersion === version) session.dirty = false;
    } catch (error) {
      session.error = error instanceof Error ? error.message : '保存失败，编辑副本已保留。';
      throw error;
    } finally {
      session.saving = false;
      session.pendingSave = undefined;
      notify(session);
    }
  })();
  return session.pendingSave;
}

export async function saveAllOfficeSessions(): Promise<void> {
  const pending = (session: OfficeSession) =>
    session.pendingSave ||
    session.saving ||
    (session.dirty && !session.closed && session.mode === 'edit');
  // An edit can arrive while a save is writing or while another document is
  // being drained. A completed request alone does not mean all input is saved.
  for (let round = 0; round < 3; round++) {
    for (const session of sessions.values()) {
      if (session.pendingSave) await session.pendingSave;
      else if (session.dirty && !session.closed && session.mode === 'edit')
        await saveOfficeSession(session);
      else await refreshOfficeSession(session);
      if (session.error) throw new Error(session.error);
    }
    if (![...sessions.values()].some(pending)) return;
  }
  throw new Error('保存期间仍有新输入，当前修改尚未全部回写。请暂停编辑后重试。');
}
export async function downloadOfficeCopy(session: OfficeSession): Promise<Blob> {
  const state = await json<SessionState>(`/sessions/${session.id}`, {}, session);
  if (!state.result) throw new Error('尚未生成编辑副本，请先保存。');
  return resultBlob(session, state.result);
}
