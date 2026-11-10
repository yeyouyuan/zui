import { validateBuilderData, type BuilderData } from './builder-model';
import { flattenNodes, nodeLabel } from './builder-tree';
import { references, type BuilderAction, type BuilderNodeLogic } from './builder-logic';
import type { BuilderDesign, BuilderNodeMeta, BuilderStateDesign } from './builder-design';
import type { BuilderSymbol, BuilderInstance } from './builder-symbols';
import { tokenReference } from './builder-tokens';
export interface BuilderAuditIssue {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  detail: string;
  nodeId?: string;
}
export function auditBuilderDesign(
  data: BuilderData,
  pages: { id: string; name: string }[] = [],
  symbols: BuilderSymbol[] = []
): BuilderAuditIssue[] {
  const issues: BuilderAuditIssue[] = [];
  const add = (
    severity: BuilderAuditIssue['severity'],
    title: string,
    detail: string,
    nodeId?: string
  ) => issues.push({ id: `issue-${issues.length}`, severity, title, detail, nodeId });
  try {
    validateBuilderData(data);
  } catch (reason) {
    add('error', '页面配置未通过校验', reason instanceof Error ? reason.message : '属性值无效。');
  }
  const entries = flattenNodes(data.content),
    variables = new Set((data.root.props?.variables || []).map((item) => item.key));
  const sources = data.root.props?.datasets || [],
    tokens = new Set((data.root.props?.tokens || []).map(tokenReference));
  const anchors = new Map<string, string>();
  for (const { node } of entries) {
    const meta = node.props._editor as BuilderNodeMeta | undefined;
    const values = [
      meta?.htmlId,
      node.type === 'Section' ? (node.props.anchor as string) : '',
    ].filter(Boolean) as string[];
    for (const anchor of values) {
      if (anchors.has(anchor))
        add(
          'error',
          `HTML ID 重复：${anchor}`,
          '同页的 HTML ID 必须唯一，否则锚点和交互会指向错误组件。',
          node.props.id
        );
      anchors.set(anchor, node.props.id);
    }
  }
  for (const { node, parent } of entries) {
    const id = node.props.id,
      label = nodeLabel(node, node.type),
      logic = node.props._logic as BuilderNodeLogic | undefined;
    const meta = node.props._editor as BuilderNodeMeta | undefined;
    const checkExpression = (value: string) => {
      for (const reference of references(value))
        if (reference.scope === 'state' && !variables.has(reference.key))
          add(
            'error',
            `${label} 引用了未定义状态`,
            `找不到 state.${reference.key}，请在页面状态中添加，或修改表达式。`,
            id
          );
      if (
        /\{\{/.test(value.replace(/\{\{\s*(state|query|event)\.[a-zA-Z][a-zA-Z0-9_]*\s*\}\}/g, ''))
      )
        add(
          'error',
          `${label} 的表达式格式错误`,
          '支持 {{state.变量}}、{{event.value}} 和 {{query.参数}}，也可以混排文字。',
          id
        );
    };
    const checkActions = (actions: BuilderAction[]) => {
      for (const action of actions) {
        if ('value' in action) checkExpression(action.value);
        if ((action.type === 'set' || action.type === 'increment') && !variables.has(action.key))
          add('error', `${label} 的动作目标不存在`, `找不到页面状态 ${action.key}。`, id);
        if (action.type === 'navigate' && !pages.some((page) => page.id === action.pageId))
          add('error', `${label} 跳转到不存在的页面`, '重新选择目标页面，再导出多页面原型。', id);
        if (
          action.type === 'refresh' &&
          !sources.some((source) => source.id === action.source && source.mode === 'rest')
        )
          add('error', `${label} 的刷新数据源无效`, '刷新动作需要选择当前页的 REST 数据源。', id);
        if (action.type === 'condition' || action.type === 'confirm') {
          if (action.type === 'condition') {
            checkExpression(action.condition.left);
            checkExpression(action.condition.right);
          }
          checkActions(action.then);
          checkActions(action.otherwise);
        }
      }
    };
    for (const binding of logic?.bindings || []) checkExpression(binding.value);
    for (const condition of [logic?.visible, logic?.disabled])
      if (condition) {
        checkExpression(condition.left);
        checkExpression(condition.right);
      }
    for (const event of ['click', 'change', 'submit'] as const) checkActions(logic?.[event] || []);
    const instance = node.props._instance as BuilderInstance | undefined;
    if (instance) {
      const symbol = symbols.find((item) => item.id === instance.symbolId);
      if (!symbol || !symbol.variants.some((item) => item.id === instance.variantId))
        add(
          'error',
          `${label} 的主组件关联已失效`,
          '导入包含主组件的工作区，或在主组件面板解除实例关联。',
          id
        );
      else if (instance.version !== symbol.version)
        add(
          'warning',
          `${label} 使用较早的主组件版本`,
          '可切换变体或重置实例覆盖，更新到当前主组件。',
          id
        );
    }
    if (['DataTable', 'DataMetric', 'DataChart', 'RecordList', 'RecordForm'].includes(node.type)) {
      const source = sources.find((item) => item.id === node.props.source);
      if (!source)
        add('error', `${label} 未连接有效数据源`, '在数据面板建立源，再到组件属性中选择。', id);
      else {
        for (const key of [
          'field',
          'groupField',
          'valueField',
          'filterField',
          'titleField',
          'descriptionField',
          'badgeField',
        ])
          if (node.props[key] && !source.fields.some((field) => field.key === node.props[key]))
            add(
              'error',
              `${label} 的字段绑定失效`,
              `数据源中不存在 ${String(node.props[key])}。`,
              id
            );
        if (node.type === 'DataTable' && typeof node.props.columns === 'string')
          for (const field of node.props.columns
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean))
            if (!source.fields.some((item) => item.key === field))
              add('error', `${label} 引用了不存在的列`, `数据源中不存在 ${field}。`, id);
      }
    }
    if (node.type === 'Image' && !node.props.alt)
      add(
        'warning',
        '图片缺少替代说明',
        '为有意义的图片补充替代文字，帮助键盘及屏幕阅读器用户理解页面。',
        id
      );
    if (node.type === 'Button' && !String(node.props.children || '').trim())
      add('warning', '按钮缺少文字', '补充清楚描述操作结果的按钮文字。', id);
    if (
      node.type === 'Button' &&
      !meta?.hidden &&
      !node.props.href &&
      (!node.props.action || node.props.action === 'button') &&
      !logic?.click?.length &&
      !logic?.bindings?.some((binding) => binding.property === 'disabled')
    )
      add(
        'warning',
        `${label} 尚未配置交互`,
        '原型中需要操作时，在交互面板配置动作或设置跳转链接。',
        id
      );
    if (node.props.action === 'toggle' && !anchors.has(String(node.props.targetId)))
      add(
        'error',
        `${label} 的显隐目标不存在`,
        '给目标图层设置 HTML ID，并在按钮中选择同一个 ID。',
        id
      );
    if (
      typeof node.props.href === 'string' &&
      node.props.href.startsWith('#') &&
      node.props.href.length > 1 &&
      !anchors.has(node.props.href.slice(1))
    )
      add('warning', `${label} 的锚点目标不存在`, '为目标分区设置对应的 HTML ID。', id);
    const design = (node.props._design || {}) as BuilderDesign;
    const states = (node.props._states || {}) as BuilderStateDesign;
    const serialized = JSON.stringify([design, states]);
    for (const match of serialized.matchAll(
      /var\(--z-(?:color-token|token-(?:space|radius|fontSize))-[a-z-]+\)/g
    ))
      if (!tokens.has(match[0]))
        add(
          'error',
          `${label} 引用了不存在的设计变量`,
          `找不到 ${match[0]}，请恢复设计规范或解除引用。`,
          id
        );
    if (design.desktop?.position === 'absolute' && !parent)
      add(
        'warning',
        `${label} 直接在页面根节点绝对定位`,
        '建议放入相对定位的自由布局组，便于响应式适配。',
        id
      );
    if (
      typeof design.desktop?.width === 'string' &&
      /^\d+px$/.test(design.desktop.width) &&
      Number.parseInt(design.desktop.width) > 600 &&
      !design.mobile?.width
    )
      add(
        'warning',
        `${label} 的固定宽度可能溢出手机`,
        '切换手机画布，添加宽度覆盖或使用百分比宽度。',
        id
      );
  }
  if (!entries.length) add('warning', '页面内容为空', '插入组件或选择一个模板开始设计。');
  if (!entries.some(({ node }) => node.type === 'Heading' && node.props.level === 'h1'))
    add('warning', '页面缺少主标题', '建议设置一个 H1 标题，让页面的内容层次更清楚。');
  return issues;
}
