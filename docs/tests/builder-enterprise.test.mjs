import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src/pages/builder');
const modules = new Map();
function load(name) {
  const filename = name.endsWith('.ts') ? name : `${name}.ts`;
  if (modules.has(filename)) return modules.get(filename).exports;
  assert.ok(existsSync(filename), filename);
  const module = { exports: {} };
  modules.set(filename, module);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(
    (id) => (id.startsWith('.') ? load(resolve(dirname(filename), id)) : require(id)),
    module,
    module.exports
  );
  return module.exports;
}
const model = load(resolve(root, 'builder-model'));
const selection = load(resolve(root, 'builder-selection'));
const symbols = load(resolve(root, 'builder-symbols'));
const logic = load(resolve(root, 'builder-logic'));
const design = load(resolve(root, 'builder-design'));
const tokens = load(resolve(root, 'builder-tokens'));
const audit = load(resolve(root, 'builder-audit'));
const library = load(resolve(root, 'builder-library'));
const templates = load(resolve(root, 'builder-templates'));
const node = (id, type = 'Button', props = {}) => ({
  type,
  props: {
    id,
    ...(type === 'Button'
      ? { children: id, action: 'button', variant: 'primary', size: 'md' }
      : {}),
    ...props,
  },
});
const pageData = (content) => ({
  root: { props: { title: '设计验证', variables: [{ key: 'count', label: '计数', initial: 0 }] } },
  content,
});

test('多选只操作最外层，锁定选区原子拒绝，分组保持视觉顺序并可往返保存', () => {
  const data = pageData([node('a'), node('b'), node('c')]);
  const grouped = selection.groupSelection(data, ['c', 'a'], 'desktop');
  assert.deepEqual(
    grouped.data.content[0].props.content.map((item) => item.props.id),
    ['a', 'c']
  );
  assert.equal(grouped.data.content[1].props.id, 'b');
  assert.equal(selection.selectionRoots(grouped.data, [grouped.id, 'a']).length, 1);
  const locked = pageData([node('a', 'Button', { _editor: { locked: true } }), node('b')]);
  assert.throws(
    () => selection.styleSelection(locked, ['a', 'b'], 'desktop', { borderRadius: 20 }),
    /锁定/
  );
  assert.equal(locked.content[1].props._design, undefined);
  const copy = selection.duplicateSelection(data, ['a', 'c']);
  assert.equal(copy.ids.length, 2);
  assert.equal(new Set(copy.data.content.map((item) => item.props.id)).size, 5);
  assert.equal(selection.deleteSelection(copy.data, copy.ids).content.length, 3);
  assert.deepEqual(model.validateBuilderData(grouped.data), grouped.data);
});
test('自由布局组的坐标、分布与手机流式覆盖真实保留', () => {
  const data = pageData([node('a'), node('b'), node('c')]);
  const rects = [
    { id: 'a', x: 10, y: 20, width: 100, height: 40 },
    { id: 'b', x: 170, y: 100, width: 100, height: 50 },
    { id: 'c', x: 450, y: 50, width: 100, height: 40 },
  ];
  const grouped = selection.freeLayoutSelection(data, ['a', 'b', 'c'], 'desktop', rects);
  assert.equal(grouped.data.content[0].props._design.desktop.width, '540px');
  assert.equal(grouped.data.content[0].props.content[1].props._design.desktop.left, '160px');
  assert.equal(grouped.data.content[0].props.content[1].props._design.mobile.position, 'static');
  const next = selection.alignSelection(
    grouped.data,
    ['a', 'b', 'c'],
    'desktop',
    rects,
    'distributeX'
  );
  assert.equal(next.content[0].props.content[1].props._design.desktop.left, '230px');
  assert.throws(
    () => selection.alignSelection(data, ['a', 'b'], 'desktop', rects, 'top'),
    /自由布局/
  );
});
test('设计变量与交互状态验证安全且生成真实状态 CSS', () => {
  const values = tokens.validateTokens(tokens.starterTokens);
  const styled = pageData([
    node('a', 'Button', {
      _design: {
        desktop: { color: 'var(--z-color-token-brand)', gap: 'var(--z-token-space-section)' },
      },
      _states: {
        hover: { desktop: { backgroundColor: '#123456' } },
        focus: { mobile: { borderWidth: 2 } },
      },
    }),
  ]);
  styled.root.props.tokens = values;
  assert.deepEqual(model.validateBuilderData(styled), styled);
  const css = design.designCss(
    'a',
    styled.content[0].props._design,
    styled.content[0].props._states
  );
  assert.match(css, /:hover/);
  assert.match(css, /:focus-within/);
  assert.match(css, /data-builder-preview-state/);
  assert.match(css, /var\(--z-token-space-section\)/);
  assert.throws(() => design.validateDesign({ desktop: { gap: 'var(--z-token-fontSize-body)' } }));
  assert.throws(() =>
    tokens.validateTokens([{ key: 'bad', label: 'bad', type: 'color', value: 'url(javascript:1)' }])
  );
  assert.throws(() => design.validateStateDesign({ invalid: {} }));
});
test('主组件跨页同步保留实例覆盖和新增本地子项，更新结构与样式可验证', () => {
  let data = pageData([
    node('card', 'Container', {
      _design: { desktop: { gap: 12 } },
      content: [node('button', 'Button', { children: '主组件文字' })],
    }),
  ]);
  const symbol = symbols.createSymbol('企业卡片', data.content[0], data);
  data = symbols.linkOriginal(data, symbol, 'card');
  const other = symbols.newSymbolInstance(pageData([]), symbol, symbol.variants[0].id);
  other.node.props.content[0].props.children = '实例覆盖';
  other.node.props.content.push(
    node('local-extra', 'Typography_Text', { children: '本地附加说明' })
  );
  let workspace = {
    version: 1,
    revision: 'v1',
    activeId: 'page-a',
    symbols: [symbol],
    pages: [
      { id: 'page-a', name: 'A', updatedAt: new Date().toISOString(), data, snapshots: [] },
      {
        id: 'page-b',
        name: 'B',
        updatedAt: new Date().toISOString(),
        data: { ...other.data, content: [other.node] },
        snapshots: [],
      },
    ],
  };
  workspace.pages[0].data.content[0].props.content[0].props.children = '新主组件文字';
  workspace.pages[0].data.content[0].props._design.desktop.gap = 30;
  workspace = symbols.updateSymbol(workspace, 'page-a', 'card');
  const second = workspace.pages[1].data.content[0];
  assert.equal(workspace.symbols[0].version, 2);
  assert.equal(second.props.content[0].props.children, '实例覆盖');
  assert.equal(second.props.content[1].props.id, 'local-extra');
  assert.equal(second.props._design.desktop.gap, 30);
  assert.equal(second.props._instance.version, 2);
  assert.deepEqual(model.parseBuilderWorkspace(JSON.stringify(workspace)), workspace);
  const reset = symbols.switchSymbolVariant(
    workspace.pages[1].data,
    second.props.id,
    workspace.symbols[0],
    symbol.variants[0].id,
    true
  );
  assert.equal(reset.content[0].props.content.length, 1);
  assert.equal(reset.content[0].props.content[0].props.children, '新主组件文字');
});
test('变体切换与复制实例的映射唯一，脱离后保留设计；没有主组件的旧存档仍可读取', () => {
  const data = pageData([node('a')]);
  const symbol = symbols.createSymbol('操作按钮', data.content[0], data);
  const linked = symbols.linkOriginal(data, symbol, 'a');
  const workspace = {
    version: 1,
    revision: 'v1',
    activeId: 'page-a',
    symbols: [symbol],
    pages: [
      { id: 'page-a', name: 'A', updatedAt: new Date().toISOString(), data: linked, snapshots: [] },
    ],
  };
  const updated = symbols.updateSymbol(workspace, 'page-a', 'a', '强调');
  assert.equal(updated.symbols[0].variants.length, 2);
  const switched = symbols.switchSymbolVariant(
    updated.pages[0].data,
    'a',
    updated.symbols[0],
    symbol.variants[0].id
  );
  assert.equal(switched.content[0].props.id, 'a');
  const duplicate = selection.duplicateSelection(switched, ['a']);
  model.validateBuilderData(duplicate.data);
  const copy = duplicate.data.content[1];
  assert.equal(copy.props._instance.mapping.a, copy.props.id);
  assert.equal(
    symbols.detachSymbol(duplicate.data, copy.props.id).content[1].props._instance,
    undefined
  );
  const old = { ...workspace };
  delete old.symbols;
  assert.equal(model.parseBuilderWorkspace(JSON.stringify(old)).pages.length, 1);
});
test('受限表达式支持类型、条件和分支，拒绝任意代码及危险属性绑定', () => {
  const scope = {
    state: { count: 3, visible: true },
    query: { id: '42' },
    event: { value: '输入' },
  };
  assert.equal(logic.resolveLogicValue('{{state.count}}', scope), 3);
  assert.equal(logic.resolveLogicValue('已选 {{state.count}} 项', scope), '已选 3 项');
  assert.equal(logic.resolveLogicValue('{{state.constructor}}', scope), '');
  assert.equal(
    logic.evaluateCondition({ left: '{{state.count}}', operator: 'gte', right: '3' }, scope),
    true
  );
  assert.equal(logic.evaluateCondition({ left: '', operator: 'gte', right: '0' }, scope), false);
  assert.throws(() =>
    logic.validateNodeLogic(
      { bindings: [{ property: 'href', value: 'javascript:alert(1)' }] },
      logic.bindableProperties(model.componentProps.Button)
    )
  );
  assert.throws(() => logic.validateActions([{ type: 'script', code: 'alert(1)' }]));
  assert.throws(() => logic.validateVariables([{ key: 'constructor', label: 'bad', initial: 0 }]));
  assert.equal(
    logic.validateActions([
      {
        type: 'condition',
        condition: { left: '{{state.count}}', operator: 'gt', right: '0' },
        then: [{ type: 'increment', key: 'count', value: '1' }],
        otherwise: [],
      },
    ]).length,
    1
  );
});
test('关联实例锚点独立且复制、更新与链接对应；独立区块脱离关联但保留规范和交互依赖', () => {
  const original = node('section', 'Section', {
    anchor: 'team',
    content: [node('link', 'Button', { href: '#team' })],
  });
  const data = pageData([original]);
  data.root.props.tokens = tokens.starterTokens;
  const symbol = symbols.createSymbol('企业分区', original, data);
  const first = symbols.newSymbolInstance(pageData([]), symbol, symbol.variants[0].id);
  const second = symbols.newSymbolInstance(pageData([]), symbol, symbol.variants[0].id);
  assert.notEqual(first.node.props.anchor, second.node.props.anchor);
  assert.equal(first.node.props.content[0].props.href, `#${first.node.props.anchor}`);
  const combined = { ...first.data, content: [first.node, second.node] };
  const copy = selection.duplicateSelection(combined, [first.node.props.id]);
  const copied = copy.data.content[1];
  assert.notEqual(copied.props.anchor, first.node.props.anchor);
  assert.equal(copied.props._instance.anchors.team, copied.props.anchor);
  const reset = symbols.switchSymbolVariant(
    copy.data,
    copied.props.id,
    symbol,
    symbol.variants[0].id,
    true
  );
  assert.equal(reset.content[1].props.anchor, copied.props.anchor);
  assert.equal(reset.content[1].props.content[0].props.href, `#${copied.props.anchor}`);
  const saved = library.createSavedBlock('独立区块', first.node, [], data.root.props);
  assert.equal(saved.node.props._instance, undefined);
  const parsed = library.parseBlockLibrary(JSON.stringify([saved]))[0];
  const merged = library.mergeSavedBlockData(
    parsed,
    globalThis.structuredClone(parsed.node),
    pageData([])
  );
  assert.equal(merged.root.props.tokens[0].key, 'brand');
  assert.equal(merged.root.props.variables[0].key, 'count');
  model.validateBuilderData(reset);
});
test('页面检查定位失效变量、组件关联、数据字段、锚点与窄屏固定宽度', () => {
  const data = pageData([
    node('a', 'Button', {
      href: '#missing',
      _design: { desktop: { width: '1200px', color: 'var(--z-color-token-missing)' } },
      _logic: {
        bindings: [{ property: 'children', value: '{{state.missing}}' }],
        click: [{ type: 'navigate', pageId: 'gone' }],
      },
    }),
    node('b', 'Image', { src: '', alt: '' }),
  ]);
  const issues = audit.auditBuilderDesign(data);
  assert.ok(issues.some((item) => item.title.includes('未定义状态') && item.nodeId === 'a'));
  assert.ok(issues.some((item) => item.title.includes('不存在的页面')));
  assert.ok(issues.some((item) => item.title.includes('不存在的设计变量')));
  assert.ok(issues.some((item) => item.title.includes('固定宽度')));
  assert.ok(issues.some((item) => item.title.includes('替代说明')));
});
test('现有全部模板通过严格配置检查，页面设计检查无配置错误', () => {
  for (const template of templates.builderTemplates) {
    model.validateBuilderData(template.data);
    const errors = audit
      .auditBuilderDesign(template.data)
      .filter((issue) => issue.severity === 'error');
    assert.deepEqual(errors, [], template.name);
  }
});
