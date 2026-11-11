/**
 * 弹层 Esc 仲裁（共享机制）：
 *
 * Modal / Drawer 的 overlay（[data-zui-modal-layer]）、Popover 的 popup、
 * App 内置确认框等模态弹层在打开时通过 `registerLayer` 按打开顺序压入
 * 同一棵弹层栈，关闭/卸载时 `unregisterLayer` 弹出。各弹层的 Esc 监听
 * 只在自己 `isTopmostLayer` 为真（位于栈顶）时响应，从而保证：
 * - 多个弹层叠开时 Esc 逐层关闭最上层，而不是先开的；
 * - 下层弹层不再拦截/吞掉本应由最上层响应的 Esc。
 */

/** 按「打开顺序」排列的弹层栈（栈顶 = 最后打开的弹层） */
const layerStack: HTMLElement[] = [];

/**
 * 注册弹层（按打开顺序压栈；重复注册时移到栈顶）。
 * 返回注销函数，便于在 effect 中 `return registerLayer(node)`。
 */
export function registerLayer(element: HTMLElement): () => void {
  const existing = layerStack.indexOf(element);
  if (existing >= 0) layerStack.splice(existing, 1);
  layerStack.push(element);
  return () => unregisterLayer(element);
}

/** 注销弹层（关闭或卸载时调用） */
export function unregisterLayer(element: HTMLElement): void {
  const index = layerStack.indexOf(element);
  if (index >= 0) layerStack.splice(index, 1);
}

/** element 是否为当前仍在文档中的最顶层弹层（Esc 只应由栈顶响应） */
export function isTopmostLayer(element: HTMLElement | null | undefined): boolean {
  if (!element) return false;
  // 跳过已脱离文档但尚未注销的陈旧条目
  for (let index = layerStack.length - 1; index >= 0; index -= 1) {
    const candidate = layerStack[index];
    if (candidate.isConnected) return candidate === element;
  }
  return false;
}

/** IME 组合守卫：isComposing 或 keyCode 229（部分浏览器）期间不响应 Esc */
export function isImeComposing(event: { isComposing?: boolean; keyCode?: number }): boolean {
  return Boolean(event.isComposing) || event.keyCode === 229;
}
