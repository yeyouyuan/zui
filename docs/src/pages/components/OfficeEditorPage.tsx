import { useRef, useState } from 'react';
import { Button, Tag } from '@zui/react';
import ApiTable from '../../components/ApiTable';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';
import OfficeWorkbench from '../collaboration/office/OfficeWorkbench';
import { saveAllOfficeSessions } from '../collaboration/office/office-client';
import { officeSample } from '../collaboration/office/samples';
import { importFile, MAX_FILES, MAX_WORKSPACE_BYTES } from '../collaboration/workspace-model';
import { useWorkspace, workspaceStore } from '../collaboration/workspace-store';
import './office-editor-page.css';

const BASIC_CODE = `import { OfficeEditor, type OfficeEditorConfig } from '@zui/react';

interface FileEditorProps {
  session: { id: string; documentServerUrl: string; config: OfficeEditorConfig };
  saveSession: (id: string) => Promise<void>;
  downloadSession: (id: string) => Promise<void>;
}

export function FileEditor({ session, saveSession, downloadSession }: FileEditorProps) {
  return (
    <OfficeEditor
      documentServerUrl={session.documentServerUrl}
      config={session.config}
      height={720}
      onSave={() => saveSession(session.id)}
      onDownload={() => downloadSession(session.id)}
    />
  );
}`;

const CUSTOM_CODE = `<OfficeEditor
  documentServerUrl={session.documentServerUrl}
  config={session.config}
  height="100%"
  toolbar={false}
  events={{
    onDocumentStateChange: (event) => setDirty(Boolean(event.data)),
    onRequestClose: () => returnToFiles(),
  }}
  onReady={() => setReady(true)}
  onError={(error) => reportError(error.message)}
/>`;

const formats = [
  { kind: 'word', label: 'Word', detail: '正文、段落、页布局、表格与批注' },
  { kind: 'excel', label: 'Excel', detail: '工作表、单元格、公式、图表与筛选' },
  { kind: 'pdf', label: 'PDF', detail: '分页预览、已有文字编辑、批注与表单' },
] as const;

const officeAccept = '.docx,.xlsx,.pdf';

export default function OfficeEditorPage(): React.ReactNode {
  usePageTitle('OfficeEditor 文档编辑器');
  const snapshot = useWorkspace();
  const [demoId, setDemoId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openInputRef = useRef<HTMLInputElement>(null);
  const file = snapshot.data?.files.find((entry) => entry.id === demoId);
  const blocked = !snapshot.data || snapshot.status === 'conflict' || busy;

  const openWorkspaceFile = async (source: File) => {
    if (blocked) return;
    setBusy(true);
    setError('');
    try {
      await saveAllOfficeSessions();
      const result = await importFile(source);
      const current = workspaceStore.getSnapshot().data;
      if (!current || workspaceStore.getSnapshot().status === 'conflict')
        throw new Error('当前工作区需要处理保存冲突，请先打开文件工作区。');
      if (current.files.length >= MAX_FILES)
        throw new Error('工作区最多保留 100 个文件，请先清理不需要的文件。');
      if (
        current.files.reduce((sum, entry) => sum + entry.size, 0) + result.file.size >
        MAX_WORKSPACE_BYTES
      )
        throw new Error('工作区文件总量超过 100 MB，请先导出并清理文件。');
      workspaceStore.update(
        (data) => ({ ...data, files: [...data.files, result.file], activeFile: result.file.id }),
        result.asset ? new Map([[result.file.assetKey!, result.asset]]) : undefined
      );
      await workspaceStore.confirmOfficeFile(result.file.id, result.file.revision);
      setDemoId(result.file.id);
      setReadOnly(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : '文件无法打开，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const createExample = async (kind: 'word' | 'excel' | 'pdf') => {
    if (blocked) return;
    setBusy(true);
    setError('');
    try {
      await saveAllOfficeSessions();
      const result = await importFile(await officeSample(kind));
      const current = workspaceStore.getSnapshot().data;
      if (!current || workspaceStore.getSnapshot().status === 'conflict')
        throw new Error('当前工作区需要处理保存冲突，请先打开文件工作区。');
      if (current.files.length >= MAX_FILES)
        throw new Error('工作区最多保留 100 个文件，请先清理不需要的示例。');
      if (
        current.files.reduce((sum, entry) => sum + entry.size, 0) + result.file.size >
        MAX_WORKSPACE_BYTES
      )
        throw new Error('工作区文件总量超过 100 MB，请先导出并清理文件。');
      workspaceStore.update(
        (data) => ({ ...data, files: [...data.files, result.file], activeFile: result.file.id }),
        result.asset ? new Map([[result.file.assetKey!, result.asset]]) : undefined
      );
      await workspaceStore.confirmOfficeFile(result.file.id, result.file.revision);
      setDemoId(result.file.id);
      setReadOnly(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : '示例无法创建，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = async () => {
    if (blocked) return;
    setBusy(true);
    setError('');
    try {
      await saveAllOfficeSessions();
      setReadOnly((value) => !value);
    } catch (error) {
      setError(error instanceof Error ? error.message : '当前文档尚未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const openWorkspace = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveAllOfficeSessions();
      await workspaceStore.flush();
      window.location.hash = '/collaboration';
    } catch (error) {
      setError(error instanceof Error ? error.message : '当前文档尚未保存，请重试。');
      setBusy(false);
    }
  };

  return (
    <div className="doc-page">
      <h1 className="doc-h1">OfficeEditor 文档编辑器</h1>
      <p className="doc-lead">
        将完整的 ONLYOFFICE 编辑画布嵌入业务页面。一个 React 组件承载 Word、Excel 和
        PDF，提供加载与错误状态、内嵌与全屏布局、业务保存和下载回调，并保留文档引擎的原生工具栏。
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 20 }}>
        <Tag color="primary">原生编辑画布</Tag>
        <Tag>后端签名配置</Tag>
        <Tag>自部署服务</Tag>
        <Tag>可复用 React 组件</Tag>
      </div>

      <h2 className="doc-h2">页面内试用</h2>
      <Demo
        title="Word、Excel、PDF 内嵌编辑"
        description="点击创建独立示例副本；文件会保存到当前浏览器工作区，可在文件工作区继续编辑、备份或删除。"
        code={BASIC_CODE}
        stack
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {formats.map(({ kind, label }) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              disabled={blocked}
              onClick={() => void createExample(kind)}
            >
              创建 {label} 示例
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={blocked}
            onClick={() => openInputRef.current?.click()}
          >
            打开本地文件
          </Button>
          {file && (
            <Button
              size="sm"
              variant="outline"
              disabled={blocked}
              onClick={() => void changeMode()}
            >
              {readOnly ? '切换为编辑' : '切换为只读预览'}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void openWorkspace()}>
            打开文件工作区
          </Button>
        </div>
        {(error || snapshot.error) && (
          <p className="office-editor-demo-alert" role="alert">
            {error || snapshot.error}
          </p>
        )}
        {busy && (
          <p className="office-editor-demo-status" role="status">
            正在保存当前文件并准备编辑器…
          </p>
        )}
        {file ? (
          <OfficeWorkbench
            key={file.id}
            file={file}
            disabled={readOnly || snapshot.status === 'conflict'}
            defaultExpanded={false}
          />
        ) : (
          <div className="office-editor-demo-empty">
            <strong>选择一种文档开始试用</strong>
            <p>编辑器将在这里打开，也可以通过文件工作区导入自己的 DOCX、XLSX 或 PDF。</p>
          </div>
        )}
      </Demo>

      <input
        ref={openInputRef}
        type="file"
        accept={officeAccept}
        hidden
        aria-label="打开本地 Office 文件"
        onChange={(event) => {
          const source = event.target.files?.[0];
          event.target.value = '';
          if (source) void openWorkspaceFile(source);
        }}
      />

      <h2 className="doc-h2">格式与接入</h2>
      <div className="doc-table-wrap">
        <table className="doc-api-table">
          <thead>
            <tr>
              <th scope="col">格式</th>
              <th scope="col">文档画布能力</th>
              <th scope="col">接入配置</th>
            </tr>
          </thead>
          <tbody>
            {formats.map(({ kind, label, detail }) => (
              <tr key={kind}>
                <td>{label}</td>
                <td>{detail}</td>
                <td>
                  <code>{kind === 'word' ? 'word' : kind === 'excel' ? 'cell' : 'pdf'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>PDF 修改已有文字的入口为“主页 → 编辑文本”；扫描文字需要另外接入 OCR。</p>
      <p>
        业务后端提供文件地址、唯一文档 key、编辑权限、保存回调地址和 JWT
        签名配置。组件接收完整配置，业务的 <code>onSave</code>{' '}
        等待文档服务生成文件并完成持久化后才返回成功；
        <code>onDownload</code> 下载已经确认的结果文件。JWT 密钥保存在服务端。
      </p>
      <p>
        本机示例使用现有文件桥接与工作区保存流程。部署说明见仓库中的{' '}
        <code>docs/office-full-editor.md</code>。
      </p>

      <h2 className="doc-h2">嵌入现有工作台</h2>
      <Demo
        title="保留业务自己的文件栏和操作栏"
        description="toolbar=false 隐藏组件外层工具栏，原生文档工具栏仍由 ONLYOFFICE 提供。"
        code={CUSTOM_CODE}
        stack
      >
        <p style={{ margin: 0 }}>
          高度可以使用固定数值或容器的 100%。回调和配置对象引用变化保持实例，真正切换文档
          key、权限或编辑模式时才重新打开。
        </p>
      </Demo>
      <p>
        原生菜单相关的请求事件应在首次配置时提供完整。后续追加普通事件监听不会重开画布；
        如果需要改变原生菜单能力，先保存文件，再使用 <code>rebuildKey</code> 或{' '}
        <code>ref.reload()</code>。
      </p>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'documentServerUrl',
            type: 'string',
            description: 'ONLYOFFICE Docs 的浏览器可访问地址。',
          },
          {
            name: 'config',
            type: 'OfficeEditorConfig',
            description: '后端签名的完整编辑配置，包含 document、editorConfig 和 token。',
          },
          {
            name: 'height',
            type: 'number | string',
            defaultValue: '640',
            description: '组件高度；使用 100% 时需要为父容器设置高度。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '暂停画布交互与业务动作，保持原生实例。文档只读权限仍由后端签名配置决定。',
          },
          {
            name: 'onSave / onDownload',
            type: '(editor) => void | Promise<void>',
            description: '业务保存与下载动作；返回 Promise 时显示进行状态和失败信息。',
          },
          {
            name: 'events',
            type: 'Record<string, (event) => void>',
            description: '透传原生事件，与 config.events 共同执行。',
          },
          {
            name: 'onReady',
            type: '(editor, event) => void',
            description: '原生文档画布就绪后触发。',
          },
          {
            name: 'onStatusChange',
            type: '(status) => void',
            description: 'loading、ready、error 的宿主加载状态。',
          },
          {
            name: 'onError',
            type: '(error: OfficeEditorError) => void',
            description: '脚本加载、编辑器打开和业务动作错误；error.code 区分失败阶段。',
          },
          {
            name: 'toolbar / header',
            type: 'ReactNode | ((context) => ReactNode)',
            description: '自定义外层操作栏、标题区域，可使用渲染函数；false 显式隐藏。',
          },
          {
            name: 'fullscreen / defaultFullscreen',
            type: 'boolean',
            description: '受控或非受控的全屏显示。',
          },
          {
            name: 'onFullscreenChange',
            type: '(fullscreen: boolean) => void',
            description: '全屏显示请求回调。',
          },
          {
            name: 'allowFullscreen',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否显示默认工具栏的全屏按钮。',
          },
          {
            name: 'labels',
            type: 'Partial<OfficeEditorLabels>',
            description: '覆盖外层组件文案；原生编辑器语言由 editorConfig.lang 配置。',
          },
          {
            name: 'loading / renderError',
            type: 'ReactNode / ((error, retry) => ReactNode)',
            description: '定制加载与失败界面；retry 重试对应保存、下载或连接动作。',
          },
          {
            name: 'kind',
            type: `'word' | 'excel' | 'pdf'`,
            description: '文档族主题色，作用于外层标题栏；原生权限仍由签名配置决定。',
          },
          {
            name: 'customization',
            type: 'Record<string, unknown>',
            description:
              '填充签名配置未设置的 editorConfig.customization 键；逐键以后端配置优先，变更会重建实例。',
          },
          {
            name: 'classNames',
            type: '{ root?; header?; toolbar?; title?; brand?; status?; actions?; stage?; canvas?; overlay?; error?; notice?; heading? }',
            description: '定制外层各区域的类名，沿用 ZUI CSS 令牌。',
          },
          {
            name: 'scriptTimeout / readyTimeout',
            type: 'number',
            description: '脚本加载及文档就绪超时，单位毫秒。',
          },
          {
            name: 'scriptNonce',
            type: 'string',
            description: '为动态加载的官方 API 脚本设置 CSP nonce。',
          },
          {
            name: 'rebuildKey',
            type: 'string | number',
            description: '业务明确请求重建实例；重建前应先完成保存。',
          },
          {
            name: 'ref',
            type: 'OfficeEditorHandle',
            description:
              'reload()、getEditor()、setFullscreen(boolean)；禁用或业务动作进行中不重载。',
          },
        ]}
      />

      <h2 className="doc-h2">服务版本与商用</h2>
      <p>
        组件通过官方 API 接入独立的 Docs 服务。Community 使用 AGPLv3，可免费用于企业内部商业办公；
        修改或将引擎源码纳入产品需遵守对应开源与标识要求。闭源产品和 SaaS 的商业内嵌可选 Docs
        Developer；白标是 Developer 的额外付费选项，具体权利按所购买的授权执行。
      </p>
      <p>
        参考{' '}
        <a href="https://www.onlyoffice.com/license-faq" target="_blank" rel="noreferrer">
          官方许可 FAQ
        </a>
        、
        <a href="https://www.onlyoffice.com/for-developers" target="_blank" rel="noreferrer">
          Developer 版本
        </a>{' '}
        和
        <a href="https://www.onlyoffice.com/pricing" target="_blank" rel="noreferrer">
          官方授权说明
        </a>
        。
        当前社区版示例使用桌面编辑器并保留官方品牌；移动网页编辑、云账号及共享权限需要相应服务和业务接入。
      </p>
    </div>
  );
}
