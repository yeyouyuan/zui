import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const AXE_SOURCE = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

test('概览：实时预览可操作，命令入口支持点击并归还焦点', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'ZUI 组件库', exact: true })
  ).toBeVisible();
  const preview = page.getByRole('region', { name: '交互组件预览' });
  await preview.getByRole('radio', { name: '本月', exact: true }).click();
  await expect(preview.getByRole('progressbar', { name: '项目完成进度' })).toHaveAttribute(
    'aria-valuenow',
    '86'
  );
  const notification = preview.getByRole('switch', { name: '项目动态通知' });
  await notification.click();
  await expect(notification).toHaveAttribute('aria-checked', 'false');
  const name = preview.getByRole('textbox', { name: '项目名称' });
  await name.fill('');
  await expect(preview.getByRole('button', { name: '创建项目' })).toBeDisabled();
  await name.fill('文档站');
  await preview.getByRole('button', { name: '创建项目' }).click();
  await expect(preview.getByRole('status')).toHaveText('已创建「文档站」');

  const command = page.getByRole('button', { name: '打开文档命令面板', exact: true });
  await command.click();
  const dialog = page.getByRole('dialog', { name: '文档命令面板', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(command).toBeFocused();
});

test('组件示例：键盘展开高亮代码，API 表可聚焦，侧栏可清除过滤', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ZUI 组件库', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '浏览组件', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Button 按钮', exact: true })
  ).toBeVisible();
  const example = page.locator('.doc-demo').first();
  const code = example.locator('pre');
  await expect(code).toBeHidden();
  const toggle = example.locator('summary');
  await toggle.focus();
  await toggle.press('Enter');
  await expect(code).toBeVisible();
  await expect(code.locator('.tok-tag').first()).toBeVisible();
  await toggle.press('Enter');
  await expect(code).toBeHidden();
  const table = page.getByRole('region', { name: '组件属性表，可横向滚动' }).first();
  await table.focus();
  await expect(table).toBeFocused();

  const search = page.getByRole('searchbox', { name: '按名称过滤导航项' });
  await search.fill('Button');
  await expect(page.getByRole('status').filter({ hasText: '找到' })).toHaveText('找到 2 个页面');
  await page.getByRole('button', { name: '清除导航过滤' }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(
    page.getByRole('navigation', { name: '文档导航', exact: true }).getByRole('link')
  ).toHaveCount(80);

  await page.addScriptTag({ content: AXE_SOURCE });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(
      page.getByRole('button', {
        name: colorScheme === 'dark' ? '切换浅色' : '切换暗色',
        exact: true,
      })
    ).toBeVisible();
    const nav = page.getByRole('navigation', { name: '文档导航', exact: true });
    const violations = await nav.evaluate(async (root) => {
      type AxeApi = {
        run(
          root: Element,
          options: object
        ): Promise<{
          violations: Array<{
            id: string;
            nodes: Array<{ target: string[]; failureSummary: string }>;
          }>;
        }>;
      };
      const axe = (window as unknown as { axe: AxeApi }).axe;
      const result = await axe.run(root, {
        resultTypes: ['violations'],
        runOnly: { type: 'rule', values: ['color-contrast'] },
      });
      return result.violations;
    });
    expect(violations, `${colorScheme} 导航文字对比度`).toEqual([]);
  }
});

test('图片示例：头像、封面与失败回退使用站内素材，不依赖外部图库', async ({ page }) => {
  const externalImages: string[] = [];
  page.on('request', (request) => {
    if (
      request.resourceType() === 'image' &&
      request.url().startsWith('http') &&
      new URL(request.url()).origin !== new URL(page.url()).origin
    )
      externalImages.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ZUI 组件库', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: '文档导航', exact: true });
  for (const [name, count] of [
    ['Avatar 头像', 1],
    ['Card 卡片', 1],
    ['Image 图片', 4],
  ] as const) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    const images = page.locator('.doc-demo img');
    await expect(images).toHaveCount(count);
    await expect
      .poll(() =>
        images.evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0
          )
        )
      )
      .toBe(true);
  }
  expect(externalImages).toEqual([]);
});

test('命令面板示例进入时保持关闭，按钮打开后 Escape 归还焦点', async ({ page }) => {
  await page.goto('/#/components/command-palette');
  await expect(
    page.getByRole('heading', { level: 1, name: 'CommandPalette 命令面板', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const trigger = page.getByRole('button', { name: '打开基础命令面板', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: '演示命令面板', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('穿梭框：单一复选标识同步选中、禁用与键盘焦点，条目可移入目标列表', async ({ page }) => {
  for (const [width, colorScheme] of [
    [1440, 'light'],
    [320, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => {
      window.location.hash = '/components/transfer';
    });
    const demo = page.getByRole('region', { name: '基础用法示例，可横向滚动', exact: true });
    const source = demo.getByRole('listbox', { name: '源列表', exact: true });
    const apple = source.getByRole('checkbox', { name: 'Apple', exact: true });
    const indicator = source
      .getByRole('option', { name: 'Apple', exact: true })
      .locator('[data-part="checkbox"]');
    await expect(apple).toHaveCSS('opacity', '0');
    const unchecked = await indicator.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    await apple.focus();
    await page.keyboard.press('Space');
    await expect(apple).toBeChecked();
    await expect(indicator).not.toHaveCSS('background-color', unchecked);
    await expect
      .poll(() => indicator.evaluate((element) => getComputedStyle(element, '::after').content))
      .not.toBe('none');
    await expect(source.getByRole('checkbox', { name: 'Cherry', exact: true })).toBeDisabled();
    await page.keyboard.press('ArrowDown');
    await expect(source.getByRole('checkbox', { name: 'Durian', exact: true })).toBeFocused();
    await expect(
      source.getByRole('option', { name: 'Durian', exact: true }).locator('[data-part="checkbox"]')
    ).not.toHaveCSS('box-shadow', 'none');
    await demo.getByRole('button', { name: '移动到目标列表', exact: true }).click();
    await expect(
      demo
        .getByRole('listbox', { name: '目标列表', exact: true })
        .getByRole('checkbox', { name: 'Apple', exact: true })
    ).toHaveCount(1);
    await expect(source.getByRole('checkbox', { name: 'Apple', exact: true })).toHaveCount(0);
  }
});
