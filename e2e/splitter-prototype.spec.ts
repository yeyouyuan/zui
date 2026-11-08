import { expect, type Locator, type Page, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';

const IDE_ROUTE = '/prototype/splitter/ide';
const DETAIL_ROUTE = '/prototype/splitter/detail';
const AXE_SOURCE = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

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

async function openPrototype(page: Page, route: string, heading: string): Promise<void> {
  await page.goto(`/#${route}`);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.getByText('页面出错了', { exact: true })).toHaveCount(0);
}

async function dragHandle(page: Page, handle: Locator, delta: number, release = true) {
  const box = await handle.boundingBox();
  if (!box) throw new Error('Splitter Handle 不可见');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect.poll(() => handle.evaluate((element) => element.hasPointerCapture(1))).toBe(true);
  await page.mouse.move(start.x + delta, start.y, { steps: 4 });
  if (release) await page.mouse.up();
  return start;
}

async function splitterMetrics(root: Locator) {
  return root.evaluate((element) => {
    const panels = Array.from(element.querySelectorAll<HTMLElement>('[data-part="panel"]'));
    const handles = Array.from(element.querySelectorAll<HTMLElement>('[data-part="handle"]'));
    return {
      root: element.getBoundingClientRect().width,
      panels: panels.reduce((sum, panel) => sum + panel.getBoundingClientRect().width, 0),
      handles: handles.reduce((sum, handle) => sum + handle.getBoundingClientRect().width, 0),
    };
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

async function expectAxeClean(page: Page, state: string): Promise<void> {
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    type AxeViolation = {
      id: string;
      impact: string;
      nodes: Array<{ target: string[]; failureSummary: string }>;
    };
    type AxeApi = {
      run(root: Document): Promise<{ violations: AxeViolation[] }>;
    };
    const axe = (window as unknown as { axe?: AxeApi }).axe;
    if (!axe) throw new Error('axe-core 未能注入 Splitter 原型');
    const result = await axe.run(document);
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes }));
  });
  expect(violations, `${state} axe violations`).toEqual([]);
}

test('IDE：Panel + 固定 Handle 精确填满容器，Pointer 与键盘各提交一次', async ({ page }) => {
  await openPrototype(page, IDE_ROUTE, 'IDE 三栏工作区');
  const root = page.getByTestId('ide-splitter');
  const handles = root.getByRole('separator');
  await expect(handles).toHaveCount(2);
  await expect(handles.nth(0)).toHaveAccessibleName('调整文件树与编辑器');
  await expect(handles.nth(1)).toHaveAccessibleName('调整编辑器与预览');

  const metrics = await splitterMetrics(root);
  expect(Math.abs(metrics.root - metrics.panels - metrics.handles)).toBeLessThanOrEqual(1);
  expect(metrics.handles).toBeCloseTo(16, 0);

  const beforePointer = Number(await handles.nth(0).getAttribute('aria-valuenow'));
  await dragHandle(page, handles.nth(0), 72);
  await expect(page.getByTestId('splitter-event')).toContainText('pointer 提交');
  expect(Number(await handles.nth(0).getAttribute('aria-valuenow'))).toBeGreaterThan(beforePointer);
  await expect(page.locator('html')).not.toHaveAttribute('data-z-splitter-dragging');

  const beforeKeyboard = Number(await handles.nth(1).getAttribute('aria-valuenow'));
  await handles.nth(1).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('splitter-event')).toContainText('keyboard 提交');
  expect(Number(await handles.nth(1).getAttribute('aria-valuenow'))).toBeLessThan(beforeKeyboard);

  await handles.nth(1).focus();
  await page.keyboard.down('ArrowRight');
  await page.getByRole('button', { name: '恢复布局' }).focus();
  await page.keyboard.up('ArrowRight');
  await expect(page.getByTestId('splitter-event')).toContainText('keyboard 提交');
});

test('IDE：Escape 与 pointercancel 都恢复起点并只结束一次', async ({ page }) => {
  await openPrototype(page, IDE_ROUTE, 'IDE 三栏工作区');
  const handle = page.getByRole('separator', { name: '调整文件树与编辑器' });
  const initial = await handle.getAttribute('aria-valuenow');
  const endCount = page.getByTestId('resize-end-count');
  await expect(endCount).toHaveText('结束回调：0');

  await dragHandle(page, handle, 96, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('splitter-event')).toContainText('pointer 取消');
  await expect(endCount).toHaveText('结束回调：1');
  await expect(handle).toHaveAttribute('aria-valuenow', initial ?? '22');
  await expect(page.locator('html')).not.toHaveAttribute('data-z-splitter-dragging');

  await dragHandle(page, handle, 80, false);
  await handle.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent('pointercancel', {
        pointerId: 1,
        pointerType: 'mouse',
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await page.mouse.up();
  await expect(page.getByTestId('splitter-event')).toContainText('pointer 取消');
  await expect(endCount).toHaveText('结束回调：2');
  await expect(handle).toHaveAttribute('aria-valuenow', initial ?? '22');
});

test('IDE：受控拒绝不伪造布局，ResizeObserver 从零可用宽度恢复', async ({ page }) => {
  await openPrototype(page, IDE_ROUTE, 'IDE 三栏工作区');
  const handle = page.getByRole('separator', { name: '调整文件树与编辑器' });
  const reject = page.getByRole('checkbox', { name: '拒绝受控尺寸更新' });
  await reject.check();
  const initial = await handle.getAttribute('aria-valuenow');
  await dragHandle(page, handle, 88);
  await expect(handle).toHaveAttribute('aria-valuenow', initial ?? '22');
  await expect(page.getByTestId('splitter-event')).toContainText('实际 22.0');

  await reject.uncheck();
  const zero = page.getByRole('checkbox', { name: '模拟零可用宽度' });
  await zero.check();
  await expect
    .poll(() => page.getByTestId('ide-stage').evaluate((el) => el.getBoundingClientRect().width))
    .toBe(16);
  await zero.uncheck();
  await expect
    .poll(() => page.getByTestId('ide-stage').evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(500);
  await dragHandle(page, handle, 64);
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(Number(initial));
});

test('主从详情：外部折叠设置 inert 并把内容焦点回退 Handle，RTL 键盘按视觉方向', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openPrototype(page, DETAIL_ROUTE, '客户主从详情');
  await page.getByRole('button', { name: '使用 RTL' }).click();
  await expect(page.locator('.splitter-prototype')).toHaveAttribute('dir', 'rtl');

  const save = page.getByRole('button', { name: '保存客户详情' });
  const collapse = page.getByRole('button', { name: '外部折叠客户详情' });
  const handle = page.getByRole('separator', { name: '调整客户列表与客户详情' });
  await save.focus();
  await collapse.evaluate((element) => (element as HTMLButtonElement).click());
  const detailContent = page
    .locator('[data-panel-key="key-customer-details"]')
    .locator('[data-part="content"]');
  await expect(detailContent).toHaveAttribute('inert', '');
  await expect(detailContent).toHaveAttribute('aria-hidden', 'true');
  await expect(handle).toBeFocused();

  await handle.press('Enter');
  await expect(detailContent).not.toHaveAttribute('inert', '');
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.press('ArrowRight');
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBeLessThan(before);

  const metrics = await splitterMetrics(page.getByTestId('detail-splitter'));
  expect(Math.abs(metrics.root - metrics.panels - metrics.handles)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
});

test('浅色与暗色原型 axe 均无违规，隐藏路由不进入公开导航', async ({ page }) => {
  await openPrototype(page, IDE_ROUTE, 'IDE 三栏工作区');
  await expectAxeClean(page, 'IDE 浅色');
  await page.getByRole('button', { name: '使用暗色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectAxeClean(page, 'IDE 暗色');

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ZUI 组件库' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'IDE 三栏工作区' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '客户主从详情' })).toHaveCount(0);
});
