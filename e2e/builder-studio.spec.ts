import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const AXE_SOURCE = readFileSync('packages/ui/node_modules/axe-core/axe.min.js', 'utf8');
async function checkEditorA11y(page: Page) {
  await page.addScriptTag({ content: AXE_SOURCE });
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
}

async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/builder');
  await expect(
    page.getByRole('heading', { level: 1, name: '页面搭建器', exact: true })
  ).toBeVisible();
  await expect(page.locator('#preview-frame')).toBeVisible();
}
async function data(page: Page) {
  return JSON.parse((await page.locator('.doc-builder-json').textContent()) || '{}');
}
async function blank(page: Page) {
  await page.getByRole('button', { name: '新建页面', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /空白页面/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('完整编辑器：点击插入、内容和样式修改、响应式继承及刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  await expect.poll(async () => (await data(page)).content.length).toBe(1);
  await expect(page.getByRole('textbox', { name: '标题文字' })).toBeVisible();
  await page.getByRole('textbox', { name: '标题文字' }).fill('一个真正属于你的页面');
  await page.getByRole('textbox', { name: '图层名称', exact: true }).fill('主视觉标题');
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByRole('spinbutton', { name: '字号 · px' }).fill('56');
  await page.getByRole('textbox', { name: '文字颜色', exact: true }).fill('#6051d6');
  const canvas = page.frameLocator('#preview-frame');
  const title = canvas.getByRole('heading', { name: '一个真正属于你的页面' });
  await expect(title).toHaveCSS('font-size', '56px');
  await page.getByRole('combobox', { name: '编辑设备' }).selectOption('mobile');
  await page.getByRole('spinbutton', { name: '字号 · px' }).fill('28');
  await expect(title).toHaveCSS('font-size', '28px');
  await page.getByRole('button', { name: '切换到桌面画布' }).click();
  await expect(title).toHaveCSS('font-size', '56px');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(canvas.getByRole('heading', { name: '一个真正属于你的页面' })).toHaveCSS(
    'font-size',
    '56px'
  );
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await expect(
    page.locator('.studio-layer-select').filter({ hasText: '主视觉标题' })
  ).toBeVisible();
  expect(errors).toEqual([]);
  mkdirSync('docs/audits/2026-11-10/builder-studio', { recursive: true });
  await page.screenshot({ path: 'docs/audits/2026-11-10/builder-studio/first-check.png' });
});

async function selectLayer(page: Page, id: string) {
  await page
    .locator(`[data-builder-layer-id="${id}"] > .studio-layer-row .studio-layer-select`)
    .click();
}
async function fileAction(page: Page, name: string) {
  await page.locator('.studio-file-menu > summary').click();
  await page.getByRole('button', { name, exact: true }).click();
}

test('完整编辑器：图层跨容器移动、排序、锁定、隐藏和撤销', async ({ page }) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: '插入自由布局容器', exact: true }).click();
  await page.getByRole('textbox', { name: '图层名称', exact: true }).fill('第一容器');
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  await page.getByRole('textbox', { name: '标题文字' }).fill('可以移动的标题');
  const first = (await data(page)).content[0].props.id;
  const heading = (await data(page)).content[0].props.content[0].props.id;
  await page
    .locator('.studio-breadcrumb')
    .getByRole('button', { name: '页面', exact: true })
    .click();
  await page.getByRole('button', { name: '插入自由布局容器', exact: true }).click();
  await page.getByRole('textbox', { name: '图层名称', exact: true }).fill('第二容器');
  await page.getByRole('button', { name: '插入标签', exact: true }).click();
  const second = (await data(page)).content[1].props.id;
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await selectLayer(page, heading);
  await page.getByRole('combobox', { name: '移动到容器' }).selectOption(second);
  await expect.poll(async () => (await data(page)).content[0].props.content.length).toBe(0);
  await expect
    .poll(async () =>
      (await data(page)).content[1].props.content.map((node: { type: string }) => node.type)
    )
    .toEqual(['Tag', 'Heading']);
  await page.getByRole('button', { name: '上移组件', exact: true }).click();
  await expect
    .poll(async () =>
      (await data(page)).content[1].props.content.map((node: { type: string }) => node.type)
    )
    .toEqual(['Heading', 'Tag']);
  await page.getByRole('button', { name: '锁定 第二容器', exact: true }).click();
  await expect(page.getByRole('button', { name: '上移组件', exact: true })).toBeDisabled();
  await page
    .locator(`[data-builder-layer-id="${heading}"] > .studio-layer-row .studio-layer-select`)
    .press('Delete');
  await expect.poll(async () => (await data(page)).content[1].props.content.length).toBe(2);
  await page.getByRole('button', { name: '解锁 第二容器', exact: true }).click();
  await page.getByRole('button', { name: '下移组件', exact: true }).click();
  await expect
    .poll(async () => (await data(page)).content[1].props.content[1].props.id)
    .toBe(heading);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.getByRole('button', { name: '隐藏 第二容器', exact: true }).click();
  await expect(
    page.frameLocator('#preview-frame').getByText('已隐藏 · 第二容器（导出时不显示）')
  ).toBeVisible();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await expect(page.getByRole('button', { name: '显示 第二容器', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '显示 第二容器', exact: true }).click();
  await expect(
    page.frameLocator('#preview-frame').getByRole('heading', { name: '可以移动的标题' })
  ).toBeVisible();
  await expect(page.locator(`[data-builder-layer-id="${first}"]`)).toHaveCount(1);
});

test('完整编辑器：组件快捷键支持复制粘贴与剪切，输入框保留文字编辑行为', async ({ page }) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  await page.getByRole('textbox', { name: '标题文字' }).fill('键盘编辑');
  await page.getByRole('button', { name: '内容', exact: true }).focus();
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(async () => (await data(page)).content.length).toBe(2);
  const ids = (await data(page)).content.map((node: { props: { id: string } }) => node.props.id);
  expect(new Set(ids).size).toBe(2);
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(async () => (await data(page)).content.length).toBe(3);
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  const order = (await data(page)).content.map((node: { props: { id: string } }) => node.props.id);
  await selectLayer(page, order[0]);
  await page.keyboard.press('Alt+ArrowUp');
  expect(
    (await data(page)).content.map((node: { props: { id: string } }) => node.props.id)
  ).toEqual(order);
  await selectLayer(page, order[order.length - 1]);
  await page.keyboard.press('Alt+ArrowDown');
  expect(
    (await data(page)).content.map((node: { props: { id: string } }) => node.props.id)
  ).toEqual(order);
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(async () => (await data(page)).content.length).toBe(2);
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(async () => (await data(page)).content.length).toBe(3);
  const input = page.getByRole('textbox', { name: '标题文字' });
  await input.fill('不能误删组件');
  await input.press('ControlOrMeta+a');
  await input.press('Backspace');
  expect((await data(page)).content.length).toBe(3);
  await input.fill('快捷键也能保存');
  await input.press('ControlOrMeta+s');
  await expect(page.locator('.doc-builder-notice')).toContainText('已保存当前版本');
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复此版本' })).toHaveCount(1);
});

test('完整编辑器：预设区块组成真实页面，新表单控件在独立 HTML 中校验并下载数据', async ({
  page,
  context,
}) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: /^预设区块/ }).click();
  await page.getByRole('button', { name: /完整联系表单/ }).click();
  await page.getByRole('button', { name: /基础组件/ }).click();
  await page.getByRole('button', { name: '插入下拉选项', exact: true }).click();
  await page.getByRole('radio', { name: '是', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: '预览页面', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const preview = dialog.frameLocator('iframe');
  await preview.getByRole('button', { name: '发送留言' }).click();
  await expect(preview.getByText('感谢你的留言，提交数据已准备好下载。')).toHaveCount(0);
  await preview.getByRole('textbox', { name: '姓名' }).fill('张设计');
  await preview.getByRole('textbox', { name: '邮箱' }).fill('designer@example.com');
  await preview.getByRole('textbox', { name: '留言' }).fill('需要一个可以独立使用的页面。');
  await preview.getByRole('checkbox').check();
  await preview.getByRole('combobox', { name: '感兴趣的方向' }).selectOption('design');
  await preview.getByRole('button', { name: '发送留言' }).click();
  await expect(preview.getByRole('status')).toContainText('感谢你的留言');
  const download = page.waitForEvent('download');
  await preview.getByRole('button', { name: '下载提交数据' }).click();
  const saved = await download;
  const { readFileSync } = await import('node:fs');
  expect(JSON.parse(readFileSync((await saved.path())!, 'utf8')).fields).toEqual({
    name: ['张设计'],
    email: ['designer@example.com'],
    message: ['需要一个可以独立使用的页面。'],
    agreement: ['true'],
    interest: ['design'],
  });
  const htmlDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载 HTML' }).click();
  const html = readFileSync((await (await htmlDownload).path())!, 'utf8');
  const offline = await context.newPage();
  await offline.route('**/*', (route) => route.abort());
  await offline.setContent(html);
  await expect(offline.getByRole('textbox', { name: '留言' })).toBeVisible();
  await expect(offline.getByRole('combobox', { name: '感兴趣的方向' })).toBeVisible();
  await offline.getByRole('button', { name: '发送留言' }).click();
  await expect(offline.getByRole('status')).toHaveCount(0);
});

test('完整编辑器：所有预设区块可组合、备份、导出并保留响应式与隐藏状态', async ({
  page,
  context,
}) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: /^预设区块/ }).click();
  for (const name of ['品牌首屏', '功能亮点', '行动号召', '完整联系表单', '常见问题', '数据概览']) {
    await page
      .locator('.studio-breadcrumb')
      .getByRole('button', { name: '页面', exact: true })
      .click();
    await page.getByRole('button', { name: new RegExp(name) }).click();
  }
  await expect.poll(async () => (await data(page)).content.length).toBe(6);
  const allIds = (value: {
    content?: { props: { id: string; content?: unknown[] } }[];
  }): string[] =>
    (value.content || []).flatMap((item) => [
      item.props.id,
      ...allIds({ content: item.props.content as typeof value.content }),
    ]);
  const ids = allIds(await data(page));
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  const rootIds = (await data(page)).content.map(
    (node: { props: { id: string } }) => node.props.id
  );
  await selectLayer(page, rootIds[0]);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByRole('combobox', { name: '编辑设备' }).selectOption('mobile');
  await page.getByRole('spinbutton', { name: '内边距 上', exact: true }).fill('16');
  await selectLayer(page, rootIds[4]);
  await page.getByRole('button', { name: '可见', exact: true }).click();
  const before = await data(page);
  const jsonDownload = page.waitForEvent('download');
  await fileAction(page, '导出 JSON');
  const { readFileSync } = await import('node:fs');
  const json = readFileSync((await (await jsonDownload).path())!, 'utf8');
  await page.locator('input[aria-label="导入页面或工作区 JSON"]').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect.poll(async () => (await data(page)).content.length).toBe(6);
  expect(await data(page)).toEqual(before);
  const htmlDownload = page.waitForEvent('download');
  await fileAction(page, '导出 HTML');
  const html = readFileSync((await (await htmlDownload).path())!, 'utf8');
  const offline = await context.newPage();
  await offline.route('**/*', (route) => route.abort());
  await offline.setViewportSize({ width: 390, height: 900 });
  await offline.setContent(html);
  await expect(offline.getByRole('heading', { name: '你可能还想了解' })).toHaveCount(0);
  await expect(offline.locator('.z-builder-section').first()).toHaveCSS('padding-top', '16px');
  await expect(offline.getByRole('heading', { name: /让好想法/ })).toBeVisible();
  await page.getByRole('button', { name: '切换到桌面画布' }).click();
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await selectLayer(page, rootIds[0]);
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByRole('button', { name: '组件库', exact: true }).click();
  await page.getByRole('button', { name: /^基础组件/ }).click();
  await checkEditorA11y(page);
  await page.screenshot({ path: 'docs/audits/2026-11-10/builder-studio/composed-page.png' });
  await page.getByRole('button', { name: '主题：切换深色界面' }).click();
  await checkEditorA11y(page);
  await page.screenshot({ path: 'docs/audits/2026-11-10/builder-studio/composed-dark.png' });
});

for (const width of [1440, 768, 320]) {
  test(`完整编辑器：${width}px 面板切换、搜索插入与页面设置可使用`, async ({ page }) => {
    await open(page, width);
    await blank(page);
    if (width <= 1050) await page.getByRole('button', { name: '组件库', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索组件或区块' }).fill('Heading');
    await page.getByRole('button', { name: '插入标题', exact: true }).click();
    if (width <= 1050)
      await expect(
        page.getByRole('dialog').getByRole('textbox', { name: '标题文字' })
      ).toBeVisible();
    await page.getByRole('textbox', { name: '标题文字' }).fill(`${width} 像素也能编辑`);
    if (width <= 1050) await page.keyboard.press('Escape');
    await expect(
      page.frameLocator('#preview-frame').getByRole('heading', { name: `${width} 像素也能编辑` })
    ).toBeVisible();
    const geometry = await page.locator('.studio').evaluate((node) => ({
      left: node.getBoundingClientRect().left,
      right: node.getBoundingClientRect().right,
      width: document.documentElement.scrollWidth,
    }));
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.width).toBe(width);
    await page.screenshot({ path: `docs/audits/2026-11-10/builder-studio/editor-${width}.png` });
  });
}

test('完整编辑器：缩小画布后仍可真实拖入嵌套组件，操作栏保持可点击大小', async ({ page }) => {
  await open(page);
  await blank(page);
  const canvas = page.frameLocator('#preview-frame');
  async function drag(type: string, selector: string) {
    const source = page.getByTestId(`drawer-item:${type}`);
    const target = canvas.locator(selector);
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 30 });
    await expect(
      target.locator('[data-puck-line-placeholder], [data-puck-preview-mode="placeholder"]').first()
    ).toBeVisible();
    await page.mouse.up();
  }
  await drag('Container', '[data-puck-dropzone="root:default-zone"]');
  await expect
    .poll(async () => (await data(page)).content.map((node: { type: string }) => node.type))
    .toEqual(['Container']);
  await page.getByRole('combobox', { name: '画布缩放' }).selectOption('50');
  await drag('Heading', '[data-puck-dropzone$=":content"]');
  await expect
    .poll(async () =>
      (await data(page)).content[0]?.props.content?.map((node: { type: string }) => node.type)
    )
    .toEqual(['Heading']);
  const actions = canvas
    .locator('[data-puck-overlay][class*="--isSelected"]')
    .getByRole('region', { name: '选中组件操作' });
  await expect(actions.getByRole('button', { name: '复制组件', exact: true })).toBeVisible();
  const box = (await actions.getByRole('button', { name: '复制组件', exact: true }).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  await actions.getByRole('button', { name: '复制组件', exact: true }).click();
  await expect.poll(async () => (await data(page)).content[0].props.content.length).toBe(2);
});

test('完整编辑器：图片资源可上传并复用，非法样式导入不会改动页面', async ({ page }) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: '图片资源', exact: true }).click();
  await page.getByLabel('上传工作区图片', { exact: true }).setInputFiles({
    name: '封面.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh0kAAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await expect.poll(async () => (await data(page)).content.length).toBe(1);
  await expect(
    page.frameLocator('#preview-frame').getByRole('img', { name: '封面', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: '插入图片 封面', exact: true }).click();
  await expect.poll(async () => (await data(page)).content.length).toBe(2);
  const before = await data(page);
  expect(before.content[0].props.src).toBe(before.content[1].props.src);
  expect(before.content[0].props.id).not.toBe(before.content[1].props.id);
  for (const styles of [
    { backgroundImage: 'url(https://example.com/image)' },
    { color: 'red;display:none' },
    { width: '100000px' },
  ]) {
    const invalid = structuredClone(before);
    invalid.content[0].props._design = { desktop: styles };
    await page.getByLabel('导入页面或工作区 JSON', { exact: true }).setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await expect(page.locator('.doc-builder-notice')).toContainText('导入失败');
    expect(await data(page)).toEqual(before);
  }
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(
    page.frameLocator('#preview-frame').getByRole('img', { name: '封面', exact: true })
  ).toHaveCount(2);
});

test('完整编辑器：原生图层拖动可移入容器，拒绝循环层级和间接嵌套表单', async ({ page }) => {
  await open(page);
  await blank(page);
  await page.getByRole('button', { name: '插入自由布局容器', exact: true }).click();
  const container = (await data(page)).content[0].props.id;
  await page
    .locator('.studio-breadcrumb')
    .getByRole('button', { name: '页面', exact: true })
    .click();
  await page.getByRole('button', { name: '插入标题', exact: true }).click();
  const heading = (await data(page)).content[1].props.id;
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page
    .locator(`[data-builder-layer-id="${heading}"] > .studio-layer-row .studio-layer-select`)
    .dragTo(page.locator(`[data-builder-layer-id="${container}"] > .studio-layer-row`));
  await expect
    .poll(async () =>
      (await data(page)).content[0]?.props.content?.map(
        (node: { props: { id: string } }) => node.props.id
      )
    )
    .toEqual([heading]);
  expect((await data(page)).content.length).toBe(1);
  await selectLayer(page, container);
  await expect(
    page.getByRole('combobox', { name: '移动到容器' }).locator(`option[value="${container}"]`)
  ).toHaveCount(0);
  expect((await data(page)).content.length).toBe(1);
  await page
    .locator('.studio-breadcrumb')
    .getByRole('button', { name: '页面', exact: true })
    .click();
  await page.getByRole('button', { name: '组件库', exact: true }).click();
  await page.getByRole('button', { name: '插入表单容器', exact: true }).click();
  await page.getByRole('button', { name: '插入自由布局容器', exact: true }).click();
  const before = await data(page);
  await page.getByRole('button', { name: '插入表单容器', exact: true }).click();
  await expect(page.locator('.doc-builder-notice')).toContainText('表单不能放入另一个表单');
  expect(await data(page)).toEqual(before);
});
