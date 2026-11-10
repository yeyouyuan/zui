import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

type NodeData = { type: string; props: Record<string, unknown> & { id: string } };
type Defaults = Record<string, { label: string; defaultProps: Record<string, unknown> }>;

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/builder');
  await expect(page.locator('#preview-frame')).toBeVisible();
}
async function defaults(page: Page): Promise<Defaults> {
  return page.evaluate(async () => {
    const path = '/src/pages/builder/builder-config.tsx';
    const { builderConfig } = await import(path);
    return JSON.parse(JSON.stringify(builderConfig.components));
  });
}
const node = (
  defs: Defaults,
  type: string,
  props: Record<string, unknown> = {},
  suffix = ''
): NodeData => ({
  type,
  props: { ...defs[type].defaultProps, ...props, id: `catalog-${type}${suffix}` },
});
async function load(page: Page, content: NodeData[], root: Record<string, unknown> = {}) {
  await page.getByLabel('导入页面或工作区 JSON', { exact: true }).setInputFiles({
    name: 'catalog.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        root: {
          props: { title: '全组件工作台', theme: 'light', maxWidth: 1200, padding: 24, ...root },
        },
        content,
      })
    ),
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('已导入 1 个页面');
}
async function html(page: Page) {
  await page.locator('.studio-file-menu > summary').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 HTML', exact: true }).click();
  return readFileSync((await (await downloaded).path())!, 'utf8');
}

test('完整 ZUI 组件目录：公开组件全部能配置、保存、画布渲染和离线渲染', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const defs = await defaults(page);
  const publicIndex = readFileSync('packages/ui/src/index.ts', 'utf8');
  const publicTypes = [...publicIndex.matchAll(/export \* from '\.\/components\/([^']+)'/g)].map(
    (match) => match[1]
  );
  expect(publicTypes).toHaveLength(71);
  expect(publicTypes.filter((type) => !defs[type])).toEqual([]);
  expect(defs.ConfigProvider).toBeDefined();
  const content = Object.keys(defs).map((type) => node(defs, type));
  await load(page, content);
  await expect(page.frameLocator('#preview-frame').locator('[data-builder-component]')).toHaveCount(
    content.length
  );
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(page.frameLocator('#preview-frame').locator('[data-builder-component]')).toHaveCount(
    content.length
  );
  const standalone = await context.newPage();
  standalone.on('pageerror', (error) => errors.push(error.message));
  await standalone.route('**/*', (route) => route.abort());
  await standalone.setContent(await html(page));
  await expect(standalone.locator('[data-builder-component]')).toHaveCount(content.length);
  await expect(standalone.getByRole('button', { name: '打开对话框', exact: true })).toBeVisible();
  await standalone.getByRole('button', { name: '打开对话框', exact: true }).click();
  await expect(standalone.getByRole('dialog', { name: '确认信息' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('复杂组件：表单值、可视数据、标签页和浮层在导出后仍可交互', async ({ page, context }) => {
  test.setTimeout(90000);
  await open(page);
  const defs = await defaults(page);
  await load(page, [
    node(defs, 'Form', {
      title: '活动报名',
      successMessage: '报名数据已准备',
      content: [
        node(defs, 'Select', { label: '报名方向', name: 'direction' }),
        node(defs, 'MultiCombobox', { label: '技能', name: 'skills' }),
        node(defs, 'InputNumber', { label: '参与人数', name: 'count', defaultValue: 2 }),
        node(defs, 'FormItem', { label: '姓名', name: 'person', required: true, control: 'Input' }),
        node(defs, 'Upload', {
          name: 'attachments',
          label: '添加附件',
          draggable: false,
          accept: '.txt',
          multiple: true,
        }),
        node(defs, 'Button', { children: '提交报名', action: 'submit' }),
      ],
    }),
    node(defs, 'Tabs', {
      items: [
        { value: 'overview', label: '介绍', content: '这是活动介绍' },
        { value: 'details', label: '详细安排' },
      ],
      defaultValue: 'overview',
      content: [
        node(defs, 'TabPanel', {
          value: 'details',
          title: '详细安排',
          content: [node(defs, 'Heading', { text: '可自由搭建的标签内容', level: 'h3' })],
        }),
      ],
    }),
    node(defs, 'Modal', {
      title: '报名须知',
      label: '查看须知',
      content: [node(defs, 'Heading', { text: '弹窗中的组件', level: 'h3' }, '-modal')],
    }),
    node(defs, 'Table'),
    node(defs, 'Tree'),
    node(defs, 'Collapse'),
    node(defs, 'Message'),
    node(defs, 'Notification'),
    node(defs, 'Popover'),
    node(defs, 'Drawer'),
    node(defs, 'DatePicker'),
    node(defs, 'CommandPalette'),
  ]);
  const standalone = await context.newPage();
  const errors: string[] = [];
  standalone.on('pageerror', (error) => errors.push(error.message));
  await standalone.route('**/*', (route) => route.abort());
  const exported = await html(page);
  expect(exported).not.toContain('<script src=');
  await standalone.setContent(exported);
  await standalone.getByRole('button', { name: '报名方向' }).click();
  await standalone.getByRole('option', { name: '技术开发' }).click();
  await standalone.getByRole('combobox', { name: '技能', exact: true }).fill('设计');
  await standalone.getByRole('option', { name: '产品设计' }).click();
  await standalone.getByRole('button', { name: '提交报名', exact: true }).click();
  await expect(standalone.getByText('该项为必填')).toBeVisible();
  await standalone.getByRole('textbox', { name: '姓名', exact: true }).fill('实际使用者');
  await standalone
    .locator('.z-upload input[type=file]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('附件内容') });
  await expect(standalone.getByRole('button', { name: '下载 notes.txt' })).toBeVisible();
  const fileDownloaded = standalone.waitForEvent('download', { timeout: 15000 });
  await standalone.getByRole('button', { name: '下载 notes.txt' }).click();
  expect(readFileSync((await (await fileDownloaded).path())!, 'utf8')).toBe('附件内容');
  await standalone.getByRole('button', { name: '提交报名', exact: true }).click();
  await expect(standalone.getByRole('status')).toContainText('报名数据已准备');
  const submitted = standalone.waitForEvent('download', { timeout: 15000 });
  await standalone.getByRole('button', { name: '下载提交数据', exact: true }).click();
  const fields = JSON.parse(readFileSync((await (await submitted).path())!, 'utf8')).fields;
  expect(fields.direction).toEqual(['development']);
  expect(fields.skills).toEqual(['["design"]']);
  expect(fields.count).toEqual(['2']);
  expect(fields.person).toEqual(['实际使用者']);
  expect(JSON.parse(fields.attachments[0])[0]).toMatchObject({
    name: 'notes.txt',
    status: 'local',
  });
  await expect(standalone.getByRole('heading', { name: '可自由搭建的标签内容' })).not.toBeVisible();
  await standalone.getByRole('tab', { name: '详细安排', exact: true }).click();
  await expect(standalone.getByRole('heading', { name: '可自由搭建的标签内容' })).toBeVisible();
  await standalone.getByRole('button', { name: '查看须知', exact: true }).click();
  await expect(
    standalone
      .getByRole('dialog', { name: '报名须知' })
      .getByRole('heading', { name: '弹窗中的组件' })
  ).toBeVisible();
  await standalone.keyboard.press('Escape');
  await standalone.getByRole('textbox', { name: '搜索项目列表' }).fill('工作台');
  await expect(standalone.getByRole('cell', { name: '工作台改版' })).toBeVisible();
  await expect(standalone.getByRole('cell', { name: '品牌设计系统' })).toHaveCount(0);
  await standalone.getByRole('button', { name: '项目', exact: true }).click();
  await standalone.getByRole('button', { name: '打开抽屉', exact: true }).click();
  await expect(standalone.getByRole('dialog', { name: '详细信息' })).toBeVisible();
  await standalone.keyboard.press('Escape');
  await standalone.getByRole('button', { name: '显示提示', exact: true }).click();
  await expect(standalone.getByText('操作成功，所有更改已保存。')).toBeVisible();
  await standalone.getByRole('button', { name: '打开通知', exact: true }).click();
  await expect(standalone.getByText('团队成员更新了项目资料。')).toBeVisible();
  await standalone.getByRole('button', { name: '查看详情', exact: true }).click();
  await expect(standalone.getByText('可以在这里放入更多内容。')).toBeVisible();
  await standalone.keyboard.press('Escape');
  await standalone.getByRole('button', { name: '搜索命令', exact: true }).click();
  await expect(standalone.getByPlaceholder('输入命令或页面名称…')).toBeVisible();
  expect(errors).toEqual([]);
});

test('自定义布局：自由定位、栅格跨度、CSS、主题和响应式设置持久一致', async ({ page, context }) => {
  await open(page);
  const defs = await defaults(page);
  await load(
    page,
    [
      node(defs, 'Container', {
        _design: {
          desktop: {
            position: 'relative',
            height: '300px',
            backgroundGradient: 'linear-gradient(135deg, #eef2ff, #faf5ff)',
          },
        },
        content: [
          node(defs, 'Heading', {
            text: '自由定位标题',
            level: 'h2',
            _design: {
              desktop: {
                position: 'absolute',
                top: '24px',
                left: '32px',
                width: 'calc(100% - 64px)',
                customCss: 'letter-spacing:2px; text-transform:uppercase',
                wrapperCss: 'z-index:7',
                hoverCss: 'color:#ff0000',
              },
              mobile: { left: '12px', width: 'calc(100% - 24px)' },
            },
          }),
        ],
      }),
      node(
        defs,
        'Container',
        {
          _design: { desktop: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 20 } },
          content: [
            node(defs, 'Card', {
              title: '跨列卡片',
              _design: { desktop: { gridColumn: 'span 2' } },
            }),
            node(defs, 'Statistic'),
          ],
        },
        '-grid'
      ),
      node(defs, 'Row', {
        content: [
          node(defs, 'Col', {
            span: 8,
            content: [node(defs, 'Heading', { text: '三分之一', level: 'h3' }, '-col1')],
          }),
          node(
            defs,
            'Col',
            {
              span: 16,
              content: [node(defs, 'Heading', { text: '三分之二', level: 'h3' }, '-col2')],
            },
            '-2'
          ),
        ],
      }),
    ],
    {
      primaryColor: '#7c3aed',
      background: '#faf5ff',
      contentGap: 32,
      customCss: 'padding-bottom:48px',
    }
  );
  const canvas = page.frameLocator('#preview-frame');
  const title = canvas.getByRole('heading', { name: '自由定位标题' });
  await expect(title).toHaveCSS('letter-spacing', '2px');
  await expect(title.locator('..')).toHaveCSS('position', 'absolute');
  await expect(title.locator('..')).toHaveCSS('left', '32px');
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page
    .locator('[data-builder-layer-id="catalog-Heading"] > .studio-layer-row .studio-layer-select')
    .click();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByText('自定义 CSS', { exact: true }).click();
  await page
    .getByRole('textbox', { name: '内容 CSS', exact: true })
    .fill('letter-spacing: 4px; text-transform: uppercase');
  await page.getByRole('button', { name: '应用内容 CSS', exact: true }).click();
  await expect(title).toHaveCSS('letter-spacing', '4px');
  await page
    .getByRole('textbox', { name: '外层 CSS', exact: true })
    .fill('color: red; } body { display:none');
  await page.getByRole('button', { name: '应用外层 CSS', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CSS 声明');
  await expect(title).toBeVisible();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(
    page.frameLocator('#preview-frame').getByRole('heading', { name: '自由定位标题' })
  ).toHaveCSS('letter-spacing', '4px');
  const standalone = await context.newPage();
  await standalone.setViewportSize({ width: 1440, height: 900 });
  await standalone.setContent(await html(page));
  const standaloneTitle = standalone.getByRole('heading', { name: '自由定位标题' });
  await expect(standaloneTitle).toHaveCSS('letter-spacing', '4px');
  await expect(standaloneTitle.locator('..')).toHaveCSS('left', '32px');
  await expect(standalone.locator('.z-builder-canvas')).toHaveCSS(
    'background-color',
    'rgb(250, 245, 255)'
  );
  await expect(standalone.locator('[data-builder-runtime-content]')).toHaveCSS('gap', '32px');
  await expect(
    standalone
      .getByText('跨列卡片', { exact: true })
      .locator('xpath=ancestor::*[@data-builder-component="Card"]')
  ).toHaveCSS('grid-column', 'span 2');
  const colRatios = await standalone
    .locator('[data-builder-component="Col"]')
    .evaluateAll((nodes) =>
      nodes.map(
        (item) =>
          item.getBoundingClientRect().width / item.parentElement!.getBoundingClientRect().width
      )
    );
  expect(colRatios[0]).toBeCloseTo(1 / 3, 2);
  expect(colRatios[1]).toBeCloseTo(2 / 3, 2);
  await standalone.setViewportSize({ width: 390, height: 844 });
  await expect(standaloneTitle.locator('..')).toHaveCSS('left', '12px');
});

test('可视数据编辑：唯一值可重写、错误数据不覆盖、选择器清空与交互浮层留在画布', async ({
  page,
}) => {
  await open(page);
  const defs = await defaults(page);
  await load(page, [node(defs, 'Select', { label: '业务方向', name: 'direction' })]);
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page.locator('[data-builder-layer-id="catalog-Select"] .studio-layer-select').click();
  const field = page.locator('.studio-data-field').first();
  await field.locator('.studio-data-item > summary').first().click();
  await field.getByRole('textbox', { name: '第 1 项唯一值', exact: true }).fill('');
  await expect(field.getByRole('textbox', { name: '第 1 项唯一值', exact: true })).toHaveValue('');
  await expect(field.getByRole('alert')).toContainText('唯一');
  await field.getByRole('textbox', { name: '第 1 项唯一值', exact: true }).fill('engineering');
  await field.getByRole('textbox', { name: '第 1 项名称', exact: true }).fill('工程研发');
  await expect(field.getByRole('alert')).toHaveCount(0);
  await field.getByRole('button', { name: 'JSON', exact: true }).click();
  await field
    .getByRole('textbox', { name: '选项数据 JSON', exact: true })
    .fill('[{"value":"same","label":"一"},{"value":"same","label":"二"}]');
  await field.getByRole('button', { name: '应用数据', exact: true }).click();
  await expect(field.getByRole('alert')).toContainText('重复的选项值');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await page.getByRole('button', { name: '交互预览模式', exact: true }).click();
  const canvas = page.frameLocator('#builder-interactive-frame');
  await canvas.getByRole('button', { name: /^业务方向/ }).click();
  await expect(canvas.getByRole('option', { name: '工程研发' })).toBeVisible();
  await expect(page.getByRole('option', { name: '工程研发' })).toHaveCount(0);
  await canvas.getByRole('option', { name: '工程研发' }).click();
  await expect(canvas.locator('input[type="hidden"][name="direction"]')).toHaveValue('engineering');
  await canvas.getByRole('button', { name: '清除业务方向', exact: true }).click();
  await expect(canvas.locator('input[type="hidden"][name="direction"]')).toHaveValue('');
});

test('自定义动作与组合：卡片内嵌、区域显隐、消息和真实文本下载', async ({ page, context }) => {
  await open(page);
  const defs = await defaults(page);
  await load(page, [
    node(defs, 'Card', {
      title: '业务信息',
      children: '',
      _editor: { htmlId: 'business-card', ariaLabel: '业务卡片' },
      content: [
        node(defs, 'Heading', { text: '卡片中可搭建全部组件', level: 'h2' }),
        node(
          defs,
          'Button',
          { children: '切换卡片自身', action: 'toggle', targetId: 'business-card' },
          '-self'
        ),
      ],
    }),
    node(defs, 'Button', { children: '切换业务区域', action: 'toggle', targetId: 'business-card' }),
    node(
      defs,
      'Button',
      {
        children: '下载业务说明',
        action: 'download',
        payload: '可以独立下载的业务内容',
        fileName: 'business.txt',
      },
      '-download'
    ),
    node(
      defs,
      'Button',
      { children: '显示业务反馈', action: 'message', payload: '配置的动作实际执行了' },
      '-message'
    ),
    node(
      defs,
      'Button',
      { children: '复制业务说明', action: 'copy', payload: '真实复制的业务内容' },
      '-copy'
    ),
  ]);
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page
    .locator('[data-builder-layer-id="catalog-Card"] > .studio-layer-row .studio-layer-select')
    .click();
  await page
    .getByRole('group', { name: '组件操作' })
    .getByRole('button', { name: '复制', exact: true })
    .click();
  const saved = JSON.parse((await page.locator('.doc-builder-json').textContent()) || '{}');
  const cloned = saved.content[1];
  expect(cloned.props._editor.htmlId).not.toBe('business-card');
  expect(cloned.props.content[1].props.targetId).toBe(cloned.props._editor.htmlId);
  const standalone = await context.newPage();
  await standalone.route('**/*', (route) => route.abort());
  await standalone.setContent(await html(page));
  await expect(
    standalone.getByRole('group', { name: '业务卡片', exact: true }).first()
  ).toBeVisible();
  const original = standalone.locator('#business-card');
  const copy = standalone.locator(`#${cloned.props._editor.htmlId}`);
  await copy.getByRole('button', { name: '切换卡片自身' }).click();
  await expect(copy).not.toBeVisible();
  await expect(original).toBeVisible();
  await standalone.getByRole('button', { name: '切换业务区域', exact: true }).click();
  await expect(original.getByRole('heading', { name: '卡片中可搭建全部组件' })).not.toBeVisible();
  await standalone.getByRole('button', { name: '切换业务区域', exact: true }).click();
  await expect(original.getByRole('heading', { name: '卡片中可搭建全部组件' })).toBeVisible();
  await standalone.getByRole('button', { name: '显示业务反馈', exact: true }).click();
  await expect(standalone.getByText('配置的动作实际执行了')).toBeVisible();
  const downloaded = standalone.waitForEvent('download', { timeout: 15000 });
  await standalone.getByRole('button', { name: '下载业务说明', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('business.txt');
  expect(readFileSync((await file.path())!, 'utf8')).toBe('可以独立下载的业务内容');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  });
  await standalone.getByRole('button', { name: '复制业务说明', exact: true }).click();
  await expect(standalone.getByText('内容已复制', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('真实复制的业务内容');
  await page.getByRole('button', { name: '交互预览模式', exact: true }).click();
  const preview = page.frameLocator('#builder-interactive-frame');
  await preview.getByRole('button', { name: '复制业务说明', exact: true }).click();
  await expect(preview.getByText('内容已复制', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('真实复制的业务内容');
});

test('复合表单绑定：响应式分栏切换后开关、复选、分段、日历和树选择保留并提交真实值', async ({
  page,
  context,
}) => {
  await open(page);
  const defs = await defaults(page);
  await load(page, [
    node(defs, 'Form', {
      title: '项目配置',
      content: [
        node(defs, 'Splitter', {
          height: 460,
          content: [
            node(defs, 'Container', {
              content: [
                node(defs, 'FormItem', {
                  label: '启用通知',
                  name: 'notifications',
                  control: 'Switch',
                }),
                node(
                  defs,
                  'FormItem',
                  { label: '同意协议', name: 'agreement', control: 'Checkbox' },
                  '-agreement'
                ),
                node(defs, 'Segmented', { name: 'department' }),
              ],
            }),
            node(
              defs,
              'Container',
              {
                content: [
                  node(defs, 'DatePicker', {
                    label: '到访日期',
                    name: 'visit',
                    defaultValue: '2026-11-10',
                  }),
                  node(defs, 'TreeSelect', { label: '所属团队', name: 'team' }),
                ],
              },
              '-dates'
            ),
          ],
        }),
        node(defs, 'Button', { children: '确认配置', action: 'submit' }),
      ],
    }),
  ]);
  const standalone = await context.newPage();
  const errors: string[] = [];
  standalone.on('pageerror', (error) => errors.push(error.message));
  await standalone.route('**/*', (route) => route.abort());
  await standalone.setContent(await html(page));
  await standalone.getByRole('switch', { name: '启用通知', exact: true }).check();
  await standalone.getByRole('checkbox', { name: '同意协议', exact: true }).check();
  await standalone.getByRole('radio', { name: '技术开发', exact: true }).check();
  await standalone.getByRole('combobox', { name: '到访日期', exact: true }).click();
  await standalone.locator('[data-date="2026-11-12"]').click();
  await standalone.getByRole('combobox', { name: '所属团队', exact: true }).click();
  await standalone.getByRole('treeitem', { name: '运营团队', exact: true }).click();
  await standalone.setViewportSize({ width: 390, height: 844 });
  await expect(standalone.getByRole('separator')).not.toBeVisible();
  await expect(standalone.getByRole('switch', { name: '启用通知', exact: true })).toBeChecked();
  await expect(standalone.getByRole('checkbox', { name: '同意协议', exact: true })).toBeChecked();
  await expect(standalone.getByRole('radio', { name: '技术开发', exact: true })).toBeChecked();
  await standalone.getByRole('button', { name: '确认配置', exact: true }).click();
  const downloaded = standalone.waitForEvent('download', { timeout: 15000 });
  await standalone.getByRole('button', { name: '下载提交数据', exact: true }).click();
  const fields = JSON.parse(readFileSync((await (await downloaded).path())!, 'utf8')).fields;
  expect(fields).toMatchObject({
    notifications: ['true'],
    agreement: ['true'],
    department: ['development'],
    visit: ['2026-11-12'],
    team: ['["operations"]'],
  });
  expect(errors).toEqual([]);
});

test('交互工作台模板：任意组件分栏、键盘调整、明暗与手机编辑', async ({ page, context }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.getByRole('button', { name: '新建页面', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /交互工作台/ })
    .click();
  const canvas = page.frameLocator('#preview-frame');
  await expect(
    canvas.getByRole('heading', { name: '每个好想法，都在向前。', exact: true })
  ).toBeVisible();
  const audit = 'docs/audits/2026-11-10/builder-catalog';
  mkdirSync(audit, { recursive: true });
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page.getByRole('button', { name: '全部展开', exact: true }).click();
  const saved = JSON.parse((await page.locator('.doc-builder-json').textContent()) || '{}');
  const flatten = (nodes: NodeData[]): NodeData[] =>
    nodes.flatMap((node) => [
      node,
      ...flatten((node.props.content as NodeData[] | undefined) || []),
    ]);
  const id = flatten(saved.content).find((node) => node.type === 'Table')!.props.id;
  await page
    .locator(`[data-builder-layer-id="${id}"] > .studio-layer-row .studio-layer-select`)
    .click();
  await expect(page.locator('.studio-inspector')).toContainText('真实行数据');
  await page.screenshot({ path: `${audit}/catalog-light.png` });
  const axeSource = readFileSync('packages/ui/node_modules/axe-core/axe.min.js', 'utf8');
  const checkA11y = async () => {
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run(
              element: Element,
              options: object
            ): Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>;
          };
        }
      ).axe;
      return (
        await axe.run(document.querySelector('.studio')!, { resultTypes: ['violations'] })
      ).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
    });
    expect(violations).toEqual([]);
  };
  await checkA11y();
  await page.getByRole('button', { name: '主题：切换深色界面' }).click();
  await checkA11y();
  await page.screenshot({ path: `${audit}/catalog-dark.png` });
  const standalone = await context.newPage();
  standalone.on('pageerror', (error) => errors.push(error.message));
  await standalone.route('**/*', (route) => route.abort());
  await standalone.setContent(await html(page));
  await expect(standalone.getByText('完成设计评审与核心体验验证。')).toBeVisible();
  await expect(standalone.getByText('项目速览', { exact: true })).toBeVisible();
  await standalone.setViewportSize({ width: 1200, height: 900 });
  await standalone.screenshot({ path: `${audit}/catalog-preview-desktop.png`, fullPage: true });
  await standalone.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => standalone.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const splitCards = standalone.locator('.z-builder-responsive-splitter .z-card');
  await expect
    .poll(async () => {
      const first = await splitCards.nth(0).boundingBox();
      const second = await splitCards.nth(1).boundingBox();
      return !!first && !!second && first.width > 280 && second.y >= first.y + first.height;
    })
    .toBe(true);
  await expect(
    standalone.locator('.z-builder-responsive-splitter').getByText('品牌设计系统', { exact: true })
  ).toBeVisible();
  await standalone.screenshot({ path: `${audit}/catalog-preview-mobile.png`, fullPage: true });
  await standalone.setViewportSize({ width: 1200, height: 900 });
  const separator = standalone.getByRole('separator');
  await expect(separator).toHaveCount(1);
  const before = Number(await separator.getAttribute('aria-valuenow'));
  await separator.focus();
  await separator.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', String(before + 1));
  await standalone.getByRole('tab', { name: '团队动态', exact: true }).click();
  await expect(standalone.getByText('每一步，都有进展', { exact: true })).toBeVisible();
  await standalone.getByRole('button', { name: '创建项目', exact: true }).click();
  await standalone.getByRole('textbox', { name: /项目名称/ }).fill('可实际编辑的项目');
  await standalone.getByRole('button', { name: '保存项目', exact: true }).click();
  await expect(standalone.getByRole('status')).toContainText('项目信息已准备好');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: '切换到手机画布' }).click();
  await page.screenshot({ path: `${audit}/catalog-mobile.png` });
  expect(errors).toEqual([]);
});
