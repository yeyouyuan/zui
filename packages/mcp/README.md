# @zui/mcp

> v0.3.0 发布到 GitHub Packages：`@yeyouyuan/zui-mcp`，npmjs 暂不发布。先在项目 `.npmrc` 配置 `@yeyouyuan:registry=https://npm.pkg.github.com`，再用拥有包读取权限的 GitHub 账号登录。

```bash
npm login --scope=@yeyouyuan --auth-type=legacy --registry=https://npm.pkg.github.com
pnpm add @zui/mcp@npm:@yeyouyuan/zui-mcp@0.3.0
```

源码导入继续使用 `@zui/mcp`。完整认证和安装说明见仓库 [GitHub Packages 文档](https://github.com/yeyouyuan/zui/blob/main/docs/GITHUB-PACKAGES.md)。

ZUI 组件库 MCP（Model Context Protocol）server：纯 stdio JSON-RPC 2.0 实现（不引
`@modelcontextprotocol/sdk`），让 Claude Desktop / Cursor 等 MCP 客户端直接查询 ZUI 组件、
生成可用 JSX 代码。数据源为 `packages/ui/src/components/<Name>/meta.json`（AI 翻译组产出）+
`CONTRACTS-V3.md` + `docs/public/llms.txt`。

## 安装 / 构建

```bash
pnpm --filter @zui/mcp build     # tsc → dist/index.js（bin: zui-mcp）
```

无需额外运行时依赖；Node.js >= 18。

## 启动方式（stdio）

server 通过 **stdin 逐行读 JSON-RPC 请求、stdout 逐行写响应**（协议版本 `2024-11-05`）。
MCP 客户端以子进程方式拉起它。命令等价于 `node packages/mcp/dist/index.js`。

## 配置示例

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或
`%APPDATA%\Claude\claude_desktop_config.json`（Windows），加入 `mcpServers`：

```json
{
  "mcpServers": {
    "zui": {
      "command": "node",
      "args": ["/绝对路径/到/zui/packages/mcp/dist/index.js"],
      "env": {
        "ZUI_ROOT": "/绝对路径/到/zui"
      }
    }
  }
}
```

重启 Claude Desktop 后，对话中即可看到 `zui_search_components` 等 3 个 tool。

### Cursor

编辑项目根的 `.cursor/mcp.json`（或全局 `~/.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "zui": {
      "command": "node",
      "args": ["./packages/mcp/dist/index.js"],
      "env": {
        "ZUI_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

`ZUI_ROOT` 指向 monorepo 根（含 `CONTRACTS-V3.md` / `packages/ui/src/components`）；
不设置时 server 会从自身文件位置向上自动探测。

## 3 个 tool 用法

### 1. `zui_search_components` — 搜索组件

| 参数    | 类型           | 说明                                                 |
| ------- | -------------- | ---------------------------------------------------- |
| `query` | string（必填） | 关键词（如 "表单"、"button"、"modal"）；空串返回全部 |
| `limit` | number         | 返回条数上限，默认 10                                |

返回：`{ query, count, results: [{ name, description, category }] }`。

### 2. `zui_get_component_api` — 查询组件 API

| 参数   | 类型           | 说明                                          |
| ------ | -------------- | --------------------------------------------- |
| `name` | string（必填） | 组件名（Button、Input、Modal…，大小写不敏感） |

返回：markdown 格式的 props 签名（type/default/desc）+ 用法示例 + 无障碍说明 +
适用/不适用场景（来自 `meta.json` + `CONTRACTS-V3`）。未知组件返回相近组件建议。

### 3. `zui_generate_code` — 生成 JSX 代码片段

| 参数        | 类型           | 说明                                                                                                         |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `component` | string（必填） | 组件名                                                                                                       |
| `props`     | object         | props 键值对；true 渲染布尔属性、false/null 省略、数字渲染 `{42}`；字符串 `"{表达式}"` 原样输出为 JSX 表达式 |
| `children`  | string         | children 文本（可选）                                                                                        |

返回：`import` + 示例组件的可用 JSX；props 与 meta 声明不符时附 `warnings`。

## 调用示例（JSON-RPC 直连）

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"zui_search_components","arguments":{"query":"表单"}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"zui_generate_code","arguments":{"component":"Button","props":{"variant":"primary","loading":"{isLoading}"},"children":"提交"}}}
```

（逐行写入 `node packages/mcp/dist/index.js` 的 stdin，即逐行收到响应。）

## 其他

- `initialize` / `notifications/initialized` / `ping` / `tools/list` / `tools/call` 均支持；
  未知 method 返回 `-32601 Method not found`。
- 数据源解析优先级见 `packages/mcp/src/tools/search.ts`：meta.json → CONTRACTS-V3 → llms.txt。
- AI 就绪文档同步维护于 `docs/public/llms.txt`（MCP tool 列表段落）。
