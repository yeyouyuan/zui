import { expect, test } from '@playwright/test';

test('冷切页保留正文和滚动位置，快速改选不会提交过期页面', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/src/pages/builder/BuilderPage.tsx*', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/#/components/button');
    const main = page.locator('.doc-main');
    await expect(page.getByRole('heading', { level: 1, name: 'Button 按钮' })).toBeVisible();
    await main.evaluate((element) => {
      element.scrollTo({ top: 360, behavior: 'instant' });
    });
    await page
      .getByRole('navigation', { name: '文档导航', exact: true })
      .getByRole('link', { name: '页面搭建器', exact: true })
      .click();
    await started;
    await expect(main).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.doc-route-status')).toHaveText('正在打开 页面搭建器…');
    await expect(main).toHaveAttribute('data-route', '/components/button');
    expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(300);
    await expect(page.getByText('正在加载页面…', { exact: true })).toHaveCount(0);
    await page
      .getByRole('navigation', { name: '文档导航', exact: true })
      .getByRole('link', { name: 'Input 输入框', exact: true })
      .click();
    await expect(main).toHaveAttribute('data-route', '/components/input');
    await expect(main).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('heading', { level: 1, name: 'Input 输入框' })).toBeVisible();
    expect(await main.evaluate((element) => element.scrollTop)).toBe(0);
    const finished = page.waitForResponse((response) =>
      response.url().includes('/builder/BuilderPage.tsx')
    );
    release();
    await finished;
    await expect(main).toHaveAttribute('data-route', '/components/input');
    await page
      .getByRole('navigation', { name: '文档导航', exact: true })
      .getByRole('link', { name: '页面搭建器', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: '页面搭建器' })).toBeVisible();
    await expect(main).toHaveAttribute('aria-busy', 'false');
  } finally {
    release();
  }
});

test('直接访问冷路由显示结构占位，减少动画偏好停止加载动效', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/pages/components/InputPage.tsx*', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/#/components/input');
    const loading = page.getByRole('status', { name: '正在加载文档', exact: true });
    await expect(loading).toBeVisible();
    await expect(loading.locator('.doc-page-loading-demo')).toHaveCount(2);
    expect(
      await loading
        .locator('.doc-route-progress')
        .evaluate((element) => getComputedStyle(element).animationName)
    ).toBe('none');
    release();
    await expect(page.getByRole('heading', { level: 1, name: 'Input 输入框' })).toBeVisible();
    await expect(loading).toHaveCount(0);
  } finally {
    release();
  }
});
