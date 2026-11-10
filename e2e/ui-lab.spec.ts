import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const axeSource = readFileSync(
  new URL('../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8'
);
async function open(page: Page) {
  await page.goto('/#/lab');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('好看，也好用。');
}
const card = (page: Page, name: string) =>
  page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) });

test('设计目录按分组与关键词筛选，隐藏再显示保留交互状态', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('article')).toHaveCount(10);
  const metric = card(page, '把趋势变成下一步');
  await metric.getByRole('button', { name: '本月', exact: true }).click();
  await page
    .getByRole('group', { name: '设计分组' })
    .getByRole('button', { name: '文件协作' })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('textbox', { name: '搜索设计' }).fill('版本');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(card(page, '变化，有迹可循')).toBeVisible();
  await page.getByRole('textbox', { name: '搜索设计' }).fill('不存在的设计');
  await expect(page.getByText('没有匹配的设计，换个关键词试试。')).toBeVisible();
  await page.getByRole('button', { name: '查看全部设计', exact: true }).click();
  await expect(metric.getByRole('button', { name: '本月', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(metric).toContainText('98,420');
  await metric.getByRole('button', { name: '第1周，20200 次访问', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(metric.getByRole('status')).toHaveText('第1周：20200 次访问');
});

test('条件构建器执行 AND、OR、反向规则与删除焦点回退', async ({ page }) => {
  await open(page);
  const query = card(page, '复杂条件，清楚表达');
  await expect(query.locator('.lab-result-row')).toHaveCount(2);
  await query.getByRole('button', { name: /添加条件/ }).click();
  await expect(query.locator('.lab-result-row')).toHaveCount(1);
  await query.getByRole('button', { name: '任一 OR', exact: true }).click();
  await expect(query.locator('.lab-result-row')).toHaveCount(3);
  await query.getByLabel('条件 1 运算符', { exact: true }).selectOption('not');
  await expect(query.locator('.lab-result-row')).toHaveCount(4);
  await query.getByRole('button', { name: '删除条件 2', exact: true }).click();
  await expect(query.getByRole('button', { name: /添加条件/ })).toBeFocused();
  await query.getByRole('button', { name: '删除条件 1', exact: true }).click();
  await expect(query.locator('.lab-result-row')).toHaveCount(5);
  for (let index = 0; index < 4; index++)
    await query.getByRole('button', { name: /添加条件/ }).click();
  await expect(query.getByRole('button', { name: /添加条件/ })).toBeDisabled();
  await query.getByRole('button', { name: '删除条件 4', exact: true }).click();
  await expect(query.getByRole('button', { name: /添加条件/ })).toBeFocused();
});

test('文件工作台搜索、筛选、批量归档撤销与预览焦点恢复', async ({ page }) => {
  await open(page);
  const files = card(page, '文件，各就各位');
  await files.getByRole('textbox', { name: '搜索文件', exact: true }).fill('规范');
  await expect(files.locator('.lab-file')).toHaveCount(1);
  const trigger = files.getByRole('button', { name: '交互规范.md', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '交互规范.md', exact: true });
  await expect(dialog).toContainText('所有操作支持键盘');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await files.getByRole('textbox', { name: '搜索文件', exact: true }).fill('');
  await files
    .getByRole('group', { name: '文件类型' })
    .getByRole('button', { name: '数据', exact: true })
    .click();
  await expect(files.locator('.lab-file')).toHaveCount(2);
  await files.getByLabel('选择 迭代计划.csv', { exact: true }).check();
  await files.getByLabel('选择 主题配置.json', { exact: true }).check();
  await files.getByRole('button', { name: '归档所选', exact: true }).click();
  await expect(files.locator('.lab-file')).toHaveCount(0);
  await files.getByRole('button', { name: '撤销归档', exact: true }).click();
  await expect(files.locator('.lab-file')).toHaveCount(2);
  await files.getByRole('button', { name: '列表', exact: true }).click();
  await expect(files.locator('.lab-files')).toHaveAttribute('data-view', 'list');
  await files.getByLabel('文件排序', { exact: true }).selectOption('name');
  await files
    .getByRole('group', { name: '文件类型' })
    .getByRole('button', { name: '设计', exact: true })
    .click();
  await files.getByRole('button', { name: '品牌封面.svg', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('img', { name: '山间湖泊品牌封面' })
  ).toBeVisible();
  await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  await expect(files.getByRole('button', { name: '品牌封面.svg', exact: true })).toBeFocused();
});

test('版本对比切换布局、隐藏未修改行并逐项定位', async ({ page }) => {
  await open(page);
  const diff = card(page, '变化，有迹可循');
  await expect(diff.locator('.lab-diff-line')).toHaveCount(5);
  await diff.getByRole('checkbox', { name: '只看修改', exact: true }).check();
  await expect(diff.locator('.lab-diff-line')).toHaveCount(3);
  await diff.getByRole('button', { name: '行内', exact: true }).click();
  await expect(diff.locator('.lab-diff')).toHaveAttribute('data-mode', 'inline');
  await diff.getByRole('button', { name: '下一处修改', exact: true }).click();
  await expect(diff.getByRole('status')).toHaveText('当前修改：评论规则');
  await expect(diff.locator('[data-active="true"]')).toContainText('保留编辑记录');
  await diff.getByRole('button', { name: '上一处修改', exact: true }).click();
  await expect(diff.getByRole('status')).toHaveText('当前修改：预览类型');
});

test('任务创建、筛选与跨列移动保持键盘焦点', async ({ page }) => {
  await open(page);
  const tasks = card(page, '让进展自然流动');
  await tasks.getByLabel('筛选任务优先级', { exact: true }).selectOption('高');
  await expect(tasks.locator('.lab-task')).toHaveCount(2);
  const state = tasks.getByLabel('设计文件工作台的状态', { exact: true });
  await state.selectOption('已完成');
  await expect(tasks.getByRole('region', { name: '已完成任务', exact: true })).toContainText(
    '设计文件工作台'
  );
  await expect(state).toBeFocused();
  await tasks.getByRole('textbox', { name: '新任务名称', exact: true }).fill('验收协作方案');
  await tasks.getByRole('button', { name: '添加任务', exact: true }).click();
  await expect(tasks.getByLabel('筛选任务优先级', { exact: true })).toHaveValue('全部');
  await expect(tasks.getByRole('region', { name: '待开始任务', exact: true })).toContainText(
    '验收协作方案'
  );
  await tasks.getByRole('textbox', { name: '搜索任务', exact: true }).fill('验收协作');
  await expect(tasks.locator('.lab-task')).toHaveCount(1);
});

test('审批退回要求原因、重新提交与逐级完成', async ({ page }) => {
  await open(page);
  const approval = card(page, '每个决定，都有依据');
  await approval.getByRole('button', { name: '退回修改', exact: true }).click();
  const comment = approval.getByRole('textbox', { name: /审批意见/ });
  await expect(comment).toBeFocused();
  await expect(comment).toHaveAttribute('aria-invalid', 'true');
  await comment.fill('请补充移动端验收范围。');
  await approval.getByRole('button', { name: '退回修改', exact: true }).click();
  await expect(approval.getByRole('status')).toContainText('申请已退回');
  await expect(approval.getByRole('button', { name: '修改后重新提交', exact: true })).toBeFocused();
  await approval.locator('summary').click();
  await expect(approval.locator('.lab-history')).toContainText(
    '陈晨退回了申请：请补充移动端验收范围。'
  );
  await approval.getByRole('button', { name: '修改后重新提交', exact: true }).click();
  await expect(comment).toBeFocused();
  await approval.getByRole('button', { name: '通过审批', exact: true }).click();
  await expect(approval.getByRole('status')).toContainText('等待项目负责人');
  await approval.getByRole('button', { name: '通过审批', exact: true }).click();
  await expect(approval.getByRole('status')).toContainText('所有审批已通过');
  await expect(approval.getByRole('button', { name: '重置演示', exact: true })).toBeFocused();
  await expect(approval.locator('.lab-history')).toContainText('周宁通过了申请');
  await approval.getByRole('button', { name: '重置演示', exact: true }).click();
  await expect(approval.getByRole('status')).toHaveText('等待设计负责人审批。');
});

test('通知已读与收藏、成员角色与权限实际联动', async ({ page }) => {
  await open(page);
  const inbox = card(page, '重要消息，刚刚好');
  await inbox.getByRole('button', { name: '未读', exact: true }).click();
  await expect(inbox.locator('.lab-message')).toHaveCount(2);
  await inbox.getByRole('button', { name: /陈晨 09:42/ }).click();
  await expect(inbox.locator('.lab-message')).toHaveCount(1);
  await expect(inbox.locator('.lab-message-detail')).toContainText('选中状态');
  await expect(inbox.getByRole('button', { name: '标为未读', exact: true })).toBeFocused();
  await inbox.getByRole('button', { name: '标为未读', exact: true }).click();
  await expect(inbox.locator('.lab-message')).toHaveCount(2);
  await inbox.getByRole('button', { name: '收藏陈晨的通知', exact: true }).click();
  await inbox.getByRole('button', { name: '已收藏', exact: true }).click();
  await expect(inbox.locator('.lab-message')).toHaveCount(2);
  await inbox.getByRole('button', { name: '全部已读', exact: true }).click();
  await inbox.getByRole('button', { name: '未读', exact: true }).click();
  await expect(inbox.getByText('当前没有未读通知')).toBeVisible();
  const access = card(page, '协作开放，权限清楚');
  await access.getByLabel('陈晨的角色', { exact: true }).selectOption('admin');
  await expect(access.locator('.lab-permission-value').filter({ hasText: '允许' })).toHaveCount(3);
  await access.getByLabel('陈晨的角色', { exact: true }).selectOption('viewer');
  await expect(access.locator('.lab-permission-value').filter({ hasText: '允许' })).toHaveCount(1);
  await access.getByRole('textbox', { name: '新成员姓名', exact: true }).fill('苏禾');
  await access.getByRole('button', { name: '添加成员', exact: true }).click();
  await expect(access.getByLabel('苏禾的角色', { exact: true })).toHaveValue('viewer');
  await expect(access.locator('.lab-permissions')).toContainText('苏禾的权限');
});

test('预约占用保护、确认与取消，样式参数真实应用并重置', async ({ page }) => {
  await open(page);
  const schedule = card(page, '把合适的时间留出来');
  await expect(schedule.getByRole('button', { name: '10:00 已占用', exact: true })).toBeDisabled();
  await expect(schedule.getByRole('button', { name: '确认预约', exact: true })).toBeDisabled();
  await schedule.getByRole('button', { name: '09:00 可预约', exact: true }).click();
  await schedule.getByRole('button', { name: '周二 10 2026年11月10日', exact: true }).click();
  await expect(schedule.getByRole('button', { name: '确认预约', exact: true })).toBeDisabled();
  await schedule.getByRole('button', { name: '11:00 可预约', exact: true }).click();
  await schedule.getByRole('button', { name: '确认预约', exact: true }).click();
  await expect(schedule.getByRole('status')).toContainText('2026-11-10 11:00');
  await expect(schedule.getByRole('button', { name: '取消预约', exact: true })).toBeFocused();
  await expect(schedule.getByRole('button', { name: '11:00 已占用', exact: true })).toBeDisabled();
  await schedule.getByRole('button', { name: '取消预约', exact: true }).click();
  await expect(schedule.getByRole('button', { name: '11:00 可预约', exact: true })).toBeEnabled();
  await expect(schedule.getByRole('button', { name: '11:00 可预约', exact: true })).toBeFocused();
  const style = card(page, '把风格，调成你的');
  await style.getByRole('button', { name: '鸢尾', exact: true }).click();
  const radius = style.getByRole('slider', { name: /圆角/ });
  await radius.fill('4');
  await style.getByRole('button', { name: '紧凑', exact: true }).click();
  const preview = style.getByLabel('实时样式预览', { exact: true });
  await expect(preview).toHaveCSS('border-radius', '4px');
  await expect(preview.locator('.lab-preview-cover')).toHaveCSS(
    'background-color',
    'rgb(117, 66, 172)'
  );
  await expect(preview.locator('.lab-preview-body')).toHaveCSS('padding', '10px');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await style.getByRole('button', { name: '复制样式 CSS', exact: true }).click();
  await expect(style.getByRole('status')).toHaveText('样式 CSS 已复制到剪贴板。');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('--accent: #7542ac;');
  await style.getByRole('button', { name: '关注', exact: true }).click();
  await expect(style.getByRole('button', { name: '已关注', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await style.getByRole('button', { name: '重置样式', exact: true }).click();
  await expect(preview).toHaveCSS('border-radius', '16px');
  await expect(preview.locator('.lab-preview-body')).toHaveCSS('padding', '16px');
});

for (const width of [1440, 320]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`工坊显示、完整无障碍与减少动效 ${width}px ${colorScheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await open(page);
      await page.addScriptTag({ content: axeSource });
      const violations = await page
        .locator('.doc-main')
        .evaluate(async (main) =>
          (
            window as unknown as { axe: { run(root: Element): Promise<{ violations: unknown[] }> } }
          ).axe
            .run(main)
            .then((result) => result.violations)
        );
      expect(violations).toEqual([]);
      const overflow = await page.locator('.doc-main').evaluate((main) => {
        const issues: string[] = [];
        if (main.scrollWidth > main.clientWidth + 1) issues.push('main');
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document');
        for (const stage of main.querySelectorAll('.lab-stage')) {
          if (stage.scrollWidth > stage.clientWidth + 1)
            issues.push(stage.closest('article')?.querySelector('h2')?.textContent ?? 'stage');
        }
        return issues;
      });
      expect(overflow).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('lab-first-screen.png') });
      for (const [index, design] of (await page.locator('.lab-card').all()).entries()) {
        // 正文有独立滚动区；长卡片需完整落入视口，避免截图把下方内容裁成背景。
        const height = await design.evaluate((element) => element.getBoundingClientRect().height);
        await page.setViewportSize({ width, height: Math.max(900, Math.ceil(height) + 140) });
        await design.screenshot({
          path: testInfo.outputPath(`design-${String(index + 1).padStart(2, '0')}.png`),
        });
        await page.setViewportSize({ width, height: 900 });
      }
    });
  }
}
