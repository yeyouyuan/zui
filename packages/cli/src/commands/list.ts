/**
 * zui list —— 列出 registry 所有组件
 */

import type { Ctx, RegistryItem } from '../index.js';

export interface ListOptions {
  ctx: Ctx;
}

export interface ListResult {
  items: RegistryItem[];
}

/** list 主流程 */
export async function list(options: ListOptions): Promise<ListResult> {
  return { items: options.ctx.allItems() };
}
