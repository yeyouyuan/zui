import { expect, test, type Page, type Download, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STORAGE = 'zui-page-builder-v1';
const AXE_SOURCE = readFileSync('packages/ui/node_modules/axe-core/axe.min.js', 'utf8');

async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/builder');
  await expect(page.locator('h1.doc-h1')).toHaveText('页面搭建器');
  await expect(page.locator('iframe#preview-frame')).toBeVisible();
}
async function template(page: Page, name: string) {
  await page.getByRole('button', { name: '新建页面', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '当前页面', exact: true })).toContainText(name);
}
async function downloadedText(download: Download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFileSync(path!, 'utf8');
}
async function currentData(page: Page) {
  return JSON.parse((await page.locator('.doc-builder-json').textContent()) ?? '{}');
}

async function dragComponent(page: Page, type: string, target: Locator) {
  const source = page.getByTestId(`drawer-item:${type}`);
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  expect(from).toBeTruthy();
  expect(to).toBeTruthy();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + from!.height / 2, { steps: 5 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 30 });
  // 等待 Puck 的嵌套投放区域识别完成，再释放鼠标。
  await expect(
    target.locator('[data-puck-line-placeholder], [data-puck-preview-mode="placeholder"]').first()
  ).toBeVisible();
  await page.mouse.up();
}

test('搭建器：真实拖入分栏与图片、上传本地图片、复制删除和刷新恢复', async ({ page }) => {
  await open(page, 1920);
  await page.setViewportSize({ width: 1920, height: 1200 });
  await template(page, '空白页面');
  const canvas = page.frameLocator('#preview-frame');
  await dragComponent(page, 'Columns', canvas.locator('[data-puck-dropzone="root:default-zone"]'));
  await expect
    .poll(async () => (await currentData(page)).content.map((item: { type: string }) => item.type))
    .toEqual(['Columns']);
  await dragComponent(page, 'Image', canvas.locator('[data-puck-dropzone$=":content"]'));
  await expect
    .poll(async () =>
      (await currentData(page)).content[0].props.content.map((item: { type: string }) => item.type)
    )
    .toEqual(['Image']);
  const input = page.locator('.doc-builder-editor input[type="file"]:visible');
  await input.setInputFiles({
    name: 'local.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh0kAAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await page
    .locator('.doc-builder-editor')
    .getByRole('textbox', { name: '替代文本' })
    .fill('本地设计稿');
  await expect(canvas.getByRole('img', { name: '本地设计稿' })).toBeVisible();
  await expect
    .poll(async () =>
      canvas
        .getByRole('img', { name: '本地设计稿' })
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    )
    .toBe(true);
  const imageActions = canvas
    .locator('[data-puck-overlay][class*="--isSelected"]')
    .getByRole('region', { name: '选中组件操作' });
  await imageActions.getByRole('button', { name: '复制组件', exact: true }).click();
  await expect.poll(async () => (await currentData(page)).content[0].props.content.length).toBe(2);
  await imageActions.getByRole('button', { name: '删除组件', exact: true }).click();
  await expect.poll(async () => (await currentData(page)).content[0].props.content.length).toBe(1);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(canvas.getByRole('img', { name: '本地设计稿' })).toBeVisible();
  expect((await currentData(page)).content[0].props.content[0].props.src).toMatch(
    /^data:image\/png;base64,/
  );
});
async function setJsonFile(page: Page, value: object | string) {
  await page.locator('input[type="file"][aria-label="导入页面或工作区 JSON"]').setInputFiles({
    name: 'page.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
  });
}

test('搭建器：新建、重命名、复制、删除和多页面刷新恢复', async ({ page }) => {
  await open(page);
  await template(page, '产品介绍');
  const picker = page.getByRole('combobox', { name: '当前页面', exact: true });
  await expect(picker.locator('option')).toHaveCount(2);
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '重命名当前页面' }).click();
  await page.getByRole('textbox', { name: '页面名称' }).fill('团队官网');
  await page.getByRole('button', { name: '保存名称' }).click();
  await expect(picker.locator('option:checked')).toHaveText('团队官网');
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '复制当前页面' }).click();
  await expect(picker.locator('option:checked')).toHaveText('团队官网 副本');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(picker.locator('option:checked')).toHaveText('团队官网 副本');
  await expect(picker.locator('option')).toHaveCount(3);
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '删除当前页面' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(picker.locator('option')).toHaveCount(3);
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '删除当前页面' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(picker.locator('option')).toHaveCount(2);
  await picker.selectOption({ label: '团队官网' });
  await expect(
    page.frameLocator('#preview-frame').getByRole('heading', { name: /让团队的好想法/ })
  ).toBeVisible();
});

test('搭建器：属性编辑、撤销重做、保存版本和恢复闭环', async ({ page }) => {
  await open(page, 1920);
  await template(page, '产品介绍');
  const canvas = page.frameLocator('#preview-frame');
  await page.getByRole('button', { name: '图层结构', exact: true }).click();
  await page
    .locator('[data-builder-layer-id="product-title"] > .studio-layer-row .studio-layer-select')
    .click();
  await page
    .locator('.doc-builder-editor')
    .getByRole('textbox', { name: '标题文字' })
    .fill('为创造者而生');
  await expect(canvas.getByRole('heading', { name: '为创造者而生' })).toBeVisible();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.getByRole('button', { name: '保存版本', exact: true }).first().click();
  await page
    .locator('.doc-builder-editor')
    .getByRole('textbox', { name: '标题文字' })
    .fill('第二版标题');
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page
    .locator('.doc-builder-editor')
    .getByRole('button', { name: '撤销', exact: true })
    .click();
  await expect(canvas.getByRole('heading', { name: '为创造者而生' })).toBeVisible();
  await page
    .locator('.doc-builder-editor')
    .getByRole('button', { name: '重做', exact: true })
    .click();
  await expect(canvas.getByRole('heading', { name: '第二版标题' })).toBeVisible();
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await page.getByRole('button', { name: '恢复此版本' }).first().click();
  await expect(canvas.getByRole('heading', { name: '为创造者而生' })).toBeVisible();
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(canvas.getByRole('heading', { name: '为创造者而生' })).toBeVisible();
  await page.locator('.studio-page-menu > summary').click();
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复此版本' })).toHaveCount(2);
});

test('搭建器：JSON与全工作区可往返导入，错误文件不改动草稿', async ({ page }) => {
  await open(page);
  await template(page, '联系与收集');
  const before = await currentData(page);
  const exportDownload = page.waitForEvent('download');
  await page.locator('.studio-file-menu > summary').click();
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const json = await downloadedText(await exportDownload);
  await setJsonFile(page, json);
  await expect(
    page.getByRole('combobox', { name: '当前页面', exact: true }).locator('option')
  ).toHaveCount(3);
  expect(await currentData(page)).toEqual(before);
  await setJsonFile(page, '{broken json');
  await expect(page.locator('.doc-builder-notice')).toContainText('导入失败');
  expect(await currentData(page)).toEqual(before);
  await setJsonFile(page, { content: [{ type: 'Unknown', props: { id: 'bad' } }] });
  await expect(page.locator('.doc-builder-notice')).toContainText('未注册');
  expect(await currentData(page)).toEqual(before);
  await setJsonFile(page, {
    content: [{ type: 'Button', props: { id: 'bad', href: 'javascript:alert(1)' } }],
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('链接仅支持');
  expect(await currentData(page)).toEqual(before);
  await setJsonFile(page, { format: 'zui-page', version: 2, data: before });
  await expect(page.locator('.doc-builder-notice')).toContainText('不支持此页面文件版本');
  expect(await currentData(page)).toEqual(before);
  const backupDownload = page.waitForEvent('download');
  await page.locator('.studio-file-menu > summary').click();
  await page.getByRole('button', { name: '工作区备份', exact: true }).click();
  const backup = await downloadedText(await backupDownload);
  await setJsonFile(page, backup);
  await expect(
    page.getByRole('combobox', { name: '当前页面', exact: true }).locator('option')
  ).toHaveCount(6);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.reload();
  await expect(
    page.getByRole('combobox', { name: '当前页面', exact: true }).locator('option')
  ).toHaveCount(6);
});

test('搭建器：独立预览与导出HTML可离线展示并提交表单下载数据', async ({
  page,
  context,
}, testInfo) => {
  await open(page);
  await template(page, '联系与收集');
  await page.getByRole('button', { name: '预览页面', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const preview = page.frameLocator('.doc-builder-preview-stage iframe');
  await expect(preview.getByRole('heading', { name: '聊聊你的下一个项目。' })).toBeVisible();
  await expect(preview.locator('.z-builder-page-content > div')).toHaveCSS('gap', '20px');
  await preview.getByRole('button', { name: '提交并生成数据' }).click();
  await expect(preview.locator('input:invalid')).toHaveCount(3);
  await preview.getByRole('textbox', { name: '姓名' }).fill('陈设计');
  await preview.getByRole('textbox', { name: '工作邮箱' }).fill('designer@example.com');
  await preview.getByRole('textbox', { name: '项目需求' }).fill('新的团队官网');
  const updates = preview.getByRole('switch', { name: '接收项目更新' });
  await expect(updates).toBeChecked();
  await updates.click();
  await expect(updates).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('builder-form-preview.png'), fullPage: true });
  await preview.getByRole('button', { name: '提交并生成数据' }).click();
  await expect(preview.getByRole('status')).toContainText('填写完成');
  const submissionDownload = page.waitForEvent('download');
  await preview.getByRole('button', { name: '下载提交数据' }).click();
  const submitted = JSON.parse(await downloadedText(await submissionDownload));
  expect(submitted.fields).toEqual({
    name: ['陈设计'],
    email: ['designer@example.com'],
    request: ['新的团队官网'],
    updates: ['false'],
  });
  await dialog.getByRole('button', { name: '手机', exact: true }).click();
  await expect(dialog.locator('iframe')).toHaveCSS('max-width', '390px');
  const htmlDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载 HTML' }).click();
  const html = await downloadedText(await htmlDownload);
  expect(html).toContain('<!doctype html>');
  expect(html).not.toContain('<script src=');
  const offline = await context.newPage();
  await offline.route('**/*', (route) => route.abort());
  await offline.setContent(html);
  await expect(offline.getByRole('heading', { name: '聊聊你的下一个项目。' })).toBeVisible();
  await expect(offline.locator('.z-builder-page-content > div')).toHaveCSS('gap', '20px');
  await offline.getByRole('textbox', { name: '姓名' }).fill('离线用户');
  await offline.getByRole('textbox', { name: '工作邮箱' }).fill('local@example.com');
  await offline.getByRole('textbox', { name: '项目需求' }).fill('测试离线表单');
  await offline.getByRole('button', { name: '提交并生成数据' }).click();
  await expect(offline.getByRole('status')).toContainText('填写完成');
});

test('搭建器：保存失败可重试，损坏存档保留并支持重建', async ({ page }) => {
  await page.addInitScript((key) => {
    if (window === window.top) localStorage.setItem(key, '{invalid');
  }, STORAGE);
  await open(page);
  await expect(page.getByRole('alert')).toContainText('本地存档无法读取');
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE)).toBe('{invalid');
  await page.getByRole('button', { name: '重建本地存档', exact: true }).click();
  await page.getByRole('button', { name: '确认重建' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'zui-page-builder-v1') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await template(page, '产品介绍');
  await expect(page.getByRole('alert')).toContainText('保存失败');
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole('button', { name: '重试保存' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
});

test('搭建器：另一标签页修改后阻止覆盖，载入新存档恢复编辑', async ({ page, context }) => {
  await open(page);
  await expect(page.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  const other = await context.newPage();
  await open(other);
  await template(other, '项目概览');
  await expect(other.locator('.doc-builder-save-state')).toContainText('已保存到本机');
  await expect(page.getByRole('alert')).toContainText('另一个标签页');
  await page.getByRole('button', { name: '载入最新存档' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: '当前页面', exact: true }).locator('option:checked')
  ).toHaveText('项目概览');
  await expect(
    page.getByRole('combobox', { name: '当前页面', exact: true }).locator('option')
  ).toHaveCount(2);
  await other.close();
});

for (const width of [1440, 768, 320]) {
  for (const theme of ['light', 'dark']) {
    test(`搭建器：${width}px ${theme} 布局与模板可用`, async ({ page }, testInfo) => {
      await open(page, width);
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      );
      await page.addScriptTag({ content: AXE_SOURCE });
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                element: Element,
                options: object
              ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>;
            };
          }
        ).axe;
        const result = await axe.run(document.querySelector('.doc-builder-page')!, {
          resultTypes: ['violations'],
        });
        return result.violations.map((item) => ({
          id: item.id,
          targets: item.nodes.map((node) => node.target),
        }));
      });
      expect(violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`builder-${width}-${theme}.png`),
        fullPage: true,
      });
      await page.getByRole('button', { name: '新建页面', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      );
      await page.screenshot({
        path: testInfo.outputPath(`templates-${width}-${theme}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
