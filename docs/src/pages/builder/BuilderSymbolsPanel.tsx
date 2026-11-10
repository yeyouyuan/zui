import { useState } from 'react';
import { findInstance, type BuilderSymbol } from './builder-symbols';
import { isNodeLocked } from './builder-selection';
import { flattenNodes, nodeLabel } from './builder-tree';
import type { BuilderData } from './builder-model';
export type SymbolCommand =
  | { type: 'create'; name: string; nodeId: string }
  | { type: 'insert'; symbolId: string; variantId: string; selectedId?: string }
  | { type: 'switch'; symbolId: string; nodeId: string; variantId: string; reset?: boolean }
  | { type: 'update'; nodeId: string; variantName?: string }
  | { type: 'detach'; nodeId: string }
  | { type: 'delete'; symbolId: string };
export function BuilderSymbolsPanel({
  symbols,
  data,
  selectedId,
  onCommand,
}: {
  symbols: BuilderSymbol[];
  data: BuilderData;
  selectedId?: string;
  onCommand: (command: SymbolCommand) => void;
}) {
  const [name, setName] = useState(''),
    [variantName, setVariantName] = useState(''),
    [confirmUpdate, setConfirmUpdate] = useState(false);
  const selected = flattenNodes(data.content).find(
    ({ node }) => node.props.id === selectedId
  )?.node;
  const active = findInstance(data, selectedId);
  const symbol = symbols.find((item) => item.id === active?.instance.symbolId);
  const locked = selectedId ? isNodeLocked(data, selectedId) : false;
  return (
    <div className="studio-symbols">
      <div className="studio-enterprise-callout">
        <span>◈</span>
        <div>
          <strong>一次设计，多处复用</strong>
          <p>主组件维护结构，实例保留文字和样式覆盖。更新主组件会同步工作区内所有实例。</p>
        </div>
      </div>
      {active && symbol ? (
        <section className="studio-symbol-current">
          <span className="studio-panel-kicker">LINKED INSTANCE</span>
          <h3>{symbol.name}</h3>
          <p>主组件 v{symbol.version} · 已关联</p>
          <label className="studio-control">
            <span>组件变体</span>
            <select
              aria-label="组件实例变体"
              disabled={locked}
              value={active.instance.variantId}
              onChange={(event) =>
                onCommand({
                  type: 'switch',
                  symbolId: symbol.id,
                  nodeId: active.node.props.id,
                  variantId: event.target.value,
                })
              }
            >
              {symbol.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-batch-grid">
            <button type="button" disabled={locked} onClick={() => setConfirmUpdate(true)}>
              更新此主组件
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                onCommand({
                  type: 'switch',
                  nodeId: active.node.props.id,
                  symbolId: symbol.id,
                  variantId: active.instance.variantId,
                  reset: true,
                })
              }
            >
              重置实例覆盖
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => onCommand({ type: 'detach', nodeId: active.node.props.id })}
            >
              解除实例关联
            </button>
          </div>
          {confirmUpdate && (
            <div className="studio-symbol-confirm" role="group" aria-label="确认主组件更新">
              <p>
                将当前实例作为主组件，同步所有页面的关联实例；各实例已有的覆盖保留。此操作更新整个工作区，备份工作区可保留完整恢复点。
              </p>
              <button
                type="button"
                className="studio-primary-button"
                onClick={() => {
                  onCommand({ type: 'update', nodeId: active.node.props.id });
                  setConfirmUpdate(false);
                }}
              >
                确认同步主组件
              </button>
              <button type="button" onClick={() => setConfirmUpdate(false)}>
                取消
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (variantName.trim()) {
                onCommand({ type: 'update', nodeId: active.node.props.id, variantName });
                setVariantName('');
              }
            }}
          >
            <label className="studio-control">
              <span>将当前设计另存为变体</span>
              <input
                aria-label="新组件变体名称"
                maxLength={80}
                placeholder="例如：紧凑 / 强调 / 空状态"
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="studio-secondary-button"
              disabled={locked || !variantName.trim() || symbol.variants.length >= 12}
            >
              保存为新变体
            </button>
          </form>
        </section>
      ) : (
        <section className="studio-symbol-current">
          <h3>创建主组件</h3>
          <p className="studio-inspector-hint">
            {selected
              ? `选中：${nodeLabel(selected, selected.type)}`
              : '先在画布或图层中选择一个组件或容器。'}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selected && name.trim()) {
                onCommand({ type: 'create', name, nodeId: selected.props.id });
                setName('');
              }
            }}
          >
            <label className="studio-control">
              <span>主组件名称</span>
              <input
                aria-label="新主组件名称"
                maxLength={80}
                placeholder="项目卡片 / 筛选栏 / 页面页头"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="studio-secondary-button"
              disabled={!selected || locked || !name.trim() || symbols.length >= 50}
            >
              创建并关联选区
            </button>
          </form>
          {active && !symbol && (
            <p role="alert">
              此实例的主组件不在工作区中，请导入含主组件的备份，或解除关联后重新创建。
            </p>
          )}
          {active && !symbol && (
            <button
              type="button"
              onClick={() => onCommand({ type: 'detach', nodeId: active.node.props.id })}
            >
              解除失效关联
            </button>
          )}
        </section>
      )}
      <h3 className="studio-symbol-list-title">
        工作区主组件 <span>{symbols.length} / 50</span>
      </h3>
      {symbols.map((item) => (
        <article className="studio-symbol-card" key={item.id}>
          <header>
            <span>◈</span>
            <strong>{item.name}</strong>
            <small>v{item.version}</small>
          </header>
          <div className="studio-symbol-variants">
            {item.variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                onClick={() =>
                  onCommand({ type: 'insert', symbolId: item.id, variantId: variant.id })
                }
              >
                <span>＋</span>
                {variant.name}
              </button>
            ))}
          </div>
          <footer>
            <span>{item.variants.length} 个变体 · 含响应式与状态样式</span>
            <button type="button" onClick={() => onCommand({ type: 'delete', symbolId: item.id })}>
              移除
            </button>
          </footer>
        </article>
      ))}
      {!symbols.length && (
        <p className="studio-empty">把重复使用的模块保存为主组件，在所有页面维持一致的设计。</p>
      )}
    </div>
  );
}
