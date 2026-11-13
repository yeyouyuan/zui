import { useEffect, useRef, useState } from 'react';
import { Button, DropdownMenu, OfficeEditor, Switch } from '@zui/react';
import { ArrowUpRight, Check, Download, RefreshCw, Save } from '@zui/icons';
import type { WorkspaceFile } from '../workspace-model';
import { workspaceStore } from '../workspace-store';
import { downloadBlob } from '../workspace-backup';
import type { OfficeDraft } from './office-model';
import {
  currentOfficeSession,
  downloadOfficeCopy,
  isOfficeAutoSaveEnabled,
  officeDocumentChanged,
  officeHealth,
  openOfficeSession,
  saveOfficeSession,
  setOfficeAutoSaveEnabled,
  type OfficeSession,
} from './office-client';
import './office.css';

export default function OfficeWorkbench({
  file,
  draft,
  disabled,
  defaultExpanded = true,
}: {
  file: WorkspaceFile;
  draft?: OfficeDraft;
  disabled: boolean;
  defaultExpanded?: boolean;
}) {
  const [session, setSession] = useState<OfficeSession | null>(null);
  const [documentServerUrl, setDocumentServerUrl] = useState('');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoSave, setAutoSave] = useState(isOfficeAutoSaveEnabled);
  const [, redraw] = useState(0);
  const source = useRef({ file, draft });
  source.current = { file, draft };
  const kind = file.kind === 'word' ? 'Word' : file.kind === 'excel' ? 'Excel' : 'PDF';
  const recovery = session ?? currentOfficeSession(file.id, disabled);
  const storageError = workspaceStore.getSnapshot().error;
  const notice = error || recovery?.error || storageError;
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setSession(null);
    setStarting(true);
    setError('');
    setLoading(true);
    void (async () => {
      const health = await officeHealth();
      if (!health.available) throw new Error(health.error || '文档服务正在准备，请稍后重试。');
      if (!active) return;
      const opened = await openOfficeSession(source.current.file, disabled, source.current.draft);
      if (!active) return;
      const listener = () => {
        if (active) redraw((value) => value + 1);
      };
      opened.listeners.add(listener);
      unsubscribe = () => opened.listeners.delete(listener);
      setDocumentServerUrl(health.documentServerUrl);
      setSession(opened);
      setStarting(false);
    })().catch((error: unknown) => {
      if (active) {
        setError(error instanceof Error ? error.message : '文档编辑器无法打开。');
        setStarting(false);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [disabled, attempt]);
  useEffect(() => {
    if (!session || session.mode !== (disabled ? 'view' : 'edit')) return;
    return () => {
      session.ready = false;
      if (session.dirty) void saveOfficeSession(session).catch(() => {});
    };
  }, [session, disabled]);
  const save = async () => {
    if (!session) return;
    setError('');
    try {
      await workspaceStore.flush();
      await saveOfficeSession(session);
      await workspaceStore.confirmOfficeFile(session.fileId, session.revision);
    } catch (error) {
      setError(error instanceof Error ? error.message : '文件保存失败，编辑副本已保留。');
    }
  };
  // Ctrl/Cmd+S inside the native canvas is handled by the editor itself and
  // reaches the bridge through its callback; this listener only covers the
  // surrounding workbench chrome, where iframe events do not arrive.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!session || disabled) return;
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (session.ready && !session.saving) void saveRef.current();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [session, disabled]);
  const toggleAutoSave = (next: boolean) => {
    setAutoSave(next);
    setOfficeAutoSaveEnabled(next);
  };
  const download = async () => {
    setError('');
    try {
      if (session?.dirty) await saveOfficeSession(session);
      const latest = workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === file.id);
      if (!latest?.assetKey) throw new Error('原工作区文件已移除。');
      const blob = session?.error
        ? await downloadOfficeCopy(session)
        : await workspaceStore.asset(latest.assetKey);
      downloadBlob(blob, latest.name);
    } catch (error) {
      try {
        if (!recovery) throw error;
        downloadBlob(await downloadOfficeCopy(recovery), file.name);
        setError('本次保存尚未完成，已下载最近生成的服务端副本。请保留当前页面并重试保存。');
      } catch {
        setError(error instanceof Error ? error.message : '文件下载失败，请保留当前页面。');
      }
    }
  };
  const status = starting
    ? '正在连接文档服务…'
    : loading
      ? '正在打开完整编辑器…'
      : session?.saving
        ? '正在保存到工作台…'
        : notice
          ? '需要处理保存或连接问题'
          : !session
            ? '编辑器未连接'
            : session?.dirty
              ? autoSave
                ? '编辑中 · 正在自动保存'
                : '编辑中 · 有未保存修改'
              : disabled
                ? '只读预览'
                : '已保存到工作台';
  const saveState =
    starting || loading
      ? 'loading'
      : session?.saving
        ? 'saving'
        : notice
          ? 'error'
          : session?.dirty
            ? 'unsaved'
            : 'saved';
  const busy = Boolean(session?.saving);
  const toggleExpanded = () => setExpanded((value) => !value);
  return (
    <section
      className="office-suite"
      data-kind={file.kind}
      data-expanded={expanded || undefined}
      aria-label={`${file.name} 在线编辑器`}
    >
      <div className="office-suite-bar">
        <div className="office-suite-title">
          <Button size="sm" variant="ghost" iconStart={<ArrowUpRight />} onClick={toggleExpanded}>
            {expanded ? '返回工作台' : '展开编辑器'}
          </Button>
          <span className="office-suite-kind">{kind}</span>
          <strong title={file.name}>{file.name}</strong>
          <span
            className="office-suite-status"
            role="status"
            data-save-state={saveState}
            aria-label="文档编辑保存状态"
          >
            <span className="office-suite-status-dot" aria-hidden="true" />
            <span className="office-suite-status-text">{status}</span>
          </span>
        </div>
        <div className="office-suite-actions">
          <span className="office-suite-brand">ONLYOFFICE</span>
          <Switch
            className="office-suite-autosave"
            checked={autoSave}
            onChange={toggleAutoSave}
            label="自动保存"
          />
          <DropdownMenu>
            <DropdownMenu.Trigger className="office-suite-file-trigger" aria-label="文件">
              文件
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="office-suite-file-content">
              <DropdownMenu.Item
                disabled={disabled || !session?.ready || busy}
                onSelect={() => void save()}
              >
                <span className="office-suite-file-action">
                  <Save size={16} />
                  保存到工作台
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Item disabled={busy} onSelect={() => void download()}>
                <span className="office-suite-file-action">
                  <Download size={16} />
                  下载文件
                </span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={toggleExpanded}>
                <span className="office-suite-file-action">
                  <ArrowUpRight size={16} />
                  {expanded ? '返回工作台' : '展开编辑器'}
                </span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
          <Button
            size="sm"
            className="office-suite-save"
            iconStart={<Check />}
            disabled={disabled || !session?.ready || session.saving}
            onClick={() => void save()}
          >
            保存到工作台
          </Button>
        </div>
      </div>
      {notice && (
        <div className="office-suite-error" role="alert">
          <span>{notice}</span>
          <Button
            size="sm"
            variant="outline"
            iconStart={<RefreshCw />}
            onClick={() => {
              if (session?.ready && (session.error || storageError)) {
                void save();
              } else {
                setAttempt((value) => value + 1);
              }
            }}
          >
            {session?.ready && (session.error || storageError) ? '重试保存' : '重试连接'}
          </Button>
          {recovery && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void downloadOfficeCopy(recovery)
                  .then((blob) => downloadBlob(blob, file.name))
                  .catch((error: unknown) =>
                    setError(error instanceof Error ? error.message : '编辑副本尚未生成。')
                  )
              }
            >
              下载服务端副本
            </Button>
          )}
        </div>
      )}
      <div className="office-suite-stage" role="region" aria-label={`${kind} 文档编辑画布`}>
        {starting && (
          <div className="office-suite-loading" role="status">
            <span className="office-suite-spinner" aria-hidden="true" />
            {status}
          </div>
        )}
        {!session && !starting && (
          <div className="office-suite-unavailable">
            <h3>完整文档编辑器尚未连接</h3>
            <p>文档服务连接成功后，即可在页面中直接编辑正文、表格和排版。</p>
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              重新连接编辑器
            </Button>
          </div>
        )}
        {session && session.mode === (disabled ? 'view' : 'edit') && (
          <OfficeEditor
            documentServerUrl={documentServerUrl}
            config={session.config}
            kind={
              file.kind === 'word' || file.kind === 'excel' || file.kind === 'pdf'
                ? file.kind
                : undefined
            }
            customization={{ compactHeader: true, hideRightMenu: true }}
            title={file.name}
            header={false}
            toolbar={false}
            height="100%"
            className="office-suite-frame"
            onReady={() => {
              session.ready = true;
              setLoading(false);
              redraw((value) => value + 1);
            }}
            onStatusChange={(next) => {
              if (next === 'loading') session.ready = false;
              setLoading(next === 'loading');
            }}
            onError={(error) => {
              setError(error.message);
              setLoading(false);
            }}
            events={{
              onDocumentStateChange: (event) => officeDocumentChanged(session, Boolean(event.data)),
              onRequestClose: () => setExpanded(false),
            }}
          />
        )}
      </div>
    </section>
  );
}
