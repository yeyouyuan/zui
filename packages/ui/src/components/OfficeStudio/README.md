# OfficeStudio

使用 ZUI 控件的独立文档工作台。Word 用 Tiptap / ProseMirror 编辑文档结构，Excel 使用可计算的单元格模型，PDF 使用宿主提供的分页渲染器。无需 ONLYOFFICE Docs 服务。

```tsx
import { OfficeStudio, createOfficeStudioDocument } from '@zui/react';
import '@zui/react/styles.css';

<OfficeStudio
  defaultValue={createOfficeStudioDocument('word')}
  height={780}
  onSave={async (document) => {
    await persist(document);
  }}
  onExport={async (document) => {
    await exportFile(document);
  }}
/>;
```

也可以从 `@zui/react/office-studio` 导入组件和类型。当前为尚未发布的源码新增，已发布的 0.3.0 不包含此组件。

`value / defaultValue / onChange` 管理文档模型。`onImport(file)` 与 `onCreate(kind)` 由宿主生成新的模型并更新受控 `value`。PDF 还需提供原始 `source: Blob` 和 `pdfRenderer`；新建 PDF 的原始字节由 `onCreate` 生成。Word 和 Excel 在无 `onCreate` 时可创建默认文档。

`onSave` 必须在持久化完成后返回。组件记录保存期间的输入，后续修改继续显示未保存；宿主有自动保存时可提供 `saveState`。`onExport` 将模型编码为真实文件，`onPrint` 启动宿主的文档打印流程。读取模型、保存、导出和打印前会提交当前正在编辑的输入，失败保留画布并提供重试。示例中的 `persist`、`exportFile` 等函数由应用实现。

`ref` 是 React 19 原生 ref，暴露 `getDocument()`、`save()`、`export()`、`print()`、`setFullscreen(boolean)`。Ctrl/Command S 调用保存，提供 `onPrint` 后 Ctrl/Command P 调用打印。全屏复用同一画布；`height="100%"` 需要父容器设置高度。只读模式保留查找、浏览、缩放、导出和打印，禁用模式暂停编辑与文件操作。

当前能力：

- Word：富文本格式、段落与嵌套列表、表格合并拆分、本地 PNG/JPEG 插入与缩放、默认页眉页脚、PAGE/NUMPAGES 域、当前区域查找替换、标题大纲、页设置和撤销重做。详细模型与 DOCX 边界见 [Word 内核说明](StudioWord.md)。
- Excel：单元格与选区、TSV 复制粘贴、格式、跨表公式和求和、工作表新增/重命名/删除、行列插入与删除、合并拆分、冻结行列、条件筛选、行排序、二维簇状柱状图和标准折线图、撤销重做。内部复制粘贴会调整相对引用；行列增删会调整当前与跨表引用，删除的引用变为 `#REF!`。
- PDF：分页与缩略图、缩放旋转、具有可提取文字时的全文查找、新增文字/高亮/矩形/手写笔迹、拖动删除、撤销重做及已有普通表单填写。全文查找需要 renderer session 提供 `search`；手写笔迹不提供证书数字签名。

三种编辑内核按需加载，等待时在画布位置显示加载状态，不影响文件栏和保存状态。

结构出口：`root / header / title / actions / stage / loading / status / error`，使用 `data-part`、`classNames` 和 `--z-office-studio-*` CSS 变量定制。

本地文件适配、打印和持久化演示见 `docs/src/pages/collaboration/office-studio/` 和 `#/components/office-studio`。示例保留最近 20 次保存前的版本，支持查看、导出、打印和恢复为新文件；历史版本由宿主存储维护，UI 包不自动提供这些持久化服务。适配器位于文档站，不随 `@zui/react/office-studio` 导出，也不由 CLI 的 UI 条目复制。

示例导入最大 20 MB；Excel 最多 10,000 行、256 列、32 张表和 100,000 个已使用单元格；PDF 最多 200 页。Word 没有完整自动分页、多节版式、修订或目录兼容，XLSX 不支持透视、复杂图表、图片、保护和条件格式等对象，PDF 不提供任意原文修改、重排或扫描件 OCR。文件适配器会明确拒绝无法保留的对象，完整边界见 [独立编辑器说明](../../../../../docs/office-studio.md)。

开源依赖及商用说明见 [独立编辑器说明](../../../../../docs/office-studio.md)。
