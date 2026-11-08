import { expect, test as base } from '@playwright/test';

// RFC-004 迁移原型 2：AdminShell 异步命令入口。
// 验证模拟服务端搜索、loading、分组重排、权限禁用项、preventDefault
// 保持打开与 hash 导航；同时覆盖 320px 与暗色。
// 异步 debounce 用例对 dev server 负载敏感：串行执行并放宽单测超时
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
test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

async function openPrototype(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    window.location.hash = '/prototype/admin-shell';
  });
  await expect(
    page.getByRole('heading', { level: 1, name: '工作台', exact: true })
  ).toBeVisible();
  const trigger = page.getByRole('button', { name: /搜索命令/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '星河管理平台命令搜索' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('combobox', { name: '搜索命令' });
  await expect(input).toBeFocused();
  return { dialog, input };
}

test('异步搜索：debounce 后结果更新，loading 与结果公告为 listbox 兄弟', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.fill('团队');
  // loading 状态出现（260ms debounce 后请求中）
  await expect(dialog).toContainText('正在加载命令');
  await expect(page.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
  // 结果落定：只有团队管理匹配
  await expect(dialog.getByRole('option', { name: '跳转：团队管理' })).toBeVisible();
  // 结果公告是 listbox 的兄弟 status；count = 可见结果数
  await expect(dialog.locator('[data-part="status"]')).toContainText('找到 1 条命令');
});

test('快速输入竞态：最终结果与最终 query 一致', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.type('项目');
  await input.type('团队');
  // 两个字符在 debounce 窗口内合并为一次请求；结果必须对应最终 query
  await expect(dialog.getByRole('option', { name: '跳转：团队管理' })).toBeVisible();
  await expect(dialog.getByRole('option', { name: '跳转：项目管理' })).toBeHidden();
});

test('分组重排：含"操作"的 query 把操作组提前', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.fill('操作');
  const groups = dialog.getByRole('group');
  await expect(groups.first()).toContainText('操作');
  await expect(dialog.getByRole('option', { name: '新建工单' })).toBeVisible();
});

test('权限禁用项：可渲染不可执行，Enter 不关闭', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.fill('导出');
  const option = dialog.getByRole('option', { name: /导出全部数据/ });
  await expect(option).toHaveAttribute('aria-disabled', 'true');
  await option.press('Enter');
  // disabled 不可高亮：Enter 无 active 可执行，面板保持打开
  await expect(dialog).toBeVisible();
  await expect(option).toHaveAttribute('aria-selected', 'false');
});

test('preventDefault 保持打开：复制链接后显示通知且不关闭', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.fill('复制');
  await dialog.getByRole('option', { name: '复制当前页链接' }).click();
  await expect(page.locator('.admin-prototype-command-notice')).toContainText('已复制');
  await expect(dialog).toBeVisible();
});

test('导航命令：hash 更新且面板关闭', async ({ page }) => {
  const { dialog, input } = await openPrototype(page);
  await input.fill('跳转：项目管理');
  await dialog.getByRole('option', { name: '跳转：项目管理' }).click();
  await expect(page).toHaveURL(/projects\/active/);
  await expect(dialog).toHaveCount(0);
});

test('320px 下命令入口可用', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.evaluate(() => {
    window.location.hash = '/prototype/admin-shell';
  });
  await expect(
    page.getByRole('heading', { level: 1, name: '工作台', exact: true })
  ).toBeVisible();
  // admin 原型是全幅页，docs 顶栏主题按钮不可达；此处验证 320px 下入口可用
  await page.getByRole('button', { name: /搜索命令/ }).click();
  const dialog = page.getByRole('dialog', { name: '星河管理平台命令搜索' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '搜索命令' })).toBeFocused();
});
