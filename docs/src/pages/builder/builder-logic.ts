export type LogicValue = string | number | boolean | null;
export interface BuilderVariable {
  key: string;
  label: string;
  initial: LogicValue;
}
export type LogicOperator =
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'notEmpty';
export interface LogicCondition {
  left: string;
  operator: LogicOperator;
  right: string;
}
export type BuilderAction =
  | { type: 'set' | 'increment'; key: string; value: string }
  | { type: 'navigate'; pageId: string }
  | { type: 'notify'; value: string; tone: 'info' | 'success' | 'error' }
  | { type: 'refresh'; source: string }
  | { type: 'download'; value: string; fileName: string }
  | { type: 'reset' }
  | {
      type: 'condition';
      condition: LogicCondition;
      then: BuilderAction[];
      otherwise: BuilderAction[];
    }
  | { type: 'confirm'; value: string; then: BuilderAction[]; otherwise: BuilderAction[] };
export interface BuilderNodeLogic {
  bindings?: { property: string; value: string }[];
  visible?: LogicCondition;
  disabled?: LogicCondition;
  click?: BuilderAction[];
  change?: BuilderAction[];
  submit?: BuilderAction[];
}
export interface LogicScope {
  state: Record<string, LogicValue>;
  query: Record<string, string>;
  event: Record<string, LogicValue>;
}
export const logicOperators: { value: LogicOperator; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lt', label: '小于' },
  { value: 'lte', label: '小于等于' },
  { value: 'contains', label: '包含' },
  { value: 'empty', label: '为空' },
  { value: 'notEmpty', label: '不为空' },
];
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
export const isVariableKey = (key: string) =>
  /^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(key) && !forbiddenKeys.has(key);
const obj = (input: unknown, label: string): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(`${label}格式错误。`);
  return input as Record<string, unknown>;
};
function text(input: unknown, label: string, max = 4000): string {
  if (typeof input !== 'string' || input.length > max)
    throw new Error(`${label}必须是 ${max} 字以内的文本。`);
  return input;
}
function exactKeys(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new Error('交互配置包含不支持的字段。');
}
export function validateVariables(input: unknown): BuilderVariable[] {
  if (!Array.isArray(input) || input.length > 50) throw new Error('每页最多配置 50 个状态变量。');
  const keys = new Set<string>();
  return input.map((value) => {
    const item = obj(value, '状态变量');
    exactKeys(item, ['key', 'label', 'initial']);
    const key = text(item.key, '变量名', 60);
    if (!isVariableKey(key) || keys.has(key))
      throw new Error('变量名需唯一，以字母开头，只能包含字母、数字和下划线。');
    keys.add(key);
    if (item.initial !== null && !['string', 'number', 'boolean'].includes(typeof item.initial))
      throw new Error('状态初值只支持文本、数字、布尔值或 null。');
    if (
      (typeof item.initial === 'number' && !Number.isFinite(item.initial)) ||
      (typeof item.initial === 'string' && item.initial.length > 10000)
    )
      throw new Error('状态初值无效或过长。');
    return { key, label: text(item.label, '状态名称', 80), initial: item.initial as LogicValue };
  });
}
export function validateCondition(input: unknown): LogicCondition {
  const item = obj(input, '条件');
  exactKeys(item, ['left', 'operator', 'right']);
  if (!logicOperators.some(({ value }) => value === item.operator))
    throw new Error('不支持此条件运算。');
  return {
    left: text(item.left, '条件左值'),
    operator: item.operator as LogicOperator,
    right: text(item.right, '条件右值'),
  };
}
export function validateActions(input: unknown, depth = 0, count = { value: 0 }): BuilderAction[] {
  if (!Array.isArray(input) || input.length > 20 || depth > 3)
    throw new Error('每组最多 20 步，分支最多嵌套 3 层。');
  return input.map((value): BuilderAction => {
    if (++count.value > 100) throw new Error('一组交互最多包含 100 个动作。');
    const item = obj(value, '动作');
    switch (item.type) {
      case 'set':
      case 'increment': {
        exactKeys(item, ['type', 'key', 'value']);
        const key = text(item.key, '目标变量', 60);
        if (!isVariableKey(key)) throw new Error('动作的目标变量名无效。');
        return { type: item.type, key, value: text(item.value, '动作值') };
      }
      case 'navigate':
        exactKeys(item, ['type', 'pageId']);
        return { type: 'navigate', pageId: text(item.pageId, '目标页面', 150) };
      case 'notify':
        exactKeys(item, ['type', 'value', 'tone']);
        if (!['info', 'success', 'error'].includes(String(item.tone)))
          throw new Error('提示类型不支持。');
        return { type: 'notify', value: text(item.value, '提示内容'), tone: item.tone as 'info' };
      case 'refresh':
        exactKeys(item, ['type', 'source']);
        return { type: 'refresh', source: text(item.source, '数据源', 60) };
      case 'download':
        exactKeys(item, ['type', 'value', 'fileName']);
        return {
          type: 'download',
          value: text(item.value, '下载内容'),
          fileName: text(item.fileName, '文件名', 100),
        };
      case 'reset':
        exactKeys(item, ['type']);
        return { type: 'reset' };
      case 'condition':
        exactKeys(item, ['type', 'condition', 'then', 'otherwise']);
        return {
          type: 'condition',
          condition: validateCondition(item.condition),
          then: validateActions(item.then, depth + 1, count),
          otherwise: validateActions(item.otherwise, depth + 1, count),
        };
      case 'confirm':
        exactKeys(item, ['type', 'value', 'then', 'otherwise']);
        return {
          type: 'confirm',
          value: text(item.value, '确认内容'),
          then: validateActions(item.then, depth + 1, count),
          otherwise: validateActions(item.otherwise, depth + 1, count),
        };
      default:
        throw new Error('动作类型不支持。');
    }
  });
}
export function validateNodeLogic(input: unknown, allowed: string[]): BuilderNodeLogic {
  const item = obj(input, '组件交互');
  exactKeys(item, ['bindings', 'visible', 'disabled', 'click', 'change', 'submit']);
  const result: BuilderNodeLogic = {};
  if (item.bindings !== undefined) {
    if (!Array.isArray(item.bindings) || item.bindings.length > 20)
      throw new Error('每个组件最多绑定 20 个属性。');
    const properties = new Set<string>();
    result.bindings = item.bindings.map((value) => {
      const binding = obj(value, '属性绑定');
      exactKeys(binding, ['property', 'value']);
      const property = text(binding.property, '绑定属性', 60);
      if (!allowed.includes(property) || properties.has(property))
        throw new Error(`属性 ${property} 不支持绑定，或重复绑定。`);
      properties.add(property);
      return { property, value: text(binding.value, '绑定表达式') };
    });
  }
  for (const key of ['visible', 'disabled'] as const)
    if (item[key] !== undefined) result[key] = validateCondition(item[key]);
  for (const key of ['click', 'change', 'submit'] as const)
    if (item[key] !== undefined) result[key] = validateActions(item[key]);
  return result;
}
export function bindableProperties(schema: Record<string, string>): string[] {
  return Object.keys(schema).filter(
    (key) =>
      !key.startsWith('_') &&
      ![
        'id',
        'content',
        'name',
        'source',
        'anchor',
        'targetId',
        'value',
        'initialView',
        'navigation',
      ].includes(key) &&
      ![
        'slot',
        'design',
        'meta',
        'logic',
        'instance',
        'states',
        'image',
        'link',
        'anchor',
        'css',
        'font',
        'color',
        'json:items',
        'json:rows',
        'sources',
        'variables',
        'tokens',
      ].includes(schema[key])
  );
}
export function references(expression: string): { scope: string; key: string }[] {
  return Array.from(
    expression.matchAll(/\{\{\s*(state|query|event)\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g),
    (match) => ({ scope: match[1], key: match[2] })
  );
}
export function resolveLogicValue(expression: string, scope: LogicScope): LogicValue {
  const lookup = (group: string, key: string): LogicValue => {
    const values = scope[group as keyof LogicScope];
    return Object.hasOwn(values, key) && !forbiddenKeys.has(key) ? values[key] : '';
  };
  const single = expression.match(/^\{\{\s*(state|query|event)\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}$/);
  if (single) return lookup(single[1], single[2]);
  const rendered = expression.replace(
    /\{\{\s*(state|query|event)\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g,
    (_, group: string, key: string) => String(lookup(group, key) ?? '')
  );
  if (rendered === 'true') return true;
  if (rendered === 'false') return false;
  if (rendered === 'null') return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(rendered) && Number.isFinite(Number(rendered)))
    return Number(rendered);
  return rendered;
}
export function evaluateCondition(condition: LogicCondition, scope: LogicScope): boolean {
  const left = resolveLogicValue(condition.left, scope),
    right = resolveLogicValue(condition.right, scope);
  switch (condition.operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''));
    case 'empty':
      return left === null || left === '';
    case 'notEmpty':
      return left !== null && left !== '';
    default: {
      if (
        left === '' ||
        left === null ||
        right === '' ||
        right === null ||
        !Number.isFinite(Number(left)) ||
        !Number.isFinite(Number(right))
      )
        return false;
      if (condition.operator === 'gt') return Number(left) > Number(right);
      if (condition.operator === 'gte') return Number(left) >= Number(right);
      if (condition.operator === 'lt') return Number(left) < Number(right);
      return Number(left) <= Number(right);
    }
  }
}
