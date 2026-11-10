import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const AXE_SOURCE = readFileSync('packages/ui/node_modules/axe-core/axe.min.js', 'utf8');
const blocks = [
  'dashboard',
  'data-screen',
  'table-page',
  'order-list',
  'search-result',
  'list-detail',
  'timeline-feed',
  'kanban',
  'login',
  'form-page',
  'wizard',
  'user-center',
  'profile-edit',
  'permission',
  'settings',
  'error-pages',
];

async function open(page: Page, width = 1600, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((value) => localStorage.setItem('zui-docs-theme', value), theme);
  await page.goto('/#/blocks');
  await expect(page.locator('h1.doc-h1')).toHaveText('业务区块');
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
}

async function select(page: Page, key: string) {
  const trigger = page.locator('.doc-blocks-mobile-catalog');
  if (await trigger.isVisible()) {
    await trigger.click();
    await page
      .getByRole('dialog')
      .locator(`.doc-blocks-group button`)
      .filter({
        has: page.locator(`small`, { hasText: new RegExp(`^${componentName(key)}$`) }),
      })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } else {
    await page
      .locator('.doc-blocks-catalog')
      .getByRole('button', {
        name: new RegExp(componentName(key)),
      })
      .click();
  }
  await expect(page.locator('.doc-blocks-preview')).toHaveAttribute('data-block', key);
}

function componentName(key: string) {
  return (
    key
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('') + 'Block'
  );
}

test('业务区块：分类和搜索可组合，空结果不清空预览', async ({ page }) => {
  await open(page);
  const catalog = page.locator('.doc-blocks-catalog');
  await expect(catalog.getByRole('navigation').getByRole('button')).toHaveCount(16);
  await page
    .getByRole('group', { name: '区块分类' })
    .getByRole('button', { name: /系统管理/ })
    .click();
  await expect(catalog.getByRole('navigation').getByRole('button')).toHaveCount(3);
  await catalog.getByRole('searchbox').fill('SettingsBlock');
  await expect(catalog.getByRole('navigation').getByRole('button')).toHaveCount(1);
  await select(page, 'settings');
  await catalog.getByRole('searchbox').fill('no-such-block');
  await expect(catalog.getByText('没有找到匹配区块')).toBeVisible();
  await expect(page.locator('.doc-blocks-preview')).toHaveAttribute('data-block', 'settings');
  await catalog.getByRole('button', { name: '清除筛选' }).click();
  await expect(catalog.getByRole('navigation').getByRole('button')).toHaveCount(16);
});

test('业务区块：切页和代码切换保留编辑，重置只影响当前区块', async ({ page }) => {
  await open(page);
  await select(page, 'settings');
  const current = page.locator('.doc-blocks-preview-panel:not([hidden])');
  await current.getByRole('textbox', { name: '站点名称' }).fill('我的业务平台');
  await page.getByRole('tab', { name: '预览', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '代码', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.doc-blocks-frame .doc-code')).toContainText('SettingsBlock');
  await page.keyboard.press('ArrowLeft');
  await expect(current.getByRole('textbox', { name: '站点名称' })).toHaveValue('我的业务平台');
  await select(page, 'profile-edit');
  await current.getByRole('textbox', { name: '姓名', exact: true }).fill('陈设计');
  await select(page, 'settings');
  await expect(current.getByRole('textbox', { name: '站点名称' })).toHaveValue('我的业务平台');
  await page.getByRole('button', { name: '重置演示' }).click();
  await expect(current.getByRole('textbox', { name: '站点名称' })).toHaveValue('ZUI 管理平台');
  await select(page, 'profile-edit');
  await expect(current.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('陈设计');
});

test('业务区块：手机目录键盘关闭并归还焦点，窄画布与资料入口可用', async ({ page }) => {
  await open(page, 320);
  const trigger = page.locator('.doc-blocks-mobile-catalog');
  await trigger.click();
  await expect(page.getByRole('dialog').getByRole('searchbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await select(page, 'user-center');
  await page
    .locator('.doc-blocks-preview-panel:not([hidden])')
    .getByRole('button', { name: '编辑资料' })
    .click();
  await expect(page.locator('.doc-blocks-preview')).toHaveAttribute('data-block', 'profile-edit');
  await page.getByRole('button', { name: '手机宽度', exact: true }).click();
  await expect(page.locator('.doc-blocks-viewport')).toHaveAttribute('data-width', 'mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

for (const width of [1440, 1280, 768, 320]) {
  for (const theme of ['light', 'dark']) {
    test(`业务区块：全部16个区块 ${width}px ${theme} 显示和无障碍`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await open(page, width, theme);
      await page.addScriptTag({ content: AXE_SOURCE });
      for (const key of blocks) {
        await select(page, key);
        await expect(page.locator('.doc-blocks-preview-panel:not([hidden]) > *')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          key
        ).toBeLessThanOrEqual(width + 1);
        const violations = await page.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: (
                  root: Element,
                  options: object
                ) => Promise<{
                  violations: { id: string; nodes: { target: string[] }[] }[];
                }>;
              };
            }
          ).axe;
          const result = await axe.run(document.querySelector('.doc-blocks-page')!, {
            resultTypes: ['violations'],
          });
          return result.violations.map((item) => ({
            id: item.id,
            targets: item.nodes.map((node) => node.target),
          }));
        });
        expect.soft(violations, key).toEqual([]);
        if (key === 'dashboard' || key === 'settings') {
          await page.screenshot({
            path: testInfo.outputPath(`${key}-${width}-${theme}.png`),
            fullPage: true,
          });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
