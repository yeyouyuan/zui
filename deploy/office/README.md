# 本地在线文档编辑服务

Word、Excel、PDF 的页面内编辑由 ONLYOFFICE Docs 10.0 提供。桥接服务负责接收文件、签发编辑配置、校验保存回调，并把保存后的原格式文件写入持久化数据卷。

在仓库根目录运行：

```sh
node scripts/office-runtime.mjs start
node scripts/office-runtime.mjs status
node scripts/office-runtime.mjs stop
```

macOS 需要 Docker CLI、Compose 和 Colima，可通过 `brew install docker docker-compose colima` 安装。运行脚本优先使用 Docker Compose 插件，也支持 Homebrew 的独立 `docker-compose`。它使用专用 Colima profile `zui-office` 和 Docker context `colima-zui-office`，保持默认 context 的原有设置；第一次创建虚拟机时分配 4 核、4 GB 内存和 40 GB 稀疏数据盘，之后复用现有配置。

首次启动会下载官方镜像并等待服务就绪，通常需要几分钟。编辑服务为 `http://127.0.0.1:8082`，文件桥接为 `http://127.0.0.1:8790`，两个端口均只绑定本机。容器通过独立 Compose 网络访问彼此。桥接代码以只读目录挂载，无需安装 Node 依赖。

`start` 自动从已安装的 `@fontsource/noto-sans-sc` 生成简体中文常规与粗体字体，保留原始名称、字形和 OFL 许可证，并记录来源及生成文件的 SHA-256。字体位于被 Git 忽略的 `deploy/office/fonts.local/`，只读挂载到 Docs 10 的自定义字体目录；脚本随后运行官方字体索引生成工具。重复启动会校验并复用字体，文件损坏时重新生成。新检出仓库应先运行 `pnpm install`。

脚本自动生成 256 位随机 JWT 密钥，保存在权限为 `0600` 的 `deploy/office/.env.local`，该文件被 Git 忽略。编辑配置、文件访问和保存回调使用同一密钥；密钥不进入前端源码或启动命令参数。保留此文件，避免重新生成密钥使正在编辑的会话失效。

Compose 项目固定为 `zui-office`。文件内容和会话清单保存在 `zui-office_bridge_data` 数据卷，DocumentServer 的数据、日志和数据库也使用独立数据卷。先在编辑器中保存，再运行 `stop`；该命令停止本项目的两个容器并保留数据。重新 `start` 会继续使用这些数据。

此实现使用保留官方品牌的 ONLYOFFICE Docs Community，适合桌面浏览器编辑。引擎采用 [AGPLv3 许可证及附加条款](https://github.com/ONLYOFFICE/DocumentServer/blob/v10.0.0/LICENSE)，可在遵守许可条件下用于企业内部商业办公。闭源产品与 SaaS 内嵌可选择 Docs Developer 商业授权；完整白标是该版本的额外付费选项。参考 [官方许可 FAQ](https://www.onlyoffice.com/license-faq) 与 [当前授权说明](https://www.onlyoffice.com/pricing)。PDF 的已有正文通过编辑器的“主页 → 编辑文本”操作修改，Word 和 Excel 使用对应的完整文档与表格编辑界面。
