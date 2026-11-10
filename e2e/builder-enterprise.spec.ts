import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import type { BuilderData } from '../docs/src/pages/builder/builder-model';
const evidence = 'docs/audits/2026-11-10/builder-enterprise';
const button = (id: string, children = id, extra = {}) => ({
  type: 'Button',
  props: { id, children, action: 'button', ...extra },
});
const heading = (id: string, text: string, extra = {}) => ({
  type: 'Heading',
  props: { id, text, level: 'h1', ...extra },
});
const data = (content: BuilderData['content'], props = {}): BuilderData => ({
  root: {
    props: { title: '企业页面设计验证', theme: 'light', padding: 24, maxWidth: 1200, ...props },
  },
  content,
});
async function open(
  page: Page,
  initial: BuilderData,
  second = data([heading('second', '第二个设计页面')])
) {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const workspace = {
    version: 1,
    revision: 'enterprise-test',
    activeId: 'page-a',
    pages: [
      {
        id: 'page-a',
        name: '页面 A',
        updatedAt: new Date().toISOString(),
        data: initial,
        snapshots: [],
      },
      {
        id: 'page-b',
        name: '页面 B',
        updatedAt: new Date().toISOString(),
        data: second,
        snapshots: [],
      },
    ],
  };
  await page.addInitScript((value) => {
    if (!localStorage.getItem('zui-page-builder-v1'))
      localStorage.setItem('zui-page-builder-v1', value);
  }, JSON.stringify(workspace));
  await page.goto('/#/builder');
  await expect(page.locator('#preview-frame')).toBeVisible();
  await expect
    .poll(() => page.frameLocator('#preview-frame').locator('[data-builder-component]').count())
    .toBeGreaterThan(0);
}
async function current(page: Page) {
  return JSON.parse((await page.locator('.doc-builder-json').textContent())!);
}
async function layers(page: Page) {
  const button = page.getByRole('button', { name: '图层结构', exact: true });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}
function layer(page: Page, label: string) {
  return page.locator('.studio-layer-select').filter({ hasText: label });
}
async function exported(page: Page, prototype = false) {
  await page.locator('.studio-file-menu > summary').click();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: prototype ? '导出多页面原型 HTML' : '导出 HTML', exact: true })
    .click();
  return readFileSync((await (await download).path())!, 'utf8');
}
async function offline(context: BrowserContext, content: string, suffix: string) {
  const runtime = await context.newPage();
  await runtime.route('**/*', (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: content })
      : route.abort()
  );
  await runtime.goto(`http://localhost:5190/enterprise-${suffix}.html`);
  await expect(runtime.locator('.z-builder-canvas')).toBeVisible();
  return runtime;
}

test('多选设计：Shift 选层与画布、批量样式一次撤销、自由布局对齐、手机自动流式', async ({
  page,
}) => {
  await open(
    page,
    data([button('a', '业务按钮 A'), button('b', '业务按钮 B'), button('c', '业务按钮 C')])
  );
  await layers(page);
  await layer(page, '业务按钮 A').click();
  await layer(page, '业务按钮 B').click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '已选择 2 个组件' })).toBeVisible();
  await page.getByLabel('批量样式值').fill('22');
  await page.getByRole('button', { name: '应用到所选组件' }).click();
  expect(
    (await current(page)).content
      .slice(0, 2)
      .map(
        (item: { props: { _design: { desktop: { borderRadius: number } } } }) =>
          item.props._design.desktop.borderRadius
      )
  ).toEqual([22, 22]);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await current(page)).content[0].props._design?.desktop?.borderRadius).toBeUndefined();
  await layer(page, '业务按钮 A').click();
  await layer(page, '业务按钮 B').click({ modifiers: ['Shift'] });
  const canvas = page.frameLocator('#preview-frame');
  await canvas.locator('[data-puck-component="c"]').click({ modifiers: ['Shift'] });
  await expect(page.getByRole('heading', { name: '已选择 3 个组件' })).toBeVisible();
  await expect(canvas.locator('[data-builder-multiselected="true"]')).toHaveCount(3);
  const positions = await canvas.locator('[data-builder-component="Button"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    })
  );
  await page.getByRole('button', { name: '转为自由布局组', exact: true }).click();
  const grouped = await current(page);
  expect(grouped.content).toHaveLength(1);
  expect(grouped.content[0].props.content).toHaveLength(3);
  const after = await canvas
    .locator('[data-builder-component="Button"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().y));
  expect(after[1] - after[0]).toBeCloseTo(positions[1].y - positions[0].y, 0);
  await layer(page, '业务按钮 A').click();
  await layer(page, '业务按钮 B').click({ modifiers: ['Shift'] });
  await layer(page, '业务按钮 C').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '左对齐', exact: true }).click();
  const xs = await canvas
    .locator('[data-builder-component="Button"]')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(1);
  await page.getByRole('button', { name: '切换到手机画布' }).click();
  for (const item of grouped.content[0].props.content)
    expect(item.props._design.mobile.position).toBe('static');
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/multi-selection-mobile.png` });
});

test('锁定规则：批量编辑与删除不会部分修改选区', async ({ page }) => {
  await open(
    page,
    data([button('a', '锁定按钮', { _editor: { locked: true } }), button('b', '普通按钮')])
  );
  await layers(page);
  await layer(page, '锁定按钮').click();
  await layer(page, '普通按钮').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: '应用到所选组件' }).click();
  await expect(page.locator('.doc-builder-notice')).toContainText('锁定');
  expect((await current(page)).content[1].props._design).toBeUndefined();
  await page.getByRole('button', { name: '删除所选组件', exact: true }).click();
  expect((await current(page)).content).toHaveLength(2);
});

test('设计规范：变量绑定、修改联动、跨页同步、导出与真实悬停状态', async ({ page, context }) => {
  await open(page, data([button('a', '设计规范按钮')]));
  await layers(page);
  await layer(page, '设计规范按钮').click();
  await page.getByRole('button', { name: '设计规范', exact: true }).click();
  await page.getByRole('button', { name: '加入企业基础规范' }).click();
  await page.getByRole('button', { name: '应用设计规范', exact: true }).click();
  await page.getByLabel('应用设计变量').selectOption('brand');
  await page.getByLabel('设计变量目标属性').selectOption('backgroundColor');
  await page.getByRole('button', { name: '绑定到 1 个选中组件' }).click();
  await page.getByLabel('设计变量 1 值').fill('#137a6d');
  await page.getByRole('button', { name: '同步到全部页面', exact: true }).click();
  await expect.poll(async () => (await current(page)).root.props.tokens[0].value).toBe('#137a6d');
  await layers(page);
  await layer(page, '设计规范按钮').click();
  await page
    .getByRole('group', { name: '属性面板模式' })
    .getByRole('button', { name: '样式', exact: true })
    .click();
  await page.getByLabel('设计交互状态', { exact: true }).selectOption('hover');
  await page.getByLabel('背景颜色', { exact: true }).fill('#204acd');
  await page.getByLabel('背景颜色', { exact: true }).press('Tab');
  expect((await current(page)).content[0].props._states.hover.desktop.backgroundColor).toBe(
    '#204acd'
  );
  await expect(
    page.frameLocator('#preview-frame').getByRole('button', { name: '设计规范按钮' })
  ).toHaveCSS('background-color', 'rgb(32, 74, 205)');
  const runtime = await offline(context, await exported(page), 'tokens');
  await runtime.mouse.move(0, 0);
  await expect(runtime.getByRole('button', { name: '设计规范按钮' })).toHaveCSS(
    'background-color',
    'rgb(19, 122, 109)'
  );
  await runtime.getByRole('button', { name: '设计规范按钮' }).hover();
  await expect(runtime.getByRole('button', { name: '设计规范按钮' })).toHaveCSS(
    'background-color',
    'rgb(32, 74, 205)'
  );
  await page.getByLabel('当前页面', { exact: true }).selectOption('page-b');
  expect((await current(page)).root.props.tokens[0].value).toBe('#137a6d');
});

test('交互设计面板：配置状态、属性绑定和事件动作后实际运行', async ({ page, context }) => {
  await open(page, data([button('a', '点我计数')]));
  await page.getByRole('button', { name: '页面', exact: true }).last().click();
  await page.getByText('页面状态与交互变量', { exact: true }).click();
  await page.getByRole('button', { name: '＋ 页面状态', exact: true }).click();
  await page.getByLabel('状态 1 变量名').fill('count');
  await page.getByLabel('状态 1 初始值').fill('0');
  await page.getByRole('button', { name: '应用页面状态', exact: true }).click();
  await layers(page);
  await layer(page, '点我计数').click();
  await page
    .getByRole('group', { name: '属性面板模式' })
    .getByRole('button', { name: '交互', exact: true })
    .click();
  await page.getByRole('button', { name: '＋ 绑定属性', exact: true }).click();
  await page.getByLabel('绑定 1 属性').selectOption('children');
  await page.getByLabel('绑定 1 表达式').fill('已点击 {{state.count}} 次');
  await page.getByLabel('添加动作类型', { exact: true }).selectOption('increment');
  await page.getByRole('button', { name: '＋ 添加动作', exact: true }).click();
  await page.getByLabel('动作内容', { exact: true }).fill('1');
  await page.getByRole('button', { name: '应用交互设计', exact: true }).click();
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/interaction-designer.png` });
  const runtime = await offline(context, await exported(page), 'actions-ui');
  await runtime.getByRole('button', { name: '已点击 0 次' }).click();
  await runtime.getByRole('button', { name: '已点击 1 次' }).click();
  await expect(runtime.getByRole('button', { name: '已点击 2 次' })).toBeVisible();
});

test('交互原型：连续输入保留焦点、条件显隐与禁用、分支确认、下载、重置与嵌套事件边界', async ({
  page,
  context,
}) => {
  const count = (value: string) => ({ type: 'increment', key: 'count', value });
  await open(
    page,
    data(
      [
        {
          type: 'Container',
          props: {
            id: 'form-layout',
            _logic: { click: [count('100')] },
            content: [
              {
                type: 'Input',
                props: {
                  id: 'name',
                  label: '你的名字',
                  name: 'name',
                  _logic: { change: [{ type: 'set', key: 'name', value: '{{event.value}}' }] },
                },
              },
              heading('counter', '', {
                _logic: {
                  bindings: [{ property: 'text', value: '{{state.name}} · {{state.count}}' }],
                },
              }),
              button('add', '增加计数', { _logic: { click: [count('1')] } }),
              button('confirm', '确认分支', {
                _logic: {
                  click: [
                    {
                      type: 'confirm',
                      value: '确认增加？',
                      then: [count('10')],
                      otherwise: [{ type: 'notify', tone: 'info', value: '已取消' }],
                    },
                  ],
                },
              }),
              button('download', '下载状态', {
                _logic: {
                  click: [
                    {
                      type: 'download',
                      fileName: '状态.txt',
                      value: '{{state.name}} · {{state.count}}',
                    },
                  ],
                },
              }),
              button('visible', '计数达到十', {
                _logic: {
                  visible: { left: '{{state.count}}', operator: 'gte', right: '10' },
                  disabled: { left: '{{state.name}}', operator: 'empty', right: '' },
                  click: [
                    {
                      type: 'condition',
                      condition: { left: '{{state.count}}', operator: 'gte', right: '10' },
                      then: [{ type: 'notify', tone: 'success', value: '条件成立' }],
                      otherwise: [],
                    },
                  ],
                },
              }),
              button('reset', '重置状态', { _logic: { click: [{ type: 'reset' }] } }),
            ],
          },
        },
      ],
      {
        variables: [
          { key: 'name', label: '名字', initial: '' },
          { key: 'count', label: '计数', initial: 0 },
        ],
      }
    )
  );
  const runtime = await offline(context, await exported(page), 'actions');
  const errors: string[] = [];
  runtime.on('pageerror', (error) => errors.push(error.message));
  await expect(runtime.getByRole('button', { name: '计数达到十' })).toHaveCount(0);
  const input = runtime.getByLabel('你的名字', { exact: true });
  await input.pressSequentially('Ada', { delay: 30 });
  await expect(input).toHaveValue('Ada');
  await expect(input).toBeFocused();
  await expect(runtime.getByRole('heading', { name: 'Ada · 0' })).toBeVisible();
  await runtime.getByRole('button', { name: '增加计数' }).click();
  await expect(runtime.getByRole('heading', { name: 'Ada · 1' })).toBeVisible();
  await runtime.getByRole('button', { name: '确认分支' }).click();
  await runtime.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(runtime.getByRole('status').filter({ hasText: '已取消' })).toBeVisible();
  await runtime.getByRole('button', { name: '确认分支' }).click();
  await runtime.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(runtime.getByRole('heading', { name: 'Ada · 11' })).toBeVisible();
  await runtime.getByRole('button', { name: '计数达到十' }).click();
  await expect(runtime.getByRole('status').filter({ hasText: '条件成立' })).toBeVisible();
  const download = runtime.waitForEvent('download');
  await runtime.getByRole('button', { name: '下载状态' }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toBe('Ada · 11');
  await input.fill('');
  await expect(runtime.getByRole('button', { name: '计数达到十' })).toBeDisabled();
  await runtime.getByRole('button', { name: '重置状态' }).click();
  await expect(runtime.getByRole('heading', { name: '· 0' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('提交交互：保留必填校验，按顺序执行自定义动作并替代默认下载结果', async ({
  page,
  context,
}) => {
  await open(
    page,
    data(
      [
        {
          type: 'Form',
          props: {
            id: 'custom-form',
            title: '原型申请表',
            content: [
              {
                type: 'Input',
                props: {
                  id: 'applicant',
                  name: 'applicant',
                  label: '申请人',
                  required: true,
                  _logic: { change: [{ type: 'set', key: 'name', value: '{{event.value}}' }] },
                },
              },
              button('submit', '提交申请', { action: 'submit' }),
            ],
            _logic: {
              submit: [
                { type: 'increment', key: 'submissions', value: '1' },
                {
                  type: 'notify',
                  tone: 'success',
                  value: '已提交 {{state.name}} · {{state.submissions}}',
                },
              ],
            },
          },
        },
      ],
      {
        variables: [
          { key: 'name', label: '申请人', initial: '' },
          { key: 'submissions', label: '次数', initial: 0 },
        ],
      }
    )
  );
  const runtime = await offline(context, await exported(page), 'submit');
  await runtime.getByRole('button', { name: '提交申请' }).click();
  await expect(runtime.getByRole('status')).toHaveCount(0);
  expect(
    await runtime
      .getByRole('textbox', { name: '申请人' })
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing)
  ).toBe(true);
  await runtime.getByRole('textbox', { name: '申请人' }).fill('Ada');
  await runtime.getByRole('button', { name: '提交申请' }).click();
  await expect(runtime.getByRole('status')).toHaveText('已提交 Ada · 1×');
  await expect(runtime.getByRole('button', { name: '下载提交数据' })).toHaveCount(0);
  await runtime.getByRole('button', { name: '提交申请' }).click();
  await expect(runtime.getByRole('status')).toHaveText('已提交 Ada · 2×');
});

test('多页原型：页面动作与嵌套分支导航、后退、404、手机宽度与离线 HTML', async ({
  page,
  context,
}) => {
  await open(
    page,
    data([
      heading('first', '设计首页'),
      button('to-b', '查看详情页', {
        _logic: {
          click: [
            {
              type: 'condition',
              condition: { left: 'true', operator: 'eq', right: 'true' },
              then: [{ type: 'navigate', pageId: 'page-b' }],
              otherwise: [],
            },
          ],
        },
      }),
    ]),
    data([
      heading('second', '企业详情页'),
      button('back', '返回设计首页', {
        _logic: { click: [{ type: 'navigate', pageId: 'page-a' }] },
      }),
    ])
  );
  const runtime = await offline(context, await exported(page, true), 'prototype');
  await runtime.getByRole('button', { name: '查看详情页' }).click();
  await expect(runtime.getByRole('heading', { name: '企业详情页' })).toBeVisible();
  await expect(runtime).toHaveURL(/#\/page\/page-b$/);
  await runtime.goBack();
  await expect(runtime.getByRole('heading', { name: '设计首页' })).toBeVisible();
  await runtime.getByLabel('当前原型页面').selectOption('page-b');
  await runtime.getByRole('button', { name: '返回设计首页' }).click();
  await runtime.evaluate(() => {
    location.hash = '/page/missing';
  });
  await expect(runtime.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await runtime.getByRole('button', { name: '回到首页' }).click();
  await runtime.setViewportSize({ width: 390, height: 844 });
  expect(await runtime.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  mkdirSync(evidence, { recursive: true });
  await runtime.screenshot({ path: `${evidence}/prototype-mobile.png`, fullPage: true });
});

test('主组件与变体：跨页实例、独立覆盖、同步、切换、重置、解除与刷新', async ({ page }) => {
  await open(page, data([heading('a', '统一页头')]), data([heading('second', '第二页原内容')]));
  await layers(page);
  await layer(page, '统一页头').click();
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await page.getByLabel('新主组件名称').fill('企业页头');
  await page.getByRole('button', { name: '创建并关联选区' }).click();
  await expect(page.getByText('主组件 v1 · 已关联')).toBeVisible();
  await page.getByLabel('当前页面', { exact: true }).selectOption('page-b');
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await page
    .locator('.studio-symbol-card')
    .getByRole('button', { name: '默认', exact: false })
    .click();
  const instanceId = (await current(page)).content.at(-1).props.id;
  await layers(page);
  await layer(page, '统一页头').click();
  await page.getByRole('button', { name: '编辑文字', exact: true }).click();
  await page
    .frameLocator('#preview-frame')
    .locator('[data-builder-inline-edit]')
    .fill('第二页专属页头');
  await page.frameLocator('#preview-frame').locator('[data-builder-inline-edit]').press('Enter');
  await page.getByLabel('当前页面', { exact: true }).selectOption('page-a');
  await layers(page);
  await layer(page, '统一页头').click();
  await page.getByRole('button', { name: '编辑文字', exact: true }).click();
  await page
    .frameLocator('#preview-frame')
    .locator('[data-builder-inline-edit]')
    .fill('统一页头新版');
  await page.frameLocator('#preview-frame').locator('[data-builder-inline-edit]').press('Enter');
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await page.getByRole('button', { name: '更新此主组件' }).click();
  await page.getByRole('button', { name: '确认同步主组件' }).click();
  await expect(page.getByText('主组件 v2 · 已关联')).toBeVisible();
  await page.getByLabel('新组件变体名称').fill('强调');
  await page.getByRole('button', { name: '保存为新变体' }).click();
  await expect(page.getByLabel('组件实例变体').locator('option')).toHaveCount(2);
  await page.getByLabel('当前页面', { exact: true }).selectOption('page-b');
  expect((await current(page)).content.at(-1).props.text).toBe('第二页专属页头');
  expect((await current(page)).content.at(-1).props._instance.version).toBe(3);
  await layers(page);
  await layer(page, '第二页专属页头').click();
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await page.getByLabel('组件实例变体').selectOption({ label: '强调' });
  expect((await current(page)).content.at(-1).props.text).toBe('第二页专属页头');
  expect((await current(page)).content.at(-1).props.id).toBe(instanceId);
  await page.getByRole('button', { name: '重置实例覆盖' }).click();
  expect((await current(page)).content.at(-1).props.text).toBe('统一页头新版');
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/master-components.png` });
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await layers(page);
  await layer(page, '统一页头新版').click();
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await expect(page.getByText('主组件 v3 · 已关联')).toBeVisible();
  await page.getByRole('button', { name: '解除实例关联' }).click();
  expect((await current(page)).content.at(-1).props._instance).toBeUndefined();
});

test('设计检查：错误定位、动态修正、导出报告，窄屏面板可用且没有页面横向溢出', async ({ page }) => {
  await open(
    page,
    data([button('bad', '失效设计', { _logic: { click: [{ type: 'navigate', pageId: 'gone' }] } })])
  );
  await page.getByRole('button', { name: '页面设计检查', exact: true }).click();
  await expect(
    page.locator('.studio-audit-issue').filter({ hasText: '跳转到不存在的页面' })
  ).toBeVisible();
  await page
    .locator('.studio-audit-issue')
    .filter({ hasText: '跳转到不存在的页面' })
    .getByRole('button', { name: '定位组件', exact: false })
    .click();
  await expect(page.getByRole('group', { name: '属性面板模式' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出检查报告', exact: true }).click();
  const report = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
  expect(report.issues.some((issue: { nodeId?: string }) => issue.nodeId === 'bad')).toBe(true);
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/design-audit.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('工作区备份往返：导入重写页面与主组件引用，保留原工作区且导入原型可导航', async ({
  page,
  context,
}) => {
  await open(
    page,
    data([
      button('jump', '跳转到关联页面', {
        _logic: {
          click: [
            {
              type: 'condition',
              condition: { left: '1', operator: 'eq', right: '1' },
              then: [{ type: 'navigate', pageId: 'page-b' }],
              otherwise: [],
            },
          ],
        },
      }),
    ])
  );
  await layers(page);
  await layer(page, '跳转到关联页面').click();
  await page.getByRole('button', { name: '主组件与变体', exact: true }).click();
  await page.getByLabel('新主组件名称').fill('业务导航组件');
  await page.getByRole('button', { name: '创建并关联选区' }).click();
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('zui-page-builder-v1')!)
  );
  await page.locator('.studio-file-menu > summary').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '工作区备份', exact: true }).click();
  const backup = readFileSync((await (await download).path())!, 'utf8');
  await page.getByLabel('导入页面或工作区 JSON').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('已导入 2 个页面');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zui-page-builder-v1')!));
  expect(after.pages).toHaveLength(4);
  expect(after.symbols).toHaveLength(2);
  expect(after.symbols[0]).toEqual(before.symbols[0]);
  expect(after.pages[0].data).toEqual(before.pages[0].data);
  const importedPage = after.pages[2],
    importedTarget = after.pages[3].id;
  expect(importedPage.data.content[0].props._instance.symbolId).toBe(after.symbols[1].id);
  expect(importedPage.data.content[0].props._logic.click[0].then[0].pageId).toBe(importedTarget);
  expect(importedPage.snapshots[0].data.content[0].props._logic.click[0].then[0].pageId).toBe(
    importedTarget
  );
  expect(after.symbols[1].variants[0].node.props._logic.click[0].then[0].pageId).toBe(
    importedTarget
  );
  const runtime = await offline(context, await exported(page, true), 'import');
  await runtime.getByRole('button', { name: '跳转到关联页面' }).click();
  await expect(runtime).toHaveURL(new RegExp(`#/page/${importedTarget}$`));
  await expect(runtime.getByRole('heading', { name: '第二个设计页面' })).toBeVisible();
});
