import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

/** nav.ts 是文档路由的唯一清单；布局审计直接从清单读取，新增页面不会漏测。 */
const NAV_ROUTES = Array.from(
  readFileSync(new URL('../docs/src/nav.ts', import.meta.url), 'utf8').matchAll(
    /\{ title: '[^']+', path: '([^']+)', group: '[^']+' \}/g
  ),
  (match) => match[1]
);

/** 注入 Puck 的 srcdoc iframe，避免只扫描到外层文档而漏掉画布内容。 */
const AXE_SOURCE = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);

/** 文档页标题（.doc-h1） */
const H1 = {
  overview: 'ZUI 组件库',
  tokens: '设计令牌',
  theme: '主题调参',
  i18n: '国际化 i18n 与 AI 翻译',
  form: 'Form 表单',
  select: 'Select 选择器',
  combobox: 'Combobox 自动完成',
  adminShellPrototype: '工作台',
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
  await page.close();
});

/* --------------------------------- 工具函数 --------------------------------- */

/**
 * 打开目标 hash 路由并等待其 h1 渲染完成。
 * 先 goto('/') 再用 location.hash 切换（同源 goto hash 不触发重渲染）。
 */
async function openRoute(page: Page, route: string, expectedH1: string): Promise<void> {
  await page.goto('/');
  const overviewH1 = page.getByRole('heading', { level: 1, name: H1.overview, exact: true });
  await expect(overviewH1).toHaveCount(1);
  await expect(overviewH1).toBeVisible();
  if (route !== '/') {
    await page.evaluate((path) => {
      window.location.hash = path;
    }, route);
  }
  const h1 = page.getByRole('heading', { level: 1, name: expectedH1, exact: true });
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
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

test('Combobox 页：严格选择、回退与 320px 暗色浮层可用', async ({ page }) => {
  await openRoute(page, '/components/combobox', H1.combobox);

  const combobox = page.locator('.z-combobox').first();
  const input = combobox.getByRole('combobox', { name: '城市' });
  await expect(input).toHaveCount(1);
  await expect(input).toHaveValue('上海');

  await input.fill('深');
  const listbox = page.getByRole('listbox');
  await expect(listbox).toHaveCount(1);
  await expect(listbox.getByRole('option')).toHaveCount(1);
  await expect(listbox.getByRole('option')).toContainText('深圳');
  await input.press('Enter');
  await expect(input).toHaveValue('深圳');
  await expect(input).toHaveAttribute('aria-expanded', 'false');

  await input.fill('不存在');
  await expect(page.locator('[data-part="empty"]')).toContainText('暂无匹配选项');
  await input.press('Escape');
  await expect(input).toHaveValue('深圳');

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '切换暗色' }).click();
  await input.press('ArrowDown');
  const panel = page.locator('.z-combobox-panel');
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  const geometry = await panel.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      left: rect.left,
      right: rect.right,
      background: style.backgroundColor,
      foreground: style.color,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(320);
  expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(geometry.background).not.toBe(geometry.foreground);
});

test('MultiCombobox 页：多选标签、面板保持打开与 320px 可用', async ({ page }) => {
  await openRoute(page, '/components/combobox', H1.combobox);

  const multi = page.locator('.z-multicombobox').first();
  const multiInput = multi.getByRole('combobox', { name: '出差城市' });
  await expect(multiInput).toHaveCount(1);
  await expect(multi.getByRole('button', { name: '移除 上海' })).toHaveCount(1);

  await multiInput.fill('深');
  const multiListbox = page.getByRole('listbox');
  await expect(multiListbox).toHaveCount(1);
  await multiListbox.getByRole('option').first().click();
  await expect(multi.getByRole('button', { name: '移除 深圳' })).toHaveCount(1);
  await expect(multiInput).toHaveValue('');
  await expect(multiInput).toHaveAttribute('aria-expanded', 'true');
  await expect(multiListbox).toHaveCount(1);

  await multiInput.press('Escape');
  await expect(multiListbox).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 640 });
  await multiInput.press('ArrowDown');
  const multiPanel = page.locator('.z-multicombobox-panel');
  await expect(multiPanel).toHaveCount(1);
  await expect(multiPanel).toBeVisible();
  const multiGeometry = await multiPanel.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  });
  expect(multiGeometry.left).toBeGreaterThanOrEqual(0);
  expect(multiGeometry.right).toBeLessThanOrEqual(320);
});

test('SideNav 后台壳原型：分组展开、aria-current 深链与 320px 抽屉', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/prototype/admin-shell', H1.adminShellPrototype);

  const nav = page.getByRole('navigation', { name: '星河管理平台主导航' });
  await expect(nav).toHaveCount(1);

  // 深链子页：aria-current 落在叶子链接，父分组呈现当前后代标记
  await page.evaluate((path) => {
    window.location.hash = path;
  }, '/prototype/admin-shell/team/members');
  await expect(
    page.getByRole('heading', { level: 1, name: '团队成员', exact: true })
  ).toBeVisible();
  const currentLink = nav.locator('[data-part="link"][aria-current="page"]');
  await expect(currentLink).toHaveCount(1);
  await expect(currentLink).toHaveAttribute('href', '#/prototype/admin-shell/team/members');
  await expect(nav.locator('li[data-current-descendant="true"]')).toHaveCount(1);

  // 分组 disclosure：受控初值已展开 → 点击收起 → 再点击展开，子链接可见性跟随
  const groupToggle = nav.getByRole('button', { name: /项目管理/ });
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: '进行中的项目' })).toBeVisible();
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('link', { name: '进行中的项目' })).toHaveCount(0);
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: '进行中的项目' })).toBeVisible();

  // disabled 叶子不输出 <a href>
  await expect(nav.getByRole('link', { name: '数据导出' })).toHaveCount(0);

  // 320px：移动端走 Drawer 组合（SideNav 固定宽态）
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole('button', { name: '打开主导航' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('navigation', { name: '星河管理平台主导航' })).toHaveCount(1);
  await expect(dialog.locator('[data-part="link"][aria-current="page"]')).toHaveCount(1);
});

test('页面搭建器：宽画布、第三方控件可访问名与窄屏边界可用', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, '/builder', '页面搭建器');

  // Keep accessibility coverage independent of the default business template.
  await page.getByLabel('导入页面或工作区 JSON', { exact: true }).setInputFiles({
    name: 'accessibility.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        root: { props: { title: '组件无障碍检查', theme: 'light', maxWidth: 1120, padding: 24 } },
        content: [
          {
            type: 'Heading',
            props: { id: 'smoke-heading', text: '项目工作台', level: 'h2', align: 'left' },
          },
          { type: 'Progress', props: { id: 'smoke-progress', percent: 60, status: 'active' } },
          {
            type: 'Form',
            props: {
              id: 'smoke-form',
              title: '项目资料',
              content: [
                {
                  type: 'Input',
                  props: {
                    id: 'smoke-name',
                    label: '项目名称',
                    name: 'project',
                    placeholder: '填写名称',
                    type: 'text',
                  },
                },
                {
                  type: 'Switch',
                  props: { id: 'smoke-switch', label: '接收通知', name: 'notifications' },
                },
                {
                  type: 'Button',
                  props: {
                    id: 'submit-button',
                    children: '提交项目',
                    action: 'submit',
                    variant: 'primary',
                    size: 'md',
                  },
                },
              ],
            },
          },
        ],
      })
    ),
  });
  await expect(page.locator('.doc-builder-notice')).toContainText('已导入 1 个页面');

  const editor = page.locator('.doc-builder-editor');
  await expect(editor).toHaveCount(1);
  await expect(editor.locator('select[aria-label="画布缩放"]')).toHaveCount(1);
  await expect(editor.locator('iframe#preview-frame')).toHaveAttribute('title', '页面画布预览');
  await expect(editor.getByRole('region', { name: '画布工作区' })).toBeVisible();
  await expect(page.locator('.doc-builder-json')).toHaveAttribute('hidden', '');

  const canvas = page.frameLocator('iframe#preview-frame');
  await expect(canvas.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect
    .poll(() =>
      editor
        .locator('iframe#preview-frame')
        .evaluate((frame) => (frame as HTMLIFrameElement).contentDocument?.title)
    )
    .toBe('页面搭建器画布');
  await expect(canvas.getByRole('main')).toHaveCount(1);
  await expect(
    canvas.getByRole('heading', { level: 1, name: '页面搭建器画布', exact: true })
  ).toHaveCount(1);
  await expect(canvas.getByRole('progressbar', { name: '任务进度' })).toHaveCount(1);

  const canvasA11yIssues = await canvas.locator('body').evaluate((body) => {
    const interactiveSelector =
      'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
    const interactive = Array.from(body.querySelectorAll<HTMLElement>(interactiveSelector));
    const nested = interactive.filter((element) =>
      interactive.some((candidate) => candidate !== element && element.contains(candidate))
    );
    const unnamedButtons = Array.from(
      body.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).filter((element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const referencedText = labelledBy
        ?.split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ');
      return !(
        element.getAttribute('aria-label')?.trim() ||
        referencedText?.trim() ||
        element.textContent?.trim() ||
        element.getAttribute('title')?.trim()
      );
    });
    return {
      nested: nested.map((element) => element.outerHTML.slice(0, 180)),
      unnamedButtons: unnamedButtons.map((element) => element.outerHTML.slice(0, 180)),
    };
  });
  expect(canvasA11yIssues).toEqual({ nested: [], unnamedButtons: [] });

  const axeViolations = await editor
    .locator('iframe#preview-frame')
    .evaluate(async (frame, axeSource) => {
      type AxeResult = {
        violations: Array<{
          id: string;
          impact: string | null;
          nodes: Array<{ target: string[] }>;
        }>;
      };
      type AxeApi = {
        run(root: Document, options: { resultTypes: string[] }): Promise<AxeResult>;
      };

      const iframe = frame as HTMLIFrameElement;
      const frameDocument = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!frameDocument || !frameWindow) throw new Error('页面画布 iframe 尚未就绪');

      (frameWindow as unknown as { eval(source: string): void }).eval(axeSource);
      const axe = (frameWindow as unknown as { axe?: AxeApi }).axe;
      if (!axe) throw new Error('axe-core 未能注入页面画布 iframe');

      const results = await axe.run(frameDocument, { resultTypes: ['violations'] });
      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target.join(' > ')),
      }));
    }, AXE_SOURCE);
  expect(axeViolations).toEqual([]);

  const desktopCanvasWidth = await editor
    .locator('.studio-canvas-column')
    .first()
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(desktopCanvasWidth).toBeGreaterThan(500);

  const structureTab = editor.getByRole('button', { name: '图层结构', exact: true });
  await structureTab.focus();
  await expect(structureTab).toBeFocused();
  await structureTab.press('Enter');
  await expect(structureTab).toHaveAttribute('aria-pressed', 'true');
  const outlineButton = editor.locator(
    '[data-builder-layer-id="submit-button"] > .studio-layer-row .studio-layer-select'
  );
  await expect(outlineButton).toHaveCount(1);
  await outlineButton.focus();
  await expect(outlineButton).toBeFocused();
  await outlineButton.press('Enter');

  await page.addScriptTag({ content: AXE_SOURCE });
  const editorAxeViolations = await editor.evaluate(async (root) => {
    type AxeResult = {
      violations: Array<{
        id: string;
        impact: string | null;
        nodes: Array<{ target: string[] }>;
      }>;
    };
    type AxeApi = {
      run(root: Element, options: { resultTypes: string[] }): Promise<AxeResult>;
    };

    const axe = (window as unknown as { axe?: AxeApi }).axe;
    if (!axe) throw new Error('axe-core 未能注入页面搭建器');
    const results = await axe.run(root, { resultTypes: ['violations'] });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' > ')),
    }));
  });
  expect(editorAxeViolations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 640 });
  await page.reload();
  await page.getByRole('heading', { level: 1, name: '页面搭建器', exact: true }).waitFor();
  await expect(page.locator('.doc-builder-editor')).toHaveCount(1);

  const narrowGeometry = await page.locator('.doc-builder-editor').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(narrowGeometry.left).toBeGreaterThanOrEqual(0);
  expect(narrowGeometry.right).toBeLessThanOrEqual(320);
  expect(narrowGeometry.documentWidth).toBe(narrowGeometry.viewportWidth);

  const narrowToolbar = page.locator('.doc-builder-editor').locator('.studio-canvas-toolbar');
  const narrowToolbarGeometry = await narrowToolbar.evaluate((node) => {
    const firstControl = node.querySelector('button:not(.studio-canvas-mode button)');
    const lastControl = node.querySelector('select');
    if (!firstControl) throw new Error('窄屏画布工具条缺少按钮');
    if (!lastControl) throw new Error('窄屏画布工具条缺少缩放选择框');
    const toolbarRect = node.getBoundingClientRect();
    const firstRect = firstControl.getBoundingClientRect();
    const lastRect = lastControl.getBoundingClientRect();
    return {
      toolbarHeight: toolbarRect.height,
      firstHeight: firstRect.height,
      firstLeft: firstRect.left,
      lastRight: lastRect.right,
      toolbarLeft: toolbarRect.left,
      toolbarRight: toolbarRect.right,
    };
  });
  expect(narrowToolbarGeometry.toolbarHeight).toBeGreaterThanOrEqual(
    narrowToolbarGeometry.firstHeight
  );
  expect(narrowToolbarGeometry.firstLeft).toBeGreaterThanOrEqual(narrowToolbarGeometry.toolbarLeft);
  expect(narrowToolbarGeometry.lastRight).toBeLessThanOrEqual(narrowToolbarGeometry.toolbarRight);
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
  await range.getByRole('combobox', { name: '开始日期' }).click();
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
  await expect(range.getByRole('combobox', { name: '开始日期' })).toHaveValue('2024-06-25');
  await expect(range.getByRole('combobox', { name: '结束日期' })).toHaveValue('2024-07-05');
});

test('DateRangePicker 中间宽度与暗色面板保持可用', async ({ page }) => {
  await openRoute(page, '/components/date-range-picker', 'DateRangePicker 日期范围选择器');
  const range = page.locator('.z-daterange').first();
  const trigger = range.getByRole('combobox', { name: '开始日期' });

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

test('暗色切换：跟随系统且可显式切换浅色与暗色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openRoute(page, '/', H1.overview);

  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  const systemColors = await page.locator('body').evaluate((node) => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(systemColors.background).not.toBe('rgb(255, 255, 255)');
  expect(systemColors.background).not.toBe(systemColors.foreground);

  await page.addScriptTag({ content: AXE_SOURCE });
  const versionContrastViolations = await page.locator('.doc-version').evaluate(async (version) => {
    type AxeApi = {
      run(
        root: Element,
        options: {
          resultTypes: string[];
          runOnly: { type: string; values: string[] };
        }
      ): Promise<{ violations: Array<{ id: string }> }>;
    };
    const axe = (window as unknown as { axe?: AxeApi }).axe;
    if (!axe) throw new Error('axe-core 未能注入文档页面');
    const results = await axe.run(version, {
      resultTypes: ['violations'],
      runOnly: { type: 'rule', values: ['color-contrast'] },
    });
    return results.violations.map((violation) => violation.id);
  });
  expect(versionContrastViolations).toEqual([]);

  const toLight = page.getByRole('button', { name: '切换浅色' });
  await expect(toLight).toHaveCount(1);
  await toLight.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '切换暗色' })).toHaveCount(1);

  await page.getByRole('button', { name: '切换暗色' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: '切换浅色' })).toHaveCount(1);
});

test('文档外壳：全部导航页在 320px 暗色视口无页面级横向溢出', async ({ page }) => {
  test.setTimeout(120_000);
  expect(NAV_ROUTES.length).toBeGreaterThan(60);
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto('/');
  await page.getByRole('button', { name: '切换暗色' }).click();

  const issues: string[] = [];
  for (const route of NAV_ROUTES) {
    const previousTitle = await page.title();
    await page.evaluate((path) => {
      window.location.hash = path;
    }, route);
    await expect(
      page.locator(`#doc-sidebar [data-part="link"][aria-current="page"][href="#${route}"]`)
    ).toHaveCount(1);
    if (route !== '/') {
      // 等 lazy 页面真正挂载（usePageTitle 已执行），避免连续切换时取消尚未完成的模块请求。
      await expect.poll(() => page.title()).not.toBe(previousTitle);
    }
    // 区块预览可包含 h1；文档主标题有专用类名，也可以位于协作页的语义页头中。
    // SideNav 后台壳原型是全幅应用壳，没有 .doc-page 结构，校验它自己的 h1。
    if (route.startsWith('/prototype/')) {
      await expect(page.locator('.admin-prototype h1')).toHaveCount(1);
    } else {
      await expect(page.locator('.doc-page h1.doc-h1, .doc-page > .doc-hero > h1')).toHaveCount(1);
    }
    await expect(page.getByText(ERROR_SENTINEL)).toHaveCount(0);

    const result = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('.doc-main');
      const pageEl = document.querySelector<HTMLElement>('.doc-page');
      const topbar = document.querySelector<HTMLElement>('.doc-topbar');
      if (!main || !pageEl || !topbar) return ['缺少文档外壳节点'];
      const mainRect = main.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      const topbarRect = topbar.getBoundingClientRect();
      const found: string[] = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1)
        found.push(`页面宽 ${document.documentElement.scrollWidth} > 视口 ${window.innerWidth}`);
      if (main.scrollWidth > main.clientWidth + 1)
        found.push(`正文滚动宽 ${main.scrollWidth} > ${main.clientWidth}`);
      if (pageRect.left < mainRect.left - 1 || pageRect.right > mainRect.right + 1)
        found.push(`正文边界 ${pageRect.left}..${pageRect.right}`);
      if (topbarRect.left < -1 || topbarRect.right > window.innerWidth + 1)
        found.push(`顶栏边界 ${topbarRect.left}..${topbarRect.right}`);
      return found;
    });
    issues.push(...result.map((issue) => `${route}: ${issue}`));
  }

  expect(issues).toEqual([]);
});

test('文档外壳：移动菜单管理焦点，桌面页内目录不改写 hash', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await openRoute(page, '/', H1.overview);

  const menu = page.getByRole('button', { name: '打开文档菜单' });
  await menu.click();
  const dialog = page.getByRole('dialog', { name: '文档菜单', exact: true });
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const navigation = dialog.getByRole('navigation', { name: '文档导航', exact: true });
  await expect(navigation).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: '文档导航', exact: true })).toHaveCount(1);
  await expect(navigation).toHaveAttribute('data-collapsed', 'false');
  const search = dialog.getByRole('searchbox', { name: '按名称过滤导航项' });
  await expect(search).toBeFocused();
  await search.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '关闭文档菜单', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '关闭文档菜单', exact: true }).press('Shift+Tab');
  await expect(navigation.locator('[data-part="link"]').last()).toBeFocused();
  await navigation.locator('[data-part="link"]').last().press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭文档菜单', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '关闭文档菜单', exact: true }).press('Tab');
  await expect(search).toBeFocused();
  await search.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '打开文档菜单' })).toBeFocused();

  // 首次请求 lazy 路由时，需等 Suspense 内容真正挂载后再把焦点交给页面标题。
  await menu.click();
  await page.getByRole('link', { name: 'TreeSelect 树选择', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'TreeSelect 树选择', exact: true })
  ).toBeFocused();
  await expect(dialog).toHaveCount(0);
  await menu.click();
  await navigation.getByRole('link', { name: 'TreeSelect 树选择', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 1, name: 'TreeSelect 树选择', exact: true })
  ).toBeFocused();
  await page.evaluate(() => {
    window.location.hash = '/';
  });
  await expect(
    page.getByRole('heading', { level: 1, name: H1.overview, exact: true })
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  const toc = page.getByRole('navigation', { name: '页内导航' });
  await expect(toc).toBeVisible();
  const before = page.url();
  await toc.getByRole('button', { name: '快速开始' }).click();
  await expect(toc.getByRole('button', { name: '快速开始' })).toHaveAttribute(
    'aria-current',
    'location'
  );
  expect(page.url()).toBe(before);

  const geometry = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.doc-main')!.getBoundingClientRect();
    const content = document.querySelector<HTMLElement>('.doc-page')!.getBoundingClientRect();
    const tocRect = document.querySelector<HTMLElement>('.doc-toc')!.getBoundingClientRect();
    return { main, content, toc: tocRect };
  });
  expect(geometry.content.right).toBeLessThanOrEqual(geometry.toc.left);
  expect(geometry.toc.right).toBeLessThanOrEqual(geometry.main.right);
});

test('文档外壳：SideNav 搜索保留路由语义，移动快捷键与搭建器断点可用', async ({ page }) => {
  await openRoute(page, '/', H1.overview);
  const navigation = page.getByRole('navigation', { name: '文档导航', exact: true });
  await expect(navigation).toHaveCount(1);
  await expect(navigation.getByRole('list')).toHaveCount(8);
  await expect(navigation.getByRole('link', { name: '概览', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  // ⌘K 打开全局命令面板（RFC-004 原型 1，mod 按浏览器 UA 平台映射）
  const mod = /mac/i.test(await page.evaluate(() => navigator.userAgent)) ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+k`);
  const paletteDialog = page.getByRole('dialog', { name: '文档命令面板' });
  await expect(paletteDialog).toBeVisible();
  await expect(paletteDialog.getByRole('combobox', { name: '搜索命令' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paletteDialog).toHaveCount(0);

  // 文档搜索的过滤语义保留（入口为侧栏搜索框本身）
  const search = page.getByRole('searchbox', { name: '按名称过滤导航项' });
  await search.click();
  await search.fill('TreeSelect');
  await expect(navigation.getByRole('list')).toHaveCount(1);
  await expect(navigation.getByRole('link')).toHaveCount(1);
  await expect(navigation.locator('[aria-current]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$|\/$/);
  await search.fill('没有这个页面');
  await expect(navigation.getByRole('list')).toHaveCount(0);
  await expect(page.getByText('没有匹配「没有这个页面」的页面', { exact: true })).toBeVisible();
  await search.fill('');

  await page.setViewportSize({ width: 320, height: 600 });
  // 320px：抽屉改由菜单按钮打开；⌘K 打开命令面板而非抽屉
  await page.getByRole('button', { name: /打开文档菜单|菜单/ }).click();
  const dialog = page.getByRole('dialog', { name: '文档菜单', exact: true });
  await expect(dialog).toBeVisible();
  const mobileSearch = dialog.getByRole('searchbox', { name: '按名称过滤导航项' });
  await mobileSearch.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press(`${mod}+k`);
  await expect(page.getByRole('dialog', { name: '文档命令面板' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '文档命令面板' })).toHaveCount(0);

  await page.setViewportSize({ width: 850, height: 800 });
  await page.evaluate(() => {
    window.location.hash = '/builder';
  });
  await expect(page.locator('.studio')).toBeVisible();
  await expect(navigation).not.toBeVisible();
  const components = page.getByRole('button', { name: '组件库', exact: true });
  await components.click();
  await expect(page.getByRole('dialog', { name: '组件库', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: '组件库', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回文档', exact: true }).click();
  await expect(navigation).toBeVisible();
});

test('图标库：窄屏详情接管焦点，关闭后返回触发图标', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await openRoute(page, '/icons', '图标库');

  const trigger = page.getByRole('button', { name: 'Check', exact: true });
  const detailClose = page.getByRole('button', { name: '关闭图标详情' });
  await trigger.click();
  await expect(detailClose).toBeFocused();

  await detailClose.click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(detailClose).toBeFocused();
  await page.getByRole('button', { name: '关闭详情', exact: true }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(detailClose).toBeFocused();
  const directionFilter = page.getByRole('button', { name: /^方向 ·/ });
  await directionFilter.click();
  await expect(detailClose).toHaveCount(0);
  await expect(directionFilter).toBeFocused();
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
