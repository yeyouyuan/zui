import { useState } from 'react';
import { Upload, type UploadFile } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const simulateUpload = (options: {
  file: File;
  onProgress: (percent: number) => void;
  onSuccess: (response?: unknown) => void;
}) => {
  let percent = 0;
  const timer = setInterval(() => {
    percent += 20;
    if (percent >= 100) {
      clearInterval(timer);
      options.onSuccess({ name: options.file.name });
    } else {
      options.onProgress(percent);
    }
  }, 200);
  return { abort: () => clearInterval(timer) };
};

const BASIC_CODE = `<Upload
  customRequest={({ file, onProgress, onSuccess }) => {
    let percent = 0;
    const timer = setInterval(() => {
      percent += 20;
      if (percent >= 100) {
        clearInterval(timer);
        onSuccess({ name: file.name });
      } else {
        onProgress(percent);
      }
    }, 200);
    return { abort: () => clearInterval(timer) };
  }}
/>`;

const DRAG_CODE = `<Upload draggable customRequest={simulateUpload} />`;

const STATUS_CODE = `const [files, setFiles] = useState<UploadFile[]>([
  { uid: 'u1', name: '设计稿-final.png', size: 2097152, status: 'success' },
  { uid: 'u2', name: '需求文档.pdf', size: 524288, status: 'error', error: '服务器繁忙' },
]);

<Upload
  fileList={files}
  onChange={(info) => setFiles(info.fileList)}
  onRemove={(file) => window.confirm('确认移除 ' + file.name + ' 吗?')}
  customRequest={simulateUpload}
/>`;

const LIMIT_CODE = `<Upload
  multiple
  maxCount={3}
  accept="image/*"
  customRequest={simulateUpload}
/>`;

const DISABLED_CODE = `<Upload disabled />
<Upload draggable disabled />`;

export default function UploadPage(): React.ReactNode {
  usePageTitle('Upload 上传');
  const [files, setFiles] = useState<UploadFile[]>([
    { uid: 'u1', name: '设计稿-final.png', size: 2 * 1024 * 1024, status: 'success' },
    { uid: 'u2', name: '需求文档.pdf', size: 512 * 1024, status: 'error', error: '服务器繁忙' },
  ]);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Upload 上传</h1>
      <p className="doc-lead">
        隐藏 file input + 可见按钮（或拖拽区）触发选择，customRequest / XHR 双引擎驱动
        uploading → success/error 状态流转与进度条；文件列表带移除按钮，支持 maxCount
        挤旧、beforeUpload 过滤与受控 fileList。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础上传"
        description="customRequest 优先于 action；onProgress / onSuccess / onError 驱动文件状态，每次变化都会触发 onChange。"
        code={BASIC_CODE}
      >
        <Upload customRequest={simulateUpload} />
      </Demo>

      <Demo
        title="拖拽上传"
        description="draggable 切换为整块拖拽区：dragover 高亮，drop 取 e.dataTransfer.files，点击区域同样可打开文件选择。"
        code={DRAG_CODE}
      >
        <Upload draggable customRequest={simulateUpload} />
      </Demo>

      <Demo
        title="状态流转与移除"
        description="列表项展示状态图标（上传中旋转 / 成功 / 失败）、可读 size、进度条；onRemove 返回 false 可阻止移除。"
        code={STATUS_CODE}
      >
        <Upload
          fileList={files}
          onChange={(info) => setFiles(info.fileList)}
          onRemove={(file) => window.confirm('确认移除 ' + file.name + ' 吗?')}
          customRequest={simulateUpload}
        />
      </Demo>

      <Demo
        title="数量与类型限制"
        description="multiple 多选、accept 限制文件类型、maxCount 超出时挤掉最旧的文件。"
        code={LIMIT_CODE}
      >
        <Upload multiple maxCount={3} accept="image/*" customRequest={simulateUpload} />
      </Demo>

      <Demo title="禁用" description="禁用触发按钮 / 拖拽区与文件选择。" code={DISABLED_CODE} stack>
        <Upload disabled />
        <Upload draggable disabled />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'action',
            type: 'string',
            defaultValue: '—',
            description: '上传 URL；与 customRequest 二选一（未提供时只入列不上传）。',
          },
          {
            name: 'customRequest',
            type: '(options: CustomRequestOptions) => { abort?: () => void } | void',
            defaultValue: '—',
            description: '自定义上传实现；options 提供 file 与 onProgress / onSuccess / onError。',
          },
          {
            name: 'method',
            type: 'string',
            defaultValue: "'post'",
            description: 'XHR 模式的 HTTP 方法。',
          },
          {
            name: 'name',
            type: 'string',
            defaultValue: "'file'",
            description: '表单字段名。',
          },
          {
            name: 'headers / data / withCredentials',
            type: 'Record<string, string> / Record<string, unknown> / boolean',
            defaultValue: '—',
            description: 'XHR 模式的请求头、附加表单数据与跨域凭据。',
          },
          {
            name: 'accept',
            type: 'string',
            defaultValue: '—',
            description: '透传 input accept。',
          },
          {
            name: 'multiple',
            type: 'boolean',
            defaultValue: 'false',
            description: '是否支持多选。',
          },
          {
            name: 'maxCount',
            type: 'number',
            defaultValue: '—',
            description: '最大文件数，超出时挤掉最旧。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用触发器与拖拽区。',
          },
          {
            name: 'draggable',
            type: 'boolean',
            defaultValue: 'false',
            description: '拖拽区模式（默认按钮模式）。',
          },
          {
            name: 'fileList / defaultFileList',
            type: 'UploadFile[]',
            defaultValue: '[]',
            description: '受控 / 非受控文件列表（受控列表必须保留 uid）。',
          },
          {
            name: 'onChange',
            type: '(info: UploadChangeInfo) => void',
            defaultValue: '—',
            description: '每次状态变化（新增 / 进度 / 成功 / 失败 / 移除）触发。',
          },
          {
            name: 'onRemove',
            type: '(file: UploadFile) => boolean | Promise<boolean> | void',
            defaultValue: '—',
            description: '返回 false 阻止移除；移除时会中止在途上传。',
          },
          {
            name: 'beforeUpload',
            type: '(file: File, fileList: File[]) => boolean | Promise<boolean>',
            defaultValue: '—',
            description: '返回 false 完全跳过（不入列表、不触发 onChange）。',
          },
          {
            name: 'classNames',
            type: '{ root?; trigger?; dragzone?; list?; item? }',
            defaultValue: '—',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        UploadFile 结构：<code className="doc-code-inline">uid</code>（组件生成，受控列表必须保留）、
        <code className="doc-code-inline">name</code>、
        <code className="doc-code-inline">size</code>、
        <code className="doc-code-inline">status</code>（uploading / success / error）、
        <code className="doc-code-inline">percent</code>、
        <code className="doc-code-inline">response</code>、
        <code className="doc-code-inline">error</code>、
        <code className="doc-code-inline">originFileObj</code>。
      </p>
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-disabled</code>；列表项
        <code className="doc-code-inline">data-status</code>；拖拽区
        <code className="doc-code-inline">data-dragover</code> 与
        <code className="doc-code-inline">data-disabled</code>。列表容器高度上限遵守
        <code className="doc-code-inline">min(320px, calc(100dvh - 16px))</code> 约定。
      </p>

      <CustomizeOutlet
        name="Upload"
        parts={['root', 'trigger', 'dragzone', 'list', 'item']}
        vars={[
          '--z-upload-gap',
          '--z-upload-button-height',
          '--z-upload-button-padding-x',
          '--z-upload-button-font-size',
          '--z-upload-button-radius',
          '--z-upload-button-bg',
          '--z-upload-button-fg',
          '--z-upload-button-hover-bg',
          '--z-upload-dragzone-padding',
          '--z-upload-dragzone-radius',
          '--z-upload-dragzone-bg',
          '--z-upload-dragzone-fg',
          '--z-upload-dragzone-border',
          '--z-upload-dragzone-border-hover',
          '--z-upload-dragzone-font-size',
          '--z-upload-list-gap',
          '--z-upload-list-max-height',
          '--z-upload-item-padding',
          '--z-upload-item-radius',
          '--z-upload-item-bg',
          '--z-upload-item-fg',
          '--z-upload-item-gap',
          '--z-upload-icon-uploading',
          '--z-upload-icon-success',
          '--z-upload-icon-error',
          '--z-upload-size-color',
          '--z-upload-progress-height',
          '--z-upload-progress-bg',
          '--z-upload-progress-fill',
          '--z-upload-remove-color',
          '--z-upload-remove-hover-color',
          '--z-upload-focus-ring',
        ]}
      />
    </div>
  );
}
