import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BUILDER_STORAGE_KEY,
  builderId,
  createBuilderWorkspace,
  parseBuilderWorkspace,
  type BuilderData,
  type BuilderWorkspace,
} from './builder-model';

type Status = 'saving' | 'saved' | 'error' | 'conflict' | 'corrupt';

function load(initialData: BuilderData) {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BUILDER_STORAGE_KEY);
    return {
      workspace: raw ? parseBuilderWorkspace(raw) : createBuilderWorkspace(initialData),
      raw,
      status: (raw ? 'saved' : 'saving') as Status,
      message: '',
      dirty: !raw,
    };
  } catch (error) {
    return {
      workspace: createBuilderWorkspace(initialData),
      raw,
      status: (raw ? 'corrupt' : 'error') as Status,
      message: raw
        ? `本地存档无法读取：${error instanceof Error ? error.message : '格式错误'} 原始存档仍保留，可先下载备份再重建。`
        : '浏览器暂时无法访问本地存储。编辑内容尚未保存，请重试或导出备份。',
      dirty: true,
    };
  }
}

/** Save synchronously before leaving, and reject writes based on another tab's revision. */
export function useBuilderWorkspace(initialData: BuilderData) {
  const [initial] = useState(() => load(initialData));
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [status, setStatus] = useState<Status>(initial.status);
  const [message, setMessage] = useState(initial.message);
  const [savedAt, setSavedAt] = useState('');
  const state = useRef({
    workspace: initial.workspace,
    raw: initial.raw,
    dirty: initial.dirty,
    blocked: initial.status === 'corrupt' || initial.status === 'conflict',
  });

  const persist = useCallback((): boolean => {
    const current = state.current;
    if (current.blocked) return false;
    if (!current.dirty) return true;
    try {
      const latest = localStorage.getItem(BUILDER_STORAGE_KEY);
      if (latest !== current.raw) {
        current.blocked = true;
        setStatus('conflict');
        setMessage(
          '另一个标签页更新了工作区。请先导出当前备份，再载入最新存档，避免覆盖另一份编辑。'
        );
        return false;
      }
      const next = { ...current.workspace, revision: builderId('revision') };
      const raw = JSON.stringify(next);
      localStorage.setItem(BUILDER_STORAGE_KEY, raw);
      current.workspace = next;
      current.raw = raw;
      current.dirty = false;
      setWorkspace(next);
      setStatus('saved');
      setSavedAt(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setMessage('');
      return true;
    } catch {
      setStatus('error');
      setMessage(
        '保存失败：本地存储可能已满或被浏览器禁用。编辑内容仍在内存中，请重试或下载工作区备份。'
      );
      return false;
    }
  }, []);

  const update = useCallback((change: (workspace: BuilderWorkspace) => BuilderWorkspace) => {
    const next = change(state.current.workspace);
    if (next === state.current.workspace) return;
    state.current.workspace = next;
    state.current.dirty = true;
    setWorkspace(next);
    if (!state.current.blocked) setStatus('saving');
  }, []);

  useEffect(() => {
    if (!state.current.dirty || state.current.blocked) return undefined;
    const timer = window.setTimeout(persist, 500);
    return () => window.clearTimeout(timer);
  }, [workspace, persist]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (state.current.dirty && !persist()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    const externalChange = (event: StorageEvent) => {
      if (
        (event.key === BUILDER_STORAGE_KEY || event.key === null) &&
        event.newValue !== state.current.raw
      ) {
        state.current.blocked = true;
        setStatus('conflict');
        setMessage('另一个标签页更改了工作区。请先导出当前备份，再载入最新存档。');
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('storage', externalChange);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      persist();
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('storage', externalChange);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [persist]);

  const reload = useCallback(() => {
    try {
      const raw = localStorage.getItem(BUILDER_STORAGE_KEY);
      if (!raw) throw new Error('最新存档已被移除，请导出当前内容后重建工作区。');
      const next = parseBuilderWorkspace(raw);
      state.current = { workspace: next, raw, dirty: false, blocked: false };
      setWorkspace(next);
      setStatus('saved');
      setMessage('');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '载入失败。');
      return false;
    }
  }, []);

  const rebuild = useCallback(() => {
    try {
      // Rebuild is an explicit user action; retain current in-memory pages.
      state.current.raw = localStorage.getItem(BUILDER_STORAGE_KEY);
      state.current.blocked = false;
      state.current.dirty = true;
      return persist();
    } catch {
      setMessage('本地存储不可用，请先下载备份。');
      return false;
    }
  }, [persist]);

  return {
    workspace,
    update,
    persist,
    status,
    message,
    savedAt,
    reload,
    rebuild,
    rawBackup: initial.raw,
  };
}
