# ZUI 质量审计与续接计划（2026-11-06）

> 本文为历史记录；当前组件数量、显示审计与待办见 [2026-11-09 审计](./quality-audit-2026-11-09.md)。

## 范围与状态

- Registry 当前有 57 个 React UI 组件和 4 个业务块。消费者检查覆盖 61 个 Registry 条目、197 个安装文件和 57 个 MCP 示例。
- 本轮修复了国际化演示页的代理 endpoint 就绪条件；DeepL 代理调用不再发送空的 `Authorization` 头。
- Popconfirm 面板现经共享浮层脱离滚动容器，并按锚点、视口和源层级定位；窄视口限制面板宽高，长文案可换行。
- Modal / Drawer 的 Esc 监听尊重已处理的事件，ColorPicker 面板优先消费 Esc；Popover 在嵌套弹窗内按源层级显示并逐层响应 Esc。补充了浮层层级、主题变量和嵌套关闭回归测试。
- DatePicker 现使用共享浮层继承局部主题与弹窗层级；嵌在 Modal 内时，日历优先响应 Esc。外层焦点陷阱的延迟初始聚焦不再抢回已移入内层浮层的焦点。
- 嵌套 Modal，以及 Modal 中的 Drawer，现按最上层顺序处理 Esc；内层关闭后焦点回到仍打开的外层。Image 预览阻止 Esc 继续冒泡到外层对话框。
- Popover 触发器仍持有焦点时，外层 Modal / Drawer 也会等待 Popover 先处理 Esc；补充了 DatePicker 在 Modal 内的 Tab 焦点回归用例。
- 此前代码审查已修正 Timeline 重复间距、Transfer 窄屏宽度，以及下拉面板在滚动容器中的裁切问题。
- 移动浏览器地址栏改变可见高度时，Modal、Drawer 和 Image 预览的高度上限现使用动态视口单位，并保留旧浏览器的 `vh` 回退；Modal 仍接受现有最大高度变量覆盖。
- Image 文档示例在 360px 窄屏下可用宽度小于示例的 320px 图片宽度，演示容器会裁切；现仅在文档演示区约束图片最大宽度，不改变组件宽度 API。
- 360px 窄屏的文档演示区原有左右各 24px 内边距，Calendar 的默认网格最小占宽约 298px，容器只剩约 278px；窄屏演示区改为左右各 12px，给日历约 302px 空间。
- Notification 窄屏列表的最大宽度原按两侧各 16px 计算，定位却用 24px，导致单侧视觉边距仅 8px；宽度限制现复用定位边距变量，左右保持一致。
- App 内置确认框现在尊重子组件已处理的 Esc：确认框里的 Select 先关闭列表，再由下一次 Esc 关闭确认框；新增回归测试。确认框内容高度为不支持 `dvh` 的浏览器补上 `vh` 回退。
- App 确认框嵌套 Modal 的 Esc 顺序经回归测试确认；确认框长按钮文案在窄屏和高缩放下可换行，按钮按内容增高。
- 国际化使用路径审计发现：有道 v3 签名错误、同一原文跨组件上下文共用缓存、ConfigProvider 初始翻译整张文案表、同批次文本逐条调用 provider、文档以浏览器密钥示例引导接入。现已修正签名、隔离缓存、按实际访问的 locale 字段请求翻译并合并同批调用，文档改为服务端代理优先。
- 国际化模板审计发现 `{year}`、`{min}` 等变量曾使整句无法翻译；现允许翻译模板，并在回填及读取缓存时校验变量集合，缺失、改名或新增变量即回退原文。ConfigProvider 已通过日期标题和表单提示的替换测试。
- OpenAI 兼容协议现明确以 `baseURL`、`key`、`model` 三项配置；域名根地址自动使用 `/v1/chat/completions`，已有 `/v1` 或代理路径保留前缀。旧的完整 `endpoint` 和 `apiKey` 写法仍可用。移除了部分兼容模型可能拒绝的固定 `temperature` 参数。
- 自定义服务端代理现在收到与 `texts` 一一对应的 `contexts`，能利用组件/角色信息翻译；服务端渲染不会触发翻译网络请求。
- 真实浏览器的 360px 页面检查发现 Calendar 外层网格曾把七个星期行排成七列，宽度约 1726px，导致日历被裁切；现外层逐周纵向排列、每周内部保留七列，日历宽度收敛为 302px。布局示例的固定 320px 容器也加了最大宽度约束。
- 真实浏览器还发现 VirtualTable 在窄屏中按列宽撑开了根容器，滚动发生在示例区之外；根容器加最大宽度后，300px 可视宽内保留 440px 内容的内部横向滚动。文档预览行加最大宽度约束，修复 Image 与 Calendar 第三个示例约 6px 的裁切。

## 2026-11-06 已验证

- `pnpm -r build`、`pnpm -r typecheck`、`pnpm -r test`、`pnpm lint` 全部通过。最终全量测试共 899 项：UI 844、CLI 24、i18n 21、MCP 5、blocks 5。
- `node registry/scripts/generate.mjs --check`、`node scripts/check-distribution.mjs`、`node scripts/check-consumer.mjs` 通过。
- 移动视口样式调整前，UI ESM 包 gzip 为 63,086 字节，低于 CI 的 65,536 字节预算。
- 上述移动视口样式调整后重新运行同一组检查，全部通过；测试仍为 899 项。UI ESM gzip 为 63,101 字节，低于 65,536 字节预算。Registry 为 61 个条目，消费者检查覆盖 197 个文件和 57 个 MCP 示例。文档图片宽度与窄屏演示区内边距调整后，文档构建、类型检查、lint 和格式检查通过。
- Notification 边距修复后，`pnpm -r build`、`pnpm -r typecheck`、`pnpm -r test`、`pnpm lint` 及分发检查通过，测试仍为 899 项；重新生成 Registry 以同步 Modal 阴影变量的换行格式，随后 Registry 与消费者检查通过。
- App 确认框嵌套 Select 修复后，完整构建、类型检查、测试、lint、Registry、分发与消费者检查通过；测试增至 900 项，UI ESM gzip 为 63,112 字节，仍低于 65,536 字节预算。
- 国际化审计和修复后，完整构建、类型检查、测试、lint、Registry、分发与消费者检查通过。共 907 项测试：UI 847、CLI 24、i18n 26、MCP 5、blocks 5；UI ESM gzip 为 63,490 字节，低于预算。
- 上述模板与 OpenAI 兼容协议调整后，`pnpm -r build`、`pnpm -r typecheck`、`pnpm -r test`、`pnpm lint`、Registry 检查、分发检查、消费者检查及本轮改动文件的 Prettier 检查通过。共 918 项测试：UI 849、CLI 24、i18n 35、MCP 5、blocks 5；UI ESM gzip 约 63.83 kB，低于 65,536 字节预算。
- 用户提供的一次性测试三要素经真实服务端请求验证：域名根地址拼接 `/v1/chat/completions`、模型 `translate`，返回 HTTP 200 和译文 `Hello`。此前 Python urllib 请求被入口以 HTTP 403 拒绝，改用 curl 按相同 Chat Completions 协议请求后成功；未验证浏览器跨域或页面内直连。测试密钥未写入项目文件。
- Calendar 与 VirtualTable 样式修复后再次通过全量构建、类型检查、918 项测试、lint、Registry、分发、消费者及格式检查。真实浏览器 360px 浅色与暗色页面确认 Calendar 宽度 302px、VirtualTable 内部横向滚动，Modal 与 DatePicker 弹层仍位于视口内。
- 真实浏览器逐一加载了 57 个组件文档页，在 360px 视口下检查页面级横向滚动、示例区宽度与页面渲染错误；所有页面均正常渲染，页面宽度未超过视口。该检查是布局筛查，不能替代逐个交互状态、长文案和 200% 缩放的视觉验收。

- 追加真实浏览器交互抽样：360px 下 Popover 焦点示例的自动聚焦、Tab 循环、Esc 焦点归还正常；Popconfirm、ColorPicker、TreeSelect 打开面板均位于视口内且无页面级横向溢出，TreeSelect 暗色面板使用暗色背景。该抽样不能替代全部 57 个组件的逐状态验收。
- 国际化测试台“清空当前缓存”现在先暂停翻译再清空，避免六条演示文案立即重新写入；真实浏览器复核显示原文且计数为 0。
- 使用用户提供的测试三要素再次从服务端调用 OpenAI 兼容 Chat Completions，HTTP 200，中文 UI 文案“请选择”返回英文“Select”；密钥未写入源码。新增可复制的 Node 服务端代理、Vite 开发转发和浏览器客户端示例，明确 baseURL、key、model 分别由服务端环境变量提供。
- 本轮新增文档与演示按钮调整后，`pnpm -r build`、`pnpm -r typecheck`、`pnpm -r test`、`pnpm lint`、Registry、分发、消费者和该文档文件的 Prettier 检查全部通过；测试仍为 918 项，UI ESM gzip 为 63.83 kB。服务端代理示例另经 `node --check` 做语法检查。
- 360px 真实浏览器发现 Modal / Drawer 页脚的 `<Close>取消</Close>` 被图标关闭按钮样式绝对定位到右上角，宽仅 32px，且 aria-label 覆盖了可见文字。现在图标用法维持右上角与本地化“关闭”标签，文字用法留在页脚并以文字作为无障碍名称；长文案可换行。Modal、Drawer 与 ConfigProvider 文档说明同步修正。窄屏浏览器复核 Modal / Drawer 页脚按钮与右上角图标用法；相关组件与 ARIA 测试通过。
- 上述修复后，完整构建、类型检查、lint、Registry、分发、消费者检查通过；重新运行全量测试通过 920 项（UI 853、CLI 24、i18n 35、MCP 5、blocks 5）。并发首次全量测试出现 App 嵌套 Modal 的一次非确定性失败，单独运行该文件与全量重跑均通过；需继续关注该用例的时序稳定性。UI ESM gzip 约 63.87 kB，低于 65,536 字节预算。
- 针对该时序点，App 内置确认框收到 Esc 时会先检查其上方是否存在打开的 Modal / Drawer 层；若有则交给内层处理。单独回归与再次全量测试均通过，未再复现同一失败。最终完整构建、类型检查、920 项测试、lint、Registry、分发、消费者和格式检查全部通过；UI ESM gzip 约 64.04 kB，仍低于 65,536 字节预算。
- 高缩放等效可视区域检查（320×400 CSS 像素，代表约 640×800 物理区域的 200% 可用空间）发现文档站顶栏在 320px 下多出约 4px 横向溢出；移动布局缩小顶栏间距并隐藏冗余“文档”标记后，页面宽度回到 320px。Modal、Drawer 打开时仍位于可视区域内，国际化页无页面级横向溢出。文档构建、lint、该 CSS 的格式检查通过。该等效视口检查不等同于真实浏览器缩放的完整验收。
- 320px 逐页静态筛查发现 Descriptions 基础示例在弹性容器内收缩为 104px，网格内容拥挤。根组件现默认填满可用宽度，并在 480px 以下把网格收为单列；真实浏览器复核 320px、360px 的三个示例均无内部右侧溢出，桌面视口保留原有 3/2/3 列。
- 国际化测试台的 OpenAI 兼容模式现要求明确填写 baseURL、key、model 才能启动，取消预填的官方模型名，切换服务商时清除旧服务商凭据及地址；服务端代理路径明确提示选 Custom。320px 浏览器确认输入区域没有页面级横向溢出，且三项未填时启动按钮禁用。此前用户提供的测试密钥没有写入源码或浏览器。
- `@zui/i18n` README 的首个生产示例现改为同源 Custom 代理，OpenAI 兼容三要素直连移至临时调试示例，避免将浏览器密钥误当成正式接入方式。
- 本轮修改后，完整构建、类型检查、920 项测试、lint、Registry、分发、消费者与修改文件格式检查通过；UI ESM gzip 约 64.04 kB，低于 65,536 字节预算。
- 320px 打开态复核：Modal 与 Drawer 面板和页脚按钮在视口内、页面无横向溢出；国际化页切换 enUS 后，Select、DatePicker、TimePicker、Pagination、Empty 与 Popconfirm 按钮文案同步变为英文；暗色确认框的背景、前景色与定位正常。这是定向交互抽样，尚非所有组件逐状态视觉验收。
- 国际化测试台新增失败后的“重试翻译”入口，并在请求进行时禁用按钮。用本地 Custom 假代理在真实浏览器里复核了 HTTP 503 → 显示错误及重试按钮 → 代理恢复后六条文案成功回填、缓存计数 6 的流程；无真实服务商密钥参与。
- 320×600 CSS 像素的真实浏览器交互抽样检查了 DatePicker、TimePicker、ColorPicker、Cascader、Popover、DropdownMenu、Popconfirm、Image 预览和 Tour 的打开态；所查弹层均位于视口内，页面无横向溢出。320×400 等效小视口再次检查了其中除 Image 外的八种弹层，边界仍在视口内；这不是原生浏览器 200% 缩放测试。
- TreeSelect 触发器原是可聚焦的无角色 div，浏览器无障碍树没有控件名称。现设为带稳定名称的 combobox，可通过 `ariaLabel` 按字段用途命名，默认沿用占位文案；320px 真浏览器确认读屏树显示“选择部门”组合框，展开树面板仍位于视口内。组件文档、meta 与契约已同步。
- 本轮 TreeSelect 修改后再次通过完整构建、类型检查、921 项测试（UI 854、CLI 24、i18n 35、MCP 5、blocks 5）、lint、Registry、分发、消费者及格式检查。UI ESM gzip 约 64.07 kB，仍低于 65,536 字节预算。
- 继续检查 TreeSelect 发现：虽然触发器已具 combobox 名称，但面板原先打开后焦点仍留在触发器，节点没有 tabIndex，键盘无法逐项浏览或选择。现打开时聚焦首项，↑↓/Home/End 导航、←→ 展开或收起、Space/Enter 选择、Esc 关闭并归还焦点，节点增加可见焦点轮廓。浏览器实际验证单选面板的打开、方向键移动、Enter 选中及焦点归还；多选和分支键盘行为由回归测试覆盖。
- 上述改动后完整构建、类型检查、923 项测试（UI 856、CLI 24、i18n 35、MCP 5、blocks 5）、lint、Registry、分发、消费者和格式检查通过；UI ESM gzip 约 64.52 kB，仍低于 65,536 字节预算。
- 国际化继续审计发现缓存键未包含凭据，同一地址及模型切换 Key 后可能沿用旧账号的译文。现将有效 OpenAI key（以及其他 provider 的鉴权字段）纳入哈希输入，不把明文凭据写入 localStorage；新增跨 Key 缓存隔离测试，i18n 包 36 项测试通过。
- 凭据缓存修复后再次通过全项目构建、类型检查、924 项测试（UI 856、CLI 24、i18n 36、MCP 5、blocks 5）、lint、Registry、分发、消费者与格式检查；UI ESM gzip 约 64.55 kB，仍低于 65,536 字节预算。
- 320px 暗色视口逐页静态筛查了文档导航中的 58 个组件页面：每页主标题正常渲染，页面及演示区均无横向溢出；浏览器控制台未见错误。Alert 页的两个 `role=alert` 是刻意展示的 warning/error 示例，不是渲染错误。该筛查未覆盖全部打开态或像素级视觉对比。
- 用户提供的专用测试三要素再次通过服务端 Chat Completions 请求验证：`https://api.fengwind.com` 拼接 `/v1/chat/completions`，`translate` 模型将“请选择”译为 “Please select”，HTTP 200。密钥未写入项目、日志或浏览器。该验证不涵盖浏览器跨域与同源代理端到端调用。
- OpenAI 适配器原先按顺序逐条等待，同批六条 UI 文案会串行请求；现最多三路并发，每条仍带独立组件上下文，并保持结果与输入顺序一致。新增并发上限及乱序完成测试；`@zui/i18n` 37 项测试、i18n / docs 类型检查及相关 lint 通过。
- 翻译测试台原将整个 `zui-translate-cache` 的条目数标为“当前”缓存，清空按钮也未明确作用范围；文案现明示这两处操作涉及浏览器全部翻译缓存。
- 本轮最终 `pnpm -r build`、`pnpm -r typecheck`、`pnpm -r test`、`pnpm lint`、Registry、分发、消费者与改动文件格式检查通过；全项目共 927 项测试（UI 856、CLI 24、i18n 37、MCP 5、blocks 5）。UI ESM gzip 约 64.70 kB，低于 65,536 字节预算。
- 构建后的 `@zui/i18n` OpenAI 适配器也用专用测试三要素做了双文案并发实测，按输入顺序返回 “Select an option” 和 “Close”；仍未在浏览器中放入测试密钥。
- 新增可执行的 `docs/translate-proxy.mjs`，文档站 Vite 开发服务把 `/api/translate` 转发给本机代理。代理校验请求、限制批量与三路上游并发，并设置 15 秒上游超时；浏览器 Custom 模式不再显示无用的 apiKey 输入。代理边界测试覆盖正常批量、错误请求、上游失败、超大请求和非法 baseURL。
- 使用专用测试三要素从真实浏览器访问文档站的 Custom 测试台，经同源 Vite 转发和本机代理调用上游模型，六条 UI 文案全部回填英文（例如“请选择”→“Please select”），浏览器缓存显示 6 条。密钥仅存在临时服务端进程环境，临时代理与 Vite 进程验收后已停止；未把密钥放入浏览器或项目文件。
- 代理新增 4 项测试后，全项目最终重跑 931 项测试通过（UI 856、CLI 24、i18n 37、MCP 5、blocks 5、docs 4）；构建、类型检查、lint、Registry、分发、消费者与格式检查通过。首次并行全量测试中 Modal 内 Drawer 的 Esc 用例出现一次超时，单文件重跑与全量重跑均通过；该时序仍需关注，不能据此断言已完全消除非确定性。
- 继续追踪上述偶发 Esc 超时，构造“内层 Drawer 已打开、焦点仍在外层 Modal 按钮”的确定性复现，原代码确实不关闭任一层：内层把外层的 Portal 误判为嵌套浮层。Modal / Drawer 现仅把不属于任何对话框层的其他 Portal 视作嵌套浮层；补充 Drawer 内嵌 Drawer 的同类回归。相关 56 项测试通过。
- 320×400 CSS 像素暗色浏览器复核基础 Modal 与 Drawer 打开态：Modal 边界为 x=16…304、y=65…335；Drawer 占 x=0…320、y=0…400。两者背景、前景均为暗色变量，页面宽度保持 320px。此为等效窄视口检查，仍未覆盖原生浏览器 200% 缩放。
- 本次修复后完整构建、类型检查、lint、Registry、分发、消费者和格式检查通过；932 项测试通过（UI 857、CLI 24、i18n 37、MCP 5、blocks 5、docs 4），UI ESM gzip 约 64.71 kB，低于 65,536 字节预算。

## 2026-11-07 最终验收

- Registry 为 66 个 UI 组件、16 个业务区块，共 82 个条目；消费者检查覆盖 236 个安装文件和 66 个 MCP 示例。
- 完整构建、类型检查、ESLint、Registry 校验、浏览器构建、七包分发检查、消费者检查与 `git diff --check` 全部通过。UI ESM gzip 为 79,686 字节，低于 CI 的 98,304 字节门槛。
- 全项目 1,179 项测试通过：UI 1,026、blocks 68、i18n 37、CLI 24、docs 8、icons 7、MCP 6、tokens 3。TablePageBlock、业务区块交互边界和 tokens 一致性原有覆盖缺口已补齐。
- 17 条 Playwright E2E 全部通过；其中自动遍历 71 个文档路由，确认 320px 暗色视口没有页面级横向溢出、页面异常或非预期控制台错误。移动菜单懒加载路由聚焦、图标详情焦点管理和桌面页内目录也通过回归。
- 真实 Chromium 复核概览、图标库与业务区块的桌面/320px、浅色/暗色状态。图标详情的选择、尺寸、线宽、颜色与复制入口布局合理；16 个业务区块无页面或卡片裁切，设置重置、订单取消和向导完成等关键交互正常。
- 修复并验证 Anchor 自定义滚动容器、Loading 减少动态效果、CodeBlock 文本与复制回退、Image fallback 无外网错误、文档页内目录、移动顶栏、概览行内代码换行、区块响应式与键盘操作等问题。终审进一步补齐 TablePage 跨页选择、Kanban 键盘操作、Timeline 子控件事件隔离、头像空 MIME 校验，以及移动菜单和图标详情的焦点边界。
- 与本次改动兼容的文件已通过 Prettier 检查；仓库全量 `prettier --check .` 仍会命中 278 个历史格式文件，适合独立格式化提交，避免与功能 diff 混合。

## 下一步

1. 整理最终提交并推送 `main`，等待 CI 与 Pages 重建后复核本次文档、`cdn/v0.2.0/` 和在线演示。
2. 完成 npm 认证并发布七包，创建并推送 `v0.2.0` tag；随后核对 npm、unpkg、Pages 与 Git tag 版本一致。
3. 单独建立格式化变更，统一 278 个历史文件并新增根 `format:check` 脚本和 CI 门禁，避免制造混合 diff。
4. 增加独立 Next.js/RSC 消费工程；继续扩展 66 个组件在原生 200% 缩放、长文案和全部打开态下的视觉矩阵。
5. 在真实服务商沙箱验证 DeepL/有道及生产代理的鉴权、限流、重试与批量性能；10 套内置语言包继续作为默认路径。
