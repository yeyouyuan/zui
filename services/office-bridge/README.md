# Office 文件桥接

Node 22 服务把工作台文件副本交给 ONLYOFFICE Docs 10.0，生成带 JWT 的编辑配置，接收编辑后的文件，并记录工作区保存确认。仅使用 Node 内置模块。

在仓库根目录运行：

    node scripts/office-runtime.mjs start
    node --test docs/tests/office-bridge.test.mjs

部署方式见 [本地文档服务说明](../../deploy/office/README.md)。Compose 以只读方式挂载本目录，数据写入专用卷。修改 server.mjs 后需重启桥接进程。

## 运行配置

| 环境变量               | 默认值                | 用途                                                               |
| ---------------------- | --------------------- | ------------------------------------------------------------------ |
| JWT_SECRET             | 必填                  | 与 Docs 共享的 JWT 密钥，至少 16 字符；运行脚本生成 256 位随机密钥 |
| DOCSERVER_INTERNAL_URL | http://documentserver | 容器内健康检查、保存命令和生成文件下载                             |
| DOCSERVER_PUBLIC_URL   | http://127.0.0.1:8082 | 浏览器访问文档引擎的地址                                           |
| BRIDGE_INTERNAL_URL    | http://bridge:8790    | Docs 取件和回写可访问的桥接地址                                    |
| OFFICE_DATA_DIR        | ./.office-data        | 源文件、生成版本和会话清单的目录                                   |
| HOST / PORT            | 0.0.0.0 / 8790        | 服务监听地址；Compose 仅把端口映射到本机                           |
| DOCSERVER_VERSION      | 空                    | 引擎未提供版本信息时的备用版本标识                                 |

服务支持 DOCX、XLSX、PDF，单文件上限 20 MB。PDF 编辑配置使用 documentType 为 pdf、document.isForm 为 false，打开完整编辑界面。

健康检查先读取引擎的版本信息；该端点受限时使用带 JWT 的 POST /command 查询版本。版本查询暂时不可用时保留配置中的备用版本，不影响成功的引擎健康检查。

## 浏览器接口

浏览器写请求须带本机 HTTP(S) Origin。会话接口使用创建时返回的 accessToken，通过 X-Office-Session-Token 请求头传递。

| 方法与路径                                     | 请求                                                                                | 返回                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET /api/office/health                         | 无                                                                                  | available、documentServerUrl、version、error                        |
| POST /api/office/sessions                      | 查询参数 workspaceId、fileId、name、revision、mode=edit\|view；请求体为原文件二进制 | id、accessToken、带 JWT 的 config、sequence 为 0、稳定 key          |
| GET /api/office/sessions/:id                   | 会话凭据                                                                            | 文件标识、初始/确认版本、生成/确认序号、状态、编辑配置及最新 result |
| POST /api/office/sessions/:id/force-save       | JSON：requestId 为 UUID                                                             | accepted、noChanges、sequence、forceSaveId、requestId               |
| GET /api/office/sessions/:id/results/:sequence | 会话凭据                                                                            | 对应序号的原格式文件                                                |
| POST /api/office/sessions/:id/ack              | JSON：sequence、revision、hash（SHA-256）                                           | 更新后的会话状态                                                    |

初始 revision 为大于零的安全整数。GET 仅返回最新生成结果的 sequence、size、hash 和可选 requestId；历史结果仍能按序号下载。

## 保存确认

1. 客户端生成 UUID 并记录本次输入版本，把 UUID 传给 force-save。桥接调用 Docs 10.0 的 POST /command，把 UUID 放进签名命令的 userdata。重复 UUID 复用已有操作。
2. Docs 回写时，桥接核验能力凭据、JWT 和文件标识，下载生成文件并核验格式、容量。文件先落盘，会话清单成功写入后才更新内存并返回 error 为 0。
3. 客户端读取最新结果，核验大小与 SHA-256，并以指定 fileId 和工作区版本完成持久写入，再发送 ack。首次确认或新的生成序号需要增加工作区版本；重复确认同一序号保持相同版本。
4. 客户端以匹配 result.requestId 的回写确认对应输入版本。没有匹配标识的结果仍同步到工作区，后续输入保持待保存。相同内容复用生成序号并更新 requestId，也能确认新的保存操作。

Docs 命令错误 4 返回 noChanges 为 true。客户端须先同步 sequence 大于 ackSequence 的结果，再确认本次保存。接受命令意味着等待文件回写；“已保存到工作台”还需要浏览器持久化和 ack 成功。

回写状态 6 保存结果并保留编辑会话；状态 2 在最终文件持久化后进入 closed；状态 4 关闭无修改的会话。已关闭会话重新编辑时创建新会话。晚到的状态 1、6 回写保持最终关闭结果。

## 文件与恢复

每个会话目录保留上传源文件、内容哈希命名的生成版本和原子更新的 manifest.json。生成文件或清单失败时，已确认的序号和原件仍可读取。清单写入前生成的文件也保留，重试可继续处理。

服务重启后恢复有效清单、会话凭据哈希、确认版本和最新结果。Docs 的取件地址提供最新生成版本，用于引擎恢复；上传源文件继续保留。无法读取或结构异常的清单保存在原位置。

内部取件使用独立能力凭据，回写同时验证能力凭据与 JWT。生成文件下载限定为配置的 Docs 内部/公开来源，公开来源重写为内部来源；重定向执行相同来源检查。

## 验证

    node --check services/office-bridge/server.mjs
    node --test docs/tests/office-bridge.test.mjs

测试使用临时文件和本机模拟 Docs，覆盖三个格式的配置、JWT/来源/凭据验证、保存请求关联、重复及乱序回写、相同内容确认、版本保留、ACK 校验、容量和存储失败、重启恢复与会话关闭。真实引擎的正文、公式和 PDF 文本修改由工作台的浏览器验收另行验证。
