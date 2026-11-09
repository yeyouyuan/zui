import { useEffect, useId, useRef, useState } from 'react';
import { Button, Skeleton, Tag } from '@zui/react';
import ApiTable from '../../components/ApiTable';
import { usePageTitle } from '../../components/usePageTitle';
import cover from '../../assets/demo-cover.svg';
import './collaboration.css';

type FileId = 'brief' | 'cover' | 'archive';
type PreviewState = 'ready' | 'loading' | 'error';
type AnchorId = 'summary' | 'goals' | 'delivery';
interface Discussion {
  id: string;
  file: FileId;
  anchor: AnchorId | null;
  quote: string;
  author: string;
  body: string;
  resolved: boolean;
  replies: string[];
}
const FILES: Array<{ id: FileId; name: string; type: string }> = [
  { id: 'brief', name: '项目方案.txt', type: 'TXT' },
  { id: 'cover', name: '封面设计.svg', type: 'SVG' },
  { id: 'archive', name: '项目归档.zip', type: 'ZIP' },
];
const TITLES: Record<AnchorId, string> = {
  summary: '项目概述',
  goals: '项目目标',
  delivery: '交付范围',
};
const INITIAL_SUMMARY =
  '让文件、修改与讨论留在同一个工作空间。团队可以直接阅读方案、调整内容，并针对具体段落留下建议。';
const INITIAL_THREADS: Discussion[] = [
  {
    id: 'scope',
    file: 'brief',
    anchor: 'goals',
    quote: '桌面与移动端都能清晰阅读、顺畅操作。',
    author: '林岸',
    body: '移动端也需要验证编辑和评论的完整流程。',
    resolved: false,
    replies: [],
  },
  {
    id: 'formats',
    file: 'brief',
    anchor: 'delivery',
    quote: '第一阶段覆盖文本与图片。',
    author: '周予',
    body: '其他文件类型先提供明确的说明，预览适配器后续接入。',
    resolved: true,
    replies: ['已补充到交付范围。'],
  },
];

/** 设计验证原型：数据只存在本页内存中，尚未作为 @zui/react 的正式导出。 */
export default function CollaborationPage(): React.ReactNode {
  usePageTitle('内容协作实验室');
  const instanceId = useId();
  const [fileId, setFileId] = useState<FileId>('brief');
  const [previewState, setPreviewState] = useState<PreviewState>('ready');
  const [readOnly, setReadOnly] = useState(false);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [draft, setDraft] = useState(INITIAL_SUMMARY);
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(2);
  const [activeAnchor, setActiveAnchor] = useState<AnchorId | null>(null);
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('可切换文件，或针对段落发起讨论。');
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (wasEditingRef.current && !editing) editTriggerRef.current?.focus();
    wasEditingRef.current = editing;
  }, [editing]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sectionRefs = useRef<Partial<Record<AnchorId, HTMLElement | null>>>({});
  const file = FILES.find((item) => item.id === fileId)!;
  const forFile = threads.filter((thread) => thread.file === fileId);
  const visibleThreads = forFile.filter((thread) => filter === 'all' || !thread.resolved);
  const unresolved = forFile.filter((thread) => !thread.resolved).length;
  const selectedThread = threads.find((thread) => thread.id === replyTo);
  const bodies: Record<AnchorId, string> = {
    summary,
    goals: '桌面与移动端都能清晰阅读、顺畅操作。\n把反馈关联到具体内容，让每一次修改都有上下文。',
    delivery: '第一阶段覆盖文本与图片。\n内置纯文本编辑与段落评论，预留文件渲染适配器。',
  };
  const selectFile = (next: FileId) => {
    setFileId(next);
    setPreviewState('ready');
    setActiveAnchor(null);
    setComment('');
    setReplyTo(null);
    setFeedback(`已打开 ${FILES.find((item) => item.id === next)!.name}`);
  };
  const save = () => {
    setSummary(draft);
    if (draft !== summary) setRevision((value) => value + 1);
    setEditing(false);
    setFeedback('文本已保存在本页演示中。刷新页面会重置。');
  };
  const locate = (anchor: AnchorId) => {
    setActiveAnchor(anchor);
    const section = sectionRefs.current[anchor];
    section?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'center',
    });
    section?.focus({ preventScroll: true });
    setFeedback(`已定位到${TITLES[anchor]}`);
  };
  const submitComment = (event: React.FormEvent) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text || readOnly) return;
    if (replyTo) {
      setThreads((items) =>
        items.map((thread) =>
          thread.id === replyTo ? { ...thread, replies: [...thread.replies, text] } : thread
        )
      );
    } else {
      setThreads((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          file: fileId,
          anchor: activeAnchor,
          quote: activeAnchor ? bodies[activeAnchor].split('\n')[0] : file.name,
          author: '你',
          body: text,
          resolved: false,
          replies: [],
        },
      ]);
    }
    setComment('');
    setReplyTo(null);
    setFeedback('评论已添加到当前文件。');
  };

  return (
    <div className="doc-page collaboration-page">
      <div className="collaboration-eyebrow">
        NEXT / CONTENT COLLABORATION <Tag>设计原型</Tag>
      </div>
      <h1 className="doc-h1">内容协作实验室</h1>
      <p className="doc-lead">
        让每一次修改都有上下文。围绕同一份内容，连接文件预览、轻量编辑与团队讨论。
      </p>
      <p className="doc-note">
        这是三项新组件的交互设计验证，数据仅保留在本页内存中。当前源码仍为 71 个正式组件。
      </p>
      <h2 className="doc-h2">交互工作台</h2>
      <div className="collaboration-controls">
        <label>
          访问权限
          <select
            aria-label="访问权限"
            value={readOnly ? 'read' : 'edit'}
            onChange={(event) => {
              const next = event.target.value === 'read';
              setReadOnly(next);
              if (next) {
                setEditing(false);
                setDraft(summary);
                setReplyTo(null);
                setComment('');
              }
              setFeedback(next ? '已进入只读模式。' : '已恢复编辑权限。');
            }}
          >
            <option value="edit">可编辑</option>
            <option value="read">只读</option>
          </select>
        </label>
        <label>
          预览状态（演示）
          <select
            aria-label="预览状态（演示）"
            disabled={editing}
            value={previewState}
            onChange={(event) => setPreviewState(event.target.value as PreviewState)}
          >
            <option value="ready">正常</option>
            <option value="loading">加载中</option>
            <option value="error">加载失败</option>
          </select>
        </label>
      </div>
      <section className="collaboration-workspace" aria-label="内容协作原型">
        <nav className="collaboration-files" aria-label="协作文件">
          {FILES.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={fileId === item.id ? 'true' : undefined}
              disabled={editing && fileId !== item.id}
              onClick={() => selectFile(item.id)}
            >
              <span className="collaboration-file-type" aria-hidden="true">
                {item.type}
              </span>
              {item.name}
            </button>
          ))}
        </nav>
        <div className="collaboration-preview">
          <div className="collaboration-toolbar">
            <div>
              <strong>{file.name}</strong>
              <span>{fileId === 'brief' ? `版本 v1.${revision} · 纯文本` : '本地示例资源'}</span>
            </div>
            {fileId === 'brief' && !editing && (
              <Button
                ref={editTriggerRef}
                size="sm"
                disabled={readOnly || previewState !== 'ready'}
                onClick={() => {
                  setDraft(summary);
                  setEditing(true);
                }}
              >
                编辑文本
              </Button>
            )}
            {editing && <Tag color="warning">{draft !== summary ? '未保存' : '编辑中'}</Tag>}
          </div>
          {previewState === 'loading' ? (
            <div className="collaboration-placeholder" role="status" aria-label="文件预览加载中">
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <p>正在准备文件预览…</p>
            </div>
          ) : previewState === 'error' ? (
            <div className="collaboration-placeholder" role="alert">
              <strong>文件暂时无法预览</strong>
              <p>请重试，或切换到其他文件。</p>
              <Button onClick={() => setPreviewState('ready')}>重试预览</Button>
            </div>
          ) : fileId === 'cover' ? (
            <figure className="collaboration-figure">
              <img src={cover} alt="封面设计：蓝色几何图形与抽象山峦" />
              <figcaption>图片适配器 · 使用本地资源</figcaption>
            </figure>
          ) : fileId === 'archive' ? (
            <div className="collaboration-placeholder">
              <span className="collaboration-unsupported" aria-hidden="true">
                ZIP
              </span>
              <strong>此文件类型暂不支持预览</strong>
              <p>正式组件将由调用方提供下载地址或自定义渲染器。此处没有可下载的压缩包。</p>
            </div>
          ) : (
            <article className="collaboration-document" aria-label="项目方案正文">
              <span className="collaboration-document-kicker">PROJECT BRIEF / 2026</span>
              <h2>一起，把想法变成作品。</h2>
              <p className="collaboration-document-subtitle">内容协作体验 · 第一阶段</p>
              {(Object.keys(TITLES) as AnchorId[]).map((anchor, index) => (
                <section
                  key={anchor}
                  ref={(element) => {
                    sectionRefs.current[anchor] = element;
                  }}
                  tabIndex={-1}
                  data-active={activeAnchor === anchor || undefined}
                  aria-labelledby={`${instanceId}-${anchor}`}
                >
                  <div className="collaboration-section-heading">
                    <h3 id={`${instanceId}-${anchor}`}>
                      <span>0{index + 1}</span>
                      {TITLES[anchor]}
                    </h3>
                    {!editing && (
                      <button
                        type="button"
                        disabled={readOnly}
                        aria-label={`针对${TITLES[anchor]}讨论`}
                        onClick={() => {
                          setActiveAnchor(anchor);
                          setReplyTo(null);
                          composerRef.current?.focus();
                        }}
                      >
                        讨论 ↗
                      </button>
                    )}
                  </div>
                  {editing && anchor === 'summary' ? (
                    <div className="collaboration-editor">
                      <label htmlFor={`${instanceId}-editor`}>编辑项目概述</label>
                      <textarea
                        autoFocus
                        id={`${instanceId}-editor`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === 'Enter' &&
                            !event.nativeEvent.isComposing &&
                            draft.trim()
                          ) {
                            event.preventDefault();
                            save();
                          }
                        }}
                      />
                      <p>{draft.length} 字符 · ⌘ / Ctrl Enter 保存</p>
                      <div className="collaboration-editor-actions">
                        <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={save}>
                          保存修改
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setDraft(summary);
                            setEditing(false);
                          }}
                        >
                          取消编辑
                        </Button>
                      </div>
                      <p>编辑期间请先保存或取消，再切换文件。</p>
                    </div>
                  ) : (
                    bodies[anchor]
                      .split('\n')
                      .map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)
                  )}
                </section>
              ))}
            </article>
          )}
        </div>
        <aside className="collaboration-comments" aria-label="文件讨论">
          <div className="collaboration-comments-heading">
            <h2>
              讨论 <span>{unresolved}</span>
            </h2>
            <span>未解决</span>
          </div>
          <div className="collaboration-filter" role="group" aria-label="筛选讨论">
            <button
              type="button"
              aria-pressed={filter === 'open'}
              onClick={() => setFilter('open')}
            >
              未解决
            </button>
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              全部 {forFile.length}
            </button>
          </div>
          <div className="collaboration-threads">
            {visibleThreads.length === 0 && (
              <p className="collaboration-empty">
                {forFile.length ? '所有讨论都已解决。' : '还没有讨论，留下第一条建议。'}
              </p>
            )}
            {visibleThreads.map((thread) => (
              <article
                key={thread.id}
                className="collaboration-thread"
                aria-label={`${thread.author}的讨论`}
              >
                <div className="collaboration-author">
                  <span className="collaboration-avatar" aria-hidden="true">
                    {thread.author.slice(0, 1)}
                  </span>
                  <strong>{thread.author}</strong>
                  {thread.resolved && <span>已解决</span>}
                </div>
                {thread.anchor ? (
                  <button
                    type="button"
                    className="collaboration-quote"
                    aria-label={`定位到${TITLES[thread.anchor]}：${thread.quote}`}
                    onClick={() => locate(thread.anchor!)}
                  >
                    {thread.quote}
                  </button>
                ) : (
                  <blockquote className="collaboration-quote">{thread.quote}</blockquote>
                )}
                <p>{thread.body}</p>
                {thread.replies.map((reply, index) => (
                  <div className="collaboration-reply" key={index}>
                    <strong>你</strong>
                    <p>{reply}</p>
                  </div>
                ))}
                <div className="collaboration-thread-actions">
                  <button
                    type="button"
                    disabled={readOnly || thread.resolved}
                    onClick={() => {
                      setReplyTo(thread.id);
                      setComment('');
                      composerRef.current?.focus();
                    }}
                  >
                    回复
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setThreads((items) =>
                        items.map((item) =>
                          item.id === thread.id ? { ...item, resolved: !item.resolved } : item
                        )
                      );
                      if (replyTo === thread.id) {
                        setReplyTo(null);
                        setComment('');
                      }
                      setFeedback(
                        thread.resolved ? '讨论已重新打开。' : '讨论已解决，可在全部讨论中查看。'
                      );
                    }}
                  >
                    {thread.resolved ? '重新打开' : '解决讨论'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <form className="collaboration-composer" onSubmit={submitComment}>
            <label htmlFor={`${instanceId}-comment`}>
              {replyTo
                ? `回复${selectedThread?.author}`
                : activeAnchor
                  ? `评论：${TITLES[activeAnchor]}`
                  : '评论当前文件'}
            </label>
            <textarea
              id={`${instanceId}-comment`}
              ref={composerRef}
              placeholder={readOnly ? '只读模式下无法评论' : '写下你的建议…'}
              disabled={readOnly}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="collaboration-composer-actions">
              <small>{comment.length} / 2000</small>
              {(replyTo || activeAnchor) && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setActiveAnchor(null);
                  }}
                >
                  取消定位
                </button>
              )}
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={readOnly || !comment.trim()}
              >
                发送{replyTo ? '回复' : '评论'}
              </Button>
            </div>
          </form>
        </aside>
      </section>
      <p className="collaboration-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
      <h2 className="doc-h2">三个组件，一条协作流程</h2>
      <div className="collaboration-designs">
        <div>
          <span>01 / VIEW</span>
          <h3>FilePreview</h3>
          <p>统一文件信息、加载、失败与不支持状态。文本、图片和未来的 PDF 通过渲染适配器接入。</p>
        </div>
        <div>
          <span>02 / EDIT</span>
          <h3>ContentEditor</h3>
          <p>
            先聚焦纯文本与明确的保存操作，管理草稿、只读、保存中和冲突。为成熟编辑器保留接入边界。
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
        以下接口为提案，尚未发布；保存错误、版本冲突与持久化将在正式实现阶段接入。
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
  );
}
