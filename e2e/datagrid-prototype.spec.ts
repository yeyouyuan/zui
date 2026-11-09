import { expect, test as base } from '@playwright/test';

// DataGrid 性能原型（RFC-005 立项前置）：实测 10k 行下的虚拟化、排序、
// 选择与列宽预算；测量结果回写 docs/rfcs/datagrid.md。
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

async function openPrototype(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'ZUI 组件库' })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '/prototype/datagrid';
  });
  const grid = page.getByRole('grid', { name: '性能原型表格' });
  await expect(grid).toBeVisible();
  return grid;
}

/** 双 rAF 等待一帧提交后的端到端延迟 */
async function measureClickLatency(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate(async (target) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) throw new Error(`missing ${target}`);
    const started = performance.now();
    element.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return performance.now() - started;
  }, selector);
}

test('DataGrid 原型：虚拟化窗口只渲染可见行', async ({ page }) => {
  const grid = await openPrototype(page);

  // 480px 视口 / 40px 行高 = 12 行 + 12 overscan + 1 表头 ≈ 25；绝不能是 10,000
  const rowCount = await grid.getByRole('row').count();
  expect(rowCount).toBeGreaterThan(10);
  expect(rowCount).toBeLessThan(60);

  const domText = await page.getByTestId('metric-dom').textContent();
  const domNodes = Number(domText?.replace(/\D/g, ''));
  expect(domNodes).toBeGreaterThan(0);
  expect(domNodes).toBeLessThan(1200); // 全量渲染 10k 行会是数十万节点

  // 滚动到底部：窗口大小不变，行内容更新
  await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="datagrid-viewport"]') as HTMLElement;
    viewport.scrollTop = viewport.scrollHeight;
  });
  await expect(page.getByTestId('metric-rows')).toContainText('10000');
  const rowCountAfterScroll = await grid.getByRole('row').count();
  expect(rowCountAfterScroll).toBeLessThan(60);
});

test('DataGrid 原型：10k 行排序与全选的端到端延迟', async ({ page }) => {
  await openPrototype(page);

  const sortLatency = await measureClickLatency(page, '[data-testid="sort-amount"]');

  console.log(`[datagrid-perf] sort(10k): ${sortLatency.toFixed(1)}ms`);
  expect(sortLatency).toBeLessThan(150);
  await expect(page.getByTestId('metric-sort')).toContainText('ms');
  // 表头进入 descending 状态后再次点击回到升序
  await expect(page.getByRole('columnheader', { name: /金额/ })).toHaveAttribute(
    'aria-sort',
    'ascending'
  );

  const selectLatency = await measureClickLatency(page, '[data-testid="select-all"]');

  console.log(`[datagrid-perf] select-all(10k): ${selectLatency.toFixed(1)}ms`);
  expect(selectLatency).toBeLessThan(150);
  await expect(page.getByTestId('metric-selected')).toContainText('10000');
});

test('DataGrid 原型：列宽更新延迟在预算内，按住不动不计入渲染耗时', async ({ page }) => {
  await openPrototype(page);

  const handle = page.getByTestId('resize-name');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const nameHeader = page.getByRole('columnheader', { name: /名称/ });
  const widthBefore = (await nameHeader.getAttribute('style')) ?? '';

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  // 用户按住但不移动时没有列宽更新；该停顿不能成为渲染延迟。
  await page.waitForTimeout(180);
  await page.mouse.move(box!.x + box!.width / 2 + 160, box!.y + box!.height / 2, { steps: 12 });
  await page.mouse.up();

  const widthAfter = (await nameHeader.getAttribute('style')) ?? '';
  expect(widthAfter).not.toEqual(widthBefore);

  await expect(page.getByTestId('metric-resize')).toContainText('ms');
  const resizeText = await page.getByTestId('metric-resize').textContent();
  const worstFrame = Number(resizeText?.replace(/[^0-9.]/g, ''));

  console.log(`[datagrid-perf] resize input-to-frame latency: ${worstFrame}ms`);
  expect(worstFrame).toBeGreaterThan(0);
  expect(worstFrame).toBeLessThan(64); // 列宽更新到下一帧的延迟预算
});

test('DataGrid 原型：横向滚动时固定列保持可见', async ({ page }) => {
  await openPrototype(page);

  // 先把名称列拖宽，制造横向溢出
  const handle = page.getByTestId('resize-name');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 500, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();

  const idHeader = page.locator('.datagrid-prototype-cell--sticky-second').first();
  const beforeX = (await idHeader.boundingBox())?.x;
  await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="datagrid-viewport"]') as HTMLElement;
    viewport.scrollLeft = viewport.scrollWidth;
  });
  await page.waitForTimeout(120);
  const afterX = (await idHeader.boundingBox())?.x;
  expect(beforeX).not.toBeNull();
  expect(afterX).toBeCloseTo(beforeX!, 0);
});
