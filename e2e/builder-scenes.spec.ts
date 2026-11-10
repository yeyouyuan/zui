import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const audit = 'docs/audits/2026-11-10/builder-scenes';
async function open(page: Page) {
  await page.setViewportSize({ width: 1680, height: 1050 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/builder');
  await expect(
    page
      .frameLocator('#preview-frame')
      .getByRole('heading', { name: '每一份进展，都清晰可见。', exact: true })
  ).toBeVisible();
}
async function create(page: Page, name: string) {
  await page.getByRole('button', { name: '新建页面', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function data(page: Page) {
  return JSON.parse((await page.locator('.doc-builder-json').textContent()) || '{}');
}
async function html(page: Page) {
  await page.locator('.studio-file-menu > summary').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 HTML', exact: true }).click();
  return readFileSync((await (await downloaded).path())!, 'utf8');
}
async function offline(context: BrowserContext, exported: string, path: string) {
  const result = await context.newPage();
  await result.route('**/*', (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: exported })
      : route.abort()
  );
  await result.goto(`http://localhost:5174/${path}.html`);
  await expect(result.locator('.z-builder-canvas')).toBeVisible();
  return result;
}
function metric(page: Page, name: string) {
  return page
    .locator('.z-builder-metric')
    .filter({ has: page.locator('span:first-child', { hasText: name }) })
    .locator('> strong');
}

test('多场景模板：真实缩略图、分类选择、所有新模板可离线成页并适配手机', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  mkdirSync(audit, { recursive: true });
  await page.getByRole('button', { name: '新建页面', exact: true }).click();
  await page
    .getByRole('group', { name: '模板场景' })
    .getByRole('button', { name: '业务系统', exact: true })
    .click();
  await expect(page.locator('.studio-template-card')).toHaveCount(3);
  await page.getByRole('button', { name: '全部场景', exact: true }).click();
  await expect(page.locator('.studio-template-card')).toHaveCount(10);
  await page.screenshot({ path: `${audit}/template-gallery.png` });
  await page.getByRole('button', { name: '项目业务工作台', exact: true }).click();
  const names = ['项目业务工作台', '运营分析看板', '内容资源中心', '品牌产品官网', '需求收集门户'];
  for (let index = 0; index < names.length; index++) {
    if (index) await create(page, names[index]);
    const exported = await html(page);
    expect(exported).not.toContain('<script src=');
    const runtime = await offline(context, exported, `template-${index}`);
    runtime.on('pageerror', (error) => errors.push(error.message));
    await runtime.setViewportSize({ width: 1440, height: 1000 });
    await expect(runtime.locator('.z-builder-canvas')).toBeVisible();
    if (index === 2) {
      await expect
        .poll(() =>
          runtime
            .locator('.z-builder-collection-grid')
            .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
        )
        .toBe(3);
      const topbarRows = await runtime
        .locator('.z-builder-app-sidebar nav button')
        .evaluateAll((buttons) =>
          buttons.map((button) => Math.round(button.getBoundingClientRect().top))
        );
      expect(new Set(topbarRows).size).toBe(1);
    }
    await runtime.screenshot({ path: `${audit}/scene-${index}-desktop.png`, fullPage: true });
    await runtime.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => runtime.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    if (index === 1) {
      await expect
        .poll(() =>
          runtime
            .locator('.z-builder-cartesian svg')
            .first()
            .evaluate((svg) => {
              const element = svg as SVGSVGElement;
              return Math.abs(
                element.viewBox.baseVal.width - element.getBoundingClientRect().width
              );
            })
        )
        .toBeLessThan(1);
      await expect
        .poll(() =>
          runtime
            .locator('.z-builder-cartesian svg')
            .first()
            .evaluate((svg) => {
              const matrix = (svg as SVGSVGElement).getScreenCTM()!;
              return Math.abs(matrix.a - matrix.d);
            })
        )
        .toBeLessThan(0.01);
    }
    await runtime.screenshot({ path: `${audit}/scene-${index}-mobile.png`, fullPage: true });
    if (index === 0) {
      await runtime.getByRole('button', { name: '展开应用菜单' }).click();
      await runtime
        .getByRole('navigation')
        .getByRole('button', { name: '项目管理', exact: true })
        .click();
      await expect(runtime.getByRole('heading', { name: '把项目，有序推进。' })).toBeVisible();
    }
    await runtime.close();
  }
  expect(errors).toEqual([]);
});

test('业务闭环：导航、表单创建、图表统计联动、详情编辑、搜索导出、删除与本地持久化', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await open(page);
  const exported = await html(page),
    runtime = await offline(context, exported, 'workbench-crud');
  const errors: string[] = [];
  runtime.on('pageerror', (error) => errors.push(error.message));
  await expect(metric(runtime, '全部项目')).toHaveText('8');
  await runtime.getByRole('navigation').getByRole('button', { name: '新建项目' }).click();
  await runtime.getByLabel('项目名称', { exact: true }).fill('真实新增项目');
  await runtime.getByLabel('负责人', { exact: true }).fill('测试负责人');
  await runtime.getByLabel('项目状态', { exact: true }).selectOption('进行中');
  await runtime.getByLabel('预算', { exact: true }).fill('1200');
  await runtime.getByLabel('交付日期', { exact: true }).fill('2026-12-31');
  await runtime.getByLabel('项目说明', { exact: true }).fill('来自完整数据录入表单');
  await runtime.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(runtime.getByRole('status')).toContainText('项目已创建');
  await runtime
    .getByRole('navigation')
    .getByRole('button', { name: '工作概览', exact: true })
    .click();
  await expect(metric(runtime, '全部项目')).toHaveText('9');
  await expect(metric(runtime, '项目总预算')).toHaveText('¥465,200');
  await expect(runtime.locator('.z-builder-chart').first().getByRole('img')).toHaveAttribute(
    'aria-label',
    /测试负责人 1,200/
  );
  await runtime.getByLabel('搜索项目列表').first().fill('真实新增项目');
  const row = runtime.getByRole('row').filter({ hasText: '真实新增项目' });
  await row.getByRole('button', { name: '详情', exact: true }).click();
  await expect(runtime.getByRole('dialog', { name: '记录详情' })).toContainText(
    '来自完整数据录入表单'
  );
  await runtime.keyboard.press('Escape');
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  const edit = runtime.getByRole('dialog', { name: '编辑记录' });
  await edit.getByLabel('预算', { exact: true }).fill('3600');
  await edit.getByRole('button', { name: '保存记录' }).click();
  await expect(metric(runtime, '项目总预算')).toHaveText('¥467,600');
  const csvDownload = runtime.waitForEvent('download');
  await runtime.getByRole('button', { name: '导出', exact: true }).first().click();
  const csv = readFileSync((await (await csvDownload).path())!, 'utf8');
  expect(csv).toContain('真实新增项目');
  expect(csv).not.toContain('品牌体验升级');
  await runtime.reload();
  await expect(metric(runtime, '全部项目')).toHaveText('9');
  await runtime.getByLabel('搜索项目列表').first().fill('真实新增项目');
  await runtime.getByLabel('选择记录 真实新增项目').first().check();
  await runtime.getByRole('button', { name: '删除所选 1 条' }).first().click();
  await runtime
    .getByRole('dialog', { name: '删除记录' })
    .getByRole('button', { name: '确认删除' })
    .click();
  await expect(metric(runtime, '全部项目')).toHaveText('8');
  await runtime.reload();
  await expect(metric(runtime, '全部项目')).toHaveText('8');
  expect(errors).toEqual([]);
});

test('画布设计：就地文字编辑、取消与撤销、设备尺寸拖拽、布局包裹解散和区块复用', async ({
  page,
}) => {
  await open(page);
  await create(page, '空白页面');
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  await page.getByRole('button', { name: '编辑文字', exact: true }).click();
  const canvas = page.frameLocator('#preview-frame');
  await canvas.locator('[data-builder-inline-edit]').fill('直接在画布编辑的标题');
  await canvas.locator('[data-builder-inline-edit]').press('Enter');
  await expect(canvas.getByRole('heading', { name: '直接在画布编辑的标题' })).toBeVisible();
  await page.getByRole('button', { name: '编辑文字', exact: true }).click();
  await canvas.locator('[data-builder-inline-edit]').fill('这次修改应取消');
  await canvas.locator('[data-builder-inline-edit]').press('Escape');
  await expect(canvas.getByRole('heading', { name: '直接在画布编辑的标题' })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(canvas.getByRole('heading', { name: '为你的想法，搭一张页面。' })).toBeVisible();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page.getByRole('button', { name: '包裹容器', exact: true }).click();
  await page.getByLabel('快速布局').selectOption('两列等分');
  expect((await data(page)).content[0].props._design.desktop.gridTemplateColumns).toContain(
    'repeat(2'
  );
  await page.getByRole('button', { name: '切换到手机画布' }).click();
  await page.getByRole('button', { name: '调整选中组件宽度' }).press('ArrowLeft');
  await expect
    .poll(async () => (await data(page)).content[0].props._design.mobile.width)
    .toMatch(/px$/);
  expect((await data(page)).content[0].props._design.desktop.width).toBeUndefined();
  await page.getByRole('button', { name: '存为区块', exact: true }).click();
  await page.getByLabel('区块名称', { exact: true }).fill('我的标题组');
  await page.getByRole('button', { name: '保存区块', exact: true }).click();
  await expect(page.locator('.studio-saved-block')).toContainText('我的标题组');
  await page.getByRole('button', { name: '解散容器', exact: true }).click();
  expect((await data(page)).content.map((node: { type: string }) => node.type)).toEqual([
    'Heading',
  ]);
  await create(page, '空白页面');
  await page.getByRole('button', { name: /^我的区块/ }).click();
  await page.locator('.studio-saved-block > button').first().click();
  await expect.poll(async () => (await data(page)).content[0]?.type).toBe('Container');
  await expect(canvas.getByRole('heading', { name: '直接在画布编辑的标题' })).toBeVisible();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(canvas.getByRole('heading', { name: '直接在画布编辑的标题' })).toBeVisible();
});

test('直接操作：双击、退格与失焦提交、鼠标调整尺寸，以及卡片和应用视图的内容布局', async ({
  page,
}) => {
  await open(page);
  await create(page, '空白页面');
  const canvas = page.frameLocator('#preview-frame');
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  const heading = canvas.getByRole('heading', { name: '为你的想法，搭一张页面。', exact: true });
  const headingBox = (await heading.boundingBox())!;
  await page.mouse.dblclick(headingBox.x + 50, headingBox.y + headingBox.height / 2);
  const inline = canvas.locator('[data-builder-inline-edit]');
  await expect(inline).toBeVisible();
  await inline.fill('实际输入测试');
  await inline.press('End');
  await inline.press('Backspace');
  expect((await data(page)).content).toHaveLength(1);
  await inline.fill('切换选中后也保存文字');
  await page.getByRole('button', { name: '页面', exact: true }).last().click();
  await expect
    .poll(async () => (await data(page)).content[0].props.text)
    .toBe('切换选中后也保存文字');
  const editedBox = (await canvas
    .getByRole('heading', { name: '切换选中后也保存文字' })
    .boundingBox())!;
  await page.mouse.click(editedBox.x + 45, editedBox.y + editedBox.height / 2);
  const resize = page.getByRole('button', { name: '调整选中组件宽度', exact: true });
  await expect(resize).toBeVisible();
  const grip = (await resize.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 80, grip.y + grip.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await data(page)).content[0].props._design?.desktop?.width)
    .toMatch(/^\d+px$/);
  const resizedWidth = Number.parseFloat((await data(page)).content[0].props._design.desktop.width);
  expect(resizedWidth).toBeGreaterThan(700);
  expect(resizedWidth).toBeLessThan(1250);
  await page.getByRole('button', { name: '插入卡片', exact: true }).click();
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  await page
    .locator('.studio-context-toolbar')
    .getByRole('button', { name: '选择父级', exact: true })
    .click();
  await page.getByLabel('快速布局', { exact: true }).selectOption('两列等分');
  await expect(
    canvas.locator('[data-builder-component="Card"] > .z-card > .z-card-body > .z-builder-stack')
  ).toHaveCSS('display', 'grid');
  await expect(
    canvas.locator('[data-builder-component="Card"] > .z-card > .z-card-header')
  ).toHaveCSS('display', 'flex');
  await create(page, '项目业务工作台');
  await page.getByLabel('编辑应用视图').selectOption({ label: '工作概览' });
  await page.getByLabel('快速布局', { exact: true }).selectOption('两列等分');
  await expect(
    canvas.locator('.z-builder-app-view[data-view="overview"] > .z-builder-stack')
  ).toHaveCSS('display', 'grid');
});

test('数据配置：CSV 导入、数值类型校验、字段绑定、样式主题与刷新恢复', async ({ page }) => {
  await open(page);
  await create(page, '空白页面');
  await page.getByRole('button', { name: '页面数据', exact: true }).click();
  await page.getByRole('button', { name: '加入示例数据' }).click();
  await page.getByLabel('数据源名称', { exact: true }).fill('我的项目数据');
  await page.getByLabel('导入数据文件', { exact: true }).setInputFiles({
    name: 'projects.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'name,owner,status,budget,due,description\n"带,逗号的项目",林知夏,进行中,2400,2026-12-01,"两行\n说明"'
    ),
  });
  await page.getByRole('button', { name: '应用数据源', exact: true }).click();
  await expect
    .poll(async () => (await data(page)).root.props.datasets[0].rows[0].budget)
    .toBe(2400);
  expect((await data(page)).root.props.datasets[0].rows[0].description).toBe('两行\n说明');
  await page.getByRole('button', { name: '组件库', exact: true }).click();
  await page.getByRole('button', { name: '插入数据统计卡', exact: true }).click();
  await page.getByLabel('绑定数据源').selectOption(JSON.stringify({ value: 'projects' }));
  await expect(
    page.frameLocator('#preview-frame').locator('.z-builder-metric > strong')
  ).toHaveText('1');
  await page.getByRole('button', { name: '页面', exact: true }).last().click();
  await page.getByRole('button', { name: '应用松石绿风格', exact: true }).click();
  await expect.poll(async () => (await data(page)).root.props.visualPreset).toBe('forest');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(
    page.frameLocator('#preview-frame').locator('.z-builder-metric > strong')
  ).toHaveText('1');
  expect((await data(page)).root.props.datasets[0].name).toBe('我的项目数据');
});

test('共享区块：携带数据源，冲突改名并重写绑定，不覆盖目标页数据', async ({ page }) => {
  await open(page);
  await page.getByLabel('编辑应用视图').selectOption({ label: '工作概览' });
  await page.getByRole('button', { name: '存为区块', exact: true }).click();
  await page.getByLabel('区块名称', { exact: true }).fill('包含数据的工作区');
  await page.getByRole('button', { name: '保存区块', exact: true }).click();
  await create(page, '项目业务工作台');
  await page.getByRole('button', { name: '页面数据', exact: true }).click();
  await page.getByLabel('数据源名称', { exact: true }).fill('目标页的数据');
  await page.getByRole('button', { name: '应用数据源', exact: true }).click();
  await page.getByRole('button', { name: '组件库', exact: true }).click();
  await page.getByRole('button', { name: /^我的区块/ }).click();
  await page.locator('.studio-saved-block > button').first().click();
  const saved = await data(page);
  expect(saved.root.props.datasets.map((source: { name: string }) => source.name)).toEqual([
    '目标页的数据',
    '项目台账 · 示例数据',
  ]);
  expect(saved.root.props.datasets[1].id).toBe('projects-1');
  expect(JSON.stringify(saved.content[1])).toContain('projects-1');
});

test('REST 数据源：画布使用样本，运行态请求、错误重试、只读与空结果状态', async ({
  page,
  context,
}) => {
  await open(page);
  const content = await page.evaluate(async () => {
    const { demoProjectSource } = await import('/src/pages/builder/builder-data-sources.ts');
    return {
      root: {
        props: {
          title: 'REST 数据测试',
          theme: 'light',
          maxWidth: 1200,
          padding: 24,
          datasets: [
            {
              ...demoProjectSource,
              mode: 'rest',
              endpoint: 'https://example.test/api/projects',
              path: 'data.items',
            },
          ],
        },
      },
      content: [
        {
          type: 'DataMetric',
          props: { id: 'remote-metric', source: 'projects', title: '远程记录', operation: 'count' },
        },
        {
          type: 'DataTable',
          props: {
            id: 'remote-table',
            source: 'projects',
            title: '远程项目',
            filterField: 'status',
            pageSize: 5,
            editable: true,
            searchable: true,
            downloadable: true,
          },
        },
      ],
    };
  });
  await page.getByLabel('导入页面或工作区 JSON', { exact: true }).setInputFiles({
    name: 'rest.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(content)),
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('已导入 1 个页面');
  await expect(
    page.frameLocator('#preview-frame').locator('.z-builder-metric > strong')
  ).toHaveText('8');
  const exported = await html(page),
    runtime = await context.newPage();
  let state = 'error';
  await runtime.route('https://example.test/api/projects', (route) =>
    route.fulfill({
      status: state === 'error' ? 503 : 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items:
            state === 'empty'
              ? []
              : [{ name: '远程真实项目', owner: 'API', status: '进行中', budget: 5000 }],
        },
      }),
    })
  );
  await runtime.setContent(exported);
  await expect(runtime.getByRole('alert')).toContainText('503');
  state = 'success';
  await runtime.getByRole('button', { name: '重新请求' }).click();
  await expect(runtime.getByRole('cell', { name: '远程真实项目' })).toBeVisible();
  await expect(runtime.locator('.z-builder-metric > strong')).toHaveText('1');
  await expect(runtime.getByRole('button', { name: '新建记录' })).toHaveCount(0);
  await expect(runtime.getByRole('button', { name: '编辑', exact: true })).toHaveCount(0);
  state = 'empty';
  await runtime.setContent(exported);
  await expect(runtime.getByText('没有匹配的记录。', { exact: true })).toBeVisible();
});
