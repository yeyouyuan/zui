# RFC-006：内容协作组件

日期：2026-11-09。状态：设计提案与交互原型，未加入正式包导出与 Registry。

## 用户任务与边界

用户需要在同一位置查看文件、修改内容、围绕上下文讨论。首批设计为 FilePreview、ContentEditor、CommentThread，组合原型位于文档站 `#/collaboration`。

适用场景包括方案评审、知识库文章维护、附件审核。原型使用本地文件与内存数据，可以验证预览、编辑、评论、回复、解决与重新打开。刷新会重置。源码组件数仍为 71。

首版优先纯文本与图片，PDF 由适配器接入。Office、压缩包等未知类型显示明确的不支持状态，由应用决定下载入口。基础包不内置 Office 转换、富文本引擎、实时协同传输、CRDT、权限服务或存储后端。

## 信息布局

桌面：文件选择 → 文件信息/操作栏 → 预览画布与讨论侧栏。窄屏：文件选择换行，讨论面板排在预览之后，避免压缩正文。加载与错误状态只替换预览画布，讨论和文件导航保持可操作。

编辑保留当前文档上下文。明确区分已保存文本与草稿，提供保存、取消、字符数与快捷键。原型编辑的是“项目概述”稳定段落；正式 ContentEditor 可编辑任意受控文本。原型编辑期间禁用文件切换，避免草稿悄然丢失。

评论默认显示未解决线程，允许查看全部、回复、解决与重新打开。引用保存创建时的文本快照，定位使用稳定段落 id。正文被编辑后，不把旧引用自动改写成新文本。正式版应标明引用版本与失效状态。

## FilePreview

```tsx
interface PreviewFile {
  id: string;
  name: string;
  mimeType: string;
  revision?: string;
  source: { kind: 'text'; text: string } | { kind: 'url'; url: string };
  downloadUrl?: string;
}
interface PreviewRenderer {
  key: string;
  accepts: (file: PreviewFile) => boolean;
  render: (context: {
    file: PreviewFile;
    signal: AbortSignal;
    onReady: () => void;
    onError: (error: Error) => void;
  }) => React.ReactNode;
}
interface FilePreviewProps extends Omit<React.ComponentPropsWithRef<'section'>, 'children'> {
  file: PreviewFile;
  state: 'loading' | 'ready' | 'error';
  error?: React.ReactNode;
  renderers?: readonly PreviewRenderer[];
  onRetry?: () => void;
  onDownload?: () => void;
  toolbar?: React.ReactNode;
  classNames?: Partial<Record<'root' | 'toolbar' | 'viewport' | 'status', string>>;
}
```

- 内置 text 与 image renderer；渲染器首个匹配者生效。不支持 MIME 时显示 fallback，无渲染器也不会无限等待。
- 文件 id/revision 改变后取消旧任务，忽略旧请求结果；卸载时释放对象 URL。
- 图片加载失败进入 error；加载失败与不支持类型具有不同的文案和操作。
- 外部 URL、下载地址与 MIME 由应用验证。文本始终按文本展示；不注入 HTML。默认不嵌入任意 iframe。
- 原型未实现 renderer 调度、AbortSignal、实际下载、网络/图片错误处理或 PDF；状态选择器用于设计验收。

## ContentEditor

```tsx
interface ContentEditorProps extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'onChange' | 'children'
> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  savedValue: string;
  baseRevision: string;
  readOnly?: boolean;
  state: 'idle' | 'saving' | 'error' | 'conflict';
  error?: React.ReactNode;
  onSave: (draft: string, baseRevision: string) => Promise<void>;
  onCancel: () => void;
  editor?: (props: {
    value: string;
    onValueChange: (value: string) => void;
    readOnly: boolean;
    label: string;
  }) => React.ReactNode;
}
```

状态：idle → saving → idle/error/conflict。失败时保留草稿；保存中防止重复提交；冲突时展示服务端新版本，提供保留草稿/重新加载，禁止静默覆盖。调用方管理草稿持久化与离开页面确认。权限从可编辑变为只读时，正式实现保留草稿并明确标识权限变化；本页演示切换权限会取消编辑并提示“只读模式”。

默认 textarea，普通 Enter 换行；⌘/Ctrl+Enter 触发明确保存。处理 IME composition 时不提交。保存后焦点回到编辑触发器，错误关联到输入区并提供重试。富文本适配器必须自己满足键盘、焦点和内容安全契约。

原型只实现同步内存保存、取消、快捷键、草稿与只读状态；正式异步保存、冲突和持久化仍待实现。

## CommentThread

```tsx
type ContentAnchor = {
  fileId: string;
  blockId?: string;
  revision: string;
  quote?: string;
};
interface Thread {
  id: string;
  anchor: ContentAnchor;
  status: 'open' | 'resolved';
  comments: readonly {
    id: string;
    author: { id: string; name: string; avatar?: string };
    body: string;
    createdAt: string;
  }[];
}
type ThreadAction =
  | { type: 'reply'; threadId: string; body: string; requestId: string }
  | { type: 'resolve' | 'reopen'; threadId: string; requestId: string };
interface CommentThreadProps {
  thread: Thread;
  permissions: { reply: boolean; resolve: boolean };
  pendingAction?: ThreadAction['type'];
  error?: React.ReactNode;
  onAction: (action: ThreadAction) => Promise<void>;
  onLocate?: (anchor: ContentAnchor) => void;
}
```

- 线程用 article + 具名标题，评论按文档顺序排列。操作使用原生 button，编辑区提供 label，不滥用 feed 或 listbox 角色。
- 评论归属于 fileId；切换文件不展示上一文件的线程，回复目标随文件变化清空。
- 定位后聚焦稳定段落并高亮；引用失效时禁用定位，保留引用快照与讨论内容。
- 发送失败保留输入，requestId 用于由服务端去重；先确认成功再清空。解决失败保持 open。
- 全局 status 只播报操作结果，避免把整条讨论树设置成 live region。
- 原型包含文件隔离、引用快照、定位、回复、解决和重新打开；权限只有本页读/写切换，无服务端鉴权。

## 与现有能力组合

| 能力           | 复用                           | 新增职责                           |
| -------------- | ------------------------------ | ---------------------------------- |
| 文件进入工作区 | Upload、List                   | FilePreview 处理打开后的画布与状态 |
| 图片与弹层     | Image、Modal、Drawer           | 预览类型切换及统一文件信息         |
| 文本输入       | 原生 textarea、Input、Mentions | ContentEditor 管理草稿与保存工作流 |
| 讨论展示       | Avatar、Button、Tag、Empty     | CommentThread 管理回复与线程状态   |
| 更宽的工作台   | Splitter                       | 消费方组合预览/讨论，不强制依赖    |

## 正式实现验收

1. 用两个实际消费场景验证接口：文章维护与附件审核。
2. FilePreview 测试未知类型、加载失败、空文本、长名称、切换取消、图片解码失败、下载与卸载清理。
3. ContentEditor 测试受控值、取消、IME、保存失败、重复提交、冲突、权限变化、草稿恢复及焦点归还。
4. CommentThread 测试发送失败、去重、引用失效、回复/解决并发、权限、长评论和本地化时间。
5. 三者覆盖 320px 与桌面、明暗主题、键盘、axe、reduced-motion、SSR、十套 locale、Registry/CLI/MCP 与消费者检查。
6. 在源码、导出、测试、文档和发布检查全部满足统一 DoD 后，才计入正式组件数。

## 参考

- React `useDeferredValue`：https://react.dev/reference/react/useDeferredValue
- 原生多行编辑与表单关联：https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element
- WAI-ARIA Authoring Practices：https://www.w3.org/WAI/ARIA/apg/
