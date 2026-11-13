import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button, Modal, Skeleton, Tag } from '@zui/react';
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckCircle,
  ChevronRight,
  Close,
  Edit,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Send,
  Settings,
  Download,
  Plus,
  Trash,
  Search,
} from '@zui/icons';
import ApiTable from '../../components/ApiTable';
import { usePageTitle } from '../../components/usePageTitle';
import {
  createTextFile,
  fileType,
  fileKind,
  textBlob,
  formatSize,
  importFile,
  removeFile,
  validName,
  MAX_FILES,
  MAX_TEXT_BYTES,
  MAX_WORKSPACE_BYTES,
  type Workspace,
  type WorkspaceFile,
} from './workspace-model';
import { useWorkspace, workspaceStore } from './workspace-store';
import { downloadBlob, exportBackup, importBackup } from './workspace-backup';
import {
  currentOfficeSession,
  downloadOfficeCopy,
  releaseOfficeFile,
  saveAllOfficeSessions,
  saveOfficeSession,
} from './office/office-client';
import './collaboration.css';
const OfficeWorkbench = lazy(() => import('./office/OfficeWorkbench'));

type PreviewState = 'ready' | 'loading' | 'error';
const ICONS = {
  text: FileText,
  image: ImageIcon,
  pdf: FileText,
  word: FileText,
  excel: FileText,
  binary: Archive,
};

export default function CollaborationPage(): React.ReactNode {
  usePageTitle('内容协作实验室');
  const snapshot = useWorkspace();
  if (!snapshot.data)
    return (
      <div className="doc-page collaboration-page">
        <h1 className="doc-h1">内容协作实验室</h1>
        <div className="collaboration-placeholder" role={snapshot.error ? 'alert' : 'status'}>
          <p>{snapshot.error || '正在打开本地工作区…'}</p>
          {snapshot.error && <Button onClick={() => void workspaceStore.retry()}>重试读取</Button>}
        </div>
      </div>
    );
  return (
    <WorkspaceView data={snapshot.data} status={snapshot.status} storageError={snapshot.error} />
  );
}

function WorkspaceView({
  data,
  status,
  storageError,
}: {
  data: Workspace;
  status: string;
  storageError: string;
}): React.ReactNode {
  const instanceId = useId();
  const update = workspaceStore.update;
  const fileId = data.activeFile ?? '';
  const file = data.files.find((item) => item.id === fileId);
  const [preview, setPreview] = useState<{
    id: string;
    state: PreviewState;
    url: string;
    error: string;
  }>({ id: '', state: 'ready', url: '', error: '' });
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewState = preview.id === fileId ? preview.state : 'loading';
  const [readOnly, setReadOnly] = useState(false);
  const blocked = readOnly || status === 'conflict';
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => setEditing(null), [fileId]);
  const editorDraft = data.editorDrafts[fileId];
  const draft = editorDraft?.body ?? '';
  const editingBlock = file?.blocks.find((block) => block.id === editing);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [dialog, setDialog] = useState<'create' | 'rename' | 'delete' | 'reload' | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const { anchor: commentAnchor = null, replyTo = null } = data.commentTargets[fileId] ?? {};
  const commentKey = `${fileId}:${replyTo ? `reply:${replyTo}` : (commentAnchor ?? 'file')}`;
  const comment = data.commentDrafts[commentKey] ?? '';
  const setComment = (value: string) =>
    update((current) => ({
      ...current,
      commentDrafts: { ...current.commentDrafts, [commentKey]: value },
    }));
  const setCommentTarget = (anchor: string | null, threadId: string | null = null) => {
    update((current) => ({
      ...current,
      commentTargets: { ...current.commentTargets, [fileId]: { anchor, replyTo: threadId } },
    }));
  };
  const hasDraft = (id: string) =>
    Boolean(data.editorDrafts[id] || data.officeDrafts?.[id]) ||
    Object.entries(data.commentDrafts).some(
      ([key, text]) => key.startsWith(`${id}:`) && text.trim()
    );
  const [feedback, setFeedback] = useState('可以导入自己的文件，或新建一份文档。');
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const openFilterRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const settingsTriggerRef = useRef<HTMLElement>(null);
  const restoreFilterFocus = useRef(false);
  useLayoutEffect(() => {
    if (!restoreFilterFocus.current) return;
    openFilterRef.current?.focus({ preventScroll: true });
    restoreFilterFocus.current = false;
  }, [data.threads]);
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (wasEditingRef.current && !editing) editTriggerRef.current?.focus();
    wasEditingRef.current = Boolean(editing);
  }, [editing]);
  useEffect(() => {
    let disposed = false;
    let url = '';
    if (!file?.assetKey || ['binary', 'word', 'excel', 'pdf'].includes(file.kind)) {
      setPreview({ id: fileId, state: 'ready', url: '', error: '' });
      return;
    }
    setPreview({ id: fileId, state: 'loading', url: '', error: '' });
    void workspaceStore
      .asset(file.assetKey)
      .then((blob) => {
        if (disposed) return;
        url = URL.createObjectURL(blob);
        setPreview({ id: fileId, state: 'loading', url, error: '' });
      })
      .catch((error) => {
        if (!disposed)
          setPreview({
            id: fileId,
            state: 'error',
            url: '',
            error: error instanceof Error ? error.message : '无法读取附件。',
          });
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId, file?.assetKey, file?.kind, previewAttempt]);
  useEffect(() => {
    const closeSettings = (event: PointerEvent) => {
      const settings = settingsRef.current;
      if (settings?.open && event.target instanceof Node && !settings.contains(event.target))
        settings.open = false;
    };
    document.addEventListener('pointerdown', closeSettings);
    return () => document.removeEventListener('pointerdown', closeSettings);
  }, []);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const forFile = data.threads.filter((thread) => thread.file === fileId);
  const visibleThreads = forFile.filter((thread) => filter === 'all' || !thread.resolved);
  const unresolved = forFile.filter((thread) => !thread.resolved).length;
  const selectedThread = forFile.find((thread) => thread.id === replyTo);
  const FileIcon = file ? ICONS[file.kind] : FileText;
  const titleFor = (anchor: string) =>
    file?.blocks.find((block) => block.id === anchor)?.title ?? '原段落';
  const bodyFor = (anchor: string) => file?.blocks.find((block) => block.id === anchor)?.body;
  const composerQuote = selectedThread?.quote ?? (commentAnchor ? bodyFor(commentAnchor) : null);
  const selectFile = async (next: string) => {
    if (next === fileId || editing || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await saveAllOfficeSessions();
      update((current) => ({ ...current, activeFile: next }));
      setActiveAnchor(null);
      setFeedback(
        `已打开 ${data.files.find((item) => item.id === next)!.name}${hasDraft(next) ? '，已恢复本地草稿。' : ''}`
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '当前文档尚未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const startEditing = (blockId: string) => {
    if (!file || blocked) return;
    const existing = data.editorDrafts[fileId];
    // One document draft at a time; resume it before starting another paragraph.
    const target = existing?.blockId ?? blockId;
    const block = file.blocks.find((item) => item.id === target);
    if (!block) return;
    if (!existing)
      update((current) => ({
        ...current,
        editorDrafts: {
          ...current.editorDrafts,
          [fileId]: { blockId: target, body: block.body, baseRevision: file.revision },
        },
      }));
    setEditing(target);
    setActiveAnchor(target);
  };
  const setDraft = (body: string) =>
    update((current) => ({
      ...current,
      editorDrafts: {
        ...current.editorDrafts,
        [fileId]: { ...current.editorDrafts[fileId], body },
      },
    }));
  const cancelEditing = () => {
    update((current) => {
      const next = { ...current.editorDrafts };
      delete next[fileId];
      return { ...current, editorDrafts: next };
    });
    setEditing(null);
  };
  const save = () => {
    if (!file || !editing || blocked || !editorDraft) return;
    if (editorDraft.baseRevision !== file.revision) {
      setActionError('正文版本已变化，请先下载草稿，再取消并重新编辑当前版本。');
      return;
    }
    const nextFile = {
      ...file,
      blocks: file.blocks.map((block) =>
        block.id === editing ? { ...block, body: draft } : block
      ),
      updatedAt: new Date().toISOString(),
    };
    nextFile.size = textBlob(nextFile).size;
    if (nextFile.size > MAX_TEXT_BYTES) {
      setActionError('正文超过 1 MB 上限，草稿已保留。');
      return;
    }
    if (
      data.files.reduce((sum, item) => sum + (item.id === fileId ? nextFile.size : item.size), 0) >
      MAX_WORKSPACE_BYTES
    ) {
      setActionError('保存后将超出工作区 100 MB 上限，请先导出并删除不需要的文件。草稿已保留。');
      return;
    }
    if (draft !== editingBlock?.body) nextFile.revision += 1;
    update((current) => {
      const drafts = { ...current.editorDrafts };
      delete drafts[fileId];
      return {
        ...current,
        files: current.files.map((item) => (item.id === fileId ? nextFile : item)),
        editorDrafts: drafts,
      };
    });
    setEditing(null);
    setActionError('');
    setFeedback('正文已更新，正在保存到当前浏览器。请留意顶部保存状态。');
    void workspaceStore.flush();
  };
  const locate = (anchor: string) => {
    const section = sectionRefs.current[anchor];
    if (!section?.isConnected) return;
    setActiveAnchor(anchor);
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'center',
    });
    section.focus({ preventScroll: true });
    setFeedback(`已定位到${titleFor(anchor)}`);
  };
  const sendComment = () => {
    const text = comment.trim();
    if (!file || !text || blocked || (replyTo && (!selectedThread || selectedThread.resolved)))
      return;
    const createdAt = new Date().toISOString();
    update((current) => {
      const threads = replyTo
        ? current.threads.map((thread) =>
            thread.id === replyTo
              ? {
                  ...thread,
                  replies: [
                    ...thread.replies,
                    {
                      id: crypto.randomUUID(),
                      author: current.author.trim() || '你',
                      body: text,
                      createdAt,
                    },
                  ],
                }
              : thread
          )
        : [
            ...current.threads,
            {
              id: crypto.randomUUID(),
              file: fileId,
              anchor: commentAnchor,
              quote: commentAnchor ? (bodyFor(commentAnchor) ?? '') : file.name,
              quoteRevision: commentAnchor ? file.revision : null,
              author: current.author.trim() || '你',
              body: text,
              createdAt,
              resolved: false,
              replies: [],
            },
          ];
      const drafts = { ...current.commentDrafts };
      delete drafts[commentKey];
      return {
        ...current,
        threads,
        commentDrafts: drafts,
        commentTargets: { ...current.commentTargets, [fileId]: { anchor: null, replyTo: null } },
      };
    });
    composerRef.current?.focus();
    setFeedback(replyTo ? '回复已添加，正在保存到本地。' : '评论已添加，正在保存到本地。');
    void workspaceStore.flush();
  };
  const downloadFile = async (target: WorkspaceFile) => {
    try {
      const session = currentOfficeSession(target.id);
      if (session?.dirty) {
        try {
          await saveOfficeSession(session);
        } catch {
          downloadBlob(await downloadOfficeCopy(session), target.name);
          setActionError('本次保存尚未完成，已下载最近生成的服务端副本。请保留编辑页面并重试。');
          return;
        }
      }
      const latest =
        workspaceStore.getSnapshot().data?.files.find((entry) => entry.id === target.id) ?? target;
      downloadBlob(
        latest.kind === 'text' ? textBlob(latest) : await workspaceStore.asset(latest.assetKey!),
        latest.name
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '文件下载失败。');
    }
  };
  const exportWorkspace = async () => {
    setBusy(true);
    setActionError('');
    try {
      await saveAllOfficeSessions();
      const latest = workspaceStore.getSnapshot().data!;
      downloadBlob(
        await exportBackup(latest, workspaceStore.asset),
        `内容工作区-${new Date().toISOString().slice(0, 10)}.zui.json`
      );
      setFeedback('工作区备份已导出，包含文件、讨论和草稿。');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '备份失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const addFiles = async (sources: File[]) => {
    if (blocked || busy || editing || !sources.length) return;
    setBusy(true);
    setActionError('');
    try {
      await saveAllOfficeSessions();
      const latest = workspaceStore.getSnapshot().data!;
      const imported: WorkspaceFile[] = [];
      const assets = new Map<string, Blob>();
      const errors: string[] = [];
      let total = latest.files.reduce((sum, file) => sum + file.size, 0);
      for (const source of sources) {
        try {
          if (latest.files.length + imported.length >= MAX_FILES)
            throw new Error('工作区最多保留 100 个文件。');
          const result = await importFile(source);
          if (total + result.file.size > MAX_WORKSPACE_BYTES)
            throw new Error('工作区文件总量超过 100 MB，请先导出并删除不需要的文件。');
          total += result.file.size;
          imported.push(result.file);
          if (result.asset) assets.set(result.file.assetKey!, result.asset);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : `${source.name} 导入失败。`);
        }
      }
      if (imported.length) {
        update(
          (current) => ({
            ...current,
            files: [...current.files, ...imported],
            activeFile: imported[0].id,
          }),
          assets
        );
        setActiveAnchor(null);
        setSearch('');
        setFeedback(`已导入 ${imported.length} 个文件，正在保存到本地。`);
      }
      setActionError(errors.join(' '));
      await workspaceStore.flush();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '当前文档尚未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const restoreBackup = async (source: File) => {
    if (blocked || busy || editing) return;
    setBusy(true);
    setActionError('');
    try {
      await saveAllOfficeSessions();
      const restored = await importBackup(source);
      const latest = workspaceStore.getSnapshot().data!;
      if (
        latest.files.length + restored.data.files.length > MAX_FILES ||
        [...latest.files, ...restored.data.files].reduce((sum, file) => sum + file.size, 0) >
          MAX_WORKSPACE_BYTES
      )
        throw new Error('导入备份后将超出工作区 100 文件或 100 MB 上限。');
      update(
        (current) => ({
          ...current,
          files: [...current.files, ...restored.data.files],
          threads: [...current.threads, ...restored.data.threads],
          activeFile: restored.data.activeFile ?? current.activeFile,
          commentDrafts: { ...current.commentDrafts, ...restored.data.commentDrafts },
          editorDrafts: { ...current.editorDrafts, ...restored.data.editorDrafts },
          officeDrafts: { ...current.officeDrafts, ...restored.data.officeDrafts },
        }),
        restored.assets
      );
      setSearch('');
      setActiveAnchor(null);
      setFeedback(`已恢复 ${restored.data.files.length} 个文件及其讨论和草稿，原有文件继续保留。`);
      void workspaceStore.flush();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '备份恢复失败。');
    } finally {
      setBusy(false);
    }
  };
  const openSample = async (kind: 'word' | 'excel' | 'pdf') => {
    if (blocked || busy) return;
    setBusy(true);
    try {
      const { officeSample } = await import('./office/samples');
      const sample = await officeSample(kind);
      setBusy(false);
      await addFiles([sample]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '示例文件生成失败。');
      setBusy(false);
    }
  };
  const openDialog = (kind: typeof dialog) => {
    setDialog(kind);
    setName(kind === 'rename' ? (file?.name ?? '') : '新建文档.txt');
    setNameError('');
  };
  const changeAccess = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await saveAllOfficeSessions();
      setReadOnly(next);
      if (next) setEditing(null);
      setFeedback(next ? '已进入只读预览，修改已保存。' : '已恢复编辑权限。');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '当前文档尚未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const confirmDialog = async () => {
    if (busy) return;
    if (dialog === 'reload') {
      setEditing(null);
      void workspaceStore.reload();
      setDialog(null);
      return;
    }
    if (blocked) return;
    setBusy(true);
    if (dialog === 'delete' && file) {
      try {
        await saveAllOfficeSessions();
      } catch (error) {
        setNameError(error instanceof Error ? error.message : '当前文档尚未保存。');
        setBusy(false);
        return;
      }
      releaseOfficeFile(fileId);
      update((current) => removeFile(current, fileId));
      setEditing(null);
      setActiveAnchor(null);
      setFeedback(`已删除 ${file.name} 及其本地讨论与草稿。`);
      setDialog(null);
      setBusy(false);
      return;
    }
    try {
      let nextName = validName(name);
      if (dialog === 'rename' && file && ['word', 'excel', 'pdf'].includes(file.kind)) {
        const extension = file.kind === 'word' ? '.docx' : file.kind === 'excel' ? '.xlsx' : '.pdf';
        if (!nextName.toLowerCase().endsWith(extension))
          nextName = validName(`${nextName}${extension}`);
      }
      if (dialog === 'create' && fileKind(nextName, '') !== 'text')
        nextName = validName(`${nextName}.txt`);
      if (
        data.files.some(
          (item) => item.name === nextName && (dialog !== 'rename' || item.id !== fileId)
        )
      )
        throw new Error('已有同名文件，请换一个名称。');
      if (dialog === 'create') {
        await saveAllOfficeSessions();
        if (data.files.length >= MAX_FILES) throw new Error('工作区最多保留 100 个文件。');
        const next = createTextFile(nextName);
        update((current) => ({ ...current, files: [...current.files, next], activeFile: next.id }));
        setSearch('');
        setActiveAnchor(null);
      } else if (file)
        update((current) => ({
          ...current,
          files: current.files.map((item) =>
            item.id === fileId
              ? { ...item, name: nextName, updatedAt: new Date().toISOString() }
              : item
          ),
        }));
      setDialog(null);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : '文件操作失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="doc-page collaboration-page">
      <header className="collaboration-intro">
        <div>
          <div className="collaboration-eyebrow">
            <span aria-hidden="true">
              <FolderOpen />
            </span>
            CONTENT WORKSPACE <span className="collaboration-prototype">本地文件工作台</span>
          </div>
          <h1 className="doc-h1">内容协作实验室</h1>
          <p className="doc-lead">在线预览和修改 Word、Excel、PDF 与文本，文件和讨论保存在本机。</p>
        </div>
        <ol className="collaboration-steps" aria-label="协作流程">
          <li>
            <FileText aria-hidden="true" />
            <span>阅读文件</span>
          </li>
          <li>
            <Edit aria-hidden="true" />
            <span>完善内容</span>
          </li>
          <li>
            <MessageSquare aria-hidden="true" />
            <span>交流想法</span>
          </li>
        </ol>
      </header>
      <div className="collaboration-workspace-heading">
        <div>
          <h2>文件工作台</h2>
          <span>文件与讨论保存在当前浏览器。</span>
        </div>
        <span
          className="collaboration-local-note"
          role="status"
          aria-label="工作区保存状态"
          data-state={status}
        >
          {status === 'saved'
            ? '已保存到本机'
            : status === 'saving'
              ? '正在保存…'
              : status === 'conflict'
                ? '发现版本冲突'
                : '保存失败'}
        </span>
        <details
          ref={settingsRef}
          className="collaboration-settings"
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.open = false;
            settingsTriggerRef.current?.focus();
          }}
        >
          <summary ref={settingsTriggerRef}>
            <Settings aria-hidden="true" />
            工作区设置
            <ChevronRight aria-hidden="true" />
          </summary>
          <div className="collaboration-controls">
            <label>
              访问权限
              <select
                aria-label="访问权限"
                value={readOnly ? 'read' : 'edit'}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value === 'read';
                  void changeAccess(next);
                }}
              >
                <option value="edit">可编辑</option>
                <option value="read">只读</option>
              </select>
            </label>
            <label>
              评论署名
              <input
                aria-label="评论署名"
                value={data.author}
                maxLength={40}
                disabled={blocked}
                onChange={(event) =>
                  update((current) => ({ ...current, author: event.target.value }))
                }
              />
            </label>
            <p>
              Office
              文件由本机文档服务编辑，保存后写回当前浏览器。清理网站数据会移除工作区，请定期导出备份。
            </p>
            <p>
              {data.files.length} / 100 个文件 ·{' '}
              {formatSize(data.files.reduce((sum, item) => sum + item.size, 0))} / 100 MB
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void exportWorkspace()}
            >
              导出工作区备份
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={blocked || busy || Boolean(editing)}
              onClick={() => backupInputRef.current?.click()}
            >
              导入工作区备份
            </Button>
          </div>
        </details>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        aria-label="导入本地文件"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void addFiles(files);
        }}
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json"
        hidden
        aria-label="导入工作区备份文件"
        onChange={(event) => {
          const backup = event.target.files?.[0];
          event.target.value = '';
          if (backup) void restoreBackup(backup);
        }}
      />
      {storageError && (
        <div className="collaboration-storage-error" role="alert">
          <p>{storageError}</p>
          <div>
            {status === 'conflict' ? (
              <Button size="sm" onClick={() => openDialog('reload')}>
                载入最新版本
              </Button>
            ) : (
              <Button size="sm" onClick={() => void workspaceStore.retry()}>
                重试保存
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void exportWorkspace()}
            >
              导出当前备份
            </Button>
          </div>
        </div>
      )}
      {actionError && (
        <div className="collaboration-storage-error" role="alert">
          <p>{actionError}</p>
          <Button size="sm" variant="outline" onClick={() => setActionError('')}>
            关闭提示
          </Button>
        </div>
      )}
      <section
        className="collaboration-workspace"
        aria-label="本地文件工作台"
        aria-busy={busy}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            event.dataTransfer.dropEffect = blocked || editing || busy ? 'none' : 'copy';
          }
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          void addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <header className="collaboration-workspace-bar">
          <div className="collaboration-project">
            <span className="collaboration-project-icon" aria-hidden="true">
              <FolderOpen />
            </span>
            <div>
              <strong>我的内容工作区</strong>
              <span>
                本机存储 <ChevronRight aria-hidden="true" /> 文件与讨论
              </span>
            </div>
          </div>
          <div className="collaboration-workspace-meta">
            <Button
              size="sm"
              variant="outline"
              iconStart={<Plus />}
              disabled={blocked || busy || Boolean(editing)}
              onClick={() => openDialog('create')}
            >
              新建文档
            </Button>
            <Button
              size="sm"
              variant="primary"
              iconStart={<FolderOpen />}
              disabled={blocked || busy || Boolean(editing)}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? '正在处理…' : '导入文件'}
            </Button>
            <span className="collaboration-permission">
              <Lock aria-hidden="true" />
              {blocked ? '只读模式' : '可编辑'}
            </span>
          </div>
        </header>
        <div className="collaboration-office-examples" role="group" aria-label="在线文档示例">
          <span>试用真实文件</span>
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || busy}
            onClick={() => void openSample('word')}
          >
            Word 示例
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || busy}
            onClick={() => void openSample('excel')}
          >
            Excel 示例
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || busy}
            onClick={() => void openSample('pdf')}
          >
            PDF 示例
          </Button>
          <span>也可导入自己的 DOCX、XLSX、PDF</span>
        </div>
        <div className="collaboration-file-panel">
          <div className="collaboration-files-heading">
            <span>工作区文件</span>
            <span>{data.files.length}</span>
          </div>
          <label className="collaboration-file-search">
            <Search aria-hidden="true" />
            <input
              aria-label="搜索工作区文件"
              type="search"
              placeholder="搜索文件…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <nav className="collaboration-files" aria-label="协作文件">
            {data.files
              .filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
              .map((item) => {
                const ItemIcon = ICONS[item.kind];
                return (
                  <button
                    type="button"
                    key={item.id}
                    title={item.name}
                    aria-current={fileId === item.id ? 'true' : undefined}
                    data-kind={item.kind}
                    disabled={
                      busy || status === 'conflict' || (Boolean(editing) && fileId !== item.id)
                    }
                    onClick={() => void selectFile(item.id)}
                  >
                    <span className="collaboration-file-type" aria-hidden="true">
                      <ItemIcon />
                    </span>
                    <span className="collaboration-file-info">
                      <strong>{item.name}</strong>
                      <small>
                        {fileType(item)} · {formatSize(item.size)}
                        {item.sample ? ' · 示例' : ''}
                      </small>
                    </span>
                    {hasDraft(item.id) && (
                      <span
                        className="collaboration-file-draft"
                        role="img"
                        aria-label="有未发送的草稿"
                        title="有未发送的草稿"
                      />
                    )}
                    {fileId === item.id && (
                      <span className="collaboration-file-selected" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
          </nav>
          {search &&
            !data.files.some((item) =>
              item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
            ) && <p className="collaboration-search-empty">没有匹配的文件</p>}
          {file?.kind === 'text' && previewState === 'ready' && (
            <nav className="collaboration-outline" aria-label="文档大纲">
              <p>本文目录</p>
              {file.blocks.map((block, index) => {
                const anchor = block.id;
                return (
                  <button
                    key={anchor}
                    type="button"
                    aria-current={activeAnchor === anchor ? 'location' : undefined}
                    onClick={() => locate(anchor)}
                  >
                    <span aria-hidden="true">0{index + 1}</span>
                    {titleFor(anchor)}
                    {forFile.some((thread) => thread.anchor === anchor && !thread.resolved) && (
                      <MessageSquare aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}
          <div className="collaboration-file-panel-note">
            <Lock aria-hidden="true" />
            <p>
              支持拖入文件
              <span>
                DOCX · XLSX · PDF · 文本与图片
                <br />
                文本 1 MB · 其他文件 20 MB
                <br />
                刷新后继续，备份可迁移到其他浏览器。
              </span>
            </p>
          </div>
        </div>
        <div className="collaboration-preview">
          {file && (
            <div className="collaboration-toolbar">
              <div className="collaboration-current-file">
                <FileIcon aria-hidden="true" />
                <div>
                  <strong>{file.name}</strong>
                  <span>{`版本 v1.${file.revision} · ${file.kind === 'text' ? '纯文本' : fileType(file)} · ${formatSize(file.size)}`}</span>
                </div>
              </div>
              <div className="collaboration-toolbar-actions">
                {file.kind === 'text' && !editing && (
                  <Button
                    ref={editTriggerRef}
                    size="sm"
                    variant="outline"
                    iconStart={<Edit />}
                    disabled={blocked || previewState !== 'ready'}
                    onClick={() => startEditing(editorDraft?.blockId ?? file.blocks[0].id)}
                  >
                    {editorDraft ? '继续编辑草稿' : '编辑文本'}
                  </Button>
                )}
                {editing && (
                  <Tag color="warning">{draft !== editingBlock?.body ? '草稿' : '编辑中'}</Tag>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  iconStart={<Download />}
                  onClick={() => void downloadFile(file)}
                >
                  {data.officeDrafts?.[fileId] ? '下载已保存版本' : '下载文件'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="重命名文件"
                  disabled={blocked || Boolean(editing)}
                  onClick={() => openDialog('rename')}
                >
                  <Edit aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="删除文件"
                  disabled={blocked || busy || Boolean(editing)}
                  onClick={() => openDialog('delete')}
                >
                  <Trash aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
          <div className="collaboration-canvas">
            {!file ? (
              <div className="collaboration-placeholder">
                <FolderOpen aria-hidden="true" />
                <strong>开始你的第一份内容</strong>
                <p>新建文档，或导入文本、图片、PDF 与其他附件。也可以直接拖入文件。</p>
                <Button disabled={blocked || busy} onClick={() => fileInputRef.current?.click()}>
                  选择本地文件
                </Button>
              </div>
            ) : previewState === 'loading' && !preview.url ? (
              <div className="collaboration-placeholder" role="status" aria-label="文件预览加载中">
                <Skeleton />
                <Skeleton />
                <p>正在读取文件…</p>
              </div>
            ) : previewState === 'error' ? (
              <div className="collaboration-placeholder" role="alert">
                <FileText aria-hidden="true" />
                <strong>文件暂时无法预览</strong>
                <p>{preview.error || '请重试，或下载文件后在本机打开。'}</p>
                <Button onClick={() => setPreviewAttempt((value) => value + 1)}>重试预览</Button>
                <Button variant="outline" onClick={() => void downloadFile(file)}>
                  下载原文件
                </Button>
              </div>
            ) : file.kind === 'image' ? (
              <figure className="collaboration-figure">
                {previewState === 'loading' && (
                  <p role="status" aria-label="文件预览加载中">
                    正在解码图片…
                  </p>
                )}
                <img
                  src={preview.url}
                  alt={`${file.name} 预览`}
                  onLoad={() => setPreview((current) => ({ ...current, state: 'ready' }))}
                  onError={() =>
                    setPreview((current) => ({
                      ...current,
                      state: 'error',
                      error: '图片内容无法解码，请检查文件格式或下载原文件。',
                    }))
                  }
                />
                <figcaption>
                  <ImageIcon aria-hidden="true" />
                  {file.name} · {formatSize(file.size)}
                </figcaption>
              </figure>
            ) : ['word', 'excel', 'pdf'].includes(file.kind) ? (
              <Suspense fallback={<p role="status">正在打开文档编辑器…</p>}>
                <OfficeWorkbench
                  key={file.id}
                  file={file}
                  draft={data.officeDrafts?.[fileId]}
                  disabled={blocked}
                />
              </Suspense>
            ) : file.kind === 'binary' ? (
              <div className="collaboration-placeholder">
                <span className="collaboration-unsupported" aria-hidden="true">
                  <Archive />
                </span>
                <strong>此文件类型暂不支持预览</strong>
                <p>附件已保存在本地，可以下载后使用对应软件打开，也可以在右侧留下文件评论。</p>
                <Button iconStart={<Download />} onClick={() => void downloadFile(file)}>
                  下载附件
                </Button>
              </div>
            ) : (
              <article className="collaboration-document" aria-label={`${file.name}正文`}>
                <div className="collaboration-document-meta">
                  <span className="collaboration-document-kicker">CONTENT / LOCAL</span>
                  <span>{status === 'saved' ? '本机正文' : '当前正文'}</span>
                </div>
                <h2>{file.id === 'brief' ? '一起，把想法变成作品。' : file.name}</h2>
                <p className="collaboration-document-subtitle">
                  {file.blocks.length} 个章节 · v1.{file.revision}
                </p>
                {file.blocks.map((block, index) => {
                  const anchor = block.id;
                  return (
                    <section
                      key={anchor}
                      ref={(element) => {
                        sectionRefs.current[anchor] = element;
                      }}
                      tabIndex={-1}
                      data-active={activeAnchor === anchor || undefined}
                      data-editing={editing === anchor || undefined}
                      aria-labelledby={`${instanceId}-${anchor}`}
                    >
                      <div className="collaboration-section-heading">
                        <h3 id={`${instanceId}-${anchor}`}>
                          <span>0{index + 1}</span>
                          {titleFor(anchor)}
                        </h3>
                        {!editing && (
                          <div className="collaboration-section-actions">
                            <button
                              type="button"
                              disabled={blocked}
                              aria-label={`编辑${titleFor(anchor)}`}
                              onClick={() => startEditing(anchor)}
                            >
                              <Edit aria-hidden="true" />
                              编辑
                            </button>
                            <button
                              type="button"
                              disabled={blocked}
                              aria-label={`针对${titleFor(anchor)}讨论`}
                              onClick={() => {
                                setActiveAnchor(anchor);
                                setCommentTarget(anchor);
                                composerRef.current?.focus();
                              }}
                            >
                              <MessageSquare aria-hidden="true" />
                              讨论
                            </button>
                            <span className="collaboration-section-count" aria-hidden="true">
                              {forFile.filter(
                                (thread) => thread.anchor === anchor && !thread.resolved
                              ).length || null}
                            </span>
                          </div>
                        )}
                      </div>
                      {editing === anchor ? (
                        <div className="collaboration-editor">
                          <label htmlFor={`${instanceId}-editor`}>
                            <Edit aria-hidden="true" />
                            编辑{titleFor(anchor)}
                          </label>
                          <textarea
                            autoFocus
                            id={`${instanceId}-editor`}
                            aria-describedby={`${instanceId}-editor-help`}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (
                                (event.metaKey || event.ctrlKey) &&
                                event.key === 'Enter' &&
                                !event.nativeEvent.isComposing
                              ) {
                                event.preventDefault();
                                save();
                              }
                            }}
                          />
                          <div className="collaboration-editor-meta">
                            <span>{draft.length} 字符</span>
                            <span>⌘ / Ctrl Enter 保存</span>
                          </div>
                          <div className="collaboration-editor-actions">
                            <Button size="sm" variant="primary" disabled={blocked} onClick={save}>
                              保存修改
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing}>
                              取消编辑
                            </Button>
                          </div>
                          <p id={`${instanceId}-editor-help`}>
                            草稿自动保存在本机；保存修改后更新正文。也可暂存草稿后切换文件。
                          </p>
                          <div className="collaboration-editor-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(null);
                                setFeedback('草稿已暂存，切换回来可继续编辑。');
                              }}
                            >
                              暂存并退出
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                downloadBlob(
                                  new Blob([draft], { type: 'text/plain;charset=utf-8' }),
                                  `${file.name}.draft.txt`
                                )
                              }
                            >
                              下载草稿
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="collaboration-block-body">{block.body || '（空文档）'}</p>
                      )}
                    </section>
                  );
                })}
                <footer className="collaboration-document-footer">
                  <span>共 {file.blocks.length} 个章节</span>
                  <span>
                    {editing ? `正在编辑${titleFor(editing)}` : '本地文档 · v1.' + file.revision}
                  </span>
                </footer>
              </article>
            )}
          </div>
          {file && (
            <div className="collaboration-preview-footer">
              <span>
                <FileIcon aria-hidden="true" />
                {fileType(file)} 预览
              </span>
              <span>
                {editing
                  ? '正在编辑草稿'
                  : previewState === 'ready'
                    ? '本机文件'
                    : previewState === 'loading'
                      ? '正在加载'
                      : '等待重试'}
              </span>
            </div>
          )}
        </div>
        <aside className="collaboration-comments" aria-label="文件讨论">
          <header className="collaboration-discussion-header">
            <div className="collaboration-comments-heading">
              <MessageSquare aria-hidden="true" />
              <h2>
                讨论 <span>{unresolved}</span>
              </h2>
              <span>未解决</span>
            </div>
            <p>让每个建议，都能找到上下文。</p>
            <div className="collaboration-filter" role="group" aria-label="筛选讨论">
              <button
                ref={openFilterRef}
                type="button"
                aria-pressed={filter === 'open'}
                onClick={() => setFilter('open')}
              >
                未解决
              </button>
              <button
                type="button"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                全部 {forFile.length}
              </button>
            </div>
          </header>
          <div className="collaboration-threads">
            {visibleThreads.length === 0 && (
              <div className="collaboration-empty">
                <span aria-hidden="true">
                  <MessageSquare />
                </span>
                <strong>{forFile.length ? '所有讨论都已解决' : '还没有讨论'}</strong>
                <p>
                  {forFile.length
                    ? '切换到全部，可以回顾每一次交流。'
                    : '写下第一条建议，让想法在这里相遇。'}
                </p>
              </div>
            )}
            {visibleThreads.map((thread) => (
              <article
                key={thread.id}
                className="collaboration-thread"
                aria-label={`${thread.author}的讨论`}
                data-active={
                  (thread.anchor !== null && activeAnchor === thread.anchor) ||
                  replyTo === thread.id ||
                  undefined
                }
                data-resolved={thread.resolved || undefined}
              >
                <div className="collaboration-author">
                  <span className="collaboration-avatar" aria-hidden="true">
                    {thread.author.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{thread.author}</strong>
                    <small>{thread.anchor ? titleFor(thread.anchor) : '文件讨论'}</small>
                  </div>
                  {thread.resolved && (
                    <span className="collaboration-resolved">
                      <Check aria-hidden="true" />
                      已解决
                    </span>
                  )}
                </div>
                {thread.quoteRevision !== null && (
                  <div className="collaboration-quote-meta">
                    <span>引用 v1.{thread.quoteRevision}</span>
                    {thread.anchor && thread.quote !== bodyFor(thread.anchor) && (
                      <span className="collaboration-quote-updated">内容已更新</span>
                    )}
                  </div>
                )}
                {thread.anchor ? (
                  <button
                    type="button"
                    className="collaboration-quote"
                    aria-label={`定位到${titleFor(thread.anchor)}：${thread.quote}`}
                    disabled={previewState !== 'ready' || bodyFor(thread.anchor) === undefined}
                    onClick={() => locate(thread.anchor!)}
                  >
                    <span>{thread.quote}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </button>
                ) : (
                  <blockquote className="collaboration-quote">{thread.quote}</blockquote>
                )}
                {thread.anchor &&
                  (previewState !== 'ready' || bodyFor(thread.anchor) === undefined) && (
                    <small className="collaboration-quote-note">
                      {bodyFor(thread.anchor) === undefined
                        ? '原段落已不存在，引用与讨论仍保留。'
                        : '恢复预览后可定位到正文。'}
                    </small>
                  )}
                {thread.anchor && thread.quote !== bodyFor(thread.anchor) && (
                  <small className="collaboration-quote-note">
                    引用保留原文，定位将前往当前段落。
                  </small>
                )}
                <p>{thread.body}</p>
                <time dateTime={thread.createdAt}>
                  {new Date(thread.createdAt).toLocaleString()}
                </time>
                {thread.replies.map((reply) => (
                  <div className="collaboration-reply" key={reply.id}>
                    <strong>{reply.author}</strong>
                    <p>{reply.body}</p>
                    <time dateTime={reply.createdAt}>
                      {new Date(reply.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
                <div className="collaboration-thread-actions">
                  <button
                    type="button"
                    disabled={blocked || thread.resolved}
                    onClick={() => {
                      setCommentTarget(null, thread.id);
                      composerRef.current?.focus();
                    }}
                  >
                    <MessageSquare aria-hidden="true" />
                    回复
                  </button>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (filter === 'open' && !thread.resolved) restoreFilterFocus.current = true;
                      update((current) => ({
                        ...current,
                        threads: current.threads.map((item) =>
                          item.id === thread.id ? { ...item, resolved: !item.resolved } : item
                        ),
                      }));
                      if (replyTo === thread.id) {
                        setCommentTarget(null);
                      }
                      setFeedback(
                        thread.resolved ? '讨论已重新打开。' : '讨论已解决，可在全部讨论中查看。'
                      );
                    }}
                  >
                    <CheckCircle aria-hidden="true" />
                    {thread.resolved ? '重新打开' : '解决讨论'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <form
            className="collaboration-composer"
            data-has-draft={Boolean(comment.trim()) || undefined}
            onSubmit={(event) => {
              event.preventDefault();
              sendComment();
            }}
          >
            {(replyTo || commentAnchor) && (
              <div className="collaboration-composer-context">
                <div className="collaboration-composer-context-heading">
                  <MessageSquare aria-hidden="true" />
                  <span>
                    {replyTo
                      ? `正在回复${selectedThread?.author}`
                      : `关联段落 · ${titleFor(commentAnchor!)}`}
                  </span>
                  <button
                    type="button"
                    aria-label={replyTo ? '取消回复' : '取消定位'}
                    onClick={() => {
                      setCommentTarget(null);
                      composerRef.current?.focus();
                    }}
                  >
                    <Close aria-hidden="true" />
                  </button>
                </div>
                <blockquote>{composerQuote}</blockquote>
              </div>
            )}
            <div className="collaboration-composer-label">
              <label htmlFor={`${instanceId}-comment`}>
                {replyTo
                  ? `回复${selectedThread?.author}`
                  : commentAnchor
                    ? `评论：${titleFor(commentAnchor)}`
                    : '评论当前文件'}
              </label>
              {comment.trim() && (
                <span>
                  <Edit aria-hidden="true" />
                  本地草稿
                </span>
              )}
            </div>
            <textarea
              id={`${instanceId}-comment`}
              ref={composerRef}
              placeholder={
                blocked ? '只读模式下无法评论' : file ? '写下你的建议…' : '先新建或导入一份文件'
              }
              disabled={blocked || !file}
              maxLength={2000}
              aria-describedby={`${instanceId}-comment-help`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key === 'Enter' &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  sendComment();
                }
              }}
            />
            <div className="collaboration-composer-actions">
              <small>{comment.length} / 2000</small>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                iconStart={<Send />}
                disabled={blocked || !file || !comment.trim()}
              >
                发送{replyTo ? '回复' : '评论'}
              </Button>
            </div>
            <p className="collaboration-composer-help" id={`${instanceId}-comment-help`}>
              {blocked
                ? '只读模式 · 草稿仍保存在本机'
                : '⌘ / Ctrl Enter 发送 · 切换文件或回复保留草稿'}
            </p>
          </form>
        </aside>
      </section>
      <p className="collaboration-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
      <p className="collaboration-local-help">
        导入文件会创建本机副本。编辑后点击“下载文件”取得修改后的文件；工作区设置中可导出和恢复完整备份。
      </p>
      <div className="collaboration-reference">
        <h2 className="doc-h2">三个组件，一条协作流程</h2>
        <div className="collaboration-designs">
          <div>
            <span>01 / VIEW</span>
            <h3>FilePreview</h3>
            <p>
              统一文件信息、加载、失败与不支持状态。已接入
              Word、Excel、PDF、文本和图片预览；其他附件可下载。
            </p>
          </div>
          <div>
            <span>02 / EDIT</span>
            <h3>ContentEditor</h3>
            <p>
              Word、Excel、PDF 接入完整文档编辑器，管理保存回写、只读和版本冲突；文本支持段落草稿。
            </p>
          </div>
          <div>
            <span>03 / DISCUSS</span>
            <h3>CommentThread</h3>
            <p>围绕文件或稳定段落讨论，支持回复、解决、重新打开。将内容定位与消息传输交给应用。</p>
          </div>
        </div>
        <h2 className="doc-h2">设计中的 API</h2>
        <p className="doc-p">
          工作台支持本地持久保存、保存失败重试和工作区备份。以下通用组件接口仍为提案；当前不含多人共享和服务端权限。
        </p>
        <ApiTable
          rows={[
            {
              name: 'FilePreview.file',
              type: 'PreviewFile',
              description: '稳定 id、名称、MIME、版本及受信任的内容来源。',
            },
            {
              name: 'FilePreview.state',
              type: 'loading | ready | error',
              description: '显式异步状态；unknown MIME 走不支持分支。',
            },
            {
              name: 'FilePreview.renderers',
              type: 'PreviewRenderer[]',
              description: '按文件类型选择渲染器，内置文本和图片。',
            },
            {
              name: 'ContentEditor.value / onValueChange',
              type: 'string / (value: string) => void',
              description: '受控文本，独立于已持久化版本。',
            },
            {
              name: 'ContentEditor.onSave',
              type: '(draft, baseRevision) => Promise<void>',
              description: '调用方处理保存、错误和版本冲突。',
            },
            {
              name: 'CommentThread.thread',
              type: 'Thread',
              description: '评论、回复、状态，以及可选的段落 id 与版本。',
            },
            {
              name: 'CommentThread.onAction',
              type: '(action: ThreadAction) => Promise<void>',
              description: '调用方处理回复、解决与重新打开；失败保留草稿。',
            },
          ]}
        />
      </div>
      <Modal
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <Modal.Content size="sm" className="collaboration-dialog">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmDialog();
            }}
          >
            <Modal.Header>
              <Modal.Title>
                {dialog === 'create'
                  ? '新建文档'
                  : dialog === 'rename'
                    ? '重命名文件'
                    : dialog === 'reload'
                      ? '载入最新版本'
                      : '删除文件'}
              </Modal.Title>
              <Modal.Description>
                {dialog === 'delete'
                  ? `删除 ${file?.name} 及其讨论和草稿。此操作不能撤销，建议先导出备份。`
                  : dialog === 'reload'
                    ? '将放弃本页尚未保存的修改，载入其他标签页已保存的版本。请先导出当前备份。'
                    : '输入文件名称，文件将保存在当前浏览器的工作区。'}
              </Modal.Description>
            </Modal.Header>
            {(dialog === 'create' || dialog === 'rename') && (
              <Modal.Body>
                <label htmlFor={`${instanceId}-filename`}>文件名</label>
                <input
                  id={`${instanceId}-filename`}
                  data-autofocus
                  value={name}
                  maxLength={180}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? `${instanceId}-name-error` : undefined}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameError('');
                  }}
                />
                {nameError && (
                  <p id={`${instanceId}-name-error`} role="alert">
                    {nameError}
                  </p>
                )}
              </Modal.Body>
            )}
            {nameError && dialog !== 'create' && dialog !== 'rename' && (
              <Modal.Body>
                <p role="alert">{nameError}</p>
              </Modal.Body>
            )}
            <Modal.Footer>
              <Modal.Close
                data-autofocus={dialog === 'delete' || dialog === 'reload' ? '' : undefined}
                disabled={busy}
              >
                取消
              </Modal.Close>
              <Button type="submit" variant="primary" disabled={busy}>
                {dialog === 'delete' ? '确认删除' : dialog === 'reload' ? '确认载入' : '确定'}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Content>
      </Modal>
    </div>
  );
}
