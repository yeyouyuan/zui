import { useEffect, useState } from 'react';
import {
  bindableProperties,
  logicOperators,
  validateNodeLogic,
  validateVariables,
  type BuilderAction,
  type BuilderNodeLogic,
  type BuilderVariable,
  type LogicCondition,
} from './builder-logic';
import { componentProps, type BuilderData } from './builder-model';
import type { BuilderNode } from './builder-tree';
const defaultCondition: LogicCondition = { left: '{{state.count}}', operator: 'gt', right: '0' };
const actionLabels = {
  set: '设置状态',
  increment: '数值增减',
  condition: '条件分支',
  confirm: '确认对话框',
  notify: '消息提示',
  navigate: '跳转页面',
  refresh: '刷新数据',
  download: '下载内容',
  reset: '重置页面状态',
} as const;
const initialAction = (
  type: BuilderAction['type'],
  variable: string,
  pageId: string,
  source: string
): BuilderAction => {
  if (type === 'set' || type === 'increment')
    return { type, key: variable || 'count', value: type === 'set' ? '{{event.value}}' : '1' };
  if (type === 'condition')
    return {
      type,
      condition: { ...defaultCondition, left: `{{state.${variable || 'count'}}}` },
      then: [],
      otherwise: [],
    };
  if (type === 'confirm') return { type, value: '确认执行此操作？', then: [], otherwise: [] };
  if (type === 'notify') return { type, value: '操作完成', tone: 'success' };
  if (type === 'navigate') return { type, pageId };
  if (type === 'refresh') return { type, source };
  if (type === 'download') return { type, value: '内容', fileName: '内容.txt' };
  return { type: 'reset' };
};
function ConditionFields({
  value,
  onChange,
}: {
  value: LogicCondition;
  onChange: (value: LogicCondition) => void;
}) {
  return (
    <div className="studio-condition-fields">
      <label className="studio-control">
        <span>条件左值</span>
        <input
          aria-label="条件左值"
          value={value.left}
          onChange={(event) => onChange({ ...value, left: event.target.value })}
          placeholder="{{state.count}}"
        />
      </label>
      <label className="studio-control">
        <span>运算</span>
        <select
          aria-label="条件运算"
          value={value.operator}
          onChange={(event) =>
            onChange({ ...value, operator: event.target.value as LogicCondition['operator'] })
          }
        >
          {logicOperators.map(({ value, label }) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!['empty', 'notEmpty'].includes(value.operator) && (
        <label className="studio-control">
          <span>条件右值</span>
          <input
            aria-label="条件右值"
            value={value.right}
            onChange={(event) => onChange({ ...value, right: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}
function ActionList({
  actions,
  onChange,
  variables,
  pages,
  sources,
  depth = 0,
}: {
  actions: BuilderAction[];
  onChange: (actions: BuilderAction[]) => void;
  variables: BuilderVariable[];
  pages: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  depth?: number;
}) {
  const [kind, setKind] = useState<BuilderAction['type']>('set');
  const patch = (index: number, action: BuilderAction) =>
    onChange(actions.map((item, i) => (i === index ? action : item)));
  return (
    <div className="studio-action-list">
      {actions.map((action, index) => (
        <article className="studio-action-card" key={index}>
          <header>
            <span>{index + 1}</span>
            <strong>{actionLabels[action.type]}</strong>
            <button
              type="button"
              aria-label={`上移第 ${index + 1} 步`}
              disabled={!index}
              onClick={() => {
                const next = [...actions];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`下移第 ${index + 1} 步`}
              disabled={index === actions.length - 1}
              onClick={() => {
                const next = [...actions];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                onChange(next);
              }}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`删除第 ${index + 1} 步`}
              onClick={() => onChange(actions.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </header>
          {(action.type === 'set' || action.type === 'increment') && (
            <label className="studio-control">
              <span>目标状态</span>
              <select
                aria-label="动作目标状态"
                value={action.key}
                onChange={(event) => patch(index, { ...action, key: event.target.value })}
              >
                <option value="">选择页面状态</option>
                {variables.map((variable) => (
                  <option value={variable.key} key={variable.key}>
                    {variable.label} · {variable.key}
                  </option>
                ))}
              </select>
            </label>
          )}
          {'value' in action && (
            <label className="studio-control">
              <span>
                {action.type === 'increment' ? '步长' : action.type === 'set' ? '设置值' : '内容'}
              </span>
              <textarea
                aria-label="动作内容"
                rows={2}
                maxLength={4000}
                value={action.value}
                onChange={(event) => patch(index, { ...action, value: event.target.value })}
              />
            </label>
          )}
          {action.type === 'navigate' && (
            <label className="studio-control">
              <span>目标页面</span>
              <select
                aria-label="跳转目标页面"
                value={action.pageId}
                onChange={(event) => patch(index, { ...action, pageId: event.target.value })}
              >
                <option value="">选择页面</option>
                {pages.map((page) => (
                  <option value={page.id} key={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action.type === 'refresh' && (
            <label className="studio-control">
              <span>数据源</span>
              <select
                aria-label="刷新目标数据源"
                value={action.source}
                onChange={(event) => patch(index, { ...action, source: event.target.value })}
              >
                <option value="">选择 REST 数据源</option>
                {sources.map((source) => (
                  <option value={source.id} key={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action.type === 'notify' && (
            <label className="studio-control">
              <span>消息类型</span>
              <select
                aria-label="动作消息类型"
                value={action.tone}
                onChange={(event) =>
                  patch(index, { ...action, tone: event.target.value as 'info' })
                }
              >
                <option value="info">普通提示</option>
                <option value="success">成功提示</option>
                <option value="error">错误提示</option>
              </select>
            </label>
          )}
          {action.type === 'download' && (
            <label className="studio-control">
              <span>文件名</span>
              <input
                aria-label="动作下载文件名"
                value={action.fileName}
                onChange={(event) => patch(index, { ...action, fileName: event.target.value })}
              />
            </label>
          )}
          {action.type === 'condition' && (
            <ConditionFields
              value={action.condition}
              onChange={(condition) => patch(index, { ...action, condition })}
            />
          )}
          {(action.type === 'condition' || action.type === 'confirm') && (
            <>
              {(['then', 'otherwise'] as const).map((branch) => (
                <details key={branch} className="studio-action-branch">
                  <summary>
                    {branch === 'then'
                      ? action.type === 'confirm'
                        ? '确认后'
                        : '条件成立'
                      : action.type === 'confirm'
                        ? '取消后'
                        : '条件不成立'}{' '}
                    · {action[branch].length} 步
                  </summary>
                  <ActionList
                    actions={action[branch]}
                    variables={variables}
                    pages={pages}
                    sources={sources}
                    depth={depth + 1}
                    onChange={(steps) => patch(index, { ...action, [branch]: steps })}
                  />
                </details>
              ))}
            </>
          )}
        </article>
      ))}
      <div className="studio-action-add">
        <select
          aria-label="添加动作类型"
          value={kind}
          onChange={(event) => setKind(event.target.value as BuilderAction['type'])}
        >
          {Object.entries(actionLabels)
            .filter(([type]) => depth < 3 || !['condition', 'confirm'].includes(type))
            .map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
        </select>
        <button
          type="button"
          disabled={actions.length >= 20}
          onClick={() =>
            onChange([
              ...actions,
              initialAction(
                kind,
                variables[0]?.key || '',
                pages[0]?.id || '',
                sources[0]?.id || ''
              ),
            ])
          }
        >
          ＋ 添加动作
        </button>
      </div>
    </div>
  );
}
export function BuilderVariablesPanel({
  value,
  onChange,
}: {
  value: BuilderVariable[];
  onChange: (value: BuilderVariable[]) => void;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState('');
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <div className="studio-variable-panel">
      <p className="studio-inspector-hint">
        用于交互原型中的筛选、计数、显隐与分支。状态随页面运行重新初始化，属于前端原型。
      </p>
      {draft.map((variable, index) => (
        <fieldset className="studio-token-card" key={index}>
          <legend>页面状态 {index + 1}</legend>
          <label className="studio-control">
            <span>显示名称</span>
            <input
              aria-label={`状态 ${index + 1} 名称`}
              value={variable.label}
              onChange={(event) =>
                setDraft(
                  draft.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item
                  )
                )
              }
            />
          </label>
          <label className="studio-control">
            <span>变量名</span>
            <input
              aria-label={`状态 ${index + 1} 变量名`}
              value={variable.key}
              onChange={(event) =>
                setDraft(
                  draft.map((item, i) =>
                    i === index ? { ...item, key: event.target.value } : item
                  )
                )
              }
            />
          </label>
          <label className="studio-control">
            <span>初始值</span>
            <input
              aria-label={`状态 ${index + 1} 初始值`}
              value={
                typeof variable.initial === 'string'
                  ? variable.initial
                  : JSON.stringify(variable.initial)
              }
              onChange={(event) => {
                const raw = event.target.value;
                let initial: BuilderVariable['initial'] = raw;
                if (/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/.test(raw))
                  initial = JSON.parse(raw);
                setDraft(draft.map((item, i) => (i === index ? { ...item, initial } : item)));
              }}
            />
          </label>
          <button type="button" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>
            删除状态
          </button>
        </fieldset>
      ))}
      <div className="studio-source-actions">
        <button
          type="button"
          disabled={draft.length >= 50}
          onClick={() => {
            let key = 'count';
            while (draft.some((item) => item.key === key)) key += 'New';
            setDraft([...draft, { key, label: '新状态', initial: 0 }]);
          }}
        >
          ＋ 页面状态
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              onChange(validateVariables(draft));
              setError('');
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '状态无效。');
            }
          }}
        >
          应用页面状态
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function BuilderLogicPanel({
  node,
  data,
  pages,
  disabled,
  onChange,
}: {
  node: BuilderNode;
  data: BuilderData;
  pages: { id: string; name: string }[];
  disabled: boolean;
  onChange: (logic: BuilderNodeLogic) => void;
}) {
  const [draft, setDraft] = useState<BuilderNodeLogic>(
      (node.props._logic || {}) as BuilderNodeLogic
    ),
    [error, setError] = useState('');
  const [event, setEvent] = useState<'click' | 'change' | 'submit'>('click');
  useEffect(() => {
    setDraft((node.props._logic || {}) as BuilderNodeLogic);
    setError('');
  }, [node.props.id, node.props._logic]);
  const properties = bindableProperties(componentProps[node.type]);
  const variables = data.root.props?.variables || [];
  return (
    <fieldset disabled={disabled} className="studio-logic-panel">
      <legend className="doc-sr-only">组件交互设计</legend>
      <p className="studio-inspector-hint">
        使用 {'{{state.变量名}}'}、{'{{query.参数名}}'} 或 {'{{event.value}}'}{' '}
        绑定；文字可混排。按顺序执行动作，不运行任意脚本。
      </p>
      <section>
        <h3>属性绑定</h3>
        {(draft.bindings || []).map((binding, index) => (
          <div className="studio-binding-row" key={index}>
            <select
              aria-label={`绑定 ${index + 1} 属性`}
              value={binding.property}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  bindings: draft.bindings!.map((item, i) =>
                    i === index ? { ...item, property: event.target.value } : item
                  ),
                })
              }
            >
              {properties.map((property) => (
                <option value={property} key={property}>
                  {property}
                </option>
              ))}
            </select>
            <input
              aria-label={`绑定 ${index + 1} 表达式`}
              value={binding.value}
              placeholder="{{state.count}}"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  bindings: draft.bindings!.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label={`删除绑定 ${index + 1}`}
              onClick={() =>
                setDraft({ ...draft, bindings: draft.bindings!.filter((_, i) => i !== index) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="studio-secondary-button"
          disabled={properties.length === (draft.bindings || []).length}
          onClick={() =>
            setDraft({
              ...draft,
              bindings: [
                ...(draft.bindings || []),
                {
                  property:
                    properties.find(
                      (key) => !draft.bindings?.some((item) => item.property === key)
                    ) || properties[0],
                  value: `{{state.${variables[0]?.key || 'count'}}}`,
                },
              ],
            })
          }
        >
          ＋ 绑定属性
        </button>
      </section>
      {(['visible', 'disabled'] as const).map((key) => (
        <details className="studio-inspector-section" key={key}>
          <summary>
            {key === 'visible' ? '显示条件' : '禁用条件'}
            {draft[key] ? ' · 已配置' : ''}
          </summary>
          <div>
            <label className="studio-checkbox-label">
              <input
                type="checkbox"
                checked={!!draft[key]}
                onChange={(event) => {
                  const next = { ...draft };
                  if (event.target.checked)
                    next[key] = {
                      ...defaultCondition,
                      left: `{{state.${variables[0]?.key || 'count'}}}`,
                    };
                  else delete next[key];
                  setDraft(next);
                }}
              />
              启用条件
            </label>
            {draft[key] && (
              <ConditionFields
                value={draft[key]}
                onChange={(condition) => setDraft({ ...draft, [key]: condition })}
              />
            )}
          </div>
        </details>
      ))}
      <section>
        <h3>事件与动作</h3>
        <label className="studio-control">
          <span>触发事件</span>
          <select
            aria-label="交互触发事件"
            value={event}
            onChange={(event) => setEvent(event.target.value as 'click')}
          >
            <option value="click">点击</option>
            <option value="change">输入或选项变化</option>
            <option value="submit">表单提交</option>
          </select>
        </label>
        <ActionList
          actions={draft[event] || []}
          onChange={(actions) => setDraft({ ...draft, [event]: actions })}
          variables={variables}
          pages={pages}
          sources={(data.root.props?.datasets || []).filter((source) => source.mode === 'rest')}
        />
      </section>
      {error && (
        <p className="studio-field-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="studio-secondary-button studio-primary-button"
        onClick={() => {
          try {
            onChange(validateNodeLogic(draft, properties));
            setError('');
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : '交互配置无效。');
          }
        }}
      >
        应用交互设计
      </button>
    </fieldset>
  );
}
