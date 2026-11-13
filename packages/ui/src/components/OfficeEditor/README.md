OfficeEditor 将完整 ONLYOFFICE Docs 编辑器嵌入 React 页面，可用于 Word、Excel、PDF 以及引擎支持的其他文档。需要可访问的独立文档引擎服务，后端负责文件地址、会话、签名配置与保存回调。

```tsx
import { useRef } from 'react';
import { OfficeEditor, type OfficeEditorConfig, type OfficeEditorHandle } from '@zui/react';
import '@zui/react/styles.css';

interface DocumentPanelProps {
  serverUrl: string;
  config: OfficeEditorConfig;
  saveDocument: () => Promise<void>;
  downloadDocument: () => Promise<void>;
}

export function DocumentPanel({
  serverUrl,
  config,
  saveDocument,
  downloadDocument,
}: DocumentPanelProps) {
  const editor = useRef<OfficeEditorHandle>(null);
  return (
    <OfficeEditor
      ref={editor}
      documentServerUrl={serverUrl}
      config={config}
      height={720}
      onSave={saveDocument}
      onDownload={downloadDocument}
      onError={(error) => console.error(error.code, error.message)}
    />
  );
}
```

`config` 来自后端。组件保持 token、document、editorConfig 等字段的值原样，只组合未参与后端签名的事件函数。配置数据会复制给原生引擎，避免引擎写入默认值污染宿主对象；复制不会改变任何签名字段的值。前端不生成 JWT，不通过重写 mode 或 permissions 切换只读权限。编辑与预览模式应由后端签名的 `editorConfig.mode` 和 `document.permissions` 决定。

默认顶栏提供 ONLYOFFICE 标识、状态圆点、重载与全屏；传入保存或下载回调后显示对应按钮。回调收到原生实例，但组件只假定它提供 `destroyEditor()`，不会猜测原生保存接口。保存 Promise 应在后端结果及宿主持久化已完成后结束。动作会去重并显示进行中状态，失败可重试同一动作，业务动作进行中禁止重载。

`kind` 为外层标题栏选择文档族主题色（Word 蓝、Excel 绿、PDF 红），与 ZUI 其他 Office 界面一致；它只影响容器外观，原生权限仍由签名配置决定。`customization` 以逐键填充的方式补全 `editorConfig.customization` 中后端未设置的键（后端已有值优先），用于紧凑工具栏、隐藏右侧设置面板等契合外层界面的默认值；修改它会重建实例，参与身份判定。

`header` 和 `toolbar` 可以是 React 节点或函数。函数获得 `OfficeEditorToolbarContext`，其中包含状态、原生实例、错误、保存/下载进度、disabled、全屏状态与操作方法。已有工作台可传 `header={false}`、`toolbar={false}`，用 `height="100%"` 填满确定高度的父容器。通过 `style={{ minHeight: 0 }}` 或 CSS 变量 `--z-office-editor-min-height` 可以覆盖默认最小高度。

`disabled` 暂停宿主动作并将画布设为 inert，不改变签名配置，也不会销毁当前文档。它用于界面暂停，文档只读权限仍由后端配置提供。全屏使用稳定的同一画布、共享滚动锁与顶层 Esc 仲裁；受控模式通过 `fullscreen` 和 `onFullscreenChange` 驱动。

同一文档的 token 轮换、配置对象引用、属性顺序、标题、展示尺寸及事件订阅更新保持原生实例。文档 key、文件地址、模式、权限或其他文档语义配置变化会重建。需要重建同 key 的会话时使用 `rebuildKey` 或 `ref.reload()`；重载始终读取最新签名配置。`ref.getEditor()` 返回当前实例，`ref.setFullscreen(value)` 请求布局变化。

`config.events` 与 `events` 一并透传；同一函数只调用一次，新的订阅可追加，移除订阅立即停止回调。组件保留传入 DocsAPI 的事件 map 并更新其属性，避免订阅变化销毁正在编辑的内容。ONLYOFFICE 的请求菜单能力在初始化时依据对应事件计算；例如新增 `onRequestClose` 会更新回调，但已有原生菜单不会随之开启。需要改变这些菜单能力时先保存，再显式重建。

脚本按规范化服务地址共享加载，失败和超时后可重试，支持 CSP nonce。每个来源缓存自己的 DocsAPI 构造器，已知其他来源的全局对象不会冒充当前服务。仅收到 `onDocumentReady` 才进入 ready 状态；卸载、重建与 React StrictMode 清理会停用旧回调并销毁相应实例。

`labels` 可覆盖界面文案，`loading` 和 `renderError(error, retry)` 提供自定义状态内容。根节点与结构槽提供 `data-part`、`classNames`，组件 CSS 变量定义在 `.z-office-editor` 上。

此目录是 ZUI 原创 React 封装，未复制文档引擎源码。ONLYOFFICE 引擎与其官方品牌、版本能力和授权由独立服务提供；更换 React 容器不会改变引擎许可。部署与授权说明见项目的完整编辑器文档，API 行为以对应服务版本为准。
