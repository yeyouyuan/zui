import { expect, type Locator, type Page, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Keep the private admission prototype independent of the public docs smoke suite.
const ADMIN_ROUTE = '/prototype/admin-shell';
const ADMIN_NAV_NAME = '星河管理平台主导航';
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

async function expectHeading(page: Page, name: string): Promise<Locator> {
  const heading = page.getByRole('heading', { level: 1, name, exact: true });
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
  await expect(page.getByText('页面出错了', { exact: true })).toHaveCount(0);
  return heading;
}

async function openRoute(page: Page, route = '/', heading = 'ZUI 组件库'): Promise<void> {
  await page.goto('/');
  await expectHeading(page, 'ZUI 组件库');
  if (route !== '/') {
    // Same-document hash changes must go through the app's hashchange subscription.
    await page.evaluate((next) => {
      window.location.hash = next;
    }, route);
  }
  await expectHeading(page, heading);
}

async function adminNavigation(page: Page): Promise<Locator> {
  const nav = page.getByRole('navigation', { name: ADMIN_NAV_NAME, exact: true });
  await expect(nav).toHaveCount(1);
  return nav;
}

async function controls(page: Page): Promise<Locator> {
  const panel = page.locator('details.admin-prototype-controls');
  await expect(panel).toHaveCount(1);
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await panel.locator('summary').click();
  }
  return panel;
}

async function currentLink(nav: Locator, href: string): Promise<void> {
  const current = nav.locator('a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute('href', href);
}

async function expectNoHorizontalOverflow(page: Page, root?: Locator): Promise<void> {
  const documentWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(documentWidths.document, 'document 横向溢出').toBeLessThanOrEqual(documentWidths.viewport);
  expect(documentWidths.body, 'body 横向溢出').toBeLessThanOrEqual(documentWidths.viewport);
  if (root) {
    // Drawer is visible while its translateX entrance is still running.
    await expect
      .poll(() =>
        root.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            leftInBounds: rect.left >= -1,
            rightInBounds: rect.right <= document.documentElement.clientWidth + 1,
            noContentOverflow: element.scrollWidth <= element.clientWidth,
          };
        })
      )
      .toEqual({ leftInBounds: true, rightInBounds: true, noContentOverflow: true });
  }
}

async function expectAxeClean(page: Page, state: string): Promise<void> {
  // Contrast must be measured after a Drawer's opacity/transform entrance settles.
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.effect?.getComputedTiming().iterations === Infinity ||
              animation.playState === 'finished'
          )
      )
    )
    .toBe(true);
  await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    type AxeViolation = {
      id: string;
      impact: string;
      nodes: Array<{ target: string[]; failureSummary: string }>;
    };
    type AxeApi = {
      run(
        root: Document,
        options: { resultTypes: string[] }
      ): Promise<{ violations: AxeViolation[] }>;
    };
    const axe = (window as unknown as { axe?: AxeApi }).axe;
    if (!axe) throw new Error('axe-core 未能注入 SideNav 原型');
    const result = await axe.run(document, { resultTypes: ['violations'] });
    return result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  });
  // Preserve the zero-violation requirement while still exercising later keyboard
  // and route behavior when an accessibility regression is present.
  expect.soft(violations, `${state} axe violations`).toEqual([]);
}

test('后台壳宽态：原生导航语义、地址驱动 current 与 axe', async ({ page }) => {
  await openRoute(page, ADMIN_ROUTE, '工作台');
  const nav = await adminNavigation(page);
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
  await expect(nav.getByRole('group', { name: '工作空间', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('group', { name: '分析与治理', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('list')).toHaveCount(4);
  await expect(nav.locator('[role="menu"], [role="tree"], [role="menuitem"]')).toHaveCount(0);
  await currentLink(nav, `#${ADMIN_ROUTE}/overview`);
  await expect(nav.getByRole('button', { name: '项目管理 12', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  await expect(nav.getByRole('link', { name: '数据导出 未开通', exact: true })).toHaveCount(0);
  await expect(nav.locator('[data-key="export"]')).toHaveAttribute('aria-disabled', 'true');
  await expectAxeClean(page, '桌面宽态');
  await expectNoHorizontalOverflow(page, page.locator('.admin-prototype'));

  await page.evaluate((route) => {
    window.location.hash = `${route}/team/members`;
  }, ADMIN_ROUTE);
  await expectHeading(page, '团队成员');
  await currentLink(nav, `#${ADMIN_ROUTE}/team/members`);
  await expect(nav.locator('li[data-current-descendant="true"]')).toHaveCount(1);
  await expect(nav.getByRole('button', { name: '团队管理', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true'
  );

  await page.evaluate((route) => {
    window.location.hash = `${route}/reports?range=7`;
  }, ADMIN_ROUTE);
  await expectHeading(page, '交付报告');
  // The same destination stays current when only its query changes.
  await currentLink(nav, `#${ADMIN_ROUTE}/reports?range=30`);
  await page.goBack();
  await expectHeading(page, '团队成员');
  await currentLink(nav, `#${ADMIN_ROUTE}/team/members`);
  await page.goForward();
  await expectHeading(page, '交付报告');
  await currentLink(nav, `#${ADMIN_ROUTE}/reports?range=30`);

  await page.evaluate((route) => {
    window.location.hash = `${route}/unknown`;
  }, ADMIN_ROUTE);
  await expectHeading(page, '页面不存在');
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  await expect(nav.locator('[data-current-descendant="true"]')).toHaveCount(0);
});

test('后台壳收窄：flyout 键盘开合、逻辑 Tab 顺序、逆向与 Escape、axe', async ({ page }) => {
  await openRoute(page, ADMIN_ROUTE, '工作台');
  const nav = await adminNavigation(page);
  const collapse = nav.getByRole('button', { name: '收窄导航', exact: true });
  await expect(collapse).toHaveCount(1);
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveAttribute('aria-controls', /.+-viewport$/);
  await collapse.press('Enter');
  await expect(nav).toHaveAttribute('data-collapsed', 'true');
  const expand = nav.getByRole('button', { name: '展开导航', exact: true });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');

  const projects = nav.getByRole('button', { name: '项目管理 12', exact: true });
  const team = nav.getByRole('button', { name: '团队管理', exact: true });
  const flyoutNavigation = page.getByRole('navigation', { name: '项目管理', exact: true });
  const flyout = page.getByRole('group', { name: '项目管理', exact: true });
  await projects.focus();
  await projects.press('Enter');
  await expect(projects).toHaveAttribute('aria-expanded', 'true');
  await expect(flyout).toHaveCount(1);
  await expect(flyout).toBeVisible();
  const active = flyout.getByRole('link', { name: '进行中的项目 12', exact: true });
  const archived = flyout.getByRole('link', { name: '已归档项目', exact: true });
  await expect(active).toBeFocused();
  const flyoutBeforeLayoutShift = await flyoutNavigation.boundingBox();
  expect(flyoutBeforeLayoutShift).not.toBeNull();
  await projects.evaluate((element) => {
    element.style.transform = 'translateY(24px)';
  });
  await expect
    .poll(async () => (await flyoutNavigation.boundingBox())?.y)
    .toBeCloseTo(flyoutBeforeLayoutShift!.y + 24, 0);
  await projects.evaluate((element) => {
    element.style.removeProperty('transform');
  });
  await expect
    .poll(async () => (await flyoutNavigation.boundingBox())?.y)
    .toBeCloseTo(flyoutBeforeLayoutShift!.y, 0);
  await expectAxeClean(page, '收窄且 flyout 展开');
  await active.press('Tab');
  await expect(archived).toBeFocused();
  await archived.press('Shift+Tab');
  await expect(active).toBeFocused();
  await active.press('Shift+Tab');
  await expect(projects).toBeFocused();
  await expect(flyout).toHaveCount(0);

  await projects.press('Space');
  await expect(active).toBeFocused();
  await active.press('Tab');
  await expect(archived).toBeFocused();
  await archived.press('Tab');
  await expect(team, 'flyout 最后一个子项应 Tab 到下一顶层项').toBeFocused();
  await expect(flyout).toHaveCount(0);
  await team.press('Tab');
  const reports = nav.getByRole('link', { name: '交付报告', exact: true });
  const activity = nav.getByRole('link', { name: '操作记录 3', exact: true });
  await expect(reports).toBeFocused();
  await reports.press('Tab');
  await expect(activity).toBeFocused();
  await activity.press('Tab');
  await expect(expand, 'disabled 项应被跳过，导航末端到达收窄控件').toBeFocused();
  await expand.press('Shift+Tab');
  await expect(activity).toBeFocused();
  await activity.press('Shift+Tab');
  await expect(reports).toBeFocused();
  await reports.press('Shift+Tab');
  await expect(team).toBeFocused();
  await team.press('Shift+Tab');
  await expect(projects).toBeFocused();

  await projects.press('Enter');
  await expect(active).toBeFocused();
  await active.press('Escape');
  await expect(flyout).toHaveCount(0);
  await expect(projects).toHaveAttribute('aria-expanded', 'false');
  await expect(projects).toBeFocused();
  await expand.press('Enter');
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
});

test('后台壳链接组合：取消保持地址，普通点击按前置、onNavigate、location 排序', async ({
  page,
}) => {
  await openRoute(page, ADMIN_ROUTE, '工作台');
  const nav = await adminNavigation(page);
  const panel = await controls(page);
  const cancel = panel.getByRole('checkbox', { name: '取消“交付报告”导航', exact: true });
  const events = panel
    .getByRole('list', { name: '最近导航事件', exact: true })
    .getByRole('listitem');
  await expect(events).toHaveCount(0);
  await cancel.check();
  const reports = nav.getByRole('link', { name: '交付报告', exact: true });
  const initialURL = page.url();
  await reports.click();
  await expect(events).toHaveText(['linkProps.onClick → reports', '已取消：location 保持不变']);
  await expect(page).toHaveURL(initialURL);
  await expectHeading(page, '工作台');
  await currentLink(nav, `#${ADMIN_ROUTE}/overview`);

  await cancel.uncheck();
  await reports.click();
  await expect(page).toHaveURL(new RegExp(`#${ADMIN_ROUTE}/reports\\?range=30$`));
  const heading = await expectHeading(page, '交付报告');
  await expect(heading).toBeFocused();
  await currentLink(nav, `#${ADMIN_ROUTE}/reports?range=30`);
  await expect(events).toHaveText([
    'linkProps.onClick → reports',
    '已取消：location 保持不变',
    'linkProps.onClick → reports',
    'onNavigate → reports',
    `location → #${ADMIN_ROUTE}/reports?range=30`,
  ]);
});

test('后台壳动态项：删除正聚焦的归档项，宽态与 flyout 都安全回退', async ({ page }) => {
  await openRoute(page, `${ADMIN_ROUTE}/projects/archived`, '已归档项目');
  const nav = await adminNavigation(page);
  const panel = await controls(page);
  const showArchived = panel.getByRole('checkbox', { name: '显示已归档项目', exact: true });
  const archived = nav.getByRole('link', { name: '已归档项目', exact: true });
  await archived.focus();
  await expect(archived).toBeFocused();
  // Native programmatic click changes the input without stealing the child's focus;
  // a pointer click on the checkbox would only test focus leaving navigation.
  await showArchived.evaluate((element) => (element as HTMLInputElement).click());
  await expect(showArchived).not.toBeChecked();
  await expect(nav.locator('[data-key="projects-archived"]')).toHaveCount(0);
  await expect(nav.getByRole('link', { name: '进行中的项目 12', exact: true })).toBeFocused();
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#${ADMIN_ROUTE}/projects/archived$`));
  await expectHeading(page, '已归档项目');

  await showArchived.check();
  await currentLink(nav, `#${ADMIN_ROUTE}/projects/archived`);
  await nav.getByRole('button', { name: '收窄导航', exact: true }).click();
  const projects = nav.getByRole('button', { name: '项目管理 12', exact: true });
  await projects.focus();
  await projects.press('Enter');
  const flyout = page.getByRole('group', { name: '项目管理', exact: true });
  const flyoutArchived = flyout.getByRole('link', { name: '已归档项目', exact: true });
  await expect(flyout).toBeVisible();
  await flyoutArchived.focus();
  await showArchived.evaluate((element) => (element as HTMLInputElement).click());
  await expect(showArchived).not.toBeChecked();
  await expect(flyout.getByRole('link', { name: '已归档项目', exact: true })).toHaveCount(0);
  await expect(projects).toBeFocused();
  await expect(flyout.getByRole('link', { name: '进行中的项目 12', exact: true })).toHaveCount(1);
  await projects.press('Tab');
  await expect(flyout.getByRole('link', { name: '进行中的项目 12', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(projects).toBeFocused();
  await expect(flyout).toHaveCount(0);
});

test('后台壳 RTL：收窄 flyout 位于触发器 inline-end 且没有横向溢出', async ({ page }) => {
  await openRoute(page, ADMIN_ROUTE, '工作台');
  const nav = await adminNavigation(page);
  const panel = await controls(page);
  await panel.getByRole('checkbox', { name: 'RTL 方向', exact: true }).check();
  await expect(page.locator('.admin-prototype')).toHaveAttribute('dir', 'rtl');
  await nav.getByRole('button', { name: '收窄导航', exact: true }).click();
  const projects = nav.getByRole('button', { name: '项目管理 12', exact: true });
  await projects.focus();
  await projects.press('Enter');
  const flyout = page.getByRole('navigation', { name: '项目管理', exact: true });
  await expect(flyout).toBeVisible();
  await expect(flyout).toHaveAttribute('dir', 'rtl');
  const triggerBounds = await projects.boundingBox();
  const flyoutBounds = await flyout.boundingBox();
  expect(triggerBounds).not.toBeNull();
  expect(flyoutBounds).not.toBeNull();
  expect(flyoutBounds!.x + flyoutBounds!.width, 'RTL inline-end 是触发器左侧').toBeLessThan(
    triggerBounds!.x
  );
  await expectNoHorizontalOverflow(page, flyout);
});

test('后台壳 320px：具名 Drawer、固定宽态、关闭归还焦点与导航标题焦点、axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openRoute(page, ADMIN_ROUTE, '工作台');
  await expect(page.locator('.admin-prototype-sidebar')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, page.locator('.admin-prototype'));
  const menu = page.getByRole('button', { name: '打开主导航', exact: true });
  await expect(menu).toHaveCount(1);
  await menu.click();
  const dialog = page.getByRole('dialog', { name: '星河团队主导航', exact: true });
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toBeVisible();
  const nav = dialog.getByRole('navigation', { name: ADMIN_NAV_NAME, exact: true });
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
  await expect(nav.locator('[data-part="collapse-toggle"]')).toHaveCount(0);
  await currentLink(nav, `#${ADMIN_ROUTE}/overview`);
  await expectAxeClean(page, '320px 主导航 Drawer');
  await expectNoHorizontalOverflow(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();

  await menu.click();
  await expect(dialog).toBeVisible();
  await nav.getByRole('link', { name: '跨区域团队成员访问权限与审批规则', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#${ADMIN_ROUTE}/team/roles$`));
  const heading = await expectHeading(page, '跨区域团队成员访问权限与审批规则');
  await expect(heading).toBeFocused();
  await expectNoHorizontalOverflow(page, page.locator('.admin-prototype-main'));
  await menu.click();
  await expect(dialog).toBeVisible();
  await currentLink(nav, `#${ADMIN_ROUTE}/team/roles`);
  await expectNoHorizontalOverflow(page, dialog);
});

test('文档外壳宽态：SideNav 语义、过滤与 location current，原型保持隐藏', async ({ page }) => {
  await openRoute(page);
  const nav = page.getByRole('navigation', { name: '文档导航', exact: true });
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveClass(/z-sidenav/);
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
  await expect(nav.getByRole('group', { name: '开始', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('group', { name: '组件', exact: true })).toHaveCount(1);
  await expect(nav.getByRole('list')).toHaveCount(2);
  await expect(nav.locator('[data-part="collapse-toggle"]')).toHaveCount(0);
  await expect(nav.locator(`a[href^="#${ADMIN_ROUTE}"]`)).toHaveCount(0);
  await currentLink(nav, '#/');
  const tokens = nav.getByRole('link', { name: '设计令牌', exact: true });
  await expect(tokens).toHaveCount(1);
  await tokens.click();
  await expectHeading(page, '设计令牌');
  await currentLink(nav, '#/tokens');
  const search = page.getByRole('searchbox', { name: '按名称过滤导航项', exact: true });
  await search.fill('TreeSelect');
  await expect(nav.getByRole('link')).toHaveCount(1);
  await expect(nav.getByRole('list')).toHaveCount(1);
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/tokens$/);
  await search.fill('');
  await currentLink(nav, '#/tokens');
  await page.evaluate(() => {
    window.location.hash = '/theme';
  });
  await expectHeading(page, '主题调参');
  await currentLink(nav, '#/theme');
  await expectNoHorizontalOverflow(page);
});

test('文档外壳 320px：具名宽态 Drawer、关闭焦点归还与提交页面标题聚焦', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openRoute(page);
  await expectNoHorizontalOverflow(page);
  const menu = page.getByRole('button', { name: '打开文档菜单', exact: true });
  await expect(menu).toHaveCount(1);
  await menu.click();
  const dialog = page.getByRole('dialog', { name: '文档菜单', exact: true });
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toBeVisible();
  const nav = dialog.getByRole('navigation', { name: '文档导航', exact: true });
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute('data-collapsed', 'false');
  await expect(nav.locator('[data-part="collapse-toggle"]')).toHaveCount(0);
  await expect(
    dialog.getByRole('searchbox', { name: '按名称过滤导航项', exact: true })
  ).toBeFocused();
  await expectNoHorizontalOverflow(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();

  await menu.click();
  await nav.getByRole('link', { name: '设计令牌', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/tokens$/);
  const heading = await expectHeading(page, '设计令牌');
  await expect(heading).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await menu.click();
  await expect(dialog).toBeVisible();
  await currentLink(nav, '#/tokens');
});
