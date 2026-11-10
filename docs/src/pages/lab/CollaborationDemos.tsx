import { useRef, useState } from 'react';
import { Modal, Button } from '@zui/react';
import { Archive, ArrowLeft, ArrowRight, FileText, Folder, Layers, Search } from '@zui/icons';
import cover from '../../assets/demo-cover.svg';
import { Choices, LabCard, Notice } from './shared';

const FILES = [
  {
    id: 'spec',
    name: '交互规范.md',
    type: '文档',
    meta: '林悦 · 12 KB',
    content:
      '# 交互规范\n\n1. 为每个状态提供清晰反馈。\n2. 所有操作支持键盘。\n3. 让布局适应内容和屏幕。',
  },
  { id: 'cover', name: '品牌封面.svg', type: '设计', meta: '陈晨 · 4 KB', content: '' },
  {
    id: 'plan',
    name: '迭代计划.csv',
    type: '数据',
    meta: '周宁 · 2 KB',
    content: '任务,负责人,状态\n文档更新,林悦,进行中\n主题验收,陈晨,待开始\n组件测试,周宁,已完成',
  },
  {
    id: 'tokens',
    name: '主题配置.json',
    type: '数据',
    meta: '陈晨 · 1 KB',
    content: '{\n  "accent": "jade",\n  "radius": 16,\n  "density": "comfortable"\n}',
  },
] as const;
type DemoFile = (typeof FILES)[number];

export function FileWorkbench() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('全部');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState<string[]>([]);
  const [archived, setArchived] = useState<string[]>([]);
  const [preview, setPreview] = useState<DemoFile | null>(null);
  const [message, setMessage] = useState('选择文件可批量归档，点击名称可预览。');
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const archiveRef = useRef<HTMLButtonElement>(null);
  const visible = FILES.filter(
    (file) =>
      !archived.includes(file.id) &&
      (type === '全部' || type === file.type) &&
      file.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  if (sort === 'name') visible.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return (
    <LabCard
      number="03"
      name="FileWorkbench"
      title="文件，各就各位"
      description="将查找、选择和预览连成一条顺手的文件协作路径。"
      category="collaboration"
      icon={Folder}
      features={['搜索与分类', '批量归档 / 撤销', '模态预览']}
    >
      <div className="lab-toolbar">
        <label className="lab-search">
          <Search aria-hidden="true" />
          <input
            aria-label="搜索文件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="查找工作空间文件…"
          />
        </label>
        <select
          aria-label="文件排序"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="default">最近更新</option>
          <option value="name">名称排序</option>
        </select>
      </div>
      <div className="lab-toolbar lab-toolbar-spaced">
        <Choices
          label="文件类型"
          value={type}
          items={['全部', '文档', '设计', '数据'].map((value) => ({ value, label: value }))}
          onChange={setType}
        />
        <Choices
          label="文件视图"
          value={view}
          items={[
            { value: 'grid', label: '网格' },
            { value: 'list', label: '列表' },
          ]}
          onChange={setView}
        />
      </div>
      <div className="lab-files" data-view={view}>
        {visible.map((file) => (
          <div key={file.id} className="lab-file" data-selected={selected.includes(file.id)}>
            <label className="lab-file-check">
              <input
                type="checkbox"
                aria-label={`选择 ${file.name}`}
                checked={selected.includes(file.id)}
                onChange={(event) =>
                  setSelected((ids) =>
                    event.target.checked ? [...ids, file.id] : ids.filter((id) => id !== file.id)
                  )
                }
              />
            </label>
            <div className="lab-file-art" data-kind={file.type} aria-hidden="true">
              {file.id === 'cover' ? (
                <img src={cover} alt="" />
              ) : (
                <>
                  <FileText />
                  <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                </>
              )}
            </div>
            <div className="lab-file-info">
              <button
                type="button"
                onClick={(event) => {
                  returnFocusRef.current = event.currentTarget;
                  setPreview(file);
                }}
              >
                {file.name}
              </button>
              <span>{file.meta}</span>
            </div>
          </div>
        ))}
      </div>
      {!visible.length && <p className="lab-empty">没有找到文件，请调整搜索或撤销归档。</p>}
      <div className="lab-toolbar lab-file-actions">
        <span className="lab-muted lab-small">
          已选 {selected.length} 项 · 当前 {visible.length} 项
        </span>
        <div className="lab-inline-actions">
          <button
            ref={archiveRef}
            type="button"
            className="lab-text-button"
            disabled={!selected.length}
            onClick={() => {
              setArchived((ids) => [...new Set([...ids, ...selected])]);
              setMessage(`已归档 ${selected.length} 个文件，可撤销恢复。`);
              setSelected([]);
            }}
          >
            <Archive />
            归档所选
          </button>
          {archived.length > 0 && (
            <button
              type="button"
              className="lab-text-button"
              onClick={() => {
                setArchived([]);
                setMessage('已恢复归档文件。');
                archiveRef.current?.focus();
              }}
            >
              撤销归档
            </button>
          )}
        </div>
      </div>
      <Notice>{message}</Notice>
      <Modal
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <Modal.Content size="lg" returnFocusRef={returnFocusRef} className="lab-preview-dialog">
          <Modal.Header>
            <Modal.Title>{preview?.name}</Modal.Title>
            <Modal.Description>演示文件预览 · {preview?.meta}</Modal.Description>
          </Modal.Header>
          <Modal.Body>
            {preview?.id === 'cover' ? (
              <img className="lab-preview-image" src={cover} alt="山间湖泊品牌封面" />
            ) : (
              <pre className="lab-preview-code">{preview?.content}</pre>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={() => setPreview(null)}>
              关闭预览
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </LabCard>
  );
}

const DIFF = [
  { old: '# 文件协作规范', next: '# 文件协作规范', label: '标题' },
  { old: '预览支持图片与文本。', next: '预览支持图片、文本与表格。', label: '预览类型' },
  { old: '团队成员可以查看文件。', next: '团队成员可以查看文件。', label: '查看权限' },
  { old: '评论提交后立即覆盖。', next: '评论保留编辑记录，并支持撤销。', label: '评论规则' },
  { old: '最后更新：2026-11-06', next: '最后更新：2026-11-09', label: '更新时间' },
] as const;
const CHANGES = DIFF.map((line, index) => (line.old !== line.next ? index : -1)).filter(
  (index) => index >= 0
);

export function DiffViewer() {
  const [mode, setMode] = useState<'split' | 'inline'>('split');
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [active, setActive] = useState(0);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const move = (direction: number) => {
    const next = (active + direction + CHANGES.length) % CHANGES.length;
    setActive(next);
    lineRefs.current[CHANGES[next]]?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
  return (
    <LabCard
      number="04"
      name="DiffViewer"
      title="变化，有迹可循"
      description="在并排与行内视图之间切换，逐项确认版本里的关键修改。"
      category="collaboration"
      icon={Layers}
      features={['双栏 / 行内', '语义差异', '修改定位']}
    >
      <div className="lab-toolbar">
        <div>
          <span className="lab-overline">协作规范.md</span>
          <p className="lab-small lab-muted">v1.2 → v1.3</p>
        </div>
        <Choices
          label="版本对比视图"
          value={mode}
          items={[
            { value: 'split', label: '并排' },
            { value: 'inline', label: '行内' },
          ]}
          onChange={setMode}
        />
      </div>
      <div className="lab-diff" data-mode={mode}>
        <div className="lab-diff-header">
          <span>旧版本 v1.2</span>
          <span>新版本 v1.3</span>
        </div>
        {DIFF.map((line, index) => {
          const changed = line.old !== line.next;
          if (onlyChanges && !changed) return null;
          return (
            <div
              ref={(node) => {
                lineRefs.current[index] = node;
              }}
              key={line.label}
              className="lab-diff-line"
              data-active={changed && index === CHANGES[active]}
              data-changed={changed}
            >
              <span className="lab-line-number">{index + 1}</span>
              {changed ? (
                <>
                  <del>
                    <span className="lab-diff-sign" aria-hidden="true">
                      −{' '}
                    </span>
                    {line.old}
                  </del>
                  <ins>
                    <span className="lab-diff-sign" aria-hidden="true">
                      +{' '}
                    </span>
                    {line.next}
                  </ins>
                </>
              ) : (
                <span className="lab-diff-unchanged">{line.old}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="lab-toolbar lab-toolbar-spaced">
        <label className="lab-check">
          <input
            type="checkbox"
            checked={onlyChanges}
            onChange={(event) => setOnlyChanges(event.target.checked)}
          />
          只看修改
        </label>
        <div className="lab-inline-actions">
          <button
            type="button"
            className="lab-icon-button"
            aria-label="上一处修改"
            onClick={() => move(-1)}
          >
            <ArrowLeft />
          </button>
          <span className="lab-small">
            {active + 1} / {CHANGES.length}
          </span>
          <button
            type="button"
            className="lab-icon-button"
            aria-label="下一处修改"
            onClick={() => move(1)}
          >
            <ArrowRight />
          </button>
        </div>
      </div>
      <Notice>当前修改：{DIFF[CHANGES[active]].label}</Notice>
    </LabCard>
  );
}
