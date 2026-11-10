# RFC-006：内容协作组件

日期：2026-11-09；更新：2026-11-10。状态：通用组件接口仍为设计提案，未加入正式包导出与 Registry；文档站已实现可用的本地文件工作台。

## 用户任务与边界

用户需要在同一位置查看文件、修改内容、围绕上下文讨论。首批设计为 FilePreview、ContentEditor、CommentThread，组合工作台位于文档站 `#/collaboration`。

适用场景包括方案评审、知识库文章维护、附件审核。工作台支持导入真实文件、新建、搜索、重命名、删除、完整文本编辑、下载、评论、回复、解决与重新打开。文件、附件、正文、讨论及草稿通过 IndexedDB 保存在当前浏览器，刷新或关闭页面后可恢复；完整备份可在其他浏览器恢复为独立副本。源码组件数仍为 71。使用说明、限制和验证见[本地文件工作台记录](../collaboration-local-2026-11-10.md)。

当前工作台支持 UTF-8 纯文本、图片及浏览器原生 PDF 预览。Office、压缩包等类型提供原文件下载和文件讨论。编辑仅修改浏览器内副本，用户通过下载取得修改后的文件。基础包不内置 Office 转换、富文本引擎、实时协同传输、CRDT、权限服务或存储后端。

## 信息布局

桌面采用宽工作台：左侧文件和本文目录，中间文件工具栏与纸张式预览画布，右侧讨论筛选、线程卡片与评论输入。本文目录可定位、聚焦并高亮对应段落，也标识存在未解决讨论的段落。“工作区设置”提供本地只读模式、评论署名和备份恢复；加载与错误来自实际存储和附件读取结果。

布局按工作台容器宽度适配：1050px 以下将文件列表移到顶部，保留预览与讨论两栏；820px 以下将讨论排在预览之后；560px 以下进一步收紧间距和文件标识。正文、引用和操作支持明暗主题。加载与错误状态只替换预览画布，讨论和文件导航保持可操作。2026-11-10 界面与验证见[协作界面优化记录](../collaboration-ui-2026-11-10.md)。

编辑保留当前文档上下文。明确区分正文与草稿，提供保存、取消、字符数与快捷键。示例文档的每个章节均可编辑；导入的文本提供完整正文编辑。编辑期间可暂存并退出，再切换文件；各文件的编辑和评论草稿分别持久保存。

评论默认显示未解决线程，允许查看全部、回复、解决与重新打开。引用保存创建时的文本快照与版本，定位使用稳定段落 id。被引用文本变化后显示“内容已更新”，保留旧引用，定位进入当前段落。读取目录或引用只改变阅读焦点；从段落发起讨论才改变评论关联，避免导航时悄然改变草稿的发送目标。正式版仍需处理段落删除、引用失效与服务端版本校验。

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
- 当前工作台已实现文本、真实图片、原生 PDF、附件下载、图片失败重试及对象 URL 清理。上面的通用 renderer 调度与 AbortSignal 接口仍为提案。

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

状态：idle → saving → idle/error/conflict。失败时保留内容；冲突时提供备份与明确确认后的重新加载，禁止静默覆盖。工作台以 IndexedDB 事务完成作为“已保存到本机”的依据，通过事务内版本标识防止多标签页覆盖，BroadcastChannel 通知空闲标签页刷新。尚未持久化时离开页面会触发浏览器确认；切换只读模式保留草稿。

默认 textarea，普通 Enter 换行；⌘/Ctrl+Enter 触发明确保存。处理 IME composition 时不提交。保存后焦点回到编辑触发器，错误关联到输入区并提供重试。富文本适配器必须自己满足键盘、焦点和内容安全契约。

工作台已实现本地异步保存、失败重试、版本冲突、正文与评论草稿恢复。上面的通用受控组件与远端保存适配尚未正式实现；本地只读模式不承担服务端鉴权。

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
- 评论归属于 fileId；切换文件不展示上一文件的线程，各文件记住上次的评论或回复目标。文件评论、段落评论与每个线程的回复草稿分别保留，取消关联返回文件评论草稿，发送只清除本次草稿。文件上的圆点提示存在未发送草稿。
- 评论草稿通过 IndexedDB 持久保存；切换文件、只读模式、刷新和关闭页面后均可恢复。正文编辑草稿同样保留。只读与版本冲突时禁止发送。
- 定位后聚焦稳定段落并高亮；引用失效时禁用定位，保留引用快照与讨论内容。
- 评论输入支持 ⌘/Ctrl+Enter 发送，组合输入事件不提交；发送后焦点保留在输入区。预览加载中或失败时禁用引用定位，恢复预览后才重新启用。
- 发送失败保留输入，requestId 用于由服务端去重；先确认成功再清空。解决失败保持 open。
- 全局 status 只播报操作结果，避免把整条讨论树设置成 live region。
- 当前工作台包含文件隔离、独立评论草稿、引用快照与版本变化提示、定位、署名与时间、回复、解决和重新打开，操作结果持久保存。权限只有本页读/写切换，无服务端鉴权。通用组件的远端发送、去重和并发解决契约仍待正式实现。

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
