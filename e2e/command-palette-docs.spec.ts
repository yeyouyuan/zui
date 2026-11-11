import { expect, test as base } from '@playwright/test';

// RFC-004 迁移原型 1：文档站全局命令入口（⌘K）。
// 验证 Router 导航后标题焦点、触发点归还、主题命令、preventDefault 保持打开
// 以及与旧文档搜索快捷键的冲突消除。
const test = base.extend<{ errorGuard: void }>({
  errorGuard: [
    async ({ page }, use) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await use();
      expect(pageErrors, '未捕获的页面异常').toEqual([]);
      expect(consoleErrors, 'console.error 输出').toEqual([]);
    },
    { auto: true },
  ],
});

/** mod 按浏览器 UA 平台映射：组件在事件发生时读取 navigator.userAgent（RFC-004 §7） */
async function modKey(page: import('@playwright/test').Page): Promise<string> {
  const ua = await page.evaluate(() => navigator.userAgent);
  return /mac|iphone|ipad|ipod/i.test(ua) ? 'Meta' : 'Control';
}

async function openDocs(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ZUI 组件库' })).toBeVisible();
}

async function pressModK(page: import('@playwright/test').Page) {
  await page.keyboard.press(`${await modKey(page)}+k`);
}

test('⌘K 打开命令面板，输入框获得焦点与独立可访问名', async ({ page }) => {
  await openDocs(page);
  await pressModK(page);
  const dialog = page.getByRole('dialog', { name: '文档命令面板' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('combobox', { name: '搜索命令' });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
});

test('路由命令：Enter 导航后标题聚焦、侧栏 aria-current 更新', async ({ page }) => {
  await openDocs(page);
  await pressModK(page);
  const input = page.getByRole('dialog').getByRole('combobox');
  await input.fill('按钮');
  const listbox = page.getByRole('listbox');
  await expect(listbox.getByRole('option').first()).toContainText('Button 按钮');
  await input.press('Enter');

  await expect(page).toHaveURL(/components\/button/);
  const heading = page.getByRole('heading', { level: 1, name: 'Button 按钮' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(
    page.locator('#doc-sidebar [data-part="link"][aria-current="page"][href="#/components/button"]')
  ).toHaveCount(1);
});

test('主题命令：切换明暗并关闭面板', async ({ page }) => {
  await openDocs(page);
  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? '');
  await pressModK(page);
  const input = page.getByRole('dialog').getByRole('combobox');
  await input.fill('主题');
  await input.press('Enter');
  const after = await page.evaluate(() => document.documentElement.dataset.theme ?? '');
  expect(after).not.toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('聚焦文档搜索命令：旧 ⌘K 行为成为面板命令', async ({ page }) => {
  await openDocs(page);
  await pressModK(page);
  const input = page.getByRole('dialog').getByRole('combobox');
  await input.fill('聚焦');
  await input.press('Enter');
  const search = page.getByRole('searchbox', { name: '按名称过滤导航项' });
  await expect(search).toBeFocused();
});

test('GitHub 命令：preventDefault 保持打开并打开新窗口', async ({ page }) => {
  await openDocs(page);
  await pressModK(page);
  // noopener 打开的窗口不触发 popup 事件，拦截 window.open 断言参数
  await page.evaluate(() => {
    (window as { __openArgs?: unknown[] }).__openArgs = [];
    const orig = window.open.bind(window);
    window.open = ((...args: Parameters<typeof window.open>) => {
      (window as { __openArgs?: unknown[] }).__openArgs!.push(args[0]);
      orig('about:blank', '_blank');
      return null;
    }) as typeof window.open;
  });
  const input = page.getByRole('dialog').getByRole('combobox');
  await input.fill('GitHub');
  await input.press('Enter');
  const opened = await page.evaluate(
    () => (window as { __openArgs?: string[] }).__openArgs as string[]
  );
  expect(opened).toHaveLength(1);
  expect(opened[0]).toContain('github.com');
  // preventDefault 取消了自动关闭：面板保持打开
  await expect(page.getByRole('dialog', { name: '文档命令面板' })).toBeVisible();
});

test('Esc 关闭并归还焦点', async ({ page }) => {
  await openDocs(page);
  const trigger = page.getByRole('button', { name: /切换暗色|切换浅色/ });
  await trigger.focus();
  await pressModK(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('320px：⌘K 打开面板而非抽屉，旧抽屉行为不受影响', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ZUI 组件库' })).toBeVisible();
  const menuButton = page.getByRole('button', { name: /打开文档菜单|菜单/ });
  await pressModK(page);
  await expect(page.getByRole('dialog', { name: '文档命令面板' })).toBeVisible();
  // 旧冲突已消除：⌘K 不再打开文档抽屉
  await expect(menuButton).not.toHaveAttribute('aria-expanded', 'true');
});
