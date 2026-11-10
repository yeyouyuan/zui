import { useEffect, useMemo, useState } from 'react';
import {
  starterTokens,
  tokenProperties,
  tokenReference,
  tokenTypes,
  validateTokens,
  type BuilderToken,
} from './builder-tokens';
import { styleSelection } from './builder-selection';
import type { BuilderData } from './builder-model';
import type { BuilderBreakpoint, BuilderStyles } from './builder-design';

export function BuilderDesignSystemPanel({
  data,
  selectedIds,
  breakpoint,
  onData,
  onApplyAll,
  onNotice,
}: {
  data: BuilderData;
  selectedIds: string[];
  breakpoint: BuilderBreakpoint;
  onData: (data: BuilderData) => boolean;
  onApplyAll: (tokens: BuilderToken[]) => void;
  onNotice: (message: string) => void;
}) {
  const tokens = useMemo(() => data.root.props?.tokens || [], [data.root.props?.tokens]);
  const [draft, setDraft] = useState(tokens);
  const [error, setError] = useState('');
  const [applyKey, setApplyKey] = useState(tokens[0]?.key || '');
  const [property, setProperty] = useState('color');
  useEffect(() => {
    setDraft(tokens);
    setError('');
  }, [tokens]);
  const chosen = tokens.find((token) => token.key === applyKey) || tokens[0];
  const properties = chosen ? tokenProperties[chosen.type] : [];
  const used = JSON.stringify(data.content);
  const update = (index: number, patch: Partial<BuilderToken>) =>
    setDraft((previous) =>
      previous.map((token, i) => (i === index ? { ...token, ...patch } : token))
    );
  const validate = () => {
    const clean = validateTokens(draft);
    for (const token of tokens)
      if (
        !clean.some((item) => item.key === token.key && item.type === token.type) &&
        used.includes(tokenReference(token))
      )
        throw new Error(`“${token.label}”仍被页面引用，请先解除绑定。`);
    return clean;
  };
  return (
    <div className="studio-design-system">
      <p className="studio-inspector-hint">
        颜色、间距、圆角和字号用同一套命名变量管理。修改变量后，所有引用立即更新，导出 HTML
        保留关联。
      </p>
      <div className="studio-source-actions">
        <button
          type="button"
          disabled={draft.length >= 100}
          onClick={() => {
            let key = 'new-token';
            while (draft.some((item) => item.key === key)) key += '-a';
            setDraft([...draft, { key, label: '新设计变量', type: 'color', value: '#6051d6' }]);
          }}
        >
          ＋ 设计变量
        </button>
        <button
          type="button"
          onClick={() =>
            setDraft([
              ...draft,
              ...starterTokens.filter((token) => !draft.some((item) => item.key === token.key)),
            ])
          }
        >
          加入企业基础规范
        </button>
      </div>
      {draft.map((token, index) => (
        <fieldset className="studio-token-card" key={index}>
          <legend>
            {tokenTypes[token.type]} · {index + 1}
          </legend>
          <div className="studio-controls-grid">
            <label className="studio-control">
              <span>变量名称</span>
              <input
                aria-label={`设计变量 ${index + 1} 名称`}
                maxLength={80}
                value={token.label}
                onChange={(event) => update(index, { label: event.target.value })}
              />
            </label>
            <label className="studio-control">
              <span>变量标识</span>
              <input
                aria-label={`设计变量 ${index + 1} 标识`}
                maxLength={40}
                value={token.key}
                readOnly={tokens.some((item) => item.key === token.key)}
                onChange={(event) => update(index, { key: event.target.value })}
              />
            </label>
            <label className="studio-control">
              <span>类型</span>
              <select
                aria-label={`设计变量 ${index + 1} 类型`}
                value={token.type}
                disabled={tokens.some((item) => item.key === token.key)}
                onChange={(event) =>
                  update(index, {
                    type: event.target.value as BuilderToken['type'],
                    value:
                      event.target.value === 'color'
                        ? '#6051d6'
                        : event.target.value === 'fontSize'
                          ? 14
                          : 16,
                  })
                }
              >
                {Object.entries(tokenTypes).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-control">
              <span>{token.type === 'color' ? '颜色值' : '像素值'}</span>
              <input
                aria-label={`设计变量 ${index + 1} 值`}
                type={token.type === 'color' ? 'color' : 'number'}
                value={token.value}
                onChange={(event) =>
                  update(index, {
                    value:
                      token.type === 'color'
                        ? event.target.value
                        : event.target.value === ''
                          ? NaN
                          : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="studio-token-footer">
            <code>{tokenReference(token)}</code>
            <button
              type="button"
              disabled={used.includes(tokenReference(token))}
              title={used.includes(tokenReference(token)) ? '请先解除页面引用' : '删除变量'}
              onClick={() => setDraft(draft.filter((_, i) => i !== index))}
            >
              删除
            </button>
          </div>
        </fieldset>
      ))}
      {!draft.length && (
        <p className="studio-empty">
          先加入一套规范，再把变量应用到组件。多个页面可共用同一套设计规范。
        </p>
      )}
      <div className="studio-source-actions">
        <button
          type="button"
          className="studio-primary-button"
          onClick={() => {
            try {
              const clean = validate();
              if (
                onData({
                  ...data,
                  root: { ...data.root, props: { ...data.root.props, tokens: clean } },
                })
              ) {
                setError('');
                onNotice('设计规范已应用，所有引用同步更新。');
              }
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '规范无效。');
            }
          }}
        >
          应用设计规范
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              const clean = validate();
              onApplyAll(clean);
              setError('');
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '规范无效。');
            }
          }}
        >
          同步到全部页面
        </button>
      </div>
      {error && (
        <p className="studio-field-error" role="alert">
          {error}
        </p>
      )}
      {!!chosen && (
        <section className="studio-token-apply">
          <h3>应用到所选组件</h3>
          <label className="studio-control">
            <span>设计变量</span>
            <select
              aria-label="应用设计变量"
              value={chosen.key}
              onChange={(event) => {
                setApplyKey(event.target.value);
                const next = tokens.find((item) => item.key === event.target.value)!;
                setProperty(tokenProperties[next.type][0][0]);
              }}
            >
              {tokens.map((token) => (
                <option key={token.key} value={token.key}>
                  {token.label} · {tokenTypes[token.type]}
                </option>
              ))}
            </select>
          </label>
          <label className="studio-control">
            <span>目标属性</span>
            <select
              aria-label="设计变量目标属性"
              value={properties.some(([key]) => key === property) ? property : properties[0][0]}
              onChange={(event) => setProperty(event.target.value)}
            >
              {properties.map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="studio-secondary-button"
            disabled={!selectedIds.length}
            onClick={() => {
              try {
                const target = properties.some(([key]) => key === property)
                  ? property
                  : properties[0][0];
                if (
                  onData(
                    styleSelection(data, selectedIds, breakpoint, {
                      [target]: tokenReference(chosen),
                    } as BuilderStyles)
                  )
                )
                  onNotice(`已将“${chosen.label}”绑定到所选组件。`);
              } catch (reason) {
                onNotice(reason instanceof Error ? reason.message : '无法应用。');
              }
            }}
          >
            绑定到 {selectedIds.length} 个选中组件
          </button>
        </section>
      )}
    </div>
  );
}
