'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Button,
  Modal,
  OfficeStudio,
  Select,
  Switch,
  Tag,
  type OfficeStudioHandle,
  type OfficeStudioKind,
  type StudioPdfRenderer,
} from '@zui/react';
import ApiTable from '../../components/ApiTable';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';
import {
  createStudioFile,
  downloadStudioFile,
  exportStudioFile,
  importStudioFile,
} from '../collaboration/office-studio/studio-files';
import {
  createStudioStorage,
  type StudioStoredFile,
  type StudioVersionSummary,
} from '../collaboration/office-studio/studio-storage';
import { StudioWorkspace } from '../collaboration/office-studio/studio-workspace';
import { prepareStudioFile } from '../collaboration/office-studio/studio-prepare';
import './office-studio-page.css';

const workspace = new StudioWorkspace(createStudioStorage(), 700, prepareStudioFile);
const studioPdfRenderer: StudioPdfRenderer = {
  load: async (source) =>
    (await import('../collaboration/office-studio/studio-pdf-adapter')).studioPdfRenderer.load(
      source
    ),
};
let initializing: Promise<void> | undefined;
function initializeWorkspace(): Promise<void> {
  initializing ??= workspace
    .start()
    .then(async () => {
      if (workspace.getSnapshot().active) return;
      const file = await createStudioFile('word');
      await workspace.add(file.document, file.source);
    })
    .catch((error) => {
      initializing = undefined;
      throw error;
    });
  return initializing;
}
const kinds = [
  { kind: 'word', label: 'Word', detail: '文档排版 · 图片与页眉页脚' },
  { kind: 'excel', label: 'Excel', detail: '行列编辑 · 公式与图表' },
  { kind: 'pdf', label: 'PDF', detail: '全文查找 · 批注与手写' },
] as const;

const BASIC_CODE = `import { OfficeStudio } from '@zui/react';
import '@zui/react/styles.css';

<OfficeStudio
  value={document}
  source={originalFile}
  pdfRenderer={pdfRenderer}
  height={780}
  onChange={setDocument}
  onSave={saveDocument}
  onImport={importDocument}
  onExport={exportDocument}
  onPrint={printDocument}
  onCreate={createDocument}
/>`;

export default function OfficeStudioPage(): React.ReactNode {
  usePageTitle('OfficeStudio 独立文档工作台');
  const snapshot = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot
  );
  const [busy, setBusy] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<StudioVersionSummary[]>([]);
  const [preview, setPreview] = useState<StudioStoredFile | null>(null);
  const fileActionRef = useRef(false);
  const editorRef = useRef<OfficeStudioHandle>(null);
  const active = snapshot.active;

  useEffect(() => {
    setHistoryOpen(false);
    setVersions([]);
    setPreview(null);
  }, [active?.id]);

  useEffect(() => {
    void initializeWorkspace().catch((error) =>
      setError(error instanceof Error ? error.message : '文档无法恢复，请重试。')
    );
    const beforeUnload = (event: BeforeUnloadEvent) => {
      try {
        editorRef.current?.getDocument();
      } catch {
        event.preventDefault();
        event.returnValue = '';
        return;
      }
      if (
        ['unsaved', 'saving', 'error'].includes(workspace.getSnapshot().saveState) &&
        workspace.getSnapshot().active
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        try {
          editorRef.current?.getDocument();
          void workspace.flush().catch(() => {});
        } catch {
          // The editor retains an invalid draft for correction when the tab returns.
        }
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visibility);
      void workspace.flush().catch(() => {});
    };
  }, []);

  const fileAction = async (action: () => Promise<void>) => {
    if (fileActionRef.current) throw new Error('正在准备文档，请稍后再操作。');
    editorRef.current?.getDocument();
    fileActionRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } finally {
      fileActionRef.current = false;
      setBusy(false);
    }
  };
  const act = async (action: () => Promise<void>) => {
    try {
      await fileAction(action);
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作未完成，请重试。');
    }
  };
  const create = async (kind: OfficeStudioKind) => {
    await workspace.flush();
    const file = await createStudioFile(kind);
    await workspace.add(file.document, file.source);
    setReadOnly(false);
  };
  const openSample = async (kind: OfficeStudioKind) => {
    const existing = workspace.getSnapshot().files.find((file) => file.kind === kind);
    if (existing) await workspace.select(existing.id);
    else await create(kind);
    setReadOnly(false);
  };
  const importFile = async (file: File) => {
    await workspace.flush();
    const document = await importStudioFile(file);
    await workspace.add(document, file);
    setReadOnly(false);
  };
  const exportFile = async () => {
    const file = await workspace.exportSnapshot();
    const blob = await exportStudioFile(file.document, file.source);
    downloadStudioFile(blob, file.document);
  };
  const openHistory = () =>
    act(async () => {
      await workspace.flush();
      setVersions(await workspace.versions());
      setPreview(null);
      setHistoryOpen(true);
    });
  const previewVersion = (revision: number) =>
    act(async () => {
      const id = workspace.getSnapshot().active?.id;
      const version = await workspace.version(revision);
      if (workspace.getSnapshot().active?.id === id) setPreview(version);
    });
  const printFile = async (file: StudioStoredFile) => {
    await (
      await import('../collaboration/office-studio/studio-print')
    ).printStudioFile(file.document, file.source);
  };
  const visibleError = error || snapshot.error;
  const blocked = busy || snapshot.status === 'loading';

  return (
    <div className="doc-page office-studio-page">
      <h1 className="doc-h1">OfficeStudio 独立文档工作台</h1>
      <p className="doc-lead">
        使用 ZUI 的工具栏、菜单和表单，在页面内直接编辑文档。Word、Excel、PDF
        共用文件操作与保存状态，编辑内容保存在当前浏览器，也可以导出为实际文件。
      </p>
      <div className="office-studio-page-tags">
        <Tag color="primary">ZUI 界面</Tag>
        <Tag>页面内编辑</Tag>
        <Tag>本地恢复</Tag>
        <Tag>DOCX / XLSX / PDF</Tag>
      </div>
      <Demo
        title="从预览，到完成一份文档"
        description="选择一种文档开始。修改会自动保存到当前浏览器；导出后可在 Word、Excel 或 PDF 阅读器中继续使用。"
        code={BASIC_CODE}
        stack
      >
        <div className="office-studio-demo">
          <div className="office-studio-launcher" role="group" aria-label="选择示例文档">
            {kinds.map(({ kind, label, detail }) => (
              <Button
                type="button"
                key={kind}
                variant={active?.document.kind === kind ? 'secondary' : 'ghost'}
                disabled={blocked}
                aria-pressed={active?.document.kind === kind}
                onClick={() => void act(() => openSample(kind))}
              >
                <span className="office-studio-launcher-letter" data-kind={kind} aria-hidden="true">
                  {label[0]}
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </Button>
            ))}
          </div>
          <div className="office-studio-library">
            <span>本地文档</span>
            <Select
              size="sm"
              aria-label="打开本地文档"
              value={active?.id}
              disabled={blocked || snapshot.files.length === 0}
              placeholder="保存的文档会出现在这里"
              options={snapshot.files.map((file) => ({ value: file.id, label: file.name }))}
              onChange={(id) => void act(() => workspace.select(id))}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={blocked || !active}
              onClick={() => void openHistory()}
            >
              历史版本
            </Button>
            <Switch
              label="只读预览"
              checked={readOnly}
              disabled={blocked || !active}
              onChange={(value) =>
                void act(async () => {
                  await workspace.flush();
                  setReadOnly(value);
                })
              }
            />
          </div>
          {visibleError && (
            <Alert type="error" title={visibleError}>
              {active?.revision === 0 && (
                <p>当前文档尚未保存到本地空间。内容仍在编辑器中，可以重试保存或导出文件。</p>
              )}
              <div className="office-studio-recovery">
                {!active && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => void act(initializeWorkspace)}
                  >
                    重新读取本地文档
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || !active}
                  onClick={() => void act(() => workspace.save())}
                >
                  重试保存
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked || !active}
                  onClick={() => void act(() => workspace.saveCopy())}
                >
                  另存本地副本
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={blocked || !active}
                  onClick={() => void act(exportFile)}
                >
                  导出当前内容
                </Button>
              </div>
            </Alert>
          )}
          {active ? (
            <OfficeStudio
              ref={editorRef}
              value={active.document}
              source={active.source}
              pdfRenderer={studioPdfRenderer}
              height={780}
              disabled={blocked}
              readOnly={readOnly}
              saveState={snapshot.saveState}
              onChange={(document) => workspace.edit(document)}
              onSave={() => workspace.flush()}
              onExport={exportFile}
              onPrint={(document) =>
                fileAction(async () => {
                  const file = await workspace.exportSnapshot();
                  if (file.id !== document.id) throw new Error('当前文档已切换，请重新打印。');
                  await printFile({ ...file, document });
                })
              }
              onImport={(file) => fileAction(() => importFile(file))}
              onCreate={(kind) => fileAction(() => create(kind))}
            />
          ) : (
            <div className="office-studio-page-loading" role="status">
              正在准备本地文档…
            </div>
          )}
          <p className="office-studio-demo-note">
            文件保存在当前浏览器的本地文档空间。需要长期留存时，请导出文件。
          </p>
        </div>
      </Demo>
      <Modal open={historyOpen} onOpenChange={setHistoryOpen}>
        <Modal.Content size="lg" className="office-studio-history-modal">
          <Modal.Header>
            <Modal.Title>文档历史版本</Modal.Title>
            <Modal.Close />
          </Modal.Header>
          <Modal.Description>
            保留最近 20 次保存前的版本。选择一个版本查看，恢复后会创建新文档。
          </Modal.Description>
          <Modal.Body>
            <div className="office-studio-history-list" aria-label="已保存的历史版本">
              {versions.length === 0 ? (
                <p>还没有历史版本，修改文档并保存后会在这里显示。</p>
              ) : (
                versions.map((version) => (
                  <Button
                    key={version.revision}
                    type="button"
                    size="sm"
                    variant={preview?.revision === version.revision ? 'secondary' : 'outline'}
                    disabled={blocked}
                    aria-pressed={preview?.revision === version.revision}
                    onClick={() => void previewVersion(version.revision)}
                  >
                    版本 {version.revision} · {new Date(version.savedAt).toLocaleString('zh-CN')}
                  </Button>
                ))
              )}
            </div>
            {preview && (
              <OfficeStudio
                value={preview.document}
                source={preview.source}
                pdfRenderer={studioPdfRenderer}
                height={480}
                readOnly
                disabled={blocked}
                saveState="saved"
                onExport={() =>
                  fileAction(async () =>
                    downloadStudioFile(
                      await exportStudioFile(preview.document, preview.source),
                      preview.document
                    )
                  )
                }
                onPrint={() => fileAction(() => printFile(preview))}
              />
            )}
            {visibleError && (
              <p role="alert" className="office-studio-history-error">
                {visibleError}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
              关闭
            </Button>
            <Button
              type="button"
              disabled={!preview || blocked || readOnly}
              onClick={() => {
                if (preview)
                  void act(async () => {
                    await workspace.restoreVersion(preview.revision);
                    setHistoryOpen(false);
                  });
              }}
            >
              恢复为新文档
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
      <h2 className="doc-h2">编辑能力</h2>
      <div className="doc-table-wrap">
        <table className="doc-api-table">
          <thead>
            <tr>
              <th scope="col">文档</th>
              <th scope="col">支持的操作</th>
              <th scope="col">当前范围</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Word</td>
              <td>
                字体与小数字号输入、正文排版、列表、表格、图片、页眉页脚、页码、查找替换、页面设置、撤销重做；导入与导出
                DOCX
              </td>
              <td>支持内嵌图片与单节文档。修订、目录、浮动对象等复杂结构会提示暂不支持。</td>
            </tr>
            <tr>
              <td>Excel</td>
              <td>
                单元格与矩形选区、字体与小数字号输入、手动与自动行高/列宽、查找替换、边框与垂直对齐、清除格式、公式和跨表引用、格式、复制粘贴、工作表增删、行列插入删除、合并、冻结、排序、筛选、柱状图与折线图；导入与导出
                XLSX
              </td>
              <td>
                10,000 行、256 列、32 张表、100,000
                个已使用单元格。透视、宏、数组公式及复杂图表暂不支持。
              </td>
            </tr>
            <tr>
              <td>PDF</td>
              <td>
                分页与缩略图、缩放、旋转、全文查找、文字与高亮、矩形和手写批注、已有表单、撤销重做；导出
                PDF
              </td>
              <td>批注和表单编辑。任意原始文字修改、原文重排及扫描件 OCR 暂不支持。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 className="doc-h2">组件接入</h2>
      <p className="doc-p">
        UI 组件使用 Tiptap / ProseMirror 和公式计算库；文件适配使用 docx、ExcelJS、pdf-lib 与
        PDF.js。本页无需文档服务器。宿主可以替换保存与导入导出回调，接入自己的文件系统。
      </p>
      <p className="doc-p">
        PDF 的 worker、字体与渲染由 <code>pdfRenderer</code> 提供。本页的适配代码位于{' '}
        <code>docs/src/pages/collaboration/office-studio/</code>。当前组件为尚未发布的源码新增。
      </p>
      <ApiTable
        rows={[
          {
            name: 'value / defaultValue',
            type: 'OfficeStudioDocument',
            description: '受控文档或非受控初始文档；支持 Word、Excel、PDF 三种模型。',
          },
          { name: 'onChange', type: '(document) => void', description: '内容或文件名称变化。' },
          {
            name: 'source / pdfRenderer',
            type: 'Blob / StudioPdfRenderer',
            description: '原始文件及 PDF 渲染适配；worker 资源由宿主管理。',
          },
          {
            name: 'onSave / onExport / onPrint',
            type: '(document) => void | Promise<void>',
            description: '宿主处理保存、导出或打印；返回后更新状态，失败可重试。',
          },
          {
            name: 'onImport / onCreate',
            type: '(file | kind) => void | Promise<void>',
            description: '宿主解析文件或创建模型，并更新受控值。',
          },
          {
            name: 'readOnly / disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '只读预览或禁用编辑与文件操作。',
          },
          {
            name: 'saveState',
            type: "'saved' | 'saving' | 'unsaved' | 'error'",
            description: '宿主自动保存状态。',
          },
          {
            name: 'height',
            type: 'number | string',
            defaultValue: '760',
            description: '编辑器高度；100% 需要父容器设置确定高度。',
          },
          {
            name: 'fullscreen / onFullscreenChange',
            type: 'boolean / (value) => void',
            description: '全屏布局，切换时编辑内容保持挂载。',
          },
          {
            name: 'ref',
            type: 'OfficeStudioHandle',
            description: 'getDocument()、save()、export()、print()、setFullscreen()。',
          },
          {
            name: 'classNames',
            type: '{ root?; header?; title?; actions?; stage?; status?; error? }',
            description: '追加语义结构类名，配合 data-part 与 CSS 变量定制。',
          },
        ]}
      />
    </div>
  );
}
