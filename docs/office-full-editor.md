# Word、Excel、PDF 页面内完整编辑器

实施日期：2026-11-12。文档站 `#/collaboration` 集成自部署的 ONLYOFFICE Docs 10.0，在文档画布中直接预览和修改 DOCX、XLSX、PDF。外层工作台负责文件、保存状态、讨论和备份，文档排版、表格计算及 PDF 编辑由专业引擎提供。原生画布现已提炼为 `@zui/react` 的 `OfficeEditor` 组件，工作台和组件示例共用它，并自 v0.4.0 起正式发布。

## 发布站的免费在线 Demo

GitHub Pages 没有文件接口、保存回调或 DocumentServer。组件文档页在
`*.github.io` 上会切换到 ONLYOFFICE 官方 API 文档使用的公共演示服务：

- DocumentServer：`https://api.docs.onlyoffice.com/`
- 文档源：`https://static.onlyoffice.com/assets/docs/samples/demo.{docx,xlsx,pdf}`
- 只加载官方样例，不把本地文件上传到公共服务；会话不持久化。

这条路径用于查看 `OfficeEditor` 的实际内嵌效果。生产业务仍需按下文自部署
ONLYOFFICE Docs，将 JWT 私钥和保存回调保留在服务端。开发时可用
`?office-demo=official` 强制查看发布模式，用 `?office-demo=local` 强制查看本地完整模式。

## 可复用组件

文档站 `#/components/office-editor` 提供组件说明、签名配置接入示例及 Word、Excel、PDF 的页面内试用。GitHub Pages 模式自动打开官方在线样例且不持久化；本地完整模式在点击后创建新文件副本，保存到同一浏览器工作区，可以在文件工作区继续编辑、下载、备份或删除。

```tsx
import { OfficeEditor, type OfficeEditorConfig } from '@zui/react';

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
}
```

组件提供 API 脚本加载、原生编辑器生命周期、加载超时与重试、事件透传、业务动作状态、自定义操作栏和全屏显示。`toolbar={false}` 可嵌入已有工作台；`ref` 提供 `reload()`、`getEditor()`、`setFullscreen(boolean)`。保存和下载回调由应用实现，保存 Promise 应在生成结果持久化后才完成。

组件接收后端完整签名配置，保留其中的文件权限、编辑模式和 token。普通 token 刷新及回调引用变化保持实例；文档 key、编辑权限或模式等实质配置变化才重建。应用主动切换、重载或关闭文件前仍需完成保存。

`disabled` 暂停界面交互并保持实例，文档只读权限仍由后端签名的 `editorConfig.mode` 和 `document.permissions` 决定。普通事件订阅可以更新；依赖请求事件开启的原生菜单应在首次配置时提供完整，改变菜单能力时先保存，再显式重建。

`OfficeEditor` 不依赖当前工作区的 IndexedDB、文件桥接或本机地址，可连接业务自己的文档后端和 Docs 服务。Word、Excel、PDF 的排版与编辑能力仍由独立部署的 ONLYOFFICE 提供。

## 启动与使用

在仓库根目录启动文档服务，再启动文档站：

```sh
node scripts/office-runtime.mjs start
pnpm --filter @zui/docs dev
```

打开本地文档站的“内容协作实验室”，点击“Word 示例”“Excel 示例”“PDF 示例”，或导入自己的 `.docx`、`.xlsx`、`.pdf` 文件。导入会建立工作区副本。编辑器默认展开为大画布，“返回工作台”和“展开编辑器”调整显示范围，保留当前编辑会话。

使用编辑器原生工具栏修改正文、排版、单元格与页面内容。PDF 的已有文字编辑入口为“主页 → 编辑文本”，然后点击页面中可识别的文本区域。纯扫描图像没有现成的可编辑文字，本次未接入 OCR。

点击“保存到工作台”，等待状态显示“已保存到工作台”，再下载文件、导出备份或关闭页面。引擎内的自动保存先把编辑内容保存到文档服务，工作台还需要接收生成文件并完成浏览器存储确认。出现连接、容量或版本冲突时，使用“下载服务端副本”保留文档服务已生成的编辑文件，再处理问题。

工作区备份包含已经回写的文件及现有工作区数据；备份前应完成编辑器保存。下载得到原格式文件，工作台的保存更新导入副本，电脑上最初选择的文件仍通过下载后自行替换。

## 格式能力

| 文件          | 页面内能力                                                           | 当前集成边界                                                                      |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Word `.docx`  | 正文、字体与段落、页布局、表格、图片、页眉页脚、批注和修订等引擎功能 | 当前导入入口使用 DOCX；复杂嵌入对象、特殊字体及精细版式的兼容性以引擎实际支持为准 |
| Excel `.xlsx` | 工作表、单元格、公式、数字格式、图表、排序筛选和透视表等引擎功能     | 当前导入入口使用 XLSX；不承诺 VBA、外部数据连接等桌面专有能力完全兼容             |
| PDF `.pdf`    | 分页预览、已有可识别文本编辑、添加文字、批注、表单和页面工具         | 扫描文字需另行 OCR；加密、签名或特殊字体文档受引擎支持范围限制                    |

PDF 配置明确使用 `documentType: 'pdf'`、`document.isForm: false` 和 `editorConfig.mode: 'edit'`，让含表单的 PDF 也进入完整 PDF 编辑界面，而非仅打开表单填写模式。

当前使用保留官方品牌的 ONLYOFFICE Docs Community，配置为桌面浏览器编辑器。社区版不包含移动端网页编辑器和白标能力。引擎采用 [AGPLv3 许可证及附加条款](https://github.com/ONLYOFFICE/DocumentServer/blob/v10.0.0/LICENSE)，商业版本的能力与许可应分别评估。此实现提供熟悉的在线文档编辑方式，不声称已经等价覆盖全部 WPS 功能、格式兼容性或云协作服务。

## 商用授权

按 [官方许可 FAQ](https://www.onlyoffice.com/license-faq)，Community 可以免费用于商业组织的内部办公；修改程序后通过网络提供使用时，AGPL 要向相应用户提供对应源码，并保留许可与品牌标识。将 ONLYOFFICE 源码纳入自己的产品还需遵守派生作品的许可条件。HTTP 或 iframe 调用本身不能直接证明整个应用必须开源，独立部署也不能单独证明集成没有许可义务。

对外提供闭源产品或 SaaS 编辑能力，可选择 [Docs Developer](https://www.onlyoffice.com/for-developers)。官方 [当前授权 FAQ](https://www.onlyoffice.com/pricing) 明确该版本支持 SaaS 内嵌并保持自己的代码私有；Enterprise 面向企业部署与支持，授权用途不同。完整白标是 Developer 的额外付费选项，Enterprise 不提供这一选项。

ZUI 组件通过官方 API 连接独立文档服务，未复制引擎源码。本机示例继续使用 Community 并保留官方品牌；购买及部署商业许可不在本次实施范围内。当前安装的版本对应 [v10.0.0 LICENSE](https://github.com/ONLYOFFICE/DocumentServer/blob/v10.0.0/LICENSE)。

## 文件保存与会话

文档打开时，工作台把文件副本发送到本机桥接服务。桥接服务提供 DocumentServer 可读取的 HTTP 文件地址、带 JWT 的编辑配置和保存回调地址，文件内容不会放进 iframe 参数或前端源码。

保存链路以文档服务生成文件、桥接服务持久写入、浏览器校验文件大小与 SHA-256、工作区版本校验、IndexedDB 写入确认为完成条件。保存请求使用独立的 `requestId`，避免把其他回调误认为本次保存完成。工作区原文件版本变化时保留服务端副本并报告冲突，交由用户处理。

编辑器活动期间保持稳定的 document key，普通保存不应重建 iframe。会话凭据保存在当前站点的浏览器存储中，桥接清单与文件版本保存在持久化数据卷中，用于断开后恢复和未确认结果回写。旧版浏览器编辑器的 Office 草稿仍保留兼容导出路径；迁移后的文件完成保存确认后才能移除原草稿。

单文件上限为 20 MB，工作区文件总量为 100 MB。工作区数据按浏览器和站点来源隔离，切换主机名、端口或浏览器后应通过工作区备份迁移。当前工作台提供本机使用闭环；引擎的多人编辑能力尚未接入应用级账号、共享权限或远端工作区。

## 界面与操作契合（2026-11-13）

工作台与 `OfficeEditor` 外层 chrome 已对齐 `OfficeStudio` 的界面语言：文件栏按文档族使用主题色标题栏（Word 蓝、Excel 绿、PDF 红），状态以圆点加文字呈现（已保存 / 正在保存 / 编辑中 / 需要处理），错误条使用 danger-subtle 配色；样式全部使用 ZUI 设计令牌，展开态的层级取 `--z-z-modal`。

文件操作收进「文件」下拉菜单（保存到工作台、下载文件、展开/返回工作台），主栏保留主保存按钮与「自动保存」开关。菜单没有打印项：原生打印由 ONLYOFFICE 画布自己提供，父层 `window.print()` 无法贯通 iframe。保存状态文案与按钮的可访问名与既有测试契约保持一致。

快捷键有两个路径：外层 chrome 聚焦时 Ctrl/Cmd+S 由工作台接管并触发保存到工作台；焦点在原生画布内时，键盘事件不会冒泡出 iframe，由 ONLYOFFICE 自己的 Ctrl+S 走引擎保存回调，最终汇入同一套桥接回写。两条路径都会在保存完成后把状态置为「已保存到工作台」。

自动保存默认开启：会话有未保存修改且空闲 5 秒后，由既有轮询器回写工作区；开关关闭时不自动回写，手动保存与切换前的排空保存不受影响。开关状态持久化在 `zui-office-autosave-v1`。

`OfficeEditor` 组件新增两个可选 props：`kind` 设置外层主题色；`customization` 以逐键填充方式补全 `editorConfig.customization`（后端已有值优先，token 契约不变），本机工作台默认传入 `compactHeader: true` 与 `hideRightMenu: true`，让原生界面更贴合外层；修改 `customization` 会重建实例。

## 本机部署

部署文件见 [本地文档服务说明](../deploy/office/README.md)。两个服务通过专用 Compose 网络通信：

| 服务                      | 本机地址                | 持久化内容                               |
| ------------------------- | ----------------------- | ---------------------------------------- |
| ONLYOFFICE DocumentServer | `http://127.0.0.1:8082` | 引擎数据、日志和数据库                   |
| 文件桥接                  | `http://127.0.0.1:8790` | 上传源文件、生成结果、会话清单和保存确认 |

两端口均只绑定本机。macOS 通过 Docker CLI、Compose 和 Colima 运行，专用 profile 为 `zui-office`、context 为 `colima-zui-office`，Compose 项目固定为 `zui-office`。脚本复用现有专用运行环境，独立 Compose 命令不会切换用户的默认 Docker context。

首次 `start` 生成随机 JWT 密钥，写入权限为 `0600`、被 Git 忽略的 `deploy/office/.env.local`。DocumentServer 和桥接服务使用同一密钥，JWT 保持开启。私有地址取件仅用于两个容器之间的文件传递。桥接代码只读挂载，保存内容写入专用数据卷。

```sh
node scripts/office-runtime.mjs status
node scripts/office-runtime.mjs stop
```

`status` 检查容器与健康端点；`stop` 停止本项目容器并保留数据卷。再次 `start` 继续使用这些数据。

工作台通过 `/api/office` 访问桥接服务，本地开发与预览服务器需要提供该代理。GitHub Pages 等静态托管只发布文档站，不能运行 DocumentServer 或桥接服务；完整编辑器按本机部署使用。远端部署需要另外配置服务地址、反向代理及应用认证。

## 实现与验证入口

- [OfficeEditor](../packages/ui/src/components/OfficeEditor/OfficeEditor.tsx)：公共组件、原生画布及业务回调。
- [OfficeWorkbench](src/pages/collaboration/office/OfficeWorkbench.tsx)：组件接入、文件保存状态和恢复动作。
- [组件文档页](src/pages/components/OfficeEditorPage.tsx)：可复用接入示例与独立新文件试用。
- [office-client](src/pages/collaboration/office/office-client.ts)：会话恢复、保存请求、结果校验与工作区确认。
- [文件桥接服务](../services/office-bridge/server.mjs)：编辑配置、JWT、文件读写、回调和持久化清单。
- [运行脚本](../scripts/office-runtime.mjs)与 [Compose 配置](../deploy/office/compose.yaml)：服务启动、检查与停止。
- [首版浏览器编辑记录](office-preview-2026-11-12.md)：旧导出模块和草稿迁移背景，不作为完整引擎的当前能力说明。

类型、构建和服务配置可按以下命令检查：

```sh
pnpm --filter @zui/docs typecheck
pnpm --filter @zui/docs build
node --test docs/tests/office-bridge.test.mjs
node --check services/office-bridge/server.mjs
node --check scripts/office-runtime.mjs
git diff --check
```

本次代码与本机服务检查结果见 [2026-11-12 验证记录](office-verification-2026-11-12.md)。运行构建后的页面可使用：

```sh
pnpm --filter @zui/docs build
pnpm --filter @zui/docs preview --host 127.0.0.1 --port 5174 --strictPort
```

打开 `http://127.0.0.1:5174/#/collaboration`。预览服务器与开发服务器均配置文件桥接代理。

完整编辑验收应同时覆盖真实 DOCX 正文修改、XLSX 单元格与公式修改、PDF 已有文字修改，并读取下载文件确认写入结果；另外检查保存后重新打开、旧草稿迁移、只读、连接失败、并发保存和版本冲突。首版浏览器导出模块的历史测试不能替代完整引擎的验收。
