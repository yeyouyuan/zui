#!/usr/bin/env node
/**
 * @zui/mcp —— ZUI 组件库 MCP server。
 *
 * 纯 stdio JSON-RPC 2.0 实现（不引 @modelcontextprotocol/sdk）：
 * 逐行读取 stdin 上的 JSON-RPC 请求，stdout 写回 response。
 *
 * 支持方法：
 *   initialize / notifications/initialized / ping / tools/list / tools/call
 *
 * tools（CONTRACTS-V3 §4）：
 *   zui_search_components   query → 匹配组件（name/description/category）
 *   zui_get_component_api   组件名 → props 签名 + 用法示例（meta.json + CONTRACTS-V3）
 *   zui_generate_code       组件名 + props → 可用 JSX 代码片段
 */

import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import process from 'node:process';

import { loadCatalog, searchComponents, resolveRepoRoot } from './tools/search.js';
import type { Catalog } from './tools/search.js';
import { getComponentApi, renderApiMarkdown } from './tools/api.js';
import { generateCode } from './tools/generate.js';

/* --------------------------------- 常量 --------------------------------- */

export const SERVER_NAME = '@zui/mcp';
export const SERVER_VERSION = '0.2.0';
const PROTOCOL_VERSION = '2024-11-05';

export const TOOL_SEARCH = 'zui_search_components';
export const TOOL_API = 'zui_get_component_api';
export const TOOL_GENERATE = 'zui_generate_code';

/** tools/list 返回的 3 个 tool 定义。 */
export const TOOLS: unknown[] = [
  {
    name: TOOL_SEARCH,
    description:
      '搜索 ZUI 组件：query 匹配组件名/描述/分类/适用场景，返回 name/description/category。query 为空时返回全部组件。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词（如 "表单"、"button"、"modal"）。空字符串返回全部组件。',
        },
        limit: {
          type: 'number',
          description: '返回条数上限，默认 10',
        },
      },
      required: ['query'],
    },
  },
  {
    name: TOOL_API,
    description:
      '查询单个 ZUI 组件的 API：props 签名（type/default/desc）+ 用法示例 + 无障碍说明。数据来自 meta.json + CONTRACTS-V3。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '组件名（如 Button、Input、Modal，大小写不敏感）',
        },
      },
      required: ['name'],
    },
  },
  {
    name: TOOL_GENERATE,
    description:
      '生成可用的 ZUI JSX 代码片段（import + 示例组件）。props 值可传字符串/数字/布尔；字符串 "{表达式}" 会原样输出为 JSX 表达式。',
    inputSchema: {
      type: 'object',
      properties: {
        component: {
          type: 'string',
          description: '组件名（如 Button）',
        },
        props: {
          type: 'object',
          description: '组件 props 键值对；true 渲染布尔属性，false 保留，null 省略，数字渲染为 {42}',
        },
        children: {
          type: 'string',
          description: 'children 文本（可选）',
        },
      },
      required: ['component'],
    },
  },
];

/* ------------------------------ JSON-RPC 类型 ------------------------------ */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

type JsonRpcId = number | string | null;

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

interface ToolContent {
  type: 'text';
  text: string;
}

interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/* ------------------------------ 工具执行 ------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ServerContext {
  root: string;
}

function runTool(
  ctx: ServerContext,
  name: string,
  args: Record<string, unknown>,
): ToolResult {
  const catalog: Catalog = loadCatalog(ctx.root);

  if (name === TOOL_SEARCH) {
    const query = typeof args.query === 'string' ? args.query : String(args.query ?? '');
    const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 10;
    const results = searchComponents(catalog, query, limit);
    return {
      content: [{ type: 'text', text: JSON.stringify({ query, count: results.length, results }, null, 2) }],
      structuredContent: { query, count: results.length, results },
    };
  }

  if (name === TOOL_API) {
    const rawName = args.name;
    if (typeof rawName !== 'string' || rawName.trim() === '') {
      return { content: [{ type: 'text', text: '参数错误：name 必须是非空字符串' }], isError: true };
    }
    const api = getComponentApi(catalog, rawName);
    if (!api.ok) {
      const hint = api.suggestions.length > 0 ? `相近组件：${api.suggestions.join('、')}` : '';
      return {
        content: [{ type: 'text', text: `${api.error}${hint ? `\n${hint}` : ''}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: renderApiMarkdown(api) }],
      structuredContent: api as unknown as Record<string, unknown>,
    };
  }

  if (name === TOOL_GENERATE) {
    const component = args.component;
    if (typeof component !== 'string' || component.trim() === '') {
      return { content: [{ type: 'text', text: '参数错误：component 必须是非空字符串' }], isError: true };
    }
    const props = isRecord(args.props) ? args.props : {};
    const children = typeof args.children === 'string' ? args.children : undefined;
    const result = generateCode(catalog, component, props, children);
    if (!result.ok) {
      const hint = result.suggestions.length > 0 ? `相近组件：${result.suggestions.join('、')}` : '';
      return {
        content: [{ type: 'text', text: `${result.error}${hint ? `\n${hint}` : ''}` }],
        isError: true,
      };
    }
    const warnings =
      result.warnings.length > 0 ? `\n\n注意：\n${result.warnings.map((w) => `- ${w}`).join('\n')}` : '';
    return {
      content: [{ type: 'text', text: `${result.code}${warnings}` }],
      structuredContent: { name: result.name, code: result.code, warnings: result.warnings },
    };
  }

  return {
    content: [{ type: 'text', text: `未知工具：${name}` }],
    isError: true,
  };
}

/* --------------------------- 请求 → 响应 核心 --------------------------- */

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  const error: JsonRpcError = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

/** 处理单条 JSON-RPC 消息；notification（无 id）返回 null。 */
export function handleRpcMessage(
  msg: unknown,
  ctx: ServerContext = { root: resolveRepoRoot() },
): JsonRpcResponse | null {
  if (!isRecord(msg)) {
    return errorResponse(null, -32600, 'Invalid Request');
  }

  const id = 'id' in msg ? (msg.id as JsonRpcId) : undefined;
  const isNotification = !('id' in msg);
  const method = msg.method;
  const params = isRecord(msg.params) ? msg.params : {};

  if (msg.jsonrpc !== '2.0' || typeof method !== 'string') {
    return isNotification ? null : errorResponse(id ?? null, -32600, 'Invalid Request');
  }

  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id: id ?? null, result });

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });

    case 'ping':
      return ok({});

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'tools/list':
      return ok({ tools: TOOLS });

    case 'tools/call': {
      const name = params.name;
      if (typeof name !== 'string' || name === '') {
        return errorResponse(id ?? null, -32602, 'Invalid params: "name" (string) is required');
      }
      const args = isRecord(params.arguments) ? params.arguments : {};
      try {
        return ok(runTool(ctx, name, args));
      } catch (err) {
        return ok({
          content: [{ type: 'text', text: `工具执行出错：${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }

    default:
      return isNotification ? null : errorResponse(id ?? null, -32601, `Method not found: ${method}`);
  }
}

/** 处理一行 stdin 文本（可为单消息或 JSON-RPC batch）。 */
export function handleLine(line: string, ctx?: ServerContext): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return JSON.stringify(errorResponse(null, -32700, 'Parse error'));
  }

  if (Array.isArray(parsed)) {
    const responses = parsed
      .map((msg) => handleRpcMessage(msg, ctx))
      .filter((r): r is JsonRpcResponse => r !== null);
    return responses.length > 0 ? JSON.stringify(responses) : null;
  }

  const response = handleRpcMessage(parsed, ctx);
  return response === null ? null : JSON.stringify(response);
}

/* ------------------------------ stdio 服务器 ------------------------------ */

interface ReadableLike {
  on(event: 'data', listener: (chunk: unknown) => void): unknown;
  on(event: 'end', listener: () => void): unknown;
  setEncoding(encoding: 'utf8'): unknown;
}

interface WritableLike {
  write(chunk: string): unknown;
}

/** 启动 stdio JSON-RPC 循环：逐行请求 → 逐行响应。 */
export function startServer(input: ReadableLike, output: WritableLike, ctx?: ServerContext): void {
  let buffer = '';
  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : String(chunk);
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (line.trim() !== '') {
        const response = handleLine(line, ctx);
        if (response !== null) output.write(`${response}\n`);
      }
      index = buffer.indexOf('\n');
    }
  });
  input.on('end', () => {
    const line = buffer.replace(/\r$/, '').trim();
    if (line !== '') {
      const response = handleLine(line, ctx);
      if (response !== null) output.write(`${response}\n`);
    }
  });
}

/* -------------------------------- 入口 -------------------------------- */

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  startServer(process.stdin, process.stdout);
}
