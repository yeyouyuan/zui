import { expect, type Page, test } from '@playwright/test';

/**
 * ZUI 文档站冒烟用例（契约 §3）。
 *
 * 纪律：
 * - hash 路由切换统一走 page.evaluate(location.hash = ...)：page.goto 对同源 hash
 *   不触发 hashchange，不会重渲染页面；
 * - locator 一律 strict（断言前先 toHaveCount 校验），断言用 web-first assertions；
 * - 文案断言全部使用站内中文文案；
 * - 每个用例 beforeEach 挂 pageerror / console.error 监听，afterEach 断言为 0。
 */

/** 错误边界的哨兵文案（App.tsx PageErrorBoundary） */
const ERROR_SENTINEL = '页面出错了';

/** 文档页标题（.doc-h1） */
const H1 = {
  overview: 'ZUI 组件库',
  tokens: '设计令牌',
  theme: '主题调参',
  i18n: '国际化 i18n 与 AI 翻译',
  form: 'Form 表单',
  select: 'Select 选择器',
  modal: 'Modal 对话框',
  datePicker: 'DatePicker 日期选择器',
  virtualTable: 'VirtualTable 虚拟滚动表格',
} as const;

/* ------------------------- console error 收集（全局） ------------------------- */

let pageErrors: Error[] = [];
let consoleErrors: string[] = [];

test.beforeEach(() => {
  pageErrors = [];
  consoleErrors = [];
});

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors, '未捕获的页面异常').toEqual([]);
  expect(consoleErrors, 'console.error 输出').toEqual([]);
  page.close();
});

/* --------------------------------- 工具函数 --------------------------------- */

/**
 * 打开目标 hash 路由并等待其 h1 渲染完成。
 * 先 goto('/') 再用 location.hash 切换（同源 goto hash 不触发重渲染）。
 */
async function openRoute(page: Page, route: string, expectedH1: string): Promise<void> {
  await page.goto('/');
  const overviewH1 = page.locator('.doc-h1');
  await expect(overviewH1).toHaveCount(1);
  await expect(overviewH1).toHaveText(H1.overview);
  if (route !== '/') {
    await page.evaluate((path) => {
      window.location.hash = path;
    }, route);
  }
  const h1 = page.locator('.doc-h1');
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText(expectedH1);
  await expect(page.getByText(ERROR_SENTINEL)).toHaveCount(0);
}

/* --------------------------------- 冒烟用例 --------------------------------- */

test('四个起始页 h1 可见且无「页面出错了」', async ({ page }) => {
  const startPages: Array<[route: string, title: string]> = [
    ['/', H1.overview],
    ['/tokens', H1.tokens],
    ['/theme', H1.theme],
    ['/i18n', H1.i18n],
  ];
  for (const [route, title] of startPages) {
    await openRoute(page, route, title);
  }
});

test('Form 页：空提交出现校验红字', async ({ page }) => {
  await openRoute(page, '/components/form', H1.form);

  const form = page.locator('.z-form').first();
  const username = form.locator('input[placeholder="请输入用户名"]');
  await expect(username).toHaveCount(1);

  await expect(username).toHaveValue('');

  // 用 Enter 触发表单隐式提交：若用指针点击「提交」，mousedown 引起的 blur 校验
  // 会插入错误行导致按钮下移、click 落空；Enter 走同一条 onSubmit 路径且不受布局位移影响。
  const submit = form.getByRole('button', { name: '提交' });
  await expect(submit).toHaveCount(1);
  await username.press('Enter');

  const usernameError = form.locator('.z-form-item-error', { hasText: '请输入用户名' });
  await expect(usernameError).toHaveCount(1);
  await expect(usernameError).toBeVisible();
  await expect(username).toHaveAttribute('aria-invalid', 'true');

  const failedResult = page.locator('.doc-p', { hasText: '校验失败' });
  await expect(failedResult).toHaveCount(1);
  await expect(failedResult).toContainText('请输入用户名');
});

test('Form 页：填写后提交成功回显', async ({ page }) => {
  await openRoute(page, '/components/form', H1.form);

  const form = page.locator('.z-form').first();
  const username = form.locator('input[placeholder="请输入用户名"]');
  const email = form.locator('input[placeholder="请输入邮箱"]');
  await expect(username).toHaveCount(1);
  await expect(email).toHaveCount(1);
  await username.fill('张三');
  await email.fill('zhang@zui.dev');
  // Enter 隐式提交，理由同「空提交」用例（避免 blur 校验插入错误行导致的点击落空）
  await username.press('Enter');

  const success = page.locator('.doc-p', { hasText: '提交成功' });
  await expect(success).toHaveCount(1);
  await expect(success).toContainText('张三');
  await expect(success).toContainText('zhang@zui.dev');
});

test('Form 页：表单实例填充与重置', async ({ page }) => {
  await openRoute(page, '/components/form', H1.form);

  const instanceForm = page.locator('.z-form').nth(1);
  const username = instanceForm.locator('input[placeholder="点击右侧按钮操作"]');
  await expect(username).toHaveCount(1);
  await expect(username).toHaveValue('');

  await page.getByRole('button', { name: '填充' }).click();
  await expect(username).toHaveValue('张三');

  await page.getByRole('button', { name: '重置' }).click();
  await expect(username).toHaveValue('');
});

test('Select 页：展开选项并选中，触发器文本变化', async ({ page }) => {
  await openRoute(page, '/components/select', H1.select);

  const select = page.locator('.z-select').first();
  const trigger = select.locator('button[data-part="trigger"]');
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toContainText('简体中文');

  await trigger.click();
  const listbox = page.locator('.z-select-listbox[data-open="true"]');
  await expect(listbox).toHaveCount(1);
  await expect(listbox).toBeVisible();

  const options = listbox.getByRole('option');
  await expect(options).toHaveCount(5);
  await options.filter({ hasText: 'English' }).click();

  await expect(trigger).toContainText('English');
  const valueEcho = page.locator('.doc-pg-value', { hasText: '当前值' });
  await expect(valueEcho).toHaveCount(1);
  await expect(valueEcho).toContainText('当前值：en');
});

test('Select 页：Esc 关闭列表，焦点留在触发器上', async ({ page }) => {
  await openRoute(page, '/components/select', H1.select);

  const select = page.locator('.z-select').first();
  const trigger = select.locator('button[data-part="trigger"]');
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  await expect(page.locator('.z-select-listbox[data-open="true"]')).toHaveCount(1);

  await trigger.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.z-select-listbox[data-open="true"]')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('Modal 页：打开后 role=dialog 可见，Esc 关闭', async ({ page }) => {
  await openRoute(page, '/components/modal', H1.modal);

  const openDialog = page.locator('.z-modal[data-state="open"][role="dialog"]');
  await expect(openDialog).toHaveCount(0);

  const openTrigger = page.getByRole('button', { name: '打开对话框' });
  await expect(openTrigger).toHaveCount(1);
  await openTrigger.click();

  await expect(openDialog).toHaveCount(1);
  await expect(openDialog).toBeVisible();
  await expect(openDialog).toContainText('导出报告');

  await page.keyboard.press('Escape');
  await expect(openDialog).toHaveCount(0);
  await expect(page.locator('.z-modal[data-state="open"]')).toHaveCount(0);
});

test('DatePicker 页：打开日历选一天，输入位出现所选 ISO', async ({ page }) => {
  await openRoute(page, '/components/date-picker', H1.datePicker);

  const datepicker = page.locator('.z-datepicker').first();
  const input = datepicker.locator('input[data-part="input"]');
  await expect(input).toHaveCount(1);
  await expect(input).toHaveValue('');

  await input.click();
  const panel = page.locator('.z-datepicker-panel');
  await expect(panel).toHaveCount(1);
  await expect(panel.getByRole('grid')).toHaveCount(1);

  const today = panel.locator('[data-part="day"][aria-current="date"]');
  await expect(today).toHaveCount(1);
  const iso = await today.getAttribute('data-date');
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await today.click();

  await expect(panel).toHaveCount(0);
  await expect(input).toHaveValue(iso as string);
  await expect(page.getByText(`选中：${iso}`)).toHaveCount(1);
  await expect(page.getByText(`选中：${iso}`)).toBeVisible();
});

test('DateRangePicker 窄屏单月面板可跨月选择', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openRoute(page, '/components/date-range-picker', 'DateRangePicker 日期范围选择器');

  const range = page.locator('.z-daterange').first();
  await range.getByRole('textbox', { name: '开始日期' }).click();
  const panel = page.getByRole('dialog', { name: '选择日期范围' });
  await expect(panel.getByRole('grid')).toHaveCount(1);
  const dayWidth = await panel
    .locator('[data-part="day"]')
    .first()
    .evaluate((cell) => cell.getBoundingClientRect().width);
  expect(dayWidth).toBeGreaterThanOrEqual(32);

  await panel.locator('[data-date="2024-06-25"]').first().click();
  await panel.getByRole('button', { name: '下一月' }).click();
  await panel.locator('[data-date="2024-07-05"]').first().click();
  await expect(panel).toHaveCount(0);
  await expect(range.getByRole('textbox', { name: '开始日期' })).toHaveValue('2024-06-25');
  await expect(range.getByRole('textbox', { name: '结束日期' })).toHaveValue('2024-07-05');
});

test('DateRangePicker 中间宽度与暗色面板保持可用', async ({ page }) => {
  await openRoute(page, '/components/date-range-picker', 'DateRangePicker 日期范围选择器');
  const range = page.locator('.z-daterange').first();
  const trigger = range.getByRole('textbox', { name: '开始日期' });

  for (const [width, expectedGrids] of [
    [480, 1],
    [560, 1],
    [561, 2],
    [768, 2],
  ]) {
    await page.setViewportSize({ width, height: 640 });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: '选择日期范围' });
    await expect(panel.getByRole('grid')).toHaveCount(expectedGrids);
    const geometry = await panel.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const firstDay = node.querySelector('[data-part="day"]')?.getBoundingClientRect();
      return { left: rect.left, right: rect.right, dayWidth: firstDay?.width ?? 0 };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.dayWidth).toBeGreaterThanOrEqual(32);
    await panel.locator('[data-date="2024-06-25"]').first().press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '切换暗色' }).click();
  await trigger.click();
  const panel = page.getByRole('dialog', { name: '选择日期范围' });
  await expect(panel.getByRole('grid')).toHaveCount(1);
  const colors = await panel.evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.background).not.toBe(colors.foreground);
});

test('VirtualTable 页：容器滚动后 aria-rowindex 变化（虚拟化生效）', async ({ page }) => {
  await openRoute(page, '/components/virtual-table', H1.virtualTable);

  const table = page.locator('.z-virtual-table').first();
  await expect(table).toHaveCount(1);

  const rows = table.locator('[data-part="row"]');
  await expect(rows.first()).toHaveAttribute('aria-rowindex', '2');

  // 滚到最底（超出 maxScrollTop 会被组件钳制）：可视区应只剩尾段行
  await table.evaluate((element) => {
    element.scrollTop = 1000000;
  });

  await expect
    .poll(async () => rows.first().getAttribute('aria-rowindex'), { timeout: 5000 })
    .not.toBe('2');
  const after = await rows.first().getAttribute('aria-rowindex');
  expect(Number(after)).toBeGreaterThan(900);
  const lastRow = table.locator('[data-part="row"][aria-rowindex="1001"]');
  await expect(lastRow).toHaveCount(1);
  await expect(lastRow).toBeVisible();
});

test('VirtualTable 页：行点击回显所选行', async ({ page }) => {
  await openRoute(page, '/components/virtual-table', H1.virtualTable);

  const clickableTable = page.locator('.z-virtual-table').nth(1);
  await expect(clickableTable).toHaveCount(1);
  const firstRow = clickableTable.locator('[data-part="row"][aria-rowindex="2"]');
  await expect(firstRow).toHaveCount(1);
  await expect(firstRow).toContainText('员工 1');
  await firstRow.click();

  const echo = page.locator('.doc-p', { hasText: '选中：员工 1' });
  await expect(echo).toHaveCount(1);
  await expect(echo).toContainText('研发');
});

test('暗色切换：data-theme="dark" 生效后切回', async ({ page }) => {
  await openRoute(page, '/', H1.overview);

  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  const toDark = page.getByRole('button', { name: '切换暗色' });
  await expect(toDark).toHaveCount(1);
  await toDark.click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: '切换浅色' })).toHaveCount(1);

  await page.getByRole('button', { name: '切换浅色' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '切换暗色' })).toHaveCount(1);
});

test('console error 收集：全站页面 pageerror / console.error 为 0', async ({ page }) => {
  const routes: Array<[route: string, title: string]> = [
    ['/', H1.overview],
    ['/tokens', H1.tokens],
    ['/theme', H1.theme],
    ['/i18n', H1.i18n],
    ['/components/button', 'Button 按钮'],
    ['/components/input', 'Input 输入框'],
    ['/components/form', H1.form],
    ['/components/select', H1.select],
    ['/components/modal', H1.modal],
    ['/components/date-picker', H1.datePicker],
    ['/components/virtual-table', H1.virtualTable],
    ['/components/table', 'Table 表格'],
  ];
  for (const [route, title] of routes) {
    await openRoute(page, route, title);
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
